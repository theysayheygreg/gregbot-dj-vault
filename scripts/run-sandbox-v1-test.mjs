import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const fixtureRoot = path.resolve(rootDir, 'tmp/sandbox-v1');
const runtimeRoot = path.join(fixtureRoot, 'runtime');
const reportsRoot = path.join(fixtureRoot, 'reports');
const databasePath = path.join(runtimeRoot, 'sandbox-v1.sqlite');
const managedLibraryRoot = path.join(runtimeRoot, 'managed-library');
const catalogDistDir = path.join(rootDir, 'packages/catalog/dist');
const builderScript = path.join(rootDir, 'scripts/build-sandbox-v1-fixture.sh');

function quote(value) {
  return JSON.stringify(value);
}

async function run(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: rootDir,
    ...options,
  });
  return { stdout, stderr };
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

function decodeSynchsafeInteger(bytes) {
  return ((bytes[0] ?? 0) << 21) | ((bytes[1] ?? 0) << 14) | ((bytes[2] ?? 0) << 7) | (bytes[3] ?? 0);
}

function stripMp3Tags(buffer) {
  let start = 0;
  let end = buffer.length;

  if (buffer.length >= 10 && buffer.subarray(0, 3).toString('latin1') === 'ID3') {
    const flags = buffer[5] ?? 0;
    const size = decodeSynchsafeInteger(buffer.subarray(6, 10));
    start = 10 + size + ((flags & 0x10) !== 0 ? 10 : 0);
  }

  if (end - start >= 128 && buffer.subarray(end - 128, end - 125).toString('latin1') === 'TAG') {
    end -= 128;
  }

  return buffer.subarray(Math.min(start, buffer.length), Math.max(Math.min(end, buffer.length), start));
}

async function hashAudioContent(filePath) {
  if (path.extname(filePath).toLowerCase() === '.mp3') {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(stripMp3Tags(buffer)).digest('hex');
  }
  return hashFile(filePath);
}

async function collectPlaylistFiles(root) {
  const entries = [];
  const views = await readDirSorted(root);
  for (const view of views) {
    const viewPath = path.join(root, view);
    const files = await readDirSorted(viewPath);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.m3u8')) {
        entries.push({
          view,
          playlistPath: path.join(viewPath, file),
          playlistBaseName: file.replace(/\.m3u8$/i, ''),
        });
      }
    }
  }
  return entries;
}

async function readDirSorted(dirPath) {
  const entries = await readdir(dirPath);
  return entries.sort((a, b) => a.localeCompare(b));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function importPlaylists(databasePathValue, playlistRoot) {
  const { createPlaylist, addTrackToPlaylist } = await import(path.join(catalogDistDir, 'authoring.js'));
  const playlistFiles = await collectPlaylistFiles(playlistRoot);
  const imported = [];

  for (const entry of playlistFiles) {
    const playlistName = `${entry.view} :: ${entry.playlistBaseName}`;
    const playlist = createPlaylist(databasePathValue, {
      name: playlistName,
      type: 'playlist',
      description: `Imported from sandbox fixture view ${entry.view}.`,
      sortMode: 'manual',
    });

    const lines = (await readFile(entry.playlistPath, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const mediaPath = path.resolve(path.dirname(entry.playlistPath), line);
      const mediaHash = await hashAudioContent(mediaPath);
      addTrackToPlaylist(databasePathValue, {
        playlistId: playlist.id,
        trackRef: mediaHash,
      });
    }

    imported.push({
      id: playlist.id,
      view: entry.view,
      name: playlistName,
      sourcePath: entry.playlistPath,
      itemCount: lines.length,
    });
  }

  return imported;
}

async function resolveCanonicalTrackId(databasePathValue, title) {
  const database = new DatabaseSync(databasePathValue, { readOnly: true });
  try {
    const match = database.prepare(`
      SELECT id
      FROM tracks
      WHERE title = ? AND album = 'Sandbox V1 Canonical'
      ORDER BY created_at ASC
      LIMIT 1
    `).get(title);
    if (!match?.id) {
      throw new Error(`No canonical track found for ${title}.`);
    }
    return match.id;
  } finally {
    database.close();
  }
}

async function seedPlaybackHistory(databasePathValue) {
  const { createPlaybackSession, logPlaybackEvent } = await import(path.join(catalogDistDir, 'recency.js'));

  const session = createPlaybackSession(databasePathValue, {
    sourceKind: 'sandbox-fixture',
    sourceRef: 'rekordbox6-dirty/Last Session',
    venue: 'Fixture Lab',
    context: 'legacy booth warmup',
    note: 'Simulated last-session playback from sandbox fixture.',
    startedAt: '2026-04-10T04:00:00.000Z',
    endedAt: '2026-04-10T04:24:00.000Z',
  });

  const eventSpecs = [
    { title: 'Rocker (Eric Prydz Remix)', playedAt: '2026-04-10T04:02:00.000Z' },
    { title: 'No More Conversations (Mylo Remix)', playedAt: '2026-04-10T04:09:00.000Z' },
    { title: 'Zdarlight', playedAt: '2026-04-10T04:17:00.000Z' },
  ];

  return {
    sessionId: session.id,
    events: await Promise.all(eventSpecs.map(async (event, index) => logPlaybackEvent(databasePathValue, {
      trackRef: await resolveCanonicalTrackId(databasePathValue, event.title),
      playedAt: event.playedAt,
      sessionId: session.id,
      positionInSession: index,
      sourceKind: 'sandbox-fixture',
      sourceRef: 'last-session.m3u8',
      note: 'Seeded by sandbox v1 test runner.',
    }))),
  };
}

function loadExpectedTruth(expectedPath) {
  const lines = readFileSync(expectedPath, 'utf8').trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows.map((row) => {
    const [slug, expectedTitle, expectedArtist, expectedAlbum, expectedNotes] = row.split('\t');
    return { slug, expectedTitle, expectedArtist, expectedAlbum, expectedNotes };
  });
}

function collectReport(databasePathValue, importedPlaylists, playbackSeed) {
  const database = new DatabaseSync(databasePathValue, { readOnly: true });

  try {
    const summary = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM tracks) AS track_count,
        (SELECT COUNT(*) FROM playlists) AS playlist_count,
        (SELECT COUNT(*) FROM playlist_items) AS playlist_item_count,
        (SELECT COUNT(*) FROM playback_sessions) AS playback_session_count,
        (SELECT COUNT(*) FROM playback_events) AS playback_event_count,
        (SELECT COUNT(*) FROM metadata_provenance) AS provenance_count
    `).get();

    const tracks = database.prepare(`
      SELECT
        tracks.id,
        tracks.title,
        COALESCE(MAX(CASE WHEN track_people.role = 'artist' THEN track_people.name END), NULL) AS artist,
        tracks.album,
        tracks.play_count,
        tracks.last_played_at,
        tracks.hash_sha256
      FROM tracks
      LEFT JOIN track_people ON track_people.track_id = tracks.id
      GROUP BY tracks.id
      ORDER BY tracks.title COLLATE NOCASE
    `).all();

    const titleOpinions = database.prepare(`
      SELECT entity_id AS track_id, COUNT(DISTINCT value_json) AS distinct_title_count
      FROM metadata_provenance
      WHERE entity_kind = 'track' AND field_path = 'identity.title'
      GROUP BY entity_id
    `).all();
    const sourceOpinions = database.prepare(`
      SELECT entity_id AS track_id, COUNT(DISTINCT source_ref) AS distinct_source_path_count
      FROM metadata_provenance
      WHERE entity_kind = 'track' AND field_path = 'file.sourcePath'
      GROUP BY entity_id
    `).all();

    const titleOpinionByTrackId = new Map(titleOpinions.map((row) => [row.track_id, row.distinct_title_count]));
    const sourceOpinionByTrackId = new Map(sourceOpinions.map((row) => [row.track_id, row.distinct_source_path_count]));

    const expectedTruth = loadExpectedTruth(path.join(fixtureRoot, 'expected/canonical-truth.tsv'));
    const expectationResults = expectedTruth.map((expected) => {
      const exact = tracks.find((track) => track.title === expected.expectedTitle && track.artist === expected.expectedArtist);
      const titleOnly = tracks.find((track) => track.title === expected.expectedTitle);
      const actual = exact ?? titleOnly ?? null;
      return {
        slug: expected.slug,
        expectedTitle: expected.expectedTitle,
        expectedArtist: expected.expectedArtist,
        actualTitle: actual?.title ?? null,
        actualArtist: actual?.artist ?? null,
        titleMatches: actual?.title === expected.expectedTitle,
        artistMatches: actual?.artist === expected.expectedArtist,
      };
    });

    const titleSlugCounts = new Map();
    for (const track of tracks) {
      const slug = slugify(track.title);
      titleSlugCounts.set(slug, (titleSlugCounts.get(slug) ?? 0) + 1);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      fixtureRoot,
      databasePath: databasePathValue,
      managedLibraryRoot,
      ingest: {
        expectedUniqueTrackCount: 6,
        uniqueTrackCount: summary.track_count,
        identitySplitGroupCount: [...titleSlugCounts.values()].filter((count) => count > 1).length,
        playlistCount: summary.playlist_count,
        playlistItemCount: summary.playlist_item_count,
        playbackSessionCount: summary.playback_session_count,
        playbackEventCount: summary.playback_event_count,
        provenanceCount: summary.provenance_count,
      },
      importedPlaylists,
      playbackSeed,
      trackResults: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        playCount: track.play_count,
        lastPlayedAt: track.last_played_at,
        distinctTitleOpinionCount: titleOpinionByTrackId.get(track.id) ?? 0,
        distinctSourcePathCount: sourceOpinionByTrackId.get(track.id) ?? 0,
        duplicateTitleSlugCount: titleSlugCounts.get(slugify(track.title)) ?? 1,
      })),
      expectationResults,
      observations: [
        'Current ingest now preserves conflicting duplicate-file metadata as provenance instead of discarding later opinions outright.',
        'Canonical track fields still come from first-write ingestion order; this test exposes where a future merge engine should take over.',
        'Playlist import now follows the same metadata-insensitive content hash as ingest, so differing file paths still resolve onto one canonical track when the audio payload matches.',
        'The current content hash solves metadata-rewritten MP3 copies, but it is not yet a full audio fingerprint for differently encoded downloads or alternate masters.',
      ],
    };

    return report;
  } finally {
    database.close();
  }
}

function renderMarkdownReport(report) {
  const failingExpectations = report.expectationResults.filter((result) => !result.titleMatches || !result.artistMatches);
  return [
    '# Sandbox V1 Test Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Unique tracks: ${report.ingest.uniqueTrackCount} (expected ${report.ingest.expectedUniqueTrackCount})`,
    `- Identity split groups: ${report.ingest.identitySplitGroupCount}`,
    `- Imported playlists: ${report.ingest.playlistCount}`,
    `- Playlist items: ${report.ingest.playlistItemCount}`,
    `- Playback sessions: ${report.ingest.playbackSessionCount}`,
    `- Playback events: ${report.ingest.playbackEventCount}`,
    `- Provenance rows: ${report.ingest.provenanceCount}`,
    `- Duplicate content clusters: ${report.identityReport.duplicateClusterCount}`,
    '',
    '## Track Results',
    '',
    ...report.trackResults.map((track) => `- ${track.title} | artist=${track.artist ?? 'missing'} | title opinions=${track.distinctTitleOpinionCount} | source paths=${track.distinctSourcePathCount} | duplicate title group=${track.duplicateTitleSlugCount} | playCount=${track.playCount}`),
    '',
    '## Expected Canonical Truth',
    '',
    ...report.expectationResults.map((result) => `- ${result.slug}: title ${result.titleMatches ? 'ok' : 'mismatch'} | artist ${result.artistMatches ? 'ok' : 'mismatch'} | actual="${result.actualTitle ?? 'missing'}" / "${result.actualArtist ?? 'missing'}"`),
    '',
    '## Notes',
    '',
    ...report.observations.map((note) => `- ${note}`),
    '',
    '## Identity Report',
    '',
    `- Tracks with content hash: ${report.identityReport.contentHashTrackCount}`,
    `- Duplicate clusters: ${report.identityReport.duplicateClusterCount}`,
    ...report.identityReport.clusters.slice(0, 8).map((cluster) => `- cluster ${cluster.clusterKey.slice(0, 12)}… has ${cluster.trackCount} tracks: ${cluster.tracks.map((track) => track.title).join(' | ')}`),
    '',
    failingExpectations.length === 0
      ? 'All canonical-title and artist expectations matched in the current ingest order.'
      : `${failingExpectations.length} expectation rows still need merge logic beyond first-write ingest behavior.`,
    '',
  ].join('\n');
}

await mkdir(runtimeRoot, { recursive: true });
await mkdir(reportsRoot, { recursive: true });
await rm(databasePath, { force: true });
await rm(`${databasePath}-shm`, { force: true });
await rm(`${databasePath}-wal`, { force: true });
await rm(managedLibraryRoot, { recursive: true, force: true });

await run('bash', [builderScript, fixtureRoot]);
await run('node', [path.join(catalogDistDir, 'cli/init-catalog.js'), databasePath]);
await run('node', [
  path.join(catalogDistDir, 'cli/ingest-files.js'),
  databasePath,
  '--library-root',
  managedLibraryRoot,
  path.join(fixtureRoot, 'views/canonical-embedded/music'),
  path.join(fixtureRoot, 'views/rekordbox6-dirty/music'),
  path.join(fixtureRoot, 'views/traktor-dirty/music'),
]);

const importedPlaylists = await importPlaylists(databasePath, path.join(fixtureRoot, 'playlists'));
const playbackSeed = await seedPlaybackHistory(databasePath);
const { generateIdentityReport } = await import(path.join(catalogDistDir, 'identity.js'));
const report = {
  ...collectReport(databasePath, importedPlaylists, playbackSeed),
  identityReport: generateIdentityReport(databasePath),
};

const reportJsonPath = path.join(reportsRoot, 'sandbox-v1-test-report.json');
const reportMdPath = path.join(reportsRoot, 'sandbox-v1-test-report.md');
await writeFile(reportJsonPath, JSON.stringify(report, null, 2));
await writeFile(reportMdPath, renderMarkdownReport(report));

console.log(JSON.stringify({
  reportJsonPath,
  reportMdPath,
  uniqueTrackCount: report.ingest.uniqueTrackCount,
  playlistCount: report.ingest.playlistCount,
  failingExpectationCount: report.expectationResults.filter((result) => !result.titleMatches || !result.artistMatches).length,
}, null, 2));
