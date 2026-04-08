import path from 'node:path';

import { initializeCatalog } from '../init-catalog.js';
import { ingestFilesIntoCatalog } from '../ingest-files.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);

const databasePath = args[0]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const rawArgs = args.slice(1);
const inputPaths: string[] = [];
let libraryRoot: string | null = null;

for (let index = 0; index < rawArgs.length; index += 1) {
  const value = rawArgs[index];
  if (value === '--library-root') {
    const next = rawArgs[index + 1];
    if (!next) {
      console.error('Usage: npm run ingest:files -- <database-path> [--library-root <path>] <file-or-directory> [more-paths]');
      process.exit(1);
    }
    libraryRoot = path.resolve(invocationCwd, next);
    index += 1;
    continue;
  }

  inputPaths.push(value);
}

if (inputPaths.length === 0) {
  console.error('Usage: npm run ingest:files -- <database-path> [--library-root <path>] <file-or-directory> [more-paths]');
  process.exit(1);
}

await initializeCatalog(databasePath);
const resolvedInputPaths = inputPaths.map((inputPath) => path.resolve(invocationCwd, inputPath));
const result = await ingestFilesIntoCatalog(databasePath, resolvedInputPaths, { libraryRoot });

console.log(JSON.stringify(result, null, 2));
