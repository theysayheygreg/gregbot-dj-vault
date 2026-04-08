import path from 'node:path';

import { importPlaybackHistory } from '../history-import.js';
import { compileTraktorHistoryNmlFile } from '../vendor-history.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const nmlPath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!nmlPath) {
  console.error('Usage: npm run import:traktor-history -- <database-path> <traktor-history-nml-path>');
  process.exit(1);
}

const payload = await compileTraktorHistoryNmlFile(nmlPath);
const result = await importPlaybackHistory(databasePath, payload);
console.log(JSON.stringify({ ...result, compiledSessionCount: payload.sessions.length }, null, 2));
