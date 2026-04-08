import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { findChildren, findFirstChild, parseXml, type XmlNode } from './xml.js';

export type VendorTrackLink = {
  vendor: 'rekordbox' | 'traktor';
  title: string | null;
  fileName: string | null;
  rekordboxTrackId?: string;
  rekordboxLocationUri?: string;
  traktorAudioId?: string;
  traktorCollectionPathKey?: string;
};

export type VendorLinkImportResult = {
  vendor: 'rekordbox' | 'traktor';
  candidateCount: number;
  linkedCount: number;
  skippedCount: number;
};

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
    .map((trackNode) => ({
      vendor: 'rekordbox' as const,
      title: trackNode.attributes.Name ?? null,
      fileName: normalizeLocationFileName(trackNode.attributes.Location ?? null),
      rekordboxTrackId: trackNode.attributes.TrackID ?? undefined,
      rekordboxLocationUri: trackNode.attributes.Location ?? undefined,
    }))
    .filter((link) => Boolean(link.rekordboxTrackId || link.rekordboxLocationUri));
}

function collectTraktorTrackLinks(root: XmlNode): VendorTrackLink[] {
  const collection = findFirstChild(root, 'COLLECTION');
  if (!collection) {
    throw new Error('Traktor NML is missing COLLECTION.');
  }

  return findChildren(collection, 'ENTRY')
    .map((entry) => {
      const location = findFirstChild(entry, 'LOCATION');
      const dir = location?.attributes.DIR ?? '';
      const fileName = location?.attributes.FILE ?? null;
      return {
        vendor: 'traktor' as const,
        title: entry.attributes.TITLE ?? null,
        fileName,
        traktorAudioId: entry.attributes.AUDIO_ID ?? undefined,
        traktorCollectionPathKey: `${dir}${fileName ?? ''}` || undefined,
      };
    })
    .filter((link) => Boolean(link.traktorAudioId || link.traktorCollectionPathKey));
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

function importLinks(databasePath: string, vendor: 'rekordbox' | 'traktor', links: VendorTrackLink[]): VendorLinkImportResult {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const updateTrack = database.prepare(`
      UPDATE tracks
      SET rekordbox_track_id = COALESCE(?, rekordbox_track_id),
          rekordbox_location_uri = COALESCE(?, rekordbox_location_uri),
          traktor_audio_id = COALESCE(?, traktor_audio_id),
          traktor_collection_path_key = COALESCE(?, traktor_collection_path_key),
          updated_at = ?
      WHERE id = ?
    `);
    const insertProvenance = database.prepare(`
      INSERT INTO metadata_provenance (
        entity_kind, entity_id, field_path, source_kind, source_name, source_ref, confidence, observed_at, value_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let linkedCount = 0;
    let skippedCount = 0;
    const observedAt = new Date().toISOString();

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
        observedAt,
        trackId,
      );

      if (link.rekordboxTrackId) {
        insertProvenance.run('track', trackId, 'app.rekordbox.trackId', 'vendor-library', vendor, link.rekordboxTrackId, 0.95, observedAt, JSON.stringify(link.rekordboxTrackId));
      }
      if (link.rekordboxLocationUri) {
        insertProvenance.run('track', trackId, 'app.rekordbox.locationUri', 'vendor-library', vendor, link.rekordboxLocationUri, 0.95, observedAt, JSON.stringify(link.rekordboxLocationUri));
      }
      if (link.traktorAudioId) {
        insertProvenance.run('track', trackId, 'app.traktor.audioId', 'vendor-library', vendor, link.traktorAudioId, 0.95, observedAt, JSON.stringify(link.traktorAudioId));
      }
      if (link.traktorCollectionPathKey) {
        insertProvenance.run('track', trackId, 'app.traktor.collectionPathKey', 'vendor-library', vendor, link.traktorCollectionPathKey, 0.95, observedAt, JSON.stringify(link.traktorCollectionPathKey));
      }

      linkedCount += 1;
    }

    database.exec('COMMIT');
    return {
      vendor,
      candidateCount: links.length,
      linkedCount,
      skippedCount,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export async function importRekordboxCollectionLinks(databasePath: string, xmlPath: string): Promise<VendorLinkImportResult> {
  return importLinks(databasePath, 'rekordbox', extractRekordboxLinks(await readFile(xmlPath, 'utf8')));
}

export async function importTraktorCollectionLinks(databasePath: string, nmlPath: string): Promise<VendorLinkImportResult> {
  const root = parseXml(await readFile(nmlPath, 'utf8'));
  if (root.name !== 'NML') {
    throw new Error(`Expected Traktor NML root but found <${root.name}>.`);
  }
  return importLinks(databasePath, 'traktor', collectTraktorTrackLinks(root));
}
