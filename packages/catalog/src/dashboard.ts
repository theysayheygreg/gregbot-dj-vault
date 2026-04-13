import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { getTrackRecencySummaries, type TrackRecencySummary } from './recency.js';

type PlaylistRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  item_count: number;
};

type DjSetRow = {
  id: string;
  name: string;
  track_count: number;
};

type TrackRow = {
  id: string;
  title: string;
  album: string | null;
  label: string | null;
  key_display: string | null;
  rating: number | null;
  play_count: number;
  last_played_at: string | null;
  added_at: string;
  duration_sec: number;
  bpm: number | null;
  bpm_float: number | null;
  sample_rate_hz: number | null;
  bitrate_kbps: number | null;
  size_bytes: number;
  comment: string | null;
};

type TrackPersonRow = {
  track_id: string;
  role: string;
  name: string;
};

type ExportTargetRow = {
  playlist_id: string;
  playlist_name: string;
  enabled: number;
  name: string | null;
  folder_path: string | null;
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

type ExportPlanRow = {
  id: string;
  target_kind: string;
  execution_node_id: string;
  source_storage_location_id: string | null;
  destination_storage_location_id: string | null;
  requires_remote_access: number;
  transport: string | null;
  status: string;
  note: string | null;
};

type NodeRow = {
  id: string;
  name: string;
  role: string;
  transport: string | null;
  address: string | null;
  is_online: number;
};

type StorageRow = {
  id: string;
  node_id: string;
  name: string;
  kind: string;
  mount_path: string | null;
  path_prefix: string | null;
  is_managed_library: number;
  is_available: number;
};

type SnapshotManifest = {
  pendingNativeArtifacts?: string[];
};

type SnapshotPdbPlan = {
  minimumTables?: string[];
  referenceCoveredTables?: string[];
  referenceGapTables?: string[];
  deferredTables?: string[];
};

type SnapshotPdbRowPlan = {
  coveredTables?: string[];
  deferredTables?: string[];
  warnings?: string[];
};

export type DashboardSnapshot = {
  generatedAt: string;
  summary: {
    trackCount: number;
    playlistCount: number;
    setCount: number;
    exportTargetCount: number;
    readyPlanCount: number;
    recentExportCount: number;
    hotTrackCount: number;
    trackWarningCount: number;
  };
  hero: {
    title: string;
    subtitle: string;
    focus: string;
  };
  tracks: Array<{
    id: string;
    title: string;
    artist: string | null;
    album: string | null;
    label: string | null;
    keyDisplay: string | null;
    bpm: number | null;
    durationSec: number;
    playCount: number;
    addedAt: string;
    lastPlayedAt: string | null;
    recencyBucket: TrackRecencySummary['recencyBucket'];
    mentalWeight: TrackRecencySummary['mentalWeight'];
    recencyScore: number;
    warnings: string[];
  }>;
  playlists: Array<{
    id: string;
    name: string;
    type: string;
    itemCount: number;
    hasDeviceTarget: boolean;
    deviceTargetName: string | null;
  }>;
  sets: Array<{
    id: string;
    name: string;
    trackCount: number;
  }>;
  exportTargets: Array<{
    playlistId: string;
    playlistName: string;
    name: string | null;
    enabled: boolean;
    folderPath: string | null;
    pendingNativeArtifacts: string[];
    referenceCoveredTables: string[];
    referenceGapTables: string[];
    rowPlanWarnings: string[];
  }>;
  exportPlans: Array<{
    id: string;
    playlistName: string | null;
    status: string;
    targetKind: string;
    executionNodeName: string;
    sourceStorageName: string | null;
    destinationStorageName: string | null;
    transport: string | null;
    requiresRemoteAccess: boolean;
    missingTrackIds: string[];
    savedTargetFolderPath: string | null;
  }>;
  topology: {
    nodes: Array<{
      id: string;
      name: string;
      role: string;
      transport: string | null;
      address: string | null;
      isOnline: boolean;
    }>;
    storages: Array<{
      id: string;
      nodeName: string;
      name: string;
      kind: string;
      isManagedLibrary: boolean;
      isAvailable: boolean;
      mountPath: string | null;
    }>;
  };
  recentExports: Array<{
    id: string;
    targetKind: string;
    targetPath: string | null;
    status: string;
    completedAt: string | null;
  }>;
  focusNotes: string[];
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

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    await access(filePath);
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function atomicWrite(outputPath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tmpPath, contents, 'utf8');
  await rename(tmpPath, outputPath);
}

function parseJsonNote(note: string | null): Record<string, unknown> {
  if (!note) {
    return {};
  }
  try {
    return JSON.parse(note) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

export async function exportDashboardSnapshot(databasePath: string, outputPath: string): Promise<DashboardSnapshot> {
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const counts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM tracks) AS track_count,
        (SELECT COUNT(*) FROM playlists) AS playlist_count,
        (SELECT COUNT(*) FROM dj_sets) AS set_count,
        (SELECT COUNT(*) FROM playlist_export_targets WHERE target_kind = 'rekordbox-device' AND enabled = 1) AS export_target_count,
        (SELECT COUNT(*) FROM export_execution_plans WHERE status = 'ready') AS ready_plan_count,
        (SELECT COUNT(*) FROM export_jobs WHERE completed_at IS NOT NULL) AS recent_export_count
    `).get() as {
      track_count: number;
      playlist_count: number;
      set_count: number;
      export_target_count: number;
      ready_plan_count: number;
      recent_export_count: number;
    };

    const tracks = database.prepare(`
      SELECT id, title, album, label, key_display, rating, play_count, last_played_at, added_at,
             duration_sec, bpm, bpm_float, sample_rate_hz, bitrate_kbps, size_bytes, comment
      FROM tracks
      ORDER BY title COLLATE NOCASE, id
    `).all() as TrackRow[];

    const people = database.prepare(`
      SELECT track_id, role, name
      FROM track_people
      ORDER BY track_id, role, position
    `).all() as TrackPersonRow[];

    const recencySummaries = getTrackRecencySummaries(databasePath, 1000);
    const recencyByTrackId = new Map(recencySummaries.map((summary) => [summary.trackId, summary]));

    const playlists = database.prepare(`
      SELECT playlists.id, playlists.name, playlists.type, playlists.parent_id, COUNT(playlist_items.track_id) AS item_count
      FROM playlists
      LEFT JOIN playlist_items ON playlist_items.playlist_id = playlists.id
      GROUP BY playlists.id
      ORDER BY playlists.name COLLATE NOCASE, playlists.id
    `).all() as PlaylistRow[];

    const djSets = database.prepare(`
      SELECT dj_sets.id, dj_sets.name, COUNT(set_tracks.track_id) AS track_count
      FROM dj_sets
      LEFT JOIN set_tracks ON set_tracks.dj_set_id = dj_sets.id
      GROUP BY dj_sets.id
      ORDER BY dj_sets.name COLLATE NOCASE, dj_sets.id
    `).all() as DjSetRow[];

    const exportTargets = database.prepare(`
      SELECT playlist_export_targets.playlist_id, playlists.name AS playlist_name,
             playlist_export_targets.enabled, playlist_export_targets.name, playlist_export_targets.folder_path
      FROM playlist_export_targets
      JOIN playlists ON playlists.id = playlist_export_targets.playlist_id
      WHERE playlist_export_targets.target_kind = 'rekordbox-device'
      ORDER BY playlists.name COLLATE NOCASE, playlist_export_targets.playlist_id
    `).all() as ExportTargetRow[];

    const exportJobs = database.prepare(`
      SELECT id, target_kind, target_path, status, started_at, completed_at, note
      FROM export_jobs
      ORDER BY started_at DESC
      LIMIT 12
    `).all() as ExportJobRow[];

    const exportPlans = database.prepare(`
      SELECT id, target_kind, execution_node_id, source_storage_location_id, destination_storage_location_id, requires_remote_access, transport, status, note
      FROM export_execution_plans
      ORDER BY created_at DESC
      LIMIT 12
    `).all() as ExportPlanRow[];

    const nodes = database.prepare(`
      SELECT id, name, role, transport, address, is_online
      FROM vault_nodes
      ORDER BY name COLLATE NOCASE, id
    `).all() as NodeRow[];

    const storages = database.prepare(`
      SELECT id, node_id, name, kind, mount_path, path_prefix, is_managed_library, is_available
      FROM storage_locations
      ORDER BY name COLLATE NOCASE, id
    `).all() as StorageRow[];

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const storageById = new Map(storages.map((storage) => [storage.id, storage]));
    const exportTargetByPlaylistId = new Map(exportTargets.map((target) => [target.playlist_id, target]));

    const targetArtifacts = await Promise.all(exportTargets.map(async (target) => {
      const folderPath = target.folder_path ? path.resolve(target.folder_path) : null;
      const manifest = folderPath
        ? await readJsonIfPresent<SnapshotManifest>(path.join(folderPath, 'PIONEER', 'rekordbox', 'dj-vault', 'device-export-manifest.json'))
        : null;
      const pdbPlan = folderPath
        ? await readJsonIfPresent<SnapshotPdbPlan>(path.join(folderPath, 'PIONEER', 'rekordbox', 'dj-vault', 'pdb-write-plan.json'))
        : null;
      const rowPlan = folderPath
        ? await readJsonIfPresent<SnapshotPdbRowPlan>(path.join(folderPath, 'PIONEER', 'rekordbox', 'dj-vault', 'pdb-row-plan.json'))
        : null;

      return [target.playlist_id, {
        pendingNativeArtifacts: manifest?.pendingNativeArtifacts ?? [],
        referenceCoveredTables: pdbPlan?.referenceCoveredTables ?? [],
        referenceGapTables: pdbPlan?.referenceGapTables ?? [],
        rowPlanWarnings: rowPlan?.warnings ?? [],
      }] as const;
    }));
    const artifactsByPlaylistId = new Map(targetArtifacts);

    const trackCards = tracks.map((track) => {
      const recency = recencyByTrackId.get(track.id);
      const artist = joinArtists(people, track.id);
      const warnings = uniqueSorted([
        !artist ? 'Missing artist' : null,
        !track.duration_sec ? 'No duration analysis' : null,
        !track.sample_rate_hz ? 'No sample-rate analysis' : null,
        !track.bitrate_kbps ? 'No bitrate analysis' : null,
        !(track.bpm ?? track.bpm_float) ? 'No BPM analysis' : null,
      ]);

      return {
        id: track.id,
        title: track.title,
        artist,
        album: normalizeText(track.album),
        label: normalizeText(track.label),
        keyDisplay: normalizeText(track.key_display),
        bpm: track.bpm ?? track.bpm_float,
        durationSec: Math.max(0, Math.round(track.duration_sec ?? 0)),
        playCount: track.play_count,
        addedAt: track.added_at,
        lastPlayedAt: track.last_played_at,
        recencyBucket: recency?.recencyBucket ?? 'never-played',
        mentalWeight: recency?.mentalWeight ?? 'unknown',
        recencyScore: recency?.recencyScore ?? 0,
        warnings,
      };
    }).sort((a, b) => b.recencyScore - a.recencyScore || a.title.localeCompare(b.title));

    const playlistCards = playlists.map((playlist) => {
      const target = exportTargetByPlaylistId.get(playlist.id);
      return {
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
        itemCount: playlist.item_count,
        hasDeviceTarget: Boolean(target?.enabled),
        deviceTargetName: target?.name ?? null,
      };
    });

    const targetCards = exportTargets.map((target) => {
      const artifacts = artifactsByPlaylistId.get(target.playlist_id);
      return {
        playlistId: target.playlist_id,
        playlistName: target.playlist_name,
        name: target.name,
        enabled: Boolean(target.enabled),
        folderPath: target.folder_path,
        pendingNativeArtifacts: artifacts?.pendingNativeArtifacts ?? [],
        referenceCoveredTables: artifacts?.referenceCoveredTables ?? [],
        referenceGapTables: artifacts?.referenceGapTables ?? [],
        rowPlanWarnings: artifacts?.rowPlanWarnings ?? [],
      };
    });

    const planCards = exportPlans.map((plan) => {
      const note = parseJsonNote(plan.note);
      const executionNode = nodeById.get(plan.execution_node_id);
      const sourceStorage = plan.source_storage_location_id ? storageById.get(plan.source_storage_location_id) : null;
      const destinationStorage = plan.destination_storage_location_id ? storageById.get(plan.destination_storage_location_id) : null;
      return {
        id: plan.id,
        playlistName: typeof note.playlistName === 'string' ? note.playlistName : null,
        status: plan.status,
        targetKind: plan.target_kind,
        executionNodeName: executionNode?.name ?? plan.execution_node_id,
        sourceStorageName: sourceStorage?.name ?? null,
        destinationStorageName: destinationStorage?.name ?? null,
        transport: plan.transport,
        requiresRemoteAccess: Boolean(plan.requires_remote_access),
        missingTrackIds: Array.isArray(note.missingTrackIds) ? note.missingTrackIds.filter((value): value is string => typeof value === 'string') : [],
        savedTargetFolderPath: typeof note.savedTargetFolderPath === 'string' ? note.savedTargetFolderPath : null,
      };
    });

    const topology = {
      nodes: nodes.map((node) => ({
        id: node.id,
        name: node.name,
        role: node.role,
        transport: node.transport,
        address: node.address,
        isOnline: Boolean(node.is_online),
      })),
      storages: storages.map((storage) => ({
        id: storage.id,
        nodeName: nodeById.get(storage.node_id)?.name ?? storage.node_id,
        name: storage.name,
        kind: storage.kind,
        isManagedLibrary: Boolean(storage.is_managed_library),
        isAvailable: Boolean(storage.is_available),
        mountPath: storage.mount_path ?? storage.path_prefix,
      })),
    };

    const recentExports = exportJobs.map((job) => ({
      id: job.id,
      targetKind: job.target_kind,
      targetPath: job.target_path,
      status: job.status,
      completedAt: job.completed_at,
    }));

    const focusNotes = uniqueSorted([
      counts.export_target_count > 0 ? `${counts.export_target_count} saved Rekordbox device target${counts.export_target_count === 1 ? '' : 's'} ready for testing` : null,
      targetCards.some((target) => target.referenceGapTables.length > 0) ? 'Playlist and column PDB tables still need stronger reference coverage before native writing' : null,
      trackCards.some((track) => track.warnings.length > 0) ? 'Catalog still has metadata and analysis gaps that show up in native export planning' : null,
      planCards.some((plan) => plan.requiresRemoteAccess) ? 'Remote export planning is live: source media and USB execution can live on different nodes' : null,
    ]);

    const snapshot: DashboardSnapshot = {
      generatedAt: new Date().toISOString(),
      summary: {
        trackCount: counts.track_count,
        playlistCount: counts.playlist_count,
        setCount: counts.set_count,
        exportTargetCount: counts.export_target_count,
        readyPlanCount: counts.ready_plan_count,
        recentExportCount: counts.recent_export_count,
        hotTrackCount: trackCards.filter((track) => track.recencyBucket === 'hot').length,
        trackWarningCount: trackCards.reduce((sum, track) => sum + track.warnings.length, 0),
      },
      hero: {
        title: 'VaultBuddy',
        subtitle: 'Catalog truth, remote export planning, and old-device Rekordbox workflow in one place.',
        focus: 'Current testing focus: NXS2-era USB/device export, not flagship-only hardware.',
      },
      tracks: trackCards,
      playlists: playlistCards,
      sets: djSets.map((djSet) => ({
        id: djSet.id,
        name: djSet.name,
        trackCount: djSet.track_count,
      })),
      exportTargets: targetCards,
      exportPlans: planCards,
      topology,
      recentExports,
      focusNotes,
    };

    await atomicWrite(path.resolve(outputPath), `${JSON.stringify(snapshot, null, 2)}\n`);
    return snapshot;
  } finally {
    database.close();
  }
}
