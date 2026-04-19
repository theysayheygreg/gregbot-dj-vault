import path from 'node:path';

import { initializeCatalog } from '../init-catalog.js';
import { writePlaylistCandidateReport, type PlaylistCandidateMode } from '../playlist-candidates.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const args = process.argv.slice(2);

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

const databasePath = args[0]
  ? path.resolve(args[0])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const prompt = args[1];
const outputRoot = readOption('--output-root')
  ? path.resolve(readOption('--output-root') ?? '')
  : path.resolve(invocationCwd, 'tmp/playlist-candidates');
const limit = readOption('--limit') ? Number.parseInt(readOption('--limit') ?? '', 10) : 20;
const mode = (readOption('--mode') ?? 'balanced') as PlaylistCandidateMode;

if (!prompt) {
  console.error('Usage: npm run playlist:candidates -- <database-path> "<prompt>" [--mode balanced|gig-safe|discovery|cleanup] [--limit 20] [--output-root <path>]');
  process.exit(1);
}

if (!['balanced', 'gig-safe', 'discovery', 'cleanup'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Expected balanced, gig-safe, discovery, or cleanup.`);
  process.exit(1);
}

await initializeCatalog(databasePath);
const result = await writePlaylistCandidateReport(databasePath, prompt, outputRoot, {
  mode,
  limit: Number.isFinite(limit) ? limit : 20,
});

console.log(JSON.stringify({
  jsonPath: result.jsonPath,
  markdownPath: result.markdownPath,
  candidateCount: result.report.candidateCount,
  topCandidate: result.report.candidates[0] ?? null,
}, null, 2));
