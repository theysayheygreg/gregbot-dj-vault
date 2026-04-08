import path from 'node:path';

import { qmdCollectionList } from '../qmd.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd);

const collections = await qmdCollectionList(projectRoot);
console.log(JSON.stringify({ projectRoot, collections }, null, 2));
