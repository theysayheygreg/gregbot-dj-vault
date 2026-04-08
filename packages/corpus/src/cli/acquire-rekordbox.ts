import path from 'node:path';

import { acquireRekordboxCurrentPackage } from '../rekordbox-acquisition.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');
const corpusDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(process.cwd(), 'research/corpus');

const result = await acquireRekordboxCurrentPackage(manifestsDir, corpusDir);

console.log(JSON.stringify(result, null, 2));
