import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type RekordboxCurrentDownloadInventory = {
  vendor: 'pioneer-alphatheta';
  product: 'rekordbox';
  collectedAt: string;
  pageUrl: string;
  currentVersion: string | null;
  currentReleaseDate: string | null;
  packageUrl: string | null;
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return await response.text();
}

export async function collectRekordboxCurrentDownload(manifestsDir: string): Promise<{
  inventoryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const pageUrl = 'https://rekordbox.com/en/download/';

  await mkdir(inventoryDir, { recursive: true });

  const html = await fetchHtml(pageUrl);
  const versionMatch = html.match(/<h2>ver\.\s*([^<\s]+)\s*\((\d{4})\.(\d{2})\.(\d{2})\)<\/h2>/i);
  const packageUrl = [...html.matchAll(/data-url="([^"]+)"/g)]
    .map((match) => match[1])
    .find((url) => /^https:\/\/cdn\.rekordbox\.com\/files\/.+\.zip$/i.test(url)) ?? null;

  const inventory: RekordboxCurrentDownloadInventory = {
    vendor: 'pioneer-alphatheta',
    product: 'rekordbox',
    collectedAt,
    pageUrl,
    currentVersion: versionMatch?.[1] ?? null,
    currentReleaseDate: versionMatch ? `${versionMatch[2]}-${versionMatch[3]}-${versionMatch[4]}` : null,
    packageUrl,
  };

  const inventoryPath = path.join(inventoryDir, `rekordbox-current-download-${stamp}.json`);
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

  return { inventoryPath };
}
