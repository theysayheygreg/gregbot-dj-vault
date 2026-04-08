# AlphaTheta Download Resolution — 2026-04-08

The AlphaTheta corpus now has a second-stage resolver that follows public support articles into concrete download artifacts.

## What Was Resolved

- 186 public support articles fetched and parsed
- 466 likely artifact links extracted

Machine-readable outputs:

- `research/manifests/inventories/alphatheta-downloads-2026-04-08.json`
- `research/manifests/inventories/alphatheta-downloads-summary-2026-04-08.json`

## Current Artifact Mix

- `pdf`: 296
- `archive`: 168
- `disk-image`: 2

The important point is not the PDF count by itself. It is that the public support corpus now resolves from:

- product
- section
- article
- concrete package or change-history file

That is the first real path toward a firmware/package acquisition program that can be automated.

## Useful Example

`CDJ-3000 Firmware` resolves to:

- `CDJ3Kv322.zip`
- `CDJ-3000-Firmware-Change-History-Ver322-en.pdf`

The collector also extracts inline labels when present, including package size, version text, and date text such as `155 MB`, `3.22`, and `15/Jan/2026`.

## Important Observations

- The rendered article HTML is the reliable parsing surface. The stream payload references the article body indirectly, so parsing the visible markdown block is more dependable than assuming a simple serialized body field.
- The corpus now has enough structure to separate true package artifacts from manuals, guides, and historical PDFs.
- Two legacy DVJ firmware downloads currently resolve as `.iso` disk images rather than ZIP archives, so the corpus tracks those separately.
- Some support articles still point to secondary support pages rather than direct installers, especially around drivers. Those should be handled in a later pass as support-link hops rather than mislabeled as package binaries.

## Next Move

- split direct package links from support-hop links
- normalize package versions and dates into dedicated fields
- start downloading a bounded firmware/archive subset for static inspection
