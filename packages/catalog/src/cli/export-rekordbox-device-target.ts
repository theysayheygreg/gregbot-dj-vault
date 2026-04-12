import path from 'node:path';

import { exportRekordboxDeviceToSavedTarget } from '../device-export-workflow.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const playlistRef = process.argv[3];

if (!playlistRef) {
  console.error('Usage: npm run export:rekordbox-device-target -- <database-path> <playlist-ref>');
  process.exit(1);
}

const result = await exportRekordboxDeviceToSavedTarget(databasePath, playlistRef);
console.log(JSON.stringify(result, null, 2));
