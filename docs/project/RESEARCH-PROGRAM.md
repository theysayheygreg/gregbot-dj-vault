# DJ Vault — Research Program

## Purpose

The research program exists to make DJ Vault technically credible.

We are not collecting vendor artifacts out of curiosity. We are building an evidence base for:

- import/export adapter design
- metadata survivability rules
- playlist and USB projection behavior
- target capability maps
- practical workflow validation

## Target Families

### Pioneer DJ / AlphaTheta

- locked v1 hardware: `DJM-900NXS2`, `XDJ-1000MK2`, `XDJ-RX2`
- research-reach hardware: `CDJ-2000NXS2`, `XDJ-700`, `DJM-750MK2`
- rekordbox desktop software focused on `6.8.6` and `7.x` traditional-device-library compatibility
- traditional rekordbox USB/device export format

### Reference-Only For Post-v1

- Native Instruments / Traktor hardware
- Serato hardware lanes
- Denon DJ / Engine DJ hardware lanes
- current-generation AlphaTheta flagship devices

## Collection Principles

- Prefer official download and release-note surfaces first.
- Record what exists even when a package cannot be downloaded automatically.
- Keep source URLs, dates, product names, and platform distinctions.
- Keep binaries and extracted notes separate.
- Store narrative findings as Markdown with citations back to artifacts.

## Legal / Safety Boundary

The work should remain inside public artifacts, public documentation, release notes, static inspection, and lawful reverse engineering. Do not rely on credentials you should not have. Do not break access controls. Do not distribute proprietary binaries in places where that would be inappropriate; store manifests and local notes, and handle downloaded artifacts carefully.

## Deliverables

### Machine-readable

- vendor source maps
- artifact manifests
- extraction inventory
- capability and constraint maps

### Human-readable

- vendor overviews
- product-family notes
- format behavior notes
- USB/media layout notes
- validation-layer design implications

## Output Conventions

Each substantive research note should include:

1. Question
2. Evidence
3. Finding
4. Design implication for DJ Vault
5. Open unknowns
