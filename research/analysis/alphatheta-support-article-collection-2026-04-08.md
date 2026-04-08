# AlphaTheta Support Article Collection — 2026-04-08

The first AlphaTheta section/article collector now exists and ran successfully against the public support site.

## What Was Collected

- 54 products with at least one targeted support section
- 121 targeted sections
- 186 collected articles

Section labels covered:

- `Firmware Update`
- `Software Update`
- `Drivers`
- `PRO DJ LINK Bridge`

Machine-readable outputs:

- `research/manifests/inventories/alphatheta-support-articles-2026-04-08.json`
- `research/manifests/inventories/alphatheta-support-articles-summary-2026-04-08.json`

## Counts By Section Label

- `Firmware Update`: 49 sections, 62 articles
- `Software Update`: 16 sections, 17 articles
- `Drivers`: 48 sections, 91 articles
- `PRO DJ LINK Bridge`: 8 sections, 16 articles

## Useful Examples

- `CDJ-3000` currently exposes 8 targeted articles across firmware, drivers, and bridge-oriented support sections.
- `XDJ-RX3` exposes both firmware and driver articles.
- `DJM-A9`, `DJM-TOUR1`, and other mixers expose dense driver/support surfaces relevant to booth-state modeling.
- Newer devices like `OMNIS-DUO` and `XDJ-AZ` already show the expected split between firmware and Windows audio-driver support.

## Important Observations

- The support site is not just static marketing copy. It exposes structured article inventories embedded in the Next.js stream payload.
- Article timestamps often reflect later edits, so `release_at`, `created_at`, and `updated_at` should all be preserved separately.
- Some products have targeted sections with zero currently visible articles. That is useful negative evidence and should not be treated as a collector failure.
- `Drivers` is the densest support surface right now, which suggests the hardware/software boundary is likely easiest to map first through host-driver behavior and USB/link workflows rather than firmware alone.

## Why This Matters

This moves the project from product-family enumeration to a real knowledge base of support artifacts tied to concrete devices. That is enough to start building:

- version-history manifests
- hardware capability timelines
- firmware/download acquisition checklists
- emulator constraints grounded in public support behavior

## Next Research Move

- follow each collected article into package/download URLs and explicit version numbers
- separate true firmware packages from guides and driver notes
- prioritize CDJ/XDJ/DJM families that dominate club booths
