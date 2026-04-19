# DJ Vault — Decision Log

> Tracks design forks. Each entry: Question, Options considered, Where it landed, Door status, Date.

---

## How to Read This

Decisions here are load-bearing. If you're about to revisit one, read the full entry first. The "door status" tells you whether it's safe to reopen.

---

## 2026-04-06 — Canonical Identity

**Question:** What identifies a track across the system?

**Options considered:**
1. Use Traktor's `AUDIO_ID` as canonical
2. Use Rekordbox's `TrackID` as canonical
3. Use the file's absolute path
4. Use a DJ Vault UUID + SHA-256 content hash

**Where it landed:** Option 4. DJ Vault UUID for identity, SHA-256 for content identity (dedupe hardening). Traktor and Rekordbox IDs live in `links.*` as export references only.

**Why:** Traktor and Rekordbox IDs are not stable across reinstalls and collections. Paths change when files move. UUID + hash is the only combination that survives everything — reinstalls, drive swaps, file renames.

**Implementation note added 2026-04-14:** The `sandbox-v1` system test exposed an important caveat: full-file SHA-256 is too sensitive when the same song is wrapped in different tags, filenames, or download-source metadata. DJ Vault now supplements that with a metadata-insensitive MP3 content hash for the tag-rewrite case, but the broader implementation of "content identity" is still open for refinement. We likely need an audio-content fingerprint or another metadata-insensitive layer for cross-encode, cross-source, or alternate-master comparisons in addition to the raw file hash.

**Door status:** Closed at the model level, open at the implementation level for a less brittle content-identity strategy.

---

## 2026-04-06 — Storage Layer

**Question:** How do we store canonical track metadata?

**Options considered:**
1. SQLite
2. Flat JSON sidecars per track
3. PostgreSQL
4. A document store (CouchDB, LMDB)

**Where it landed:** Option 1. SQLite as primary with optional JSON sidecars for debug/backup.

**Why:** This is a local-first tool. SQLite handles everything we need (relational queries, indexing, transactions, durability) without a server process. Sidecars are nice for human inspection but terrible as primary truth (slow, hard to query, fragile).

**Door status:** Closed.

---

## 2026-04-06 — Physical Files vs References

**Question:** How does DJ Vault store track files?

**Options considered:**
1. Track references to wherever the DJ already has files (iCloud, external drives, existing library folders)
2. Managed library root — DJ Vault copies files into a controlled directory
3. Hybrid: reference external, optionally copy to managed root

**Where it landed:** Option 2. Managed library root, full stop. Files are copied in on import. The original file in the download folder can be deleted or kept — DJ Vault doesn't care.

**Why:** Greg's entire problem is that iCloud creates symlinks, external drives go missing, and reference-based libraries break on USB swaps. DJ Vault cannot be another layer of indirection. The library root is concrete bytes we control.

**Door status:** Closed. This is Pillar 2.

---

## 2026-04-06 — Playlist vs Set Distinction

**Question:** Are playlists and DJ sets the same thing?

**Options considered:**
1. Single unified "playlist" concept with optional metadata
2. Two separate concepts: Playlist (bucket) and DJSet (sequence with intent)
3. Playlists only, with set metadata as notes

**Where it landed:** Option 2. Playlist and DJSet are separate types. Playlists are dumb buckets (possibly smart-ruled). Sets are sequences with role, transition method, and energy tracking per track.

**Why:** The difference is real and meaningful. Playlists exist for organization ("all my acid tracks"). Sets exist for performance ("the 90-minute peak slot at the warehouse party"). Collapsing them into one concept loses the set-building workflow that's a core reason to build this tool.

**Door status:** Closed.

---

## 2026-04-06 — Export Idempotency

**Question:** Should export be idempotent / deterministic?

**Options considered:**
1. Non-deterministic (timestamps, random IDs) — simpler
2. Deterministic — same source produces same output

**Where it landed:** Option 2. Export is compilation; running it twice with no changes produces byte-identical output (modulo header timestamps).

**Why:** DJ workflows involve lots of export-then-tweak-then-re-export. If the output changes every time, Greg can't tell what actually changed. Deterministic output makes diffs meaningful and makes the tool trustworthy.

**Door status:** Closed. Infrastructure will respect this.

---

## 2026-04-12 — V1 Scope Narrowing

**Question:** What hardware and software is v1 actually validating against?

**Options considered:**
1. Everything the original research program enumerated — all five vendors, current and legacy hardware, rekordbox 6.x and 7.x, Device Library Plus
2. Current-generation flagship Pioneer gear — CDJ-3000, XDJ-AZ, OMNIS-DUO, OPUS-QUAD, DJM-A9 — and the newest rekordbox format
3. NXS2-era Pioneer hardware Greg personally owns (DJM-900NXS2, XDJ-1000MK2, XDJ-RX2) plus adjacent research-reach devices, and the traditional rekordbox device library format as produced by rekordbox 6.8.6 or by rekordbox 7.x when it still emits the traditional export

**Where it landed:** Option 3. V1 is the working-DJ persona on mid-tier gear, not the flagship-chasing hobbyist. Load-bearing framing: *traditional device library in scope, Device Library Plus out of scope.*

**Why:** The flagship hardware is thousands of dollars and nobody who isn't a headlining DJ owns it. The new library format (and the rekordbox 7+ software changes) is a massive pain to deal with only for use on hardware no one has. Narrowing to the gear real DJs actually use — hardware Greg can physically validate against — collapses the scope by an order of magnitude and dodges the LUKS firmware-packaging wall that blocked the current-gen reverse-engineering lane.

**Reference artifacts:**
- [V1 Targets](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/V1-TARGETS.md)
- `research/analysis/v1-target-acquisition-2026-04-12.md`
- `research/analysis/deep-symmetry-orientation-2026-04-12.md`

**Door status:** Closed for v1. Post-v1 expansion is explicitly on the table (rb7-only devices, Denon, Serato, NI hardware) but not before the v1 acceptance test passes.

---

## 2026-04-14 — Desktop Tech Stack (Provisional)

**Question:** Electron, Tauri, native, or web?

**Options considered:**
1. **Electron** — battle-tested, huge ecosystem, heavy
2. **Tauri** — lighter, Rust backend, smaller install
3. **Native Swift** — Mac-only, best performance and UX
4. **Vite + React + local Node runtime** — web tech driving a local API and filesystem surface, shipped as a placeholder `.app`

**Where it landed:** Option 4 for now. The desktop app (currently named `VaultBuddy` as a placeholder binary name, not a canonical product name) runs as a Vite dev server in development and as a built Node server runtime (`apps/desktop/server.mjs`) otherwise, talking to the real SQLite catalog over a small local API.

**Why:** The product needed a real surface to exercise against actual catalog state, and the fastest path was to keep the frontend in React + Vite and lean on Node for the local filesystem/database bridge. This is not a long-term commitment. If DJ Vault ports to a more native Apple-like surface later, the tech stack question reopens.

**Door status:** Provisionally closed. The decision re-opens automatically if/when we move toward a native wrapper.

---

## Open Decisions

### Distributed Topology Scope For V1 (open)

**Question:** How much of the distributed-topology scaffolding should be load-bearing for v1?

**Context:** The catalog now has first-class topology tables (`vault_nodes`, `storage_locations`, `track_residencies`, `export_execution_plans`) and a transport-aware export planner that resolves source media from residency records and flags local-vs-remote execution. The `DISTRIBUTED-TOPOLOGY.md` doc frames remote physical export from distributed media as the "nuclear bomb" product opportunity. The `LAPTOP-RUNTIME-SETUP.md` doc explicitly recommends single-laptop operation for v1 so we prove the library and export loop before inventing sync problems.

**Options:**
1. Freeze the topology lane at current scaffolding. Ship v1 single-machine. Revisit remote execution post-v1.
2. Continue building transport execution (staging, pull-across-transport, remote export) as part of the v1 critical path.
3. Keep the scaffolding as-is but explicitly flag it as post-v1 scope in the roadmap so it does not pull attention during v1.

**Status:** Pending Greg's decision. Needs fleshing out. The scaffolding exists either way; the question is how much further it goes before v1 ships and whether the current framing overstates it for v1.

### Energy Scale (open)

**Question:** Is the energy scale 0..10 or 0..100?

**Status:** Pending. Must be locked before Phase 2 metadata editing.

### Canonical Key Display (open)

**Question:** Which key notation is the default display — Camelot (8A) or musical (F#m)?

**Status:** Pending. Both are stored; this is a UI default question.
