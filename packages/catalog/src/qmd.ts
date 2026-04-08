import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type TrackRow = {
  id: string;
  canonical_path: string;
  file_name: string;
  extension: string;
  title: string;
  mix_name: string | null;
  album: string | null;
  label: string | null;
  year: number | null;
  genre: string | null;
  bpm: number | null;
  bpm_float: number | null;
  key_display: string | null;
  key_camelot: string | null;
  key_open_key: string | null;
  energy: number | null;
  color: string | null;
  rating: number | null;
  comment: string | null;
  description: string | null;
  play_count: number;
  liked: number;
  hidden: number;
  rekordbox_track_id: string | null;
  rekordbox_location_uri: string | null;
  traktor_collection_path_key: string | null;
  traktor_audio_id: string | null;
  source: string | null;
  source_url: string | null;
};

type TrackPersonRow = {
  track_id: string;
  role: string;
  name: string;
};

type TrackTagRow = {
  track_id: string;
  tag_kind: string;
  value: string;
};

export type ExportCatalogToQmdResult = {
  exportRoot: string;
  trackDocCount: number;
  collectionNames: string[];
};

function normalizeLine(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalized.length > 0 ? normalized : null;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildTrackMarkdown(track: TrackRow, people: TrackPersonRow[], tags: TrackTagRow[]): string {
  const artists = people.filter((person) => person.role === 'artist').map((person) => person.name);
  const groupedPeople = new Map<string, string[]>();
  for (const person of people) {
    const bucket = groupedPeople.get(person.role) ?? [];
    bucket.push(person.name);
    groupedPeople.set(person.role, bucket);
  }

  const groupedTags = new Map<string, string[]>();
  for (const tag of tags) {
    const bucket = groupedTags.get(tag.tag_kind) ?? [];
    bucket.push(tag.value);
    groupedTags.set(tag.tag_kind, bucket);
  }

  const body = [
    `# ${track.title}`,
    '',
    '## Summary',
    `- track_id: ${track.id}`,
    `- artists: ${formatList(artists)}`,
    `- album: ${track.album ?? 'unknown'}`,
    `- genre: ${track.genre ?? 'unknown'}`,
    `- bpm: ${track.bpm ?? track.bpm_float ?? 'unknown'}`,
    `- key: ${track.key_display ?? track.key_camelot ?? track.key_open_key ?? 'unknown'}`,
    `- energy: ${track.energy ?? 'unknown'}`,
    `- rating: ${track.rating ?? 'unknown'}`,
    `- liked: ${track.liked ? 'yes' : 'no'}`,
    `- hidden: ${track.hidden ? 'yes' : 'no'}`,
    `- play_count: ${track.play_count}`,
    '',
    '## File',
    `- canonical_path: ${track.canonical_path}`,
    `- file_name: ${track.file_name}`,
    `- extension: ${track.extension}`,
    '',
    '## Metadata',
    `- mix_name: ${track.mix_name ?? 'none'}`,
    `- label: ${track.label ?? 'none'}`,
    `- year: ${track.year ?? 'unknown'}`,
    `- source: ${track.source ?? 'unknown'}`,
    `- source_url: ${track.source_url ?? 'none'}`,
    '',
    '## Vendor References',
    `- rekordbox_track_id: ${track.rekordbox_track_id ?? 'none'}`,
    `- rekordbox_location_uri: ${track.rekordbox_location_uri ?? 'none'}`,
    `- traktor_collection_path_key: ${track.traktor_collection_path_key ?? 'none'}`,
    `- traktor_audio_id: ${track.traktor_audio_id ?? 'none'}`,
    '',
    '## People',
    ...[...groupedPeople.entries()].flatMap(([role, names]) => [`- ${role}: ${formatList(names)}`]),
    '',
    '## Tags',
    ...[...groupedTags.entries()].flatMap(([kind, values]) => [`- ${kind}: ${formatList(values)}`]),
    '',
    '## Notes',
    normalizeLine(track.comment) ?? 'none',
    '',
    '## Description',
    normalizeLine(track.description) ?? 'none',
    '',
  ];

  return `${body.join('\n')}\n`;
}

async function runQmd(args: string[], cwd: string): Promise<string> {
  const command = path.resolve(cwd, 'node_modules/.bin/qmd');
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    maxBuffer: 8_000_000,
  });
  return `${stdout}${stderr}`.trim();
}

async function ensureQmdCollection(cwd: string, targetPath: string, name: string, mask: string, context: string): Promise<void> {
  try {
    await runQmd(['collection', 'add', targetPath, '--name', name, '--mask', mask], cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|duplicate|UNIQUE constraint/i.test(message)) {
      throw error;
    }
  }

  try {
    await runQmd(['context', 'add', `qmd://${name}`, context], cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|duplicate|UNIQUE constraint/i.test(message)) {
      throw error;
    }
  }
}

export async function exportCatalogToQmd(databasePath: string, exportRoot: string): Promise<ExportCatalogToQmdResult> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const absoluteExportRoot = path.resolve(exportRoot);
  const tracksDir = path.join(absoluteExportRoot, 'tracks');

  try {
    const tracks = database.prepare(`
      SELECT
        id, canonical_path, file_name, extension, title, mix_name, album, label, year, genre,
        bpm, bpm_float, key_display, key_camelot, key_open_key, energy, color, rating,
        comment, description, play_count, liked, hidden, rekordbox_track_id, rekordbox_location_uri,
        traktor_collection_path_key, traktor_audio_id, source, source_url
      FROM tracks
      ORDER BY title COLLATE NOCASE, id
    `).all() as TrackRow[];

    const people = database.prepare(`
      SELECT track_id, role, name
      FROM track_people
      ORDER BY track_id, role, position
    `).all() as TrackPersonRow[];

    const tags = database.prepare(`
      SELECT track_id, tag_kind, value
      FROM track_tags
      ORDER BY track_id, tag_kind, position
    `).all() as TrackTagRow[];

    const peopleByTrack = new Map<string, TrackPersonRow[]>();
    for (const person of people) {
      const bucket = peopleByTrack.get(person.track_id) ?? [];
      bucket.push(person);
      peopleByTrack.set(person.track_id, bucket);
    }

    const tagsByTrack = new Map<string, TrackTagRow[]>();
    for (const tag of tags) {
      const bucket = tagsByTrack.get(tag.track_id) ?? [];
      bucket.push(tag);
      tagsByTrack.set(tag.track_id, bucket);
    }

    await rm(absoluteExportRoot, { recursive: true, force: true });
    await mkdir(tracksDir, { recursive: true });

    for (const track of tracks) {
      const fileName = `${toSlug(track.title || track.file_name || track.id) || track.id}-${track.id}.md`;
      const markdown = buildTrackMarkdown(track, peopleByTrack.get(track.id) ?? [], tagsByTrack.get(track.id) ?? []);
      await writeFile(path.join(tracksDir, fileName), markdown, 'utf8');
    }

    return {
      exportRoot: absoluteExportRoot,
      trackDocCount: tracks.length,
      collectionNames: ['dj-vault-tracks', 'dj-vault-docs', 'dj-vault-research', 'dj-vault-manifests'],
    };
  } finally {
    database.close();
  }
}

export async function setupQmdForDjVault(projectRoot: string, databasePath: string, exportRoot: string): Promise<ExportCatalogToQmdResult> {
  const result = await exportCatalogToQmd(databasePath, exportRoot);
  const absoluteProjectRoot = path.resolve(projectRoot);

  await ensureQmdCollection(absoluteProjectRoot, path.join(exportRoot, 'tracks'), 'dj-vault-tracks', '**/*.md', 'Generated DJ Vault track metadata documents for semantic and keyword library search.');
  await ensureQmdCollection(absoluteProjectRoot, path.join(absoluteProjectRoot, 'docs'), 'dj-vault-docs', '**/*.md', 'DJ Vault architecture, roadmap, design, and project documentation.');
  await ensureQmdCollection(absoluteProjectRoot, path.join(absoluteProjectRoot, 'research/analysis'), 'dj-vault-research', '**/*.md', 'DJ Vault reverse-engineering notes and vendor behavior analysis.');
  await ensureQmdCollection(absoluteProjectRoot, path.join(absoluteProjectRoot, 'research/manifests'), 'dj-vault-manifests', '**/*.json', 'Machine-readable DJ Vault inventories, source maps, and generated vendor manifests.');

  return result;
}

export async function updateQmdForDjVault(projectRoot: string, databasePath: string, exportRoot: string): Promise<ExportCatalogToQmdResult> {
  const result = await setupQmdForDjVault(projectRoot, databasePath, exportRoot);
  await runQmd(['update'], path.resolve(projectRoot));
  return result;
}

export async function embedQmdForDjVault(projectRoot: string): Promise<void> {
  await runQmd(['embed'], path.resolve(projectRoot));
}

export async function qmdCollectionList(projectRoot: string): Promise<string> {
  return runQmd(['collection', 'list'], path.resolve(projectRoot));
}

export async function removeQmdExportRoot(exportRoot: string): Promise<void> {
  const absoluteExportRoot = path.resolve(exportRoot);
  const entries = await readdir(path.dirname(absoluteExportRoot)).catch(() => []);
  if (entries.length >= 0) {
    await rm(absoluteExportRoot, { recursive: true, force: true });
  }
}
