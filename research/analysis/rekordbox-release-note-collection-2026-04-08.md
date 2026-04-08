# rekordbox Release Note Collection — 2026-04-08

The first public `rekordbox` release-note collector now exists and ran successfully against the live archive at `https://rekordbox.com/en/support/releasenote/`.

## What Was Collected

- 3 public archive pages
- 30 release-note entries
- versions ranging from `7.2.13` down to `6.8.5`

Machine-readable outputs:

- `research/manifests/inventories/rekordbox-release-notes-2026-04-08.json`
- `research/manifests/inventories/rekordbox-release-notes-summary-2026-04-08.json`

## Important Observations

- The public archive is HTML-first and paginated. It does not require a private API to extract the visible release notes.
- The currently visible archive is not a full ten-year history. As of April 8, 2026 UTC, the public pages exposed only 30 entries and the oldest visible item was `ver. 6.8.5 [2024.4.16]`.
- Some entries expose a version but no explicit bracketed release date in the heading, for example `ver. 7.2.13`. Those need a second pass if we want authoritative release dates for every entry.
- The release-note bodies are already useful for product design. They repeatedly mention USB export, LINK EXPORT, Device Library Plus / OneLibrary, Apple Music, Spotify, TIDAL, Beatport, Beatsource, SoundCloud, stems, and hardware compatibility gates.

## Why This Matters

This gives DJ Vault a real changelog surface for tracking how `rekordbox` evolves:

- library behavior
- export behavior
- streaming support
- hardware compatibility assumptions
- migration language and naming changes

That is directly relevant to both the adapter layer and the future emulation layer.

## Next Research Move

- collect the actual desktop package download surfaces and installers for matching versions
- backfill older release notes from alternate public pages or package-history references
- extract compatibility mentions into a normalized capability timeline
