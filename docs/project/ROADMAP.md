# DJ Vault — Roadmap

See also: [First 10 Days](/Users/theysayheygreg/clawd/projects/dj-vault/docs/project/FIRST-10-DAYS.md)

## Phase 0 — Foundation Reset

Status: in progress

Goals:

- Convert the repo into a real software workspace
- Convert the reverse-engineering effort into a durable corpus program
- Publish the expanded charter and architecture

Exit criteria:

- [x] Runnable app shell exists
- [x] Shared packages exist
- [x] Research workspace exists
- [x] Expanded roadmap and research program exist
- [x] Day-based initial execution plan exists
- [x] GitHub/publication baseline files exist
- [ ] GitHub-ready baseline docs and metadata exist

## Phase 1 — Corpus Intake Infrastructure

Goals:

- Build vendor/source maps
- Create artifact manifest formats
- Start collecting public firmware/software inventory metadata
- Establish repeatable extraction and note-taking conventions

Exit criteria:

- [ ] Source maps for Pioneer/AlphaTheta, Native Instruments, Serato, Denon, and Rekordbox are documented
- [x] First source-surface collector exists and generates inventory snapshots
- [x] First AlphaTheta family enumerator exists and generates dated product-family inventories
- [ ] Artifact manifest schema is locked
- [ ] First pass inventory for last 10 years exists for each target family
- [ ] Download/extraction workflow is documented and testable

## Phase 2 — Canonical Library Core

Goals:

- Implement library root configuration
- Implement track ingest and hashing
- Implement SQLite schema and migrations
- Implement provenance-aware metadata model

Exit criteria:

- [ ] Track import works from a local folder
- [ ] Hash and canonical path are stored
- [ ] Metadata can be read and normalized
- [ ] Provenance can represent competing values

## Phase 3 — Interop Adapters

Goals:

- Implement Traktor, Rekordbox, Serato, and Engine-oriented import/export adapters
- Build capability maps from corpus findings
- Add format validation fixtures

Exit criteria:

- [ ] At least one end-to-end export path works
- [ ] Round-trip fixtures exist for core targets
- [ ] Adapter constraints are documented with evidence

## Phase 4 — Metadata Workbench

Goals:

- Build editing UI for tags, keys, ratings, cue data, notes, and set intent
- Add conflict inspection and provenance views
- Add bulk operations

Exit criteria:

- [ ] Single-track and bulk editing work
- [ ] Source evidence is inspectable
- [ ] Conflicts can be resolved intentionally

## Phase 5 — Visibility Layer

Goals:

- Create target-specific projections where direct integration is constrained
- Support playlist-of-playlists and similar compatibility workarounds
- Make compiled outputs inspectable before export

Exit criteria:

- [ ] At least one non-native visibility projection works
- [ ] Projection limitations are documented in UI

## Phase 6 — Emulation Layer

Goals:

- Build practical workflow emulation for selected Pioneer/AlphaTheta and Native Instruments surfaces
- Model playlist navigation, cue behavior, and export consequences
- Use corpus findings to drive compatibility assumptions

Exit criteria:

- [ ] A DJ can inspect how a collection/set will appear on at least one target workflow
- [ ] Emulator constraints are documented with evidence
- [ ] Unsupported behavior is explicitly surfaced, not implied

## Phase 7 — Open Development

Goals:

- Publish on GitHub
- Document contribution lanes
- Make corpus and code reviewable by outside developers

Exit criteria:

- [ ] Public repo structure is ready
- [ ] Contribution guide exists
- [ ] License and sharing posture are explicit
