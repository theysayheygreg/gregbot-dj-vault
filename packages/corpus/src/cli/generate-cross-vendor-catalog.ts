import path from 'node:path';

import { generateCrossVendorCatalogStatus } from '../catalog-status.js';

const manifestsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'research/manifests');

const result = await generateCrossVendorCatalogStatus(manifestsDir);

console.log(JSON.stringify(result, null, 2));
