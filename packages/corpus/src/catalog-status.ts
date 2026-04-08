import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AlphaThetaCategorySummary = {
  categories: Array<{
    name: string;
    productCount: number;
    activeCount: number;
    archivedCount: number;
  }>;
};

type AlphaThetaDownloadsSummary = {
  articleCount: number;
  resolvedArticleCount: number;
  downloadCount: number;
  byArtifactKind: Array<{
    artifactKind: string;
    count: number;
  }>;
};

type RekordboxSummary = {
  entryCount: number;
  latestVersion: string | null;
  oldestVersion: string | null;
};

type RekordboxCurrentDownload = {
  currentVersion: string | null;
  currentReleaseDate: string | null;
  packageUrl: string | null;
};

type RekordboxAcquisitionSummary = {
  version: string | null;
  releaseDate: string | null;
  packageUrl: string | null;
  artifact: {
    localPath: string;
    sizeBytes: number;
    sha256: string;
    fileType: string;
    zipEntries?: string[];
  } | null;
};

type SimpleVersionSummary = {
  entryCount: number;
  latestVersion: string | null;
  oldestVersion: string | null;
};

type TraktorSummary = {
  title: string;
  articleUpdatedAt: string;
  latestVersion: string | null;
  versionCount: number;
  hardwareMentionCount: number;
};

type EngineDjDownloadsSummary = {
  desktopPackageCount: number;
  currentDesktopVersion: string | null;
  hardwarePackageCount: number;
  denonHardwareCount: number;
};

type EngineDjAcquisitionSummary = {
  targets: string[];
  artifacts: Array<{
    label: string;
    localPath: string;
    sizeBytes: number;
    sha256: string;
    fileType: string;
  }>;
};

type AcquisitionSummary = {
  artifacts: Array<{
    productName: string;
    fileName: string;
    localPath: string;
    sizeBytes: number;
  }>;
};

type UnpackSummary = {
  inspections: Array<{
    productName: string;
    unpackDir: string;
    entries: Array<{
      relativePath: string;
      sizeBytes: number;
      fileType: string;
    }>;
  }>;
};

type CrossVendorCatalog = {
  generatedAt: string;
  northStar: string;
  vendors: {
    alphatheta: {
      hardwareCategories: AlphaThetaCategorySummary['categories'];
      downloads: AlphaThetaDownloadsSummary;
      localFirmwareArchives: AcquisitionSummary['artifacts'];
      unpackedFirmwarePayloads: UnpackSummary['inspections'];
    };
    rekordbox: {
      releaseNotes: RekordboxSummary;
      currentDownload: RekordboxCurrentDownload;
      localAcquisition: RekordboxAcquisitionSummary;
    };
    traktor: {
      whatsNew: TraktorSummary;
    };
    serato: {
      softwareArchive: SimpleVersionSummary;
    };
    engineDj: {
      releaseNotes: SimpleVersionSummary;
      currentDownloads: EngineDjDownloadsSummary;
      localAcquisition: EngineDjAcquisitionSummary;
    };
  };
  gaps: string[];
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function generateCrossVendorCatalogStatus(manifestsDir: string): Promise<{
  outputPath: string;
}> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  const [
    alphathetaCategories,
    alphathetaDownloads,
    rekordboxSummary,
    rekordboxCurrentDownload,
    rekordboxAcquisition,
    traktorSummary,
    seratoSummary,
    engineSummary,
    engineDownloadsSummary,
    engineAcquisitionSummary,
    acquisitionSummary,
    unpackSummary,
  ] = await Promise.all([
    readJson<AlphaThetaCategorySummary>(path.join(inventoryDir, `alphatheta-category-summary-${stamp}.json`)),
    readJson<AlphaThetaDownloadsSummary>(path.join(inventoryDir, `alphatheta-downloads-summary-${stamp}.json`)),
    readJson<RekordboxSummary>(path.join(inventoryDir, `rekordbox-release-notes-summary-${stamp}.json`)),
    readJson<RekordboxCurrentDownload>(path.join(inventoryDir, `rekordbox-current-download-${stamp}.json`)),
    readJson<RekordboxAcquisitionSummary>(path.join(inventoryDir, `rekordbox-acquisition-summary-${stamp}.json`)),
    readJson<TraktorSummary>(path.join(inventoryDir, `traktor-whats-new-summary-${stamp}.json`)),
    readJson<SimpleVersionSummary>(path.join(inventoryDir, `serato-dj-pro-archive-summary-${stamp}.json`)),
    readJson<SimpleVersionSummary>(path.join(inventoryDir, `engine-dj-release-notes-summary-${stamp}.json`)),
    readJson<EngineDjDownloadsSummary>(path.join(inventoryDir, `engine-dj-downloads-summary-${stamp}.json`)),
    readJson<EngineDjAcquisitionSummary>(path.join(inventoryDir, `engine-dj-acquisition-summary-${stamp}.json`)),
    readJson<AcquisitionSummary>(
      path.join(
        inventoryDir,
        `alphatheta-acquisition-summary-archive-cdj-3000-xdj-az-omnis-duo-opus-quad-djm-a9-${stamp}.json`,
      ),
    ),
    readJson<UnpackSummary>(path.join(inventoryDir, `alphatheta-unpack-summary-${stamp}.json`)),
  ]);

  const catalog: CrossVendorCatalog = {
    generatedAt: new Date().toISOString(),
    northStar:
      'Give DJs one canonical source of truth for library, metadata, playlists, and history, then show how that truth behaves across software and booth hardware.',
    vendors: {
      alphatheta: {
        hardwareCategories: alphathetaCategories.categories,
        downloads: alphathetaDownloads,
        localFirmwareArchives: acquisitionSummary.artifacts,
        unpackedFirmwarePayloads: unpackSummary.inspections,
      },
      rekordbox: {
        releaseNotes: rekordboxSummary,
        currentDownload: rekordboxCurrentDownload,
        localAcquisition: rekordboxAcquisition,
      },
      traktor: {
        whatsNew: traktorSummary,
      },
      serato: {
        softwareArchive: seratoSummary,
      },
      engineDj: {
        releaseNotes: engineSummary,
        currentDownloads: engineDownloadsSummary,
        localAcquisition: engineAcquisitionSummary,
      },
    },
    gaps: [
      'Native Instruments hardware/firmware package acquisition is not automated yet.',
      'Serato hardware compatibility and accessory package collection is not automated yet.',
      'Denon hardware firmware package acquisition is not automated yet.',
      'rekordbox desktop package acquisition is not automated yet.',
    ],
  };

  const outputPath = path.join(inventoryDir, `cross-vendor-catalog-status-${stamp}.json`);
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  return { outputPath };
}
