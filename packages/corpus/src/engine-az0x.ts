import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { slugify, todayStamp } from './acquisition-utils.js';

const execFileAsync = promisify(execFile);

type LocalArtifactInspectionSummary = {
  engineDj: Array<{
    path: string;
    az0xWrapper?: {
      version: number;
      headerSize: number;
      stringTableOffset: number;
      stringTableSize: number;
      entryTableOffset: number;
      entryTableEnd: number;
      strings: string[];
      entries: Array<{
        tag: string;
        flags: number;
        offset: number;
        size: number;
        nameHint: number;
        resolvedName: string | null;
        mask: number;
        sha256Prefix: string;
      }>;
    } | null;
    partitionMap?: {
      partitions: Array<{
        name: string;
      }>;
    } | null;
  }>;
};

type Az0xCarvedEntry = {
  sourcePath: string;
  outputPath: string;
  tag: string;
  index: number;
  offset: number;
  size: number;
  flags: number;
  mask: number;
  logicalName: string | null;
  fileType: string | null;
  xzDecodedFileType: string | null;
  sha256Prefix: string;
};

type Az0xCarveSummary = {
  collectedAt: string;
  images: Array<{
    imagePath: string;
    outputDir: string;
    entryCount: number;
    entries: Az0xCarvedEntry[];
  }>;
};

function deriveLogicalNames(item: LocalArtifactInspectionSummary['engineDj'][number]): Array<string | null> {
  const partitionNames = item.partitionMap?.partitions.map((entry) => entry.name) ?? [];
  const bootNames = ['spl1', 'spl2', 'uboot1', 'uboot2'];
  const names: Array<string | null> = [];

  let bootIndex = 0;
  for (const entry of item.az0xWrapper?.entries ?? []) {
    if (entry.tag === 'BOOT') {
      names.push(bootNames[bootIndex] ?? `boot-${bootIndex}`);
      bootIndex += 1;
      continue;
    }

    if (entry.tag === 'PART') {
      if (entry.resolvedName) {
        names.push(entry.resolvedName);
        continue;
      }

      const fromMask = partitionNames.find((_, index) => entry.mask === 1 << index);
      names.push(fromMask ?? `part-offset-${entry.offset}`);
      continue;
    }

    names.push(null);
  }

  return names;
}

async function runCommand(command: string, args: string[], maxBuffer = 4_000_000): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { maxBuffer });
    const output = `${stdout}${stderr}`.trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

async function inspectCarvedFile(outputPath: string): Promise<{ fileType: string | null; xzDecodedFileType: string | null }> {
  const fileType = await runCommand('/usr/bin/file', ['-b', outputPath]);
  let xzDecodedFileType: string | null = null;

  if (fileType?.includes('XZ compressed data')) {
    xzDecodedFileType = await runCommand('/bin/sh', ['-lc', `xz -dc ${JSON.stringify(outputPath)} 2>/dev/null | /usr/bin/file -b -`]);
  }

  return {
    fileType,
    xzDecodedFileType,
  };
}

export async function carveEngineAz0xImages(manifestsDir: string, outputRootDir: string): Promise<{ summaryPath: string }> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const inspection = JSON.parse(
    await readFile(path.join(inventoryDir, `local-artifact-inspection-summary-${stamp}.json`), 'utf8'),
  ) as LocalArtifactInspectionSummary;

  const images = inspection.engineDj.filter((item) => item.az0xWrapper);
  const summaryImages: Az0xCarveSummary['images'] = [];

  for (const image of images) {
    const sourcePath = image.path;
    const sourceBase = path.basename(sourcePath, path.extname(sourcePath));
    const outputDir = path.join(outputRootDir, slugify(sourceBase));
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const handle = await open(sourcePath, 'r');
    const entries: Az0xCarvedEntry[] = [];
    const logicalNames = deriveLogicalNames(image);

    try {
      for (const [index, entry] of (image.az0xWrapper?.entries ?? []).entries()) {
        const logicalName = logicalNames[index] ?? null;
        const label = logicalName ? slugify(logicalName) : `${entry.tag.toLowerCase()}-${index + 1}`;
        const outputPath = path.join(outputDir, `${String(index).padStart(2, '0')}-${entry.tag.toLowerCase()}-${label}.bin`);
        const buffer = Buffer.alloc(entry.size);
        const { bytesRead } = await handle.read(buffer, 0, entry.size, entry.offset);
        await writeFile(outputPath, buffer.subarray(0, bytesRead));
        const inspection = await inspectCarvedFile(outputPath);

        entries.push({
          sourcePath,
          outputPath,
          tag: entry.tag,
          index,
          offset: entry.offset,
          size: entry.size,
          flags: entry.flags,
          mask: entry.mask,
          logicalName,
          fileType: inspection.fileType,
          xzDecodedFileType: inspection.xzDecodedFileType,
          sha256Prefix: entry.sha256Prefix,
        });
      }
    } finally {
      await handle.close();
    }

    summaryImages.push({
      imagePath: sourcePath,
      outputDir,
      entryCount: entries.length,
      entries,
    });
  }

  const summary: Az0xCarveSummary = {
    collectedAt: new Date().toISOString(),
    images: summaryImages,
  };

  const summaryPath = path.join(inventoryDir, `engine-az0x-carve-summary-${stamp}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { summaryPath };
}
