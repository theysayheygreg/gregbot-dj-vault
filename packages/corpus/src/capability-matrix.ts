import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { todayStamp } from './acquisition-utils.js';

type CrossVendorCatalog = {
  vendors: {
    alphatheta: {
      hardwareCategories: Array<{ name: string; productCount: number }>;
      downloads: { articleCount: number; downloadCount: number };
      localFirmwareArchives: Array<unknown>;
      unpackedFirmwarePayloads: Array<unknown>;
    };
    rekordbox: {
      releaseNotes: { entryCount: number; latestVersion: string | null; oldestVersion: string | null };
      currentDownload?: { currentVersion: string | null; packageUrl: string | null };
      localAcquisition?: { artifact: { localPath: string } | null };
    };
    traktor: {
      whatsNew: { latestVersion: string | null; versionCount: number; hardwareMentionCount: number };
    };
    serato: {
      softwareArchive: { entryCount: number; latestVersion: string | null; oldestVersion: string | null };
    };
    engineDj: {
      releaseNotes: { entryCount: number; latestVersion: string | null; oldestVersion: string | null };
      currentDownloads?: { desktopPackageCount: number; currentDesktopVersion: string | null; hardwarePackageCount: number; denonHardwareCount: number };
      localAcquisition?: { artifacts: Array<{ localPath: string }> };
    };
  };
};

type LocalArtifactInspectionSummary = {
  rekordbox: {
    peMetadata?: { format: string; importedDlls: string[] } | null;
  } | null;
  engineDj: Array<{
    path: string;
    peMetadata?: { format: string; importedDlls: string[] } | null;
    partitionMap?: { partitions: Array<{ name: string }> } | null;
    az0xWrapper?: { entries: Array<{ tag: string; offset: number; size: number }> } | null;
  }>;
};

type VendorCapabilityRow = {
  vendor: string;
  evidenceSummary: string;
  publicReleaseHistory: boolean;
  currentPackageSurface: boolean;
  localPackageAcquired: boolean;
  localFirmwareAcquired: boolean;
  unpackedOrParsedFirmware: boolean;
  parsedInstallerMetadata: boolean;
  parsedContainerMetadata: boolean;
  emulationReadiness: 'low' | 'medium' | 'high';
};

type CapabilityMatrix = {
  generatedAt: string;
  rows: VendorCapabilityRow[];
};

export async function generateCapabilityMatrix(manifestsDir: string): Promise<{ outputPath: string }> {
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const catalog = JSON.parse(
    await readFile(path.join(inventoryDir, `cross-vendor-catalog-status-${stamp}.json`), 'utf8'),
  ) as CrossVendorCatalog;
  const localInspection = JSON.parse(
    await readFile(path.join(inventoryDir, `local-artifact-inspection-summary-${stamp}.json`), 'utf8'),
  ) as LocalArtifactInspectionSummary;

  const rows: VendorCapabilityRow[] = [
    {
      vendor: 'Pioneer DJ / AlphaTheta',
      evidenceSummary: `${catalog.vendors.alphatheta.hardwareCategories.map((item) => `${item.productCount} ${item.name}`).join(', ')}; ${catalog.vendors.alphatheta.downloads.articleCount} articles; ${catalog.vendors.alphatheta.downloads.downloadCount} artifacts; ${catalog.vendors.alphatheta.unpackedFirmwarePayloads.length} unpacked payload sets`,
      publicReleaseHistory: true,
      currentPackageSurface: true,
      localPackageAcquired: false,
      localFirmwareAcquired: catalog.vendors.alphatheta.localFirmwareArchives.length > 0,
      unpackedOrParsedFirmware: catalog.vendors.alphatheta.unpackedFirmwarePayloads.length > 0,
      parsedInstallerMetadata: false,
      parsedContainerMetadata: true,
      emulationReadiness: 'high',
    },
    {
      vendor: 'rekordbox',
      evidenceSummary: `${catalog.vendors.rekordbox.releaseNotes.entryCount} release-note entries; current package ${catalog.vendors.rekordbox.currentDownload?.currentVersion ?? 'unknown'}; local package ${catalog.vendors.rekordbox.localAcquisition?.artifact ? 'present' : 'missing'}`,
      publicReleaseHistory: catalog.vendors.rekordbox.releaseNotes.entryCount > 0,
      currentPackageSurface: Boolean(catalog.vendors.rekordbox.currentDownload?.packageUrl),
      localPackageAcquired: Boolean(catalog.vendors.rekordbox.localAcquisition?.artifact),
      localFirmwareAcquired: false,
      unpackedOrParsedFirmware: false,
      parsedInstallerMetadata: Boolean(localInspection.rekordbox?.peMetadata),
      parsedContainerMetadata: false,
      emulationReadiness: 'medium',
    },
    {
      vendor: 'Native Instruments / Traktor',
      evidenceSummary: `${catalog.vendors.traktor.whatsNew.versionCount} visible versions; ${catalog.vendors.traktor.whatsNew.hardwareMentionCount} hardware intersections in current official article`,
      publicReleaseHistory: catalog.vendors.traktor.whatsNew.versionCount > 0,
      currentPackageSurface: false,
      localPackageAcquired: false,
      localFirmwareAcquired: false,
      unpackedOrParsedFirmware: false,
      parsedInstallerMetadata: false,
      parsedContainerMetadata: false,
      emulationReadiness: 'low',
    },
    {
      vendor: 'Serato',
      evidenceSummary: `${catalog.vendors.serato.softwareArchive.entryCount} archive entries from ${catalog.vendors.serato.softwareArchive.latestVersion} back to ${catalog.vendors.serato.softwareArchive.oldestVersion}`,
      publicReleaseHistory: catalog.vendors.serato.softwareArchive.entryCount > 0,
      currentPackageSurface: true,
      localPackageAcquired: false,
      localFirmwareAcquired: false,
      unpackedOrParsedFirmware: false,
      parsedInstallerMetadata: false,
      parsedContainerMetadata: false,
      emulationReadiness: 'low',
    },
    {
      vendor: 'Denon DJ / Engine DJ',
      evidenceSummary: `${catalog.vendors.engineDj.releaseNotes.entryCount} release-note entries; ${catalog.vendors.engineDj.currentDownloads?.desktopPackageCount ?? 0} desktop packages; ${catalog.vendors.engineDj.currentDownloads?.hardwarePackageCount ?? 0} hardware packages; ${catalog.vendors.engineDj.localAcquisition?.artifacts.length ?? 0} local artifacts`,
      publicReleaseHistory: catalog.vendors.engineDj.releaseNotes.entryCount > 0,
      currentPackageSurface: (catalog.vendors.engineDj.currentDownloads?.desktopPackageCount ?? 0) > 0,
      localPackageAcquired: (catalog.vendors.engineDj.localAcquisition?.artifacts.some((item) => item.localPath.endsWith('.exe')) ?? false),
      localFirmwareAcquired: (catalog.vendors.engineDj.localAcquisition?.artifacts.some((item) => item.localPath.endsWith('.img')) ?? false),
      unpackedOrParsedFirmware: localInspection.engineDj.some((item) => Boolean(item.partitionMap || item.az0xWrapper)),
      parsedInstallerMetadata: localInspection.engineDj.some((item) => Boolean(item.peMetadata)),
      parsedContainerMetadata: localInspection.engineDj.some((item) => Boolean(item.az0xWrapper)),
      emulationReadiness: 'medium',
    },
  ];

  const matrix: CapabilityMatrix = {
    generatedAt: new Date().toISOString(),
    rows,
  };

  const outputPath = path.join(inventoryDir, `vendor-capability-matrix-${stamp}.json`);
  await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  return { outputPath };
}
