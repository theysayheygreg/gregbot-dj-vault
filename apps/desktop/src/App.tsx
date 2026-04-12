import { startTransition, useDeferredValue, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

import dashboardJson from './generated/catalog-dashboard.json';
import type { DashboardSnapshot } from './dashboard-types';

const dashboard = dashboardJson as DashboardSnapshot;

type TrackItem = DashboardSnapshot['tracks'][number];
type PlaylistItem = DashboardSnapshot['playlists'][number];
type SetItem = DashboardSnapshot['sets'][number];
type ExportTargetItem = DashboardSnapshot['exportTargets'][number];
type ExportPlanItem = DashboardSnapshot['exportPlans'][number];
type NodeItem = DashboardSnapshot['topology']['nodes'][number];
type StorageItem = DashboardSnapshot['topology']['storages'][number];
type ExportJobItem = DashboardSnapshot['recentExports'][number];

type ActiveView = 'library' | 'playlists' | 'exports' | 'topology';
type SmartCollection = 'all' | 'hot' | 'cooling' | 'dormant' | 'warnings';
type TrackSortKey = 'title' | 'artist' | 'recency' | 'bpm' | 'duration' | 'warnings';
type SortDirection = 'asc' | 'desc';
type InspectorTab = 'overview' | 'metadata' | 'readiness' | 'sets' | 'target' | 'native' | 'plans' | 'storage' | 'activity';

const smartCollectionLabels: Record<SmartCollection, string> = {
  all: 'All Tracks',
  hot: 'Hot Right Now',
  cooling: 'Cooling Off',
  dormant: 'Dormant',
  warnings: 'Needs Attention',
};

const recencyOrder: Record<TrackItem['recencyBucket'], number> = {
  hot: 0,
  new: 1,
  cooling: 2,
  dormant: 3,
  'never-played': 4,
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

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
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

export function App() {
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('library');
  const [activeCollection, setActiveCollection] = useState<SmartCollection>('all');
  const [trackSortKey, setTrackSortKey] = useState<TrackSortKey>('recency');
  const [trackSortDirection, setTrackSortDirection] = useState<SortDirection>('asc');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(defaultInspectorTab('library'));

  const [playlists, setPlaylists] = useState<PlaylistItem[]>(dashboard.playlists);
  const [djSets] = useState<SetItem[]>(dashboard.sets);
  const [exportTargets, setExportTargets] = useState<ExportTargetItem[]>(dashboard.exportTargets);
  const [exportPlans, setExportPlans] = useState<ExportPlanItem[]>(dashboard.exportPlans);
  const [recentExports, setRecentExports] = useState<ExportJobItem[]>(dashboard.recentExports);

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(dashboard.tracks[0]?.id ?? null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(dashboard.playlists[0]?.id ?? null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(dashboard.exportTargets[0]?.playlistId ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(dashboard.topology.nodes[0]?.id ?? null);

  const [playlistDraftName, setPlaylistDraftName] = useState('');
  const [playlistDraftType, setPlaylistDraftType] = useState<'playlist' | 'smart-playlist'>('playlist');
  const [playlistDraftOpen, setPlaylistDraftOpen] = useState(false);

  const [targetDraftName, setTargetDraftName] = useState('');
  const [targetDraftFolderPath, setTargetDraftFolderPath] = useState('');
  const [targetDraftOpen, setTargetDraftOpen] = useState(false);

  const [planDraftOpen, setPlanDraftOpen] = useState(false);
  const [planExecutionNodeId, setPlanExecutionNodeId] = useState(dashboard.topology.nodes.find((node) => node.role === 'export-worker')?.id ?? dashboard.topology.nodes[0]?.id ?? '');
  const [planSourceStorageId, setPlanSourceStorageId] = useState(dashboard.topology.storages.find((storage) => storage.isManagedLibrary)?.id ?? dashboard.topology.storages[0]?.id ?? '');
  const [planDestinationStorageId, setPlanDestinationStorageId] = useState(dashboard.topology.storages.find((storage) => storage.kind === 'external-drive')?.id ?? dashboard.topology.storages[0]?.id ?? '');
  const [planTransport, setPlanTransport] = useState('tailscale');

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    setInspectorTab(defaultInspectorTab(activeView));
  }, [activeView]);

  const visibleTracks = dashboard.tracks
    .filter((track) => filterTrackByCollection(track, activeCollection))
    .filter((track) => matchesQuery(
      [track.title, track.artist, track.album, track.label, track.keyDisplay, track.recencyBucket, ...track.warnings],
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
  const visibleNodes = dashboard.topology.nodes.filter((node) => matchesQuery(
    [node.name, node.role, node.transport, node.address],
    deferredQuery,
  ));
  const visibleStorages = dashboard.topology.storages.filter((storage) => matchesQuery(
    [storage.name, storage.nodeName, storage.kind, storage.mountPath],
    deferredQuery,
  ));
  const resultCount = visibleTracks.length + visiblePlaylists.length + visibleTargets.length + visiblePlans.length;

  const selectedTrack = visibleTracks.find((track) => track.id === selectedTrackId)
    ?? dashboard.tracks.find((track) => track.id === selectedTrackId)
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
    ?? dashboard.topology.nodes.find((node) => node.id === selectedNodeId)
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

    const newPlaylist: PlaylistItem = {
      id: createId('playlist'),
      name,
      type: playlistDraftType,
      itemCount: 0,
      hasDeviceTarget: false,
      deviceTargetName: null,
    };

    setPlaylists((current) => [newPlaylist, ...current]);
    setSelectedPlaylistId(newPlaylist.id);
    setActiveView('playlists');
    setInspectorTab('overview');
    setPlaylistDraftOpen(false);
  }

  function openTargetDraft() {
    if (!selectedPlaylist) {
      return;
    }

    const existingTarget = exportTargets.find((target) => target.playlistId === selectedPlaylist.id);
    setTargetDraftName(existingTarget?.name ?? `${selectedPlaylist.name} USB`);
    setTargetDraftFolderPath(existingTarget?.folderPath ?? `/Volumes/DJUSB/${slugify(selectedPlaylist.name)}`);
    setTargetDraftOpen(true);
  }

  function handleSaveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlaylist) {
      return;
    }

    const draftName = targetDraftName.trim();
    const draftFolderPath = targetDraftFolderPath.trim();
    if (!draftName || !draftFolderPath) {
      return;
    }

    const nextTarget: ExportTargetItem = {
      playlistId: selectedPlaylist.id,
      playlistName: selectedPlaylist.name,
      name: draftName,
      enabled: true,
      folderPath: draftFolderPath,
      pendingNativeArtifacts: selectedPlaylistTarget?.pendingNativeArtifacts ?? ['export.pdb', 'ANLZ analysis files'],
      referenceCoveredTables: selectedPlaylistTarget?.referenceCoveredTables ?? ['tracks', 'artists', 'labels', 'keys'],
      referenceGapTables: selectedPlaylistTarget?.referenceGapTables ?? ['albums', 'playlist_tree', 'playlist_entries', 'columns'],
      rowPlanWarnings: selectedPlaylistTarget?.rowPlanWarnings ?? ['No row plan has been generated for this new target yet.'],
    };

    setExportTargets((current) => {
      const withoutExisting = current.filter((target) => target.playlistId !== selectedPlaylist.id);
      return [nextTarget, ...withoutExisting];
    });
    setPlaylists((current) => current.map((playlist) => (
      playlist.id === selectedPlaylist.id
        ? { ...playlist, hasDeviceTarget: true, deviceTargetName: draftName }
        : playlist
    )));
    setSelectedTargetId(selectedPlaylist.id);
    setActiveView('exports');
    setInspectorTab('native');
    setTargetDraftOpen(false);
  }

  function openPlanDraft() {
    if (!selectedTarget) {
      return;
    }

    const defaultNode = dashboard.topology.nodes.find((node) => node.role === 'export-worker')?.id ?? dashboard.topology.nodes[0]?.id ?? '';
    const defaultSource = dashboard.topology.storages.find((storage) => storage.isManagedLibrary)?.id ?? dashboard.topology.storages[0]?.id ?? '';
    const defaultDestination = dashboard.topology.storages.find((storage) => storage.kind === 'external-drive')?.id ?? dashboard.topology.storages[0]?.id ?? '';

    setPlanExecutionNodeId(defaultNode);
    setPlanSourceStorageId(defaultSource);
    setPlanDestinationStorageId(defaultDestination);
    setPlanTransport('tailscale');
    setPlanDraftOpen(true);
  }

  function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTarget) {
      return;
    }

    const executionNode = dashboard.topology.nodes.find((node) => node.id === planExecutionNodeId);
    const sourceStorage = dashboard.topology.storages.find((storage) => storage.id === planSourceStorageId);
    const destinationStorage = dashboard.topology.storages.find((storage) => storage.id === planDestinationStorageId);
    if (!executionNode || !sourceStorage || !destinationStorage) {
      return;
    }

    const newPlan: ExportPlanItem = {
      id: createId('plan'),
      playlistName: selectedTarget.playlistName,
      status: 'ready',
      targetKind: 'usb-device',
      executionNodeName: executionNode.name,
      sourceStorageName: sourceStorage.name,
      destinationStorageName: destinationStorage.name,
      transport: planTransport,
      requiresRemoteAccess: planTransport !== 'local',
      missingTrackIds: [],
      savedTargetFolderPath: selectedTarget.folderPath,
    };

    setExportPlans((current) => [newPlan, ...current]);
    setPlanDraftOpen(false);
    setInspectorTab('plans');
  }

  function handleKickOffExport() {
    if (!selectedTarget) {
      return;
    }

    const queuedJob: ExportJobItem = {
      id: createId('job'),
      targetKind: 'rekordbox-device',
      targetPath: selectedTarget.folderPath,
      status: 'queued',
      completedAt: null,
    };

    setRecentExports((current) => [queuedJob, ...current]);
    setInspectorTab('plans');
  }

  const summaryTrackWarningCount = dashboard.tracks.filter((track) => track.warnings.length > 0).length;

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">DJ Vault</p>
          <h1>Operator Desk</h1>
          <p className="sidebar-copy">{dashboard.hero.focus}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary views">
          {([
            ['library', 'Library', `${dashboard.summary.trackCount} tracks in the catalog`],
            ['playlists', 'Playlists', `${playlists.length} playlists, ${djSets.length} sets`],
            ['exports', 'Exports', `${exportTargets.length} targets, ${exportPlans.filter((plan) => plan.status === 'ready').length} ready plans`],
            ['topology', 'Topology', `${dashboard.topology.nodes.length} nodes, ${dashboard.topology.storages.length} storage locations`],
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
            {(['all', 'hot', 'cooling', 'dormant', 'warnings'] as SmartCollection[]).map((collection) => (
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
                <strong>{metricValue(collection, dashboard.tracks)}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <h2>Run Focus</h2>
          <div className="focus-stack">
            {dashboard.focusNotes.map((note) => (
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
            <h2>{dashboard.hero.subtitle}</h2>
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
              <span>Refreshed {formatGeneratedAt(dashboard.generatedAt)}</span>
              <span>{resultCount} matching surfaces</span>
              <span>Track browser supports ↑ ↓ Home End and J / K</span>
            </div>
          </div>
        </header>

        <section className="summary-bar">
          <article className="summary-card">
            <span>Tracks</span>
            <strong>{dashboard.summary.trackCount}</strong>
            <small>{dashboard.summary.hotTrackCount} front-of-mind</small>
          </article>
          <article className="summary-card">
            <span>Metadata Gaps</span>
            <strong>{summaryTrackWarningCount}</strong>
            <small>Needs cleanup before USB confidence</small>
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
                  <div
                    className="table-shell"
                    onKeyDown={handleTrackBrowserKeyDown}
                    tabIndex={0}
                  >
                    <div className="table-header table-row">
                      {([
                        ['title', 'Title'],
                        ['artist', 'Artist'],
                        ['recency', 'Recency'],
                        ['bpm', 'BPM'],
                        ['duration', 'Length'],
                        ['warnings', 'Warnings'],
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
                        <span><span className={`bucket-chip bucket-${track.recencyBucket}`}>{track.recencyBucket}</span></span>
                        <span>{track.bpm ? track.bpm.toFixed(1) : '—'}</span>
                        <span>{formatDuration(track.durationSec)}</span>
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
                  <p className="panel-copy">Create crates, attach device targets, and keep the target workflow visible without leaving the app.</p>
                </div>
                <div className="action-row">
                  <button className="action-button primary" onClick={openPlaylistDraft} type="button">New Playlist</button>
                  <button className="action-button" disabled={!selectedPlaylist} onClick={openTargetDraft} type="button">Save Device Target</button>
                </div>
                {playlistDraftOpen ? (
                  <form className="inline-form" onSubmit={handleCreatePlaylist}>
                    <label>
                      <span>Playlist Name</span>
                      <input onChange={(event) => setPlaylistDraftName(event.target.value)} placeholder="Afterhours Utilities" value={playlistDraftName} />
                    </label>
                    <label>
                      <span>Type</span>
                      <select onChange={(event) => setPlaylistDraftType(event.target.value as 'playlist' | 'smart-playlist')} value={playlistDraftType}>
                        <option value="playlist">playlist</option>
                        <option value="smart-playlist">smart-playlist</option>
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
                          setInspectorTab('target');
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
                  <p className="panel-copy">Queue planning and export activity directly from the target surface. These actions are local UI scaffolding for now, but they reflect the real workflow.</p>
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
                        {dashboard.topology.nodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Source Storage</span>
                      <select onChange={(event) => setPlanSourceStorageId(event.target.value)} value={planSourceStorageId}>
                        {dashboard.topology.storages.map((storage) => (
                          <option key={storage.id} value={storage.id}>{storage.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Destination Storage</span>
                      <select onChange={(event) => setPlanDestinationStorageId(event.target.value)} value={planDestinationStorageId}>
                        {dashboard.topology.storages.map((storage) => (
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
                          setInspectorTab('native');
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
                          setInspectorTab('storage');
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
                  ['readiness', 'Export Readiness'],
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
                  <div className="inspector-section">
                    <h4>Old-Device Readiness</h4>
                    <p className="muted">This track will not round-trip cleanly until its metadata gaps are resolved. The current native writer planning especially cares about artist, duration, bitrate, sample rate, and BPM.</p>
                    <div className="tag-row">
                      {selectedTrack.warnings.map((warning) => (
                        <span className="mini-tag caution" key={warning}>{warning}</span>
                      ))}
                    </div>
                  </div>
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
                  <div className="inspector-section">
                    <dl className="inspector-grid">
                      <div><dt>Type</dt><dd>{selectedPlaylist.type}</dd></div>
                      <div><dt>Tracks</dt><dd>{selectedPlaylist.itemCount}</dd></div>
                      <div><dt>Target</dt><dd>{selectedPlaylist.deviceTargetName ?? 'Not configured'}</dd></div>
                    </dl>
                  </div>
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
