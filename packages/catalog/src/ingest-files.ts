import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const audioExtensions = new Set(['.mp3', '.wav', '.aiff', '.aif', '.flac', '.m4a', '.aac', '.alac', '.ogg']);
const execFileAsync = promisify(execFile);

type ExtractedAudioMetadata = {
  durationSec: number;
  sampleRateHz: number | null;
  bitrateKbps: number | null;
  title: string | null;
  artists: string[];
  album: string | null;
  year: number | null;
};

export type IngestFilesOptions = {
  libraryRoot?: string | null;
};

export type IngestFilesResult = {
  importJobId: string;
  visitedPathCount: number;
  candidateFileCount: number;
  insertedTrackCount: number;
  skippedExistingCount: number;
  databasePath: string;
  libraryRoot: string | null;
};

async function collectFiles(inputPath: string): Promise<string[]> {
  const stat = await lstat(inputPath);

  if (stat.isFile()) {
    return [await realpath(inputPath)];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const files: string[] = [];
  const entries = await readdir(inputPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
      continue;
    }
    if (entry.isFile()) {
      files.push(await realpath(absolute));
    }
  }

  return files;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return hash.digest('hex');
}

function normalizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArtists(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseArtists(entry));
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(/[;,/]| feat\. | ft\. | & /i)
    .map((entry) => normalizeText(entry))
    .filter(Boolean) as string[];
}

function deriveTitleAndArtists(fileName: string, metadata: ExtractedAudioMetadata): { title: string; artists: string[] } {
  const embeddedArtists = [...new Set(metadata.artists.map((artist) => normalizeText(artist)).filter(Boolean) as string[])];
  const embeddedTitle = normalizeText(metadata.title);
  if (embeddedTitle) {
    return {
      title: embeddedTitle,
      artists: embeddedArtists,
    };
  }

  const fallback = titleFromFileName(fileName);
  const parsed = fallback.match(/^\s*(.+?)\s+-\s+(.+)\s*$/);
  if (!parsed) {
    return {
      title: fallback,
      artists: embeddedArtists,
    };
  }

  return {
    title: normalizeText(parsed[2]) ?? fallback,
    artists: embeddedArtists.length > 0 ? embeddedArtists : parseArtists(parsed[1]),
  };
}

function recordObservedMetadata(
  insertProvenance: ReturnType<DatabaseSync['prepare']>,
  trackId: string,
  filePath: string,
  fileName: string,
  observedAt: string,
  metadata: ExtractedAudioMetadata,
  normalized: { title: string; artists: string[] },
  libraryRoot: string | null,
  canonicalPath: string,
): void {
  insertProvenance.run(
    'track',
    trackId,
    'file.canonicalPath',
    libraryRoot ? 'managed-library' : 'filesystem',
    libraryRoot ? 'managed-copy' : 'filesystem-scan',
    canonicalPath,
    1.0,
    observedAt,
    JSON.stringify(canonicalPath),
  );
  insertProvenance.run(
    'track',
    trackId,
    'file.sourcePath',
    'filesystem',
    'filesystem-scan',
    filePath,
    1.0,
    observedAt,
    JSON.stringify(filePath),
  );
  insertProvenance.run(
    'track',
    trackId,
    'identity.title',
    metadata.title ? 'embedded-tags' : 'derived',
    metadata.title ? 'ffprobe/mdls' : 'file-name',
    fileName,
    metadata.title ? 0.8 : 0.5,
    observedAt,
    JSON.stringify(normalized.title),
  );
  if (metadata.sampleRateHz !== null) {
    insertProvenance.run('track', trackId, 'file.sampleRateHz', 'embedded-tags', 'ffprobe/mdls', filePath, 0.9, observedAt, JSON.stringify(metadata.sampleRateHz));
  }
  if (metadata.bitrateKbps !== null) {
    insertProvenance.run('track', trackId, 'file.bitrateKbps', 'embedded-tags', 'ffprobe/mdls', filePath, 0.9, observedAt, JSON.stringify(metadata.bitrateKbps));
  }
  if (metadata.durationSec > 0) {
    insertProvenance.run('track', trackId, 'file.durationSec', 'embedded-tags', 'ffprobe/mdls', filePath, 0.9, observedAt, JSON.stringify(metadata.durationSec));
  }
  const normalizedAlbum = normalizeText(metadata.album);
  if (normalizedAlbum) {
    insertProvenance.run(
      'track',
      trackId,
      'identity.album',
      metadata.album ? 'embedded-tags' : 'normalized',
      metadata.album ? 'ffprobe/mdls' : 'normalization',
      filePath,
      metadata.album ? 0.8 : 0.35,
      observedAt,
      JSON.stringify(normalizedAlbum),
    );
  }
  if (metadata.year !== null) {
    insertProvenance.run('track', trackId, 'identity.year', 'embedded-tags', 'ffprobe/mdls', filePath, 0.8, observedAt, JSON.stringify(metadata.year));
  }
  for (const [index, artist] of normalized.artists.entries()) {
    insertProvenance.run(
      'track',
      trackId,
      `identity.artist.${index}`,
      metadata.artists.length > 0 ? 'embedded-tags' : 'derived',
      metadata.artists.length > 0 ? 'ffprobe/mdls' : 'file-name',
      filePath,
      metadata.artists.length > 0 ? 0.8 : 0.45,
      observedAt,
      JSON.stringify(artist),
    );
  }
}

async function extractWithFfprobe(filePath: string): Promise<ExtractedAudioMetadata | null> {
  try {
    const { stdout } = await execFileAsync('/opt/homebrew/bin/ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; bit_rate?: string; tags?: Record<string, string | undefined> };
      streams?: Array<{ codec_type?: string; sample_rate?: string; bit_rate?: string }>;
    };
    const audioStream = parsed.streams?.find((stream) => stream.codec_type === 'audio');
    const tags = parsed.format?.tags ?? {};
    const yearText = tags.date ?? tags.year ?? null;
    const parsedYear = yearText ? Number.parseInt(yearText.slice(0, 4), 10) : NaN;

    return {
      durationSec: toNullableNumber(parsed.format?.duration) ?? 0,
      sampleRateHz: toNullableNumber(audioStream?.sample_rate),
      bitrateKbps:
        Math.round((toNullableNumber(parsed.format?.bit_rate) ?? toNullableNumber(audioStream?.bit_rate) ?? 0) / 1000) || null,
      title: normalizeText(tags.title ?? null),
      artists: parseArtists(tags.artist),
      album: normalizeText(tags.album ?? null),
      year: Number.isFinite(parsedYear) ? parsedYear : null,
    };
  } catch {
    return null;
  }
}

async function extractWithMdls(filePath: string): Promise<ExtractedAudioMetadata | null> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/mdls', [
      '-name',
      'kMDItemTitle',
      '-name',
      'kMDItemAudioSampleRate',
      '-name',
      'kMDItemDurationSeconds',
      '-name',
      'kMDItemAuthors',
      '-name',
      'kMDItemAlbum',
      '-name',
      'kMDItemAudioBitRate',
      filePath,
    ]);

    const getValue = (name: string): string | null => {
      const match = stdout.match(new RegExp(`${name}\\s+=\\s+(.+)`));
      return match ? match[1].trim() : null;
    };

    const title = getValue('kMDItemTitle');
    const album = getValue('kMDItemAlbum');
    const authors = getValue('kMDItemAuthors');

    return {
      durationSec: toNullableNumber(getValue('kMDItemDurationSeconds')) ?? 0,
      sampleRateHz: toNullableNumber(getValue('kMDItemAudioSampleRate')),
      bitrateKbps: Math.round((toNullableNumber(getValue('kMDItemAudioBitRate')) ?? 0) / 1000) || null,
      title: title && title !== '(null)' ? normalizeText(title.replace(/^"|"$/g, '')) : null,
      artists: authors && authors !== '(null)' ? parseArtists(authors.replace(/[()"]/g, '')) : [],
      album: album && album !== '(null)' ? normalizeText(album.replace(/^"|"$/g, '')) : null,
      year: null,
    };
  } catch {
    return null;
  }
}

async function extractAudioMetadata(filePath: string): Promise<ExtractedAudioMetadata> {
  const ffprobeMetadata = await extractWithFfprobe(filePath);
  const mdlsMetadata = await extractWithMdls(filePath);

  return {
    durationSec: ffprobeMetadata?.durationSec ?? mdlsMetadata?.durationSec ?? 0,
    sampleRateHz: ffprobeMetadata?.sampleRateHz ?? mdlsMetadata?.sampleRateHz ?? null,
    bitrateKbps: ffprobeMetadata?.bitrateKbps ?? mdlsMetadata?.bitrateKbps ?? null,
    title: ffprobeMetadata?.title ?? mdlsMetadata?.title ?? null,
    artists: ffprobeMetadata?.artists?.length ? ffprobeMetadata.artists : (mdlsMetadata?.artists ?? []),
    album: ffprobeMetadata?.album ?? mdlsMetadata?.album ?? null,
    year: ffprobeMetadata?.year ?? mdlsMetadata?.year ?? null,
  };
}

async function ensureManagedLibraryCopy(sourcePath: string, fileHash: string, extension: string, libraryRoot: string): Promise<string> {
  const shardA = fileHash.slice(0, 2);
  const shardB = fileHash.slice(2, 4);
  const destinationDir = path.join(libraryRoot, shardA, shardB);
  const destinationPath = path.join(destinationDir, `${fileHash}.${extension}`);

  await mkdir(destinationDir, { recursive: true });
  try {
    await lstat(destinationPath);
  } catch {
    await copyFile(sourcePath, destinationPath);
  }

  return destinationPath;
}

export async function ingestFilesIntoCatalog(
  databasePath: string,
  inputPaths: string[],
  options: IngestFilesOptions = {},
): Promise<IngestFilesResult> {
  const resolvedInputPaths = await Promise.all(inputPaths.map((inputPath) => realpath(path.resolve(inputPath))));
  const libraryRoot = options.libraryRoot ? path.resolve(options.libraryRoot) : null;
  const visitedFiles = (await Promise.all(resolvedInputPaths.map((inputPath) => collectFiles(inputPath)))).flat();
  const uniqueVisitedFiles = [...new Set(visitedFiles)];
  const candidateFiles = uniqueVisitedFiles.filter((filePath) => audioExtensions.has(path.extname(filePath).toLowerCase()));
  const importJobId = randomUUID();
  const startedAt = new Date().toISOString();

  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const insertImportJob = database.prepare(`
      INSERT INTO import_jobs (id, source_kind, source_path, status, started_at, completed_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const setMetadata = database.prepare(`
      INSERT INTO app_metadata (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    insertImportJob.run(
      importJobId,
      'filesystem-scan',
      JSON.stringify(resolvedInputPaths),
      'running',
      startedAt,
      null,
      libraryRoot ? `Managed-library ingest into ${libraryRoot}.` : 'Filesystem ingest without managed-library copy.',
    );

    if (libraryRoot) {
      setMetadata.run('managed_library_root', libraryRoot);
    }

    const findExistingByHash = database.prepare(`SELECT id FROM tracks WHERE hash_sha256 = ?`);
    const findExistingByPath = database.prepare(`SELECT id FROM tracks WHERE canonical_path = ?`);
    const insertTrack = database.prepare(`
      INSERT INTO tracks (
        id, canonical_path, file_name, extension, size_bytes, duration_sec, sample_rate_hz, bitrate_kbps,
        hash_sha256, audio_format, modified_at, added_at, title, album, year, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTrackPerson = database.prepare(`
      INSERT INTO track_people (track_id, role, name, position)
      VALUES (?, ?, ?, ?)
    `);
    const insertProvenance = database.prepare(`
      INSERT INTO metadata_provenance (
        entity_kind, entity_id, field_path, source_kind, source_name, source_ref, confidence, observed_at, value_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateImportJob = database.prepare(`
      UPDATE import_jobs
      SET status = ?, completed_at = ?, note = ?
      WHERE id = ?
    `);

    let insertedTrackCount = 0;
    let skippedExistingCount = 0;

    for (const filePath of candidateFiles) {
      const fileHash = await hashFile(filePath);
      const fileName = path.basename(filePath);
      const extension = path.extname(fileName).replace(/^\./, '').toLowerCase();
      const canonicalPath = libraryRoot
        ? await ensureManagedLibraryCopy(filePath, fileHash, extension, libraryRoot)
        : filePath;
      const observedAt = new Date().toISOString();
      const metadata = await extractAudioMetadata(filePath);
      const normalized = deriveTitleAndArtists(fileName, metadata);
      const existingByHash = findExistingByHash.get(fileHash) as { id: string } | undefined;
      const existingByPath = findExistingByPath.get(canonicalPath) as { id: string } | undefined;

      if (existingByHash || existingByPath) {
        const existingTrackId = existingByHash?.id ?? existingByPath?.id;
        if (existingTrackId) {
          recordObservedMetadata(
            insertProvenance,
            existingTrackId,
            filePath,
            fileName,
            observedAt,
            metadata,
            normalized,
            libraryRoot,
            canonicalPath,
          );
        }
        skippedExistingCount += 1;
        continue;
      }

      const stat = await lstat(filePath);
      const trackId = randomUUID();
      const normalizedAlbum = normalizeText(metadata.album);

      insertTrack.run(
        trackId,
        canonicalPath,
        fileName,
        extension,
        stat.size,
        metadata.durationSec,
        metadata.sampleRateHz,
        metadata.bitrateKbps,
        fileHash,
        extension,
        new Date(stat.mtimeMs).toISOString(),
        observedAt,
        normalized.title,
        normalizedAlbum,
        metadata.year,
        observedAt,
        observedAt,
      );

      for (const [index, artist] of normalized.artists.entries()) {
        insertTrackPerson.run(trackId, 'artist', artist, index);
      }

      insertProvenance.run(
        'track',
        trackId,
        'file.hashSha256',
        'filesystem',
        'filesystem-scan',
        filePath,
        1.0,
        observedAt,
        JSON.stringify(fileHash),
      );
      recordObservedMetadata(
        insertProvenance,
        trackId,
        filePath,
        fileName,
        observedAt,
        metadata,
        normalized,
        libraryRoot,
        canonicalPath,
      );

      insertedTrackCount += 1;
    }

    updateImportJob.run(
      'completed',
      new Date().toISOString(),
      JSON.stringify({
        insertedTrackCount,
        skippedExistingCount,
        candidateFileCount: candidateFiles.length,
        libraryRoot,
      }),
      importJobId,
    );

    database.exec('COMMIT');

    return {
      importJobId,
      visitedPathCount: uniqueVisitedFiles.length,
      candidateFileCount: candidateFiles.length,
      insertedTrackCount,
      skippedExistingCount,
      databasePath,
      libraryRoot,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
