import { DatabaseSync } from 'node:sqlite';

export type UpdateTrackMetadataInput = {
  trackRef: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  label?: string | null;
  keyDisplay?: string | null;
  bpm?: number | null;
  rating?: number | null;
  comment?: string | null;
};

export type RemoveTrackFromPlaylistInput = {
  playlistId: string;
  position: number;
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

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined) {
    return undefined as never;
  }
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveTrack(database: DatabaseSync, trackRef: string): { id: string; title: string } {
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
  `).all(ref, ref, ref, ref, ref) as Array<{ id: string; title: string }>;

  if (matches.length === 0) {
    throw new Error(`No track matched "${ref}".`);
  }

  if (matches.length > 1) {
    throw new Error(`Track reference "${ref}" is ambiguous.`);
  }

  return matches[0];
}

export function updateTrackMetadata(databasePath: string, input: UpdateTrackMetadataInput): { trackId: string; title: string } {
  const database = new DatabaseSync(databasePath);
  const timestamp = nowIso();

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const track = resolveTrack(database, input.trackRef);
    const existing = database.prepare(`
      SELECT title, album, label, key_display, bpm, rating, comment
      FROM tracks
      WHERE id = ?
    `).get(track.id) as {
      title: string;
      album: string | null;
      label: string | null;
      key_display: string | null;
      bpm: number | null;
      rating: number | null;
      comment: string | null;
    };

    const nextTitle = normalizeText(input.title) ?? existing.title;
    const nextAlbum = input.album === undefined ? existing.album : normalizeText(input.album);
    const nextLabel = input.label === undefined ? existing.label : normalizeText(input.label);
    const nextKeyDisplay = input.keyDisplay === undefined ? existing.key_display : normalizeText(input.keyDisplay);
    const nextBpm = input.bpm === undefined ? existing.bpm : input.bpm;
    const nextRating = input.rating === undefined ? existing.rating : input.rating;
    const nextComment = input.comment === undefined ? existing.comment : normalizeText(input.comment);

    database.prepare(`
      UPDATE tracks
      SET title = ?, album = ?, label = ?, key_display = ?, bpm = ?, rating = ?, comment = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextTitle,
      nextAlbum,
      nextLabel,
      nextKeyDisplay,
      nextBpm,
      nextRating,
      nextComment,
      timestamp,
      track.id,
    );

    if (input.artist !== undefined) {
      const nextArtist = normalizeText(input.artist);
      database.prepare(`DELETE FROM track_people WHERE track_id = ? AND role = 'artist'`).run(track.id);
      if (nextArtist) {
        database.prepare(`
          INSERT INTO track_people (track_id, role, name, position)
          VALUES (?, 'artist', ?, 0)
        `).run(track.id, nextArtist);
      }
    }

    database.exec('COMMIT');
    return { trackId: track.id, title: nextTitle };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export function removeTrackFromPlaylist(databasePath: string, input: RemoveTrackFromPlaylistInput): { playlistId: string; removedPosition: number } {
  const database = new DatabaseSync(databasePath);
  const playlistId = requireNonEmpty(input.playlistId, 'playlistId');

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const existing = database.prepare(`
      SELECT playlist_id, position
      FROM playlist_items
      WHERE playlist_id = ? AND position = ?
    `).get(playlistId, input.position) as { playlist_id: string; position: number } | undefined;

    if (!existing) {
      throw new Error(`Playlist item ${playlistId}:${input.position} not found.`);
    }

    database.prepare(`
      DELETE FROM playlist_items
      WHERE playlist_id = ? AND position = ?
    `).run(playlistId, input.position);

    database.prepare(`
      UPDATE playlist_items
      SET position = position - 1
      WHERE playlist_id = ? AND position > ?
    `).run(playlistId, input.position);

    database.prepare(`UPDATE playlists SET updated_at = ? WHERE id = ?`).run(nowIso(), playlistId);

    database.exec('COMMIT');
    return { playlistId, removedPosition: input.position };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
