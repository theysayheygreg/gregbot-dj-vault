import path from 'node:path';

import { createPlaybackSession } from '../recency.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const sourceKind = process.argv[3];
const venue = process.argv[4] ?? null;
const context = process.argv[5] ?? null;
const note = process.argv[6] ?? null;

if (!sourceKind) {
  console.error('Usage: npm run create:playback-session -- <database-path> <source-kind> [venue] [context] [note]');
  process.exit(1);
}

const result = createPlaybackSession(databasePath, { sourceKind, venue, context, note });
console.log(JSON.stringify(result, null, 2));
