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
    libraryTrust: {
      trustedTrackCount: number;
      chosenTrackCount: number;
      needsAttentionTrackCount: number;
      blockedTrackCount: number;
    };
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
    rating: number | null;
    comment: string | null;
    playCount: number;
    addedAt: string;
    lastPlayedAt: string | null;
    recencyBucket: 'new' | 'hot' | 'cooling' | 'dormant' | 'never-played';
    mentalWeight: 'front-of-mind' | 'active-option' | 'archive-pressure' | 'unknown';
    recencyScore: number;
    warnings: string[];
    trustState: 'trusted' | 'chosen' | 'needs-attention' | 'blocked';
    trustScore: number;
    trustRationale: string;
    trustReasons: string[];
    sourceOpinionCount: number;
    mergeChangedFields: string[];
  }>;
  playlists: Array<{
    id: string;
    name: string;
    type: string;
    itemCount: number;
    hasDeviceTarget: boolean;
    deviceTargetName: string | null;
    entries: Array<{
      trackId: string;
      title: string;
      artist: string | null;
      position: number;
      durationSec: number;
    }>;
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
