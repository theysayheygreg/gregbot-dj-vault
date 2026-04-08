# AlphaTheta Family Enumeration — 2026-04-08

## Question

What can DJ Vault learn from a first machine-generated enumeration of AlphaTheta support product families for DJ players, DJ mixers, all-in-one systems, and rekordbox support products?

## Evidence

- Summary:
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/alphatheta-category-summary-2026-04-08.json`
- Category inventories:
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/alphatheta-dj-players-inventory-2026-04-08.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/alphatheta-dj-mixers-inventory-2026-04-08.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/alphatheta-all-in-one-dj-systems-inventory-2026-04-08.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/alphatheta-rekordbox-inventory-2026-04-08.json`

## Findings

### The public AlphaTheta support taxonomy is already a usable capability map

The support site separates major hardware/software families cleanly and exposes product-level pages with repeatable sections such as `Manuals`, `Software Information`, `Firmware Update`, `Drivers`, `Software Update`, and in some cases `PRO DJ LINK Bridge`. That is a strong sign that DJ Vault can derive vendor-facing capability assumptions from support structure, not just from firmware binaries.

### The currently visible product depth is substantial

On 2026-04-08 UTC, the collector found:

- 31 DJ player products
- 43 DJ mixer products
- 11 all-in-one DJ systems
- 5 rekordbox support products

This gives DJ Vault a concrete vendor-family map instead of vague product folklore.

### Active versus archived status is exposed usefully

The support pages surface status values such as `Active`, `Archived`, and `Support ended`. That matters for adapter planning because old products are still part of real libraries and gig workflows, but they should not be treated like feature-equivalent modern targets.

### Product pages expose support sections that hint at real workflow seams

Examples:

- DJ players such as CDJ-3000 expose `Firmware Update`, `Software Update`, `Drivers`, and `PRO DJ LINK Bridge`.
- Mixers such as DJM-A9 expose `Firmware Update`, `Drivers`, and `PRO DJ LINK Bridge`.
- rekordbox support products expose thinner section sets, mostly `Product Tutorials`, `System Requirements`, and for rekordbox 5 only `Manuals`.

That structure is already useful for scoping where DJ Vault should expect firmware concerns, host-software concerns, and network-link concerns.

### Product pages also expose “News & Highlights” entries that can be mined as version breadcrumbs

For example, the CDJ-3000 product page surfaces a highlight titled `Firmware release (ver. 3.18) for CDJ-3000` dated 2024-12-04 UTC. That means product pages themselves may be a workable first-pass source for version breadcrumbs even before deeper article-by-article crawling is implemented.

## Design Implications for DJ Vault

- Treat the AlphaTheta support taxonomy as a first-class input to the target capability model.
- Split emulation and export work by product family, not just by vendor.
- Keep old/archived hardware in scope for import/export behavior even if active development prioritizes newer gear first.
- Add a follow-up collector that walks product-page highlights and section pages to build actual firmware/version inventories from the support graph.

## Open Unknowns

- How consistently firmware article links can be extracted from section pages for older products.
- Whether some firmware histories exist only as highlight posts and not as neatly grouped section listings.
- How much of rekordbox’s desktop-version history should be taken from AlphaTheta support versus the standalone rekordbox site.
