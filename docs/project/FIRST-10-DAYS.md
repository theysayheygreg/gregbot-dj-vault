# DJ Vault — First 10 Days

This is the first serious execution slice, not a vague wishlist.

## Day 1

- Convert the repo into a buildable workspace
- Add the first research corpus structure
- Add official vendor source maps
- Implement and run the first source-surface collector

Done when:

- the repo builds
- the repo typechecks
- source inventory JSON exists under `research/manifests/inventories/`

## Day 2

- Add GitHub publication basics
- Add contribution and artifact-handling guidance
- Draft the SQLite schema from the canonical track model
- Add a minimal CLI package for ingest/research commands

## Day 3

- Start Pioneer/AlphaTheta enumeration by product family
- Capture firmware page URLs, release dates, versions, and package links where public
- Write first vendor family summary with gaps and blockers

## Day 4

- Start rekordbox software inventory
- Capture release notes for recent major/minor lines
- Identify package/download constraints and version-history patterns

Status:

- completed in first pass via `packages/corpus/src/rekordbox.ts`
- public archive collector is running and generating dated manifests
- current visible public archive reaches back to `6.8.5` as of 2026-04-08 UTC

## Day 5

- Draft canonical provenance tables and conflict model
- Start the ingest pipeline skeleton
- Add a database bootstrap command

Status:

- completed in first pass via `packages/catalog`
- first schema includes provenance, import jobs, export jobs, playlists, sets, and track-analysis tables
- `npm run catalog:init` now creates a real SQLite catalog

## Day 6

- Start Traktor inventory
- Separate public installer access from Native Access mediated flows
- Capture collection-format and metadata-behavior notes

Status:

- partially pulled forward by deepening AlphaTheta article collection instead
- practical next step is still Traktor acquisition strategy, but the higher-yield move was to exploit the public AlphaTheta and rekordbox surfaces first

## Day 7

- Start Serato and Denon inventory
- Identify cross-ecosystem friction points and export assumptions
- Produce a first capability matrix

## Day 8

- Implement first track-ingest command
- Hash files
- Write initial rows into SQLite

## Day 9

- Implement first import/export fixture harness
- Parse at least one target format end to end
- Add reproducible test fixtures

## Day 10

- Review what the first nine days produced
- Cut scope that is ornamental
- Lock the next 30-day tranche around the highest-yield adapter and emulator work
