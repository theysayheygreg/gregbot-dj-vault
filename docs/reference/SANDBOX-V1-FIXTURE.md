# Sandbox V1 Fixture

This is the first serious DJ Vault library test pack.

The point is not to simulate a perfect library. The point is to simulate a believable small DJ library where the same music appears in multiple systems with slightly different truth.

## Why This Fixture Exists

We do not want to point early DJ Vault import, merge, and export logic at Greg's long-term library first. That is a good way to damage trust and a bad way to learn.

This fixture gives us a controlled lab:

- real MP3 audio
- small enough to inspect by hand
- multiple library views
- intentional metadata disagreement
- duplicate-path and duplicate-tag cases
- playlists that differ by system

If DJ Vault cannot explain this fixture cleanly, it is not ready for a real library.

## Audio Pool

The source pool contains six actual MP3s staged locally into:

`tmp/sandbox-v1/source-pool`

They were copied out of Greg's iCloud Drive with Finder on this machine because direct shell reads from `~/Library/Mobile Documents/com~apple~CloudDocs` were blocked by macOS privacy controls for this process.

The six source tracks are:

1. `Dare [Soulwax Remix]` by `Gorillaz`
2. `A Pain That I'm Used To [Jacques Lu Cont Remix]` by `Depeche Mode`
3. `Le Disko [Tommire Sunshine's Brooklyn Fire Retouch]` by `Shiny Toy Guns`
4. `Rocker [Eric Prydz Remix]` by `Alter Ego`
5. `No More Conversations [Mylo Remix]` by `Freeform Five`
6. `Zdarlight` by `Digitalism`

## Library Views

The fixture builder creates three library views under:

`tmp/sandbox-v1/views`

### `canonical-embedded`

This is the "what we want DJ Vault to believe" view.

- titles normalized to parentheses style
- `Tommire` corrected to `Tommie`
- album unified as `Sandbox V1 Canonical`
- comments explain the canonical choice

### `rekordbox6-dirty`

This is the old-USB, old-export, slightly messy booth-prep view.

- bracket-style titles preserved
- one track has a blank artist
- one track has a blank album
- one duplicate file exists under a different filename
- comments sound like ad hoc DJ notes

### `traktor-dirty`

This is the path- and import-drift view.

- mix names shortened or changed
- one artist is inflated with `feat.`
- one title has spacing drift: `Zdar Light`
- one duplicate path exists for the same audio
- one title drifts from `Remix` to `Dub`

## Conflict Themes

This fixture is intentionally small, but it covers the right failure modes:

1. Same audio, different tags.
2. Same audio, different filenames and paths.
3. Missing artist in one system.
4. Album disagreement across systems.
5. Title normalization drift: brackets vs parentheses.
6. Spelling drift: `Tommire` vs `Tommie`.
7. Semantic drift: `Remix` vs `Dub`.
8. Duplicate-path crates and playlist membership differences.

## Expected Canonical Winners

The expected winners are also written to:

`tmp/sandbox-v1/expected/canonical-truth.tsv`

The short version:

| Slug | Expected Canonical Truth | Why |
| --- | --- | --- |
| `dare` | `Dare (Soulwax Remix)` / `Gorillaz` | Reject `club copy` suffix and keep normalized title style |
| `a-pain` | `A Pain That I'm Used To (Jacques Lu Cont Remix)` / `Depeche Mode` | Fill missing artist from the stronger views |
| `le-disko` | `Le Disko (Tommie Sunshine Brooklyn Fire Retouch)` / `Shiny Toy Guns` | Fix the spelling drift and normalize punctuation |
| `rocker` | `Rocker (Eric Prydz Remix)` / `Alter Ego` | Treat bracket and parentheses versions as the same track |
| `no-more-conversations` | `No More Conversations (Mylo Remix)` / `Freeform Five` | Reject the Traktor-side `Dub` drift |
| `zdarlight` | `Zdarlight` / `Digitalism` | Merge spacing drift and alternate duplicate path |

## Playlists

The builder writes nine M3U8 playlists under:

`tmp/sandbox-v1/playlists`

There are three per view:

- `Warmup Tools`
- `Peak Pressure`
- one disagreement playlist unique to the view

The disagreement playlists are deliberate:

- `canonical-embedded/Left Turns`
- `rekordbox6-dirty/Last Session`
- `traktor-dirty/Dubious Duplicates`

These give us something better than a flat import test. We can inspect how a system handles divergent playlist intent around the same songs.

## Recommended V1 Test Sequence

1. Ingest only `canonical-embedded` and confirm the track rows look sane.
2. Import `rekordbox6-dirty` as a conflicting second view and inspect what DJ Vault treats as same-track vs new-track.
3. Import `traktor-dirty` and confirm the `Zdar Light` and `Mylo Dub` cases surface as review-worthy conflicts.
4. Create one DJ Vault canonical playlist from the merged truth.
5. Stage a Rekordbox 6 device export and compare its emitted metadata against the expected winners.

## Acceptance Bar

DJ Vault passes this fixture when it can:

- ingest all three views without confusion about where each opinion came from
- surface duplicate-path and naming drift cleanly
- preserve provenance for every disagreement
- let us resolve or infer the canonical winner for each conflict
- produce a Rekordbox 6-oriented export that matches the chosen truth

## Build Command

From repo root:

```bash
npm run fixture:build-sandbox-v1
```

That command assumes the source pool already exists in `tmp/sandbox-v1/source-pool`.
