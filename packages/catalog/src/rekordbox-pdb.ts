import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TABLE_TYPE_NAMES: Record<number, string> = {
  0x00: 'tracks',
  0x01: 'genres',
  0x02: 'artists',
  0x03: 'albums',
  0x04: 'labels',
  0x05: 'keys',
  0x06: 'colors',
  0x07: 'playlist_tree',
  0x08: 'playlist_entries',
  0x0d: 'artwork',
  0x10: 'columns',
  0x11: 'history_playlists',
  0x12: 'history_entries',
  0x13: 'history',
};

type TablePointer = {
  type: number;
  name: string;
  emptyCandidate: number;
  firstPage: number;
  lastPage: number;
};

type PageSummary = {
  pageIndex: number;
  tableType: number;
  tableName: string;
  nextPage: number;
  sequence: number;
  pageFlags: number;
  numRows: number;
  numRowsValid: number;
  freeSize: number;
  usedSize: number;
};

export type RekordboxPdbSummary = {
  filePath: string;
  pageSize: number;
  numTables: number;
  nextUnusedPage: number;
  unknown: number;
  sequence: number;
  tables: Array<TablePointer & {
    pageCount: number;
    totalRows: number;
    totalValidRows: number;
    pages: PageSummary[];
  }>;
};

export type RekordboxPdbDiff = {
  emptyPath: string;
  populatedPath: string;
  changedTables: Array<{
    type: number;
    name: string;
    emptyTotalRows: number;
    populatedTotalRows: number;
    emptyPageCount: number;
    populatedPageCount: number;
  }>;
};

export type RekordboxPdbWritePlan = {
  exportRoot: string;
  manifestPath: string;
  outputPath: string;
  targetTrackCount: number;
  targetPlaylistCount: number;
  referenceEmptyPath: string;
  referencePopulatedPath: string;
  referenceDiff: RekordboxPdbDiff;
  minimumTables: string[];
  referenceCoveredTables: string[];
  referenceGapTables: string[];
  deferredTables: string[];
  trackRowsPlanned: Array<{
    rekordboxTrackId: string;
    title: string;
    stagedRelativePath: string;
  }>;
  playlistRowsPlanned: Array<{
    name: string;
    entryCount: number;
  }>;
};

function readUint16LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUint24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readUint32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function decodePackedRowCounts(value: number): { numRows: number; numRowsValid: number } {
  return {
    numRows: value & 0x1fff,
    numRowsValid: (value >> 13) & 0x7ff,
  };
}

function tableName(type: number): string {
  return TABLE_TYPE_NAMES[type] ?? `unknown_${type}`;
}

export async function summarizeRekordboxPdb(filePath: string): Promise<RekordboxPdbSummary> {
  const absolutePath = path.resolve(filePath);
  const buffer = await readFile(absolutePath);

  const pageSize = readUint32LE(buffer, 4);
  const numTables = readUint32LE(buffer, 8);
  const nextUnusedPage = readUint32LE(buffer, 12);
  const unknown = readUint32LE(buffer, 16);
  const sequence = readUint32LE(buffer, 20);

  const tables: RekordboxPdbSummary['tables'] = [];
  for (let index = 0; index < numTables; index += 1) {
    const offset = 0x1c + (index * 16);
    const type = readUint32LE(buffer, offset);
    const pointer: TablePointer = {
      type,
      name: tableName(type),
      emptyCandidate: readUint32LE(buffer, offset + 4),
      firstPage: readUint32LE(buffer, offset + 8),
      lastPage: readUint32LE(buffer, offset + 12),
    };

    const pages: PageSummary[] = [];
    if (pointer.firstPage > 0) {
      let currentPage = pointer.firstPage;
      const visited = new Set<number>();

      while (currentPage > 0 && !visited.has(currentPage)) {
        visited.add(currentPage);
        const pageOffset = currentPage * pageSize;
        if (pageOffset + 32 > buffer.length) {
          break;
        }
        const pageIndex = readUint32LE(buffer, pageOffset + 4);
        const pageType = readUint32LE(buffer, pageOffset + 8);
        const nextPage = readUint32LE(buffer, pageOffset + 12);
        const pageSequence = readUint32LE(buffer, pageOffset + 16);
        const packedRows = readUint24LE(buffer, pageOffset + 24);
        const { numRows, numRowsValid } = decodePackedRowCounts(packedRows);
        const pageFlags = buffer[pageOffset + 27];
        const freeSize = readUint16LE(buffer, pageOffset + 28);
        const usedSize = readUint16LE(buffer, pageOffset + 30);

        pages.push({
          pageIndex,
          tableType: pageType,
          tableName: tableName(pageType),
          nextPage,
          sequence: pageSequence,
          pageFlags,
          numRows,
          numRowsValid,
          freeSize,
          usedSize,
        });

        if (currentPage === pointer.lastPage) {
          break;
        }
        currentPage = nextPage;
      }
    }

    tables.push({
      ...pointer,
      pageCount: pages.length,
      totalRows: pages.reduce((sum, page) => sum + page.numRows, 0),
      totalValidRows: pages.reduce((sum, page) => sum + page.numRowsValid, 0),
      pages,
    });
  }

  return {
    filePath: absolutePath,
    pageSize,
    numTables,
    nextUnusedPage,
    unknown,
    sequence,
    tables,
  };
}

export function diffRekordboxPdbSummaries(emptySummary: RekordboxPdbSummary, populatedSummary: RekordboxPdbSummary): RekordboxPdbDiff {
  const emptyByType = new Map(emptySummary.tables.map((table) => [table.type, table]));
  const populatedByType = new Map(populatedSummary.tables.map((table) => [table.type, table]));
  const allTypes = [...new Set([...emptyByType.keys(), ...populatedByType.keys()])].sort((a, b) => a - b);

  const changedTables = allTypes.flatMap((type) => {
    const emptyTable = emptyByType.get(type);
    const populatedTable = populatedByType.get(type);
    if (!emptyTable || !populatedTable) {
      return [];
    }
    const pageSignature = (table: RekordboxPdbSummary['tables'][number]) => JSON.stringify(
      table.pages.map((page) => ({
        pageIndex: page.pageIndex,
        nextPage: page.nextPage,
        sequence: page.sequence,
        pageFlags: page.pageFlags,
        numRows: page.numRows,
        numRowsValid: page.numRowsValid,
        freeSize: page.freeSize,
        usedSize: page.usedSize,
      })),
    );
    if (
      emptyTable.totalRows === populatedTable.totalRows &&
      emptyTable.totalValidRows === populatedTable.totalValidRows &&
      emptyTable.pageCount === populatedTable.pageCount &&
      pageSignature(emptyTable) === pageSignature(populatedTable)
    ) {
      return [];
    }

    return [{
      type,
      name: tableName(type),
      emptyTotalRows: emptyTable.totalRows,
      populatedTotalRows: populatedTable.totalRows,
      emptyPageCount: emptyTable.pageCount,
      populatedPageCount: populatedTable.pageCount,
    }];
  });

  return {
    emptyPath: emptySummary.filePath,
    populatedPath: populatedSummary.filePath,
    changedTables,
  };
}

async function atomicWrite(outputPath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, contents, 'utf8');
  await rename(tmpPath, outputPath);
}

export async function prepareRekordboxPdbWritePlan(
  exportRoot: string,
  referenceEmptyPath: string,
  referencePopulatedPath: string,
): Promise<RekordboxPdbWritePlan> {
  const absoluteExportRoot = path.resolve(exportRoot);
  const manifestPath = path.join(absoluteExportRoot, 'PIONEER', 'rekordbox', 'dj-vault', 'device-export-manifest.json');
  const outputPath = path.join(absoluteExportRoot, 'PIONEER', 'rekordbox', 'dj-vault', 'pdb-write-plan.json');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    playlistCount: number;
    trackCount: number;
    tracks: Array<{ rekordboxTrackId: string; title: string; stagedRelativePath: string }>;
    playlists: Array<{ name: string; entryCount: number }>;
  };

  const [emptySummary, populatedSummary] = await Promise.all([
    summarizeRekordboxPdb(referenceEmptyPath),
    summarizeRekordboxPdb(referencePopulatedPath),
  ]);

  const referenceDiff = diffRekordboxPdbSummaries(emptySummary, populatedSummary);
  const minimumTables = [
    'tracks',
    'artists',
    'albums',
    'labels',
    'keys',
    'playlist_tree',
    'playlist_entries',
    'columns',
  ];
  const deferredTables = [
    'genres',
    'colors',
    'artwork',
    'history_playlists',
    'history_entries',
    'history',
    'exportExt.pdb',
    'ANLZ analysis files',
  ];

  const plan: RekordboxPdbWritePlan = {
    exportRoot: absoluteExportRoot,
    manifestPath,
    outputPath,
    targetTrackCount: manifest.trackCount,
    targetPlaylistCount: manifest.playlistCount,
    referenceEmptyPath: path.resolve(referenceEmptyPath),
    referencePopulatedPath: path.resolve(referencePopulatedPath),
    referenceDiff,
    minimumTables,
    referenceCoveredTables: minimumTables.filter((table) => referenceDiff.changedTables.some((changed) => changed.name === table)),
    referenceGapTables: minimumTables.filter((table) => !referenceDiff.changedTables.some((changed) => changed.name === table)),
    deferredTables,
    trackRowsPlanned: manifest.tracks.map((track) => ({
      rekordboxTrackId: track.rekordboxTrackId,
      title: track.title,
      stagedRelativePath: track.stagedRelativePath,
    })),
    playlistRowsPlanned: manifest.playlists.map((playlist) => ({
      name: playlist.name,
      entryCount: playlist.entryCount,
    })),
  };

  await atomicWrite(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}
