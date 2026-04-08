import path from 'node:path';

import { createPlaylist } from '../authoring.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const name = process.argv[3];
const type = process.argv[4] as 'crate' | 'playlist' | 'smart' | 'set' | undefined;
const description = process.argv[5] ?? null;

if (!name) {
  console.error('Usage: npm run create:playlist -- <database-path> <name> [type] [description]');
  process.exit(1);
}

const result = createPlaylist(databasePath, { name, type, description });
console.log(JSON.stringify(result, null, 2));
