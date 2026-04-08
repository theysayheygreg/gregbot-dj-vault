import path from 'node:path';

import { registerStorageLocation } from '../topology.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const nodeId = process.argv[3];
const name = process.argv[4];
const kind = process.argv[5] as 'local-disk' | 'external-drive' | 'network-share' | 'nas' | 'cloud-mirror' | undefined;
const mountPath = process.argv[6] ?? null;
const pathPrefix = process.argv[7] ?? null;
const mode = process.argv[8] ?? 'plain';
const notes = process.argv[9] ?? null;

if (!nodeId || !name || !kind) {
  console.error('Usage: npm run register:storage -- <database-path> <node-id> <name> <kind> [mount-path] [path-prefix] [managed|plain] [notes]');
  process.exit(1);
}

const result = registerStorageLocation(databasePath, {
  nodeId,
  name,
  kind,
  mountPath,
  pathPrefix,
  isManagedLibrary: mode === 'managed',
  isAvailable: kind === 'local-disk',
  notes,
});

console.log(JSON.stringify(result, null, 2));
