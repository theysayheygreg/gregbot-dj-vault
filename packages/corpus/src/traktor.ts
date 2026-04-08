import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type TraktorWhatsNewVersion = {
  heading: string;
  version: string;
};

type TraktorHardwareMention = {
  hardware: string;
  matchedText: string;
};

type TraktorWhatsNewInventory = {
  vendor: 'native-instruments';
  product: 'traktor-pro';
  collectedAt: string;
  articleUrl: string;
  articleUpdatedAt: string;
  title: string;
  versions: TraktorWhatsNewVersion[];
  hardwareMentions: TraktorHardwareMention[];
};

type TraktorWhatsNewSummary = {
  collectedAt: string;
  title: string;
  articleUpdatedAt: string;
  latestVersion: string | null;
  versionCount: number;
  hardwareMentionCount: number;
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value: string): string {
  return collapseWhitespace(decodeHtmlEntities(value.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ' ')));
}

export async function collectTraktorWhatsNew(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const articleApiUrl = 'https://support.native-instruments.com/api/v2/help_center/en-us/articles/360017233958.json';

  await mkdir(inventoryDir, { recursive: true });

  const response = await fetch(articleApiUrl, {
    headers: {
      'user-agent': 'dj-vault-corpus-bot/0.1 (+local research workspace)',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${articleApiUrl}: ${response.status}`);
  }

  const payload = (await response.json()) as {
    article: {
      html_url: string;
      updated_at: string;
      title: string;
      body: string;
    };
  };

  const bodyText = stripHtml(payload.article.body);
  const versions = [...payload.article.body.matchAll(/What's new in Traktor Pro(?: \/ Play)? ([0-9]+\.[0-9]+(?:\.[0-9]+)?)/g)].map(
    (match) => ({
      heading: `What's new in Traktor Pro ${match[1]}`,
      version: match[1],
    }),
  );

  const hardwarePatterns = ['DJM-A9', 'DDJ-FLX4', 'DDJ-FLX2', 'S2 MK3', 'Z1 MK2', 'MX2'] as const;
  const hardwareMentions: TraktorHardwareMention[] = [];
  for (const hardware of hardwarePatterns) {
    const match = bodyText.match(new RegExp(`[^.]{0,80}${hardware}[^.]{0,120}`, 'i'));
    if (!match) {
      continue;
    }

    hardwareMentions.push({
      hardware,
      matchedText: collapseWhitespace(match[0]),
    });
  }

  const inventory: TraktorWhatsNewInventory = {
    vendor: 'native-instruments',
    product: 'traktor-pro',
    collectedAt,
    articleUrl: payload.article.html_url,
    articleUpdatedAt: payload.article.updated_at,
    title: payload.article.title,
    versions,
    hardwareMentions,
  };

  const summary: TraktorWhatsNewSummary = {
    collectedAt,
    title: payload.article.title,
    articleUpdatedAt: payload.article.updated_at,
    latestVersion: versions[0]?.version ?? null,
    versionCount: versions.length,
    hardwareMentionCount: hardwareMentions.length,
  };

  const inventoryPath = path.join(inventoryDir, `traktor-whats-new-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `traktor-whats-new-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
