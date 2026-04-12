import path from 'node:path';

import { validateRekordboxDeviceExport } from '../device-export-workflow.js';

const exportRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'tmp/export/rekordbox-device');

const result = await validateRekordboxDeviceExport(exportRoot);
console.log(JSON.stringify(result, null, 2));
