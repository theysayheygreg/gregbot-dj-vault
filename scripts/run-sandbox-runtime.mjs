import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const databasePath = path.join(rootDir, 'tmp/sandbox-v1/runtime/sandbox-v1.sqlite');

execFileSync('node', [path.join(rootDir, 'scripts/prepare-sandbox-v1-target.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});

const child = spawn('npm', ['run', 'desktop:runtime'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    DJ_VAULT_DB_PATH: databasePath,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
