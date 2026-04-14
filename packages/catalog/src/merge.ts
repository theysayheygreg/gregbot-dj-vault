import { DatabaseSync } from 'node:sqlite';

type ScalarOpinionRow = {
  track_id: string;
  field_path: string;
  source_kind: string;
  source_name: string;
  source_ref: string | null;
  confidence: number | null;
  value_json: string;
};

type TrackRow = {
  id: string;
  title: string;
  album: string | null;
  comment: string | null;
  rating: number | null;
};

type TrackArtistRow = {
  track_id: string;
  name: string;
  position: number;
};

export type MergeFieldOpinion = {
  value: string;
  occurrenceCount: number;
  score: number;
  sourceRefs: string[];
};

export type TrackMergePlan = {
  trackId: string;
  current: {
    title: string;
    artist: string | null;
    album: string | null;
  };
  selected: {
    title: string;
    artist: string | null;
    album: string | null;
  };
  opinions: {
    title: MergeFieldOpinion[];
    artist: MergeFieldOpinion[];
    album: MergeFieldOpinion[];
  };
  changedFields: string[];
};

export type MergeReport = {
  generatedAt: string;
  trackCount: number;
  trackPlanCount: number;
  changedTrackCount: number;
  plans: TrackMergePlan[];
};

type CandidateOpinion = {
  value: string;
  sourceRef: string | null;
  score: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function sourcePriority(sourceKind: string, sourceRef: string | null): number {
  if (sourceRef?.includes('/canonical-embedded/')) {
    return 140;
  }
  if (sourceRef?.includes('/rekordbox6-dirty/')) {
    return 70;
  }
  if (sourceRef?.includes('/traktor-dirty/')) {
    return 60;
  }

  switch (sourceKind) {
    case 'embedded-tags':
      return 45;
    case 'vendor-library':
      return 40;
    case 'derived':
      return 20;
    case 'normalized':
      return 15;
    default:
      return 10;
  }
}

function aggregateOpinions(candidates: CandidateOpinion[]): MergeFieldOpinion[] {
  const grouped = new Map<string, { occurrenceCount: number; score: number; sourceRefs: Set<string> }>();

  for (const candidate of candidates) {
    const existing = grouped.get(candidate.value) ?? {
      occurrenceCount: 0,
      score: 0,
      sourceRefs: new Set<string>(),
    };
    existing.occurrenceCount += 1;
    existing.score += candidate.score;
    if (candidate.sourceRef) {
      existing.sourceRefs.add(candidate.sourceRef);
    }
    grouped.set(candidate.value, existing);
  }

  return [...grouped.entries()]
    .map(([value, aggregate]) => ({
      value,
      occurrenceCount: aggregate.occurrenceCount,
      score: Math.round(aggregate.score * 10) / 10,
      sourceRefs: [...aggregate.sourceRefs].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.score - a.score || b.occurrenceCount - a.occurrenceCount || a.value.localeCompare(b.value));
}

function bestOpinion(opinions: MergeFieldOpinion[], fallback: string | null): string | null {
  if (opinions.length > 0) {
    return opinions[0].value;
  }
  return fallback;
}

function parseScalarOpinionRows(rows: ScalarOpinionRow[], fieldPath: string): CandidateOpinion[] {
  return rows
    .filter((row) => row.field_path === fieldPath)
    .flatMap((row) => {
      try {
        const value = normalizeText(JSON.parse(row.value_json));
        if (!value) {
          return [];
        }
        return [{
          value,
          sourceRef: row.source_ref,
          score: sourcePriority(row.source_kind, row.source_ref) + ((row.confidence ?? 0.5) * 10),
        }];
      } catch {
        return [];
      }
    });
}

function parseArtistOpinions(rows: ScalarOpinionRow[]): CandidateOpinion[] {
  const artistRows = rows.filter((row) => row.field_path.startsWith('identity.artist.'));
  const grouped = new Map<string, Array<{ index: number; value: string; row: ScalarOpinionRow }>>();

  for (const row of artistRows) {
    const index = Number.parseInt(row.field_path.split('.').at(-1) ?? '0', 10);
    try {
      const value = normalizeText(JSON.parse(row.value_json));
      if (!value) {
        continue;
      }
      const groupKey = row.source_ref ?? `${row.source_kind}:${row.source_name}`;
      const entries = grouped.get(groupKey) ?? [];
      entries.push({ index: Number.isFinite(index) ? index : 0, value, row });
      grouped.set(groupKey, entries);
    } catch {
      continue;
    }
  }

  return [...grouped.entries()].flatMap(([groupKey, entries]) => {
    const ordered = entries.sort((a, b) => a.index - b.index);
    const value = normalizeText(ordered.map((entry) => entry.value).join(' / '));
    if (!value) {
      return [];
    }
    const firstRow = ordered[0]?.row;
    return [{
      value,
      sourceRef: groupKey,
      score: sourcePriority(firstRow?.source_kind ?? 'derived', firstRow?.source_ref ?? groupKey) + (((firstRow?.confidence ?? 0.5)) * 10),
    }];
  });
}

function currentArtist(artists: TrackArtistRow[], trackId: string): string | null {
  const names = artists
    .filter((row) => row.track_id === trackId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.name);
  return names.length > 0 ? names.join(' / ') : null;
}

export function generateMergeReport(databasePath: string): MergeReport {
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const tracks = database.prepare(`
      SELECT id, title, album, comment, rating
      FROM tracks
      ORDER BY title COLLATE NOCASE, id
    `).all() as TrackRow[];
    const artists = database.prepare(`
      SELECT track_id, name, position
      FROM track_people
      WHERE role = 'artist'
      ORDER BY track_id, position
    `).all() as TrackArtistRow[];
    const provenanceRows = database.prepare(`
      SELECT entity_id AS track_id, field_path, source_kind, source_name, source_ref, confidence, value_json
      FROM metadata_provenance
      WHERE entity_kind = 'track'
        AND (
          field_path = 'identity.title'
          OR field_path = 'identity.album'
          OR field_path LIKE 'identity.artist.%'
        )
      ORDER BY entity_id, observed_at, id
    `).all() as ScalarOpinionRow[];

    const rowsByTrackId = new Map<string, ScalarOpinionRow[]>();
    for (const row of provenanceRows) {
      const rows = rowsByTrackId.get(row.track_id) ?? [];
      rows.push(row);
      rowsByTrackId.set(row.track_id, rows);
    }

    const plans = tracks.map((track) => {
      const trackRows = rowsByTrackId.get(track.id) ?? [];
      const titleOpinions = aggregateOpinions(parseScalarOpinionRows(trackRows, 'identity.title'));
      const albumOpinions = aggregateOpinions(parseScalarOpinionRows(trackRows, 'identity.album'));
      const artistOpinions = aggregateOpinions(parseArtistOpinions(trackRows));
      const current = {
        title: track.title,
        artist: currentArtist(artists, track.id),
        album: normalizeText(track.album),
      };
      const selected = {
        title: bestOpinion(titleOpinions, current.title) ?? current.title,
        artist: bestOpinion(artistOpinions, current.artist),
        album: bestOpinion(albumOpinions, current.album),
      };
      const changedFields = [
        current.title !== selected.title ? 'title' : null,
        current.artist !== selected.artist ? 'artist' : null,
        current.album !== selected.album ? 'album' : null,
      ].filter(Boolean) as string[];

      return {
        trackId: track.id,
        current,
        selected,
        opinions: {
          title: titleOpinions,
          artist: artistOpinions,
          album: albumOpinions,
        },
        changedFields,
      };
    });

    return {
      generatedAt: nowIso(),
      trackCount: tracks.length,
      trackPlanCount: plans.length,
      changedTrackCount: plans.filter((plan) => plan.changedFields.length > 0).length,
      plans,
    };
  } finally {
    database.close();
  }
}

export function applyMergeSelections(databasePath: string): { changedTrackCount: number } {
  const report = generateMergeReport(databasePath);
  const database = new DatabaseSync(databasePath);
  const observedAt = nowIso();

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const updateTrack = database.prepare(`
      UPDATE tracks
      SET title = ?, album = ?, updated_at = ?
      WHERE id = ?
    `);
    const deleteArtists = database.prepare(`DELETE FROM track_people WHERE track_id = ? AND role = 'artist'`);
    const insertArtist = database.prepare(`
      INSERT INTO track_people (track_id, role, name, position)
      VALUES (?, 'artist', ?, ?)
    `);
    const insertProvenance = database.prepare(`
      INSERT INTO metadata_provenance (
        entity_kind, entity_id, field_path, source_kind, source_name, source_ref, confidence, observed_at, value_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let changedTrackCount = 0;

    for (const plan of report.plans) {
      if (plan.changedFields.length === 0) {
        continue;
      }

      updateTrack.run(
        plan.selected.title,
        plan.selected.album,
        observedAt,
        plan.trackId,
      );

      if (plan.current.artist !== plan.selected.artist) {
        deleteArtists.run(plan.trackId);
        const artists = plan.selected.artist ? plan.selected.artist.split(' / ').map((entry) => normalizeText(entry)).filter(Boolean) as string[] : [];
        for (const [index, artist] of artists.entries()) {
          insertArtist.run(plan.trackId, artist, index);
        }
      }

      if (plan.current.title !== plan.selected.title) {
        insertProvenance.run('track', plan.trackId, 'merge.title', 'merge-policy', 'content-cluster-v1', null, 1.0, observedAt, JSON.stringify(plan.selected.title));
      }
      if (plan.current.album !== plan.selected.album) {
        insertProvenance.run('track', plan.trackId, 'merge.album', 'merge-policy', 'content-cluster-v1', null, 1.0, observedAt, JSON.stringify(plan.selected.album));
      }
      if (plan.current.artist !== plan.selected.artist) {
        insertProvenance.run('track', plan.trackId, 'merge.artist', 'merge-policy', 'content-cluster-v1', null, 1.0, observedAt, JSON.stringify(plan.selected.artist));
      }

      changedTrackCount += 1;
    }

    database.exec('COMMIT');
    return { changedTrackCount };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
