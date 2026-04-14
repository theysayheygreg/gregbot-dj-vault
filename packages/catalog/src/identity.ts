import { DatabaseSync } from 'node:sqlite';

export type IdentityClusterTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  canonicalPath: string;
  hashSha256: string;
  contentHashSha256: string | null;
  observedSourcePathCount: number;
  observedTitleOpinionCount: number;
};

export type IdentityCluster = {
  clusterKey: string;
  trackCount: number;
  tracks: IdentityClusterTrack[];
};

export type IdentityReport = {
  totalTrackCount: number;
  contentHashTrackCount: number;
  duplicateClusterCount: number;
  clusters: IdentityCluster[];
};

export function generateIdentityReport(databasePath: string): IdentityReport {
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const totalTrackCountRow = database.prepare(`SELECT COUNT(*) AS count FROM tracks`).get() as { count: number };
    const contentHashTrackCountRow = database.prepare(`
      SELECT COUNT(*) AS count
      FROM tracks
      WHERE content_hash_sha256 IS NOT NULL
    `).get() as { count: number };

    const trackRows = database.prepare(`
      SELECT
        tracks.id,
        tracks.title,
        tracks.album,
        tracks.canonical_path,
        tracks.hash_sha256,
        tracks.content_hash_sha256,
        COALESCE(MAX(CASE WHEN track_people.role = 'artist' THEN track_people.name END), NULL) AS artist
      FROM tracks
      LEFT JOIN track_people ON track_people.track_id = tracks.id
      GROUP BY tracks.id
      ORDER BY tracks.title COLLATE NOCASE, tracks.id
    `).all() as Array<{
      id: string;
      title: string;
      album: string | null;
      canonical_path: string;
      hash_sha256: string;
      content_hash_sha256: string | null;
      artist: string | null;
    }>;

    const observedSourcePathRows = database.prepare(`
      SELECT entity_id AS track_id, COUNT(DISTINCT source_ref) AS count
      FROM metadata_provenance
      WHERE entity_kind = 'track' AND field_path = 'file.sourcePath'
      GROUP BY entity_id
    `).all() as Array<{ track_id: string; count: number }>;
    const observedTitleRows = database.prepare(`
      SELECT entity_id AS track_id, COUNT(DISTINCT value_json) AS count
      FROM metadata_provenance
      WHERE entity_kind = 'track' AND field_path = 'identity.title'
      GROUP BY entity_id
    `).all() as Array<{ track_id: string; count: number }>;

    const sourceCountByTrackId = new Map(observedSourcePathRows.map((row) => [row.track_id, row.count]));
    const titleCountByTrackId = new Map(observedTitleRows.map((row) => [row.track_id, row.count]));

    const clustersByKey = new Map<string, IdentityClusterTrack[]>();
    for (const row of trackRows) {
      const clusterKey = row.content_hash_sha256 ?? `file:${row.hash_sha256}`;
      const tracks = clustersByKey.get(clusterKey) ?? [];
      tracks.push({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        canonicalPath: row.canonical_path,
        hashSha256: row.hash_sha256,
        contentHashSha256: row.content_hash_sha256,
        observedSourcePathCount: sourceCountByTrackId.get(row.id) ?? 0,
        observedTitleOpinionCount: titleCountByTrackId.get(row.id) ?? 0,
      });
      clustersByKey.set(clusterKey, tracks);
    }

    const clusters = [...clustersByKey.entries()]
      .filter(([, tracks]) => tracks.length > 1)
      .map(([clusterKey, tracks]) => ({
        clusterKey,
        trackCount: tracks.length,
        tracks,
      }))
      .sort((a, b) => b.trackCount - a.trackCount || a.clusterKey.localeCompare(b.clusterKey));

    return {
      totalTrackCount: totalTrackCountRow.count,
      contentHashTrackCount: contentHashTrackCountRow.count,
      duplicateClusterCount: clusters.length,
      clusters,
    };
  } finally {
    database.close();
  }
}
