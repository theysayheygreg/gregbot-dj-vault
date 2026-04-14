# DJ Vault — Changelog

## 2026-04-14 — Sandbox v1 fixture pack

### Added

- `scripts/build-sandbox-v1-fixture.sh`
- `scripts/run-sandbox-v1-test.mjs`
- `packages/catalog/src/identity.ts`
- `packages/catalog/src/merge.ts`
- `docs/reference/SANDBOX-V1-FIXTURE.md`
- root script `fixture:build-sandbox-v1`
- root script `fixture:test-sandbox-v1`
- root script `catalog:identity-report`
- root script `catalog:merge-report`
- root script `catalog:merge-apply`

### Changed

- staged a controlled six-track source pool into `tmp/sandbox-v1/source-pool`
- built three divergent library views plus nine playlists under `tmp/sandbox-v1`
- verified the canonical view ingests cleanly into a scratch catalog
- added duplicate-file metadata provenance capture during ingest, so later same-song opinions survive even when a track is skipped as already seen
- added a metadata-insensitive MP3 content hash and used it for ingest dedupe and downstream track resolution
- added a provenance-driven merge layer that prefers canonical embedded metadata over dirty vendor views inside the sandbox
- `sandbox-v1` now converges from 20 track rows to 6 canonical tracks while preserving title and path disagreements in provenance

### Why

We need a believable, controlled library test before we point DJ Vault at Greg's fragile long-term libraries.

## 2026-04-14 — VaultBuddy live editing and laptop runtime

### Added

- `packages/catalog/src/editing.ts` for live track metadata edits and playlist item removal
- `apps/desktop/server.mjs` as a built local runtime for `VaultBuddy`
- [Laptop Runtime Setup](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/LAPTOP-RUNTIME-SETUP.md)

### Changed

- `VaultBuddy` now edits track metadata and playlist membership through the same local API surface in both Vite and built runtime modes
- dashboard snapshots now include track ratings, comments, and playlist entry detail for the inspector
- root npm scripts now include `desktop:serve` and `desktop:runtime`

### Why

The app needed to stop being a development-only viewer and become a practical local tool we can point at a real laptop library.

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
- canonical playback-history importer in `packages/catalog/src/history-import.ts`
- playback-history import CLI in `packages/catalog/src/cli/import-playback-history.ts`
- `docs/design/PLAYBACK-HISTORY-IMPORT.md`
- `docs/reference/playback-history.sample.json`
- `packages/catalog/src/vendor-history.ts`
- `packages/catalog/src/vendor-library.ts`
- vendor-specific history import CLIs for `rekordbox` XML and Traktor NML
- vendor-specific collection link import CLIs for `rekordbox` XML and Traktor NML
- vendor-specific library-state import CLIs for `rekordbox` XML and Traktor NML
- `docs/reference/rekordbox-history.sample.xml`
- `docs/reference/traktor-history.sample.nml`

### Changed

- schema now includes `playback_sessions` and `playback_events`
- data model now treats recency as a first-class usage concept instead of only a bare timestamp/count pair
- generated QMD track documents now include added/played recency timestamps
- README now documents the canonical playback-history import seam
- backlog fixture-parser items for Rekordbox and Traktor are now real capabilities
- history import now prefers vendor-native app IDs and location keys before falling back to title/file-name matching
- library-state import now carries selected vendor track metadata and non-history playlist trees into the catalog
- library-state import now also maps fixture-oriented vendor cue, loop, and tempo/grid data into DJ Vault analysis tables
- DJ Vault now has first export compilers for Rekordbox XML and Traktor NML, with export job records and deterministic playlist-scoped output

### Why

Recency has real DJ meaning. Tracks that are new, hot, cooling, dormant, or never played carry different mental weight during selection, and vendor history logs are useful source evidence for that model.

## 2026-04-12 — V1 scope narrowed to traditional rekordbox exports

### Added

- `docs/design/V1-TARGETS.md`
- `research/analysis/v1-target-acquisition-2026-04-12.md`
- `research/analysis/deep-symmetry-orientation-2026-04-12.md`
- `research/manifests/inventories/v1-target-artifacts-2026-04-12.json`

### Changed

- v1 is now explicitly centered on NXS2-era Pioneer hardware and the traditional rekordbox device library
- `rekordbox 6.8.6` is now the canonical 6.x desktop target, with `rekordbox 7.x` treated as a compatibility source only when it still produces the same traditional device export
- bleeding-edge hardware, Device Library Plus, Denon hardware, and current-gen AlphaTheta firmware lanes are explicitly frozen for post-v1 work
- roadmap and backlog now reflect a validation-first target instead of open-ended hardware emulation

### Why

The narrowed target is much closer to what real DJs actually use at home and in clubs, and it keeps the project aimed at a format we can validate on owned hardware without burning time on flagship-only complexity.

## 2026-04-12 — Traditional Rekordbox device-export staging path

### Added

- `packages/catalog/src/rekordbox-device-export.ts`
- `packages/catalog/src/cli/export-rekordbox-device.ts`

### Changed

- root and workspace package scripts now expose `catalog:export-rekordbox-device`
- export mapping docs now distinguish desktop XML export from traditional-device staging export
- README now documents the old-device staging command and its current native-artifact gap

### Why

The v1 target is no longer “generic export someday.” DJ Vault needs a concrete old-device export path that can stage media, playlists, and deterministic manifests for NXS2-era validation even before `export.pdb` and `ANLZ` writing are complete.

## 2026-04-12 — Rekordbox device-export workflow commands

### Added

- `packages/catalog/src/device-export-workflow.ts`
- `packages/catalog/src/cli/save-rekordbox-device-target.ts`
- `packages/catalog/src/cli/plan-rekordbox-device-export.ts`
- `packages/catalog/src/cli/export-rekordbox-device-target.ts`
- `packages/catalog/src/cli/validate-rekordbox-device-export.ts`
- `docs/design/DEVICE-EXPORT-WORKFLOW.md`

### Changed

- root and workspace package scripts now expose save, plan, export-to-target, and validate commands for Rekordbox device exports
- export docs now describe the saved-target and execution-plan workflow instead of only the raw staging compiler
- distributed topology docs now point at the first real transport-aware export planner

### Why

The product value is not “we can write files into a folder.” The value is “we can reason about where the music lives, where the USB is, which node should execute the job, and whether the staged export is structurally sane before a DJ leaves for the gig.”

## 2026-04-12 — Rekordbox PDB write-plan groundwork

### Added

- `packages/catalog/src/rekordbox-pdb.ts`
- `packages/catalog/src/cli/prepare-rekordbox-pdb-plan.ts`

### Changed

- root and workspace package scripts now expose `catalog:prepare-rekordbox-pdb-plan`
- device-export workflow docs now include the native PDB planning step
- export docs now describe `pdb-write-plan.json` as the bridge between staged exports and a future binary writer

### Why

`export.pdb` is the next real native artifact, but writing it blind would be wasteful. The repo now compares local empty and populated reference PDBs, summarizes their table/page structure, and emits a write plan against DJ Vault's staged export so the eventual writer can target the smallest honest table set first.

## 2026-04-12 — Rekordbox PDB row-plan compiler

### Added

- `packages/catalog/src/rekordbox-pdb-row-plan.ts`
- `packages/catalog/src/cli/prepare-rekordbox-pdb-row-plan.ts`

### Changed

- root and workspace package scripts now expose `catalog:prepare-rekordbox-pdb-row-plan`
- device-export workflow docs now include the native row-plan step between reference diffing and a future binary writer
- export docs now distinguish coarse PDB diff planning from deterministic row-plan compilation

### Why

The binary writer should not have to discover artist, label, key, and track row data on its own. DJ Vault now compiles deterministic native rows for the first reference-covered tables so the eventual `export.pdb` writer can focus on bytes and pages instead of catalog-to-row transformation logic.

## 2026-04-12 — First operator dashboard frontend

### Added

- `packages/catalog/src/dashboard.ts`
- `packages/catalog/src/cli/export-dashboard-json.ts`
- `apps/desktop/src/dashboard-types.ts`
- `apps/desktop/src/generated/catalog-dashboard.json`

### Changed

- `apps/desktop/src/App.tsx` now renders a live operator dashboard instead of a static shell
- `apps/desktop/src/styles.css` now supports the dashboard layout and empty states
- root package scripts now expose `catalog:export-dashboard-json`, `desktop:refresh-dashboard`, and a top-level `npm run dev` flow that refreshes the snapshot before opening the app
- README now documents the first user-facing test loop

### Why

The project had gone too long without a real surface to exercise. The desktop app now exposes live catalog truth, recency, playlist/set state, export readiness, and distributed-topology planning in one place so we can test the product with actual DJ Vault state instead of reading only manifests and CLI output.

## 2026-04-12 — Desktop-first operator workspace layout

### Changed

- `apps/desktop/src/App.tsx` now uses a sidebar, dense browser, and right-hand inspector layout instead of stacked dashboard panels
- `apps/desktop/src/styles.css` now styles the app like a desktop operator tool rather than a marketing-style landing surface
- README now states the v1 UI direction plainly: desktop-first and Mac-native in spirit

### Why

The project needed to stop looking like a status dashboard and start behaving like a tool. The v1 interface now prioritizes the mental model DJs actually need on a laptop: smart collections, a track browser, playlist and export workflows, and an inspector that keeps operational detail visible without hiding the library behind oversized cards.

## 2026-04-12 — Workflow-capable desktop browser

### Changed

- `apps/desktop/src/App.tsx` now supports sortable track columns, keyboard-driven browsing, and tabbed inspectors
- the desktop app can now rehearse playlist creation, device-target saving, and export-plan kickoff in local UI state
- `apps/desktop/src/styles.css` now includes action bars, inline forms, tab styling, and denser browser affordances
- README now clarifies that the desktop app is a real workflow scaffold, not just a static viewer

### Why

The app needed to do more than display state. This pass gives us a practical v1 testing loop inside the interface: move through a dense library, inspect details without losing context, and walk through the first user-facing steps of the export workflow even before every backend mutation is wired through.

## 2026-04-12 — Live desktop app bridge

### Changed

- `apps/desktop/src/App.tsx` now fetches a live dashboard snapshot in local development and routes key UI actions through a small local API
- `apps/desktop/vite.config.ts` now exposes dev-only API endpoints for dashboard refresh, playlist creation, target saving, export planning, and target export execution
- `packages/catalog/src/dashboard.ts` now uses unique temporary filenames for snapshot writes so concurrent refreshes do not corrupt the generated JSON
- `apps/desktop/src/vite-env.d.ts` was added for Vite environment typing in the desktop app

### Why

The app had reached the point where pretending to mutate state was holding us back. The desktop surface now talks to the real catalog during local development, which means we can test actual workflow mutations without waiting for a heavier native wrapper or a separate backend service.
