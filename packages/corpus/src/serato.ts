import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SeratoArchiveEntry = {
  version: string;
  releaseNotesUrl: string;
  downloadUrl: string;
};

type SeratoArchiveInventory = {
  vendor: 'serato';
  product: 'serato-dj-pro';
  collectedAt: string;
  archiveUrl: string;
  entries: SeratoArchiveEntry[];
};

type SeratoArchiveSummary = {
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

export async function collectSeratoDjProArchive(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const archiveUrl = 'https://serato.com/dj/pro/downloads/archive';

  await mkdir(inventoryDir, { recursive: true });

  const html = await fetchHtml(archiveUrl);
  const versions = [...html.matchAll(/href="\/dj\/pro\/downloads\/(\d+\.\d+(?:\.\d+)?)#release-notes"/g)].map((match) => match[1]);
  const entries = versions.map((version) => ({
    version,
    releaseNotesUrl: `https://serato.com/dj/pro/downloads/${version}#release-notes`,
    downloadUrl: `https://serato.com/dj/pro/downloads/${version}`,
  }));

  const inventory: SeratoArchiveInventory = {
    vendor: 'serato',
    product: 'serato-dj-pro',
    collectedAt,
    archiveUrl,
    entries,
  };

  const summary: SeratoArchiveSummary = {
    collectedAt,
    entryCount: entries.length,
    latestVersion: entries[0]?.version ?? null,
    oldestVersion: entries.at(-1)?.version ?? null,
  };

  const inventoryPath = path.join(inventoryDir, `serato-dj-pro-archive-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `serato-dj-pro-archive-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
