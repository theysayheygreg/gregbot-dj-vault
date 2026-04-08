import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

type UnpackedEntry = {
  relativePath: string;
  sizeBytes: number;
  fileType: string;
  interestingStrings: string[];
};

type UnpackInspection = {
  productName: string;
  articleTitle: string;
  archivePath: string;
  unpackDir: string;
  entries: UnpackedEntry[];
};

type UnpackSummary = {
  collectedAt: string;
  archiveCount: number;
  inspections: UnpackInspection[];
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function findLatestArchiveAcquisitionSummary(inventoryDir: string): Promise<string> {
  const files = await readdir(inventoryDir);
  const matches = files
    .filter((fileName) => /^alphatheta-acquisition-summary-archive-.*-\d{4}-\d{2}-\d{2}\.json$/.test(fileName))
    .sort();
  const latest = matches.at(-1);
  if (!latest) {
    throw new Error('No AlphaTheta archive acquisition summary found.');
  }
  return path.join(inventoryDir, latest);
}

async function walkFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, absolute)));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

async function fileType(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/file', ['-b', filePath]);
  return stdout.trim();
}

async function interestingStrings(filePath: string): Promise<string[]> {
  const extension = path.extname(filePath).toLowerCase();
  if (!['.upd', '.exe', '.dll', '.bin'].includes(extension)) {
    return [];
  }

  try {
    const { stdout } = await execFileAsync('/usr/bin/strings', ['-a', '-n', '8', filePath], {
      maxBuffer: 2_000_000,
    });
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /alpha|pioneer|djm|xdj|cdj|rekordbox|firmware|driver|usb|link|version|windows|mac/i.test(line));
    return [...new Set(lines)].slice(0, 25);
  } catch {
    return [];
  }
}

export async function unpackAlphaThetaArchives(manifestsDir: string, unpackRootDir: string): Promise<{ summaryPath: string }> {
  const inventoryDir = path.join(manifestsDir, 'inventories');
  await mkdir(inventoryDir, { recursive: true });
  await mkdir(unpackRootDir, { recursive: true });

  const acquisitionPath = await findLatestArchiveAcquisitionSummary(inventoryDir);
  const acquisition = JSON.parse(await readFile(acquisitionPath, 'utf8')) as AlphaThetaAcquisitionSummary;
  const archives = acquisition.artifacts.filter((artifact) => artifact.fileName.toLowerCase().endsWith('.zip'));

  const inspections: UnpackInspection[] = [];

  for (const artifact of archives) {
    const unpackDir = path.join(unpackRootDir, slugify(artifact.productName), slugify(path.basename(artifact.fileName, '.zip')));
    await rm(unpackDir, { recursive: true, force: true });
    await mkdir(unpackDir, { recursive: true });
    await execFileAsync('/usr/bin/unzip', ['-o', artifact.localPath, '-d', unpackDir], { maxBuffer: 4_000_000 });

    const files = await walkFiles(unpackDir);
    const entries: UnpackedEntry[] = [];

    for (const filePath of files) {
      const fileStat = await stat(filePath);
      entries.push({
        relativePath: path.relative(unpackDir, filePath),
        sizeBytes: fileStat.size,
        fileType: await fileType(filePath),
        interestingStrings: await interestingStrings(filePath),
      });
    }

    inspections.push({
      productName: artifact.productName,
      articleTitle: artifact.articleTitle,
      archivePath: artifact.localPath,
      unpackDir,
      entries,
    });
  }

  const summary: UnpackSummary = {
    collectedAt: new Date().toISOString(),
    archiveCount: inspections.length,
    inspections,
  };

  const summaryPath = path.join(inventoryDir, `alphatheta-unpack-summary-${todayStamp()}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summaryPath };
}
