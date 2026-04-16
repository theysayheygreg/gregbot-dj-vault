# Library Trust

DJ Vault should not make DJs resolve metadata like programmers resolve merge conflicts.

The product stance is:

- resolve automatically when the evidence is strong
- preserve every source opinion as provenance
- explain the choice on demand
- interrupt the DJ only when uncertainty affects prep or export safety

## Trust States

Each track can be summarized into one of four states:

- `trusted` — the source evidence is settled enough that the track should not interrupt prep
- `chosen` — source views disagreed, but DJ Vault had a clear rationale for the canonical choice
- `needs-attention` — the track is usable, but the evidence is close, incomplete, or worth checking before a serious export
- `blocked` — core identity data is missing enough that DJ Vault should not treat the track as export-ready

These are not moral judgments about a file. They are operational signals for a DJ staring at a large library.

## Rationale

The merge layer still records exact source opinions, but the user-facing language should stay closer to:

> DJ Vault chose this title because canonical embedded tags outweighed the other source views. Alternate opinions were preserved in provenance.

That is enough to build trust without turning VaultBuddy into an IDE-style diff screen.

## V1 Boundary

The first policy is intentionally simple and sandbox-shaped:

- canonical embedded tags outrank dirty vendor views in the controlled fixture
- Rekordbox and Traktor opinions are preserved as provenance
- metadata-rewritten MP3 copies converge through metadata-insensitive content hashing

This is enough to test the product loop. It is not yet the final production merge brain for cross-encode duplicates, alternate masters, or real-world vendor-library disagreement.
