import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import react from '@vitejs/plugin-react';
import {
  addTrackToPlaylist,
  createPlaylist,
} from '../../packages/catalog/src/authoring';
import { exportDashboardSnapshot } from '../../packages/catalog/src/dashboard';
import {
  exportRekordboxDeviceToSavedTarget,
  planRekordboxDeviceExport,
  saveRekordboxDeviceTarget,
} from '../../packages/catalog/src/device-export-workflow';
import {
  removeTrackFromPlaylist,
  updateTrackMetadata,
} from '../../packages/catalog/src/editing';
import {
  writePlaylistCandidateReport,
  type PlaylistCandidateMode,
} from '../../packages/catalog/src/playlist-candidates';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, '../..');
const execFileAsync = promisify(execFile);
const sandboxDatabasePath = path.resolve(workspaceRoot, 'tmp/sandbox-v1/runtime/sandbox-v1.sqlite');
const databasePath = process.env.DJ_VAULT_DB_PATH
  ? path.resolve(process.env.DJ_VAULT_DB_PATH)
  : sandboxDatabasePath;
const dashboardOutputPath = path.resolve(rootDir, 'src/generated/catalog-dashboard.json');
const sandboxExportReportPath = path.resolve(workspaceRoot, 'tmp/sandbox-v1/reports/sandbox-v1-export-test-report.json');
const sandboxCandidateReportRoot = path.resolve(workspaceRoot, 'tmp/sandbox-v1/reports/playlist-candidates');

type JsonBody = Record<string, unknown>;

function readJsonBody(request: NodeJS.ReadableStream): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) as JsonBody : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function parseJsonFromMixedOutput(output: string): unknown {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in command output:\n${output}`);
  }
  return JSON.parse(output.slice(start, end + 1)) as unknown;
}

async function prepareSandboxTarget(): Promise<{ databasePath: string } & Record<string, unknown>> {
  const { stdout, stderr } = await execFileAsync('node', [
    path.join(workspaceRoot, 'scripts/prepare-sandbox-v1-target.mjs'),
  ], {
    cwd: workspaceRoot,
    maxBuffer: 24_000_000,
  });
  return parseJsonFromMixedOutput(`${stdout}${stderr}`) as { databasePath: string } & Record<string, unknown>;
}

function normalizeCandidateMode(value: unknown): PlaylistCandidateMode {
  return value === 'balanced' || value === 'gig-safe' || value === 'discovery' || value === 'cleanup'
    ? value
    : 'balanced';
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dj-vault-dev-api',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? '/', 'http://localhost');
          if (!url.pathname.startsWith('/api/')) {
            next();
            return;
          }

          try {
            if (request.method === 'GET' && url.pathname === '/api/dashboard') {
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, snapshot);
              return;
            }

            if (request.method === 'GET' && url.pathname === '/api/sandbox/export-readiness') {
              const readiness = await readJsonFile(sandboxExportReportPath);
              sendJson(response, 200, { ok: true, readiness });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/sandbox/prepare') {
              const result = await prepareSandboxTarget();
              if (path.resolve(result.databasePath) !== databasePath) {
                throw new Error(`Sandbox prepare rebuilt ${result.databasePath}, but the runtime is using ${databasePath}. Start VaultBuddy with the sandbox target library.`);
              }
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              const readiness = await readJsonFile(sandboxExportReportPath);
              sendJson(response, 200, { ok: true, result, snapshot, readiness });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/playlist-candidates') {
              const body = await readJsonBody(request);
              const prompt = String(body.prompt ?? '').trim() || 'warmup tools with trustworthy metadata';
              const limit = Math.max(1, Math.min(50, Number.parseInt(String(body.limit ?? '8'), 10) || 8));
              const mode = normalizeCandidateMode(body.mode);
              const result = await writePlaylistCandidateReport(databasePath, prompt, sandboxCandidateReportRoot, {
                mode,
                limit,
              });
              sendJson(response, 200, { ok: true, result });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/playlists') {
              const body = await readJsonBody(request);
              const result = createPlaylist(databasePath, {
                name: String(body.name ?? ''),
                type: (body.type as 'crate' | 'playlist' | 'smart' | 'set' | undefined) ?? 'playlist',
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, { ok: true, result, snapshot });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/tracks/update') {
              const body = await readJsonBody(request);
              const result = updateTrackMetadata(databasePath, {
                trackRef: String(body.trackRef ?? ''),
                title: typeof body.title === 'string' ? body.title : null,
                artist: typeof body.artist === 'string' ? body.artist : null,
                album: typeof body.album === 'string' ? body.album : null,
                label: typeof body.label === 'string' ? body.label : null,
                keyDisplay: typeof body.keyDisplay === 'string' ? body.keyDisplay : null,
                bpm: typeof body.bpm === 'number' ? body.bpm : null,
                rating: typeof body.rating === 'number' ? body.rating : null,
                comment: typeof body.comment === 'string' ? body.comment : null,
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, { ok: true, result, snapshot });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/playlist-items/add') {
              const body = await readJsonBody(request);
              const result = addTrackToPlaylist(databasePath, {
                playlistId: String(body.playlistId ?? ''),
                trackRef: String(body.trackRef ?? ''),
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, { ok: true, result, snapshot });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/playlist-items/remove') {
              const body = await readJsonBody(request);
              const result = removeTrackFromPlaylist(databasePath, {
                playlistId: String(body.playlistId ?? ''),
                position: Number(body.position ?? -1),
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, { ok: true, result, snapshot });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/export-targets') {
              const body = await readJsonBody(request);
              const result = saveRekordboxDeviceTarget(databasePath, {
                playlistRef: String(body.playlistRef ?? ''),
                name: typeof body.name === 'string' ? body.name : null,
                folderPath: String(body.folderPath ?? ''),
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, { ok: true, result, snapshot });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/export-plans') {
              const body = await readJsonBody(request);
              const result = planRekordboxDeviceExport(databasePath, {
                playlistRef: String(body.playlistRef ?? ''),
                executionNodeRef: String(body.executionNodeRef ?? ''),
                sourceStorageRef: typeof body.sourceStorageRef === 'string' ? body.sourceStorageRef : null,
                destinationStorageRef: typeof body.destinationStorageRef === 'string' ? body.destinationStorageRef : null,
                transport: typeof body.transport === 'string'
                  ? body.transport as 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual' | 'sneakernet'
                  : null,
              });
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, {
                ok: true,
                result: { planId: result.planId, playlistId: result.playlistId },
                snapshot,
              });
              return;
            }

            if (request.method === 'POST' && url.pathname === '/api/export-jobs') {
              const body = await readJsonBody(request);
              const result = await exportRekordboxDeviceToSavedTarget(databasePath, String(body.playlistRef ?? ''));
              const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
              sendJson(response, 200, {
                ok: true,
                result: { targetPath: result.outputRoot },
                snapshot,
              });
              return;
            }

            sendJson(response, 404, { error: `Unknown API route ${url.pathname}` });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected API error.';
            sendJson(response, 500, { error: message });
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@dj-vault/core': path.resolve(rootDir, '../../packages/core/src/index.ts'),
      '@dj-vault/corpus': path.resolve(rootDir, '../../packages/corpus/src/index.ts'),
    },
  },
});
