import path from 'node:path';

import { applyMergeSelections, generateMergeReport } from '../merge.js';
import { initializeCatalog } from '../init-catalog.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);

const databasePath = args[0]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');

await initializeCatalog(databasePath);
const before = generateMergeReport(databasePath);
const result = applyMergeSelections(databasePath);
const after = generateMergeReport(databasePath);

console.log(JSON.stringify({
  changedTrackCount: result.changedTrackCount,
  changedTrackCountBefore: before.changedTrackCount,
  changedTrackCountAfter: after.changedTrackCount,
}, null, 2));
