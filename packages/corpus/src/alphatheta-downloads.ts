import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AlphaThetaSupportArticleInventory = {
  products: Array<{
    productId: number;
    productName: string;
    productStatus: string;
    categoryId: number;
    categoryName: string;
    url: string;
    sections: Array<{
      sectionId: number;
      label: string;
      artifactType: string;
      url: string;
      articleCount: number;
      articles: Array<{
        articleId: number;
        title: string;
        releasedAt: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        status: string | null;
        visibility: string | null;
        url: string;
      }>;
    }>;
  }>;
};

type AlphaThetaResolvedDownload = {
  href: string;
  label: string;
  sizeLabel: string | null;
  versionLabel: string | null;
  releaseDateLabel: string | null;
  fileName: string | null;
  artifactKind: 'archive' | 'disk-image' | 'firmware-binary' | 'driver' | 'pdf' | 'other';
};

type AlphaThetaResolvedArticle = {
  articleId: number;
  articleTitle: string;
  articleUrl: string;
  productId: number;
  productName: string;
  categoryName: string;
  sectionLabel: string;
  bodyText: string;
  downloads: AlphaThetaResolvedDownload[];
};

type AlphaThetaDownloadInventory = {
  vendor: 'pioneer-alphatheta';
  collectedAt: string;
  articleCount: number;
  resolvedArticleCount: number;
  products: AlphaThetaResolvedArticle[];
};

type AlphaThetaDownloadSummary = {
  collectedAt: string;
  articleCount: number;
  resolvedArticleCount: number;
  downloadCount: number;
  byArtifactKind: Array<{
    artifactKind: string;
    count: number;
  }>;
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return await response.text();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return collapseWhitespace(
    decodeHtmlEntities(value)
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  if (href.startsWith('/')) {
    return `https://support.alphatheta.com${href}`;
  }

  return href;
}

function detectArtifactKind(href: string): AlphaThetaResolvedDownload['artifactKind'] {
  const lower = href.toLowerCase();
  if (lower.endsWith('.zip')) {
    return 'archive';
  }
  if (lower.endsWith('.iso')) {
    return 'disk-image';
  }
  if (lower.endsWith('.upd')) {
    return 'firmware-binary';
  }
  if (lower.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lower.includes('driver')) {
    return 'driver';
  }
  return 'other';
}

function isLikelyArtifactLink(href: string): boolean {
  const lower = href.toLowerCase();
  return (
    lower.includes('downloads.support.alphatheta.com/') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.iso') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.exe') ||
    lower.endsWith('.pkg') ||
    lower.endsWith('.dmg') ||
    lower.endsWith('.msi') ||
    lower.endsWith('.upd')
  );
}

function parseDownloadsFromHtml(html: string): { bodyText: string; downloads: AlphaThetaResolvedDownload[] } {
  const bodyMatch = html.match(/<div class="markdown mx-auto">([\s\S]*?)<\/div><\/div><\/div>/);
  const bodyHtml = bodyMatch ? bodyMatch[1] : '';
  const downloads: AlphaThetaResolvedDownload[] = [];

  const seen = new Set<string>();
  const anchorPattern = /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,120})/g;

  for (const match of bodyHtml.matchAll(anchorPattern)) {
    const href = toAbsoluteUrl(match[1]);
    const label = collapseWhitespace(stripHtml(match[2]));
    const suffixText = collapseWhitespace(stripHtml(match[3]));
    const key = `${href}::${label}`;

    if (seen.has(key) || !isLikelyArtifactLink(href)) {
      continue;
    }
    seen.add(key);

    const metaMatch = suffixText.match(/\(?([0-9.]+\s*(?:KB|MB|GB))\)?\s*([0-9][0-9./A-Za-z-]+)?\s*([0-9]{1,2}\/[A-Za-z]{3}\/[0-9]{4})?/i);
    const fileName = href.split('/').at(-1) ?? null;

    downloads.push({
      href,
      label,
      sizeLabel: metaMatch?.[1] ?? null,
      versionLabel: metaMatch?.[2] ?? null,
      releaseDateLabel: metaMatch?.[3] ?? null,
      fileName,
      artifactKind: detectArtifactKind(href),
    });
  }

  return {
    bodyText: stripHtml(bodyHtml),
    downloads,
  };
}

async function findLatestSupportArticleInventory(inventoryDir: string): Promise<string> {
  const files = await readdir(inventoryDir);
  const matches = files
    .filter((fileName) => /^alphatheta-support-articles-\d{4}-\d{2}-\d{2}\.json$/.test(fileName))
    .sort();

  const latest = matches.at(-1);
  if (!latest) {
    throw new Error('No AlphaTheta support article inventory found.');
  }

  return path.join(inventoryDir, latest);
}

export async function collectAlphaThetaDownloads(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  await mkdir(inventoryDir, { recursive: true });

  const supportInventoryPath = await findLatestSupportArticleInventory(inventoryDir);
  const supportInventory = JSON.parse(
    await readFile(supportInventoryPath, 'utf8'),
  ) as AlphaThetaSupportArticleInventory;

  const resolvedArticles: AlphaThetaResolvedArticle[] = [];
  let articleCount = 0;

  for (const product of supportInventory.products) {
    for (const section of product.sections) {
      for (const article of section.articles) {
        articleCount += 1;
        const html = await fetchHtml(article.url);
        const parsed = parseDownloadsFromHtml(html);

        resolvedArticles.push({
          articleId: article.articleId,
          articleTitle: article.title,
          articleUrl: article.url,
          productId: product.productId,
          productName: product.productName,
          categoryName: product.categoryName,
          sectionLabel: section.label,
          bodyText: parsed.bodyText,
          downloads: parsed.downloads,
        });
      }
    }
  }

  const inventory: AlphaThetaDownloadInventory = {
    vendor: 'pioneer-alphatheta',
    collectedAt,
    articleCount,
    resolvedArticleCount: resolvedArticles.length,
    products: resolvedArticles,
  };

  const byArtifactKind = new Map<string, number>();
  let downloadCount = 0;

  for (const article of resolvedArticles) {
    for (const download of article.downloads) {
      downloadCount += 1;
      byArtifactKind.set(download.artifactKind, (byArtifactKind.get(download.artifactKind) ?? 0) + 1);
    }
  }

  const summary: AlphaThetaDownloadSummary = {
    collectedAt,
    articleCount,
    resolvedArticleCount: resolvedArticles.length,
    downloadCount,
    byArtifactKind: [...byArtifactKind.entries()]
      .map(([artifactKind, count]) => ({ artifactKind, count }))
      .sort((left, right) => right.count - left.count),
  };

  const inventoryPath = path.join(inventoryDir, `alphatheta-downloads-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `alphatheta-downloads-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
