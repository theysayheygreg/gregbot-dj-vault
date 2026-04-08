# DJ Vault — Changelog

## 2026-04-07 — Workspace bootstrap reset

### Added

- npm workspace with `apps/desktop`, `packages/core`, and `packages/corpus`
- first runnable desktop UI shell
- research workspace with `analysis`, `corpus`, `manifests`, and `sources`
- artifact schema for corpus manifests
- expanded architecture, roadmap, backlog, and research program docs

### Changed

- `README.md` now reflects the broader product + corpus scope
- project roadmap now covers corpus intake, interop adapters, visibility layers, and emulation

### Why

The project needed to become a real software and research repository instead of a stack of design notes.

## 2026-04-08 — Publication and AlphaTheta enumeration

### Added

- `LICENSE`
- `CONTRIBUTING.md`
- `research/ARTIFACT-HANDLING.md`
- GitHub issue templates under `.github/ISSUE_TEMPLATE/`
- AlphaTheta family enumerator in `packages/corpus/src/alphatheta.ts`
- AlphaTheta family analysis note in `research/analysis/alphatheta-family-enumeration-2026-04-08.md`

### Generated

- dated AlphaTheta category inventories under `research/manifests/inventories/`

### Why

The project needed two things at once: to be shareable as an open repo, and to start generating real vendor inventories rather than only talking about them.

## 2026-04-08 — Release-note collection and catalog bootstrap

### Added

- `packages/catalog` with a first executable SQLite schema and bootstrap CLI
- first file-ingest CLI in `packages/catalog/src/ingest-files.ts`
- `packages/corpus/src/rekordbox.ts`
- `packages/corpus/src/alphatheta-articles.ts`
- `packages/corpus/src/alphatheta-downloads.ts`
- bounded AlphaTheta archive acquisition and inspection tooling
- `docs/design/SQLITE-SCHEMA.md`
- analysis notes for `rekordbox` release-note collection and AlphaTheta support-article collection
- analysis note for AlphaTheta download resolution
- analysis note for AlphaTheta archive acquisition

### Generated

- `research/manifests/inventories/rekordbox-release-notes-2026-04-08.json`
- `research/manifests/inventories/rekordbox-release-notes-summary-2026-04-08.json`
- `research/manifests/inventories/alphatheta-support-articles-2026-04-08.json`
- `research/manifests/inventories/alphatheta-support-articles-summary-2026-04-08.json`
- `research/manifests/inventories/alphatheta-downloads-2026-04-08.json`
- `research/manifests/inventories/alphatheta-downloads-summary-2026-04-08.json`
- `data/dj-vault.sqlite`

### Why

The project needed two missing foundations: real vendor-history collection and a real local catalog to write into. This change adds both.

## 2026-04-08 — Cross-vendor catalog pass

### Added

- `packages/corpus/src/serato.ts`
- `packages/corpus/src/engine-dj.ts`
- `packages/corpus/src/traktor.ts`
- `packages/corpus/src/catalog-status.ts`
- new corpus CLIs for `Serato`, `Engine DJ`, `Traktor`, and cross-vendor catalog generation

### Generated

- `research/manifests/inventories/serato-dj-pro-archive-2026-04-08.json`
- `research/manifests/inventories/serato-dj-pro-archive-summary-2026-04-08.json`
- `research/manifests/inventories/engine-dj-release-notes-2026-04-08.json`
- `research/manifests/inventories/engine-dj-release-notes-summary-2026-04-08.json`
- `research/manifests/inventories/rekordbox-current-download-2026-04-08.json`
- `research/manifests/inventories/engine-dj-downloads-2026-04-08.json`
- `research/manifests/inventories/engine-dj-downloads-summary-2026-04-08.json`
- `research/manifests/inventories/traktor-whats-new-2026-04-08.json`
- `research/manifests/inventories/traktor-whats-new-summary-2026-04-08.json`
- `research/manifests/inventories/cross-vendor-catalog-status-2026-04-08.json`

### Changed

- corrected the bounded AlphaTheta firmware archive set so `DJM-A9` is included and the accidental `CDJ-3000X` pull is gone
- `research/analysis/CATALOG-STATUS-2026-04-08.md` now matches the generated manifests and current local archive state

### Why

The repo needed a clear cross-vendor catalog of software, firmware, and booth-facing hardware signals, not just one deep AlphaTheta lane surrounded by notes about future work.

## 2026-04-08 — Engine AZ0x carving and payload naming fix

### Added

- parsed `AZ0x` name-hint resolution in `packages/corpus/src/local-artifact-inspection.ts`
- richer carve output metadata in `packages/corpus/src/engine-az0x.ts`

### Generated

- refreshed `research/manifests/inventories/local-artifact-inspection-summary-2026-04-08.json`
- refreshed `research/manifests/inventories/engine-az0x-carve-summary-2026-04-08.json`

### Changed

- `PRIME 4+` and `SC LIVE 4` carved `PART` payloads are now named from the container string table instead of guessed from partition order
- the carve summary now records raw file type plus XZ-decoded file type for carved payloads
- large carved Engine payloads are now identified as `kernel` and `rootfs`, and both decode to ext filesystem images

### Why

The earlier sequential mapping left the largest Engine payloads mislabeled as `uboot`, which would have contaminated later reverse-engineering work. This fixes the naming at the source and records a more truthful artifact catalog.

## 2026-04-08 — QMD search integration

### Added

- `@tobilu/qmd` as a repo dependency
- `packages/catalog/src/qmd.ts`
- catalog QMD CLIs for export, setup, update, embed, and status
- `docs/design/QMD-INTEGRATION.md`

### Changed

- `README.md` now documents QMD as a first-class DJ Vault search subsystem
- root package scripts now expose QMD setup and sync commands
- QMD catalog export now covers playlists, DJ sets, and import/export jobs in addition to tracks

### Why

DJ Vault needs more than exact-match lookup. QMD gives the project a local semantic search layer that can connect track metadata, research notes, and project documentation without adding a cloud dependency.

## 2026-04-08 — Playlist and set authoring commands

### Added

- `packages/catalog/src/authoring.ts`
- catalog CLIs for playlist creation, set creation, and appending tracks to playlists and sets

### Changed

- root scripts now expose playlist/set authoring commands against the main catalog DB
- README and schema docs now describe playlist/set authoring as a real capability

### Why

The catalog needed to stop being ingest-only. Playlists and sets are core product objects, and real authoring commands are the cleanest first seam before wiring the desktop app to them.

## 2026-04-08 — Distributed topology scaffolding

### Added

- topology types in `packages/core/src/domain.ts`
- topology schema tables in `packages/catalog/src/schema.ts`
- `packages/catalog/src/topology.ts`
- CLI commands for node registration, storage registration, track residency, and export execution planning
- `docs/design/DISTRIBUTED-TOPOLOGY.md`

### Changed

- architecture and schema docs now explicitly separate catalog truth, media residency, and export execution

### Why

DJ Vault needs to support the real-world case where the database, the full library, and the USB/export destination do not live on the same machine. This scaffolding is the foundation for remote export and transport-aware planning.

## 2026-04-08 — Recency and playback history model

### Added

- `packages/catalog/src/recency.ts`
- playback session, playback event, and recency-report CLIs
- `docs/design/RECENCY-MODEL.md`

### Changed

- schema now includes `playback_sessions` and `playback_events`
- data model now treats recency as a first-class usage concept instead of only a bare timestamp/count pair
- generated QMD track documents now include added/played recency timestamps

### Why

Recency has real DJ meaning. Tracks that are new, hot, cooling, dormant, or never played carry different mental weight during selection, and vendor history logs are useful source evidence for that model.
