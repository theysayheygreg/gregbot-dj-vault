import { startTransition, useDeferredValue, useState } from 'react';

import dashboardJson from './generated/catalog-dashboard.json';
import type { DashboardSnapshot } from './dashboard-types';

const dashboard = dashboardJson as DashboardSnapshot;

type ActiveView = 'library' | 'playlists' | 'exports' | 'topology';
type SmartCollection = 'all' | 'hot' | 'cooling' | 'dormant' | 'warnings';

const smartCollectionLabels: Record<SmartCollection, string> = {
  all: 'All Tracks',
  hot: 'Hot Right Now',
  cooling: 'Cooling Off',
  dormant: 'Dormant',
  warnings: 'Needs Attention',
};

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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}

function metricValue(label: SmartCollection): number {
  switch (label) {
    case 'all':
      return dashboard.tracks.length;
    case 'hot':
      return dashboard.tracks.filter((track) => track.recencyBucket === 'hot').length;
    case 'cooling':
      return dashboard.tracks.filter((track) => track.recencyBucket === 'cooling' || track.recencyBucket === 'new').length;
    case 'dormant':
      return dashboard.tracks.filter((track) => track.recencyBucket === 'dormant' || track.recencyBucket === 'never-played').length;
    case 'warnings':
      return dashboard.tracks.filter((track) => track.warnings.length > 0).length;
  }
}

function filterTrackByCollection(
  track: DashboardSnapshot['tracks'][number],
  collection: SmartCollection,
): boolean {
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

export function App() {
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('library');
  const [activeCollection, setActiveCollection] = useState<SmartCollection>('all');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(dashboard.tracks[0]?.id ?? null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(dashboard.playlists[0]?.id ?? null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(dashboard.exportTargets[0]?.playlistId ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(dashboard.topology.nodes[0]?.id ?? null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visibleTracks = dashboard.tracks.filter((track) => (
    filterTrackByCollection(track, activeCollection)
    && matchesQuery(
      [track.title, track.artist, track.album, track.label, track.keyDisplay, track.recencyBucket, ...track.warnings],
      deferredQuery,
    )
  ));
  const visiblePlaylists = dashboard.playlists.filter((playlist) => matchesQuery(
    [playlist.name, playlist.type, playlist.deviceTargetName],
    deferredQuery,
  ));
  const visibleSets = dashboard.sets.filter((djSet) => matchesQuery([djSet.name], deferredQuery));
  const visibleTargets = dashboard.exportTargets.filter((target) => matchesQuery(
    [target.playlistName, target.name, target.folderPath, ...target.referenceGapTables, ...target.rowPlanWarnings],
    deferredQuery,
  ));
  const visiblePlans = dashboard.exportPlans.filter((plan) => matchesQuery(
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
    ?? dashboard.playlists.find((playlist) => playlist.id === selectedPlaylistId)
    ?? visiblePlaylists[0]
    ?? null;
  const selectedTarget = visibleTargets.find((target) => target.playlistId === selectedTargetId)
    ?? dashboard.exportTargets.find((target) => target.playlistId === selectedTargetId)
    ?? visibleTargets[0]
    ?? null;
  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId)
    ?? dashboard.topology.nodes.find((node) => node.id === selectedNodeId)
    ?? visibleNodes[0]
    ?? null;

  const selectedPlaylistSets = selectedPlaylist
    ? visibleSets.filter((djSet) => matchesQuery([djSet.name, selectedPlaylist.name], ''))
    : visibleSets;
  const selectedTargetPlans = selectedTarget
    ? visiblePlans.filter((plan) => plan.playlistName === selectedTarget.playlistName)
    : visiblePlans;
  const selectedNodeStorages = selectedNode
    ? visibleStorages.filter((storage) => storage.nodeName === selectedNode.name)
    : visibleStorages;

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
            ['playlists', 'Playlists', `${dashboard.summary.playlistCount} playlists, ${dashboard.summary.setCount} sets`],
            ['exports', 'Exports', `${dashboard.summary.exportTargetCount} targets, ${dashboard.summary.readyPlanCount} ready plans`],
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
                <strong>{metricValue(collection)}</strong>
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
            <strong>{dashboard.summary.trackWarningCount}</strong>
            <small>Needs cleanup before USB confidence</small>
          </article>
          <article className="summary-card">
            <span>Export Plans</span>
            <strong>{dashboard.summary.readyPlanCount}</strong>
            <small>Ready to run</small>
          </article>
          <article className="summary-card">
            <span>Recent Exports</span>
            <strong>{dashboard.summary.recentExportCount}</strong>
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
                  <p className="panel-copy">Dense by design. This should feel closer to a real DJ library browser than a marketing dashboard.</p>
                </div>
                {visibleTracks.length > 0 ? (
                  <div className="table-shell">
                    <div className="table-header table-row">
                      <span>Title</span>
                      <span>Artist</span>
                      <span>Recency</span>
                      <span>BPM</span>
                      <span>Length</span>
                      <span>Warnings</span>
                    </div>
                    {visibleTracks.map((track) => (
                      <button
                        className={`table-row table-button ${selectedTrack?.id === track.id ? 'is-selected' : ''}`}
                        key={track.id}
                        onClick={() => setSelectedTrackId(track.id)}
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
                  <p className="panel-copy">Playlists are crates. Sets are performance narratives. The UI keeps that distinction visible.</p>
                </div>
                {visiblePlaylists.length > 0 ? (
                  <div className="stack">
                    {visiblePlaylists.map((playlist) => (
                      <button
                        className={`list-button ${selectedPlaylist?.id === playlist.id ? 'is-selected' : ''}`}
                        key={playlist.id}
                        onClick={() => setSelectedPlaylistId(playlist.id)}
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
                  <p className="panel-copy">This is the operational surface: which crate is ready, where it can run, and what native artifacts still block hardware confidence.</p>
                </div>
                {visibleTargets.length > 0 ? (
                  <div className="stack">
                    {visibleTargets.map((target) => (
                      <button
                        className={`list-button ${selectedTarget?.playlistId === target.playlistId ? 'is-selected' : ''}`}
                        key={target.playlistId}
                        onClick={() => setSelectedTargetId(target.playlistId)}
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
                  <h3 className="subhead">Execution Plans</h3>
                  {visiblePlans.length > 0 ? (
                    <div className="stack">
                      {visiblePlans.map((plan) => (
                        <article className="list-card" key={plan.id}>
                          <div>
                            <strong>{plan.playlistName ?? 'Unknown playlist'}</strong>
                            <small>{plan.executionNodeName} via {plan.transport ?? 'manual'}</small>
                          </div>
                          <span className={`status-chip ${plan.status === 'ready' ? 'status-ready' : 'status-muted'}`}>{plan.status}</span>
                        </article>
                      ))}
                    </div>
                  ) : <EmptyState message="No execution plans match the current filter yet." />}
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
                  <p className="panel-copy">The product bet is here: the database, media, and USB executor do not need to be on the same machine.</p>
                </div>
                {visibleNodes.length > 0 ? (
                  <div className="stack">
                    {visibleNodes.map((node) => (
                      <button
                        className={`list-button ${selectedNode?.id === node.id ? 'is-selected' : ''}`}
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
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
            {activeView === 'library' && selectedTrack ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h3>{selectedTrack.title}</h3>
                  </div>
                  <span className={`bucket-chip bucket-${selectedTrack.recencyBucket}`}>{selectedTrack.recencyBucket}</span>
                </div>
                <div className="inspector-section">
                  <dl className="inspector-grid">
                    <div>
                      <dt>Artist</dt>
                      <dd>{selectedTrack.artist ?? 'Unknown artist'}</dd>
                    </div>
                    <div>
                      <dt>Album</dt>
                      <dd>{selectedTrack.album ?? 'Unknown album'}</dd>
                    </div>
                    <div>
                      <dt>Key</dt>
                      <dd>{selectedTrack.keyDisplay ?? 'No key'}</dd>
                    </div>
                    <div>
                      <dt>BPM</dt>
                      <dd>{selectedTrack.bpm ? selectedTrack.bpm.toFixed(1) : 'No BPM'}</dd>
                    </div>
                    <div>
                      <dt>Length</dt>
                      <dd>{formatDuration(selectedTrack.durationSec)}</dd>
                    </div>
                    <div>
                      <dt>Recency Score</dt>
                      <dd>{selectedTrack.recencyScore}</dd>
                    </div>
                  </dl>
                </div>
                <div className="inspector-section">
                  <h4>Mental Weight</h4>
                  <p>{selectedTrack.mentalWeight.replace(/-/g, ' ')}</p>
                  <p className="muted">Added {formatDate(selectedTrack.addedAt)} · last played {formatDate(selectedTrack.lastPlayedAt)}</p>
                </div>
                <div className="inspector-section">
                  <h4>Warnings</h4>
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
                <div className="inspector-section">
                  <dl className="inspector-grid">
                    <div>
                      <dt>Type</dt>
                      <dd>{selectedPlaylist.type}</dd>
                    </div>
                    <div>
                      <dt>Tracks</dt>
                      <dd>{selectedPlaylist.itemCount}</dd>
                    </div>
                    <div>
                      <dt>Device Target</dt>
                      <dd>{selectedPlaylist.deviceTargetName ?? 'Not configured'}</dd>
                    </div>
                  </dl>
                </div>
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
                <div className="inspector-section">
                  <h4>Target Path</h4>
                  <p className="mono">{selectedTarget.folderPath ?? 'No target folder saved'}</p>
                </div>
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
                <div className="inspector-section">
                  <dl className="inspector-grid">
                    <div>
                      <dt>Role</dt>
                      <dd>{selectedNode.role}</dd>
                    </div>
                    <div>
                      <dt>Transport</dt>
                      <dd>{selectedNode.transport ?? 'manual'}</dd>
                    </div>
                    <div>
                      <dt>Address</dt>
                      <dd>{selectedNode.address ?? 'No address'}</dd>
                    </div>
                  </dl>
                </div>
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
                <div className="inspector-section">
                  <h4>Recent Exports</h4>
                  {dashboard.recentExports.length > 0 ? (
                    <div className="stack tight">
                      {dashboard.recentExports.slice(0, 3).map((job) => (
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
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
