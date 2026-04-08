import path from 'node:path';

import { collectEngineDjReleaseNotes } from '../engine-dj.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await collectEngineDjReleaseNotes(manifestsDir);

console.log(JSON.stringify(result, null, 2));
