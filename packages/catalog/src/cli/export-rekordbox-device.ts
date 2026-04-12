import path from 'node:path';
import { exportRekordboxDevice } from '../rekordbox-device-export.js';

const invocationCwd = process.cwd();
const databasePath = process.argv[2];
const outputRoot = process.argv[3]
  ? path.resolve(invocationCwd, process.argv[3])
  : path.resolve(invocationCwd, 'tmp/export/rekordbox-device');
const playlistIds = process.argv.slice(4);

if (!databasePath) {
  console.error('Usage: npm run export:rekordbox-device -- <database-path> [output-root] [playlist-id ...]');
  process.exit(1);
}

const result = await exportRekordboxDevice(databasePath, outputRoot, playlistIds);
console.log(JSON.stringify(result, null, 2));
