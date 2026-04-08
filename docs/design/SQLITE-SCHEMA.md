# DJ Vault — SQLite Schema Draft

The first executable catalog schema now exists in the repo and bootstraps cleanly with Node's built-in SQLite runtime.

Implementation lives in:

- `packages/catalog/src/schema.ts`
- `packages/catalog/src/init-catalog.ts`

## Purpose

This schema is the first concrete translation of the canonical TypeScript model in `DATA-MODEL.md` into a local database.

It is not the final shape. It is the first shape that is:

- buildable
- inspectable
- easy to migrate
- capable of supporting ingest/export work instead of only design discussion

## Current Table Groups

### Core media

- `tracks`
- `track_people`
- `track_tags`

### Performance analysis

- `cue_points`
- `loop_points`
- `beat_grids`
- `beat_grid_markers`

### Library organization

- `playlists`
- `playlist_tags`
- `playlist_items`
- `playlist_export_targets`
- `smart_rule_groups`
- `smart_rules`
- `dj_sets`
- `set_tracks`

### Provenance and operations

- `metadata_provenance`
- `import_jobs`
- `export_jobs`
- `app_metadata`
- `playback_sessions`
- `playback_events`

### Topology and remote execution

- `vault_nodes`
- `storage_locations`
- `track_residencies`
- `export_execution_plans`

## Key Decisions In This Draft

- Canonical track identity is still `UUID + hash_sha256`, not vendor IDs.
- People and tags are normalized into child tables instead of being stored only as JSON blobs.
- Smart playlists are represented structurally so they can be compiled into target-specific views later.
- Metadata provenance is a first-class table now, because the north star depends on tracking where important values came from.
- Import/export jobs are in the schema from the beginning so operational history does not become an afterthought.
- Storage topology is now modeled explicitly so the project can separate catalog location, media location, and export-execution location.
- Recency is now backed by real playback-session and playback-event tables instead of only `last_played_at` and `play_count`.

## Current Gaps

- No migration runner yet beyond idempotent bootstrap.
- No FTS/search index yet.
- No media fingerprint or waveform blob strategy yet.
- No fixture set yet to validate import/export round-trips.
- Current ingest writes file facts, hash identity, normalized title/artist fallbacks, import job history, and provenance.
- Managed-library copy/import now exists as an optional mode that copies files into a hash-sharded canonical library root and preserves source-path provenance.
- Embedded metadata extraction now covers basic title, duration, sample rate, bitrate, album, and artist fallback where available, but deeper analysis is still missing.
- Catalog data can now be exported into QMD-ready markdown documents for local BM25/vector/hybrid search without coupling the search layer directly to SQLite.
- Basic authoring commands now exist for creating playlists and DJ sets and appending tracks to each, so the schema is no longer only an ingest target.

## Immediate Next Step

Use this schema for the next ingest pass:

1. create the database
2. hash and inspect audio files
3. write initial `tracks` rows and provenance
4. deepen audio analysis and start export fixtures

That keeps the project moving from raw file registration toward a real canonical library.
