import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type ManifestTrack = {
  id: string;
  rekordboxTrackId: string;
  title: string;
  artist: string | null;
  stagedRelativePath: string;
};

type CatalogTrackRow = {
  id: string;
  title: string;
  file_name: string;
  extension: string;
  size_bytes: number;
  duration_sec: number;
  sample_rate_hz: number | null;
  bitrate_kbps: number | null;
  added_at: string;
  album: string | null;
  label: string | null;
  year: number | null;
  release_date: string | null;
  track_number: number | null;
  bpm: number | null;
  bpm_float: number | null;
  key_display: string | null;
  rating: number | null;
  play_count: number;
  comment: string | null;
  hash_sha256: string;
};

type TrackPersonRow = {
  track_id: string;
  role: string;
  name: string;
};

type ManifestRoot = {
  exportRoot: string;
  tracks: ManifestTrack[];
};

export type RekordboxPdbRowPlan = {
  exportRoot: string;
  manifestPath: string;
  outputPath: string;
  createdAt: string;
  coveredTables: string[];
  deferredTables: string[];
  artists: Array<{ id: number; name: string }>;
  labels: Array<{ id: number; name: string }>;
  keys: Array<{ id: number; name: string }>;
  tracks: Array<{
    id: number;
    title: string;
    artistId: number;
    artistName: string | null;
    labelId: number;
    labelName: string | null;
    keyId: number;
    keyName: string | null;
    fileName: string;
    filePath: string;
    analyzePath: string;
    dateAdded: string;
    tempoCentiBpm: number;
    durationSec: number;
    bitrateKbps: number;
    sampleRateHz: number;
    fileSize: number;
    fileType: string;
    rating: number;
    playCount: number;
    year: number;
    trackNumber: number;
    comment: string | null;
  }>;
  warnings: string[];
};

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

function inferFileType(extension: string): string {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return normalized === 'mp3' ? 'Mp3'
    : normalized === 'aiff' || normalized === 'aif' ? 'Aiff'
    : normalized === 'wav' ? 'Wav'
    : normalized === 'flac' ? 'Flac'
    : normalized.toUpperCase();
}

function inferAnalyzePath(trackId: string, hashSha256: string): string {
  const digest = createHash('sha1').update(`${trackId}:${hashSha256}`).digest('hex').toUpperCase();
  const bucket = `P${digest.slice(0, 3)}`;
  const folder = digest.slice(3, 11);
  return `/PIONEER/USBANLZ/${bucket}/${folder}/ANLZ0000.DAT`;
}

function mapRating(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(value)));
}

function mapTempoCentiBpm(bpm: number | null | undefined, bpmFloat: number | null | undefined): number {
  const value = bpm ?? bpmFloat ?? 0;
  return Math.max(0, Math.round(value * 100));
}

function mapDateAdded(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '1970-01-01';
  }
  return date.toISOString().slice(0, 10);
}

async function atomicWrite(outputPath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, contents, 'utf8');
  await rename(tmpPath, outputPath);
}

export async function prepareRekordboxPdbRowPlan(databasePath: string, exportRoot: string): Promise<RekordboxPdbRowPlan> {
  const absoluteExportRoot = path.resolve(exportRoot);
  const manifestPath = path.join(absoluteExportRoot, 'PIONEER', 'rekordbox', 'dj-vault', 'device-export-manifest.json');
  const outputPath = path.join(absoluteExportRoot, 'PIONEER', 'rekordbox', 'dj-vault', 'pdb-row-plan.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestRoot;
  const database = new DatabaseSync(databasePath);

  try {
    const trackIds = manifest.tracks.map((track) => track.id);
    const placeholders = trackIds.length > 0 ? trackIds.map(() => '?').join(',') : "''";
    const tracks = database.prepare(`
      SELECT id, title, file_name, extension, size_bytes, duration_sec, sample_rate_hz, bitrate_kbps, added_at,
             album, label, year, release_date, track_number, bpm, bpm_float, key_display, rating, play_count, comment, hash_sha256
      FROM tracks
      WHERE id IN (${placeholders})
      ORDER BY id
    `).all(...trackIds) as CatalogTrackRow[];
    const people = trackIds.length > 0
      ? database.prepare(`
        SELECT track_id, role, name
        FROM track_people
        WHERE track_id IN (${placeholders})
        ORDER BY track_id, role, position
      `).all(...trackIds) as TrackPersonRow[]
      : [];

    const manifestTrackById = new Map(manifest.tracks.map((track) => [track.id, track]));
    const uniqueArtists = [...new Set(
      tracks
        .map((track) => normalizeText(joinArtists(people, track.id) ?? manifestTrackById.get(track.id)?.artist ?? null))
        .filter((value): value is string => Boolean(value)),
    )].sort((a, b) => a.localeCompare(b));
    const uniqueLabels = [...new Set(
      tracks
        .map((track) => normalizeText(track.label))
        .filter((value): value is string => Boolean(value)),
    )].sort((a, b) => a.localeCompare(b));
    const uniqueKeys = [...new Set(
      tracks
        .map((track) => normalizeText(track.key_display))
        .filter((value): value is string => Boolean(value)),
    )].sort((a, b) => a.localeCompare(b));

    const artists = uniqueArtists.map((name, index) => ({ id: index + 1, name }));
    const labels = uniqueLabels.map((name, index) => ({ id: index + 1, name }));
    const keys = uniqueKeys.map((name, index) => ({ id: index + 1, name }));

    const artistIdByName = new Map(artists.map((artist) => [artist.name, artist.id]));
    const labelIdByName = new Map(labels.map((label) => [label.name, label.id]));
    const keyIdByName = new Map(keys.map((key) => [key.name, key.id]));
    const warnings: string[] = [];

    const trackRows = tracks.map((track) => {
      const manifestTrack = manifestTrackById.get(track.id);
      const artistName = normalizeText(joinArtists(people, track.id) ?? manifestTrack?.artist ?? null);
      const labelName = normalizeText(track.label);
      const keyName = normalizeText(track.key_display);
      const stagedRelativePath = manifestTrack?.stagedRelativePath ?? `Contents/${track.file_name}`;
      const filePath = `/${stagedRelativePath}`;
      const durationSec = Math.max(0, Math.round(track.duration_sec ?? 0));
      if (durationSec === 0) {
        warnings.push(`Track "${track.title}" has zero duration in the catalog and needs analysis backfill before native export.`);
      }
      if (!artistName) {
        warnings.push(`Track "${track.title}" is missing artist metadata; ArtistId will remain 0.`);
      }

      return {
        id: Number.parseInt(manifestTrack?.rekordboxTrackId ?? '0', 10) || 0,
        title: track.title,
        artistId: artistName ? (artistIdByName.get(artistName) ?? 0) : 0,
        artistName,
        labelId: labelName ? (labelIdByName.get(labelName) ?? 0) : 0,
        labelName,
        keyId: keyName ? (keyIdByName.get(keyName) ?? 0) : 0,
        keyName,
        fileName: track.file_name,
        filePath,
        analyzePath: inferAnalyzePath(track.id, track.hash_sha256),
        dateAdded: mapDateAdded(track.added_at),
        tempoCentiBpm: mapTempoCentiBpm(track.bpm, track.bpm_float),
        durationSec,
        bitrateKbps: track.bitrate_kbps ?? 0,
        sampleRateHz: track.sample_rate_hz ?? 0,
        fileSize: track.size_bytes,
        fileType: inferFileType(track.extension),
        rating: mapRating(track.rating),
        playCount: Math.max(0, track.play_count ?? 0),
        year: Math.max(0, track.year ?? 0),
        trackNumber: Math.max(0, track.track_number ?? 0),
        comment: normalizeText(track.comment),
      };
    }).sort((a, b) => a.id - b.id || a.title.localeCompare(b.title));

    const plan: RekordboxPdbRowPlan = {
      exportRoot: absoluteExportRoot,
      manifestPath,
      outputPath,
      createdAt: new Date().toISOString(),
      coveredTables: ['tracks', 'artists', 'labels', 'keys'],
      deferredTables: ['albums', 'playlist_tree', 'playlist_entries', 'columns', 'history', 'exportExt.pdb', 'ANLZ analysis files'],
      artists,
      labels,
      keys,
      tracks: trackRows,
      warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b)),
    };

    await atomicWrite(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
    return plan;
  } finally {
    database.close();
  }
}
