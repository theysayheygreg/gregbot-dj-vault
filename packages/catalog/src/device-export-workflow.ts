import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { exportRekordboxDevice, type RekordboxDeviceExportResult } from './rekordbox-device-export.js';
import { planExportExecution } from './topology.js';

type PlaylistRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type PlaylistItemRow = {
  playlist_id: string;
  track_id: string;
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

type ResidencyRow = {
  track_id: string;
  storage_location_id: string;
  residency_kind: 'canonical' | 'replica' | 'cache' | 'export-staging';
  relative_path: string;
  status: 'ready' | 'missing' | 'offline' | 'pending-sync';
};

type SavedTargetRow = {
  playlist_id: string;
  target_kind: string;
  enabled: number;
  name: string | null;
  folder_path: string | null;
};

type SourceCandidate = {
  storage: StorageRow;
  coverageCount: number;
  totalTracks: number;
  score: number;
  nodeLocalToExecution: boolean;
  missingTrackIds: string[];
};

export type SavePlaylistExportTargetInput = {
  playlistRef: string;
  name?: string | null;
  folderPath: string;
  enabled?: boolean;
};

export type SavePlaylistExportTargetResult = {
  playlistId: string;
  targetKind: 'rekordbox-device';
  name: string | null;
  folderPath: string;
  enabled: boolean;
};

export type PlanRekordboxDeviceExportInput = {
  playlistRef: string;
  executionNodeRef: string;
  destinationStorageRef?: string | null;
  sourceStorageRef?: string | null;
  transport?: 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual' | 'sneakernet' | null;
  note?: string | null;
};

export type PlanRekordboxDeviceExportResult = {
  planId: string;
  playlistId: string;
  executionNodeId: string;
  executionNodeName: string;
  destinationStorageLocationId: string | null;
  destinationStorageName: string | null;
  sourceStorageLocationId: string | null;
  sourceStorageName: string | null;
  requiresRemoteAccess: boolean;
  transport: string | null;
  trackCount: number;
  sourceCoverageCount: number;
  missingTrackIds: string[];
  savedTargetFolderPath: string | null;
};

export type ValidateRekordboxDeviceExportResult = {
  exportRoot: string;
  manifestPath: string;
  collectionXmlPath: string;
  playlistCount: number;
  trackCount: number;
  missingFiles: string[];
  playlistReferenceErrors: string[];
  warnings: string[];
  valid: boolean;
};

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function resolvePlaylist(database: DatabaseSync, playlistRef: string): PlaylistRow {
  const ref = requireNonEmpty(playlistRef, 'playlistRef');
  const matches = database.prepare(`
    SELECT id, name, type, parent_id
    FROM playlists
    WHERE id = ?
       OR lower(name) = lower(?)
    ORDER BY name COLLATE NOCASE, id
  `).all(ref, ref) as PlaylistRow[];

  if (matches.length === 0) {
    throw new Error(`No playlist matched "${ref}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Playlist reference "${ref}" is ambiguous.`);
  }
  return matches[0];
}

function resolveNode(database: DatabaseSync, nodeRef: string): NodeRow {
  const ref = requireNonEmpty(nodeRef, 'executionNodeRef');
  const matches = database.prepare(`
    SELECT id, name, role, transport, address, is_online
    FROM vault_nodes
    WHERE id = ?
       OR lower(name) = lower(?)
    ORDER BY name COLLATE NOCASE, id
  `).all(ref, ref) as NodeRow[];

  if (matches.length === 0) {
    throw new Error(`No vault node matched "${ref}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Vault node reference "${ref}" is ambiguous.`);
  }
  return matches[0];
}

function resolveStorage(database: DatabaseSync, storageRef: string): StorageRow {
  const ref = requireNonEmpty(storageRef, 'storageRef');
  const matches = database.prepare(`
    SELECT id, node_id, name, kind, mount_path, path_prefix, is_managed_library, is_available
    FROM storage_locations
    WHERE id = ?
       OR lower(name) = lower(?)
    ORDER BY name COLLATE NOCASE, id
  `).all(ref, ref) as StorageRow[];

  if (matches.length === 0) {
    throw new Error(`No storage location matched "${ref}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Storage location reference "${ref}" is ambiguous.`);
  }
  return matches[0];
}

function collectPlaylistScope(allPlaylists: PlaylistRow[], rootPlaylistId: string): string[] {
  const childIdsByParent = new Map<string | null, string[]>();
  for (const playlist of allPlaylists) {
    const bucket = childIdsByParent.get(playlist.parent_id) ?? [];
    bucket.push(playlist.id);
    childIdsByParent.set(playlist.parent_id, bucket);
  }

  const scope = new Set<string>();
  const stack = [rootPlaylistId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || scope.has(current)) {
      continue;
    }
    scope.add(current);
    for (const child of childIdsByParent.get(current) ?? []) {
      stack.push(child);
    }
  }
  return [...scope];
}

function inferDestinationStorageFromFolder(storages: StorageRow[], folderPath: string | null | undefined): StorageRow | null {
  if (!folderPath) {
    return null;
  }
  const absoluteFolder = path.resolve(folderPath);
  return storages.find((storage) => {
    const roots = [storage.mount_path, storage.path_prefix].filter(Boolean) as string[];
    return roots.some((root) => absoluteFolder.startsWith(path.resolve(root)));
  }) ?? null;
}

function residencyKindScore(kind: ResidencyRow['residency_kind']): number {
  return kind === 'canonical' ? 4 : kind === 'replica' ? 3 : kind === 'cache' ? 2 : 1;
}

function chooseBestSourceCandidate(
  storages: StorageRow[],
  residencies: ResidencyRow[],
  trackIds: string[],
  executionNodeId: string,
): SourceCandidate | null {
  if (trackIds.length === 0) {
    return null;
  }

  const residencyBuckets = new Map<string, ResidencyRow[]>();
  for (const residency of residencies) {
    if (residency.status !== 'ready') {
      continue;
    }
    const bucket = residencyBuckets.get(residency.storage_location_id) ?? [];
    bucket.push(residency);
    residencyBuckets.set(residency.storage_location_id, bucket);
  }

  const candidates: SourceCandidate[] = storages.map((storage) => {
    const rows = residencyBuckets.get(storage.id) ?? [];
    const coveredTrackIds = new Set(rows.map((row) => row.track_id));
    const missingTrackIds = trackIds.filter((trackId) => !coveredTrackIds.has(trackId));
    const score = rows.reduce((sum, row) => sum + residencyKindScore(row.residency_kind), 0)
      + (storage.is_available ? 2 : 0)
      + (storage.node_id === executionNodeId ? 3 : 0);

    return {
      storage,
      coverageCount: coveredTrackIds.size,
      totalTracks: trackIds.length,
      score,
      nodeLocalToExecution: storage.node_id === executionNodeId,
      missingTrackIds,
    };
  });

  candidates.sort((a, b) =>
    b.coverageCount - a.coverageCount ||
    b.score - a.score ||
    Number(b.nodeLocalToExecution) - Number(a.nodeLocalToExecution) ||
    a.storage.name.localeCompare(b.storage.name) ||
    a.storage.id.localeCompare(b.storage.id),
  );

  return candidates[0] ?? null;
}

export function saveRekordboxDeviceTarget(databasePath: string, input: SavePlaylistExportTargetInput): SavePlaylistExportTargetResult {
  const database = new DatabaseSync(databasePath);
  const timestamp = new Date().toISOString();
  try {
    const playlist = resolvePlaylist(database, input.playlistRef);
    const folderPath = path.resolve(requireNonEmpty(input.folderPath, 'folderPath'));
    database.prepare(`
      INSERT INTO playlist_export_targets (playlist_id, target_kind, enabled, name, folder_path)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(playlist_id, target_kind)
      DO UPDATE SET
        enabled = excluded.enabled,
        name = excluded.name,
        folder_path = excluded.folder_path
    `).run(
      playlist.id,
      'rekordbox-device',
      input.enabled === false ? 0 : 1,
      input.name ?? null,
      folderPath,
    );

    database.prepare(`
      INSERT INTO metadata_provenance (entity_kind, entity_id, field_path, source_kind, source_name, source_ref, confidence, observed_at, value_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'playlist',
      playlist.id,
      'exportTargets.rekordboxDevice',
      'dj-vault',
      'dj-vault',
      null,
      1,
      timestamp,
      JSON.stringify({
        name: input.name ?? null,
        folderPath,
        enabled: input.enabled === false ? false : true,
      }),
    );

    return {
      playlistId: playlist.id,
      targetKind: 'rekordbox-device',
      name: input.name ?? null,
      folderPath,
      enabled: input.enabled === false ? false : true,
    };
  } finally {
    database.close();
  }
}

export function planRekordboxDeviceExport(databasePath: string, input: PlanRekordboxDeviceExportInput): PlanRekordboxDeviceExportResult {
  const database = new DatabaseSync(databasePath);
  try {
    const playlist = resolvePlaylist(database, input.playlistRef);
    const executionNode = resolveNode(database, input.executionNodeRef);
    const allPlaylists = database.prepare(`SELECT id, name, type, parent_id FROM playlists`).all() as PlaylistRow[];
    const playlistScope = collectPlaylistScope(allPlaylists, playlist.id);
    const playlistItems = database.prepare(`
      SELECT playlist_id, track_id
      FROM playlist_items
      WHERE playlist_id IN (${playlistScope.map(() => '?').join(',')})
    `).all(...playlistScope) as PlaylistItemRow[];
    const trackIds = [...new Set(playlistItems.map((item) => item.track_id))];

    const storages = database.prepare(`
      SELECT id, node_id, name, kind, mount_path, path_prefix, is_managed_library, is_available
      FROM storage_locations
      ORDER BY name COLLATE NOCASE, id
    `).all() as StorageRow[];

    const savedTarget = database.prepare(`
      SELECT playlist_id, target_kind, enabled, name, folder_path
      FROM playlist_export_targets
      WHERE playlist_id = ? AND target_kind = 'rekordbox-device'
    `).get(playlist.id) as SavedTargetRow | undefined;

    const destinationStorage = input.destinationStorageRef
      ? resolveStorage(database, input.destinationStorageRef)
      : inferDestinationStorageFromFolder(storages, savedTarget?.folder_path ?? null);

    const residencies = trackIds.length > 0
      ? database.prepare(`
        SELECT track_id, storage_location_id, residency_kind, relative_path, status
        FROM track_residencies
        WHERE track_id IN (${trackIds.map(() => '?').join(',')})
      `).all(...trackIds) as ResidencyRow[]
      : [];

    const chosenSource = input.sourceStorageRef
      ? (() => {
          const storage = resolveStorage(database, input.sourceStorageRef);
          const covered = residencies.filter((row) => row.storage_location_id === storage.id && row.status === 'ready');
          const coveredIds = new Set(covered.map((row) => row.track_id));
          return {
            storage,
            coverageCount: coveredIds.size,
            totalTracks: trackIds.length,
            score: covered.reduce((sum, row) => sum + residencyKindScore(row.residency_kind), 0),
            nodeLocalToExecution: storage.node_id === executionNode.id,
            missingTrackIds: trackIds.filter((trackId) => !coveredIds.has(trackId)),
          } satisfies SourceCandidate;
        })()
      : chooseBestSourceCandidate(storages, residencies, trackIds, executionNode.id);

    const sourceNode = chosenSource ? resolveNode(database, chosenSource.storage.node_id) : null;
    const destinationNode = destinationStorage ? resolveNode(database, destinationStorage.node_id) : null;

    const requiresRemoteAccess = Boolean(
      (chosenSource && chosenSource.storage.node_id !== executionNode.id) ||
      (destinationStorage && destinationStorage.node_id !== executionNode.id),
    );

    const transport = input.transport
      ?? (!requiresRemoteAccess
        ? 'local'
        : executionNode.transport
          ?? sourceNode?.transport
          ?? destinationNode?.transport
          ?? 'manual');

    const notePayload = {
      playlistId: playlist.id,
      playlistName: playlist.name,
      savedTargetFolderPath: savedTarget?.folder_path ?? null,
      sourceCoverageCount: chosenSource?.coverageCount ?? 0,
      trackCount: trackIds.length,
      missingTrackIds: chosenSource?.missingTrackIds ?? trackIds,
      plannerNote: input.note ?? null,
    };

    const plan = planExportExecution(databasePath, {
      targetKind: 'usb-device',
      executionNodeId: executionNode.id,
      sourceStorageLocationId: chosenSource?.storage.id ?? null,
      destinationStorageLocationId: destinationStorage?.id ?? null,
      requiresRemoteAccess,
      transport: transport as 'local' | 'tailscale' | 'ssh' | 'sneakernet' | null,
      status: chosenSource && chosenSource.missingTrackIds.length === 0 ? 'ready' : 'planned',
      note: JSON.stringify(notePayload),
    });

    return {
      planId: plan.id,
      playlistId: playlist.id,
      executionNodeId: executionNode.id,
      executionNodeName: executionNode.name,
      destinationStorageLocationId: destinationStorage?.id ?? null,
      destinationStorageName: destinationStorage?.name ?? null,
      sourceStorageLocationId: chosenSource?.storage.id ?? null,
      sourceStorageName: chosenSource?.storage.name ?? null,
      requiresRemoteAccess,
      transport,
      trackCount: trackIds.length,
      sourceCoverageCount: chosenSource?.coverageCount ?? 0,
      missingTrackIds: chosenSource?.missingTrackIds ?? trackIds,
      savedTargetFolderPath: savedTarget?.folder_path ?? null,
    };
  } finally {
    database.close();
  }
}

export async function exportRekordboxDeviceToSavedTarget(databasePath: string, playlistRef: string): Promise<RekordboxDeviceExportResult> {
  const database = new DatabaseSync(databasePath);
  try {
    const playlist = resolvePlaylist(database, playlistRef);
    const savedTarget = database.prepare(`
      SELECT playlist_id, target_kind, enabled, name, folder_path
      FROM playlist_export_targets
      WHERE playlist_id = ? AND target_kind = 'rekordbox-device'
    `).get(playlist.id) as SavedTargetRow | undefined;

    if (!savedTarget || !savedTarget.enabled || !savedTarget.folder_path) {
      throw new Error(`Playlist "${playlist.name}" does not have an enabled rekordbox-device target.`);
    }

    return await exportRekordboxDevice(databasePath, savedTarget.folder_path, [playlist.id]);
  } finally {
    database.close();
  }
}

export async function validateRekordboxDeviceExport(exportRoot: string): Promise<ValidateRekordboxDeviceExportResult> {
  const absoluteRoot = path.resolve(exportRoot);
  const manifestPath = path.join(absoluteRoot, 'PIONEER', 'rekordbox', 'dj-vault', 'device-export-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    collectionXmlPath: string;
    playlistCount: number;
    trackCount: number;
    pendingNativeArtifacts?: string[];
    playlists: Array<{ name: string; m3uRelativePath: string | null; entries: Array<{ stagedRelativePath: string }> }>;
    tracks: Array<{ stagedRelativePath: string; stagedFileUri: string; rekordboxTrackId: string }>;
  };

  const collectionXmlPath = path.join(absoluteRoot, manifest.collectionXmlPath);
  const collectionXml = await readFile(collectionXmlPath, 'utf8');
  const missingFiles: string[] = [];
  const playlistReferenceErrors: string[] = [];
  const warnings: string[] = [];

  for (const track of manifest.tracks) {
    const absoluteTrackPath = path.join(absoluteRoot, track.stagedRelativePath);
    try {
      await access(absoluteTrackPath);
    } catch {
      missingFiles.push(track.stagedRelativePath);
    }
    if (!collectionXml.includes(`TrackID="${track.rekordboxTrackId}"`)) {
      playlistReferenceErrors.push(`Collection XML is missing TrackID ${track.rekordboxTrackId}.`);
    }
    if (!collectionXml.includes(track.stagedFileUri)) {
      playlistReferenceErrors.push(`Collection XML is missing staged URI for ${track.stagedRelativePath}.`);
    }
  }

  for (const playlist of manifest.playlists) {
    if (!playlist.m3uRelativePath) {
      continue;
    }
    const absoluteM3uPath = path.join(absoluteRoot, playlist.m3uRelativePath);
    try {
      await access(absoluteM3uPath);
    } catch {
      missingFiles.push(playlist.m3uRelativePath);
      continue;
    }
    const contents = await readFile(absoluteM3uPath, 'utf8');
    for (const entry of playlist.entries) {
      const absoluteTrackPath = path.join(absoluteRoot, entry.stagedRelativePath);
      const expectedRelative = path.relative(path.dirname(absoluteM3uPath), absoluteTrackPath).split(path.sep).join('/');
      if (!contents.split(/\r?\n/).includes(expectedRelative)) {
        playlistReferenceErrors.push(`Playlist "${playlist.name}" is missing ${expectedRelative}.`);
      }
    }
  }

  if ((manifest.pendingNativeArtifacts ?? []).length > 0) {
    warnings.push(`Pending native artifacts: ${(manifest.pendingNativeArtifacts ?? []).join(', ')}`);
  }

  return {
    exportRoot: absoluteRoot,
    manifestPath,
    collectionXmlPath,
    playlistCount: manifest.playlistCount,
    trackCount: manifest.trackCount,
    missingFiles,
    playlistReferenceErrors,
    warnings,
    valid: missingFiles.length === 0 && playlistReferenceErrors.length === 0,
  };
}
