import path from 'node:path';

import { unpackAlphaThetaArchives } from '../alphatheta-unpack.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');
const unpackRootDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(process.cwd(), 'research/corpus/alphatheta-unpacked');

const result = await unpackAlphaThetaArchives(manifestsDir, unpackRootDir);

console.log(JSON.stringify(result, null, 2));
