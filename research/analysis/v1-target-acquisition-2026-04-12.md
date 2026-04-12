# DJ Vault — V1 Target Acquisition Snapshot — 2026-04-12

Question:

- What is the concrete software and firmware artifact set for the narrowed v1 target?

Evidence:

- Official rekordbox ver. 6 FAQ: `https://rekordbox.com/en/support/faq/rekordbox6/#faq-q600141`
- Official AlphaTheta support pages:
  - `https://support.alphatheta.com/en-US/articles/4404624354969` (`DJM-900NXS2 Firmware`)
  - `https://support.alphatheta.com/en-US/articles/4404821857945` (`XDJ-1000MK2 Firmware`)
- Local artifacts acquired on April 12, 2026:
  - `research/corpus/rekordbox/v6/Install_rekordbox_x64_6_8_6.zip`
  - `research/corpus/v1-targets/firmware/DJM-900NXS2_207.zip`
  - `research/corpus/v1-targets/firmware/XDJ1000MK2_v145.zip`

Findings:

- The last publicly exposed `rekordbox 6.x` build is `6.8.6`, not `6.8.5`.
- The official FAQ still exposes both `6.8.6` and `6.8.5` direct download links as of April 12, 2026.
- Local `rekordbox 6.8.6` Windows package:
  - file: `Install_rekordbox_x64_6_8_6.zip`
  - size: `659,771,601` bytes
  - SHA-256: `bcaa831d7604f125809b3f131505bdec9d2af52733636316bcaad429aa209f50`
- Local `DJM-900NXS2` firmware package:
  - file: `DJM-900NXS2_207.zip`
  - size: `1,234,334` bytes
  - SHA-256: `6207ad1001f639bfb7c757ff545cea03721a3ce430e435dc834015049857acef`
  - archive contents: `DJM-900NXS2_207.upd`
- Local `XDJ-1000MK2` firmware package:
  - file: `XDJ1000MK2_v145.zip`
  - size: `11,838,058` bytes
  - SHA-256: `535d2d424380d68c5c9f5903fb28001fbfcfc3cc42b190410a542b3f294c0b17`
  - archive contents: `XDJ1KMK2.UPD`

Design implication for DJ Vault:

- The v1 software baseline should be `rekordbox 6.8.6`.
- `rekordbox 7.x` should be treated as a compatibility source only for the traditional device library, not as an excuse to chase Device Library Plus.
- NXS2-era firmware acquisition is tractable and light-weight compared to the current-generation firmware lane.

Open unknowns:

- `XDJ-RX2`, `CDJ-2000NXS2`, `XDJ-700`, and `DJM-750MK2` still need the same bounded acquisition pass.
- The next useful check is whether these NXS2-era `.upd` payloads identify as plain update blobs instead of encrypted LUKS containers.
