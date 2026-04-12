import path from 'node:path';

import { saveRekordboxDeviceTarget } from '../device-export-workflow.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const playlistRef = process.argv[3];
const folderPath = process.argv[4];
const name = process.argv[5] ?? null;
const enabledFlag = process.argv[6] ?? 'enabled';

if (!playlistRef || !folderPath) {
  console.error('Usage: npm run save:rekordbox-device-target -- <database-path> <playlist-ref> <folder-path> [name] [enabled|disabled]');
  process.exit(1);
}

const result = saveRekordboxDeviceTarget(databasePath, {
  playlistRef,
  folderPath,
  name,
  enabled: enabledFlag !== 'disabled',
});

console.log(JSON.stringify(result, null, 2));
