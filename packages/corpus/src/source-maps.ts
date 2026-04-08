export type SourceSurface = {
  name: string;
  url: string;
  kind: string;
  notes: string;
};

export type SourceMap = {
  vendor: string;
  snapshotDate: string;
  surfaces: SourceSurface[];
};
