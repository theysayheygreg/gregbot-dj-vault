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
- An emulation program for club workflows, especially Pioneer/AlphaTheta and Native Instruments surfaces.
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

The corpus program currently targets:

- Pioneer DJ / AlphaTheta hardware firmware and software
- Rekordbox desktop software and release notes
- Native Instruments Traktor software and hardware
- Serato software and hardware
- Denon DJ / Engine DJ hardware and intersecting export behavior

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

- [Architecture](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/ARCHITECTURE.md)
- [Data Model](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/DATA-MODEL.md)
- [Distributed Topology](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/DISTRIBUTED-TOPOLOGY.md)
- [QMD Integration](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/QMD-INTEGRATION.md)
- [SQLite Schema](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/SQLITE-SCHEMA.md)
- [Research Program](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/RESEARCH-PROGRAM.md)
- [First 10 Days](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/FIRST-10-DAYS.md)
- [Roadmap](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/ROADMAP.md)
- [Research Workspace](/Users/theysayheygreg/clawd/projects/dj-vault/research/README.md)
