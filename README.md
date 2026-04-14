# DJ Vault

DJ Vault is a local-first DJ music operating system.

It now includes a first-class `qmd` search lane for local keyword, vector, and hybrid search across generated catalog documents, project docs, manifests, and research notes.

The project now has two jobs:

1. Build a clean-slate library, metadata, import, export, and visibility toolchain for DJs.
2. Build a research corpus that explains how major DJ software, firmware, hardware, and USB/export flows actually work.

The north star is straightforward: give DJs one source of truth for music, metadata, playlists, history, and prep, then help them understand how that truth will behave on real club gear before a gig.

## What We Are Building

- A canonical music library that does not depend on Apple Music, iTunes, TIDAL, Rekordbox Cloud, or other paid/cloud lock-in.
- A metadata engine that merges the best available truth from tags, store data, analysis tools, legacy DJ software, and user curation.
- An integration/export engine that can compile DJ Vault state into app- and hardware-specific views.
- A local semantic search layer powered by `qmd` for cross-references across track metadata, project docs, and research notes.
- Visibility layers for closed ecosystems where direct modification is not practical.
- A practical validation layer for club workflows, focused first on NXS2-era Pioneer gear and the traditional rekordbox device library.
- A reverse-engineering corpus for firmware, desktop apps, export formats, and device behavior.

## Repo Layout

```text
dj-vault/
├── apps/
│   └── desktop/              # initial runnable UI shell
├── packages/
│   ├── core/                 # domain model and shared types
│   └── corpus/               # artifact manifest and corpus helpers
├── research/
│   ├── analysis/             # markdown knowledge base
│   ├── corpus/               # extracted artifacts and notes
│   ├── manifests/            # machine-readable artifact indexes
│   └── sources/              # vendor/source maps and collection notes
├── docs/
│   ├── design/               # architecture and model docs
│   ├── journal/              # changelog, devlog, decision log
│   └── project/              # roadmap, backlog, research program
└── PLAN.md                   # original problem statement
```

## Current State

The original spec work is intact and remains useful. This repository is now being converted from a design-only project into:

- a software workspace
- a research workspace
- a publication-ready project that can move to GitHub cleanly

## Immediate Priorities

- Lock the expanded project charter and research program
- Stand up the first runnable app shell
- Stand up the artifact/corpus pipeline
- Index official public firmware/software download surfaces
- Start producing durable knowledge docs from collected artifacts

The first execution slice is documented in [First 10 Days](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/FIRST-10-DAYS.md).

Open-project hygiene now lives in:

- [Contributing](/Users/theysayheygreg/clawd/projects/dj-vault/CONTRIBUTING.md)
- [Artifact Handling](/Users/theysayheygreg/clawd/projects/dj-vault/research/ARTIFACT-HANDLING.md)

## Research Scope

The current v1 focus is deliberately narrower:

- NXS2-era Pioneer hardware Greg actually owns or can plausibly validate against
- `rekordbox 6.8.6` as the canonical desktop baseline
- `rekordbox 7.x` only when it is still producing the same traditional device library
- traditional rekordbox USB/device export structures, not Device Library Plus
- Deep Symmetry and related public format work as reference corpus, not duplicated effort

The broader AlphaTheta current-gen, Denon, Serato hardware, and flagship-device lanes stay on disk as reference-only corpus until v1 ships.

The research work should stay inside public artifacts, public documentation, release notes, static inspection, and lawful reverse engineering. No credential abuse, no DRM circumvention, and no destructive probing.

## Getting Started

From the repo root:

```bash
npm install
npm run build
```

To run the first app shell:

```bash
npm run dev --workspace @dj-vault/desktop
```

To refresh the desktop app from the live catalog and then open the current operator surface:

```bash
npm run dev
```

The desktop app is now wired to a generated snapshot at [apps/desktop/src/generated/catalog-dashboard.json](/Users/theysayheygreg/clawd/projects/dj-vault/apps/desktop/src/generated/catalog-dashboard.json). That surface is meant to be the first real testing loop: library pulse, recency, playlist/set state, remote export planning, and native Rekordbox device-export gaps in one screen.

The UI direction is now explicitly desktop-first and Mac-native in spirit: sidebar, dense browser, right-hand inspector, and operational views that feel closer to Finder, Music, and pro media tools than a generic web dashboard.

It also now has the first user-facing workflow scaffolding inside the app itself: sortable track browsing, keyboard navigation, tabbed inspectors, live track metadata editing, playlist membership editing, playlist creation, device-target saving, export planning, and target export execution. Those actions now work against a local API whether you run the app in Vite or from the built runtime server.

To build and run the local VaultBuddy runtime:

```bash
npm run desktop:runtime
```

That serves the built app at `http://localhost:4187` and uses the repo-local catalog database by default.

To point VaultBuddy at a different database, such as a laptop-local catalog that is sitting beside your real music library:

```bash
DJ_VAULT_DB_PATH=/absolute/path/to/dj-vault.sqlite npm run desktop:runtime
```

If you want to reuse an already-built app and only change the database path or port, run:

```bash
DJ_VAULT_DB_PATH=/absolute/path/to/dj-vault.sqlite PORT=4190 npm run desktop:serve
```

The laptop handoff and recommended first real-library topology are written down in [Laptop Runtime Setup](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/LAPTOP-RUNTIME-SETUP.md).

To collect the current official source-surface inventory:

```bash
npm run corpus:collect-sources
```

To collect public `rekordbox` release notes and AlphaTheta support articles:

```bash
npm run corpus:collect-rekordbox
npm run corpus:collect-rekordbox-download
npm run corpus:collect-alphatheta-articles
npm run corpus:collect-alphatheta-downloads
npm run corpus:collect-serato
npm run corpus:collect-engine-dj
npm run corpus:collect-engine-dj-downloads
npm run corpus:collect-traktor
npm run corpus:generate-cross-vendor-catalog
```

To bootstrap the first local catalog database:

```bash
npm run catalog:init
```

To ingest local audio files into the catalog:

```bash
npm run catalog:ingest -- /absolute/path/to/music
```

To ingest into DJ Vault's managed library root instead of keeping source paths as canonical:

```bash
npm run catalog:ingest -- --library-root /absolute/path/to/dj-vault-library /absolute/path/to/music
```

To start authoring playlists and sets in the catalog:

```bash
npm run catalog:create-playlist -- "Warmup Crate"
npm run catalog:create-set -- "Friday Peak" "Warehouse" 90 "dark and driving"
npm run catalog:add-track-to-playlist -- <playlist-id> <track-id-or-title>
npm run catalog:add-track-to-set -- <set-id> <track-id-or-title> builder blend
```

To register where the catalog lives, where media lives, and where exports can run:

```bash
npm run catalog:register-node -- "Mac mini" catalog-primary local
npm run catalog:register-node -- "MacBook Pro" media-host tailscale 100.x.y.z
npm run catalog:register-storage -- <node-id> "Main Library" local-disk /Volumes/Music /Volumes/Music managed
npm run catalog:plan-export-execution -- usb-device <node-id> <source-storage-id> <destination-storage-id> tailscale remote
```

To start tracking recency and playback history:

```bash
npm run catalog:create-playback-session -- dj-vault "Warehouse" "Friday peak"
npm run catalog:log-playback-event -- "Track Title" dj-vault <session-id>
npm run catalog:recency-report
```

That recency layer is meant to absorb both native DJ Vault playback history and imported vendor history later, including Rekordbox/Traktor-style "added", "last played", and session/history artifacts.

To import canonical playback-history JSON into that recency model:

```bash
npm run catalog:import-playback-history -- /absolute/path/to/playback-history.json
```

A tracked example import payload lives at [docs/reference/playback-history.sample.json](/Users/theysayheygreg/clawd/projects/dj-vault/docs/reference/playback-history.sample.json), and the import contract is documented in [Playback History Import](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/PLAYBACK-HISTORY-IMPORT.md).

To compile and import fixture-oriented vendor history directly:

```bash
npm run catalog:import-rekordbox-history -- /absolute/path/to/rekordbox-history.xml
npm run catalog:import-traktor-history -- /absolute/path/to/traktor-history.nml
```

To import native vendor collection IDs into existing DJ Vault tracks before history import:

```bash
npm run catalog:import-rekordbox-collection -- /absolute/path/to/rekordbox-export.xml
npm run catalog:import-traktor-collection -- /absolute/path/to/traktor-collection.nml
```

To import broader vendor library state, including track metadata and playlist membership:

```bash
npm run catalog:import-rekordbox-library -- /absolute/path/to/rekordbox-export.xml
npm run catalog:import-traktor-library -- /absolute/path/to/traktor-collection.nml
```

Those library-state imports now also carry fixture-oriented cue, loop, and beat-grid state into DJ Vault analysis tables.

To export DJ Vault playlists and analysis state back out as vendor library files:

```bash
npm run catalog:save-rekordbox-device-target -- <playlist-ref> <folder-path> [name]
npm run catalog:plan-rekordbox-device-export -- <playlist-ref> <execution-node-ref> [destination-storage-ref]
npm run catalog:export-rekordbox-device -- /absolute/path/to/staging-root [playlist-id ...]
npm run catalog:export-rekordbox-device-target -- <playlist-ref>
npm run catalog:prepare-rekordbox-pdb-plan -- /absolute/path/to/staging-root
npm run catalog:prepare-rekordbox-pdb-row-plan -- /absolute/path/to/database.sqlite /absolute/path/to/staging-root
npm run catalog:validate-rekordbox-device-export -- /absolute/path/to/staging-root
npm run catalog:export-rekordbox-xml -- /absolute/path/to/output.xml [playlist-id ...]
npm run catalog:export-traktor-nml -- /absolute/path/to/output.nml [playlist-id ...]
```

If no playlist IDs are supplied, DJ Vault exports the full current playlist tree.

The new `catalog:export-rekordbox-device` command is the v1 old-device staging path. It builds a deterministic `PIONEER/rekordbox/` bundle, copies referenced media into a `Contents/` tree, emits a Rekordbox XML mirror for inspection, and records a machine-readable manifest of what still remains before full `export.pdb` / `ANLZ` parity.

The saved-target workflow is now first-class too: save a playlist target once, ask DJ Vault to plan the execution against real source/destination storage, export directly into that target root, prepare a native `export.pdb` write plan from local reference exports, compile deterministic native rows for the first covered PDB tables, and validate the staged result before trying it on hardware.

To regenerate the frontend dashboard snapshot without opening the app:

```bash
npm run catalog:export-dashboard-json
```

Tracked sample fixtures live at:

- [docs/reference/rekordbox-history.sample.xml](/Users/theysayheygreg/clawd/projects/dj-vault/docs/reference/rekordbox-history.sample.xml)
- [docs/reference/traktor-history.sample.nml](/Users/theysayheygreg/clawd/projects/dj-vault/docs/reference/traktor-history.sample.nml)

To set up local QMD search collections for DJ Vault:

```bash
npm run catalog:qmd:setup
npm run catalog:qmd:update
```

To build vector embeddings for semantic search:

```bash
npm run catalog:qmd:embed
```

## Important Docs

- [V1 Targets](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/V1-TARGETS.md)
- [Architecture](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/ARCHITECTURE.md)
- [Data Model](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/DATA-MODEL.md)
- [Device Export Workflow](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/DEVICE-EXPORT-WORKFLOW.md)
- [Distributed Topology](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/DISTRIBUTED-TOPOLOGY.md)
- [Export Mapping](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/EXPORT-MAPPING.md)
- [QMD Integration](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/QMD-INTEGRATION.md)
- [Playback History Import](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/PLAYBACK-HISTORY-IMPORT.md)
- [Recency Model](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/RECENCY-MODEL.md)
- [SQLite Schema](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/SQLITE-SCHEMA.md)
- [Research Program](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/RESEARCH-PROGRAM.md)
- [First 10 Days](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/FIRST-10-DAYS.md)
- [Roadmap](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/ROADMAP.md)
- [Research Workspace](/Users/theysayheygreg/clawd/projects/dj-vault/research/README.md)
