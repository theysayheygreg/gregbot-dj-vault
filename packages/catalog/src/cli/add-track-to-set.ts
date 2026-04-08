import path from 'node:path';

import { addTrackToSet } from '../authoring.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const djSetId = process.argv[3];
const trackRef = process.argv[4];
const role = process.argv[5] ?? null;
const transitionMethod = process.argv[6] ?? null;
const transitionNote = process.argv[7] ?? null;
const energyDelta = process.argv[8] ? Number(process.argv[8]) : null;

if (!djSetId || !trackRef) {
  console.error('Usage: npm run add:track-to-set -- <database-path> <set-id> <track-ref> [role] [transition-method] [transition-note] [energy-delta]');
  process.exit(1);
}

const result = addTrackToSet(databasePath, {
  djSetId,
  trackRef,
  role,
  transitionMethod,
  transitionNote,
  energyDelta,
});
console.log(JSON.stringify(result, null, 2));
