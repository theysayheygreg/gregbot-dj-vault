# DJ Vault — V1 Targets

> The concrete scope v1 is actually shooting at. Everything outside this list is reference-only, deferred, or out of scope until v1 ships.

---

## V1 User

The working DJ on mid-tier gear — not the flagship-chasing hobbyist, not the tech-curious hardware reviewer, not the headlining festival DJ with a sponsored CDJ-3000 stack.

This is a persona decision, not a hardware decision. It changes what "correct" means, what "good enough" looks like, and what counts as load-bearing for v1. Features that only matter to people with $15k of current-gen gear are not v1 concerns.

---

## V1 Era

NXS2-era Pioneer hardware and the traditional rekordbox device library workflow. Everything in that window shares one export format, one workflow model, and one well-documented reverse-engineering corpus.

The important distinction is not "rekordbox 6 only" versus "rekordbox 7 only." The important distinction is:

- **In scope:** rekordbox 6.x and rekordbox 7.x when they are producing the traditional device library consumed by NXS2-era gear.
- **Out of scope:** Device Library Plus and any new library behavior that only exists to support bleeding-edge players.

That lets DJ Vault support the desktop software people actually have installed without chasing the newest hardware-specific format changes.

As of April 12, 2026, the official rekordbox ver. 6 FAQ still exposes direct public downloads for **ver. 6.8.6** and **ver. 6.8.5**. That makes **rekordbox 6.8.6** the last publicly exposed 6.x target, with 7.x treated as a compatibility source only when exporting the same traditional device library.

---

## V1 Hardware Targets (Locked)

Hardware Greg personally owns and has access to for behavioral validation:

- **DJM-900NXS2** — 4-channel club-standard mixer. Effects, channel routing, send/return, DVS behavior.
- **XDJ-1000MK2** — media player consuming rekordbox-prepared USB media. No onboard library.
- **XDJ-RX2** — all-in-one (2 decks + mixer + screen). Reads rekordbox-prepared USBs.

All three are in the NXS2 era. All three predate the LUKS firmware packaging that blocked the current-gen Pioneer reverse-engineering lane. All three consume the same rekordbox 6.x USB export format.

---

## V1 Hardware Targets (Adjacent — Research Reach)

Devices Greg does not own but that live inside the same era and consume the same format. Worth acquiring firmware and documenting behavior for so v1 generalizes beyond Greg's personal rig:

- **CDJ-2000NXS2**
- **XDJ-700**
- **DJM-750MK2**

These are "research reach" — static analysis and format documentation only. Not required for v1 ship.

---

## V1 Software Targets

- **rekordbox 6.8.6** — canonical desktop prep and export reference.
- **rekordbox 7.x** — compatibility target only insofar as it can still produce the same traditional device library for older gear.
- **Traditional rekordbox USB export format** — the `PIONEER/rekordbox/` directory convention, `export.pdb`, analysis subfolders, cue/memory/hot-cue data, beatgrid data, playlist data.

That format is the central thing the v1 validation layer needs to be correct about. Everything else is scaffolding around it.

Explicitly out of scope for v1:

- Device Library Plus
- rekordbox 7 library-schema changes unrelated to traditional device export
- any format branch that only exists for current-generation flagship players

---

## External Reference Corpus

There is an existing public reverse-engineering body of work that covers exactly this target. The **Deep Symmetry project** — `dysentery`, `crate-digger`, `rekordcrate`, and related work — has been documenting and implementing the rekordbox USB export format and the Pioneer Pro DJ Link protocol for years.

DJ Vault should orient to that corpus, not duplicate it. The difference is a three-month reverse-engineering project versus a two-week integration project.

Integration rules:

- Every adapter, parser, or validation rule that derives from Deep Symmetry cites the specific repo, file, and commit.
- Where Deep Symmetry's documentation is incomplete or disagrees with observed behavior on Greg's hardware, that delta becomes a DJ Vault research note.
- Where DJ Vault extends the format coverage, those extensions should be contributed back where possible.

---

## Reference-Only Corpus (Not V1)

The current reverse-engineering work on current-generation AlphaTheta gear stays on disk as reference material. It is not deleted, not duplicated, not extended until v1 ships:

- CDJ-3000
- XDJ-AZ
- OMNIS-DUO
- OPUS-QUAD
- DJM-A9

The LUKS-wrapped firmware payloads, the AZ0x carve pipeline, the Engine AZ0x work on Denon — all of it is frozen as "current-gen comparison corpus." Revisit post-v1 if and when the user base grows to include people who own this gear.

---

## Deferred Decisions

Called out explicitly so they do not leak into the v1 research tranche:

- **XDJ-RX3.** Deferred. It is not a v1 blocker and it pulls attention toward newer-format behavior we are intentionally not chasing right now.
- **Native Instruments / Traktor.** V1 support is **software-only**. Import/export and collection interpretation are in scope; NI hardware modeling is not.
- **Denon / Engine DJ.** Out of scope for v1. Future-proofing build target only. Existing Denon corpus stays frozen.

---

## What This Unblocks For Research

With v1 targets locked, the next research tranche is concrete instead of open-ended:

1. Acquire firmware blobs for the six NXS2-era devices (three locked, three research-reach).
2. Verify that those firmware blobs are not LUKS-wrapped. (Almost certainly true. Confirm.)
3. Acquire the final public rekordbox 6.x desktop release and a current 7.x desktop package for compatibility comparison.
4. Orient to Deep Symmetry. Read `dysentery`, `crate-digger`, `rekordcrate`. Map their format coverage against what DJ Vault needs.
5. Identify the smallest useful v1 validation surface: *given a DJ Vault collection, produce a traditional rekordbox USB export that round-trips correctly through one of Greg's three physical devices.*

That is the v1 acceptance test. Everything else is scaffolding.

---

## What This Freezes In The Current Corpus

To prevent drift and duplicate effort, the following are frozen until v1 ships:

- AlphaTheta current-gen firmware acquisition (CDJ-3000, XDJ-AZ, OMNIS-DUO, OPUS-QUAD, DJM-A9).
- LUKS key-derivation investigation.
- Denon / Engine DJ firmware acquisition and AZ0x carving.
- Serato reverse engineering beyond release-history catalog.
- Device Library Plus and any rekordbox 7.x format work that exists only for bleeding-edge devices.

The work already on disk for these lanes is kept. No new effort is spent on them until v1 ships.
