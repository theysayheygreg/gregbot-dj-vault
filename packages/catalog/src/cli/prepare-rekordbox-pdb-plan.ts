import path from 'node:path';

import { prepareRekordboxPdbWritePlan } from '../rekordbox-pdb.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const exportRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'tmp/export/rekordbox-device');
const referenceEmptyPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(invocationCwd, 'tmp/deep-symmetry/rekordcrate/data/complete_export/empty/PIONEER/rekordbox/export.pdb');
const referencePopulatedPath = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.resolve(invocationCwd, 'tmp/deep-symmetry/rekordcrate/data/complete_export/demo_tracks/PIONEER/rekordbox/export.pdb');

const result = await prepareRekordboxPdbWritePlan(exportRoot, referenceEmptyPath, referencePopulatedPath);
console.log(JSON.stringify(result, null, 2));
