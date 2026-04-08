import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { todayStamp } from './acquisition-utils.js';

const execFileAsync = promisify(execFile);

type RekordboxAcquisitionSummary = {
  artifact: {
    localPath: string;
  } | null;
};

type EngineDjAcquisitionSummary = {
  artifacts: Array<{
    localPath: string;
  }>;
};

type LocalArtifactInspection = {
  path: string;
  fileType: string;
  hdiutilImageInfo?: string | null;
  fdisk?: string | null;
  peMetadata?: {
    format: string;
    architecture: string | null;
    timeDate: string | null;
    subsystem: string | null;
    dllCharacteristics: string[];
    importedDlls: string[];
  } | null;
  extractedExecutablePath?: string | null;
  partitionMap?: {
    uuidDisk: string | null;
    partitions: Array<Record<string, string>>;
  } | null;
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
  magicHits?: Array<{
    name: string;
    offset: number;
  }>;
  interestingStrings: string[];
};

type LocalArtifactInspectionSummary = {
  collectedAt: string;
  rekordbox: LocalArtifactInspection | null;
  engineDj: LocalArtifactInspection[];
};

async function runCommand(command: string, args: string[], maxBuffer = 4_000_000): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { maxBuffer });
    const output = `${stdout}${stderr}`.trim();
    return output.length > 0 ? output : null;
  } catch (error) {
    return null;
  }
}

async function interestingStrings(filePath: string, patterns: string[]): Promise<string[]> {
  const stringsOutput = await runCommand('/usr/bin/strings', ['-a', '-n', '8', filePath], 8_000_000);
  if (!stringsOutput) {
    return [];
  }

  return stringsOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => patterns.some((pattern) => new RegExp(pattern, 'i').test(line)))
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 120);
}

function parsePeMetadata(text: string | null): LocalArtifactInspection['peMetadata'] {
  if (!text) {
    return null;
  }

  const format = text.match(/file format ([^\n]+)/)?.[1]?.trim() ?? 'unknown';
  const architecture = text.match(/architecture:\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const timeDate = text.match(/Time\/Date\s+([^\n]+)/)?.[1]?.trim() ?? null;
  const subsystem = text.match(/Subsystem\s+[0-9A-Fa-f]+\s+\(([^)]+)\)/)?.[1]?.trim() ?? null;

  const dllCharacteristicsBlock = text.match(/DllCharacteristics[^\n]*\n([\s\S]*?)SizeOfStackReserve/);
  const dllCharacteristics = dllCharacteristicsBlock
    ? dllCharacteristicsBlock[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const importedDlls = [...text.matchAll(/DLL Name:\s+([^\n]+)/g)].map((match) => match[1].trim());

  return {
    format,
    architecture,
    timeDate,
    subsystem,
    dllCharacteristics,
    importedDlls,
  };
}

function parsePartitionMap(strings: string[]): LocalArtifactInspection['partitionMap'] {
  const partitionLine = strings.find((line) => line.startsWith('partitions=uuid_disk='));
  if (!partitionLine) {
    return null;
  }

  const segments = partitionLine.replace(/^partitions=/, '').split(';').filter(Boolean);
  const [uuidDiskSegment, ...partitionSegments] = segments;
  const uuidDisk = uuidDiskSegment?.startsWith('uuid_disk=') ? uuidDiskSegment.replace('uuid_disk=', '') : null;

  const partitions = partitionSegments.map((segment) => {
    const fields = segment.split(',').filter(Boolean);
    const record: Record<string, string> = {};
    for (const field of fields) {
      const [key, ...rest] = field.split('=');
      if (!key || rest.length === 0) {
        continue;
      }
      record[key] = rest.join('=');
    }
    return record;
  });

  return {
    uuidDisk,
    partitions,
  };
}

async function extractZipExecutable(filePath: string): Promise<string | null> {
  const tmpDir = path.resolve(process.cwd(), 'tmp', 'local-inspection', path.basename(filePath, '.zip'));
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const unzipOutput = await runCommand('/usr/bin/unzip', ['-o', filePath, '-d', tmpDir], 8_000_000);
  if (unzipOutput === null) {
    return null;
  }

  return path.join(tmpDir, path.basename(filePath, '.zip') + '.exe');
}

async function parseAz0xWrapper(filePath: string): Promise<LocalArtifactInspection['az0xWrapper']> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const view = header.subarray(0, bytesRead);
    if (view.subarray(0, 4).toString('ascii') !== 'AZ0x') {
      return null;
    }

    const version = view.readUInt32LE(4);
    const headerSize = view.readUInt32LE(0x0c);
    const stringTableOffset = view.readUInt32LE(0x10);
    const stringTableSize = view.readUInt32LE(0x14);
    const entryTableOffset = view.readUInt32LE(0x18);
    const entryTableEnd = view.readUInt32LE(0x1c);

    const stringTable = view.subarray(stringTableOffset, stringTableOffset + stringTableSize);
    const strings = stringTable
      .toString('ascii')
      .split('\0')
      .map((value) => value.trim())
      .filter(Boolean);
    const resolveNameHint = (hint: number): string | null => {
      if (hint < 0 || hint >= stringTable.length) {
        return null;
      }

      let end = hint;
      while (end < stringTable.length && stringTable[end] !== 0) {
        end += 1;
      }

      const value = stringTable.subarray(hint, end).toString('ascii').trim();
      return value.length > 0 ? value : null;
    };

    const entries: NonNullable<LocalArtifactInspection['az0xWrapper']>['entries'] = [];
    for (let off = entryTableOffset; off + 0x40 <= Math.min(entryTableEnd, view.length); off += 0x40) {
      const tag = view.subarray(off, off + 4).toString('ascii').replace(/\0/g, '');
      if (!/^[A-Z]{4}$/.test(tag)) {
        break;
      }

      const flags = view.readUInt32LE(off + 4);
      const offset = Number(view.readBigUInt64LE(off + 8));
      const size = Number(view.readBigUInt64LE(off + 16));
      const nameHint = view.readUInt32LE(off + 24);
      const resolvedName = resolveNameHint(nameHint);
      const mask = view.readUInt32LE(off + 28);
      const sha256Prefix = view.subarray(off + 32, off + 64).toString('hex');

      entries.push({
        tag,
        flags,
        offset,
        size,
        nameHint,
        resolvedName,
        mask,
        sha256Prefix,
      });
    }

    return {
      version,
      headerSize,
      stringTableOffset,
      stringTableSize,
      entryTableOffset,
      entryTableEnd,
      strings,
      entries,
    };
  } finally {
    await handle.close();
  }
}

async function scanMagicHits(filePath: string): Promise<Array<{ name: string; offset: number }>> {
  const patterns = [
    { name: 'dtb_or_fit', bytes: Buffer.from([0xd0, 0x0d, 0xfe, 0xed]) },
    { name: 'u_boot_legacy_image', bytes: Buffer.from([0x27, 0x05, 0x19, 0x56]) },
    { name: 'squashfs', bytes: Buffer.from('hsqs', 'ascii') },
    { name: 'cpio_newc', bytes: Buffer.from('070701', 'ascii') },
    { name: 'denon_az0x_wrapper', bytes: Buffer.from('AZ0x', 'ascii') },
    { name: 'u_boot_rockchip', bytes: Buffer.from('u-boot-rockchip.bin', 'ascii') },
  ];

  const extCandidates: Array<{ name: string; offset: number }> = [];
  const hits: Array<{ name: string; offset: number }> = [];
  const handle = await open(filePath, 'r');
  const chunkSize = 1024 * 1024;
  const overlap = 64;
  let position = 0;
  let previous = Buffer.alloc(0);

  try {
    while (true) {
      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, position);
      if (bytesRead === 0) {
        break;
      }

      const chunk = Buffer.concat([previous, buffer.subarray(0, bytesRead)]);
      const baseOffset = position - previous.length;

      for (const pattern of patterns) {
        let start = 0;
        while (start < chunk.length) {
          const found = chunk.indexOf(pattern.bytes, start);
          if (found === -1) {
            break;
          }
          hits.push({ name: pattern.name, offset: baseOffset + found });
          start = found + 1;
        }
      }

      for (let i = 0; i < chunk.length - 1; i += 1) {
        if (chunk[i] === 0x53 && chunk[i + 1] === 0xef) {
          const offset = baseOffset + i;
          if (offset >= 56 && offset % 1024 === 56) {
            extCandidates.push({ name: 'ext_superblock_magic_candidate', offset });
          }
        }
      }

      previous = chunk.subarray(Math.max(0, chunk.length - overlap));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }

  const deduped = [...hits, ...extCandidates]
    .filter((hit, index, all) => all.findIndex((item) => item.name === hit.name && item.offset === hit.offset) === index)
    .sort((left, right) => left.offset - right.offset);

  return deduped.slice(0, 200);
}

async function inspectArtifact(filePath: string, patterns: string[]): Promise<LocalArtifactInspection> {
  const extractedExecutablePath = filePath.toLowerCase().endsWith('.zip') ? await extractZipExecutable(filePath) : null;
  const peTargetPath = extractedExecutablePath ?? (filePath.toLowerCase().endsWith('.exe') ? filePath : null);

  const [fileType, imageInfo, fdiskInfo, strings, peDump, magicHits, az0xWrapper] = await Promise.all([
    runCommand('/usr/bin/file', ['-b', filePath]),
    runCommand('/usr/bin/hdiutil', ['imageinfo', filePath]),
    runCommand('/usr/sbin/fdisk', [filePath]),
    interestingStrings(filePath, patterns),
    peTargetPath ? runCommand('/usr/bin/objdump', ['-x', peTargetPath], 8_000_000) : Promise.resolve(null),
    scanMagicHits(filePath),
    parseAz0xWrapper(filePath),
  ]);

  return {
    path: filePath,
    fileType: fileType ?? 'unknown',
    hdiutilImageInfo: imageInfo,
    fdisk: fdiskInfo,
    peMetadata: parsePeMetadata(peDump),
    extractedExecutablePath,
    partitionMap: parsePartitionMap(strings),
    az0xWrapper,
    magicHits,
    interestingStrings: strings,
  };
}

export async function inspectLocalAcquisitions(manifestsDir: string): Promise<{ summaryPath: string }> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  const [rekordboxAcquisition, engineDjAcquisition] = await Promise.all([
    JSON.parse(
      await readFile(path.join(inventoryDir, `rekordbox-acquisition-summary-${stamp}.json`), 'utf8'),
    ) as RekordboxAcquisitionSummary,
    JSON.parse(
      await readFile(path.join(inventoryDir, `engine-dj-acquisition-summary-${stamp}.json`), 'utf8'),
    ) as EngineDjAcquisitionSummary,
  ]);

  const rekordbox = rekordboxAcquisition.artifact
    ? await inspectArtifact(rekordboxAcquisition.artifact.localPath, [
        'rekordbox',
        'Nullsoft',
        'NSIS',
        'Beatport',
        'Beatsource',
        'AlphaTheta',
        'Pioneer',
        'xml',
        'usb',
        'license',
        'driver',
      ])
    : null;

  const engineDj = [];
  for (const artifact of engineDjAcquisition.artifacts) {
    engineDj.push(
      await inspectArtifact(artifact.localPath, [
        'EngineOS',
        'engine',
        'DENON',
        'PRIME',
        'SC LIVE',
        'SC6000',
        'u-boot',
        'U-Boot',
        'bootloader',
        'kernel',
        'rootfs',
        'device tree',
        'DTB',
        'FIT',
        'linux',
        'updatesplash',
      ]),
    );
  }

  const summary: LocalArtifactInspectionSummary = {
    collectedAt: new Date().toISOString(),
    rekordbox,
    engineDj,
  };

  const summaryPath = path.join(inventoryDir, `local-artifact-inspection-summary-${stamp}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { summaryPath };
}
