import path from 'node:path';

import { getTrackRecencySummaries } from '../recency.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const limit = process.argv[3] ? Number(process.argv[3]) : 25;

const result = getTrackRecencySummaries(databasePath, Number.isFinite(limit) ? limit : 25);
console.log(JSON.stringify(result, null, 2));
