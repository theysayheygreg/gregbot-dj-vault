import path from 'node:path';

import { planExportExecution } from '../topology.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const targetKind = process.argv[3] as 'usb-device' | 'filesystem-folder' | 'network-drop' | 'remote-worker' | undefined;
const executionNodeId = process.argv[4];
const sourceStorageLocationId = process.argv[5] ?? null;
const destinationStorageLocationId = process.argv[6] ?? null;
const transport = (process.argv[7] as 'local' | 'tailscale' | 'ssh' | 'sneakernet' | undefined) ?? null;
const remoteFlag = process.argv[8] ?? 'local';
const note = process.argv[9] ?? null;

if (!targetKind || !executionNodeId) {
  console.error('Usage: npm run plan:export-execution -- <database-path> <target-kind> <execution-node-id> [source-storage-id] [destination-storage-id] [transport] [remote|local] [note]');
  process.exit(1);
}

const result = planExportExecution(databasePath, {
  targetKind,
  executionNodeId,
  sourceStorageLocationId,
  destinationStorageLocationId,
  transport,
  requiresRemoteAccess: remoteFlag === 'remote',
  note,
});

console.log(JSON.stringify(result, null, 2));
