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
