import { useDeferredValue, useState } from 'react';

import dashboardJson from './generated/catalog-dashboard.json';
import type { DashboardSnapshot } from './dashboard-types';

const dashboard = dashboardJson as DashboardSnapshot;

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
  const safeSeconds = Math.max(0, seconds);
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

export function App() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visibleTracks = dashboard.tracks.filter((track) => matchesQuery(
    [track.title, track.artist, track.album, track.label, track.keyDisplay, track.recencyBucket, ...track.warnings],
    deferredQuery,
  ));
  const visiblePlaylists = dashboard.playlists.filter((playlist) => matchesQuery(
    [playlist.name, playlist.type, playlist.deviceTargetName],
    deferredQuery,
  ));
  const visibleTargets = dashboard.exportTargets.filter((target) => matchesQuery(
    [target.playlistName, target.name, target.folderPath, ...target.referenceGapTables, ...target.rowPlanWarnings],
    deferredQuery,
  ));
  const visiblePlans = dashboard.exportPlans.filter((plan) => matchesQuery(
    [plan.playlistName, plan.executionNodeName, plan.sourceStorageName, plan.destinationStorageName, plan.transport, plan.status],
    deferredQuery,
  ));
  const resultCount = visibleTracks.length + visiblePlaylists.length + visibleTargets.length + visiblePlans.length;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">DJ Vault Operator Surface</p>
          <h1>{dashboard.hero.title}</h1>
          <p className="lede">{dashboard.hero.subtitle}</p>
          <p className="focus-line">{dashboard.hero.focus}</p>
        </div>

        <div className="hero-meta">
          <label className="search-card">
            <span>Search library, playlists, exports</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Warmup, tailscale, missing artist, hot..."
            />
          </label>
          <p className="meta-stamp">Snapshot refreshed {formatGeneratedAt(dashboard.generatedAt)}</p>
          <p className="meta-stamp">{resultCount} matching surfaces in the current snapshot</p>
        </div>
      </section>

      <section className="metric-strip">
        <article className="metric-card">
          <span className="metric-label">Tracks</span>
          <strong>{dashboard.summary.trackCount}</strong>
          <small>{dashboard.summary.hotTrackCount} hot right now</small>
        </article>
        <article className="metric-card">
          <span className="metric-label">Playlists</span>
          <strong>{dashboard.summary.playlistCount}</strong>
          <small>{dashboard.summary.exportTargetCount} device targets saved</small>
        </article>
        <article className="metric-card">
          <span className="metric-label">Sets</span>
          <strong>{dashboard.summary.setCount}</strong>
          <small>Separate from playlists on purpose</small>
        </article>
        <article className="metric-card">
          <span className="metric-label">Export Plans</span>
          <strong>{dashboard.summary.readyPlanCount}</strong>
          <small>Ready to run without more planning</small>
        </article>
        <article className="metric-card warning">
          <span className="metric-label">Metadata Gaps</span>
          <strong>{dashboard.summary.trackWarningCount}</strong>
          <small>Surfaced before native USB write</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-tall">
          <div className="panel-heading">
            <h2>Export Runway</h2>
            <p>Saved targets, native gaps, and remote execution plans for the old-device workflow.</p>
          </div>

          <div className="target-list">
            {visibleTargets.length > 0 ? visibleTargets.map((target) => (
              <article className="target-card" key={target.playlistId}>
                <div className="target-head">
                  <div>
                    <h3>{target.playlistName}</h3>
                    <p>{target.name ?? 'Unnamed target'}</p>
                  </div>
                  <span className={`status-chip ${target.enabled ? 'status-ready' : 'status-muted'}`}>
                    {target.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="path-line">{target.folderPath ?? 'No folder path saved'}</p>
                <div className="tag-row">
                  {target.referenceCoveredTables.map((item) => (
                    <span className="mini-tag success" key={`${target.playlistId}-${item}`}>{item}</span>
                  ))}
                  {target.referenceGapTables.map((item) => (
                    <span className="mini-tag caution" key={`${target.playlistId}-${item}`}>{item}</span>
                  ))}
                  {target.pendingNativeArtifacts.map((item) => (
                    <span className="mini-tag muted" key={`${target.playlistId}-${item}`}>{item}</span>
                  ))}
                </div>
                {target.rowPlanWarnings.length > 0 ? (
                  <ul className="compact-list">
                    {target.rowPlanWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-note">No row-plan warnings on the current snapshot.</p>
                )}
              </article>
            )) : <EmptyState message="No export targets match the current filter yet." />}
          </div>

          <div className="subsection">
            <h3>Execution Plans</h3>
            <div className="plan-list">
              {visiblePlans.length > 0 ? visiblePlans.map((plan) => (
                <article className="plan-card" key={plan.id}>
                  <div className="plan-topline">
                    <strong>{plan.playlistName ?? 'Unknown playlist'}</strong>
                    <span className={`status-chip ${plan.status === 'ready' ? 'status-ready' : 'status-muted'}`}>{plan.status}</span>
                  </div>
                  <p>{plan.executionNodeName} via {plan.transport ?? 'manual'}</p>
                  <p className="muted">
                    {plan.sourceStorageName ?? 'Unknown source'} → {plan.destinationStorageName ?? 'Unknown destination'}
                  </p>
                  {plan.requiresRemoteAccess ? <p className="quiet-note">Remote execution required.</p> : null}
                  {plan.savedTargetFolderPath ? <p className="path-line">{plan.savedTargetFolderPath}</p> : null}
                  {plan.missingTrackIds.length > 0 ? (
                    <p className="quiet-note">Missing track coverage: {plan.missingTrackIds.length}</p>
                  ) : null}
                </article>
              )) : <EmptyState message="No export plans match the current filter yet." />}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Library Pulse</h2>
            <p>Recency, metadata completeness, and what will matter when the USB writer turns native.</p>
          </div>

          <div className="track-list">
            {visibleTracks.length > 0 ? visibleTracks.map((track) => (
              <article className="track-card" key={track.id}>
                <div className="track-topline">
                  <div>
                    <h3>{track.title}</h3>
                    <p>{track.artist ?? 'Unknown artist'}</p>
                  </div>
                  <span className={`bucket-chip bucket-${track.recencyBucket}`}>{track.recencyBucket}</span>
                </div>
                <div className="track-meta">
                  <span>{track.album ?? 'Unknown album'}</span>
                  <span>{track.keyDisplay ?? 'No key'}</span>
                  <span>{track.bpm ? `${track.bpm.toFixed(1)} BPM` : 'No BPM'}</span>
                  <span>{formatDuration(track.durationSec)}</span>
                </div>
                <p className="quiet-note">
                  {track.mentalWeight.replace(/-/g, ' ')} · played {track.playCount} times · last touched {formatDate(track.lastPlayedAt ?? track.addedAt)}
                </p>
                {track.warnings.length > 0 ? (
                  <div className="tag-row">
                    {track.warnings.map((warning) => (
                      <span className="mini-tag danger" key={`${track.id}-${warning}`}>{warning}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            )) : <EmptyState message="No tracks match the current filter yet." />}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Playlists and Sets</h2>
            <p>The catalog already distinguishes crates from performance sequences.</p>
          </div>

          <div className="stack">
            {visiblePlaylists.length > 0 ? visiblePlaylists.map((playlist) => (
              <article className="list-card" key={playlist.id}>
                <div>
                  <h3>{playlist.name}</h3>
                  <p>{playlist.itemCount} tracks · {playlist.type}</p>
                </div>
                <span className={`status-chip ${playlist.hasDeviceTarget ? 'status-ready' : 'status-muted'}`}>
                  {playlist.deviceTargetName ?? 'No target'}
                </span>
              </article>
            )) : <EmptyState message="No playlists match the current filter yet." />}
          </div>

          <div className="subsection">
            <h3>DJ Sets</h3>
            <div className="stack">
              {dashboard.sets.length > 0 ? dashboard.sets.map((djSet) => (
                <article className="list-card" key={djSet.id}>
                  <div>
                    <h3>{djSet.name}</h3>
                    <p>{djSet.trackCount} programmed transitions</p>
                  </div>
                </article>
              )) : <EmptyState message="No DJ sets have been authored yet." />}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Topology</h2>
            <p>Where the database lives, where the music lives, and where a USB can actually be built.</p>
          </div>

          <div className="subsection">
            <h3>Nodes</h3>
            <div className="stack">
              {dashboard.topology.nodes.map((node) => (
                <article className="list-card" key={node.id}>
                  <div>
                    <h3>{node.name}</h3>
                    <p>{node.role} · {node.transport ?? 'manual'} · {node.address ?? 'no address'}</p>
                  </div>
                  <span className={`status-chip ${node.isOnline ? 'status-ready' : 'status-muted'}`}>
                    {node.isOnline ? 'Online' : 'Offline'}
                  </span>
                </article>
              ))}
            </div>
          </div>

          <div className="subsection">
            <h3>Storage</h3>
            <div className="stack">
              {dashboard.topology.storages.map((storage) => (
                <article className="list-card" key={storage.id}>
                  <div>
                    <h3>{storage.name}</h3>
                    <p>{storage.nodeName} · {storage.kind}</p>
                    <p className="path-line">{storage.mountPath ?? 'No mount path recorded'}</p>
                  </div>
                  <div className="tag-row">
                    {storage.isManagedLibrary ? <span className="mini-tag success">Managed library</span> : null}
                    <span className={`mini-tag ${storage.isAvailable ? 'success' : 'muted'}`}>
                      {storage.isAvailable ? 'Available' : 'Offline'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Recent Exports</h2>
            <p>The audit trail matters. If export is compilation, the history needs to stay visible.</p>
          </div>
          <div className="stack">
            {dashboard.recentExports.length > 0 ? dashboard.recentExports.map((job) => (
              <article className="list-card" key={job.id}>
                <div>
                  <h3>{job.targetKind}</h3>
                  <p>{formatDate(job.completedAt)}</p>
                  <p className="path-line">{job.targetPath ?? 'No target path'}</p>
                </div>
                <span className={`status-chip ${job.status === 'completed' ? 'status-ready' : 'status-muted'}`}>
                  {job.status}
                </span>
              </article>
            )) : <EmptyState message="No export jobs have completed yet." />}
          </div>
        </article>
      </section>

      <section className="notes-panel">
        <h2>Current Focus Notes</h2>
        <div className="notes-grid">
          {dashboard.focusNotes.length > 0 ? dashboard.focusNotes.map((note) => (
            <article className="note-card" key={note}>
              <p>{note}</p>
            </article>
          )) : <EmptyState message="No focus notes are recorded in the current snapshot." />}
        </div>
      </section>
    </main>
  );
}
