import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type EngineDjReleaseEntry = {
  title: string;
  version: string | null;
  articleUrl: string;
};

type EngineDjReleaseInventory = {
  vendor: 'denon-engine';
  product: 'engine-dj';
  collectedAt: string;
  folderUrl: string;
  entries: EngineDjReleaseEntry[];
};

type EngineDjReleaseSummary = {
  collectedAt: string;
  entryCount: number;
  latestVersion: string | null;
  oldestVersion: string | null;
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

function parseVersion(title: string): string | null {
  const match = title.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  return match ? match[1] : null;
}

export async function collectEngineDjReleaseNotes(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const folderUrl = 'https://support.enginedj.com/en-US/support/solutions/folders/69000636315';

  await mkdir(inventoryDir, { recursive: true });

  const html = await fetchHtml(folderUrl);
  const entries = [...html.matchAll(/href="(\/en\/support\/solutions\/articles\/[^"]+)"[\s\S]*?<div class="line-clamp-2">([^<]+)<\/div>/g)]
    .map((match) => ({
      title: match[2].trim(),
      version: parseVersion(match[2].trim()),
      articleUrl: `https://support.enginedj.com${match[1]}`,
    }))
    .filter((entry) => entry.title.toLowerCase().includes('release notes'));

  const inventory: EngineDjReleaseInventory = {
    vendor: 'denon-engine',
    product: 'engine-dj',
    collectedAt,
    folderUrl,
    entries,
  };

  const versionedEntries = entries.filter((entry) => entry.version !== null);
  const summary: EngineDjReleaseSummary = {
    collectedAt,
    entryCount: entries.length,
    latestVersion: versionedEntries[0]?.version ?? null,
    oldestVersion: versionedEntries.at(-1)?.version ?? null,
  };

  const inventoryPath = path.join(inventoryDir, `engine-dj-release-notes-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `engine-dj-release-notes-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
