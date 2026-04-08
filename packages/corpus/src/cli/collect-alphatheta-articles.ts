import path from 'node:path';

import { collectAlphaThetaArticles } from '../alphatheta-articles.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await collectAlphaThetaArticles(manifestsDir);

console.log(JSON.stringify(result, null, 2));
