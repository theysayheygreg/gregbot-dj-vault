# Source Surface Collection Run — 2026-04-07

## Question

What happened when DJ Vault’s first automated source-surface collector fetched the official vendor pages directly on 2026-04-07?

## Evidence

- Generated summary:
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/source-inventory-summary-2026-04-07.json`
- Generated vendor inventories:
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/pioneer-alphatheta-source-inventory-2026-04-07.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/native-instruments-source-inventory-2026-04-07.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/serato-source-inventory-2026-04-07.json`
  - `/Users/theysayheygreg/clawd/projects/dj-vault/research/manifests/inventories/denon-engine-source-inventory-2026-04-07.json`

## Findings

### Pioneer / AlphaTheta and rekordbox are currently the cleanest first target

All six tracked Pioneer/AlphaTheta and rekordbox surfaces returned HTTP 200 on 2026-04-07. That makes this vendor family the best first candidate for deeper automated enumeration of firmware pages, release notes, and downloadable artifacts.

### Denon / Engine DJ also looks automatable

All three tracked Denon / Engine DJ surfaces returned HTTP 200 on 2026-04-07. The Engine DJ support pages redirect into a support portal cleanly, but remain fetchable and title-bearing after redirect.

### Native Instruments is currently anti-bot or otherwise access-restricted from simple scripted fetches

All four tracked NI surfaces returned HTTP 403 on 2026-04-07. One response carried the title `Access Denied` and another returned `Just a moment...`, which strongly suggests an access-control layer or bot challenge. That means NI collection probably needs a different acquisition path, likely manual/browser-assisted collection, archived URLs, or a connector strategy that respects their public access boundary.

### Serato is mixed

The main Serato product/download pages returned HTTP 200, but the support article surface returned HTTP 403 with a `Just a moment...` title on 2026-04-07. That suggests the public marketing/download pages are accessible while some support knowledge-base pages sit behind anti-bot protection.

## Design Implications for DJ Vault

- Day 2 and Day 3 work should prioritize Pioneer/AlphaTheta plus rekordbox and Denon because the acquisition path is already smooth.
- NI and Serato should get explicit access-strategy notes before we waste time building scrapers against blocked surfaces.
- The collector should keep recording failures as first-class evidence rather than treating them as noise. Access friction is part of the ecosystem reality.

## Open Unknowns

- Whether NI and Serato support pages become accessible with different headers, browser-driven fetches, or archived mirrors.
- Whether official package download URLs for old versions are directly discoverable from the accessible public pages.
