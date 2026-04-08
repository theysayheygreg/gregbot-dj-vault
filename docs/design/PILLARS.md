# DJ Vault — Design Pillars

> Six design lenses, ordered by priority. When in doubt, the higher-numbered pillar wins.

---

## 1. Single Source of Truth

DJ Vault is the canonical library. Traktor and Rekordbox are **views** onto the vault — not peers. Export is compilation, not sync. If you edit something in Traktor and not in DJ Vault, the next export overwrites it.

**Test:** If a DJ has a metadata change in Traktor and re-exports from DJ Vault, is the canonical truth preserved?
**Rule:** Yes — or the change was never authoritative in the first place.

---

## 2. Physical Files Only

No iCloud. No symlinks. No aliases. No "reference to cloud file" ambiguity. Every track lives as a physical byte sequence under one managed library root. The DJ owns the drive; the tool owns the layout.

**Test:** Can the library survive a flight with no internet, a laptop swap, and a USB export — all in one day?
**Rule:** Yes, every time. No exceptions for convenience.

---

## 3. Metadata Provenance

Every analyzed field (BPM, key, energy, loudness) tracks where it came from and when. "BPM=124.98 from Mixed In Key on 2026-04-06" beats a mystery value. Conflicts are visible, not silently resolved.

**Test:** If two sources disagree about a track's BPM, can the DJ see both values and pick one?
**Rule:** Yes. DJ Vault never guesses silently.

---

## 4. Export Is Compilation

Exporting to Traktor NML or Rekordbox XML is a deterministic transformation from DJ Vault's canonical model to the target app's schema. Same source → same output. No stateful export drift. Re-export should be idempotent.

**Test:** Export twice in a row with no changes. Are the output files byte-identical (modulo timestamps)?
**Rule:** Yes.

---

## 5. Sets Are Not Playlists

A playlist is a bucket. A set is a sequence with intent. DJ Vault distinguishes them. Sets know about order, transitions, cue points, energy curves, and set roles (opener, builder, peak, closer). Playlists are dumb collections that sort.

**Test:** Can a DJ build a 90-minute peak-time set with transition notes between tracks, then export it as a Rekordbox playlist with those cues preserved?
**Rule:** Yes.

---

## 6. Library Hygiene Over Ontology

DJs need "find me dark tribal 126 BPM 8A builders." They do not need a perfect genre taxonomy. DJ Vault favors multi-dimensional searchable tags (mood, set-function, energy, era) over deep genre trees. Controlled vocab plus freeform tags, both searchable.

**Test:** Can a DJ find the right 10 tracks for a transition in under 30 seconds?
**Rule:** Yes — via tags, energy, key compatibility, and BPM, not via browsing a genre tree.
