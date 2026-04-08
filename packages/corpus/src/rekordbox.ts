import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type RekordboxReleaseNoteEntry = {
  anchorId: string;
  version: string;
  title: string;
  releaseDate: string | null;
  page: number;
  url: string;
  bodyHtml: string;
  bodyText: string;
};

type RekordboxReleaseNoteInventory = {
  vendor: 'pioneer-alphatheta';
  product: 'rekordbox';
  collectedAt: string;
  pages: number[];
  entries: RekordboxReleaseNoteEntry[];
};

type RekordboxReleaseNoteSummary = {
  collectedAt: string;
  pageCount: number;
  entryCount: number;
  latestVersion: string | null;
  oldestVersion: string | null;
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

function parseReleaseDateFromHeading(heading: string): string | null {
  const match = heading.match(/\[(\d{4})\.(\d{1,2})\.(\d{1,2})\]/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseVersionFromHeading(heading: string): string {
  const match = heading.match(/ver\.\s*([^\s\[]+)/i);
  return match ? match[1] : heading;
}

function parseMaxPage(html: string): number {
  const pages = [...html.matchAll(/\/support\/releasenote\/page\/(\d+)\//g)].map((match) => Number(match[1]));
  return pages.length > 0 ? Math.max(...pages) : 1;
}

function parseEntries(html: string, page: number, pageUrl: string): RekordboxReleaseNoteEntry[] {
  const entries: RekordboxReleaseNoteEntry[] = [];
  const entryPattern =
    /<a class="rb-g-anchor" id="(release-\d+)"><\/a>\s*<h2 class="rb-g-list-item-h[\s\S]*?>([\s\S]*?)<\/h2>\s*<div class="rb-g-list-item-content[\s\S]*?"[^>]*>([\s\S]*?)<\/div>\s*<\/li>\s*(?=(?:<li class="rb-g-list-item mode-pc">|<\/ul>))/g;

  for (const match of html.matchAll(entryPattern)) {
    const anchorId = match[1];
    const heading = collapseWhitespace(stripHtml(match[2]));
    const bodyHtml = match[3].trim();
    entries.push({
      anchorId,
      version: parseVersionFromHeading(heading),
      title: heading,
      releaseDate: parseReleaseDateFromHeading(heading),
      page,
      url: `${pageUrl}#${anchorId}`,
      bodyHtml,
      bodyText: stripHtml(bodyHtml),
    });
  }

  return entries;
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

export async function collectRekordboxReleaseNotes(manifestsDir: string): Promise<{
  inventoryPath: string;
  summaryPath: string;
}> {
  const collectedAt = new Date().toISOString();
  const stamp = todayStamp();
  const inventoryDir = path.join(manifestsDir, 'inventories');
  const baseUrl = 'https://rekordbox.com/en/support/releasenote/';

  await mkdir(inventoryDir, { recursive: true });

  const firstPageHtml = await fetchHtml(baseUrl);
  const maxPage = parseMaxPage(firstPageHtml);
  const entries = parseEntries(firstPageHtml, 1, baseUrl);

  for (let page = 2; page <= maxPage; page += 1) {
    const pageUrl = `${baseUrl}page/${page}/`;
    const html = await fetchHtml(pageUrl);
    entries.push(...parseEntries(html, page, pageUrl));
  }

  const inventory: RekordboxReleaseNoteInventory = {
    vendor: 'pioneer-alphatheta',
    product: 'rekordbox',
    collectedAt,
    pages: Array.from({ length: maxPage }, (_, index) => index + 1),
    entries,
  };

  const summary: RekordboxReleaseNoteSummary = {
    collectedAt,
    pageCount: maxPage,
    entryCount: entries.length,
    latestVersion: entries[0]?.version ?? null,
    oldestVersion: entries.at(-1)?.version ?? null,
  };

  const inventoryPath = path.join(inventoryDir, `rekordbox-release-notes-${stamp}.json`);
  const summaryPath = path.join(inventoryDir, `rekordbox-release-notes-summary-${stamp}.json`);

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { inventoryPath, summaryPath };
}
