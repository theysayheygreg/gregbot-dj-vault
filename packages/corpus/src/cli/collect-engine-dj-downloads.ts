import path from 'node:path';

import { collectEngineDjDownloads } from '../engine-downloads.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await collectEngineDjDownloads(manifestsDir);

console.log(JSON.stringify(result, null, 2));
