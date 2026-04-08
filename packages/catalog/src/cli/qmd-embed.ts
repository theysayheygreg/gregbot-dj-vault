import path from 'node:path';

import { embedQmdForDjVault } from '../qmd.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd);

await embedQmdForDjVault(projectRoot);
console.log(JSON.stringify({ projectRoot, embedded: true }, null, 2));
