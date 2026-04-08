import path from 'node:path';

import { inspectLocalAcquisitions } from '../local-artifact-inspection.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await inspectLocalAcquisitions(manifestsDir);

console.log(JSON.stringify(result, null, 2));
