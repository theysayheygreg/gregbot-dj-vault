import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { downloadToFile, inspectFile, slugify, todayStamp, type AcquiredFile } from './acquisition-utils.js';

type EngineDjDownloadsInventory = {
  desktopPackages: Array<{
    url: string;
    platform: 'windows' | 'mac';
    version: string | null;
  }>;
  hardwarePackages: Array<{
    title: string;
    brand: string;
    productType: string;
    version: string | null;
    usbUrl: string;
  }>;
};

type EngineAcquisitionSummary = {
  collectedAt: string;
  targets: string[];
  artifacts: AcquiredFile[];
};

const TARGET_TITLES = ['SC6000 PRIME', 'PRIME 4+', 'SC LIVE 4'] as const;

export async function acquireEngineDjBoundedSet(manifestsDir: string, corpusDir: string): Promise<{ summaryPath: string }> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const inventory = JSON.parse(
    await readFile(path.join(inventoryDir, `engine-dj-downloads-${stamp}.json`), 'utf8'),
  ) as EngineDjDownloadsInventory;

  const artifacts: AcquiredFile[] = [];

  const currentDesktop = inventory.desktopPackages.find((entry) => entry.platform === 'windows' && entry.version === '4.5.0')
    ?? inventory.desktopPackages.find((entry) => entry.platform === 'windows');

  if (currentDesktop) {
    const fileName = path.basename(new URL(currentDesktop.url).pathname);
    const localPath = path.join(corpusDir, 'engine-dj', 'desktop', fileName);
    await downloadToFile(currentDesktop.url, localPath);
    artifacts.push(await inspectFile(`Engine DJ Desktop ${currentDesktop.version ?? 'current'} Windows`, currentDesktop.url, localPath));
  }

  for (const title of TARGET_TITLES) {
    const hardware = inventory.hardwarePackages.find((entry) => entry.title === title);
    if (!hardware) {
      continue;
    }

    const fileName = path.basename(new URL(hardware.usbUrl).pathname);
    const localPath = path.join(corpusDir, 'engine-dj', slugify(title), fileName);
    await downloadToFile(hardware.usbUrl, localPath);
    artifacts.push(await inspectFile(`${title} ${hardware.version ?? 'current'} USB image`, hardware.usbUrl, localPath));
  }

  const summary: EngineAcquisitionSummary = {
    collectedAt: new Date().toISOString(),
    targets: [...TARGET_TITLES],
    artifacts,
  };

  const summaryPath = path.join(inventoryDir, `engine-dj-acquisition-summary-${stamp}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { summaryPath };
}
