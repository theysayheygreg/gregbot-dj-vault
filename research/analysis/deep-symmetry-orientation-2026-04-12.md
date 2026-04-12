# DJ Vault — Deep Symmetry Orientation — 2026-04-12

Question:

- What parts of the narrowed v1 target should DJ Vault build itself, and what parts should be grounded in existing public reverse-engineering work?

Evidence:

- `dysentery` commit: `45ad4c09667abf3d502c258113465e5fcacaa3fd`
- `crate-digger` commit: `d95c444bde4bec6763cbbffd1a405dda0cc08750`
- `rekordcrate` commit: `befc9eb9077a18ecc3bfb1e2263aabf5820209d0`
- Local clones:
  - `tmp/deep-symmetry/dysentery`
  - `tmp/deep-symmetry/crate-digger`
  - `tmp/deep-symmetry/rekordcrate`

Findings:

- `dysentery` is the right reference for **Pro DJ Link network behavior**, packet captures, and player/mixer runtime interaction on Nexus-era hardware.
- `crate-digger` is the right reference for **traditional rekordbox device export parsing**, especially `export.pdb` and `ANLZ*.DAT` / `ANLZ*.EXT`.
- `rekordcrate` is the right complementary reference for **device-export parsing and inspection tooling** from a Rust perspective, especially around `export.pdb`, `USBANLZ`, and `*SETTING.DAT` files.

What they cover vs what DJ Vault still needs:

- Covered well by external corpus:
  - `export.pdb` structure knowledge
  - `ANLZ` file structure knowledge
  - Pro DJ Link network observations
  - existing parser implementations and test fixtures
- Still DJ Vault-owned:
  - canonical library and provenance model
  - import/export projection between DJ Vault and vendor formats
  - remote export planning across distributed storage topology
  - practical validation against Greg's exact owned hardware
  - policy about what part of `rekordbox 7` is in scope and what is not

Design implication for DJ Vault:

- We should not spend v1 rediscovering `export.pdb` from scratch.
- We should cite `crate-digger`, `rekordcrate`, and the Deep Symmetry analysis pages at the rule level when implementing USB export correctness.
- We should use `dysentery` as reference-only support for later network/protocol validation, not as the main first-week target.

Recommendation:

1. Treat `crate-digger` and `rekordcrate` as primary format references for the v1 USB export lane.
2. Treat `dysentery` as the primary network/protocol reference when we need to reason about player behavior beyond the exported media itself.
3. Keep every DJ Vault format note anchored to a repo, file, and commit so we can tell observed behavior from inherited reverse-engineering knowledge.
