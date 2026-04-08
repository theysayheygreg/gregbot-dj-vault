import path from 'node:path';

import { addTrackToPlaylist } from '../authoring.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const playlistId = process.argv[3];
const trackRef = process.argv[4];
const note = process.argv[5] ?? null;
const transitionNote = process.argv[6] ?? null;

if (!playlistId || !trackRef) {
  console.error('Usage: npm run add:track-to-playlist -- <database-path> <playlist-id> <track-ref> [note] [transition-note]');
  process.exit(1);
}

const result = addTrackToPlaylist(databasePath, { playlistId, trackRef, note, transitionNote });
console.log(JSON.stringify(result, null, 2));
