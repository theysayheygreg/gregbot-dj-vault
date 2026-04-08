import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SourceMap, SourceSurface } from './source-maps.js';

type CollectedSurface = SourceSurface & {
  fetchedAt: string;
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  title: string | null;
  error: string | null;
};

type VendorInventory = {
  vendor: string;
  snapshotDate: string;
  collectedAt: string;
  surfaces: CollectedSurface[];
};

type InventorySummary = {
  collectedAt: string;
  vendors: Array<{
    vendor: string;
    total: number;
    ok: number;
    failed: number;
  }>;
};

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : null;
}

async function readSourceMap(filePath: string): Promise<SourceMap> {
  return JSON.parse(await readFile(filePath, 'utf8')) as SourceMap;
}

async function collectSurface(surface: SourceSurface): Promise<CollectedSurface> {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(surface.url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
      },
    });

    const contentType = response.headers.get('content-type');
    const finalUrl = response.url;
    let title: string | null = null;

    if (contentType?.includes('text/html')) {
      const body = await response.text();
      title = extractTitle(body);
    } else {
      await response.arrayBuffer();
    }

    return {
      ...surface,
      fetchedAt,
      ok: response.ok,
      status: response.status,
      finalUrl,
      contentType,
      title,
      error: null,
    };
  } catch (error) {
    return {
      ...surface,
      fetchedAt,
      ok: false,
      status: 0,
      finalUrl: surface.url,
      contentType: null,
      title: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function collectSourceInventory(manifestsDir: string): Promise<{
  summaryPath: string;
  vendorPaths: string[];
}> {
  const sourceMapFiles = [
    'pioneer-alphatheta-source-map.json',
    'native-instruments-source-map.json',
    'serato-source-map.json',
    'denon-source-map.json',
  ];

  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  await mkdir(inventoryDir, { recursive: true });

  const vendorInventories: VendorInventory[] = [];

  for (const fileName of sourceMapFiles) {
    const sourceMap = await readSourceMap(path.join(manifestsDir, fileName));
    const surfaces: CollectedSurface[] = [];

    for (const surface of sourceMap.surfaces) {
      surfaces.push(await collectSurface(surface));
    }

    vendorInventories.push({
      vendor: sourceMap.vendor,
      snapshotDate: sourceMap.snapshotDate,
      collectedAt,
      surfaces,
    });
  }

  const vendorPaths: string[] = [];

  for (const inventory of vendorInventories) {
    const filePath = path.join(
      inventoryDir,
      `${inventory.vendor}-source-inventory-${stamp}.json`,
    );
    await writeFile(filePath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    vendorPaths.push(filePath);
  }

  const summary: InventorySummary = {
    collectedAt,
    vendors: vendorInventories.map((inventory) => {
      const ok = inventory.surfaces.filter((surface) => surface.ok).length;
      return {
        vendor: inventory.vendor,
        total: inventory.surfaces.length,
        ok,
        failed: inventory.surfaces.length - ok,
      };
    }),
  };

  const summaryPath = path.join(inventoryDir, `source-inventory-summary-${stamp}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summaryPath, vendorPaths };
}
