import { startTransition, useDeferredValue, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

import bundledDashboardJson from './generated/catalog-dashboard.json';
import type { DashboardSnapshot } from './dashboard-types';

type TrackItem = DashboardSnapshot['tracks'][number];
type PlaylistItem = DashboardSnapshot['playlists'][number];
type SetItem = DashboardSnapshot['sets'][number];
type ExportTargetItem = DashboardSnapshot['exportTargets'][number];
type ExportPlanItem = DashboardSnapshot['exportPlans'][number];
type NodeItem = DashboardSnapshot['topology']['nodes'][number];
type StorageItem = DashboardSnapshot['topology']['storages'][number];
type ExportJobItem = DashboardSnapshot['recentExports'][number];

type ActiveView = 'library' | 'playlists' | 'exports' | 'topology';
type SmartCollection = 'all' | 'hot' | 'cooling' | 'dormant' | 'needs-ears' | 'warnings';
type TrackSortKey = 'title' | 'artist' | 'trust' | 'recency' | 'bpm' | 'duration' | 'warnings';
type SortDirection = 'asc' | 'desc';
type InspectorTab = 'overview' | 'metadata' | 'readiness' | 'sets' | 'target' | 'native' | 'plans' | 'storage' | 'activity';
type ConnectionMode = 'bundled' | 'live';

type MutationResponse<T> = {
  ok: true;
  result: T;
  snapshot: DashboardSnapshot;
};

const bundledDashboard = bundledDashboardJson as DashboardSnapshot;

const smartCollectionLabels: Record<SmartCollection, string> = {
  all: 'All Tracks',
  hot: 'Hot Right Now',
  cooling: 'Cooling Off',
  dormant: 'Dormant',
  'needs-ears': 'Needs Ears',
  warnings: 'Needs Attention',
};

const recencyOrder: Record<TrackItem['recencyBucket'], number> = {
  hot: 0,
  new: 1,
  cooling: 2,
  dormant: 3,
  'never-played': 4,
};

const trustOrder: Record<TrackItem['trustState'], number> = {
  blocked: 0,
  'needs-attention': 1,
  chosen: 2,
  trusted: 3,
};

const trustLabels: Record<TrackItem['trustState'], string> = {
  trusted: 'Settled',
  chosen: 'Chosen',
  'needs-attention': 'Needs Ears',
  blocked: 'Blocked',
};

function defaultInspectorTab(view: ActiveView): InspectorTab {
  switch (view) {
    case 'library':
      return 'overview';
    case 'playlists':
      return 'target';
    case 'exports':
      return 'native';
    case 'topology':
      return 'storage';
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function matchesQuery(values: Array<string | null | undefined>, query: string): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => value?.toLowerCase().includes(query));
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
}

function compareNumber(a: number | null | undefined, b: number | null | undefined): number {
  return (a ?? -1) - (b ?? -1);
}

function compareTracks(a: TrackItem, b: TrackItem, key: TrackSortKey, direction: SortDirection): number {
  let result = 0;
  switch (key) {
    case 'title':
      result = compareText(a.title, b.title);
      break;
    case 'artist':
      result = compareText(a.artist, b.artist);
      break;
    case 'trust':
      result = trustOrder[a.trustState] - trustOrder[b.trustState] || compareNumber(a.trustScore, b.trustScore);
      break;
    case 'recency':
      result = recencyOrder[a.recencyBucket] - recencyOrder[b.recencyBucket];
      break;
    case 'bpm':
      result = compareNumber(a.bpm, b.bpm);
      break;
    case 'duration':
      result = compareNumber(a.durationSec, b.durationSec);
      break;
    case 'warnings':
      result = compareNumber(a.warnings.length, b.warnings.length);
      break;
  }
  return direction === 'asc' ? result : result * -1;
}

function metricValue(label: SmartCollection, tracks: TrackItem[]): number {
  switch (label) {
    case 'all':
      return tracks.length;
    case 'hot':
      return tracks.filter((track) => track.recencyBucket === 'hot').length;
    case 'cooling':
      return tracks.filter((track) => track.recencyBucket === 'cooling' || track.recencyBucket === 'new').length;
    case 'dormant':
      return tracks.filter((track) => track.recencyBucket === 'dormant' || track.recencyBucket === 'never-played').length;
    case 'needs-ears':
      return tracks.filter((track) => track.trustState === 'needs-attention' || track.trustState === 'blocked').length;
    case 'warnings':
      return tracks.filter((track) => track.warnings.length > 0).length;
  }
}

function filterTrackByCollection(track: TrackItem, collection: SmartCollection): boolean {
  switch (collection) {
    case 'all':
      return true;
    case 'hot':
      return track.recencyBucket === 'hot';
    case 'cooling':
      return track.recencyBucket === 'cooling' || track.recencyBucket === 'new';
    case 'dormant':
      return track.recencyBucket === 'dormant' || track.recencyBucket === 'never-played';
    case 'needs-ears':
      return track.trustState === 'needs-attention' || track.trustState === 'blocked';
    case 'warnings':
      return track.warnings.length > 0;
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}

async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) {
    throw new Error(`Dashboard refresh failed with ${response.status}.`);
  }
  return await response.json() as DashboardSnapshot;
}

async function postMutation<T>(path: string, payload: Record<string, unknown>): Promise<MutationResponse<T>> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json() as MutationResponse<T> | { error?: string };
  if (!response.ok || !('ok' in body) || body.ok !== true) {
    throw new Error('error' in body && body.error ? body.error : `Request failed with ${response.status}.`);
  }
  return body;
}

export function VaultBuddyApp() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(bundledDashboard);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('bundled');
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('library');
  const [activeCollection, setActiveCollection] = useState<SmartCollection>('all');
  const [trackSortKey, setTrackSortKey] = useState<TrackSortKey>('recency');
  const [trackSortDirection, setTrackSortDirection] = useState<SortDirection>('asc');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(defaultInspectorTab('library'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Loaded bundled snapshot while the live runtime connects.');

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(bundledDashboard.tracks[0]?.id ?? null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(bundledDashboard.playlists[0]?.id ?? null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(bundledDashboard.exportTargets[0]?.playlistId ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(bundledDashboard.topology.nodes[0]?.id ?? null);

  const [playlistDraftName, setPlaylistDraftName] = useState('');
  const [playlistDraftType, setPlaylistDraftType] = useState<'playlist' | 'smart'>('playlist');
  const [playlistDraftOpen, setPlaylistDraftOpen] = useState(false);

  const [targetDraftName, setTargetDraftName] = useState('');
  const [targetDraftFolderPath, setTargetDraftFolderPath] = useState('');
  const [targetDraftOpen, setTargetDraftOpen] = useState(false);

  const [planDraftOpen, setPlanDraftOpen] = useState(false);
  const [planExecutionNodeId, setPlanExecutionNodeId] = useState(bundledDashboard.topology.nodes.find((node) => node.role === 'export-worker')?.id ?? bundledDashboard.topology.nodes[0]?.id ?? '');
  const [planSourceStorageId, setPlanSourceStorageId] = useState(bundledDashboard.topology.storages.find((storage) => storage.isManagedLibrary)?.id ?? bundledDashboard.topology.storages[0]?.id ?? '');
  const [planDestinationStorageId, setPlanDestinationStorageId] = useState(bundledDashboard.topology.storages.find((storage) => storage.kind === 'external-drive')?.id ?? bundledDashboard.topology.storages[0]?.id ?? '');
  const [planTransport, setPlanTransport] = useState('tailscale');
  const [trackDraftTitle, setTrackDraftTitle] = useState('');
  const [trackDraftArtist, setTrackDraftArtist] = useState('');
  const [trackDraftAlbum, setTrackDraftAlbum] = useState('');
  const [trackDraftLabel, setTrackDraftLabel] = useState('');
  const [trackDraftKeyDisplay, setTrackDraftKeyDisplay] = useState('');
  const [trackDraftBpm, setTrackDraftBpm] = useState('');
  const [trackDraftRating, setTrackDraftRating] = useState('');
  const [trackDraftComment, setTrackDraftComment] = useState('');

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    void (async () => {
      try {
        setIsSyncing(true);
        const liveSnapshot = await getDashboardSnapshot();
        setSnapshot(liveSnapshot);
        setConnectionMode('live');
        setStatusMessage('Connected to the live VaultBuddy catalog.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reach live catalog.';
        setActionError(message);
        setStatusMessage('Using bundled snapshot fallback.');
      } finally {
        setIsSyncing(false);
      }
    })();
  }, []);

  useEffect(() => {
    setInspectorTab(defaultInspectorTab(activeView));
  }, [activeView]);

  const tracks = snapshot.tracks;
  const playlists = snapshot.playlists;
  const djSets = snapshot.sets;
  const exportTargets = snapshot.exportTargets;
  const exportPlans = snapshot.exportPlans;
  const recentExports = snapshot.recentExports;
  const nodes = snapshot.topology.nodes;
  const storages = snapshot.topology.storages;

  const visibleTracks = tracks
    .filter((track) => filterTrackByCollection(track, activeCollection))
    .filter((track) => matchesQuery(
      [track.title, track.artist, track.album, track.label, track.keyDisplay, track.recencyBucket, trustLabels[track.trustState], track.trustRationale, ...track.trustReasons, ...track.warnings],
      deferredQuery,
    ))
    .sort((a, b) => compareTracks(a, b, trackSortKey, trackSortDirection));
  const visiblePlaylists = playlists.filter((playlist) => matchesQuery(
    [playlist.name, playlist.type, playlist.deviceTargetName],
    deferredQuery,
  ));
  const visibleSets = djSets.filter((djSet) => matchesQuery([djSet.name], deferredQuery));
  const visibleTargets = exportTargets.filter((target) => matchesQuery(
    [target.playlistName, target.name, target.folderPath, ...target.referenceGapTables, ...target.rowPlanWarnings],
    deferredQuery,
  ));
  const visiblePlans = exportPlans.filter((plan) => matchesQuery(
    [plan.playlistName, plan.executionNodeName, plan.sourceStorageName, plan.destinationStorageName, plan.transport, plan.status],
    deferredQuery,
  ));
  const visibleNodes = nodes.filter((node) => matchesQuery(
    [node.name, node.role, node.transport, node.address],
    deferredQuery,
  ));
  const visibleStorages = storages.filter((storage) => matchesQuery(
    [storage.name, storage.nodeName, storage.kind, storage.mountPath],
    deferredQuery,
  ));
  const resultCount = visibleTracks.length + visiblePlaylists.length + visibleTargets.length + visiblePlans.length;

  const selectedTrack = visibleTracks.find((track) => track.id === selectedTrackId)
    ?? tracks.find((track) => track.id === selectedTrackId)
    ?? visibleTracks[0]
    ?? null;
  const selectedPlaylist = visiblePlaylists.find((playlist) => playlist.id === selectedPlaylistId)
    ?? playlists.find((playlist) => playlist.id === selectedPlaylistId)
    ?? visiblePlaylists[0]
    ?? null;
  const selectedTarget = visibleTargets.find((target) => target.playlistId === selectedTargetId)
    ?? exportTargets.find((target) => target.playlistId === selectedTargetId)
    ?? visibleTargets[0]
    ?? null;
  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId)
    ?? nodes.find((node) => node.id === selectedNodeId)
    ?? visibleNodes[0]
    ?? null;

  const selectedPlaylistTarget = selectedPlaylist
    ? exportTargets.find((target) => target.playlistId === selectedPlaylist.id) ?? null
    : null;
  const selectedPlaylistSets = selectedPlaylist
    ? visibleSets.filter((djSet) => matchesQuery([djSet.name, selectedPlaylist.name], ''))
    : visibleSets;
  const selectedTargetPlans = selectedTarget
    ? visiblePlans.filter((plan) => plan.playlistName === selectedTarget.playlistName)
    : visiblePlans;
  const selectedNodeStorages = selectedNode
    ? visibleStorages.filter((storage) => storage.nodeName === selectedNode.name)
    : visibleStorages;

  useEffect(() => {
    if (!selectedTrack) {
      return;
    }
    setTrackDraftTitle(selectedTrack.title);
    setTrackDraftArtist(selectedTrack.artist ?? '');
    setTrackDraftAlbum(selectedTrack.album ?? '');
    setTrackDraftLabel(selectedTrack.label ?? '');
    setTrackDraftKeyDisplay(selectedTrack.keyDisplay ?? '');
    setTrackDraftBpm(selectedTrack.bpm ? selectedTrack.bpm.toFixed(1) : '');
    setTrackDraftRating(selectedTrack.rating ? String(selectedTrack.rating) : '');
    setTrackDraftComment(selectedTrack.comment ?? '');
  }, [
    selectedTrack?.id,
    selectedTrack?.title,
    selectedTrack?.artist,
    selectedTrack?.album,
    selectedTrack?.label,
    selectedTrack?.keyDisplay,
    selectedTrack?.bpm,
    selectedTrack?.rating,
    selectedTrack?.comment,
  ]);

  async function refreshSnapshot(nextStatus?: string): Promise<DashboardSnapshot | null> {
    try {
      setIsSyncing(true);
      setActionError(null);
      const liveSnapshot = await getDashboardSnapshot();
      setSnapshot(liveSnapshot);
      setConnectionMode('live');
      if (nextStatus) {
        setStatusMessage(nextStatus);
      }
      return liveSnapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh dashboard.';
      setActionError(message);
      setStatusMessage('Refresh failed. Keeping last snapshot.');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }

  async function runMutation<T>(
    path: string,
    payload: Record<string, unknown>,
    onSuccess: (result: T, nextSnapshot: DashboardSnapshot) => void,
    nextStatus: string,
  ) {
    try {
      setIsSyncing(true);
      setActionError(null);
      const response = await postMutation<T>(path, payload);
      setSnapshot(response.snapshot);
      setConnectionMode('live');
      setStatusMessage(nextStatus);
      onSuccess(response.result, response.snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mutation failed.';
      setActionError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  function toggleTrackSort(key: TrackSortKey) {
    if (trackSortKey === key) {
      setTrackSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setTrackSortKey(key);
    setTrackSortDirection(key === 'title' || key === 'artist' ? 'asc' : 'desc');
  }

  function handleTrackBrowserKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (visibleTracks.length === 0) {
      return;
    }

    const currentIndex = visibleTracks.findIndex((track) => track.id === selectedTrack?.id);
    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
      event.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, visibleTracks.length - 1);
      setSelectedTrackId(visibleTracks[nextIndex]?.id ?? visibleTracks[0]?.id ?? null);
    }

    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
      setSelectedTrackId(visibleTracks[nextIndex]?.id ?? visibleTracks[0]?.id ?? null);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setSelectedTrackId(visibleTracks[0]?.id ?? null);
    }

    if (event.key === 'End') {
      event.preventDefault();
      setSelectedTrackId(visibleTracks.at(-1)?.id ?? null);
    }
  }

  function openPlaylistDraft() {
    setPlaylistDraftName('');
    setPlaylistDraftType('playlist');
    setPlaylistDraftOpen(true);
  }

  function handleCreatePlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = playlistDraftName.trim();
    if (!name) {
      return;
    }

    void runMutation<{ id: string; name: string }>(
      '/api/playlists',
      { name, type: playlistDraftType },
      (result) => {
        setSelectedPlaylistId(result.id);
        setActiveView('playlists');
        setInspectorTab('overview');
        setPlaylistDraftOpen(false);
        setPlaylistDraftName('');
      },
      `Created playlist "${name}".`,
    );
  }

  function openTargetDraft() {
    if (!selectedPlaylist) {
      return;
    }

    setTargetDraftName(selectedPlaylistTarget?.name ?? `${selectedPlaylist.name} USB`);
    setTargetDraftFolderPath(selectedPlaylistTarget?.folderPath ?? `/Volumes/DJUSB/${selectedPlaylist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`);
    setTargetDraftOpen(true);
  }

  function handleSaveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlaylist) {
      return;
    }
    const name = targetDraftName.trim();
    const folderPath = targetDraftFolderPath.trim();
    if (!name || !folderPath) {
      return;
    }

    void runMutation<{ playlistId: string; folderPath: string; name: string | null }>(
      '/api/export-targets',
      {
        playlistRef: selectedPlaylist.id,
        name,
        folderPath,
      },
      (result) => {
        setSelectedTargetId(result.playlistId);
        setActiveView('exports');
        setInspectorTab('native');
        setTargetDraftOpen(false);
      },
      `Saved device target for "${selectedPlaylist.name}".`,
    );
  }

  function openPlanDraft() {
    if (!selectedTarget) {
      return;
    }

    setPlanExecutionNodeId(nodes.find((node) => node.role === 'export-worker')?.id ?? nodes[0]?.id ?? '');
    setPlanSourceStorageId(storages.find((storage) => storage.isManagedLibrary)?.id ?? storages[0]?.id ?? '');
    setPlanDestinationStorageId(storages.find((storage) => storage.kind === 'external-drive')?.id ?? storages[0]?.id ?? '');
    setPlanTransport('tailscale');
    setPlanDraftOpen(true);
  }

  function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTarget) {
      return;
    }

    void runMutation<{ planId: string; playlistId: string }>(
      '/api/export-plans',
      {
        playlistRef: selectedTarget.playlistId,
        executionNodeRef: planExecutionNodeId,
        sourceStorageRef: planSourceStorageId,
        destinationStorageRef: planDestinationStorageId,
        transport: planTransport,
      },
      (result) => {
        setSelectedTargetId(result.playlistId);
        setInspectorTab('plans');
        setPlanDraftOpen(false);
      },
      `Planned export for "${selectedTarget.playlistName}".`,
    );
  }

  function handleKickOffExport() {
    if (!selectedTarget) {
      return;
    }

    void runMutation<{ targetPath: string | null }>(
      '/api/export-jobs',
      {
        playlistRef: selectedTarget.playlistId,
      },
      () => {
        setInspectorTab('plans');
      },
      `Ran export for "${selectedTarget.playlistName}".`,
    );
  }

  function handleSaveTrackMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTrack) {
      return;
    }

    void runMutation<{ trackId: string; title: string }>(
      '/api/tracks/update',
      {
        trackRef: selectedTrack.id,
        title: trackDraftTitle,
        artist: trackDraftArtist,
        album: trackDraftAlbum,
        label: trackDraftLabel,
        keyDisplay: trackDraftKeyDisplay,
        bpm: trackDraftBpm.trim() ? Number.parseFloat(trackDraftBpm) : null,
        rating: trackDraftRating.trim() ? Number.parseInt(trackDraftRating, 10) : null,
        comment: trackDraftComment,
      },
      (result) => {
        setSelectedTrackId(result.trackId);
        setInspectorTab('metadata');
      },
      `Updated metadata for "${selectedTrack.title}".`,
    );
  }

  function handleAddSelectedTrackToPlaylist() {
    if (!selectedTrack || !selectedPlaylist) {
      return;
    }

    void runMutation<{ playlistId: string; trackId: string; position: number }>(
      '/api/playlist-items/add',
      {
        playlistId: selectedPlaylist.id,
        trackRef: selectedTrack.id,
      },
      () => {
        setInspectorTab('overview');
      },
      `Added "${selectedTrack.title}" to "${selectedPlaylist.name}".`,
    );
  }

  function handleRemovePlaylistEntry(position: number) {
    if (!selectedPlaylist) {
      return;
    }

    void runMutation<{ playlistId: string; removedPosition: number }>(
      '/api/playlist-items/remove',
      {
        playlistId: selectedPlaylist.id,
        position,
      },
      () => {
        setInspectorTab('overview');
      },
      `Removed track ${position + 1} from "${selectedPlaylist.name}".`,
    );
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">VaultBuddy</p>
          <h1>Operator Desk</h1>
          <p className="sidebar-copy">{snapshot.hero.focus}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary views">
          {([
            ['library', 'Library', `${tracks.length} tracks in the catalog`],
            ['playlists', 'Playlists', `${playlists.length} playlists, ${djSets.length} sets`],
            ['exports', 'Exports', `${exportTargets.length} targets, ${exportPlans.filter((plan) => plan.status === 'ready').length} ready plans`],
            ['topology', 'Topology', `${nodes.length} nodes, ${storages.length} storage locations`],
          ] as Array<[ActiveView, string, string]>).map(([view, label, meta]) => (
            <button
              className={`sidebar-button ${activeView === view ? 'is-active' : ''}`}
              key={view}
              onClick={() => startTransition(() => setActiveView(view))}
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </nav>

        <section className="sidebar-section">
          <h2>Smart Collections</h2>
          <div className="sidebar-list">
            {(['all', 'hot', 'cooling', 'dormant', 'needs-ears', 'warnings'] as SmartCollection[]).map((collection) => (
              <button
                className={`collection-chip ${activeCollection === collection ? 'is-active' : ''}`}
                key={collection}
                onClick={() => {
                  startTransition(() => {
                    setActiveView('library');
                    setActiveCollection(collection);
                  });
                }}
                type="button"
              >
                <span>{smartCollectionLabels[collection]}</span>
                <strong>{metricValue(collection, tracks)}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <h2>Run Focus</h2>
          <div className="focus-stack">
            {snapshot.focusNotes.map((note) => (
              <article className="focus-card" key={note}>
                <p>{note}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace-main">
        <header className="toolbar">
          <div>
            <p className="eyebrow">Live Snapshot</p>
            <h2>{snapshot.hero.subtitle}</h2>
          </div>

          <div className="toolbar-actions">
            <label className="search-card">
              <span>Search tracks, playlists, exports, topology</span>
              <input
                value={query}
                onChange={(event) => startTransition(() => setQuery(event.target.value))}
                placeholder="Try hot, Warmup, tailscale, missing artist..."
              />
            </label>
            <div className="toolbar-meta">
              <span>Refreshed {formatGeneratedAt(snapshot.generatedAt)}</span>
              <span>{resultCount} matching surfaces</span>
              <span>{connectionMode === 'live' ? 'Live catalog connected' : 'Bundled snapshot mode'}</span>
            </div>
            <div className="status-strip">
              <span className={`status-chip ${connectionMode === 'live' ? 'status-ready' : 'status-muted'}`}>
                {isSyncing ? 'Syncing…' : connectionMode === 'live' ? 'Live' : 'Bundled'}
              </span>
              <p className="status-copy">{statusMessage}</p>
              <button className="action-button" onClick={() => void refreshSnapshot('Refreshed from live catalog.')} type="button">
                Refresh
              </button>
            </div>
            {actionError ? <p className="error-banner">{actionError}</p> : null}
          </div>
        </header>

        <section className="summary-bar">
          <article className="summary-card">
            <span>Tracks</span>
            <strong>{tracks.length}</strong>
            <small>{snapshot.summary.hotTrackCount} front-of-mind</small>
          </article>
          <article className="summary-card">
            <span>Library Trust</span>
            <strong>{snapshot.summary.libraryTrust.needsAttentionTrackCount + snapshot.summary.libraryTrust.blockedTrackCount}</strong>
            <small>{snapshot.summary.libraryTrust.chosenTrackCount} quietly chosen by DJ Vault</small>
          </article>
          <article className="summary-card">
            <span>Export Plans</span>
            <strong>{exportPlans.filter((plan) => plan.status === 'ready').length}</strong>
            <small>Ready to run</small>
          </article>
          <article className="summary-card">
            <span>Recent Exports</span>
            <strong>{recentExports.length}</strong>
            <small>Audit trail preserved</small>
          </article>
        </section>

        <div className="workspace-grid">
          <section className="browser-panel">
            {activeView === 'library' ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Track Browser</p>
                    <h3>{smartCollectionLabels[activeCollection]}</h3>
                  </div>
                  <p className="panel-copy">Sortable, keyboard-driven, and dense by design. This is the start of a real library browser.</p>
                </div>
                {visibleTracks.length > 0 ? (
                  <div className="table-shell" onKeyDown={handleTrackBrowserKeyDown} tabIndex={0}>
                    <div className="table-header table-row">
                      {([
                        ['title', 'Title'],
                        ['artist', 'Artist'],
                        ['trust', 'Trust'],
                        ['recency', 'Recency'],
                        ['bpm', 'BPM'],
                        ['warnings', 'Gaps'],
                      ] as Array<[TrackSortKey, string]>).map(([key, label]) => (
                        <button
                          className="table-header-button"
                          key={key}
                          onClick={() => toggleTrackSort(key)}
                          type="button"
                        >
                          <span>{label}</span>
                          <small>{trackSortKey === key ? (trackSortDirection === 'asc' ? '↑' : '↓') : '↕'}</small>
                        </button>
                      ))}
                    </div>
                    {visibleTracks.map((track) => (
                      <button
                        className={`table-row table-button ${selectedTrack?.id === track.id ? 'is-selected' : ''}`}
                        key={track.id}
                        onClick={() => {
                          setSelectedTrackId(track.id);
                          setInspectorTab('overview');
                        }}
                        type="button"
                      >
                        <span className="title-cell">
                          <strong>{track.title}</strong>
                          <small>{track.album ?? 'Unknown album'}</small>
                        </span>
                        <span>{track.artist ?? 'Unknown artist'}</span>
                        <span><span className={`trust-chip trust-${track.trustState}`}>{trustLabels[track.trustState]}</span></span>
                        <span><span className={`bucket-chip bucket-${track.recencyBucket}`}>{track.recencyBucket}</span></span>
                        <span>{track.bpm ? track.bpm.toFixed(1) : '—'}</span>
                        <span>{track.warnings.length}</span>
                      </button>
                    ))}
                  </div>
                ) : <EmptyState message="No tracks match the current filter and smart collection." />}
              </>
            ) : null}

            {activeView === 'playlists' ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Crates and Sets</p>
                    <h3>Playlist Browser</h3>
                  </div>
                  <p className="panel-copy">These actions now write through to the live catalog in local dev.</p>
                </div>
                <div className="action-row">
                  <button className="action-button primary" onClick={openPlaylistDraft} type="button">New Playlist</button>
                  <button className="action-button" disabled={!selectedPlaylist} onClick={openTargetDraft} type="button">Save Device Target</button>
                  <button className="action-button" disabled={!selectedPlaylist || !selectedTrack} onClick={handleAddSelectedTrackToPlaylist} type="button">
                    {selectedTrack ? `Add "${selectedTrack.title}"` : 'Add Selected Track'}
                  </button>
                </div>
                {playlistDraftOpen ? (
                  <form className="inline-form" onSubmit={handleCreatePlaylist}>
                    <label>
                      <span>Playlist Name</span>
                      <input onChange={(event) => setPlaylistDraftName(event.target.value)} placeholder="Afterhours Utilities" value={playlistDraftName} />
                    </label>
                    <label>
                      <span>Type</span>
                      <select onChange={(event) => setPlaylistDraftType(event.target.value as 'playlist' | 'smart')} value={playlistDraftType}>
                        <option value="playlist">playlist</option>
                        <option value="smart">smart</option>
                      </select>
                    </label>
                    <div className="inline-form-actions">
                      <button className="action-button primary" type="submit">Create</button>
                      <button className="action-button" onClick={() => setPlaylistDraftOpen(false)} type="button">Cancel</button>
                    </div>
                  </form>
                ) : null}
                {targetDraftOpen ? (
                  <form className="inline-form" onSubmit={handleSaveTarget}>
                    <label>
                      <span>Target Name</span>
                      <input onChange={(event) => setTargetDraftName(event.target.value)} value={targetDraftName} />
                    </label>
                    <label className="form-span">
                      <span>Folder Path</span>
                      <input onChange={(event) => setTargetDraftFolderPath(event.target.value)} value={targetDraftFolderPath} />
                    </label>
                    <div className="inline-form-actions">
                      <button className="action-button primary" type="submit">Save Target</button>
                      <button className="action-button" onClick={() => setTargetDraftOpen(false)} type="button">Cancel</button>
                    </div>
                  </form>
                ) : null}
                {visiblePlaylists.length > 0 ? (
                  <div className="stack">
                    {visiblePlaylists.map((playlist) => (
                      <button
                        className={`list-button ${selectedPlaylist?.id === playlist.id ? 'is-selected' : ''}`}
                        key={playlist.id}
                        onClick={() => {
                          setSelectedPlaylistId(playlist.id);
                          setInspectorTab('overview');
                        }}
                        type="button"
                      >
                        <div>
                          <strong>{playlist.name}</strong>
                          <small>{playlist.itemCount} tracks · {playlist.type}</small>
                        </div>
                        <span className={`status-chip ${playlist.hasDeviceTarget ? 'status-ready' : 'status-muted'}`}>
                          {playlist.deviceTargetName ?? 'No target'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : <EmptyState message="No playlists match the current filter yet." />}

                <div className="subsection">
                  <h3 className="subhead">Authored Sets</h3>
                  {visibleSets.length > 0 ? (
                    <div className="stack">
                      {visibleSets.map((djSet) => (
                        <article className="list-card" key={djSet.id}>
                          <div>
                            <strong>{djSet.name}</strong>
                            <small>{djSet.trackCount} programmed transitions</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <EmptyState message="No DJ sets match the current filter yet." />}
                </div>
              </>
            ) : null}

            {activeView === 'exports' ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Run Queue</p>
                    <h3>Export Targets</h3>
                  </div>
                  <p className="panel-copy">Plan and trigger real exports against the live catalog in local dev.</p>
                </div>
                <div className="action-row">
                  <button className="action-button" disabled={!selectedTarget} onClick={openPlanDraft} type="button">Plan Export</button>
                  <button className="action-button primary" disabled={!selectedTarget} onClick={handleKickOffExport} type="button">Kick Off Export</button>
                </div>
                {planDraftOpen ? (
                  <form className="inline-form" onSubmit={handleCreatePlan}>
                    <label>
                      <span>Execution Node</span>
                      <select onChange={(event) => setPlanExecutionNodeId(event.target.value)} value={planExecutionNodeId}>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Source Storage</span>
                      <select onChange={(event) => setPlanSourceStorageId(event.target.value)} value={planSourceStorageId}>
                        {storages.map((storage) => (
                          <option key={storage.id} value={storage.id}>{storage.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Destination Storage</span>
                      <select onChange={(event) => setPlanDestinationStorageId(event.target.value)} value={planDestinationStorageId}>
                        {storages.map((storage) => (
                          <option key={storage.id} value={storage.id}>{storage.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Transport</span>
                      <select onChange={(event) => setPlanTransport(event.target.value)} value={planTransport}>
                        <option value="tailscale">tailscale</option>
                        <option value="local">local</option>
                        <option value="smb">smb</option>
                      </select>
                    </label>
                    <div className="inline-form-actions">
                      <button className="action-button primary" type="submit">Save Plan</button>
                      <button className="action-button" onClick={() => setPlanDraftOpen(false)} type="button">Cancel</button>
                    </div>
                  </form>
                ) : null}
                {visibleTargets.length > 0 ? (
                  <div className="stack">
                    {visibleTargets.map((target) => (
                      <button
                        className={`list-button ${selectedTarget?.playlistId === target.playlistId ? 'is-selected' : ''}`}
                        key={target.playlistId}
                        onClick={() => {
                          setSelectedTargetId(target.playlistId);
                          setInspectorTab('overview');
                        }}
                        type="button"
                      >
                        <div>
                          <strong>{target.playlistName}</strong>
                          <small>{target.name ?? 'Unnamed target'}</small>
                        </div>
                        <span className={`status-chip ${target.enabled ? 'status-ready' : 'status-muted'}`}>
                          {target.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : <EmptyState message="No export targets match the current filter yet." />}

                <div className="subsection">
                  <h3 className="subhead">Recent Export Activity</h3>
                  {recentExports.length > 0 ? (
                    <div className="stack">
                      {recentExports.slice(0, 5).map((job) => (
                        <article className="list-card" key={job.id}>
                          <div>
                            <strong>{job.targetKind}</strong>
                            <small>{job.targetPath ?? 'No target path'}</small>
                          </div>
                          <span className={`status-chip ${job.status === 'completed' ? 'status-ready' : 'status-muted'}`}>
                            {job.status}
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : <EmptyState message="No export activity is visible yet." />}
                </div>
              </>
            ) : null}

            {activeView === 'topology' ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Distributed Reality</p>
                    <h3>Nodes and Storage</h3>
                  </div>
                  <p className="panel-copy">The product bet is here: the database, media, and USB executor do not need to live on the same machine.</p>
                </div>
                {visibleNodes.length > 0 ? (
                  <div className="stack">
                    {visibleNodes.map((node) => (
                      <button
                        className={`list-button ${selectedNode?.id === node.id ? 'is-selected' : ''}`}
                        key={node.id}
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setInspectorTab('overview');
                        }}
                        type="button"
                      >
                        <div>
                          <strong>{node.name}</strong>
                          <small>{node.role} · {node.transport ?? 'manual'}</small>
                        </div>
                        <span className={`status-chip ${node.isOnline ? 'status-ready' : 'status-muted'}`}>
                          {node.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : <EmptyState message="No nodes match the current filter yet." />}

                <div className="subsection">
                  <h3 className="subhead">Storage Surface</h3>
                  {visibleStorages.length > 0 ? (
                    <div className="stack">
                      {visibleStorages.map((storage) => (
                        <article className="list-card" key={storage.id}>
                          <div>
                            <strong>{storage.name}</strong>
                            <small>{storage.nodeName} · {storage.kind}</small>
                            <small className="mono">{storage.mountPath ?? 'No mount path recorded'}</small>
                          </div>
                          <div className="tag-row">
                            {storage.isManagedLibrary ? <span className="mini-tag success">Managed</span> : null}
                            <span className={`mini-tag ${storage.isAvailable ? 'success' : 'muted'}`}>
                              {storage.isAvailable ? 'Available' : 'Offline'}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <EmptyState message="No storage locations match the current filter yet." />}
                </div>
              </>
            ) : null}
          </section>

          <aside className="inspector-panel">
            <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
              {(activeView === 'library'
                ? ([
                  ['overview', 'Overview'],
                  ['metadata', 'Metadata'],
                  ['readiness', 'Library Trust'],
                ] as Array<[InspectorTab, string]>)
                : activeView === 'playlists'
                  ? ([
                    ['overview', 'Overview'],
                    ['target', 'Target'],
                    ['sets', 'Sets'],
                  ] as Array<[InspectorTab, string]>)
                  : activeView === 'exports'
                    ? ([
                      ['overview', 'Overview'],
                      ['native', 'Native Gaps'],
                      ['plans', 'Plans'],
                    ] as Array<[InspectorTab, string]>)
                    : ([
                      ['overview', 'Overview'],
                      ['storage', 'Storage'],
                      ['activity', 'Activity'],
                    ] as Array<[InspectorTab, string]>)
              ).map(([tab, label]) => (
                <button
                  aria-selected={inspectorTab === tab}
                  className={`tab-button ${inspectorTab === tab ? 'is-active' : ''}`}
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {activeView === 'library' && selectedTrack ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h3>{selectedTrack.title}</h3>
                  </div>
                  <span className={`bucket-chip bucket-${selectedTrack.recencyBucket}`}>{selectedTrack.recencyBucket}</span>
                </div>
                {inspectorTab === 'overview' ? (
                  <>
                    <div className="inspector-section">
                      <dl className="inspector-grid">
                        <div><dt>Artist</dt><dd>{selectedTrack.artist ?? 'Unknown artist'}</dd></div>
                        <div><dt>Album</dt><dd>{selectedTrack.album ?? 'Unknown album'}</dd></div>
                        <div><dt>Key</dt><dd>{selectedTrack.keyDisplay ?? 'No key'}</dd></div>
                        <div><dt>BPM</dt><dd>{selectedTrack.bpm ? selectedTrack.bpm.toFixed(1) : 'No BPM'}</dd></div>
                        <div><dt>Length</dt><dd>{formatDuration(selectedTrack.durationSec)}</dd></div>
                        <div><dt>Recency Score</dt><dd>{selectedTrack.recencyScore}</dd></div>
                        <div><dt>Trust</dt><dd>{trustLabels[selectedTrack.trustState]} · {selectedTrack.trustScore}</dd></div>
                      </dl>
                    </div>
                    <div className="inspector-section">
                      <h4>Mental Weight</h4>
                      <p>{selectedTrack.mentalWeight.replace(/-/g, ' ')}</p>
                    </div>
                  </>
                ) : null}
                {inspectorTab === 'metadata' ? (
                  <>
                    <form className="inline-form" onSubmit={handleSaveTrackMetadata}>
                      <label>
                        <span>Title</span>
                        <input onChange={(event) => setTrackDraftTitle(event.target.value)} value={trackDraftTitle} />
                      </label>
                      <label>
                        <span>Artist</span>
                        <input onChange={(event) => setTrackDraftArtist(event.target.value)} value={trackDraftArtist} />
                      </label>
                      <label>
                        <span>Album</span>
                        <input onChange={(event) => setTrackDraftAlbum(event.target.value)} value={trackDraftAlbum} />
                      </label>
                      <label>
                        <span>Label</span>
                        <input onChange={(event) => setTrackDraftLabel(event.target.value)} value={trackDraftLabel} />
                      </label>
                      <label>
                        <span>Key</span>
                        <input onChange={(event) => setTrackDraftKeyDisplay(event.target.value)} value={trackDraftKeyDisplay} />
                      </label>
                      <label>
                        <span>BPM</span>
                        <input onChange={(event) => setTrackDraftBpm(event.target.value)} value={trackDraftBpm} />
                      </label>
                      <label>
                        <span>Rating</span>
                        <select onChange={(event) => setTrackDraftRating(event.target.value)} value={trackDraftRating}>
                          <option value="">unrated</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                      </label>
                      <label className="form-span">
                        <span>Comment</span>
                        <input onChange={(event) => setTrackDraftComment(event.target.value)} value={trackDraftComment} />
                      </label>
                      <div className="inline-form-actions">
                        <button className="action-button primary" type="submit">Save Track Metadata</button>
                      </div>
                    </form>
                    <div className="inspector-section">
                      <h4>History</h4>
                      <p className="muted">Added {formatDate(selectedTrack.addedAt)} · last played {formatDate(selectedTrack.lastPlayedAt)}</p>
                    </div>
                    <div className="inspector-section">
                      <h4>Metadata Gaps</h4>
                      {selectedTrack.warnings.length > 0 ? (
                        <div className="tag-row">
                          {selectedTrack.warnings.map((warning) => (
                            <span className="mini-tag danger" key={warning}>{warning}</span>
                          ))}
                        </div>
                      ) : <p className="muted">No metadata warnings on this track.</p>}
                    </div>
                  </>
                ) : null}
                {inspectorTab === 'readiness' ? (
                  <>
                    <div className="inspector-section">
                      <h4>Library Trust</h4>
                      <p>{selectedTrack.trustRationale}</p>
                      <div className="tag-row">
                        <span className={`trust-chip trust-${selectedTrack.trustState}`}>{trustLabels[selectedTrack.trustState]}</span>
                        <span className="mini-tag muted">{selectedTrack.sourceOpinionCount} source opinions</span>
                        {selectedTrack.mergeChangedFields.map((field) => (
                          <span className="mini-tag success" key={field}>{field} chosen</span>
                        ))}
                      </div>
                    </div>
                    <div className="inspector-section">
                      <h4>Why DJ Vault Picked This</h4>
                      {selectedTrack.trustReasons.length > 0 ? (
                        <ul className="compact-list">
                          {selectedTrack.trustReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : <p className="muted">No source disagreement needs to interrupt prep for this track.</p>}
                    </div>
                    <div className="inspector-section">
                      <h4>Old-Device Readiness</h4>
                      <p className="muted">The current native writer planning especially cares about artist, duration, bitrate, sample rate, and BPM. These are export-quality signals, not merge-conflict chores.</p>
                      <div className="tag-row">
                        {selectedTrack.warnings.length > 0 ? selectedTrack.warnings.map((warning) => (
                          <span className="mini-tag caution" key={warning}>{warning}</span>
                        )) : <span className="mini-tag success">No export metadata gaps</span>}
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {activeView === 'playlists' && selectedPlaylist ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h3>{selectedPlaylist.name}</h3>
                  </div>
                  <span className={`status-chip ${selectedPlaylist.hasDeviceTarget ? 'status-ready' : 'status-muted'}`}>
                    {selectedPlaylist.deviceTargetName ?? 'No target'}
                  </span>
                </div>
                {inspectorTab === 'overview' ? (
                  <>
                    <div className="inspector-section">
                      <dl className="inspector-grid">
                        <div><dt>Type</dt><dd>{selectedPlaylist.type}</dd></div>
                        <div><dt>Tracks</dt><dd>{selectedPlaylist.itemCount}</dd></div>
                        <div><dt>Target</dt><dd>{selectedPlaylist.deviceTargetName ?? 'Not configured'}</dd></div>
                      </dl>
                    </div>
                    <div className="inspector-section">
                      <h4>Playlist Contents</h4>
                      {selectedPlaylist.entries.length > 0 ? (
                        <div className="stack tight">
                          {selectedPlaylist.entries.map((entry) => (
                            <article className="list-card" key={`${entry.trackId}-${entry.position}`}>
                              <div>
                                <strong>{entry.position + 1}. {entry.title}</strong>
                                <small>{entry.artist ?? 'Unknown artist'} · {formatDuration(entry.durationSec)}</small>
                              </div>
                              <button className="action-button" onClick={() => handleRemovePlaylistEntry(entry.position)} type="button">Remove</button>
                            </article>
                          ))}
                        </div>
                      ) : <p className="muted">This playlist is empty right now.</p>}
                    </div>
                  </>
                ) : null}
                {inspectorTab === 'target' ? (
                  <div className="inspector-section">
                    <h4>Saved Target</h4>
                    {selectedPlaylistTarget ? (
                      <>
                        <p>{selectedPlaylistTarget.name}</p>
                        <p className="mono">{selectedPlaylistTarget.folderPath}</p>
                        <div className="tag-row">
                          {selectedPlaylistTarget.pendingNativeArtifacts.map((item) => (
                            <span className="mini-tag muted" key={item}>{item}</span>
                          ))}
                        </div>
                      </>
                    ) : <p className="muted">No device target saved yet. Use the action row to add one.</p>}
                  </div>
                ) : null}
                {inspectorTab === 'sets' ? (
                  <div className="inspector-section">
                    <h4>Set Context</h4>
                    {selectedPlaylistSets.length > 0 ? (
                      <div className="stack tight">
                        {selectedPlaylistSets.map((djSet) => (
                          <article className="list-card" key={djSet.id}>
                            <div>
                              <strong>{djSet.name}</strong>
                              <small>{djSet.trackCount} programmed transitions</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : <p className="muted">No set view overlaps are visible in the current snapshot.</p>}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeView === 'exports' && selectedTarget ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h3>{selectedTarget.playlistName}</h3>
                  </div>
                  <span className={`status-chip ${selectedTarget.enabled ? 'status-ready' : 'status-muted'}`}>
                    {selectedTarget.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {inspectorTab === 'overview' ? (
                  <div className="inspector-section">
                    <h4>Target Path</h4>
                    <p className="mono">{selectedTarget.folderPath ?? 'No target folder saved'}</p>
                  </div>
                ) : null}
                {inspectorTab === 'native' ? (
                  <>
                    <div className="inspector-section">
                      <h4>Native Coverage</h4>
                      <div className="tag-row">
                        {selectedTarget.referenceCoveredTables.map((item) => (
                          <span className="mini-tag success" key={item}>{item}</span>
                        ))}
                        {selectedTarget.referenceGapTables.map((item) => (
                          <span className="mini-tag caution" key={item}>{item}</span>
                        ))}
                        {selectedTarget.pendingNativeArtifacts.map((item) => (
                          <span className="mini-tag muted" key={item}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="inspector-section">
                      <h4>Plan Warnings</h4>
                      {selectedTarget.rowPlanWarnings.length > 0 ? (
                        <ul className="compact-list">
                          {selectedTarget.rowPlanWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : <p className="muted">No row-plan warnings for this target.</p>}
                    </div>
                  </>
                ) : null}
                {inspectorTab === 'plans' ? (
                  <div className="inspector-section">
                    <h4>Execution Plans</h4>
                    {selectedTargetPlans.length > 0 ? (
                      <div className="stack tight">
                        {selectedTargetPlans.map((plan) => (
                          <article className="list-card" key={plan.id}>
                            <div>
                              <strong>{plan.executionNodeName}</strong>
                              <small>{plan.sourceStorageName ?? 'Unknown source'} → {plan.destinationStorageName ?? 'Unknown destination'}</small>
                            </div>
                            <span className={`status-chip ${plan.status === 'ready' ? 'status-ready' : 'status-muted'}`}>{plan.status}</span>
                          </article>
                        ))}
                      </div>
                    ) : <p className="muted">No execution plans are attached to this target yet.</p>}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeView === 'topology' && selectedNode ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h3>{selectedNode.name}</h3>
                  </div>
                  <span className={`status-chip ${selectedNode.isOnline ? 'status-ready' : 'status-muted'}`}>
                    {selectedNode.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                {inspectorTab === 'overview' ? (
                  <div className="inspector-section">
                    <dl className="inspector-grid">
                      <div><dt>Role</dt><dd>{selectedNode.role}</dd></div>
                      <div><dt>Transport</dt><dd>{selectedNode.transport ?? 'manual'}</dd></div>
                      <div><dt>Address</dt><dd>{selectedNode.address ?? 'No address'}</dd></div>
                    </dl>
                  </div>
                ) : null}
                {inspectorTab === 'storage' ? (
                  <div className="inspector-section">
                    <h4>Attached Storage</h4>
                    {selectedNodeStorages.length > 0 ? (
                      <div className="stack tight">
                        {selectedNodeStorages.map((storage) => (
                          <article className="list-card" key={storage.id}>
                            <div>
                              <strong>{storage.name}</strong>
                              <small>{storage.kind}</small>
                              <small className="mono">{storage.mountPath ?? 'No mount path recorded'}</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : <p className="muted">No storage locations are linked to this node in the current snapshot.</p>}
                  </div>
                ) : null}
                {inspectorTab === 'activity' ? (
                  <div className="inspector-section">
                    <h4>Recent Export Activity</h4>
                    {recentExports.length > 0 ? (
                      <div className="stack tight">
                        {recentExports.slice(0, 4).map((job) => (
                          <article className="list-card" key={job.id}>
                            <div>
                              <strong>{job.targetKind}</strong>
                              <small>{formatDate(job.completedAt)}</small>
                            </div>
                            <span className={`status-chip ${job.status === 'completed' ? 'status-ready' : 'status-muted'}`}>{job.status}</span>
                          </article>
                        ))}
                      </div>
                    ) : <p className="muted">No recent exports recorded yet.</p>}
                  </div>
                ) : null}
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
