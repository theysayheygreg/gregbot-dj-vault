import path from 'node:path';

import { acquireAlphaThetaArtifacts } from '../alphatheta-acquisition.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');
const corpusDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(process.cwd(), 'research/corpus/alphatheta-archives');

const result = await acquireAlphaThetaArtifacts({
  manifestsDir,
  corpusDir,
  productKeywords: ['CDJ-3000', 'XDJ-AZ', 'OMNIS-DUO', 'OPUS-QUAD', 'DJM-A9'],
  artifactKinds: ['archive'],
  preferredArticleKeywords: ['firmware'],
  maxPerProduct: 1,
  limit: 5,
  exactProductNames: true,
});

console.log(JSON.stringify(result, null, 2));
