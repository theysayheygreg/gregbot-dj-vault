# Research Catalog Status — 2026-04-08

This note reflects the generated machine-readable catalog at `research/manifests/inventories/cross-vendor-catalog-status-2026-04-08.json`.

It is still incomplete, but it is no longer vague. The repo now has a clear split between:

- hardware and firmware catalog depth strongest in the Pioneer DJ / AlphaTheta lane
- software release-history depth now present across `rekordbox`, `Traktor`, `Serato DJ Pro`, and `Engine DJ`
- explicit gaps where package acquisition or hardware-level collection is not automated yet

## Pioneer DJ / AlphaTheta Hardware and Firmware

Current public hardware taxonomy and support coverage:

- 31 DJ players
- 43 DJ mixers
- 11 all-in-one DJ systems
- 5 `rekordbox` support products on the AlphaTheta support taxonomy
- 186 public support articles resolved
- 466 direct artifact links resolved

Local firmware archive state:

- `CDJ-3000` firmware ZIP acquired and unpacked
- `XDJ-AZ` firmware ZIP acquired and unpacked
- `OMNIS-DUO` firmware ZIP acquired and unpacked
- `OPUS-QUAD` firmware ZIP acquired and unpacked
- `DJM-A9` firmware ZIP acquired and unpacked

Known unpacked payload paths:

- `research/corpus/alphatheta-unpacked/cdj-3000/cdj3kv322/CDJ3Kv322.UPD`
- `research/corpus/alphatheta-unpacked/xdj-az/xdjazv124/XDJAZv124.UPD`
- `research/corpus/alphatheta-unpacked/omnis-duo/omnisduov123/OMNISDUOv123.UPD`
- `research/corpus/alphatheta-unpacked/opus-quad/opusquadv132/OPUSQUADv132.UPD`
- `research/corpus/alphatheta-unpacked/djm-a9/djm-a9-119/DJM-A9_119.upd`

Current packaging finding:

- `CDJ-3000`, `XDJ-AZ`, `OMNIS-DUO`, and `OPUS-QUAD` payloads currently identify as LUKS-encrypted containers
- `DJM-A9` unpacks to a smaller `.upd` payload that currently identifies as generic `data`

## rekordbox Software

Current release-history state:

- 30 public release-note entries collected
- 3 archive pages collected
- visible release-note history from `7.2.13` back to `6.8.5`

Current package surface state:

- current public download page collected
- current visible package version is `7.2.13`
- current visible package date is `2026-03-31`
- current visible package URL resolves to `Install_rekordbox_x64_7_2_13.zip`

Current local acquisition state:

- `Install_rekordbox_x64_7_2_13.zip` downloaded locally
- local path: `research/corpus/rekordbox/current/Install_rekordbox_x64_7_2_13.zip`
- size: `649,483,097` bytes
- SHA-256: `225ece5dd93cb58b909e6d75d1221e2dca9730a13eaad3ee2f932537276eb113`
- current ZIP entry list is simple and currently exposes `Install_rekordbox_x64_7_2_13.exe`

Current gap:

- bounded local package acquisition is still missing

## Native Instruments / Traktor

Current official software-history state:

- official `What's new in Traktor Pro / Play 4.4.2` article collected through the NI support JSON endpoint
- 7 visible version headings captured from the current article chain: `4.4.2`, `4.4.1`, `4.4.0`, `4.3.0`, `4.2.0`, `4.1.1`, `4.1`
- current official article was updated `2026-03-26`

Current hardware intersection clues pulled directly from that article:

- `DJM-A9`
- `DDJ-FLX4`
- `DDJ-FLX2`
- `S2 MK3`
- `Z1 MK2`
- `MX2`

Current gap:

- hardware firmware and package acquisition is not automated yet

## Serato

Current official software-history state:

- `Serato DJ Pro` archive page collected directly from the public archive surface
- 115 version entries captured
- visible history runs from `4.0.5` back to `1.0.0`

Current gap:

- hardware compatibility and package acquisition is not automated yet

## Denon DJ / Engine DJ

Current official software-history state:

- public Engine DJ updates/releases folder collected
- 9 visible release-note entries captured from the current folder page
- visible history runs from `4.3.4` back to `3.2`

Current package surface state:

- current Engine DJ Desktop download page collected
- 8 desktop package links captured
- current desktop package version visible on that page is `4.5.0`
- 15 hardware updater matrices captured from the same page
- 11 of those hardware entries are Denon DJ branded
- Denon DJ hardware entries now include current updater links for `PRIME GO+`, `PRIME 4+`, `SC LIVE 4`, `SC LIVE 2`, `PRIME 4`, `PRIME GO`, `PRIME 2`, `SC6000 PRIME`, `SC6000M PRIME`, `SC5000 PRIME`, and `SC5000M PRIME`

Current local acquisition state:

- `Engine DJ Desktop 4.5.0` Windows installer downloaded locally
- `SC6000 PRIME`, `PRIME 4+`, and `SC LIVE 4` USB update images downloaded locally
- local acquisition summary lives in `research/manifests/inventories/engine-dj-acquisition-summary-2026-04-08.json`
- current file-type findings:
- `Engine_DJ_4.5.0_3d19c38012_Setup.exe` identifies as `PE32 executable (GUI) Intel 80386, for MS Windows`
- `SC6000-4.3.4-Update.img` currently identifies as a `Device Tree Blob version 17`
- `PRIME4PLUS-4.3.4-Update.img` and `SCLIVE4-4.3.4-Update.img` currently identify as generic `data`

Current parsed-container state:

- `PRIME 4+` and `SC LIVE 4` now expose a parsed `AZ0x` wrapper with typed `BOOT` and `PART` entries
- the wrapper resolves public names for the `PART` entries directly from the string table: `splash`, `updatesplash`, `kernel`, and `rootfs`
- carved `kernel` and `rootfs` payloads both identify as XZ-compressed ext filesystems after decompression
- carved `BOOT` payloads currently identify as Device Tree Blob payloads
- `SC6000 PRIME` still does not match this wrapper shape and continues to look structurally distinct from the `PRIME 4+` / `SC LIVE 4` family

Current gap:

- bounded local acquisition and unpacking of Denon hardware firmware packages is not automated yet

## What Is Clear Now

The repo now has a real cross-vendor catalog instead of one strong vendor lane and three placeholders.

The strongest lane is still Pioneer DJ / AlphaTheta because it now includes:

- hardware-family counts
- per-product support/article coverage
- artifact-link resolution
- bounded archive acquisition
- unpacked firmware payloads on disk

But the software side is now cross-vendor enough to guide product design:

- `rekordbox` release-note history is cataloged
- `Traktor` current version chain and hardware interactions are cataloged
- `Serato DJ Pro` public version archive is cataloged
- `Engine DJ` public release-note history is cataloged

## Immediate Next Catalog Move

The next useful tranche is no longer “figure out whether a catalog is possible.” It is:

1. acquire bounded `rekordbox` desktop packages
2. acquire bounded Denon / Engine desktop and firmware artifacts locally
3. turn Traktor and Serato from software-history catalogs into package and hardware catalogs
