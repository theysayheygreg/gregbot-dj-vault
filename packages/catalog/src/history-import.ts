import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

type TrackMatch = {
  id: string;
  title: string;
};

export type PlaybackHistoryImportSession = {
  startedAt: string;
  endedAt?: string;
  sourceKind: string;
  sourceRef?: string;
  venue?: string;
  context?: string;
  note?: string;
  events: Array<{
    trackRef: string;
    playedAt: string;
    positionInSession?: number;
    sourceRef?: string;
    rekordboxTrackId?: string;
    rekordboxLocationUri?: string;
    traktorAudioId?: string;
    traktorCollectionPathKey?: string;
    confidence?: number;
    note?: string;
  }>;
};

export type PlaybackHistoryImportFile = {
  sessions: PlaybackHistoryImportSession[];
};

export type PlaybackHistoryImportResult = {
  sessionCount: number;
  eventCount: number;
  importedTrackCount: number;
  skippedTrackRefs: string[];
};

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveTrack(database: DatabaseSync, sourceKind: string, trackRef: string, sourceRef?: string, hints?: {
  rekordboxTrackId?: string;
  rekordboxLocationUri?: string;
  traktorAudioId?: string;
  traktorCollectionPathKey?: string;
}): TrackMatch | null {
  const ref = requireNonEmpty(trackRef, 'trackRef');
  const vendorMatches = (() => {
    if (sourceKind.startsWith('rekordbox')) {
      return database.prepare(`
        SELECT id, title
        FROM tracks
        WHERE rekordbox_track_id = ?
           OR rekordbox_track_id = ?
           OR rekordbox_location_uri = ?
           OR rekordbox_location_uri = ?
        ORDER BY title COLLATE NOCASE, id
      `).all(
        hints?.rekordboxTrackId ?? null,
        sourceRef ?? null,
        hints?.rekordboxLocationUri ?? null,
        sourceRef ?? null,
      ) as TrackMatch[];
    }

    if (sourceKind.startsWith('traktor')) {
      return database.prepare(`
        SELECT id, title
        FROM tracks
        WHERE traktor_audio_id = ?
           OR traktor_audio_id = ?
           OR traktor_collection_path_key = ?
           OR traktor_collection_path_key = ?
        ORDER BY title COLLATE NOCASE, id
      `).all(
        hints?.traktorAudioId ?? null,
        sourceRef ?? null,
        hints?.traktorCollectionPathKey ?? null,
        sourceRef ?? null,
      ) as TrackMatch[];
    }

    return [];
  })();

  if (vendorMatches.length === 1) {
    return vendorMatches[0];
  }

  const matches = database.prepare(`
    SELECT id, title
    FROM tracks
    WHERE id = ?
       OR hash_sha256 = ?
       OR content_hash_sha256 = ?
       OR lower(title) = lower(?)
       OR lower(file_name) = lower(?)
       OR rekordbox_track_id = ?
       OR rekordbox_location_uri = ?
       OR traktor_audio_id = ?
       OR traktor_collection_path_key = ?
    ORDER BY title COLLATE NOCASE, id
  `).all(
    ref,
    ref,
    ref,
    ref,
    ref,
    hints?.rekordboxTrackId ?? sourceRef ?? null,
    hints?.rekordboxLocationUri ?? sourceRef ?? null,
    hints?.traktorAudioId ?? sourceRef ?? null,
    hints?.traktorCollectionPathKey ?? sourceRef ?? null,
  ) as TrackMatch[];

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}

export async function importPlaybackHistoryFromFile(databasePath: string, historyFilePath: string): Promise<PlaybackHistoryImportResult> {
  return importPlaybackHistory(databasePath, JSON.parse(await readFile(historyFilePath, 'utf8')) as PlaybackHistoryImportFile);
}

export async function importPlaybackHistory(databasePath: string, payload: PlaybackHistoryImportFile): Promise<PlaybackHistoryImportResult> {
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec('BEGIN');

    const insertSession = database.prepare(`
      INSERT INTO playback_sessions (id, started_at, ended_at, source_kind, source_ref, venue, context, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEvent = database.prepare(`
      INSERT INTO playback_events (
        id, session_id, track_id, played_at, position_in_session, source_kind, source_ref, confidence, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateTrack = database.prepare(`
      UPDATE tracks
      SET play_count = play_count + 1,
          last_played_at = CASE
            WHEN last_played_at IS NULL OR last_played_at < ? THEN ?
            ELSE last_played_at
          END,
          updated_at = ?
      WHERE id = ?
    `);

    let sessionCount = 0;
    let eventCount = 0;
    const importedTrackIds = new Set<string>();
    const skippedTrackRefs: string[] = [];

    for (const session of payload.sessions ?? []) {
      const sessionId = randomUUID();
      insertSession.run(
        sessionId,
        session.startedAt,
        session.endedAt ?? null,
        requireNonEmpty(session.sourceKind, 'sourceKind'),
        session.sourceRef ?? null,
        session.venue ?? null,
        session.context ?? null,
        session.note ?? null,
      );
      sessionCount += 1;

      for (const event of session.events ?? []) {
        const track = resolveTrack(database, session.sourceKind, event.trackRef, event.sourceRef, {
          rekordboxTrackId: event.rekordboxTrackId,
          rekordboxLocationUri: event.rekordboxLocationUri,
          traktorAudioId: event.traktorAudioId,
          traktorCollectionPathKey: event.traktorCollectionPathKey,
        });
        if (!track) {
          skippedTrackRefs.push(event.trackRef);
          continue;
        }

        insertEvent.run(
          randomUUID(),
          sessionId,
          track.id,
          event.playedAt,
          event.positionInSession ?? null,
          session.sourceKind,
          event.sourceRef ?? session.sourceRef ?? null,
          event.confidence ?? 0.8,
          event.note ?? null,
        );
        updateTrack.run(event.playedAt, event.playedAt, nowIso(), track.id);

        importedTrackIds.add(track.id);
        eventCount += 1;
      }
    }

    database.exec('COMMIT');
    return {
      sessionCount,
      eventCount,
      importedTrackCount: importedTrackIds.size,
      skippedTrackRefs,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
