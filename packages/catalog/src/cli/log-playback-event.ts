import path from 'node:path';

import { logPlaybackEvent } from '../recency.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const trackRef = process.argv[3];
const sourceKind = process.argv[4];
const sessionId = process.argv[5] ?? null;
const note = process.argv[6] ?? null;

if (!trackRef || !sourceKind) {
  console.error('Usage: npm run log:playback-event -- <database-path> <track-ref> <source-kind> [session-id] [note]');
  process.exit(1);
}

const result = logPlaybackEvent(databasePath, { trackRef, sourceKind, sessionId, note });
console.log(JSON.stringify(result, null, 2));
