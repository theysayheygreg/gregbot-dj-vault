import path from 'node:path';

import { exportDashboardSnapshot } from '../dashboard.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(invocationCwd, 'apps/desktop/src/generated/catalog-dashboard.json');

const result = await exportDashboardSnapshot(databasePath, outputPath);
console.log(JSON.stringify({
  generatedAt: result.generatedAt,
  outputPath,
  trackCount: result.summary.trackCount,
  playlistCount: result.summary.playlistCount,
  exportTargetCount: result.summary.exportTargetCount,
}, null, 2));
