import path from 'node:path';

import { importRekordboxCollectionLinks } from '../vendor-library.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const xmlPath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!xmlPath) {
  console.error('Usage: npm run import:rekordbox-collection -- <database-path> <rekordbox-xml-path>');
  process.exit(1);
}

const result = await importRekordboxCollectionLinks(databasePath, xmlPath);
console.log(JSON.stringify(result, null, 2));
