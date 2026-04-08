import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { findChildren, findFirstChild, parseXml, type XmlNode } from './xml.js';

type VendorName = 'rekordbox' | 'traktor';

type VendorCuePoint = {
  name?: string | null;
  type: 'memory' | 'hotcue' | 'grid' | 'load' | 'fadein' | 'fadeout';
  cueIndex?: number | null;
  startSec: number;
  color?: string | null;
  comment?: string | null;
};

type VendorLoopPoint = {
  name?: string | null;
  startSec: number;
  endSec: number;
  loopIndex?: number | null;
  active?: boolean;
  color?: string | null;
};

type VendorBeatGrid = {
  anchorSec: number;
  bpm: number;
  meterNumerator?: number | null;
  meterDenominator?: number | null;
  locked?: boolean;
  markers: Array<{
    startSec: number;
    bpm: number;
    beatNumber?: number | null;
  }>;
};

export type VendorTrackLink = {
  vendor: VendorName;
  title: string | null;
  fileName: string | null;
  comment?: string | null;
  rating?: number | null;
  addedAt?: string | null;
  rekordboxTrackId?: string;
  rekordboxLocationUri?: string;
  traktorAudioId?: string;
  traktorCollectionPathKey?: string;
  cuePoints?: VendorCuePoint[];
  loopPoints?: VendorLoopPoint[];
  beatGrid?: VendorBeatGrid | null;
};

export type VendorPlaylistState = {
  vendor: VendorName;
  sourceRef: string;
  parentSourceRef?: string | null;
  name: string;
  type: 'crate' | 'playlist';
  items: VendorTrackLink[];
};

export type VendorLinkImportResult = {
  vendor: VendorName;
  candidateCount: number;
  linkedCount: number;
  skippedCount: number;
};

export type VendorLibraryImportResult = {
  vendor: VendorName;
  trackCandidateCount: number;
  trackLinkedCount: number;
  trackSkippedCount: number;
  playlistCandidateCount: number;
  playlistImportedCount: number;
  playlistItemCount: number;
};

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLocationFileName(location: string | null): string | null {
  if (!location) {
    return null;
  }

  try {
    if (location.startsWith('file://')) {
      return path.basename(new URL(location).pathname);
    }
  } catch {
    return path.basename(location);
  }

  return path.basename(location);
}

function parseOptionalDate(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const dateMatch = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dateMatch) {
    const [, year, month, day, hour, minute, second] = dateMatch;
    return `${year}-${month}-${day}T${hour ?? '00'}:${minute ?? '00'}:${second ?? '00'}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseOptionalRating(value: string | null | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed >= 0 && parsed <= 5) {
    return parsed;
  }

  if (parsed >= 0 && parsed <= 255) {
    return Math.max(0, Math.min(5, Math.round(parsed / 51)));
  }

  return null;
}

function parseOptionalFloat(value: string | null | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: string | null | undefined): number | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function pathRef(segments: string[]): string {
  return segments.filter(Boolean).join(' / ');
}

function matchTrackId(database: DatabaseSync, link: VendorTrackLink): string | null {
  const row = database.prepare(`
    SELECT id
    FROM tracks
    WHERE lower(title) = lower(?)
       OR lower(file_name) = lower(?)
       OR rekordbox_track_id = ?
       OR rekordbox_location_uri = ?
       OR traktor_audio_id = ?
       OR traktor_collection_path_key = ?
    ORDER BY title COLLATE NOCASE, id
  `).all(
    link.title ?? '',
    link.fileName ?? '',
    link.rekordboxTrackId ?? null,
    link.rekordboxLocationUri ?? null,
    link.traktorAudioId ?? null,
    link.traktorCollectionPathKey ?? null,
  ) as Array<{ id: string }>;

  return row.length === 1 ? row[0].id : null;
}

function upsertTrackLinks(database: DatabaseSync, vendor: VendorName, links: VendorTrackLink[]): {
  linkedCount: number;
  skippedCount: number;
  trackIdsBySourceKey: Map<string, string>;
} {
  const updateTrack = database.prepare(`
    UPDATE tracks
    SET rekordbox_track_id = COALESCE(?, rekordbox_track_id),
        rekordbox_location_uri = COALESCE(?, rekordbox_location_uri),
        traktor_audio_id = COALESCE(?, traktor_audio_id),
        traktor_collection_path_key = COALESCE(?, traktor_collection_path_key),
        rating = CASE WHEN ? IS NULL THEN rating ELSE ? END,
        comment = COALESCE(comment, ?),
        added_at = CASE
          WHEN ? IS NULL THEN added_at
          WHEN added_at IS NULL OR added_at > ? THEN ?
          ELSE added_at
        END,
        updated_at = ?
    WHERE id = ?
  `);
  const insertProvenance = database.prepare(`
    INSERT INTO metadata_provenance (
      entity_kind, entity_id, field_path, source_kind, source_name, source_ref, confidence, observed_at, value_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const deleteBeatGridMarkers = database.prepare(`DELETE FROM beat_grid_markers WHERE track_id = ?`);
  const deleteBeatGrid = database.prepare(`DELETE FROM beat_grids WHERE track_id = ?`);
  const deleteLoopPoints = database.prepare(`DELETE FROM loop_points WHERE track_id = ?`);
  const deleteCuePoints = database.prepare(`DELETE FROM cue_points WHERE track_id = ?`);
  const insertCuePoint = database.prepare(`
    INSERT INTO cue_points (id, track_id, name, type, cue_index, start_sec, color, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLoopPoint = database.prepare(`
    INSERT INTO loop_points (id, track_id, name, start_sec, end_sec, loop_index, active, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBeatGrid = database.prepare(`
    INSERT INTO beat_grids (track_id, anchor_sec, bpm, meter_numerator, meter_denominator, locked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertBeatGridMarker = database.prepare(`
    INSERT INTO beat_grid_markers (track_id, position, start_sec, bpm, beat_number)
    VALUES (?, ?, ?, ?, ?)
  `);

  let linkedCount = 0;
  let skippedCount = 0;
  const observedAt = new Date().toISOString();
  const trackIdsBySourceKey = new Map<string, string>();

  for (const link of links) {
    const trackId = matchTrackId(database, link);
    if (!trackId) {
      skippedCount += 1;
      continue;
    }

    updateTrack.run(
      link.rekordboxTrackId ?? null,
      link.rekordboxLocationUri ?? null,
      link.traktorAudioId ?? null,
      link.traktorCollectionPathKey ?? null,
      link.rating ?? null,
      link.rating ?? null,
      link.comment ?? null,
      link.addedAt ?? null,
      link.addedAt ?? null,
      link.addedAt ?? null,
      observedAt,
      trackId,
    );

    if (link.rekordboxTrackId) {
      trackIdsBySourceKey.set(`rekordbox_track_id:${link.rekordboxTrackId}`, trackId);
      insertProvenance.run('track', trackId, 'app.rekordbox.trackId', 'vendor-library', vendor, link.rekordboxTrackId, 0.95, observedAt, JSON.stringify(link.rekordboxTrackId));
    }
    if (link.rekordboxLocationUri) {
      trackIdsBySourceKey.set(`rekordbox_location_uri:${link.rekordboxLocationUri}`, trackId);
      insertProvenance.run('track', trackId, 'app.rekordbox.locationUri', 'vendor-library', vendor, link.rekordboxLocationUri, 0.95, observedAt, JSON.stringify(link.rekordboxLocationUri));
    }
    if (link.traktorAudioId) {
      trackIdsBySourceKey.set(`traktor_audio_id:${link.traktorAudioId}`, trackId);
      insertProvenance.run('track', trackId, 'app.traktor.audioId', 'vendor-library', vendor, link.traktorAudioId, 0.95, observedAt, JSON.stringify(link.traktorAudioId));
    }
    if (link.traktorCollectionPathKey) {
      trackIdsBySourceKey.set(`traktor_collection_path_key:${link.traktorCollectionPathKey}`, trackId);
      insertProvenance.run('track', trackId, 'app.traktor.collectionPathKey', 'vendor-library', vendor, link.traktorCollectionPathKey, 0.95, observedAt, JSON.stringify(link.traktorCollectionPathKey));
    }
    if (link.comment) {
      insertProvenance.run('track', trackId, 'notes.comment', 'vendor-library', vendor, link.title ?? link.fileName ?? null, 0.8, observedAt, JSON.stringify(link.comment));
    }
    if (link.rating !== null && link.rating !== undefined) {
      insertProvenance.run('track', trackId, 'musical.rating', 'vendor-library', vendor, link.title ?? link.fileName ?? null, 0.8, observedAt, JSON.stringify(link.rating));
    }
      if (link.addedAt) {
        insertProvenance.run('track', trackId, 'file.addedAt', 'vendor-library', vendor, link.title ?? link.fileName ?? null, 0.8, observedAt, JSON.stringify(link.addedAt));
      }

      if ((link.cuePoints?.length ?? 0) > 0 || (link.loopPoints?.length ?? 0) > 0 || link.beatGrid) {
        deleteBeatGridMarkers.run(trackId);
        deleteBeatGrid.run(trackId);
        deleteLoopPoints.run(trackId);
        deleteCuePoints.run(trackId);

        for (const cuePoint of link.cuePoints ?? []) {
          insertCuePoint.run(
            randomUUID(),
            trackId,
            cuePoint.name ?? null,
            cuePoint.type,
            cuePoint.cueIndex ?? null,
            cuePoint.startSec,
            cuePoint.color ?? null,
            cuePoint.comment ?? null,
          );
        }

        for (const loopPoint of link.loopPoints ?? []) {
          insertLoopPoint.run(
            randomUUID(),
            trackId,
            loopPoint.name ?? null,
            loopPoint.startSec,
            loopPoint.endSec,
            loopPoint.loopIndex ?? null,
            loopPoint.active ? 1 : 0,
            loopPoint.color ?? null,
          );
        }

        if (link.beatGrid) {
          insertBeatGrid.run(
            trackId,
            link.beatGrid.anchorSec,
            link.beatGrid.bpm,
            link.beatGrid.meterNumerator ?? null,
            link.beatGrid.meterDenominator ?? null,
            link.beatGrid.locked ? 1 : 0,
          );

          for (const [index, marker] of link.beatGrid.markers.entries()) {
            insertBeatGridMarker.run(trackId, index, marker.startSec, marker.bpm, marker.beatNumber ?? null);
          }
        }
      }

      linkedCount += 1;
    }

  return {
    linkedCount,
    skippedCount,
    trackIdsBySourceKey,
  };
}

function importPlaylists(
  database: DatabaseSync,
  vendor: VendorName,
  playlists: VendorPlaylistState[],
  trackIdsBySourceKey: Map<string, string>,
): { playlistImportedCount: number; playlistItemCount: number } {
  const findLinkedPlaylist = database.prepare(`
    SELECT playlist_id
    FROM external_playlist_links
    WHERE vendor = ? AND source_ref = ?
  `);
  const upsertPlaylistLink = database.prepare(`
    INSERT INTO external_playlist_links (vendor, source_ref, playlist_id, parent_source_ref, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(vendor, source_ref) DO UPDATE SET
      playlist_id = excluded.playlist_id,
      parent_source_ref = excluded.parent_source_ref,
      updated_at = excluded.updated_at
  `);
  const insertPlaylist = database.prepare(`
    INSERT INTO playlists (id, name, type, parent_id, description, created_at, updated_at, sort_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updatePlaylist = database.prepare(`
    UPDATE playlists
    SET name = ?, type = ?, parent_id = ?, description = ?, updated_at = ?, sort_mode = ?
    WHERE id = ?
  `);
  const deletePlaylistItems = database.prepare(`DELETE FROM playlist_items WHERE playlist_id = ?`);
  const insertPlaylistItem = database.prepare(`
    INSERT INTO playlist_items (playlist_id, track_id, position, note, transition_note)
    VALUES (?, ?, ?, ?, ?)
  `);

  const playlistIdBySourceRef = new Map<string, string>();
  let playlistImportedCount = 0;
  let playlistItemCount = 0;
  const now = new Date().toISOString();

  for (const playlist of playlists) {
    const existing = findLinkedPlaylist.get(vendor, playlist.sourceRef) as { playlist_id: string } | undefined;
    const playlistId = existing?.playlist_id ?? randomUUID();
    const parentId = playlist.parentSourceRef ? playlistIdBySourceRef.get(playlist.parentSourceRef) ?? null : null;
    const description = `Imported from ${vendor} playlist state.`;

    if (existing) {
      updatePlaylist.run(playlist.name, playlist.type, parentId, description, now, 'manual', playlistId);
    } else {
      insertPlaylist.run(playlistId, playlist.name, playlist.type, parentId, description, now, now, 'manual');
    }

    upsertPlaylistLink.run(vendor, playlist.sourceRef, playlistId, playlist.parentSourceRef ?? null, now);
    playlistIdBySourceRef.set(playlist.sourceRef, playlistId);

    deletePlaylistItems.run(playlistId);

    if (playlist.type === 'playlist') {
      let insertedPosition = 0;
      for (const item of playlist.items) {
        const trackId =
          item.rekordboxTrackId ? trackIdsBySourceKey.get(`rekordbox_track_id:${item.rekordboxTrackId}`) :
          item.rekordboxLocationUri ? trackIdsBySourceKey.get(`rekordbox_location_uri:${item.rekordboxLocationUri}`) :
          item.traktorAudioId ? trackIdsBySourceKey.get(`traktor_audio_id:${item.traktorAudioId}`) :
          item.traktorCollectionPathKey ? trackIdsBySourceKey.get(`traktor_collection_path_key:${item.traktorCollectionPathKey}`) :
          null;
        if (!trackId) {
          continue;
        }

        insertPlaylistItem.run(playlistId, trackId, insertedPosition, null, null);
        insertedPosition += 1;
        playlistItemCount += 1;
      }
    }

    playlistImportedCount += 1;
  }

  return { playlistImportedCount, playlistItemCount };
}

function importLibraryState(
  databasePath: string,
  vendor: VendorName,
  links: VendorTrackLink[],
  playlists: VendorPlaylistState[],
): VendorLibraryImportResult {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const trackResult = upsertTrackLinks(database, vendor, links);
    const playlistResult = importPlaylists(database, vendor, playlists, trackResult.trackIdsBySourceKey);

    database.exec('COMMIT');
    return {
      vendor,
      trackCandidateCount: links.length,
      trackLinkedCount: trackResult.linkedCount,
      trackSkippedCount: trackResult.skippedCount,
      playlistCandidateCount: playlists.length,
      playlistImportedCount: playlistResult.playlistImportedCount,
      playlistItemCount: playlistResult.playlistItemCount,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

function extractRekordboxLinks(xml: string): VendorTrackLink[] {
  const root = parseXml(xml);
  if (root.name !== 'DJ_PLAYLISTS') {
    throw new Error(`Expected Rekordbox DJ_PLAYLISTS root but found <${root.name}>.`);
  }
  const collection = findFirstChild(root, 'COLLECTION');
  if (!collection) {
    throw new Error('Rekordbox XML is missing COLLECTION.');
  }

  return findChildren(collection, 'TRACK')
    .map((trackNode) => {
      const positionMarks = findChildren(trackNode, 'POSITION_MARK');
      const tempos = findChildren(trackNode, 'TEMPO');
      const cuePoints: VendorCuePoint[] = positionMarks
        .map((mark) => {
          const startSec = parseOptionalFloat(mark.attributes.Start);
          if (startSec === null) {
            return null;
          }
          const typeCode = mark.attributes.Type ?? '0';
          const num = parseOptionalInt(mark.attributes.Num);
          const mappedType: VendorCuePoint['type'] =
            typeCode === '0' ? 'memory' :
            typeCode === '1' ? 'hotcue' :
            typeCode === '3' ? 'load' :
            'memory';
          return {
            name: normalizeText(mark.attributes.Name) ?? null,
            type: mappedType,
            cueIndex: num,
            startSec,
            color: normalizeText(mark.attributes.Color) ?? null,
            comment: normalizeText(mark.attributes.Comment) ?? null,
          };
        })
        .filter(isPresent);
      const loopPoints: VendorLoopPoint[] = positionMarks
        .map((mark) => {
          const startSec = parseOptionalFloat(mark.attributes.Start);
          const endSec = parseOptionalFloat(mark.attributes.End);
          if (startSec === null || endSec === null || endSec <= startSec) {
            return null;
          }
          return {
            name: normalizeText(mark.attributes.Name) ?? null,
            startSec,
            endSec,
            loopIndex: parseOptionalInt(mark.attributes.Num),
            active: false,
            color: normalizeText(mark.attributes.Color) ?? null,
          };
        })
        .filter(isPresent);
      const beatGrid = tempos.length > 0
        ? {
            anchorSec: parseOptionalFloat(tempos[0].attributes.Inizio) ?? 0,
            bpm: parseOptionalFloat(tempos[0].attributes.Bpm) ?? 0,
            meterNumerator: parseOptionalInt(tempos[0].attributes.Battito),
            meterDenominator: 4,
            locked: true,
            markers: tempos
              .map((tempo) => {
                const startSec = parseOptionalFloat(tempo.attributes.Inizio);
                const bpm = parseOptionalFloat(tempo.attributes.Bpm);
                if (startSec === null || bpm === null) {
                  return null;
                }
                return {
                  startSec,
                  bpm,
                  beatNumber: parseOptionalInt(tempo.attributes.Battito),
                };
              })
              .filter(isPresent),
          }
        : null;

      return {
        vendor: 'rekordbox' as const,
        title: normalizeText(trackNode.attributes.Name),
        fileName: normalizeLocationFileName(trackNode.attributes.Location ?? null),
        comment: normalizeText(trackNode.attributes.Comments),
        rating: parseOptionalRating(trackNode.attributes.Rating),
        addedAt: parseOptionalDate(trackNode.attributes.DateAdded),
        rekordboxTrackId: trackNode.attributes.TrackID ?? undefined,
        rekordboxLocationUri: trackNode.attributes.Location ?? undefined,
        cuePoints,
        loopPoints,
        beatGrid,
      };
    })
    .filter((link) => Boolean(link.rekordboxTrackId || link.rekordboxLocationUri));
}

function collectRekordboxPlaylists(xml: string): VendorPlaylistState[] {
  const root = parseXml(xml);
  const collection = findFirstChild(root, 'COLLECTION');
  const playlistsRoot = findFirstChild(root, 'PLAYLISTS');
  if (!collection || !playlistsRoot) {
    throw new Error('Rekordbox XML is missing COLLECTION or PLAYLISTS.');
  }

  const trackById = new Map<string, VendorTrackLink>();
  for (const link of extractRekordboxLinks(xml)) {
    if (link.rekordboxTrackId) {
      trackById.set(link.rekordboxTrackId, link);
    }
  }

  const rootNode = findFirstChild(playlistsRoot, 'NODE');
  if (!rootNode) {
    return [];
  }

  const playlists: VendorPlaylistState[] = [];
  const visitNode = (node: XmlNode, segments: string[], parentSourceRef: string | null): void => {
    const name = normalizeText(node.attributes.Name ?? node.attributes.NAME) ?? 'Unnamed';
    if (name.toLowerCase() === 'history') {
      return;
    }

    const type = node.attributes.Type ?? node.attributes.TYPE ?? '0';
    if (name.toLowerCase() !== 'root') {
      const sourceRef = pathRef([...segments, name]);
      if (type === '0') {
        playlists.push({
          vendor: 'rekordbox',
          sourceRef,
          parentSourceRef,
          name,
          type: 'crate',
          items: [],
        });
        for (const child of findChildren(node, 'NODE')) {
          visitNode(child, [...segments, name], sourceRef);
        }
        return;
      }

      playlists.push({
        vendor: 'rekordbox',
        sourceRef,
        parentSourceRef,
        name,
        type: 'playlist',
        items: findChildren(node, 'TRACK')
          .map((trackNode) => trackById.get(trackNode.attributes.Key ?? ''))
          .filter((link): link is VendorTrackLink => Boolean(link)),
      });
      return;
    }

    for (const child of findChildren(node, 'NODE')) {
      visitNode(child, segments, parentSourceRef);
    }
  };

  visitNode(rootNode, [], null);
  return playlists;
}

function collectTraktorTrackLinks(root: XmlNode): VendorTrackLink[] {
  const collection = findFirstChild(root, 'COLLECTION');
  if (!collection) {
    throw new Error('Traktor NML is missing COLLECTION.');
  }

  return findChildren(collection, 'ENTRY')
    .map((entry) => {
      const location = findFirstChild(entry, 'LOCATION');
      const info = findFirstChild(entry, 'INFO');
      const cues = findChildren(entry, 'CUE_V2');
      const tempos = findChildren(entry, 'TEMPO');
      const dir = location?.attributes.DIR ?? '';
      const fileName = location?.attributes.FILE ?? null;
      const cuePoints: VendorCuePoint[] = cues
        .map((cue) => {
          const startSec = parseOptionalFloat(cue.attributes.START ?? cue.attributes.STARTPOINT);
          if (startSec === null) {
            return null;
          }
          const typeName = (cue.attributes.TYPE ?? '').toUpperCase();
          const mappedType: VendorCuePoint['type'] =
            typeName.includes('LOAD') ? 'load' :
            typeName.includes('GRID') ? 'grid' :
            typeName.includes('HOTCUE') || typeName.includes('CUE') ? 'hotcue' :
            'memory';
          return {
            name: normalizeText(cue.attributes.NAME) ?? null,
            type: mappedType,
            cueIndex: parseOptionalInt(cue.attributes.HOTCUE),
            startSec,
            color: normalizeText(cue.attributes.COLOR) ?? null,
            comment: normalizeText(cue.attributes.COMMENT) ?? null,
          };
        })
        .filter(isPresent);
      const loopPoints: VendorLoopPoint[] = cues
        .map((cue) => {
          const startSec = parseOptionalFloat(cue.attributes.START ?? cue.attributes.STARTPOINT);
          const endSec = parseOptionalFloat(cue.attributes.END ?? cue.attributes.ENDPOINT);
          if (startSec === null || endSec === null || endSec <= startSec) {
            return null;
          }
          return {
            name: normalizeText(cue.attributes.NAME) ?? null,
            startSec,
            endSec,
            loopIndex: parseOptionalInt(cue.attributes.HOTCUE),
            active: false,
            color: normalizeText(cue.attributes.COLOR) ?? null,
          };
        })
        .filter(isPresent);
      const beatGrid = tempos.length > 0
        ? {
            anchorSec: parseOptionalFloat(tempos[0].attributes.POSITION) ?? 0,
            bpm: parseOptionalFloat(tempos[0].attributes.BPM) ?? 0,
            meterNumerator: parseOptionalInt(tempos[0].attributes.METER ?? tempos[0].attributes.NUMERATOR),
            meterDenominator: 4,
            locked: true,
            markers: tempos
              .map((tempo) => {
                const startSec = parseOptionalFloat(tempo.attributes.POSITION);
                const bpm = parseOptionalFloat(tempo.attributes.BPM);
                if (startSec === null || bpm === null) {
                  return null;
                }
                return {
                  startSec,
                  bpm,
                  beatNumber: parseOptionalInt(tempo.attributes.BEAT),
                };
              })
              .filter(isPresent),
          }
        : null;
      return {
        vendor: 'traktor' as const,
        title: normalizeText(entry.attributes.TITLE),
        fileName,
        comment: normalizeText(info?.attributes.COMMENT ?? entry.attributes.COMMENT),
        rating: parseOptionalRating(info?.attributes.RANKING ?? entry.attributes.RANKING),
        addedAt: parseOptionalDate(info?.attributes.IMPORT_DATE ?? entry.attributes.DATE_ADDED),
        traktorAudioId: entry.attributes.AUDIO_ID ?? undefined,
        traktorCollectionPathKey: `${dir}${fileName ?? ''}` || undefined,
        cuePoints,
        loopPoints,
        beatGrid,
      };
    })
    .filter((link) => Boolean(link.traktorAudioId || link.traktorCollectionPathKey));
}

function collectTraktorPlaylists(root: XmlNode): VendorPlaylistState[] {
  const trackLinks = collectTraktorTrackLinks(root);
  const trackByKey = new Map<string, VendorTrackLink>();
  for (const link of trackLinks) {
    if (link.traktorAudioId) {
      trackByKey.set(link.traktorAudioId, link);
    }
    if (link.traktorCollectionPathKey) {
      trackByKey.set(link.traktorCollectionPathKey, link);
    }
  }

  const playlistsRoot = findFirstChild(root, 'PLAYLISTS');
  const topRoot = playlistsRoot ? findFirstChild(playlistsRoot, 'NODE') : null;
  if (!topRoot) {
    return [];
  }

  const playlists: VendorPlaylistState[] = [];
  const visitNode = (node: XmlNode, segments: string[], parentSourceRef: string | null): void => {
    const name = normalizeText(node.attributes.NAME ?? node.attributes.Name) ?? 'Unnamed';
    if (name.toLowerCase() === 'history') {
      return;
    }

    const nodeType = (node.attributes.TYPE ?? '').toUpperCase();
    const subnodes = findFirstChild(node, 'SUBNODES');

    if (name.toLowerCase() !== 'root') {
      const sourceRef = pathRef([...segments, name]);
      if (nodeType === 'FOLDER') {
        playlists.push({
          vendor: 'traktor',
          sourceRef,
          parentSourceRef,
          name,
          type: 'crate',
          items: [],
        });
        for (const child of findChildren(subnodes ?? node, 'NODE')) {
          visitNode(child, [...segments, name], sourceRef);
        }
        return;
      }

      const playlistNode = findFirstChild(node, 'PLAYLIST');
      const items = playlistNode
        ? findChildren(playlistNode, 'ENTRY')
            .map((entry) => findFirstChild(entry, 'PRIMARYKEY'))
            .map((primaryKey) => {
              if (!primaryKey) {
                return null;
              }
              const key = primaryKey.attributes.KEY ?? '';
              return trackByKey.get(key) ?? null;
            })
            .filter((link): link is VendorTrackLink => Boolean(link))
        : [];
      playlists.push({
        vendor: 'traktor',
        sourceRef,
        parentSourceRef,
        name,
        type: 'playlist',
        items,
      });
      return;
    }

    for (const child of findChildren(subnodes ?? node, 'NODE')) {
      visitNode(child, segments, parentSourceRef);
    }
  };

  visitNode(topRoot, [], null);
  return playlists;
}

export async function importRekordboxCollectionLinks(databasePath: string, xmlPath: string): Promise<VendorLinkImportResult> {
  const result = importLibraryState(databasePath, 'rekordbox', extractRekordboxLinks(await readFile(xmlPath, 'utf8')), []);
  return {
    vendor: result.vendor,
    candidateCount: result.trackCandidateCount,
    linkedCount: result.trackLinkedCount,
    skippedCount: result.trackSkippedCount,
  };
}

export async function importTraktorCollectionLinks(databasePath: string, nmlPath: string): Promise<VendorLinkImportResult> {
  const root = parseXml(await readFile(nmlPath, 'utf8'));
  if (root.name !== 'NML') {
    throw new Error(`Expected Traktor NML root but found <${root.name}>.`);
  }
  const result = importLibraryState(databasePath, 'traktor', collectTraktorTrackLinks(root), []);
  return {
    vendor: result.vendor,
    candidateCount: result.trackCandidateCount,
    linkedCount: result.trackLinkedCount,
    skippedCount: result.trackSkippedCount,
  };
}

export async function importRekordboxLibraryState(databasePath: string, xmlPath: string): Promise<VendorLibraryImportResult> {
  const xml = await readFile(xmlPath, 'utf8');
  return importLibraryState(databasePath, 'rekordbox', extractRekordboxLinks(xml), collectRekordboxPlaylists(xml));
}

export async function importTraktorLibraryState(databasePath: string, nmlPath: string): Promise<VendorLibraryImportResult> {
  const root = parseXml(await readFile(nmlPath, 'utf8'));
  if (root.name !== 'NML') {
    throw new Error(`Expected Traktor NML root but found <${root.name}>.`);
  }
  return importLibraryState(databasePath, 'traktor', collectTraktorTrackLinks(root), collectTraktorPlaylists(root));
}
