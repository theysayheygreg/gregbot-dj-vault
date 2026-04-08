import path from 'node:path';

import { createDjSet } from '../authoring.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const name = process.argv[3];
const event = process.argv[4] ?? null;
const targetDurationMin = process.argv[5] ? Number(process.argv[5]) : null;
const vibe = process.argv[6] ?? null;

if (!name) {
  console.error('Usage: npm run create:set -- <database-path> <name> [event] [target-duration-min] [vibe]');
  process.exit(1);
}

const result = createDjSet(databasePath, { name, event, targetDurationMin, vibe });
console.log(JSON.stringify(result, null, 2));
