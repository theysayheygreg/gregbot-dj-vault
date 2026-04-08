import path from 'node:path';

import { importPlaybackHistory } from '../history-import.js';
import { compileRekordboxHistoryXmlFile } from '../vendor-history.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const xmlPath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!xmlPath) {
  console.error('Usage: npm run import:rekordbox-history -- <database-path> <rekordbox-history-xml-path>');
  process.exit(1);
}

const payload = await compileRekordboxHistoryXmlFile(xmlPath);
const result = await importPlaybackHistory(databasePath, payload);
console.log(JSON.stringify({ ...result, compiledSessionCount: payload.sessions.length }, null, 2));
