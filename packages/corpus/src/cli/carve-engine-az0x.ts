import path from 'node:path';

import { carveEngineAz0xImages } from '../engine-az0x.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');
const outputRootDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(process.cwd(), 'research/corpus/engine-dj-carved');

const result = await carveEngineAz0xImages(manifestsDir, outputRootDir);

console.log(JSON.stringify(result, null, 2));
