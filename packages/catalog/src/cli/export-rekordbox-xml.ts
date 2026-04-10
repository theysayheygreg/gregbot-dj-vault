import path from 'node:path';

import { exportRekordboxXml } from '../export.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);
const databasePath = args[0]
  ? path.resolve(args[0])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const outputPath = args[1]
  ? path.resolve(invocationCwd, args[1])
  : path.resolve(invocationCwd, 'tmp/export/rekordbox.xml');
const playlistIds = args.slice(2);

const result = await exportRekordboxXml(databasePath, outputPath, playlistIds);
console.log(JSON.stringify(result, null, 2));
