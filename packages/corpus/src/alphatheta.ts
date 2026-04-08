import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AlphaThetaCategory = {
  id: number;
  name: string;
  url: string;
};

type AlphaThetaProduct = {
  id: number;
  name: string;
  status: string;
  categoryId: number;
  createdAt: string | null;
  updatedAt: string | null;
  url: string;
  sectionLinks: Array<{
    sectionId: number;
    label: string;
    url: string;
  }>;
  highlights: Array<{
    articleId: number;
    title: string;
    releasedAt: string | null;
  }>;
};

type AlphaThetaCategoryInventory = {
  vendor: 'pioneer-alphatheta';
  collectedAt: string;
  category: AlphaThetaCategory;
  products: AlphaThetaProduct[];
};

type AlphaThetaSummary = {
  collectedAt: string;
  categories: Array<{
    id: number;
    name: string;
    productCount: number;
    activeCount: number;
    archivedCount: number;
  }>;
};

const categoryDefinitions: AlphaThetaCategory[] = [
  {
    id: 4416169767193,
    name: 'DJ Players',
    url: 'https://support.alphatheta.com/en-US/categories/4416169767193',
  },
  {
    id: 4416175418393,
    name: 'DJ Mixers',
    url: 'https://support.alphatheta.com/en-US/categories/4416175418393',
  },
  {
    id: 4416162414361,
    name: 'All-In-One DJ Systems',
    url: 'https://support.alphatheta.com/en-US/categories/4416162414361',
  },
  {
    id: 4416175427481,
    name: 'rekordbox',
    url: 'https://support.alphatheta.com/en-US/categories/4416175427481',
  },
];

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseProductsFromCategoryHtml(html: string): Array<{
  id: number;
  name: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}> {
  const match = html.match(/\\"products\\":(\[[\s\S]*?\])}\]\]/);

  if (!match) {
    return [];
  }

  const json = match[1].replace(/\\"/g, '"');

  try {
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    return parsed.map((product) => ({
      id: Number(product.id),
      name: String(product.name),
      status: String(product.status ?? 'Unknown'),
      createdAt: typeof product.created_at === 'string' ? product.created_at : null,
      updatedAt: typeof product.updated_at === 'string' ? product.updated_at : null,
    }));
  } catch {
    return [];
  }
}

function parseSectionLinks(html: string, productId: number) {
  const matches = [...html.matchAll(new RegExp(`/en-US/products/${productId}\\?section=(\\d+)[\\s\\S]*?<p class=\\"text-sm\\">([^<]+)</p>`, 'g'))];

  const unique = new Map<string, { sectionId: number; label: string; url: string }>();

  for (const match of matches) {
    const sectionId = Number(match[1]);
    const label = match[2];
    if (!unique.has(label)) {
      unique.set(label, {
        sectionId,
        label,
        url: `https://support.alphatheta.com/en-US/products/${productId}?section=${match[1]}`,
      });
    }
  }

  return [...unique.values()];
}

function parseHighlights(html: string) {
  const matches = [
    ...html.matchAll(
      /\\"article_id\\":(\d+)[\s\S]*?\\"title\\":\\"([^\\"]+)\\"[\s\S]*?\\"release_at\\":\\"([^\\"]+)\\"/g,
    ),
  ];

  return matches.map((match) => ({
    articleId: Number(match[1]),
    title: match[2],
    releasedAt: match[3] || null,
  }));
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

export async function enumerateAlphaTheta(manifestsDir: string): Promise<{
  summaryPath: string;
  categoryPaths: string[];
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');

  await mkdir(inventoryDir, { recursive: true });

  const categoryInventories: AlphaThetaCategoryInventory[] = [];

  for (const category of categoryDefinitions) {
    const categoryHtml = await fetchHtml(category.url);
    const products = parseProductsFromCategoryHtml(categoryHtml);

    const detailedProducts: AlphaThetaProduct[] = [];

    for (const product of products) {
      const productUrl = `https://support.alphatheta.com/en-US/products/${product.id}`;
      const productHtml = await fetchHtml(productUrl);

      detailedProducts.push({
        id: product.id,
        name: product.name,
        status: product.status,
        categoryId: category.id,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        url: productUrl,
        sectionLinks: parseSectionLinks(productHtml, product.id),
        highlights: parseHighlights(productHtml),
      });
    }

    categoryInventories.push({
      vendor: 'pioneer-alphatheta',
      collectedAt,
      category,
      products: detailedProducts,
    });
  }

  const categoryPaths: string[] = [];

  for (const inventory of categoryInventories) {
    const slug = inventory.category.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filePath = path.join(
      inventoryDir,
      `alphatheta-${slug}-inventory-${stamp}.json`,
    );
    await writeFile(filePath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    categoryPaths.push(filePath);
  }

  const summary: AlphaThetaSummary = {
    collectedAt,
    categories: categoryInventories.map((inventory) => {
      const activeCount = inventory.products.filter((product) => product.status === 'Active').length;
      const archivedCount = inventory.products.filter((product) => product.status === 'Archived').length;
      return {
        id: inventory.category.id,
        name: inventory.category.name,
        productCount: inventory.products.length,
        activeCount,
        archivedCount,
      };
    }),
  };

  const summaryPath = path.join(
    inventoryDir,
    `alphatheta-category-summary-${stamp}.json`,
  );
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summaryPath, categoryPaths };
}
