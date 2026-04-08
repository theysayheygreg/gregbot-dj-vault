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

type PlaylistRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  sort_mode: string | null;
};

type PlaylistTagRow = {
  playlist_id: string;
  value: string;
};

type PlaylistItemRow = {
  playlist_id: string;
  position: number;
  note: string | null;
  transition_note: string | null;
  track_id: string;
  track_title: string | null;
  track_artist: string | null;
};

type DjSetRow = {
  id: string;
  name: string;
  event: string | null;
  target_duration_min: number | null;
  vibe: string | null;
  created_at: string;
  updated_at: string;
};

type SetTrackRow = {
  dj_set_id: string;
  track_order: number;
  role: string | null;
  transition_method: string | null;
  transition_note: string | null;
  energy_delta: number | null;
  track_id: string;
  track_title: string | null;
  track_artist: string | null;
};

type ImportJobRow = {
  id: string;
  source_kind: string;
  source_path: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  note: string | null;
};

type ExportJobRow = {
  id: string;
  target_kind: string;
  target_path: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  note: string | null;
};

export type ExportCatalogToQmdResult = {
  exportRoot: string;
  trackDocCount: number;
  playlistDocCount: number;
  setDocCount: number;
  jobDocCount: number;
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

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [String(parsed)];
  } catch {
    return [value];
  }
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

function buildPlaylistMarkdown(
  playlist: PlaylistRow,
  tags: PlaylistTagRow[],
  items: PlaylistItemRow[],
  parentName: string | null,
): string {
  const body = [
    `# ${playlist.name}`,
    '',
    '## Summary',
    `- playlist_id: ${playlist.id}`,
    `- type: ${playlist.type}`,
    `- parent: ${parentName ?? 'root'}`,
    `- sort_mode: ${playlist.sort_mode ?? 'manual'}`,
    `- item_count: ${items.length}`,
    '',
    '## Tags',
    ...(tags.length > 0 ? tags.map((tag) => `- ${tag.value}`) : ['- none']),
    '',
    '## Description',
    normalizeLine(playlist.description) ?? 'none',
    '',
    '## Items',
    ...(items.length > 0
      ? items.map(
          (item) =>
            `- ${item.position}. ${item.track_title ?? item.track_id} | artists: ${item.track_artist ?? 'unknown'} | note: ${item.note ?? 'none'} | transition: ${item.transition_note ?? 'none'}`,
        )
      : ['- none']),
    '',
    '## Timeline',
    `- created_at: ${playlist.created_at}`,
    `- updated_at: ${playlist.updated_at}`,
    '',
  ];

  return `${body.join('\n')}\n`;
}

function buildSetMarkdown(djSet: DjSetRow, tracks: SetTrackRow[]): string {
  const body = [
    `# ${djSet.name}`,
    '',
    '## Summary',
    `- set_id: ${djSet.id}`,
    `- event: ${djSet.event ?? 'none'}`,
    `- target_duration_min: ${djSet.target_duration_min ?? 'unknown'}`,
    `- vibe: ${djSet.vibe ?? 'none'}`,
    `- track_count: ${tracks.length}`,
    '',
    '## Sequence',
    ...(tracks.length > 0
      ? tracks.map(
          (track) =>
            `- ${track.track_order}. ${track.track_title ?? track.track_id} | artists: ${track.track_artist ?? 'unknown'} | role: ${track.role ?? 'none'} | transition: ${track.transition_method ?? 'none'} | note: ${track.transition_note ?? 'none'} | energy_delta: ${track.energy_delta ?? 'none'}`,
        )
      : ['- none']),
    '',
    '## Timeline',
    `- created_at: ${djSet.created_at}`,
    `- updated_at: ${djSet.updated_at}`,
    '',
  ];

  return `${body.join('\n')}\n`;
}

function buildJobMarkdown(kind: 'import' | 'export', job: ImportJobRow | ExportJobRow): string {
  const targetLabel = kind === 'import' ? 'source' : 'target';
  const body = [
    `# ${kind === 'import' ? 'Import' : 'Export'} Job ${job.id}`,
    '',
    '## Summary',
    `- job_id: ${job.id}`,
    `- kind: ${kind}`,
    `- ${targetLabel}_kind: ${kind === 'import' ? (job as ImportJobRow).source_kind : (job as ExportJobRow).target_kind}`,
    `- status: ${job.status}`,
    `- started_at: ${job.started_at}`,
    `- completed_at: ${job.completed_at ?? 'running'}`,
    `- ${targetLabel}_path: ${kind === 'import' ? (job as ImportJobRow).source_path ?? 'none' : (job as ExportJobRow).target_path ?? 'none'}`,
    '',
    '## Note',
    normalizeLine(job.note) ?? 'none',
    '',
  ];

  const structuredPaths = kind === 'import' ? parseJsonArray((job as ImportJobRow).source_path) : [];
  if (structuredPaths.length > 1) {
    body.push('## Expanded Paths', ...structuredPaths.map((entry) => `- ${entry}`), '');
  }

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
  const playlistsDir = path.join(absoluteExportRoot, 'playlists');
  const setsDir = path.join(absoluteExportRoot, 'sets');
  const jobsDir = path.join(absoluteExportRoot, 'jobs');

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

    const playlists = database.prepare(`
      SELECT id, name, type, parent_id, description, created_at, updated_at, sort_mode
      FROM playlists
      ORDER BY name COLLATE NOCASE, id
    `).all() as PlaylistRow[];

    const playlistTags = database.prepare(`
      SELECT playlist_id, value
      FROM playlist_tags
      ORDER BY playlist_id, position
    `).all() as PlaylistTagRow[];

    const playlistItems = database.prepare(`
      SELECT
        playlist_items.playlist_id,
        playlist_items.position,
        playlist_items.note,
        playlist_items.transition_note,
        playlist_items.track_id,
        tracks.title AS track_title,
        (
          SELECT name
          FROM track_people
          WHERE track_people.track_id = tracks.id AND track_people.role = 'artist'
          ORDER BY position
          LIMIT 1
        ) AS track_artist
      FROM playlist_items
      LEFT JOIN tracks ON tracks.id = playlist_items.track_id
      ORDER BY playlist_items.playlist_id, playlist_items.position
    `).all() as PlaylistItemRow[];

    const djSets = database.prepare(`
      SELECT id, name, event, target_duration_min, vibe, created_at, updated_at
      FROM dj_sets
      ORDER BY name COLLATE NOCASE, id
    `).all() as DjSetRow[];

    const setTracks = database.prepare(`
      SELECT
        set_tracks.dj_set_id,
        set_tracks.track_order,
        set_tracks.role,
        set_tracks.transition_method,
        set_tracks.transition_note,
        set_tracks.energy_delta,
        set_tracks.track_id,
        tracks.title AS track_title,
        (
          SELECT name
          FROM track_people
          WHERE track_people.track_id = tracks.id AND track_people.role = 'artist'
          ORDER BY position
          LIMIT 1
        ) AS track_artist
      FROM set_tracks
      LEFT JOIN tracks ON tracks.id = set_tracks.track_id
      ORDER BY set_tracks.dj_set_id, set_tracks.track_order
    `).all() as SetTrackRow[];

    const importJobs = database.prepare(`
      SELECT id, source_kind, source_path, status, started_at, completed_at, note
      FROM import_jobs
      ORDER BY started_at DESC, id DESC
    `).all() as ImportJobRow[];

    const exportJobs = database.prepare(`
      SELECT id, target_kind, target_path, status, started_at, completed_at, note
      FROM export_jobs
      ORDER BY started_at DESC, id DESC
    `).all() as ExportJobRow[];

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

    const playlistTagsByPlaylist = new Map<string, PlaylistTagRow[]>();
    for (const tag of playlistTags) {
      const bucket = playlistTagsByPlaylist.get(tag.playlist_id) ?? [];
      bucket.push(tag);
      playlistTagsByPlaylist.set(tag.playlist_id, bucket);
    }

    const playlistItemsByPlaylist = new Map<string, PlaylistItemRow[]>();
    for (const item of playlistItems) {
      const bucket = playlistItemsByPlaylist.get(item.playlist_id) ?? [];
      bucket.push(item);
      playlistItemsByPlaylist.set(item.playlist_id, bucket);
    }

    const setTracksBySet = new Map<string, SetTrackRow[]>();
    for (const item of setTracks) {
      const bucket = setTracksBySet.get(item.dj_set_id) ?? [];
      bucket.push(item);
      setTracksBySet.set(item.dj_set_id, bucket);
    }

    const playlistNames = new Map(playlists.map((playlist) => [playlist.id, playlist.name]));

    await rm(absoluteExportRoot, { recursive: true, force: true });
    await mkdir(tracksDir, { recursive: true });
    await mkdir(playlistsDir, { recursive: true });
    await mkdir(setsDir, { recursive: true });
    await mkdir(jobsDir, { recursive: true });

    for (const track of tracks) {
      const fileName = `${toSlug(track.title || track.file_name || track.id) || track.id}-${track.id}.md`;
      const markdown = buildTrackMarkdown(track, peopleByTrack.get(track.id) ?? [], tagsByTrack.get(track.id) ?? []);
      await writeFile(path.join(tracksDir, fileName), markdown, 'utf8');
    }

    for (const playlist of playlists) {
      const fileName = `${toSlug(playlist.name || playlist.id) || playlist.id}-${playlist.id}.md`;
      const markdown = buildPlaylistMarkdown(
        playlist,
        playlistTagsByPlaylist.get(playlist.id) ?? [],
        playlistItemsByPlaylist.get(playlist.id) ?? [],
        playlist.parent_id ? playlistNames.get(playlist.parent_id) ?? playlist.parent_id : null,
      );
      await writeFile(path.join(playlistsDir, fileName), markdown, 'utf8');
    }

    for (const djSet of djSets) {
      const fileName = `${toSlug(djSet.name || djSet.id) || djSet.id}-${djSet.id}.md`;
      const markdown = buildSetMarkdown(djSet, setTracksBySet.get(djSet.id) ?? []);
      await writeFile(path.join(setsDir, fileName), markdown, 'utf8');
    }

    for (const importJob of importJobs) {
      await writeFile(path.join(jobsDir, `import-${importJob.id}.md`), buildJobMarkdown('import', importJob), 'utf8');
    }

    for (const exportJob of exportJobs) {
      await writeFile(path.join(jobsDir, `export-${exportJob.id}.md`), buildJobMarkdown('export', exportJob), 'utf8');
    }

    return {
      exportRoot: absoluteExportRoot,
      trackDocCount: tracks.length,
      playlistDocCount: playlists.length,
      setDocCount: djSets.length,
      jobDocCount: importJobs.length + exportJobs.length,
      collectionNames: ['dj-vault-catalog', 'dj-vault-docs', 'dj-vault-research', 'dj-vault-manifests'],
    };
  } finally {
    database.close();
  }
}

export async function setupQmdForDjVault(projectRoot: string, databasePath: string, exportRoot: string): Promise<ExportCatalogToQmdResult> {
  const result = await exportCatalogToQmd(databasePath, exportRoot);
  const absoluteProjectRoot = path.resolve(projectRoot);

  await ensureQmdCollection(
    absoluteProjectRoot,
    exportRoot,
    'dj-vault-catalog',
    '**/*.md',
    'Generated DJ Vault catalog documents covering tracks, playlists, DJ sets, and import/export job history for local keyword and semantic search.',
  );
  await ensureQmdCollection(
    absoluteProjectRoot,
    path.join(absoluteProjectRoot, 'docs'),
    'dj-vault-docs',
    '**/*.md',
    'DJ Vault architecture, roadmap, design, and project documentation.',
  );
  await ensureQmdCollection(
    absoluteProjectRoot,
    path.join(absoluteProjectRoot, 'research/analysis'),
    'dj-vault-research',
    '**/*.md',
    'DJ Vault reverse-engineering notes and vendor behavior analysis.',
  );
  await ensureQmdCollection(
    absoluteProjectRoot,
    path.join(absoluteProjectRoot, 'research/manifests'),
    'dj-vault-manifests',
    '**/*.json',
    'Machine-readable DJ Vault inventories, source maps, and generated vendor manifests.',
  );

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
