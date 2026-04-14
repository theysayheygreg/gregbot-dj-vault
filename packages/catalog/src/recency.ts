import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

type TrackMatch = {
  id: string;
  title: string;
};

type TrackRecencyRow = {
  id: string;
  title: string;
  added_at: string;
  last_played_at: string | null;
  play_count: number;
  recent_session_count: number;
  session_presence_count: number;
};

export type CreatePlaybackSessionInput = {
  startedAt?: string | null;
  endedAt?: string | null;
  sourceKind: string;
  sourceRef?: string | null;
  venue?: string | null;
  context?: string | null;
  note?: string | null;
};

export type LogPlaybackEventInput = {
  trackRef: string;
  playedAt?: string | null;
  sessionId?: string | null;
  positionInSession?: number | null;
  sourceKind: string;
  sourceRef?: string | null;
  confidence?: number | null;
  note?: string | null;
};

export type TrackRecencySummary = {
  trackId: string;
  title: string;
  addedAt: string;
  lastPlayedAt: string | null;
  playCount: number;
  recentSessionCount: number;
  sessionPresenceCount: number;
  addedDaysAgo: number;
  playedDaysAgo: number | null;
  recencyBucket: 'new' | 'hot' | 'cooling' | 'dormant' | 'never-played';
  mentalWeight: 'front-of-mind' | 'active-option' | 'archive-pressure' | 'unknown';
  recencyScore: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function resolveTrack(database: DatabaseSync, trackRef: string): TrackMatch {
  const ref = requireNonEmpty(trackRef, 'trackRef');
  const matches = database.prepare(`
    SELECT id, title
    FROM tracks
    WHERE id = ?
       OR hash_sha256 = ?
       OR content_hash_sha256 = ?
       OR lower(title) = lower(?)
       OR lower(file_name) = lower(?)
    ORDER BY title COLLATE NOCASE, id
  `).all(ref, ref, ref, ref, ref) as TrackMatch[];

  if (matches.length === 0) {
    throw new Error(`No track matched "${ref}".`);
  }

  if (matches.length > 1) {
    const options = matches.map((match) => `${match.id} (${match.title})`).join(', ');
    throw new Error(`Track reference "${ref}" is ambiguous. Matches: ${options}`);
  }

  return matches[0];
}

function diffDays(fromIso: string, toDate = new Date()): number {
  const ms = toDate.getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function deriveRecencySummary(row: TrackRecencyRow, now = new Date()): TrackRecencySummary {
  const addedDaysAgo = diffDays(row.added_at, now);
  const playedDaysAgo = row.last_played_at ? diffDays(row.last_played_at, now) : null;

  let recencyBucket: TrackRecencySummary['recencyBucket'];
  let mentalWeight: TrackRecencySummary['mentalWeight'];
  let recencyScore = 0;

  if (playedDaysAgo === null) {
    recencyBucket = 'never-played';
    mentalWeight = addedDaysAgo <= 14 ? 'front-of-mind' : 'archive-pressure';
    recencyScore = Math.max(15, 70 - addedDaysAgo);
  } else if (playedDaysAgo <= 7) {
    recencyBucket = 'hot';
    mentalWeight = 'front-of-mind';
    recencyScore = 100 - playedDaysAgo * 4 + Math.min(row.play_count, 10) + row.recent_session_count * 3;
  } else if (playedDaysAgo <= 30) {
    recencyBucket = 'cooling';
    mentalWeight = 'active-option';
    recencyScore = 72 - playedDaysAgo + Math.min(row.play_count, 10) + row.recent_session_count * 2;
  } else if (addedDaysAgo <= 21 && row.play_count === 0) {
    recencyBucket = 'new';
    mentalWeight = 'front-of-mind';
    recencyScore = 78 - addedDaysAgo;
  } else {
    recencyBucket = 'dormant';
    mentalWeight = 'archive-pressure';
    recencyScore = Math.max(5, 40 - Math.min(playedDaysAgo, 90) / 2 + row.session_presence_count);
  }

  return {
    trackId: row.id,
    title: row.title,
    addedAt: row.added_at,
    lastPlayedAt: row.last_played_at,
    playCount: row.play_count,
    recentSessionCount: row.recent_session_count,
    sessionPresenceCount: row.session_presence_count,
    addedDaysAgo,
    playedDaysAgo,
    recencyBucket,
    mentalWeight,
    recencyScore: Math.round(recencyScore * 10) / 10,
  };
}

export function createPlaybackSession(databasePath: string, input: CreatePlaybackSessionInput): { id: string; startedAt: string } {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const startedAt = input.startedAt ?? nowIso();

  try {
    database.prepare(`
      INSERT INTO playback_sessions (id, started_at, ended_at, source_kind, source_ref, venue, context, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      startedAt,
      input.endedAt ?? null,
      requireNonEmpty(input.sourceKind, 'sourceKind'),
      input.sourceRef ?? null,
      input.venue ?? null,
      input.context ?? null,
      input.note ?? null,
    );

    return { id, startedAt };
  } finally {
    database.close();
  }
}

export function logPlaybackEvent(databasePath: string, input: LogPlaybackEventInput): { id: string; trackId: string; playedAt: string } {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const playedAt = input.playedAt ?? nowIso();

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const track = resolveTrack(database, input.trackRef);
    if (input.sessionId) {
      const session = database.prepare(`SELECT id FROM playback_sessions WHERE id = ?`).get(input.sessionId) as { id: string } | undefined;
      if (!session) {
        throw new Error(`Playback session ${input.sessionId} not found.`);
      }
    }

    database.prepare(`
      INSERT INTO playback_events (
        id, session_id, track_id, played_at, position_in_session, source_kind, source_ref, confidence, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.sessionId ?? null,
      track.id,
      playedAt,
      input.positionInSession ?? null,
      requireNonEmpty(input.sourceKind, 'sourceKind'),
      input.sourceRef ?? null,
      input.confidence ?? 1.0,
      input.note ?? null,
    );

    database.prepare(`
      UPDATE tracks
      SET play_count = play_count + 1, last_played_at = ?, updated_at = ?
      WHERE id = ?
    `).run(playedAt, nowIso(), track.id);

    database.exec('COMMIT');
    return { id, trackId: track.id, playedAt };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export function getTrackRecencySummaries(databasePath: string, limit = 25): TrackRecencySummary[] {
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const rows = database.prepare(`
      SELECT
        tracks.id,
        tracks.title,
        tracks.added_at,
        tracks.last_played_at,
        tracks.play_count,
        COUNT(DISTINCT CASE
          WHEN playback_events.played_at >= datetime('now', '-30 day')
          THEN COALESCE(playback_events.session_id, playback_events.id)
        END) AS recent_session_count,
        COUNT(DISTINCT COALESCE(playback_events.session_id, playback_events.id)) AS session_presence_count
      FROM tracks
      LEFT JOIN playback_events ON playback_events.track_id = tracks.id
      GROUP BY tracks.id
      ORDER BY
        CASE WHEN tracks.last_played_at IS NULL THEN 1 ELSE 0 END ASC,
        tracks.last_played_at DESC,
        tracks.added_at DESC
      LIMIT ?
    `).all(limit) as TrackRecencyRow[];

    return rows.map((row) => deriveRecencySummary(row));
  } finally {
    database.close();
  }
}
