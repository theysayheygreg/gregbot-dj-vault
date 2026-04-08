import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type AlphaThetaAcquisitionSummary = {
  artifacts: Array<{
    productName: string;
    articleTitle: string;
    sectionLabel: string;
    artifactKind: string;
    href: string;
    fileName: string;
    localPath: string;
    sizeBytes: number;
  }>;
};

type AlphaThetaArchiveInspection = {
  productName: string;
  articleTitle: string;
  fileName: string;
  localPath: string;
  sizeBytes: number;
  sha256: string;
  zipEntries: Array<{
    path: string;
    sizeBytes: number | null;
  }>;
};

type AlphaThetaArchiveInspectionSummary = {
  collectedAt: string;
  archiveCount: number;
  totalBytes: number;
  inspections: AlphaThetaArchiveInspection[];
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function findLatestAcquisitionSummary(inventoryDir: string): Promise<string> {
  const files = await readdir(inventoryDir);
  const matches = files
    .filter((fileName) => /^alphatheta-acquisition-summary-.*-\d{4}-\d{2}-\d{2}\.json$/.test(fileName))
    .sort();
  const latest = matches.at(-1);
  if (!latest) {
    throw new Error('No AlphaTheta acquisition summary found.');
  }
  return path.join(inventoryDir, latest);
}

async function sha256(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/shasum', ['-a', '256', filePath]);
  return stdout.trim().split(/\s+/)[0] ?? '';
}

async function zipEntries(filePath: string): Promise<Array<{ path: string; sizeBytes: number | null }>> {
  const { stdout } = await execFileAsync('/usr/bin/zipinfo', ['-l', filePath]);
  const entries = stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => /^-[rwx]/.test(line))
    .slice(0, 200)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        path: parts.length >= 10 ? parts.slice(9).join(' ') : line,
        sizeBytes: parts.length >= 4 ? Number(parts[3]) : null,
      };
    });

  return entries;
}

export async function inspectAlphaThetaArchives(manifestsDir: string): Promise<{ summaryPath: string }> {
  const inventoryDir = path.join(manifestsDir, 'inventories');
  await mkdir(inventoryDir, { recursive: true });

  const acquisitionPath = await findLatestAcquisitionSummary(inventoryDir);
  const acquisition = JSON.parse(await readFile(acquisitionPath, 'utf8')) as AlphaThetaAcquisitionSummary;
  const archiveArtifacts = acquisition.artifacts.filter((artifact) => artifact.fileName.toLowerCase().endsWith('.zip'));

  const inspections: AlphaThetaArchiveInspection[] = [];

  for (const artifact of archiveArtifacts) {
    const fileStat = await stat(artifact.localPath);
    inspections.push({
      productName: artifact.productName,
      articleTitle: artifact.articleTitle,
      fileName: artifact.fileName,
      localPath: artifact.localPath,
      sizeBytes: fileStat.size,
      sha256: await sha256(artifact.localPath),
      zipEntries: await zipEntries(artifact.localPath),
    });
  }

  const summary: AlphaThetaArchiveInspectionSummary = {
    collectedAt: new Date().toISOString(),
    archiveCount: inspections.length,
    totalBytes: inspections.reduce((sum, item) => sum + item.sizeBytes, 0),
    inspections,
  };

  const summaryPath = path.join(inventoryDir, `alphatheta-archive-inspection-summary-${todayStamp()}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summaryPath };
}
