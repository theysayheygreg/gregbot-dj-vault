# DJ Vault — Architecture

DJ Vault now has two tightly linked architecture tracks:

1. Product architecture for the library/metadata/export/emulation system.
2. Research architecture for collecting and understanding vendor software, firmware, and media behavior.

The two tracks feed each other. Product decisions should be grounded in observed ecosystem behavior, and corpus findings should become executable adapters, validators, and emulation rules.

## System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                            DJ Vault Platform                       │
├───────────────────────────────┬────────────────────────────────────┤
│ Product Lane                  │ Research Lane                      │
│                               │                                    │
│ - Library store               │ - Artifact discovery               │
│ - Metadata engine             │ - Download manifests               │
│ - Import/reconciliation       │ - Extraction and static analysis   │
│ - Export/visibility adapters  │ - Firmware/software notes          │
│ - Emulation engine            │ - Knowledge corpus                 │
├───────────────────────────────┴────────────────────────────────────┤
│ Shared domain model, provenance model, and target capability map   │
└────────────────────────────────────────────────────────────────────┘
```

## Product Lane

### 1. Canonical Library Core

- Owns track identity, files, metadata, playlists, sets, and provenance.
- Remains local-first and file-first.
- Uses SQLite as primary state.

### 2. Metadata Engine

- Merges embedded tags, imported app metadata, analysis-tool outputs, and user edits.
- Stores field-level provenance and conflict state.
- Produces a resolved canonical view plus source evidence.

### 3. Import / Reconciliation

- Reads external library formats and software state where practical.
- Matches by content hash first, then path, then structured fuzzy rules.
- Never silently overwrites canonical truth.

### 4. Export / Visibility Layer

- Compiles canonical state into target-specific projections.
- Supports native formats first, visibility layers second.
- Examples:
  - Rekordbox XML
  - Traktor-compatible playlist views
  - Playlist-of-playlists projections when native nesting is constrained

### 5. Emulation Engine

- Models how vendor devices/software interpret playlists, metadata, cues, beatgrids, and settings.
- Starts with behavioral emulation, not cycle-perfect hardware emulation.
- Answers practical DJ questions:
  - Will this playlist structure appear the way I expect?
  - Will these cues and comments survive this export path?
  - How will this collection feel on a CDJ/XDJ workflow versus Traktor?

## Research Lane

### 1. Artifact Discovery

- Identify official download surfaces and public archives.
- Track product families, date ranges, platforms, and artifact types.

### 2. Acquisition Manifest

- Maintain machine-readable manifests for what exists, what was fetched, and what remains missing.
- Separate discovered metadata from downloaded binaries.

### 3. Extraction and Static Analysis

- Unzip packages, inspect resources, parse release notes, and extract strings and schemas.
- Produce notes on update mechanisms, file formats, hardware interaction, and USB/media layouts.
- Stay within public artifacts and lawful static analysis.

### 4. Knowledge Corpus

- Markdown-first durable findings.
- One vendor family summary, plus per-product/per-version notes where warranted.
- Every important claim should point back to an artifact, release note, manual, or inspection note.

## Initial Repo Strategy

### Apps

- `apps/desktop`
  - first runnable UI shell
  - project dashboard
  - later: library browser, metadata editor, export inspector, emulation views

### Packages

- `packages/core`
  - shared domain model
  - capability model
  - provenance primitives

- `packages/corpus`
  - vendor definitions
  - artifact manifest types
  - source-map helpers

### Research

- `research/manifests`
  - artifact indexes and source maps

- `research/corpus`
  - extracted artifacts and per-artifact notes

- `research/analysis`
  - narrative writeups and synthesis docs

## Decisions

- Start with boring web/TypeScript tooling for velocity.
- Treat firmware/software analysis as a first-class subsystem, not a side spreadsheet.
- Keep the product model and corpus model separate but interoperable.
- Prioritize behaviorally accurate workflow emulation over deep hardware simulation in early phases.
