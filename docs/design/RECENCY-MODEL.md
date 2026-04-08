# DJ Vault — Recency Model

Recency is not a cosmetic sort key.

For DJs, recency changes the mental weight of a track:

- recently added tracks feel fresh and unproven
- recently played tracks feel active, familiar, and sometimes temporarily "spent"
- tracks absent from recent sessions start to cool or drift into archive territory

That makes recency a first-class library signal, not a convenience field.

## Why DJ Software Already Hints At This

Tools like Rekordbox and Traktor already expose pieces of the concept:

- added to library
- last played date
- play count
- history/session logs

Those are not random stats. They are crude evidence for a more useful model:

> what is front-of-mind, what is overplayed, what is cooling, and what deserves rediscovery?

## Current DJ Vault Shape

The schema now stores:

- track-level summary fields:
  - `added_at`
  - `last_played_at`
  - `play_count`
- session/event history:
  - `playback_sessions`
  - `playback_events`

Implementation lives in:

- `packages/catalog/src/recency.ts`

## Current Derived Concepts

The recency report currently derives:

- `addedDaysAgo`
- `playedDaysAgo`
- `recentSessionCount`
- `sessionPresenceCount`
- `recencyBucket`
- `mentalWeight`
- `recencyScore`

Current buckets:

- `new`
- `hot`
- `cooling`
- `dormant`
- `never-played`

Current mental weights:

- `front-of-mind`
- `active-option`
- `archive-pressure`
- `unknown`

## Why Session History Matters

`last_played_at` alone is too thin.

A DJ often wants to know:

- did I just play this last weekend?
- has this shown up in three recent sets even if not yesterday?
- what tracks have been neglected for months?
- what do I keep reaching for in warehouse sets versus warmup sessions?

That requires event history, not just a single timestamp.

## Commands

- `npm run catalog:create-playback-session -- <source-kind> [venue] [context] [note]`
- `npm run catalog:log-playback-event -- <track-ref> <source-kind> [session-id] [note]`
- `npm run catalog:recency-report`

## Near-Term Next Step

The next move should be to import vendor history evidence:

- Rekordbox history playlists and played logs
- Traktor history nodes / played markers
- app-specific "last session" and "added" timestamps

That will let DJ Vault compute recency from richer source evidence instead of only native events.
