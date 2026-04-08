import path from 'node:path';

import { importTraktorCollectionLinks } from '../vendor-library.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const nmlPath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!nmlPath) {
  console.error('Usage: npm run import:traktor-collection -- <database-path> <traktor-nml-path>');
  process.exit(1);
}

const result = await importTraktorCollectionLinks(databasePath, nmlPath);
console.log(JSON.stringify(result, null, 2));
