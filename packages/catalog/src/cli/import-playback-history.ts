import path from 'node:path';

import { importPlaybackHistoryFromFile } from '../history-import.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const historyFilePath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!historyFilePath) {
  console.error('Usage: npm run import:playback-history -- <database-path> <history-json-path>');
  process.exit(1);
}

const result = await importPlaybackHistoryFromFile(databasePath, historyFilePath);
console.log(JSON.stringify(result, null, 2));
