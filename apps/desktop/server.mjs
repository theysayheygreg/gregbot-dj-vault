import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, '../..');
const distDir = path.resolve(rootDir, 'dist');
const databasePath = process.env.DJ_VAULT_DB_PATH
  ? path.resolve(process.env.DJ_VAULT_DB_PATH)
  : path.resolve(workspaceRoot, 'data/dj-vault.sqlite');
const dashboardOutputPath = path.resolve(rootDir, 'src/generated/catalog-dashboard.json');
const port = Number.parseInt(process.env.PORT ?? '4187', 10);

const {
  addTrackToPlaylist,
  createPlaylist,
} = await import('../../packages/catalog/dist/authoring.js');
const { exportDashboardSnapshot } = await import('../../packages/catalog/dist/dashboard.js');
const {
  exportRekordboxDeviceToSavedTarget,
  planRekordboxDeviceExport,
  saveRekordboxDeviceTarget,
} = await import('../../packages/catalog/dist/device-export-workflow.js');
const {
  removeTrackFromPlaylist,
  updateTrackMetadata,
} = await import('../../packages/catalog/dist/editing.js');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/dashboard') {
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, snapshot);
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/playlists') {
    const body = await readJsonBody(request);
    const result = createPlaylist(databasePath, {
      name: String(body.name ?? ''),
      type: body.type ?? 'playlist',
    });
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, { ok: true, result, snapshot });
    return true;
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
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/playlist-items/add') {
    const body = await readJsonBody(request);
    const result = addTrackToPlaylist(databasePath, {
      playlistId: String(body.playlistId ?? ''),
      trackRef: String(body.trackRef ?? ''),
    });
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, { ok: true, result, snapshot });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/playlist-items/remove') {
    const body = await readJsonBody(request);
    const result = removeTrackFromPlaylist(databasePath, {
      playlistId: String(body.playlistId ?? ''),
      position: Number(body.position ?? -1),
    });
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, { ok: true, result, snapshot });
    return true;
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
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/export-plans') {
    const body = await readJsonBody(request);
    const result = planRekordboxDeviceExport(databasePath, {
      playlistRef: String(body.playlistRef ?? ''),
      executionNodeRef: String(body.executionNodeRef ?? ''),
      sourceStorageRef: typeof body.sourceStorageRef === 'string' ? body.sourceStorageRef : null,
      destinationStorageRef: typeof body.destinationStorageRef === 'string' ? body.destinationStorageRef : null,
      transport: typeof body.transport === 'string' ? body.transport : null,
    });
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, { ok: true, result: { planId: result.planId, playlistId: result.playlistId }, snapshot });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/export-jobs') {
    const body = await readJsonBody(request);
    const result = await exportRekordboxDeviceToSavedTarget(databasePath, String(body.playlistRef ?? ''));
    const snapshot = await exportDashboardSnapshot(databasePath, dashboardOutputPath);
    sendJson(response, 200, { ok: true, result: { targetPath: result.outputRoot }, snapshot });
    return true;
  }

  return false;
}

async function handleStatic(response, url) {
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const resolvedPath = path.resolve(distDir, `.${requestedPath}`);
  if (!resolvedPath.startsWith(distDir)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  try {
    const contents = await readFile(resolvedPath);
    response.statusCode = 200;
    response.setHeader('Content-Type', mimeTypes.get(path.extname(resolvedPath)) ?? 'application/octet-stream');
    response.end(contents);
  } catch {
    const fallbackHtml = await readFile(path.join(distDir, 'index.html'));
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(fallbackHtml);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(request, response, url);
      if (!handled) {
        sendJson(response, 404, { error: `Unknown API route ${url.pathname}` });
      }
      return;
    }

    await handleStatic(response, url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected runtime error.';
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`VaultBuddy runtime listening on http://localhost:${port}`);
  console.log(`Using catalog database at ${databasePath}`);
});
