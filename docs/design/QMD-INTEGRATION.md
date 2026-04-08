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

DJ Vault currently exports per-track markdown documents into `data/qmd/tracks/`.

Each generated track document includes:

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

QMD collections are then set up for:

- `dj-vault-tracks`
- `dj-vault-docs`
- `dj-vault-research`
- `dj-vault-manifests`

## Operational Flow

1. `npm run catalog:qmd:setup`
   - exports track search documents
   - registers DJ Vault collections with QMD
2. `npm run catalog:qmd:update`
   - refreshes exported track documents
   - runs `qmd update`
3. `npm run catalog:qmd:embed`
   - builds vector embeddings for semantic search

## Near-Term Next Step

The current integration is document-shaped.

That is the right first move because it lets DJ Vault use QMD immediately without coupling the search layer directly to SQLite internals.

The next improvement should be to export playlist, set, and import/export job documents as well, so semantic search can connect:

- tracks
- playlists
- sets
- research notes
- operational history
