import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type RegisterVaultNodeInput = {
  name: string;
  role: 'catalog-primary' | 'media-host' | 'export-worker' | 'hybrid';
  machineLabel?: string | null;
  transport?: 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual' | null;
  address?: string | null;
  isOnline?: boolean;
  notes?: string | null;
};

export type RegisterStorageLocationInput = {
  nodeId: string;
  name: string;
  kind: 'local-disk' | 'external-drive' | 'network-share' | 'nas' | 'cloud-mirror';
  mountPath?: string | null;
  pathPrefix?: string | null;
  isManagedLibrary?: boolean;
  isAvailable?: boolean;
  notes?: string | null;
};

export type RecordTrackResidencyInput = {
  trackRef: string;
  storageLocationId: string;
  residencyKind: 'canonical' | 'replica' | 'cache' | 'export-staging';
  relativePath: string;
  status: 'ready' | 'missing' | 'offline' | 'pending-sync';
  note?: string | null;
};

export type PlanExportExecutionInput = {
  exportJobId?: string | null;
  targetKind: 'usb-device' | 'filesystem-folder' | 'network-drop' | 'remote-worker';
  executionNodeId: string;
  sourceStorageLocationId?: string | null;
  destinationStorageLocationId?: string | null;
  requiresRemoteAccess: boolean;
  transport?: 'local' | 'tailscale' | 'ssh' | 'sneakernet' | null;
  status?: 'planned' | 'ready' | 'running' | 'completed' | 'failed';
  note?: string | null;
};

type TrackMatch = {
  id: string;
  title: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function resolveTrack(database: DatabaseSync, trackRef: string): TrackMatch {
  const ref = requireNonEmpty(trackRef, 'trackRef');
  const matches = database.prepare(`
    SELECT id, title
    FROM tracks
    WHERE id = ?
       OR hash_sha256 = ?
       OR content_hash_sha256 = ?
       OR lower(title) = lower(?)
       OR lower(file_name) = lower(?)
    ORDER BY title COLLATE NOCASE, id
  `).all(ref, ref, ref, ref, ref) as TrackMatch[];

  if (matches.length === 0) {
    throw new Error(`No track matched "${ref}".`);
  }

  if (matches.length > 1) {
    throw new Error(`Track reference "${ref}" is ambiguous.`);
  }

  return matches[0];
}

export function registerVaultNode(databasePath: string, input: RegisterVaultNodeInput): { id: string; name: string } {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const timestamp = nowIso();
  const name = requireNonEmpty(input.name, 'node name');

  try {
    database.prepare(`
      INSERT INTO vault_nodes (
        id, name, role, machine_label, transport, address, is_online, last_seen_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      input.role,
      input.machineLabel ?? null,
      input.transport ?? null,
      input.address ?? null,
      input.isOnline ? 1 : 0,
      input.isOnline ? timestamp : null,
      input.notes ?? null,
      timestamp,
      timestamp,
    );

    return { id, name };
  } finally {
    database.close();
  }
}

export function registerStorageLocation(databasePath: string, input: RegisterStorageLocationInput): { id: string; name: string } {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const timestamp = nowIso();
  const name = requireNonEmpty(input.name, 'storage location name');

  try {
    const node = database.prepare(`SELECT id FROM vault_nodes WHERE id = ?`).get(input.nodeId) as { id: string } | undefined;
    if (!node) {
      throw new Error(`Vault node ${input.nodeId} not found.`);
    }

    database.prepare(`
      INSERT INTO storage_locations (
        id, node_id, name, kind, mount_path, path_prefix, is_managed_library, is_available, last_verified_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.nodeId,
      name,
      input.kind,
      input.mountPath ?? null,
      input.pathPrefix ?? null,
      input.isManagedLibrary ? 1 : 0,
      input.isAvailable ? 1 : 0,
      input.isAvailable ? timestamp : null,
      input.notes ?? null,
      timestamp,
      timestamp,
    );

    return { id, name };
  } finally {
    database.close();
  }
}

export function recordTrackResidency(databasePath: string, input: RecordTrackResidencyInput): { trackId: string; storageLocationId: string } {
  const database = new DatabaseSync(databasePath);
  const timestamp = nowIso();

  try {
    const track = resolveTrack(database, input.trackRef);
    const storage = database.prepare(`SELECT id FROM storage_locations WHERE id = ?`).get(input.storageLocationId) as { id: string } | undefined;
    if (!storage) {
      throw new Error(`Storage location ${input.storageLocationId} not found.`);
    }

    database.prepare(`
      INSERT INTO track_residencies (
        track_id, storage_location_id, residency_kind, relative_path, status, verified_at, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(track_id, storage_location_id, residency_kind)
      DO UPDATE SET
        relative_path = excluded.relative_path,
        status = excluded.status,
        verified_at = excluded.verified_at,
        note = excluded.note
    `).run(
      track.id,
      input.storageLocationId,
      input.residencyKind,
      requireNonEmpty(input.relativePath, 'relative path'),
      input.status,
      timestamp,
      input.note ?? null,
    );

    return { trackId: track.id, storageLocationId: input.storageLocationId };
  } finally {
    database.close();
  }
}

export function planExportExecution(databasePath: string, input: PlanExportExecutionInput): { id: string; executionNodeId: string } {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const timestamp = nowIso();

  try {
    const node = database.prepare(`SELECT id FROM vault_nodes WHERE id = ?`).get(input.executionNodeId) as { id: string } | undefined;
    if (!node) {
      throw new Error(`Vault node ${input.executionNodeId} not found.`);
    }

    database.prepare(`
      INSERT INTO export_execution_plans (
        id, export_job_id, target_kind, execution_node_id, source_storage_location_id,
        destination_storage_location_id, requires_remote_access, transport, status, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.exportJobId ?? null,
      input.targetKind,
      input.executionNodeId,
      input.sourceStorageLocationId ?? null,
      input.destinationStorageLocationId ?? null,
      input.requiresRemoteAccess ? 1 : 0,
      input.transport ?? null,
      input.status ?? 'planned',
      input.note ?? null,
      timestamp,
      timestamp,
    );

    return { id, executionNodeId: input.executionNodeId };
  } finally {
    database.close();
  }
}
