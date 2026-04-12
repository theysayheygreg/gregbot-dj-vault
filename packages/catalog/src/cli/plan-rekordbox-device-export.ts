import path from 'node:path';

import { planRekordboxDeviceExport } from '../device-export-workflow.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const playlistRef = process.argv[3];
const executionNodeRef = process.argv[4];
const destinationStorageRef = process.argv[5] ?? null;
const sourceStorageRef = process.argv[6] ?? null;
const transport = process.argv[7] as 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual' | 'sneakernet' | undefined;
const note = process.argv[8] ?? null;

if (!playlistRef || !executionNodeRef) {
  console.error('Usage: npm run plan:rekordbox-device-export -- <database-path> <playlist-ref> <execution-node-ref> [destination-storage-ref] [source-storage-ref] [transport] [note]');
  process.exit(1);
}

const result = planRekordboxDeviceExport(databasePath, {
  playlistRef,
  executionNodeRef,
  destinationStorageRef,
  sourceStorageRef,
  transport: transport ?? null,
  note,
});

console.log(JSON.stringify(result, null, 2));
