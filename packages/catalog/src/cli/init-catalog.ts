import path from 'node:path';

import { initializeCatalog } from '../init-catalog.js';

const requestedPath = process.argv[2];
const databasePath = requestedPath
  ? path.resolve(requestedPath)
  : path.resolve(process.cwd(), 'data/dj-vault.sqlite');

const result = await initializeCatalog(databasePath);

console.log(JSON.stringify(result, null, 2));
