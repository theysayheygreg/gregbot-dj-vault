import path from 'node:path';

import { inspectAlphaThetaArchives } from '../alphatheta-archive-inspection.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await inspectAlphaThetaArchives(manifestsDir);

console.log(JSON.stringify(result, null, 2));
