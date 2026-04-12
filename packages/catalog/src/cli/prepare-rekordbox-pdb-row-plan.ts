import path from 'node:path';

import { prepareRekordboxPdbRowPlan } from '../rekordbox-pdb-row-plan.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const exportRoot = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(invocationCwd, 'tmp/export/rekordbox-device');

const result = await prepareRekordboxPdbRowPlan(databasePath, exportRoot);
console.log(JSON.stringify(result, null, 2));
