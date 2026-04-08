import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type CreatePlaylistInput = {
  name: string;
  type?: 'crate' | 'playlist' | 'smart' | 'set';
  parentId?: string | null;
  description?: string | null;
  sortMode?: string | null;
};

export type CreateDjSetInput = {
  name: string;
  event?: string | null;
  targetDurationMin?: number | null;
  vibe?: string | null;
};

export type AddTrackToPlaylistInput = {
  playlistId: string;
  trackRef: string;
  note?: string | null;
  transitionNote?: string | null;
};

export type AddTrackToSetInput = {
  djSetId: string;
  trackRef: string;
  role?: string | null;
  transitionMethod?: string | null;
  transitionNote?: string | null;
  energyDelta?: number | null;
};

export type AuthoringResult = {
  id: string;
  name: string;
};

type TrackMatch = {
  id: string;
  title: string;
  file_name: string;
  hash_sha256: string;
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
    SELECT id, title, file_name, hash_sha256
    FROM tracks
    WHERE id = ?
       OR hash_sha256 = ?
       OR lower(title) = lower(?)
       OR lower(file_name) = lower(?)
    ORDER BY title COLLATE NOCASE, id
  `).all(ref, ref, ref, ref) as TrackMatch[];

  if (matches.length === 0) {
    throw new Error(`No track matched "${ref}".`);
  }

  if (matches.length > 1) {
    const details = matches.map((match) => `${match.id} (${match.title})`).join(', ');
    throw new Error(`Track reference "${ref}" is ambiguous. Matches: ${details}`);
  }

  return matches[0];
}

export function createPlaylist(databasePath: string, input: CreatePlaylistInput): AuthoringResult {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const timestamp = nowIso();
  const name = requireNonEmpty(input.name, 'playlist name');

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.prepare(`
      INSERT INTO playlists (id, name, type, parent_id, description, created_at, updated_at, sort_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      input.type ?? 'playlist',
      input.parentId ?? null,
      input.description ?? null,
      timestamp,
      timestamp,
      input.sortMode ?? 'manual',
    );

    return { id, name };
  } finally {
    database.close();
  }
}

export function createDjSet(databasePath: string, input: CreateDjSetInput): AuthoringResult {
  const database = new DatabaseSync(databasePath);
  const id = randomUUID();
  const name = requireNonEmpty(input.name, 'set name');

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.prepare(`
      INSERT INTO dj_sets (id, name, event, target_duration_min, vibe, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, input.event ?? null, input.targetDurationMin ?? null, input.vibe ?? null, nowIso(), nowIso());

    return { id, name };
  } finally {
    database.close();
  }
}

export function addTrackToPlaylist(databasePath: string, input: AddTrackToPlaylistInput): { playlistId: string; trackId: string; position: number } {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const playlist = database.prepare(`SELECT id, name FROM playlists WHERE id = ?`).get(input.playlistId) as { id: string; name: string } | undefined;
    if (!playlist) {
      throw new Error(`Playlist ${input.playlistId} not found.`);
    }

    const track = resolveTrack(database, input.trackRef);
    const nextRow = database.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 AS next_position
      FROM playlist_items
      WHERE playlist_id = ?
    `).get(input.playlistId) as { next_position: number };

    database.prepare(`
      INSERT INTO playlist_items (playlist_id, track_id, position, note, transition_note)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.playlistId, track.id, nextRow.next_position, input.note ?? null, input.transitionNote ?? null);

    database.prepare(`UPDATE playlists SET updated_at = ? WHERE id = ?`).run(nowIso(), input.playlistId);
    database.exec('COMMIT');

    return {
      playlistId: input.playlistId,
      trackId: track.id,
      position: Number(nextRow.next_position),
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export function addTrackToSet(databasePath: string, input: AddTrackToSetInput): { djSetId: string; trackId: string; order: number } {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const djSet = database.prepare(`SELECT id, name FROM dj_sets WHERE id = ?`).get(input.djSetId) as { id: string; name: string } | undefined;
    if (!djSet) {
      throw new Error(`DJ set ${input.djSetId} not found.`);
    }

    const track = resolveTrack(database, input.trackRef);
    const nextRow = database.prepare(`
      SELECT COALESCE(MAX(track_order), -1) + 1 AS next_order
      FROM set_tracks
      WHERE dj_set_id = ?
    `).get(input.djSetId) as { next_order: number };

    database.prepare(`
      INSERT INTO set_tracks (
        dj_set_id, track_id, track_order, role, transition_method, transition_note, energy_delta
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.djSetId,
      track.id,
      nextRow.next_order,
      input.role ?? null,
      input.transitionMethod ?? null,
      input.transitionNote ?? null,
      input.energyDelta ?? null,
    );

    database.prepare(`UPDATE dj_sets SET updated_at = ? WHERE id = ?`).run(nowIso(), input.djSetId);
    database.exec('COMMIT');

    return {
      djSetId: input.djSetId,
      trackId: track.id,
      order: Number(nextRow.next_order),
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
