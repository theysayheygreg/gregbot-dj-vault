export type DesignPillar = {
  id: string;
  name: string;
  summary: string;
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
];
