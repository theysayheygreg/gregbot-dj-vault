import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type TrackRow = {
  id: string;
  canonical_path: string;
  file_name: string;
  extension: string;
  hash_sha256: string;
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
  bpm: number | null;
  bpm_float: number | null;
  key_display: string | null;
  rating: number | null;
  genre: string | null;
  comment: string | null;
  play_count: number;
  rekordbox_track_id: string | null;
  rekordbox_location_uri: string | null;
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

type DeviceExportTrackManifest = {
  id: string;
  rekordboxTrackId: string;
  title: string;
  artist: string | null;
  canonicalPath: string;
  stagedRelativePath: string;
  stagedFileUri: string;
  sha256: string;
  playlistIds: string[];
};

type DeviceExportPlaylistManifest = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  m3uRelativePath: string | null;
  entryCount: number;
  entries: Array<{
    position: number;
    trackId: string;
    rekordboxTrackId: string;
    stagedRelativePath: string;
  }>;
};

export type RekordboxDeviceExportResult = {
  exportJobId: string;
  targetKind: 'rekordbox-device';
  outputRoot: string;
  collectionXmlPath: string;
  manifestPath: string;
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

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

function toFileUri(filePath: string): string {
  const normalized = path.resolve(filePath).split(path.sep).join('/');
  return `file://localhost${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`;
}

function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  const chosen = cleaned.length > 0 ? cleaned : fallback;
  return chosen.slice(0, 64);
}

function slugifyFileName(value: string, fallback: string): string {
  const cleaned = sanitizePathSegment(value, fallback)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

function joinArtists(people: TrackPersonRow[], trackId: string): string | null {
  const artists = people
    .filter((person) => person.track_id === trackId && person.role === 'artist')
    .map((person) => person.name);
  return artists.length > 0 ? artists.join(' / ') : null;
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

function queryExportData(database: DatabaseSync, selectedPlaylistIds: string[]): {
  tracks: TrackRow[];
  people: TrackPersonRow[];
  cuePoints: CuePointRow[];
  loopPoints: LoopPointRow[];
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
    SELECT id, canonical_path, file_name, extension, hash_sha256, duration_sec, sample_rate_hz, bitrate_kbps, size_bytes,
      added_at, title, mix_name, album, label, year, release_date, track_number,
      bpm, bpm_float, key_display, rating, genre, comment, play_count,
      rekordbox_track_id, rekordbox_location_uri
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
    beatGridMarkers,
    playlists: selectedPlaylists,
    playlistItems: selectedPlaylistItems,
  };
}

function renderRekordboxXml(
  tracks: TrackRow[],
  people: TrackPersonRow[],
  cuePoints: CuePointRow[],
  loopPoints: LoopPointRow[],
  beatGridMarkers: BeatGridMarkerRow[],
  playlists: PlaylistRow[],
  playlistItems: PlaylistItemRow[],
  locationOverrides: Map<string, string>,
): string {
  const cuePointsByTrack = new Map<string, CuePointRow[]>();
  const loopPointsByTrack = new Map<string, LoopPointRow[]>();
  const tempoByTrack = new Map<string, BeatGridMarkerRow[]>();
  const playlistItemsByPlaylist = new Map<string, PlaylistItemRow[]>();
  const childPlaylistsByParent = new Map<string | null, PlaylistRow[]>();
  const trackById = new Map(tracks.map((track) => [track.id, track]));

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
    const location = locationOverrides.get(track.id) ?? track.rekordbox_location_uri ?? toFileUri(track.canonical_path);

    return [
      `    <TRACK${formatAttr('TrackID', track.rekordbox_track_id)}${formatAttr('Name', track.title)}${formatAttr('Artist', artist)}${formatAttr('Album', track.album)}${formatAttr('Label', track.label)}${formatAttr('Mix', track.mix_name)}${formatAttr('Genre', track.genre)}${formatAttr('Year', track.year)}${formatAttr('DateAdded', track.added_at)}${formatAttr('TotalTime', Math.round(track.duration_sec))}${formatAttr('BitRate', track.bitrate_kbps)}${formatAttr('SampleRate', track.sample_rate_hz)}${formatAttr('Size', track.size_bytes)}${formatAttr('AverageBpm', track.bpm ?? track.bpm_float)}${formatAttr('Tonality', track.key_display)}${formatAttr('Comments', track.comment)}${formatAttr('Rating', track.rating)}${formatAttr('PlayCount', track.play_count)}${formatAttr('Location', location)}>`,
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
            const track = trackById.get(item.track_id);
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
    '  <PRODUCT Name="DJ Vault Device Export" Version="0.1.0" Company="GregBot"/>',
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

function buildDeviceRelativePath(track: TrackRow, artist: string | null, usedPaths: Set<string>): string {
  const artistSegment = sanitizePathSegment(artist, 'Unknown Artist');
  const albumSegment = sanitizePathSegment(track.album, 'Unknown Album');
  const baseTitle = sanitizePathSegment(track.title || path.parse(track.file_name).name, 'Untitled');
  const ext = track.extension.startsWith('.') ? track.extension.slice(1) : track.extension;
  const prefix = track.track_number ? `${String(track.track_number).padStart(2, '0')} - ` : '';
  const bareName = `${prefix}${baseTitle}`.trim();

  let relativePath = path.posix.join('Contents', artistSegment, albumSegment, `${bareName}.${ext}`);
  let suffix = 1;
  while (usedPaths.has(relativePath.toLowerCase())) {
    relativePath = path.posix.join(
      'Contents',
      artistSegment,
      albumSegment,
      `${bareName}-${track.rekordbox_track_id ?? track.id.slice(0, 8)}-${suffix}.${ext}`,
    );
    suffix += 1;
  }
  usedPaths.add(relativePath.toLowerCase());
  return relativePath;
}

function buildPlaylistM3u(entries: DeviceExportPlaylistManifest['entries'], playlistDir: string, outputRoot: string): string {
  const lines = ['#EXTM3U'];
  for (const entry of entries) {
    const absoluteTrackPath = path.join(outputRoot, entry.stagedRelativePath);
    lines.push(path.relative(playlistDir, absoluteTrackPath).split(path.sep).join('/'));
  }
  lines.push('');
  return lines.join('\n');
}

export async function exportRekordboxDevice(
  databasePath: string,
  outputRoot: string,
  playlistIds: string[] = [],
): Promise<RekordboxDeviceExportResult> {
  const database = new DatabaseSync(databasePath);
  const exportJobId = randomUUID();
  const absoluteOutputRoot = path.resolve(outputRoot);
  const metadataRoot = path.join(absoluteOutputRoot, 'PIONEER', 'rekordbox', 'dj-vault');
  const playlistRoot = path.join(metadataRoot, 'playlists');
  const collectionXmlPath = path.join(metadataRoot, 'DJ_VAULT_COLLECTION.xml');
  const manifestPath = path.join(metadataRoot, 'device-export-manifest.json');

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    database.prepare(`
      INSERT INTO export_jobs (id, target_kind, target_path, status, started_at, completed_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(exportJobId, 'rekordbox-device', absoluteOutputRoot, 'running', new Date().toISOString(), null, JSON.stringify({ playlistIds }));

    const data = queryExportData(database, playlistIds);
    ensureRekordboxTrackIds(database, data.tracks);

    const trackArtists = new Map(data.tracks.map((track) => [track.id, joinArtists(data.people, track.id)]));
    const usedRelativePaths = new Set<string>();
    const locationOverrides = new Map<string, string>();
    const playlistIdsByTrack = new Map<string, string[]>();

    for (const item of data.playlistItems) {
      const bucket = playlistIdsByTrack.get(item.track_id) ?? [];
      bucket.push(item.playlist_id);
      playlistIdsByTrack.set(item.track_id, [...new Set(bucket)]);
    }

    const trackManifests: DeviceExportTrackManifest[] = [];
    const stagedPathByTrackId = new Map<string, string>();

    for (const track of data.tracks) {
      const relativePath = buildDeviceRelativePath(track, trackArtists.get(track.id) ?? null, usedRelativePaths);
      const absoluteTrackPath = path.join(absoluteOutputRoot, relativePath);
      await mkdir(path.dirname(absoluteTrackPath), { recursive: true });
      await copyFile(track.canonical_path, absoluteTrackPath);
      const fileUri = toFileUri(absoluteTrackPath);
      locationOverrides.set(track.id, fileUri);
      stagedPathByTrackId.set(track.id, relativePath);
      trackManifests.push({
        id: track.id,
        rekordboxTrackId: track.rekordbox_track_id ?? '',
        title: track.title,
        artist: trackArtists.get(track.id) ?? null,
        canonicalPath: track.canonical_path,
        stagedRelativePath: relativePath,
        stagedFileUri: fileUri,
        sha256: track.hash_sha256,
        playlistIds: playlistIdsByTrack.get(track.id) ?? [],
      });
    }

    await mkdir(playlistRoot, { recursive: true });
    const collectionXml = renderRekordboxXml(
      data.tracks,
      data.people,
      data.cuePoints,
      data.loopPoints,
      data.beatGridMarkers,
      data.playlists,
      data.playlistItems,
      locationOverrides,
    );
    await atomicWrite(collectionXmlPath, collectionXml);

    const playlistManifests: DeviceExportPlaylistManifest[] = [];
    for (const playlist of data.playlists) {
      const entries = data.playlistItems
        .filter((item) => item.playlist_id === playlist.id)
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const track = data.tracks.find((row) => row.id === item.track_id);
          return {
            position: item.position,
            trackId: item.track_id,
            rekordboxTrackId: track?.rekordbox_track_id ?? '',
            stagedRelativePath: stagedPathByTrackId.get(item.track_id) ?? '',
          };
        })
        .filter((entry) => entry.stagedRelativePath.length > 0);

      let m3uRelativePath: string | null = null;
      if (playlist.type === 'playlist') {
        const fileName = `${slugifyFileName(playlist.name, playlist.id.slice(0, 8))}-${playlist.id.slice(0, 8)}.m3u8`;
        const m3uPath = path.join(playlistRoot, fileName);
        const playlistContents = buildPlaylistM3u(entries, playlistRoot, absoluteOutputRoot);
        await atomicWrite(m3uPath, playlistContents);
        m3uRelativePath = path.relative(absoluteOutputRoot, m3uPath).split(path.sep).join('/');
      }

      playlistManifests.push({
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
        parentId: playlist.parent_id,
        m3uRelativePath,
        entryCount: entries.length,
        entries,
      });
    }

    const manifest = {
      version: 1,
      exportJobId,
      targetKind: 'rekordbox-device',
      exportRoot: absoluteOutputRoot,
      createdAt: new Date().toISOString(),
      playlistCount: data.playlists.length,
      trackCount: data.tracks.length,
      collectionXmlPath: path.relative(absoluteOutputRoot, collectionXmlPath).split(path.sep).join('/'),
      mediaRoot: 'Contents',
      pendingNativeArtifacts: ['export.pdb', 'ANLZ analysis files'],
      playlists: playlistManifests,
      tracks: trackManifests,
    };

    await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

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
        collectionXmlPath,
        manifestPath,
        pendingNativeArtifacts: manifest.pendingNativeArtifacts,
        playlistIds,
      }),
      exportJobId,
    );

    database.exec('COMMIT');

    return {
      exportJobId,
      targetKind: 'rekordbox-device',
      outputRoot: absoluteOutputRoot,
      collectionXmlPath,
      manifestPath,
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
