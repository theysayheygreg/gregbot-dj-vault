import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

type AlphaThetaDownloadInventory = {
  products: Array<{
    articleTitle: string;
    articleUrl: string;
    productName: string;
    categoryName: string;
    sectionLabel: string;
    downloads: Array<{
      href: string;
      label: string;
      sizeLabel: string | null;
      versionLabel: string | null;
      releaseDateLabel: string | null;
      fileName: string | null;
      artifactKind: string;
    }>;
  }>;
};

export type AlphaThetaAcquisitionOptions = {
  manifestsDir: string;
  corpusDir: string;
  productKeywords: string[];
  artifactKinds: string[];
  limit: number;
  preferredArticleKeywords?: string[];
  maxPerProduct?: number;
  exactProductNames?: boolean;
};

type AlphaThetaAcquiredArtifact = {
  productName: string;
  articleTitle: string;
  sectionLabel: string;
  artifactKind: string;
  href: string;
  fileName: string;
  localPath: string;
  sizeBytes: number;
};

type AlphaThetaAcquisitionSummary = {
  collectedAt: string;
  selectedCount: number;
  acquiredCount: number;
  totalBytes: number;
  products: string[];
  artifactKinds: string[];
  artifacts: AlphaThetaAcquiredArtifact[];
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function summarySlug(parts: string[]): string {
  return parts.map((part) => slugify(part)).filter(Boolean).join('-');
}

async function fetchBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function acquireAlphaThetaArtifacts(options: AlphaThetaAcquisitionOptions): Promise<{
  summaryPath: string;
}> {
  const matchesProduct = (productName: string, keyword: string) =>
    options.exactProductNames
      ? productName.toLowerCase() === keyword.toLowerCase()
      : productName.toLowerCase().includes(keyword.toLowerCase());

  const inventoryPath = path.join(options.manifestsDir, 'inventories', `alphatheta-downloads-${todayStamp()}.json`);
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as AlphaThetaDownloadInventory;

  const selected = inventory.products
    .filter((entry) =>
      options.productKeywords.some((keyword) => matchesProduct(entry.productName, keyword)),
    )
    .flatMap((entry) =>
      entry.downloads
        .filter((download) => options.artifactKinds.includes(download.artifactKind))
        .map((download) => ({
          productName: entry.productName,
          articleTitle: entry.articleTitle,
          sectionLabel: entry.sectionLabel,
          download,
        })),
    );

  const deduped = new Map<string, typeof selected[number]>();
  for (const item of selected) {
    if (!deduped.has(item.download.href)) {
      deduped.set(item.download.href, item);
    }
  }

  const productOrder = new Map(
    options.productKeywords.map((keyword, index) => [keyword.toLowerCase(), index]),
  );
  const preferredKeywords = options.preferredArticleKeywords?.map((keyword) => keyword.toLowerCase()) ?? [];

  const ranked = [...deduped.values()].sort((left, right) => {
    const leftProductIndex =
      options.productKeywords.findIndex((keyword) => matchesProduct(left.productName, keyword));
    const rightProductIndex =
      options.productKeywords.findIndex((keyword) => matchesProduct(right.productName, keyword));
    if (leftProductIndex !== rightProductIndex) {
      return leftProductIndex - rightProductIndex;
    }

    const leftPreferred = preferredKeywords.some((keyword) => left.articleTitle.toLowerCase().includes(keyword)) ? 0 : 1;
    const rightPreferred = preferredKeywords.some((keyword) => right.articleTitle.toLowerCase().includes(keyword)) ? 0 : 1;
    if (leftPreferred !== rightPreferred) {
      return leftPreferred - rightPreferred;
    }

    return (left.download.fileName ?? '').localeCompare(right.download.fileName ?? '');
  });

  const limited: typeof ranked = [];
  const perProductCounts = new Map<string, number>();

  for (const item of ranked) {
    const count = perProductCounts.get(item.productName) ?? 0;
    if (options.maxPerProduct && count >= options.maxPerProduct) {
      continue;
    }
    limited.push(item);
    perProductCounts.set(item.productName, count + 1);
    if (limited.length >= options.limit) {
      break;
    }
  }
  const acquiredArtifacts: AlphaThetaAcquiredArtifact[] = [];

  await mkdir(options.corpusDir, { recursive: true });

  for (const item of limited) {
    const fileName = item.download.fileName ?? `${slugify(item.productName)}-${slugify(item.download.label)}`;
    const productDir = path.join(options.corpusDir, slugify(item.productName));
    const localPath = path.join(productDir, fileName);

    await mkdir(productDir, { recursive: true });
    const data = await fetchBuffer(item.download.href);
    await writeFile(localPath, data);
    const fileStat = await stat(localPath);

    acquiredArtifacts.push({
      productName: item.productName,
      articleTitle: item.articleTitle,
      sectionLabel: item.sectionLabel,
      artifactKind: item.download.artifactKind,
      href: item.download.href,
      fileName,
      localPath,
      sizeBytes: fileStat.size,
    });
  }

  const summary: AlphaThetaAcquisitionSummary = {
    collectedAt: new Date().toISOString(),
    selectedCount: selected.length,
    acquiredCount: acquiredArtifacts.length,
    totalBytes: acquiredArtifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0),
    products: options.productKeywords,
    artifactKinds: options.artifactKinds,
    artifacts: acquiredArtifacts,
  };

  const kindSlug = summarySlug(options.artifactKinds);
  const productSlug = summarySlug(options.productKeywords.slice(0, 5));
  const summaryPath = path.join(
    options.manifestsDir,
    'inventories',
    `alphatheta-acquisition-summary-${kindSlug}-${productSlug}-${todayStamp()}.json`,
  );
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summaryPath };
}
