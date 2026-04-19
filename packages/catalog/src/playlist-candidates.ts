import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { generateMergeReport, type TrustState } from './merge.js';
import { getTrackRecencySummaries, type TrackRecencySummary } from './recency.js';

type TrackRow = {
  id: string;
  title: string;
  album: string | null;
  label: string | null;
  genre: string | null;
  bpm: number | null;
  bpm_float: number | null;
  key_display: string | null;
  energy: number | null;
  rating: number | null;
  comment: string | null;
  description: string | null;
  play_count: number;
  last_played_at: string | null;
};

type PersonRow = {
  track_id: string;
  role: string;
  name: string;
};

type TagRow = {
  track_id: string;
  tag_kind: string;
  value: string;
};

export type PlaylistCandidateMode = 'balanced' | 'gig-safe' | 'discovery' | 'cleanup';

export type PlaylistCandidate = {
  trackId: string;
  title: string;
  artist: string | null;
  album: string | null;
  score: number;
  components: {
    prompt: number;
    trust: number;
    recency: number;
    musical: number;
  };
  trustState: TrustState;
  trustRationale: string;
  recencyBucket: TrackRecencySummary['recencyBucket'];
  bpm: number | null;
  keyDisplay: string | null;
  reasons: string[];
};

export type PlaylistCandidateReport = {
  generatedAt: string;
  prompt: string;
  mode: PlaylistCandidateMode;
  limit: number;
  candidateCount: number;
  candidates: PlaylistCandidate[];
};

export type WritePlaylistCandidateReportResult = {
  jsonPath: string;
  markdownPath: string;
  report: PlaylistCandidateReport;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3))];
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'playlist-candidates';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function joinArtists(people: PersonRow[], trackId: string): string | null {
  const artists = people
    .filter((person) => person.track_id === trackId && person.role === 'artist')
    .map((person) => person.name);
  return artists.length > 0 ? artists.join(' / ') : null;
}

function buildSearchText(track: TrackRow, artist: string | null, tags: TagRow[]): string {
  return [
    track.title,
    artist,
    track.album,
    track.label,
    track.genre,
    track.key_display,
    track.comment,
    track.description,
    ...tags.map((tag) => `${tag.tag_kind} ${tag.value}`),
  ].filter(Boolean).join(' ').toLowerCase();
}

function promptScore(promptTokens: string[], searchText: string): number {
  if (promptTokens.length === 0) {
    return 35;
  }
  const matches = promptTokens.filter((token) => searchText.includes(token)).length;
  return clampScore(22 + (matches / promptTokens.length) * 78);
}

function trustScore(state: TrustState, rawScore: number, mode: PlaylistCandidateMode): number {
  const base: Record<PlaylistCandidateMode, Record<TrustState, number>> = {
    balanced: { trusted: 94, chosen: 86, 'needs-attention': 56, blocked: 5 },
    'gig-safe': { trusted: 100, chosen: 90, 'needs-attention': 32, blocked: 0 },
    discovery: { trusted: 82, chosen: 80, 'needs-attention': 68, blocked: 20 },
    cleanup: { trusted: 18, chosen: 42, 'needs-attention': 96, blocked: 100 },
  };
  return clampScore((base[mode][state] * 0.7) + (rawScore * 0.3));
}

function recencyScore(bucket: TrackRecencySummary['recencyBucket'], rawScore: number, prompt: string, mode: PlaylistCandidateMode): number {
  const wantsForgotten = /\b(forgotten|dormant|neglected|deep|archive|not recent|no recent|no repeats?)\b/.test(prompt);
  const wantsFresh = /\b(fresh|new|recent|current|hot)\b/.test(prompt);

  if (mode === 'cleanup') {
    return bucket === 'dormant' || bucket === 'never-played' ? 92 : 48;
  }
  if (wantsForgotten) {
    return bucket === 'dormant' || bucket === 'never-played' ? 95 : bucket === 'cooling' ? 72 : 30;
  }
  if (wantsFresh) {
    return bucket === 'hot' || bucket === 'new' ? 92 : bucket === 'cooling' ? 72 : 44;
  }

  const base: Record<TrackRecencySummary['recencyBucket'], number> = {
    hot: 84,
    new: 76,
    cooling: 72,
    dormant: 56,
    'never-played': 48,
  };
  return clampScore((base[bucket] * 0.75) + (rawScore * 0.25));
}

function musicalScore(track: TrackRow, prompt: string, searchText: string): number {
  const bpm = track.bpm ?? track.bpm_float;
  let score = 55;

  if (/\b(warmup|opening|early|lounge|small room)\b/.test(prompt)) {
    score += bpm && bpm <= 124 ? 28 : -8;
  }
  if (/\b(peak|main room|banger|weapon|late)\b/.test(prompt)) {
    score += bpm && bpm >= 124 ? 26 : -6;
  }
  if (/\b(dark|warehouse|electro|techno|acid|driving)\b/.test(prompt)) {
    score += /\b(dark|warehouse|electro|techno|acid|drive|driving)\b/.test(searchText) ? 22 : 0;
  }
  if (track.rating && track.rating >= 4) {
    score += 12;
  }
  if (track.energy && track.energy >= 7 && /\b(peak|banger|weapon|driving)\b/.test(prompt)) {
    score += 10;
  }

  return clampScore(score);
}

function scoreReason(candidate: PlaylistCandidate): string[] {
  const reasons = [
    `${candidate.trustState} trust (${candidate.components.trust})`,
    `${candidate.recencyBucket} recency (${candidate.components.recency})`,
  ];
  if (candidate.components.prompt >= 70) {
    reasons.push('prompt language matched track metadata');
  }
  if (candidate.components.musical >= 75) {
    reasons.push('musical facts fit the requested use');
  }
  if (candidate.trustState === 'needs-attention' || candidate.trustState === 'blocked') {
    reasons.push('worth checking before a high-stakes USB export');
  }
  return reasons;
}

export function generatePlaylistCandidateReport(
  databasePath: string,
  prompt: string,
  options: { mode?: PlaylistCandidateMode; limit?: number } = {},
): PlaylistCandidateReport {
  const mode = options.mode ?? 'balanced';
  const limit = options.limit ?? 20;
  const normalizedPrompt = prompt.trim();
  const promptTokens = tokenize(normalizedPrompt);
  const database = new DatabaseSync(databasePath, { readOnly: true });

  try {
    const tracks = database.prepare(`
      SELECT id, title, album, label, genre, bpm, bpm_float, key_display, energy, rating,
             comment, description, play_count, last_played_at
      FROM tracks
      WHERE hidden = 0
      ORDER BY title COLLATE NOCASE, id
    `).all() as TrackRow[];
    const people = database.prepare(`
      SELECT track_id, role, name
      FROM track_people
      ORDER BY track_id, role, position
    `).all() as PersonRow[];
    const tags = database.prepare(`
      SELECT track_id, tag_kind, value
      FROM track_tags
      ORDER BY track_id, tag_kind, position
    `).all() as TagRow[];

    const recencySummaries = getTrackRecencySummaries(databasePath, 5000);
    const recencyByTrackId = new Map(recencySummaries.map((summary) => [summary.trackId, summary]));
    const mergeReport = generateMergeReport(databasePath);
    const mergeByTrackId = new Map(mergeReport.plans.map((plan) => [plan.trackId, plan]));
    const tagsByTrackId = new Map<string, TagRow[]>();
    for (const tag of tags) {
      const bucket = tagsByTrackId.get(tag.track_id) ?? [];
      bucket.push(tag);
      tagsByTrackId.set(tag.track_id, bucket);
    }

    const candidates = tracks.map((track) => {
      const artist = joinArtists(people, track.id);
      const trackTags = tagsByTrackId.get(track.id) ?? [];
      const searchText = buildSearchText(track, artist, trackTags);
      const mergePlan = mergeByTrackId.get(track.id);
      const recency = recencyByTrackId.get(track.id);
      const trustState = mergePlan?.trust.state ?? 'trusted';
      const rawTrustScore = mergePlan?.trust.score ?? 80;
      const recencyBucket = recency?.recencyBucket ?? 'never-played';
      const components = {
        prompt: promptScore(promptTokens, searchText),
        trust: trustScore(trustState, rawTrustScore, mode),
        recency: recencyScore(recencyBucket, recency?.recencyScore ?? 0, normalizedPrompt.toLowerCase(), mode),
        musical: musicalScore(track, normalizedPrompt.toLowerCase(), searchText),
      };
      const score = clampScore(
        components.prompt * 0.35
        + components.trust * 0.25
        + components.recency * 0.25
        + components.musical * 0.15,
      );
      const candidate: PlaylistCandidate = {
        trackId: track.id,
        title: track.title,
        artist,
        album: normalizeText(track.album),
        score,
        components,
        trustState,
        trustRationale: mergePlan?.trust.rationale ?? 'DJ Vault has not generated a trust rationale for this track yet.',
        recencyBucket,
        bpm: track.bpm ?? track.bpm_float,
        keyDisplay: normalizeText(track.key_display),
        reasons: [],
      };
      candidate.reasons = scoreReason(candidate);
      return candidate;
    }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);

    return {
      generatedAt: nowIso(),
      prompt: normalizedPrompt,
      mode,
      limit,
      candidateCount: candidates.length,
      candidates,
    };
  } finally {
    database.close();
  }
}

function renderMarkdown(report: PlaylistCandidateReport): string {
  const lines = [
    `# Playlist Candidates`,
    '',
    `- prompt: ${report.prompt}`,
    `- mode: ${report.mode}`,
    `- generated_at: ${report.generatedAt}`,
    `- candidate_count: ${report.candidateCount}`,
    '',
    '## Ranking',
    '',
    ...report.candidates.flatMap((candidate, index) => [
      `### ${index + 1}. ${candidate.title}`,
      '',
      `- artist: ${candidate.artist ?? 'unknown'}`,
      `- album: ${candidate.album ?? 'unknown'}`,
      `- score: ${candidate.score}`,
      `- components: prompt ${candidate.components.prompt}, trust ${candidate.components.trust}, recency ${candidate.components.recency}, musical ${candidate.components.musical}`,
      `- trust: ${candidate.trustState} (${candidate.trustRationale})`,
      `- recency: ${candidate.recencyBucket}`,
      `- bpm: ${candidate.bpm ?? 'unknown'}`,
      `- key: ${candidate.keyDisplay ?? 'unknown'}`,
      `- reasons: ${candidate.reasons.join('; ')}`,
      '',
    ]),
  ];
  return `${lines.join('\n')}\n`;
}

export async function writePlaylistCandidateReport(
  databasePath: string,
  prompt: string,
  outputRoot: string,
  options: { mode?: PlaylistCandidateMode; limit?: number } = {},
): Promise<WritePlaylistCandidateReportResult> {
  const report = generatePlaylistCandidateReport(databasePath, prompt, options);
  const absoluteOutputRoot = path.resolve(outputRoot);
  await mkdir(absoluteOutputRoot, { recursive: true });
  const slug = toSlug(`${report.mode}-${report.prompt}`);
  const jsonPath = path.join(absoluteOutputRoot, `${slug}.json`);
  const markdownPath = path.join(absoluteOutputRoot, `${slug}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(report), 'utf8');
  return { jsonPath, markdownPath, report };
}
