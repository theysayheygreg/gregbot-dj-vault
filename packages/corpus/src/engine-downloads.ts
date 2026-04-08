import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type EngineDjDesktopPackage = {
  url: string;
  platform: 'windows' | 'mac';
  version: string | null;
};

type EngineDjHardwarePackage = {
  title: string;
  brand: string;
  productType: string;
  version: string | null;
  winUrl: string;
  macUrl: string;
  usbUrl: string;
  userGuideUrl: string;
  updateGuideUrl: string;
  otaOnly: boolean;
};

type EngineDjDownloadsInventory = {
  vendor: 'denon-engine';
  product: 'engine-dj';
  collectedAt: string;
  pageUrl: string;
  desktopPackages: EngineDjDesktopPackage[];
  hardwarePackages: EngineDjHardwarePackage[];
};

type EngineDjDownloadsSummary = {
  collectedAt: string;
  desktopPackageCount: number;
  currentDesktopVersion: string | null;
  hardwarePackageCount: number;
  denonHardwareCount: number;
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

function parseVersion(value: string): string | null {
  const match = value.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  return match ? match[1] : null;
}

export async function collectEngineDjDownloads(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const pageUrl = 'https://enginedj.com/downloads';

  await mkdir(inventoryDir, { recursive: true });

  const html = await fetchHtml(pageUrl);

  const desktopPackages = [
    ...new Map(
      [...html.matchAll(/href="(https:\/\/[^"]*Engine_DJ_[^"]*Setup\.(?:exe|dmg))"/g)].map((match) => [
        match[1],
        {
          url: match[1],
          platform: match[1].toLowerCase().endsWith('.exe') ? 'windows' : 'mac',
          version: parseVersion(match[1]),
        } satisfies EngineDjDesktopPackage,
      ]),
    ).values(),
  ];

  const hardwarePackages = [...html.matchAll(
    /"winUrl":"([^"]*)","macUrl":"([^"]*)","usbUrl":"([^"]*)","userGuideUrl":"([^"]*)","updateGuideUrl":"([^"]*)","otaOnly":(true|false),"hardwareUnit":\{"__typename":"[^"]+","otaUpdateXmlId":(?:null|"[^"]*"),"title":"([^"]+)","brand":"([^"]+)","productType":"([^"]+)"/g,
  )].map(
    (match) =>
      ({
        title: match[7],
        brand: match[8],
        productType: match[9],
        version: parseVersion(match[1]) ?? parseVersion(match[3]),
        winUrl: match[1],
        macUrl: match[2],
        usbUrl: match[3],
        userGuideUrl: match[4],
        updateGuideUrl: match[5],
        otaOnly: match[6] === 'true',
      }) satisfies EngineDjHardwarePackage,
  );

  const inventory: EngineDjDownloadsInventory = {
    vendor: 'denon-engine',
    product: 'engine-dj',
    collectedAt,
    pageUrl,
    desktopPackages,
    hardwarePackages,
  };

  const summary: EngineDjDownloadsSummary = {
    collectedAt,
    desktopPackageCount: desktopPackages.length,
    currentDesktopVersion: desktopPackages[0]?.version ?? null,
    hardwarePackageCount: hardwarePackages.length,
    denonHardwareCount: hardwarePackages.filter((item) => item.brand === 'Denon DJ').length,
  };

  const inventoryPath = path.join(inventoryDir, `engine-dj-downloads-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `engine-dj-downloads-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
