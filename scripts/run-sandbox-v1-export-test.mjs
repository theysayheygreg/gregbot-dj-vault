import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const fixtureRoot = path.join(rootDir, 'tmp/sandbox-v1');
const runtimeRoot = path.join(fixtureRoot, 'runtime');
const reportsRoot = path.join(fixtureRoot, 'reports');
const databasePath = path.join(runtimeRoot, 'sandbox-v1.sqlite');
const managedLibraryRoot = path.join(runtimeRoot, 'managed-library');
const exportRoot = path.join(runtimeRoot, 'rekordbox-device-export');
const catalogDistDir = path.join(rootDir, 'packages/catalog/dist');
const baseRunner = path.join(rootDir, 'scripts/run-sandbox-v1-test.mjs');
const targetPlaylistName = 'canonical-embedded :: Warmup Tools';

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: rootDir,
    maxBuffer: 16_000_000,
  });
  return { stdout, stderr };
}

function readPlaylist(database, name) {
  const playlist = database.prepare(`
    SELECT id, name
    FROM playlists
    WHERE name = ?
  `).get(name);
  if (!playlist) {
    throw new Error(`Sandbox export target playlist "${name}" was not found.`);
  }
  return playlist;
}

function readPlaylistTracks(database, playlistId) {
  return database.prepare(`
    SELECT tracks.id, tracks.title, tracks.canonical_path, tracks.album,
           COALESCE(MAX(CASE WHEN track_people.role = 'artist' THEN track_people.name END), NULL) AS artist
    FROM playlist_items
    JOIN tracks ON tracks.id = playlist_items.track_id
    LEFT JOIN track_people ON track_people.track_id = tracks.id
    WHERE playlist_items.playlist_id = ?
    GROUP BY tracks.id
    ORDER BY playlist_items.position
  `).all(playlistId);
}

function readTrustPlans(databasePathValue, trackIds) {
  return import(path.join(catalogDistDir, 'merge.js')).then(({ generateMergeReport }) => {
    const report = generateMergeReport(databasePathValue);
    const wanted = new Set(trackIds);
    return report.plans
      .filter((plan) => wanted.has(plan.trackId))
      .map((plan) => ({
        trackId: plan.trackId,
        title: plan.selected.title,
        artist: plan.selected.artist,
        state: plan.trust.state,
        score: plan.trust.score,
        rationale: plan.trust.rationale,
        changedFields: plan.changedFields,
      }));
  });
}

function summarizeTrust(trustPlans) {
  const summary = {
    trusted: 0,
    chosen: 0,
    needsAttention: 0,
    blocked: 0,
  };
  for (const plan of trustPlans) {
    if (plan.state === 'trusted') {
      summary.trusted += 1;
    } else if (plan.state === 'chosen') {
      summary.chosen += 1;
    } else if (plan.state === 'needs-attention') {
      summary.needsAttention += 1;
    } else if (plan.state === 'blocked') {
      summary.blocked += 1;
    }
  }
  return summary;
}

async function setupExportTopology(databasePathValue, playlistTracks) {
  const {
    registerVaultNode,
    registerStorageLocation,
    recordTrackResidency,
  } = await import(path.join(catalogDistDir, 'topology.js'));

  const node = registerVaultNode(databasePathValue, {
    name: 'Sandbox Laptop',
    role: 'hybrid',
    transport: 'local',
    isOnline: true,
    notes: 'Local sandbox node used by the v1 export regression test.',
  });
  const sourceStorage = registerStorageLocation(databasePathValue, {
    nodeId: node.id,
    name: 'Sandbox Managed Library',
    kind: 'local-disk',
    mountPath: managedLibraryRoot,
    pathPrefix: managedLibraryRoot,
    isManagedLibrary: true,
    isAvailable: true,
    notes: 'Managed-library root created by the sandbox ingest test.',
  });
  const destinationStorage = registerStorageLocation(databasePathValue, {
    nodeId: node.id,
    name: 'Sandbox USB Target',
    kind: 'external-drive',
    mountPath: exportRoot,
    pathPrefix: exportRoot,
    isManagedLibrary: false,
    isAvailable: true,
    notes: 'Local folder standing in for a traditional rekordbox USB export.',
  });

  for (const track of playlistTracks) {
    recordTrackResidency(databasePathValue, {
      trackRef: track.id,
      storageLocationId: sourceStorage.id,
      residencyKind: 'canonical',
      relativePath: path.relative(managedLibraryRoot, track.canonical_path).split(path.sep).join('/'),
      status: 'ready',
      note: 'Recorded by sandbox v1 export regression.',
    });
  }

  return {
    node,
    sourceStorage,
    destinationStorage,
  };
}

function renderMarkdown(report) {
  return [
    '# Sandbox V1 Export Test Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    `- Source fixture: ${report.fixtureRoot}`,
    `- Scratch database: ${report.databasePath}`,
    `- Target playlist: ${report.targetPlaylist.name}`,
    `- Export root: ${report.export.outputRoot}`,
    '',
    '## Acceptance',
    '',
    `- Base sandbox expectations: ${report.baseSandbox.failingExpectationCount === 0 ? 'pass' : 'fail'}`,
    `- Export validation: ${report.validation.valid ? 'pass' : 'fail'}`,
    `- Missing files: ${report.validation.missingFiles.length}`,
    `- Playlist reference errors: ${report.validation.playlistReferenceErrors.length}`,
    `- Native gaps expected: ${report.nativeGaps.expected ? 'yes' : 'no'}`,
    `- Native gaps: ${report.nativeGaps.items.join(', ') || 'none'}`,
    '',
    '## Exported Tracks',
    '',
    ...report.tracks.map((track) => `- ${track.title} | artist=${track.artist ?? 'missing'} | trust=${track.trustState} | staged=${track.stagedRelativePath ?? 'missing'}`),
    '',
    '## Trust Summary',
    '',
    `- trusted: ${report.trustSummary.trusted}`,
    `- chosen: ${report.trustSummary.chosen}`,
    `- needs_attention: ${report.trustSummary.needsAttention}`,
    `- blocked: ${report.trustSummary.blocked}`,
    '',
    '## Generated Files',
    '',
    `- Collection XML: ${report.export.collectionXmlPath}`,
    `- Manifest: ${report.export.manifestPath}`,
    `- Validation manifest: ${report.validation.manifestPath}`,
    '',
    '## Notes',
    '',
    '- This test uses the generated sandbox libraries, not Greg’s long-term music library.',
    '- The export is structurally valid as a staged folder with media, XML, M3U, and manifest output.',
    '- Native `export.pdb` and `ANLZ` remain honest v1 gaps; this test expects those warnings until the native writer lands.',
    '',
  ].join('\n');
}

await mkdir(reportsRoot, { recursive: true });
await rm(exportRoot, { recursive: true, force: true });

const baseRun = await run('node', [baseRunner]);
const baseSummary = JSON.parse(baseRun.stdout.trim());
const baseReport = JSON.parse(await readFile(baseSummary.reportJsonPath, 'utf8'));

const database = new DatabaseSync(databasePath, { readOnly: true });
const targetPlaylist = readPlaylist(database, targetPlaylistName);
const playlistTracks = readPlaylistTracks(database, targetPlaylist.id);
database.close();

if (playlistTracks.length === 0) {
  throw new Error(`Sandbox export target playlist "${targetPlaylistName}" has no tracks.`);
}

const topology = await setupExportTopology(databasePath, playlistTracks);
const trustPlans = await readTrustPlans(databasePath, playlistTracks.map((track) => track.id));

const {
  saveRekordboxDeviceTarget,
  planRekordboxDeviceExport,
  exportRekordboxDeviceToSavedTarget,
  validateRekordboxDeviceExport,
} = await import(path.join(catalogDistDir, 'device-export-workflow.js'));

const savedTarget = saveRekordboxDeviceTarget(databasePath, {
  playlistRef: targetPlaylist.id,
  folderPath: exportRoot,
  name: 'Sandbox V1 Rekordbox USB',
  enabled: true,
});
const executionPlan = planRekordboxDeviceExport(databasePath, {
  playlistRef: targetPlaylist.id,
  executionNodeRef: topology.node.id,
  destinationStorageRef: topology.destinationStorage.id,
  sourceStorageRef: topology.sourceStorage.id,
  transport: 'local',
  note: 'Sandbox v1 export regression.',
});
const exportResult = await exportRekordboxDeviceToSavedTarget(databasePath, targetPlaylist.id);
const validation = await validateRekordboxDeviceExport(exportRoot);
const manifest = JSON.parse(await readFile(exportResult.manifestPath, 'utf8'));
const manifestTrackById = new Map(manifest.tracks.map((track) => [track.id, track]));
const trustByTrackId = new Map(trustPlans.map((plan) => [plan.trackId, plan]));
const nativeGaps = manifest.pendingNativeArtifacts ?? [];

const report = {
  generatedAt: new Date().toISOString(),
  fixtureRoot,
  databasePath,
  baseSandbox: {
    reportJsonPath: baseSummary.reportJsonPath,
    reportMdPath: baseSummary.reportMdPath,
    uniqueTrackCount: baseSummary.uniqueTrackCount,
    playlistCount: baseSummary.playlistCount,
    failingExpectationCount: baseSummary.failingExpectationCount,
    identitySplitGroupCount: baseReport.ingest.identitySplitGroupCount,
  },
  targetPlaylist: {
    id: targetPlaylist.id,
    name: targetPlaylist.name,
    trackCount: playlistTracks.length,
  },
  topology: {
    executionNode: topology.node,
    sourceStorage: topology.sourceStorage,
    destinationStorage: topology.destinationStorage,
    plan: executionPlan,
    savedTarget,
  },
  export: exportResult,
  validation,
  nativeGaps: {
    expected: nativeGaps.includes('export.pdb') && nativeGaps.some((item) => item.includes('ANLZ')),
    items: nativeGaps,
  },
  trustSummary: summarizeTrust(trustPlans),
  tracks: playlistTracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    trustState: trustByTrackId.get(track.id)?.state ?? 'unknown',
    trustScore: trustByTrackId.get(track.id)?.score ?? null,
    trustRationale: trustByTrackId.get(track.id)?.rationale ?? null,
    stagedRelativePath: manifestTrackById.get(track.id)?.stagedRelativePath ?? null,
  })),
  acceptance: {
    passed: baseSummary.failingExpectationCount === 0
      && validation.valid
      && validation.missingFiles.length === 0
      && validation.playlistReferenceErrors.length === 0
      && exportResult.trackCount === playlistTracks.length
      && nativeGaps.includes('export.pdb')
      && nativeGaps.some((item) => item.includes('ANLZ')),
  },
};

const reportJsonPath = path.join(reportsRoot, 'sandbox-v1-export-test-report.json');
const reportMdPath = path.join(reportsRoot, 'sandbox-v1-export-test-report.md');
await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(reportMdPath, renderMarkdown(report), 'utf8');

if (!report.acceptance.passed) {
  console.error(JSON.stringify({
    reportJsonPath,
    reportMdPath,
    acceptance: report.acceptance,
    validation,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  reportJsonPath,
  reportMdPath,
  exportRoot,
  targetPlaylist: targetPlaylist.name,
  exportedTrackCount: exportResult.trackCount,
  validationValid: validation.valid,
  nativeGaps,
}, null, 2));
