# DJ Vault — Music Library Organization System

> Single source of truth for a DJ's music library, metadata, and set curation.

## The Problem

Greg is stuck in a fragmented workflow:
- Beatport → iTunes → Traktor → Rekordbox → USB → CDJs
- No single source of truth for playlists
- iCloud storage creates symlinks instead of physical files
- Import/export tools between Traktor and Rekordbox are abandonware
- Rekordbox UI is bad but the hardware is industry-standard
- Traktor laptop experience is great but lugging a laptop to gigs sucks
- Existing tools (Lexicon, DJoid, Crates) are mediocre on metadata
- MixedInKey is metadata-first, weak on library

## Real Problems to Solve

1. **Single source of truth** — one place where library and playlists live, no duplication across apps
2. **Metadata consistency** — BPM, key, energy, genre, etc. stays consistent when exported to Traktor/Rekordbox
3. **Set creation tool** — a place to build new DJ sets from songs with similar metadata, then export cleanly to whatever format the gig requires

## Ideal Outcome

A tool to:
- Manage a physical file library (not iCloud/symlink hell)
- Maintain rich metadata per track (BPM, key, energy, genre tags, etc.)
- Create and manage playlists with full visibility of source truth
- Export playlists/sets to Traktor format (.nml) and Rekordbox format (.xml)
- Support the laptop-free gig workflow (Rekordbox USB preparation)

## Out of Scope (for now)

- Audio analysis / waveform generation
- Actual playback or mixing
- Beat grid editing
- Integration with streaming services

## Agent Assignments

- **Orrery**: Architecture, spec, data model, export format research
- **Prism**: UX research (existing DJ tools, what works/what doesn't), competitive analysis
- **Forge**: Implementation when specs are approved

## Status

Initial project bootstrap. Agents being briefed.
