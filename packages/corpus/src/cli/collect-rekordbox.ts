import path from 'node:path';

import { collectRekordboxReleaseNotes } from '../rekordbox.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await collectRekordboxReleaseNotes(manifestsDir);

console.log(JSON.stringify(result, null, 2));
