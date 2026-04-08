import { mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export type AcquiredFile = {
  label: string;
  url: string;
  localPath: string;
  sizeBytes: number;
  sha256: string;
  fileType: string;
  zipEntries?: string[];
};

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function downloadToFile(url: string, localPath: string): Promise<void> {
  await ensureDir(path.dirname(localPath));
  const response = await fetch(url, {
    headers: {
      'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(localPath);
    const reader = response.body!.getReader();

    const pump = (): void => {
      void reader.read().then(({ done, value }) => {
        if (done) {
          output.end();
          resolve();
          return;
        }

        output.write(Buffer.from(value), (error) => {
          if (error) {
            reject(error);
            return;
          }
          pump();
        });
      }, reject);
    };

    output.on('error', reject);
    pump();
  });
}

async function sha256ForFile(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/shasum', ['-a', '256', filePath]);
  return stdout.trim().split(/\s+/)[0] ?? '';
}

async function fileType(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/file', ['-b', filePath]);
  return stdout.trim();
}

async function zipEntries(filePath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/zipinfo', ['-1', filePath], { maxBuffer: 4_000_000 });
    return stdout.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 200);
  } catch {
    return [];
  }
}

export async function inspectFile(label: string, url: string, localPath: string): Promise<AcquiredFile> {
  const [fileStat, sha256, detectedType] = await Promise.all([
    stat(localPath),
    sha256ForFile(localPath),
    fileType(localPath),
  ]);

  return {
    label,
    url,
    localPath,
    sizeBytes: fileStat.size,
    sha256,
    fileType: detectedType,
    zipEntries: localPath.toLowerCase().endsWith('.zip') ? await zipEntries(localPath) : undefined,
  };
}
