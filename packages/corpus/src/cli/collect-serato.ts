import path from 'node:path';

import { collectSeratoDjProArchive } from '../serato.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await collectSeratoDjProArchive(manifestsDir);

console.log(JSON.stringify(result, null, 2));
