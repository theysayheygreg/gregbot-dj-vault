import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type TrackRow = {
  id: string;
  canonical_path: string;
  file_name: string;
  extension: string;
  duration_sec: number;
  sample_rate_hz: number | null;
  bitrate_kbps: number | null;
  size_bytes: number;
  added_at: string;
  title: string;
  mix_name: string | null;
  album: string | null;
  label: string | null;
  year: number | null;
  release_date: string | null;
  track_number: number | null;
  source: string | null;
  source_url: string | null;
  bpm: number | null;
  bpm_float: number | null;
  key_display: string | null;
  rating: number | null;
  genre: string | null;
  comment: string | null;
  play_count: number;
  rekordbox_track_id: string | null;
  rekordbox_location_uri: string | null;
  traktor_collection_path_key: string | null;
  traktor_audio_id: string | null;
};

type TrackPersonRow = {
  track_id: string;
  role: string;
  name: string;
};

type CuePointRow = {
  track_id: string;
  name: string | null;
  type: string;
  cue_index: number | null;
  start_sec: number;
  color: string | null;
  comment: string | null;
};

type LoopPointRow = {
  track_id: string;
  name: string | null;
  start_sec: number;
  end_sec: number;
  loop_index: number | null;
  color: string | null;
};

type BeatGridRow = {
  track_id: string;
  anchor_sec: number;
  bpm: number;
  meter_numerator: number | null;
  meter_denominator: number | null;
  locked: number;
};

type BeatGridMarkerRow = {
  track_id: string;
  position: number;
  start_sec: number;
  bpm: number;
  beat_number: number | null;
};

type PlaylistRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type PlaylistItemRow = {
  playlist_id: string;
  position: number;
  track_id: string;
};

type ExportTarget = 'rekordbox-xml' | 'traktor-nml';

export type ExportCatalogResult = {
  exportJobId: string;
  targetKind: ExportTarget;
  outputPath: string;
  playlistCount: number;
  trackCount: number;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function formatAttr(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return ` ${name}="${xmlEscape(String(value))}"`;
}

function toFileUri(filePath: string): string {
  const normalized = path.resolve(filePath).split(path.sep).join('/');
  return `file://localhost${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function joinArtists(people: TrackPersonRow[], trackId: string): string | null {
  const artists = people
    .filter((person) => person.track_id === trackId && person.role === 'artist')
    .map((person) => person.name);
  return artists.length > 0 ? artists.join(' / ') : null;
}

function toTraktorRanking(rating: number | null): number | null {
  if (rating === null || rating === undefined) {
    return null;
  }
  return Math.max(0, Math.min(255, rating * 51));
}

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

function ensureParentPlaylistIds(allPlaylists: PlaylistRow[], playlistIds: string[]): string[] {
  const playlistById = new Map(allPlaylists.map((playlist) => [playlist.id, playlist]));
  const selected = new Set<string>(playlistIds.length > 0 ? playlistIds : allPlaylists.map((playlist) => playlist.id));

  for (const playlistId of [...selected]) {
    let current = playlistById.get(playlistId)?.parent_id ?? null;
    while (current) {
      selected.add(current);
      current = playlistById.get(current)?.parent_id ?? null;
    }
  }

  return [...selected];
}

function sortPlaylists(playlists: PlaylistRow[]): PlaylistRow[] {
  return [...playlists].sort((a, b) => {
    const byParent = (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
    if (byParent !== 0) {
      return byParent;
    }
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) {
      return byName;
    }
    return a.id.localeCompare(b.id);
  });
}

async function atomicWrite(outputPath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, contents, 'utf8');
  await rename(tmpPath, outputPath);
}

function traktorLocationParts(canonicalPath: string): { volume: string; dir: string; file: string } {
  const resolved = path.resolve(canonicalPath);
  const segments = resolved.split(path.sep).filter(Boolean);
  const file = path.basename(resolved);
  const volume = segments[0] ?? '';
  const dirSegments = segments.slice(1, -1);
  const dir = `/:${dirSegments.join('/:')}${dirSegments.length > 0 ? '/:' : ''}`;
  return { volume, dir, file };
}

function ensureRekordboxTrackIds(database: DatabaseSync, tracks: TrackRow[]): void {
  const existingNumericIds = tracks
    .map((track) => Number.parseInt(track.rekordbox_track_id ?? '', 10))
    .filter((value) => Number.isFinite(value));
  let nextId = existingNumericIds.length > 0 ? Math.max(...existingNumericIds) + 1 : 1;
  const updateTrack = database.prepare(`
    UPDATE tracks
    SET rekordbox_track_id = ?, rekordbox_location_uri = COALESCE(rekordbox_location_uri, ?), updated_at = ?
    WHERE id = ?
  `);
  const now = new Date().toISOString();

  for (const track of tracks) {
    if (track.rekordbox_track_id) {
      continue;
    }
    const minted = String(nextId);
    nextId += 1;
    track.rekordbox_track_id = minted;
    track.rekordbox_location_uri = track.rekordbox_location_uri ?? toFileUri(track.canonical_path);
    updateTrack.run(minted, track.rekordbox_location_uri, now, track.id);
  }
}

function ensureTraktorIds(database: DatabaseSync, tracks: TrackRow[]): void {
  const updateTrack = database.prepare(`
    UPDATE tracks
    SET traktor_audio_id = COALESCE(?, traktor_audio_id),
        traktor_collection_path_key = COALESCE(?, traktor_collection_path_key),
        updated_at = ?
    WHERE id = ?
  `);
  const now = new Date().toISOString();

  for (const track of tracks) {
    const locationParts = traktorLocationParts(track.canonical_path);
    const collectionPathKey = track.traktor_collection_path_key ?? `${locationParts.dir}${locationParts.file}`;
    const audioId = track.traktor_audio_id ?? randomUUID();
    track.traktor_collection_path_key = collectionPathKey;
    track.traktor_audio_id = audioId;
    updateTrack.run(audioId, collectionPathKey, now, track.id);
  }
}

function renderRekordboxXml(
  tracks: TrackRow[],
  people: TrackPersonRow[],
  cuePoints: CuePointRow[],
  loopPoints: LoopPointRow[],
  beatGridMarkers: BeatGridMarkerRow[],
  playlists: PlaylistRow[],
  playlistItems: PlaylistItemRow[],
): string {
  const cuePointsByTrack = new Map<string, CuePointRow[]>();
  const loopPointsByTrack = new Map<string, LoopPointRow[]>();
  const tempoByTrack = new Map<string, BeatGridMarkerRow[]>();
  const playlistItemsByPlaylist = new Map<string, PlaylistItemRow[]>();
  const childPlaylistsByParent = new Map<string | null, PlaylistRow[]>();

  for (const cuePoint of cuePoints) {
    const bucket = cuePointsByTrack.get(cuePoint.track_id) ?? [];
    bucket.push(cuePoint);
    cuePointsByTrack.set(cuePoint.track_id, bucket);
  }
  for (const loopPoint of loopPoints) {
    const bucket = loopPointsByTrack.get(loopPoint.track_id) ?? [];
    bucket.push(loopPoint);
    loopPointsByTrack.set(loopPoint.track_id, bucket);
  }
  for (const marker of beatGridMarkers) {
    const bucket = tempoByTrack.get(marker.track_id) ?? [];
    bucket.push(marker);
    tempoByTrack.set(marker.track_id, bucket);
  }
  for (const item of playlistItems) {
    const bucket = playlistItemsByPlaylist.get(item.playlist_id) ?? [];
    bucket.push(item);
    playlistItemsByPlaylist.set(item.playlist_id, bucket);
  }
  for (const playlist of playlists) {
    const bucket = childPlaylistsByParent.get(playlist.parent_id) ?? [];
    bucket.push(playlist);
    childPlaylistsByParent.set(playlist.parent_id, bucket);
  }
  for (const bucket of childPlaylistsByParent.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  const trackLines = tracks.map((track) => {
    const artist = joinArtists(people, track.id);
    const markers = (tempoByTrack.get(track.id) ?? []).sort((a, b) => a.position - b.position);
    const cueXml = (cuePointsByTrack.get(track.id) ?? [])
      .sort((a, b) => a.start_sec - b.start_sec || (a.cue_index ?? -1) - (b.cue_index ?? -1))
      .map((cuePoint) => {
        const type =
          cuePoint.type === 'load' ? 3 :
          cuePoint.type === 'fadein' ? 1 :
          cuePoint.type === 'fadeout' ? 2 :
          0;
        const num = cuePoint.type === 'memory' ? -1 : (cuePoint.cue_index ?? 0);
        return `      <POSITION_MARK${formatAttr('Name', cuePoint.name)}${formatAttr('Type', type)}${formatAttr('Start', formatSeconds(cuePoint.start_sec))}${formatAttr('Num', num)}${formatAttr('Color', cuePoint.color)}${formatAttr('Comment', cuePoint.comment)}/>`;
      });
    const loopXml = (loopPointsByTrack.get(track.id) ?? [])
      .sort((a, b) => a.start_sec - b.start_sec || (a.loop_index ?? -1) - (b.loop_index ?? -1))
      .map((loopPoint) => `      <POSITION_MARK${formatAttr('Name', loopPoint.name)} Type="4"${formatAttr('Start', formatSeconds(loopPoint.start_sec))}${formatAttr('End', formatSeconds(loopPoint.end_sec))}${formatAttr('Num', loopPoint.loop_index ?? 0)}${formatAttr('Color', loopPoint.color)}/>`);
    const tempoXml = markers.map((marker) => `      <TEMPO${formatAttr('Inizio', formatSeconds(marker.start_sec))}${formatAttr('Bpm', marker.bpm.toFixed(2))}${formatAttr('Battito', marker.beat_number ?? 1)}/>`);

    return [
      `    <TRACK${formatAttr('TrackID', track.rekordbox_track_id)}${formatAttr('Name', track.title)}${formatAttr('Artist', artist)}${formatAttr('Album', track.album)}${formatAttr('Label', track.label)}${formatAttr('Mix', track.mix_name)}${formatAttr('Genre', track.genre)}${formatAttr('Year', track.year)}${formatAttr('DateAdded', track.added_at)}${formatAttr('TotalTime', Math.round(track.duration_sec))}${formatAttr('BitRate', track.bitrate_kbps)}${formatAttr('SampleRate', track.sample_rate_hz)}${formatAttr('Size', track.size_bytes)}${formatAttr('AverageBpm', track.bpm ?? track.bpm_float)}${formatAttr('Tonality', track.key_display)}${formatAttr('Comments', track.comment)}${formatAttr('Rating', track.rating)}${formatAttr('PlayCount', track.play_count)}${formatAttr('Location', track.rekordbox_location_uri ?? toFileUri(track.canonical_path))}>`,
      ...tempoXml,
      ...cueXml,
      ...loopXml,
      '    </TRACK>',
    ].join('\n');
  });

  function renderNode(parentId: string | null, depth: number): string[] {
    const indent = '  '.repeat(depth);
    return (childPlaylistsByParent.get(parentId) ?? []).flatMap((playlist) => {
      const children = renderNode(playlist.id, depth + 1);
      if (playlist.type === 'playlist') {
        const items = (playlistItemsByPlaylist.get(playlist.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((item) => {
            const track = tracks.find((row) => row.id === item.track_id);
            return `${indent}    <TRACK${formatAttr('Key', track?.rekordbox_track_id ?? '')}/>`;
          });
        return [
          `${indent}<NODE Type="1"${formatAttr('Name', playlist.name)}${formatAttr('Entries', items.length)}>`,
          ...items,
          `${indent}</NODE>`,
        ];
      }

      return [
        `${indent}<NODE Type="0"${formatAttr('Name', playlist.name)}${formatAttr('Count', children.length)}>`,
        ...children,
        `${indent}</NODE>`,
      ];
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<DJ_PLAYLISTS Version="1.0.0">',
    '  <PRODUCT Name="DJ Vault" Version="0.1.0" Company="GregBot"/>',
    `  <COLLECTION Entries="${tracks.length}">`,
    ...trackLines,
    '  </COLLECTION>',
    '  <PLAYLISTS>',
    '    <NODE Type="0" Name="ROOT">',
    ...renderNode(null, 3),
    '    </NODE>',
    '  </PLAYLISTS>',
    '</DJ_PLAYLISTS>',
    '',
  ].join('\n');
}

function renderTraktorNml(
  tracks: TrackRow[],
  people: TrackPersonRow[],
  cuePoints: CuePointRow[],
  loopPoints: LoopPointRow[],
  beatGridRows: BeatGridRow[],
  beatGridMarkers: BeatGridMarkerRow[],
  playlists: PlaylistRow[],
  playlistItems: PlaylistItemRow[],
): string {
  const cuePointsByTrack = new Map<string, CuePointRow[]>();
  const loopPointsByTrack = new Map<string, LoopPointRow[]>();
  const beatGridByTrack = new Map<string, BeatGridRow>();
  const beatGridMarkersByTrack = new Map<string, BeatGridMarkerRow[]>();
  const playlistItemsByPlaylist = new Map<string, PlaylistItemRow[]>();
  const childPlaylistsByParent = new Map<string | null, PlaylistRow[]>();

  for (const cuePoint of cuePoints) {
    const bucket = cuePointsByTrack.get(cuePoint.track_id) ?? [];
    bucket.push(cuePoint);
    cuePointsByTrack.set(cuePoint.track_id, bucket);
  }
  for (const loopPoint of loopPoints) {
    const bucket = loopPointsByTrack.get(loopPoint.track_id) ?? [];
    bucket.push(loopPoint);
    loopPointsByTrack.set(loopPoint.track_id, bucket);
  }
  for (const beatGrid of beatGridRows) {
    beatGridByTrack.set(beatGrid.track_id, beatGrid);
  }
  for (const marker of beatGridMarkers) {
    const bucket = beatGridMarkersByTrack.get(marker.track_id) ?? [];
    bucket.push(marker);
    beatGridMarkersByTrack.set(marker.track_id, bucket);
  }
  for (const item of playlistItems) {
    const bucket = playlistItemsByPlaylist.get(item.playlist_id) ?? [];
    bucket.push(item);
    playlistItemsByPlaylist.set(item.playlist_id, bucket);
  }
  for (const playlist of playlists) {
    const bucket = childPlaylistsByParent.get(playlist.parent_id) ?? [];
    bucket.push(playlist);
    childPlaylistsByParent.set(playlist.parent_id, bucket);
  }
  for (const bucket of childPlaylistsByParent.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  const trackLines = tracks.map((track) => {
    const artist = joinArtists(people, track.id);
    const location = traktorLocationParts(track.canonical_path);
    const cues = (cuePointsByTrack.get(track.id) ?? [])
      .sort((a, b) => a.start_sec - b.start_sec || (a.cue_index ?? -1) - (b.cue_index ?? -1))
      .map((cuePoint) => {
        const cueType =
          cuePoint.type === 'load' ? 'LOAD' :
          cuePoint.type === 'grid' ? 'GRID' :
          cuePoint.type === 'hotcue' ? 'HOTCUE' :
          'CUE';
        return `      <CUE_V2${formatAttr('NAME', cuePoint.name)}${formatAttr('TYPE', cueType)}${formatAttr('HOTCUE', cuePoint.cue_index)}${formatAttr('START', formatSeconds(cuePoint.start_sec))}${formatAttr('COLOR', cuePoint.color)}${formatAttr('COMMENT', cuePoint.comment)}/>`;
      });
    const loops = (loopPointsByTrack.get(track.id) ?? [])
      .sort((a, b) => a.start_sec - b.start_sec || (a.loop_index ?? -1) - (b.loop_index ?? -1))
      .map((loopPoint) => `      <CUE_V2${formatAttr('NAME', loopPoint.name)} TYPE="LOOP"${formatAttr('HOTCUE', loopPoint.loop_index)}${formatAttr('START', formatSeconds(loopPoint.start_sec))}${formatAttr('END', formatSeconds(loopPoint.end_sec))}${formatAttr('COLOR', loopPoint.color)}/>`);
    const beatGrid = beatGridByTrack.get(track.id);
    const tempos = (beatGridMarkersByTrack.get(track.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((marker) => `      <TEMPO${formatAttr('POSITION', formatSeconds(marker.start_sec))}${formatAttr('BPM', marker.bpm.toFixed(2))}${formatAttr('METER', marker.beat_number ?? beatGrid?.meter_numerator ?? 1)}/>`);

    return [
      `    <ENTRY${formatAttr('TITLE', track.title)}${formatAttr('ARTIST', artist)}${formatAttr('AUDIO_ID', track.traktor_audio_id)}>`,
      `      <ALBUM${formatAttr('TITLE', track.album)}${formatAttr('TRACK', track.track_number)}/>`,
      `      <INFO${formatAttr('GENRE', track.genre)}${formatAttr('COMMENT', track.comment)}${formatAttr('KEY', track.key_display)}${formatAttr('RANKING', toTraktorRanking(track.rating))}${formatAttr('PLAYTIME', Math.round(track.duration_sec))}${formatAttr('IMPORT_DATE', track.added_at)}${formatAttr('RELEASE_DATE', track.release_date ?? track.year)}/>`,
      `      <LOCATION${formatAttr('VOLUME', location.volume)}${formatAttr('DIR', location.dir)}${formatAttr('FILE', location.file)}/>`,
      ...tempos,
      ...cues,
      ...loops,
      '    </ENTRY>',
    ].join('\n');
  });

  function renderNode(parentId: string | null, depth: number): string[] {
    const indent = '  '.repeat(depth);
    return (childPlaylistsByParent.get(parentId) ?? []).flatMap((playlist) => {
      const children = renderNode(playlist.id, depth + 2);
      if (playlist.type === 'playlist') {
        const items = (playlistItemsByPlaylist.get(playlist.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((item) => {
            const track = tracks.find((row) => row.id === item.track_id);
            return [
              `${indent}    <ENTRY>`,
              `${indent}      <PRIMARYKEY TYPE="TRACK"${formatAttr('KEY', track?.traktor_audio_id ?? '')}/>`,
              `${indent}    </ENTRY>`,
            ].join('\n');
          });
        return [
          `${indent}<NODE${formatAttr('NAME', playlist.name)} TYPE="PLAYLIST">`,
          `${indent}  <PLAYLIST${formatAttr('ENTRIES', items.length)}>`,
          ...items,
          `${indent}  </PLAYLIST>`,
          `${indent}</NODE>`,
        ];
      }

      return [
        `${indent}<NODE${formatAttr('NAME', playlist.name)} TYPE="FOLDER">`,
        `${indent}  <SUBNODES>`,
        ...children,
        `${indent}  </SUBNODES>`,
        `${indent}</NODE>`,
      ];
    });
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<NML VERSION="19">',
    '  <HEAD COMPANY="DJ Vault" PROGRAM="DJ Vault" VERSION="0.1.0"/>',
    `  <COLLECTION ENTRIES="${tracks.length}">`,
    ...trackLines,
    '  </COLLECTION>',
    '  <PLAYLISTS>',
    '    <NODE NAME="ROOT" TYPE="FOLDER">',
    '      <SUBNODES>',
    ...renderNode(null, 4),
    '      </SUBNODES>',
    '    </NODE>',
    '  </PLAYLISTS>',
    '</NML>',
    '',
  ].join('\n');
}

function queryExportData(database: DatabaseSync, selectedPlaylistIds: string[]): {
  tracks: TrackRow[];
  people: TrackPersonRow[];
  cuePoints: CuePointRow[];
  loopPoints: LoopPointRow[];
  beatGrids: BeatGridRow[];
  beatGridMarkers: BeatGridMarkerRow[];
  playlists: PlaylistRow[];
  playlistItems: PlaylistItemRow[];
} {
  const allPlaylists = database.prepare(`
    SELECT id, name, type, parent_id
    FROM playlists
    ORDER BY name COLLATE NOCASE, id
  `).all() as PlaylistRow[];

  const playlistIds = ensureParentPlaylistIds(allPlaylists, selectedPlaylistIds);
  const selectedPlaylists = sortPlaylists(allPlaylists.filter((playlist) => playlistIds.includes(playlist.id)));

  const playlistItems = database.prepare(`
    SELECT playlist_id, position, track_id
    FROM playlist_items
    ORDER BY playlist_id, position
  `).all() as PlaylistItemRow[];
  const includedTrackIds = [...new Set(
    playlistItems
      .filter((item) => selectedPlaylists.some((playlist) => playlist.id === item.playlist_id))
      .map((item) => item.track_id),
  )];

  const trackParams = includedTrackIds.length > 0 ? includedTrackIds.map(() => '?').join(',') : "''";
  const tracks = database.prepare(`
    SELECT id, canonical_path, file_name, extension, duration_sec, sample_rate_hz, bitrate_kbps, size_bytes,
      added_at, title, mix_name, album, label, year, release_date, track_number, source, source_url,
      bpm, bpm_float, key_display, rating, genre, comment, play_count,
      rekordbox_track_id, rekordbox_location_uri, traktor_collection_path_key, traktor_audio_id
    FROM tracks
    WHERE id IN (${trackParams})
    ORDER BY id
  `).all(...includedTrackIds) as TrackRow[];

  const people = includedTrackIds.length > 0
    ? database.prepare(`
      SELECT track_id, role, name
      FROM track_people
      WHERE track_id IN (${trackParams})
      ORDER BY track_id, role, position
    `).all(...includedTrackIds) as TrackPersonRow[]
    : [];

  const cuePoints = includedTrackIds.length > 0
    ? database.prepare(`
      SELECT track_id, name, type, cue_index, start_sec, color, comment
      FROM cue_points
      WHERE track_id IN (${trackParams})
      ORDER BY track_id, start_sec, cue_index
    `).all(...includedTrackIds) as CuePointRow[]
    : [];

  const loopPoints = includedTrackIds.length > 0
    ? database.prepare(`
      SELECT track_id, name, start_sec, end_sec, loop_index, color
      FROM loop_points
      WHERE track_id IN (${trackParams})
      ORDER BY track_id, start_sec, loop_index
    `).all(...includedTrackIds) as LoopPointRow[]
    : [];

  const beatGrids = includedTrackIds.length > 0
    ? database.prepare(`
      SELECT track_id, anchor_sec, bpm, meter_numerator, meter_denominator, locked
      FROM beat_grids
      WHERE track_id IN (${trackParams})
      ORDER BY track_id
    `).all(...includedTrackIds) as BeatGridRow[]
    : [];

  const beatGridMarkers = includedTrackIds.length > 0
    ? database.prepare(`
      SELECT track_id, position, start_sec, bpm, beat_number
      FROM beat_grid_markers
      WHERE track_id IN (${trackParams})
      ORDER BY track_id, position
    `).all(...includedTrackIds) as BeatGridMarkerRow[]
    : [];

  const selectedPlaylistItems = playlistItems.filter((item) => selectedPlaylists.some((playlist) => playlist.id === item.playlist_id));

  return {
    tracks,
    people,
    cuePoints,
    loopPoints,
    beatGrids,
    beatGridMarkers,
    playlists: selectedPlaylists,
    playlistItems: selectedPlaylistItems,
  };
}

async function completeExport(
  databasePath: string,
  outputPath: string,
  targetKind: ExportTarget,
  playlistIds: string[],
): Promise<ExportCatalogResult> {
  const database = new DatabaseSync(databasePath);
  const exportJobId = randomUUID();

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    database.prepare(`
      INSERT INTO export_jobs (id, target_kind, target_path, status, started_at, completed_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(exportJobId, targetKind, outputPath, 'running', new Date().toISOString(), null, JSON.stringify({ playlistIds }));

    const data = queryExportData(database, playlistIds);

    if (targetKind === 'rekordbox-xml') {
      ensureRekordboxTrackIds(database, data.tracks);
    } else {
      ensureTraktorIds(database, data.tracks);
    }

    const contents = targetKind === 'rekordbox-xml'
      ? renderRekordboxXml(data.tracks, data.people, data.cuePoints, data.loopPoints, data.beatGridMarkers, data.playlists, data.playlistItems)
      : renderTraktorNml(data.tracks, data.people, data.cuePoints, data.loopPoints, data.beatGrids, data.beatGridMarkers, data.playlists, data.playlistItems);

    await atomicWrite(outputPath, contents);

    database.prepare(`
      UPDATE export_jobs
      SET status = ?, completed_at = ?, note = ?
      WHERE id = ?
    `).run(
      'completed',
      new Date().toISOString(),
      JSON.stringify({
        playlistCount: data.playlists.length,
        trackCount: data.tracks.length,
        playlistIds,
      }),
      exportJobId,
    );

    database.exec('COMMIT');

    return {
      exportJobId,
      targetKind,
      outputPath,
      playlistCount: data.playlists.length,
      trackCount: data.tracks.length,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export async function exportRekordboxXml(databasePath: string, outputPath: string, playlistIds: string[] = []): Promise<ExportCatalogResult> {
  return completeExport(databasePath, outputPath, 'rekordbox-xml', playlistIds);
}

export async function exportTraktorNml(databasePath: string, outputPath: string, playlistIds: string[] = []): Promise<ExportCatalogResult> {
  return completeExport(databasePath, outputPath, 'traktor-nml', playlistIds);
}
