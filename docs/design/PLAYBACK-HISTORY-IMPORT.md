# DJ Vault — Playback History Import

DJ Vault now has a generic playback-history import seam.

The point is not to pretend Rekordbox and Traktor already parse cleanly.

The point is to define the canonical shape that vendor parsers should emit once they exist.

## Current Canonical Import Shape

Implementation:

- `packages/catalog/src/history-import.ts`
- `packages/catalog/src/cli/import-playback-history.ts`

The importer consumes a JSON file shaped like:

```json
{
  "sessions": [
    {
      "startedAt": "2026-04-01T05:00:00Z",
      "endedAt": "2026-04-01T07:10:00Z",
      "sourceKind": "rekordbox-history",
      "sourceRef": "History/2026-04-01/Warehouse-Open.xml",
      "venue": "Warehouse",
      "context": "Friday open",
      "note": "Imported from Rekordbox history playlist",
      "events": [
        {
          "trackRef": "Track Title",
          "playedAt": "2026-04-01T05:10:00Z",
          "positionInSession": 1,
          "sourceRef": "entry-1",
          "confidence": 0.9,
          "note": "Opening track"
        }
      ]
    }
  ]
}
```

## Why This Matters

Vendor history data is messy and vendor-specific.

What DJ Vault needs is a stable internal landing zone for:

- Rekordbox history playlists
- Traktor history nodes
- "last session" style logs
- future Engine / Serato history evidence when practical

This import seam gives us that landing zone now.

## Vendor Fixture Compilers

DJ Vault now also includes fixture-oriented vendor compilers that target this canonical shape:

- `packages/catalog/src/vendor-history.ts`
- `packages/catalog/src/cli/import-rekordbox-history.ts`
- `packages/catalog/src/cli/import-traktor-history.ts`

Current direct commands:

- `npm run catalog:import-rekordbox-history -- <rekordbox-history-xml-path>`
- `npm run catalog:import-traktor-history -- <traktor-history-nml-path>`

Tracked fixture examples:

- `docs/reference/rekordbox-history.sample.xml`
- `docs/reference/traktor-history.sample.nml`

These compilers are intentionally narrow right now.

They are meant to prove the canonical landing zone and exercise real vendor-flavored structure without claiming full parser parity for every export/history variant in the wild.

## Current Vendor Assumptions

The current Rekordbox compiler assumes:

- collection tracks are declared in `COLLECTION`
- history playlists live under a `NODE` named `HISTORY`
- session membership comes from ordered `TRACK Key="..."`

The current Traktor compiler assumes:

- collection entries live in `COLLECTION`
- history playlists live under a `NODE` named `History`
- session membership comes from `PLAYLIST > ENTRY > PRIMARYKEY`

When exact event timestamps are absent, DJ Vault currently infers event order from playlist order and assigns synthetic per-track times one minute apart from the parsed session start.

## Current Matching Behavior

Imported events resolve tracks by:

- DJ Vault UUID
- SHA-256
- exact title
- exact file name

That is intentionally conservative.

The next importer pass should use stronger matching and provenance, especially once vendor IDs and app-library imports are richer.

## Current Effects

Importing playback history will:

- create `playback_sessions`
- create `playback_events`
- update `tracks.play_count`
- update `tracks.last_played_at` when the imported event is newer

## Next Step

The next move should be to build vendor-specific extractors that compile into this format:

- `rekordbox-history -> canonical playback-history json`
- `traktor-history -> canonical playback-history json`

That keeps parser complexity separate from the canonical catalog write path.
