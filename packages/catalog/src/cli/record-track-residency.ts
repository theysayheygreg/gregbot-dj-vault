import path from 'node:path';

import { recordTrackResidency } from '../topology.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const trackRef = process.argv[3];
const storageLocationId = process.argv[4];
const residencyKind = process.argv[5] as 'canonical' | 'replica' | 'cache' | 'export-staging' | undefined;
const relativePath = process.argv[6];
const status = process.argv[7] as 'ready' | 'missing' | 'offline' | 'pending-sync' | undefined;
const note = process.argv[8] ?? null;

if (!trackRef || !storageLocationId || !residencyKind || !relativePath || !status) {
  console.error('Usage: npm run record:track-residency -- <database-path> <track-ref> <storage-location-id> <residency-kind> <relative-path> <status> [note]');
  process.exit(1);
}

const result = recordTrackResidency(databasePath, {
  trackRef,
  storageLocationId,
  residencyKind,
  relativePath,
  status,
  note,
});

console.log(JSON.stringify(result, null, 2));
