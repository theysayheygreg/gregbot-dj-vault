import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import {
  createPlaylist,
} from '../../packages/catalog/src/authoring';
import { exportDashboardSnapshot } from '../../packages/catalog/src/dashboard';
import {
  exportRekordboxDeviceToSavedTarget,
  planRekordboxDeviceExport,
  saveRekordboxDeviceTarget,
} from '../../packages/catalog/src/device-export-workflow';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, '../..');
const databasePath = path.resolve(workspaceRoot, 'data/dj-vault.sqlite');
const dashboardOutputPath = path.resolve(rootDir, 'src/generated/catalog-dashboard.json');

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
