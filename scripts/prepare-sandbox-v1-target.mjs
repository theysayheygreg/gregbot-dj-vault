import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const databasePath = path.join(rootDir, 'tmp/sandbox-v1/runtime/sandbox-v1.sqlite');
const dashboardPath = path.join(rootDir, 'apps/desktop/src/generated/catalog-dashboard.json');
const exportReportPath = path.join(rootDir, 'tmp/sandbox-v1/reports/sandbox-v1-export-test-report.md');

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: rootDir,
    maxBuffer: 24_000_000,
  });
  return `${stdout}${stderr}`.trim();
}

function parseJsonFromMixedOutput(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in command output:\n${output}`);
  }
  return JSON.parse(output.slice(start, end + 1));
}

await run('node', [path.join(rootDir, 'scripts/run-sandbox-v1-export-test.mjs')]);
const dashboardOutput = await run('node', [
  path.join(rootDir, 'packages/catalog/dist/cli/export-dashboard-json.js'),
  databasePath,
  dashboardPath,
]);

console.log(JSON.stringify({
  targetLibrary: 'sandbox-v1',
  databasePath,
  dashboardPath,
  exportReportPath,
  dashboard: parseJsonFromMixedOutput(dashboardOutput),
}, null, 2));
