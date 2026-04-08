import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { PlaybackHistoryImportFile, PlaybackHistoryImportSession } from './history-import.js';
import { parseXml, findChildren, findFirstChild, walkXml, type XmlNode } from './xml.js';

type VendorTrackRef = {
  title: string | null;
  artist: string | null;
  fileName: string | null;
  sourceRef: string | null;
  rekordboxTrackId?: string;
  rekordboxLocationUri?: string;
  traktorAudioId?: string;
  traktorCollectionPathKey?: string;
};

function requireRootName(node: XmlNode, expected: string): void {
  if (node.name !== expected) {
    throw new Error(`Expected root <${expected}> but found <${node.name}>.`);
  }
}

function parseSessionStart(label: string): string {
  const trimmed = label.trim();
  const dateOnly = trimmed.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  const withTime = trimmed.match(/(\d{4})[-/](\d{2})[-/](\d{2})[ T_-](\d{2})[:. -](\d{2})(?:[:. -](\d{2}))?/);

  if (withTime) {
    const [, year, month, day, hour, minute, second] = withTime;
    return `${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}Z`;
  }

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${year}-${month}-${day}T00:00:00Z`;
  }

  return new Date('2000-01-01T00:00:00Z').toISOString();
}

function sessionEventPlayedAt(startedAt: string, position: number): string {
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) {
    return startedAt;
  }

  return new Date(startedMs + position * 60_000).toISOString();
}

function normalizeLocationFileName(location: string | null): string | null {
  if (!location) {
    return null;
  }

  try {
    if (location.startsWith('file://')) {
      return path.basename(new URL(location).pathname);
    }
  } catch {
    return path.basename(location);
  }

  return path.basename(location);
}

function preferTrackRef(track: VendorTrackRef): string {
  return track.title ?? track.fileName ?? track.sourceRef ?? 'unknown-track';
}

function toCanonicalSession(
  session: PlaybackHistoryImportSession,
  positionRefs: VendorTrackRef[],
): PlaybackHistoryImportSession {
  return {
    ...session,
    events: positionRefs.map((track, index) => ({
      trackRef: preferTrackRef(track),
      playedAt: sessionEventPlayedAt(session.startedAt, index),
      positionInSession: index + 1,
      sourceRef: track.sourceRef ?? track.fileName ?? track.title ?? undefined,
      rekordboxTrackId: track.rekordboxTrackId,
      rekordboxLocationUri: track.rekordboxLocationUri,
      traktorAudioId: track.traktorAudioId,
      traktorCollectionPathKey: track.traktorCollectionPathKey,
      confidence: track.title ? 0.95 : 0.7,
      note: track.artist ? `Artist: ${track.artist}` : undefined,
    })),
  };
}

function isNamed(node: XmlNode, value: string): boolean {
  return (node.attributes.Name ?? node.attributes.NAME ?? '').trim().toLowerCase() === value.toLowerCase();
}

export async function compileRekordboxHistoryXmlFile(filePath: string): Promise<PlaybackHistoryImportFile> {
  return compileRekordboxHistoryXml(await readFile(filePath, 'utf8'));
}

export function compileRekordboxHistoryXml(xml: string): PlaybackHistoryImportFile {
  const root = parseXml(xml);
  requireRootName(root, 'DJ_PLAYLISTS');

  const collection = findFirstChild(root, 'COLLECTION');
  const playlists = findFirstChild(root, 'PLAYLISTS');
  if (!collection || !playlists) {
    throw new Error('Rekordbox XML is missing COLLECTION or PLAYLISTS.');
  }

  const trackById = new Map<string, VendorTrackRef>();
  for (const trackNode of findChildren(collection, 'TRACK')) {
    const trackId = trackNode.attributes.TrackID;
    if (!trackId) {
      continue;
    }

    trackById.set(trackId, {
      title: trackNode.attributes.Name ?? null,
      artist: trackNode.attributes.Artist ?? null,
      fileName: normalizeLocationFileName(trackNode.attributes.Location ?? null),
      sourceRef: trackId,
      rekordboxTrackId: trackId,
      rekordboxLocationUri: trackNode.attributes.Location ?? undefined,
    });
  }

  const historyCandidates: XmlNode[] = [];
  walkXml(playlists, (node) => {
    if (historyCandidates.length === 0 && node.name === 'NODE' && isNamed(node, 'HISTORY')) {
      historyCandidates.push(node);
    }
  });

  const historyRoot = historyCandidates[0] ?? null;
  if (!historyRoot) {
    return { sessions: [] };
  }

  const historyNode = historyRoot;
  const sessions: PlaybackHistoryImportSession[] = [];
  for (const node of historyNode.children.filter((child: XmlNode) => child.name === 'NODE')) {
    const label = node.attributes.Name ?? node.attributes.NAME ?? 'Unknown Rekordbox History Session';
    const trackRefs = findChildren(node, 'TRACK')
      .map((trackRefNode) => trackById.get(trackRefNode.attributes.Key ?? ''))
      .filter((track): track is VendorTrackRef => Boolean(track));

    if (trackRefs.length === 0) {
      continue;
    }

    sessions.push(toCanonicalSession({
      startedAt: parseSessionStart(label),
      sourceKind: 'rekordbox-history-xml',
      sourceRef: label,
      context: label,
      note: 'Compiled from Rekordbox history playlist XML.',
      events: [],
    }, trackRefs));
  }

  return { sessions };
}

export async function compileTraktorHistoryNmlFile(filePath: string): Promise<PlaybackHistoryImportFile> {
  return compileTraktorHistoryNml(await readFile(filePath, 'utf8'));
}

export function compileTraktorHistoryNml(xml: string): PlaybackHistoryImportFile {
  const root = parseXml(xml);
  requireRootName(root, 'NML');

  const collection = findFirstChild(root, 'COLLECTION');
  const playlists = findFirstChild(root, 'PLAYLISTS');
  if (!collection || !playlists) {
    throw new Error('Traktor NML is missing COLLECTION or PLAYLISTS.');
  }

  const trackByKey = new Map<string, VendorTrackRef>();
  for (const entry of findChildren(collection, 'ENTRY')) {
    const location = findFirstChild(entry, 'LOCATION');
    const dir = location?.attributes.DIR ?? '';
    const fileName = location?.attributes.FILE ?? null;
    const pathKey = `${dir}${fileName ?? ''}`;
    const audioId = entry.attributes.AUDIO_ID ?? null;
    const ref: VendorTrackRef = {
      title: entry.attributes.TITLE ?? null,
      artist: entry.attributes.ARTIST ?? null,
      fileName,
      sourceRef: audioId ?? (pathKey || null),
      traktorAudioId: audioId ?? undefined,
      traktorCollectionPathKey: pathKey || undefined,
    };

    if (audioId) {
      trackByKey.set(audioId, ref);
    }
    if (pathKey.trim()) {
      trackByKey.set(pathKey, ref);
    }
  }

  const historyCandidates: XmlNode[] = [];
  walkXml(playlists, (node) => {
    if (historyCandidates.length === 0 && node.name === 'NODE' && isNamed(node, 'History')) {
      historyCandidates.push(node);
    }
  });

  const historyRoot = historyCandidates[0] ?? null;
  if (!historyRoot) {
    return { sessions: [] };
  }

  const historyNode = historyRoot;
  const sessions: PlaybackHistoryImportSession[] = [];
  walkXml(historyNode, (node) => {
    if (node.name !== 'NODE' || node === historyNode) {
      return;
    }

    const playlist = findFirstChild(node, 'PLAYLIST');
    if (!playlist) {
      return;
    }

    const label = node.attributes.NAME ?? node.attributes.Name ?? 'Unknown Traktor History Session';
    const trackRefs = findChildren(playlist, 'ENTRY')
      .map((entry) => findFirstChild(entry, 'PRIMARYKEY'))
      .map((primaryKey) => {
        if (!primaryKey) {
          return null;
        }
        const key = primaryKey.attributes.KEY ?? '';
        return trackByKey.get(key) ?? null;
      })
      .filter((track): track is VendorTrackRef => Boolean(track));

    if (trackRefs.length === 0) {
      return;
    }

    sessions.push(toCanonicalSession({
      startedAt: parseSessionStart(label),
      sourceKind: 'traktor-history-nml',
      sourceRef: label,
      context: label,
      note: 'Compiled from Traktor history NML.',
      events: [],
    }, trackRefs));
  });

  return { sessions };
}
