import path from 'node:path';
import process from 'node:process';

import { enumerateAlphaTheta } from '../alphatheta.js';

async function main() {
  const manifestsDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), 'research/manifests');

  const result = await enumerateAlphaTheta(manifestsDir);

  console.log(`Wrote AlphaTheta summary: ${result.summaryPath}`);
  for (const filePath of result.categoryPaths) {
    console.log(`Wrote AlphaTheta category inventory: ${filePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
