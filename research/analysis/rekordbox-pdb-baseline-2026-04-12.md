# DJ Vault — Rekordbox PDB Baseline — 2026-04-12

Question:

- What does the local reference corpus actually tell us about the minimum viable `export.pdb` writer for DJ Vault's narrowed v1 target?

References:

- Empty device export:
  - `tmp/deep-symmetry/rekordcrate/data/complete_export/empty/PIONEER/rekordbox/export.pdb`
- Populated device export:
  - `tmp/deep-symmetry/rekordcrate/data/complete_export/demo_tracks/PIONEER/rekordbox/export.pdb`
- Deep Symmetry orientation note:
  - `research/analysis/deep-symmetry-orientation-2026-04-12.md`

Findings:

- The local reference pair is useful for a first writer tranche, but it does not cover every minimum v1 table equally well.
- The current DJ Vault PDB plan code identifies direct structural movement between the empty and populated reference exports for:
  - `tracks`
  - `artists`
  - `labels`
  - `keys`
  - `history`
- The current reference pair does **not** currently show enough table-level change for:
  - `albums`
  - `playlist_tree`
  - `playlist_entries`
  - `columns`

Interpretation:

- That means the first writer tranche can be grounded immediately for track-oriented rows and supporting lookup tables.
- Playlist-tree and playlist-entry writing still need either:
  - stronger local reference exports with actual playlist differences, or
  - direct row-construction work grounded in the crate-digger / rekordcrate format docs rather than only the bundled sample pair.

Design implication:

- DJ Vault should not pretend the local sample pair fully solves `export.pdb`.
- The repo now has enough structure to separate:
  - reference-covered tables
  - reference-gap tables
  - explicitly deferred native artifacts

Current practical next step:

1. Keep `tracks`, `artists`, `labels`, and `keys` as the first binary-writer targets.
2. Acquire or synthesize better playlist-oriented reference exports.
3. Treat `playlist_tree` and `playlist_entries` as the next blocking native tables after the first track row writer lands.
