import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { downloadToFile, inspectFile, type AcquiredFile, todayStamp } from './acquisition-utils.js';

type RekordboxCurrentDownloadInventory = {
  currentVersion: string | null;
  currentReleaseDate: string | null;
  packageUrl: string | null;
};

type RekordboxAcquisitionSummary = {
  collectedAt: string;
  version: string | null;
  releaseDate: string | null;
  packageUrl: string | null;
  artifact: AcquiredFile | null;
};

export async function acquireRekordboxCurrentPackage(manifestsDir: string, corpusDir: string): Promise<{ summaryPath: string }> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const inventory = JSON.parse(
    await readFile(path.join(inventoryDir, `rekordbox-current-download-${stamp}.json`), 'utf8'),
  ) as RekordboxCurrentDownloadInventory;

  let artifact: AcquiredFile | null = null;
  if (inventory.packageUrl) {
    const fileName = path.basename(new URL(inventory.packageUrl).pathname);
    const localPath = path.join(corpusDir, 'rekordbox', 'current', fileName);
    await downloadToFile(inventory.packageUrl, localPath);
    artifact = await inspectFile(`rekordbox ${inventory.currentVersion ?? 'current'}`, inventory.packageUrl, localPath);
  }

  const summary: RekordboxAcquisitionSummary = {
    collectedAt: new Date().toISOString(),
    version: inventory.currentVersion,
    releaseDate: inventory.currentReleaseDate,
    packageUrl: inventory.packageUrl,
    artifact,
  };

  const summaryPath = path.join(inventoryDir, `rekordbox-acquisition-summary-${stamp}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { summaryPath };
}
