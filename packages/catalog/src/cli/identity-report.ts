import path from 'node:path';

import { generateIdentityReport } from '../identity.js';
import { initializeCatalog } from '../init-catalog.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);

const databasePath = args[0]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');

await initializeCatalog(databasePath);
const report = generateIdentityReport(databasePath);
console.log(JSON.stringify(report, null, 2));
