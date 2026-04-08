import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AlphaThetaCategoryInventory = {
  category: {
    id: number;
    name: string;
  };
  products: Array<{
    id: number;
    name: string;
    status: string;
    url: string;
    sectionLinks: Array<{
      sectionId: number;
      label: string;
      url: string;
    }>;
  }>;
};

type AlphaThetaArticle = {
  articleId: number;
  title: string;
  releasedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: string | null;
  visibility: string | null;
  url: string;
};

type AlphaThetaSectionInventory = {
  sectionId: number;
  label: string;
  artifactType: string;
  url: string;
  articleCount: number;
  articles: AlphaThetaArticle[];
};

type AlphaThetaSupportArticleInventory = {
  vendor: 'pioneer-alphatheta';
  collectedAt: string;
  sectionLabels: string[];
  products: Array<{
    productId: number;
    productName: string;
    productStatus: string;
    categoryId: number;
    categoryName: string;
    url: string;
    sections: AlphaThetaSectionInventory[];
  }>;
};

type AlphaThetaSupportArticleSummary = {
  collectedAt: string;
  productCount: number;
  sectionCount: number;
  articleCount: number;
  labels: Array<{
    label: string;
    sectionCount: number;
    articleCount: number;
  }>;
};

const targetLabels = ['Firmware Update', 'Software Update', 'Drivers', 'PRO DJ LINK Bridge'];

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function toArtifactType(label: string): string {
  switch (label) {
    case 'Firmware Update':
      return 'firmware';
    case 'Software Update':
      return 'software-update';
    case 'Drivers':
      return 'drivers';
    case 'PRO DJ LINK Bridge':
      return 'prodj-link-bridge';
    default:
      return 'support-article';
  }
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

function parseInitialArticles(html: string): AlphaThetaArticle[] {
  const match = html.match(/\\"initialArticles\\":(\[[\s\S]*?\])/,);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1].replace(/\\"/g, '"')) as Array<Record<string, unknown>>;
    return parsed.map((article) => ({
      articleId: Number(article.article_id),
      title: String(article.title),
      releasedAt: typeof article.release_at === 'string' ? article.release_at : null,
      createdAt: typeof article.created_at === 'string' ? article.created_at : null,
      updatedAt: typeof article.updated_at === 'string' ? article.updated_at : null,
      status: typeof article.status === 'string' ? article.status : null,
      visibility: typeof article.visibility === 'string' ? article.visibility : null,
      url: `https://support.alphatheta.com/en-US/articles/${String(article.article_id)}`,
    }));
  } catch {
    return [];
  }
}

async function findLatestAlphaThetaInventories(inventoryDir: string): Promise<string[]> {
  const files = await readdir(inventoryDir);
  const matches = files.filter(
    (fileName) => fileName.startsWith('alphatheta-') && fileName.endsWith('-inventory.json') === false && /-inventory-\d{4}-\d{2}-\d{2}\.json$/.test(fileName),
  );

  const grouped = new Map<string, string>();

  for (const fileName of matches) {
    const prefix = fileName.replace(/-\d{4}-\d{2}-\d{2}\.json$/, '');
    const current = grouped.get(prefix);
    if (!current || fileName > current) {
      grouped.set(prefix, fileName);
    }
  }

  return [...grouped.values()].map((fileName) => path.join(inventoryDir, fileName));
}

export async function collectAlphaThetaArticles(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  await mkdir(inventoryDir, { recursive: true });

  const inventoryPaths = await findLatestAlphaThetaInventories(inventoryDir);
  const products: AlphaThetaSupportArticleInventory['products'] = [];

  for (const inventoryPath of inventoryPaths) {
    const rawInventory = await readFile(inventoryPath, 'utf8');
    const categoryInventory = JSON.parse(rawInventory) as AlphaThetaCategoryInventory;

    for (const product of categoryInventory.products) {
      const relevantSections = product.sectionLinks.filter((section) => targetLabels.includes(section.label));
      const uniqueSections = new Map<number, AlphaThetaSectionInventory>();

      for (const section of relevantSections) {
        if (uniqueSections.has(section.sectionId)) {
          continue;
        }

        const html = await fetchHtml(section.url);
        const articles = parseInitialArticles(html);

        uniqueSections.set(section.sectionId, {
          sectionId: section.sectionId,
          label: section.label,
          artifactType: toArtifactType(section.label),
          url: section.url,
          articleCount: articles.length,
          articles,
        });
      }

      if (uniqueSections.size === 0) {
        continue;
      }

      products.push({
        productId: product.id,
        productName: product.name,
        productStatus: product.status,
        categoryId: categoryInventory.category.id,
        categoryName: categoryInventory.category.name,
        url: product.url,
        sections: [...uniqueSections.values()],
      });
    }
  }

  const inventory: AlphaThetaSupportArticleInventory = {
    vendor: 'pioneer-alphatheta',
    collectedAt,
    sectionLabels: targetLabels,
    products,
  };

  const labelSummary = new Map<string, { sectionCount: number; articleCount: number }>();

  for (const label of targetLabels) {
    labelSummary.set(label, { sectionCount: 0, articleCount: 0 });
  }

  for (const product of products) {
    for (const section of product.sections) {
      const current = labelSummary.get(section.label);
      if (!current) {
        continue;
      }

      current.sectionCount += 1;
      current.articleCount += section.articleCount;
    }
  }

  const summary: AlphaThetaSupportArticleSummary = {
    collectedAt,
    productCount: products.length,
    sectionCount: products.reduce((sum, product) => sum + product.sections.length, 0),
    articleCount: products.reduce(
      (sum, product) => sum + product.sections.reduce((sectionSum, section) => sectionSum + section.articleCount, 0),
      0,
    ),
    labels: [...labelSummary.entries()].map(([label, values]) => ({
      label,
      sectionCount: values.sectionCount,
      articleCount: values.articleCount,
    })),
  };

  const inventoryPath = path.join(inventoryDir, `alphatheta-support-articles-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `alphatheta-support-articles-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
