import path from 'node:path';
import process from 'node:process';

import { collectSourceInventory } from '../collect-source-inventory.js';

async function main() {
  const manifestsDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), 'research/manifests');

  const result = await collectSourceInventory(manifestsDir);

  console.log(`Wrote source inventory summary: ${result.summaryPath}`);
  for (const vendorPath of result.vendorPaths) {
    console.log(`Wrote vendor inventory: ${vendorPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
