export type DesignPillar = {
  id: string;
  name: string;
  summary: string;
};

export type VaultNodeRole = 'catalog-primary' | 'media-host' | 'export-worker' | 'hybrid';

export type StorageKind = 'local-disk' | 'external-drive' | 'network-share' | 'nas' | 'cloud-mirror';

export type ExportTargetKind = 'usb-device' | 'filesystem-folder' | 'network-drop' | 'remote-worker';

export type VaultNode = {
  id: string;
  name: string;
  role: VaultNodeRole;
  machineLabel?: string;
  transport?: 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual';
  address?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  notes?: string;
};

export type StorageLocation = {
  id: string;
  nodeId: string;
  name: string;
  kind: StorageKind;
  mountPath?: string;
  pathPrefix?: string;
  isManagedLibrary?: boolean;
  isAvailable?: boolean;
  lastVerifiedAt?: string;
  notes?: string;
};

export type TrackResidency = {
  trackId: string;
  storageLocationId: string;
  residencyKind: 'canonical' | 'replica' | 'cache' | 'export-staging';
  relativePath: string;
  status: 'ready' | 'missing' | 'offline' | 'pending-sync';
  verifiedAt?: string;
};

export type ExportExecutionPlan = {
  id: string;
  exportJobId?: string;
  targetKind: ExportTargetKind;
  executionNodeId: string;
  sourceStorageLocationId?: string;
  destinationStorageLocationId?: string;
  requiresRemoteAccess: boolean;
  transport?: 'local' | 'tailscale' | 'ssh' | 'sneakernet';
  status: 'planned' | 'ready' | 'running' | 'completed' | 'failed';
  note?: string;
};

export const designPillars: DesignPillar[] = [
  {
    id: 'single-source-of-truth',
    name: 'Single Source of Truth',
    summary: 'DJ Vault is canonical. Other tools and devices are compiled views.',
  },
  {
    id: 'physical-files-only',
    name: 'Physical Files Only',
    summary: 'The managed library must hold concrete files, not cloud indirection.',
  },
  {
    id: 'metadata-provenance',
    name: 'Metadata Provenance',
    summary: 'Every important field should carry source, confidence, and time context.',
  },
  {
    id: 'export-is-compilation',
    name: 'Export Is Compilation',
    summary: 'Export should be deterministic, inspectable, and idempotent.',
  },
  {
    id: 'sets-are-not-playlists',
    name: 'Sets Are Not Playlists',
    summary: 'Buckets and performance sequences are separate concepts with different needs.',
  },
  {
    id: 'club-reality-matters',
    name: 'Club Reality Matters',
    summary: 'The system should model how gear, settings, and library choices behave in practice.',
  },
  {
    id: 'topology-matters',
    name: 'Topology Matters',
    summary: 'Catalog state, media residency, and export execution can live on different machines and still need one coherent plan.',
  },
];
