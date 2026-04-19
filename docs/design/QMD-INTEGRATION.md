# DJ Vault — QMD Integration

DJ Vault now treats `qmd` as a first-class local search dependency.

Reference package:

- `@tobilu/qmd`
- upstream: <https://github.com/tobi/qmd>

## Why QMD

The project needs more than exact-match search.

DJs tend to accumulate:

- deep per-track metadata
- overlapping genre/tag vocabularies
- comments and performance notes
- multiple software-specific identifiers
- historical notes about how tracks behaved in sets, playlists, and exports

QMD gives DJ Vault a practical local search layer with:

- BM25 keyword search
- vector semantic search
- hybrid search and reranking

That makes it a strong fit for:

- finding tracks by concept rather than exact wording
- surfacing cross-references between library metadata and research notes
- searching across generated track documents, design docs, and reverse-engineering notes with one local tool

## Current Integration Shape

Implementation lives in:

- `packages/catalog/src/qmd.ts`
- `packages/catalog/src/cli/qmd-export.ts`
- `packages/catalog/src/cli/qmd-setup.ts`
- `packages/catalog/src/cli/qmd-update.ts`
- `packages/catalog/src/cli/qmd-embed.ts`
- `packages/catalog/src/cli/qmd-status.ts`

Current commands:

- `npm run catalog:qmd:export`
- `npm run catalog:qmd:setup`
- `npm run catalog:qmd:update`
- `npm run catalog:qmd:embed`
- `npm run catalog:qmd:status`

## What Gets Indexed

DJ Vault currently exports markdown search documents into `data/qmd/` for:

- tracks
- playlists
- DJ sets
- import/export jobs

Track documents include:

- canonical path
- title
- artists
- album
- genre
- BPM and key fields
- energy, rating, play state
- comments and description
- vendor references for Rekordbox and Traktor
- normalized people and tags
- Library Trust state, score, source-opinion count, and rationale
- recency bucket, mental weight, and recency score
- vector-friendly search-signal prose for playlist retrieval

QMD collections are then set up for:

- `dj-vault-catalog`
- `dj-vault-docs`
- `dj-vault-research`
- `dj-vault-manifests`

## Operational Flow

1. `npm run catalog:qmd:setup`
   - exports catalog search documents
   - registers DJ Vault collections with QMD
2. `npm run catalog:qmd:update`
   - refreshes exported catalog documents
   - runs `qmd update`
3. `npm run catalog:qmd:embed`
   - builds vector embeddings for semantic search

## Near-Term Next Step

The current integration is still document-shaped, and that remains the right first move because it lets DJ Vault use QMD immediately without coupling the search layer directly to SQLite internals.

The next improvement should be to add provenance-aware export documents and smarter collection-scoped search entrypoints from the desktop app.

## Trust-Aware Playlist Candidates

Trust is now treated as a retrieval feature, not just a UI badge.

The first deterministic candidate harness is:

```bash
npm run catalog:playlist-candidates -- "90-minute dark warmup crate, no recent repeats" --mode gig-safe --limit 20
```

It ranks tracks by:

- prompt/metadata language fit
- Library Trust state and score
- recency bucket and score
- simple musical facts such as BPM, rating, and energy

This is intentionally not the final vector-search brain. It is the scoring seam. QMD track documents now carry the trust and recency language needed for future vector retrieval, while the CLI proves how trust should affect playlist construction in `balanced`, `gig-safe`, `discovery`, and `cleanup` modes.
