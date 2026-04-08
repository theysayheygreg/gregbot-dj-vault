import path from 'node:path';

import { setupQmdForDjVault } from '../qmd.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd);
const databasePath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(projectRoot, 'data/dj-vault.sqlite');
const exportRoot = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.resolve(projectRoot, 'data/qmd');

const result = await setupQmdForDjVault(projectRoot, databasePath, exportRoot);
console.log(JSON.stringify(result, null, 2));
