# Vendor Surface Map

Snapshot date: 2026-04-07

This file tracks the first confirmed official surfaces for artifact discovery.

## Pioneer DJ / AlphaTheta

- AlphaTheta support landing page:
  - `https://alphatheta.com/en/support/`
- AlphaTheta help center:
  - `https://support.alphatheta.com/`
- Example product firmware page with downloadable package and update history:
  - `https://support.alphatheta.com/en-us/articles/26559347114649`
- Notes:
  - The help center appears to expose firmware by product and frequently links to direct download hosts under `downloads.support.alphatheta.com`.
  - This likely becomes the main starting point for CDJ/XDJ/DJM inventory.

## Rekordbox

- Release notes:
  - `https://rekordbox.com/en/support/releasenote/`
- Download entry point:
  - `https://rekordbox.com/en/download/`
- Example introduction/manual artifact surfaced from official CDN:
  - `https://cdn.rekordbox.com/files/20240508162912/rekordbox7.0.0_introduction_EN.pdf`
- Notes:
  - Release notes are public and paginated on the web.
  - Software package URLs may require page scraping or browser inspection from the download flow.

## Native Instruments / Traktor

- NI downloads hub:
  - `https://www.native-instruments.com/en/support/downloads/`
- Traktor setup entry point:
  - `https://www.native-instruments.com/en/specials/traktor/setup-traktor/`
- Example Traktor hardware downloads page:
  - `https://www.native-instruments.com/en/products/traktor/dj-controllers/traktor-x1/downloads/`
- Update behavior article:
  - `https://support.native-instruments.com/hc/en-us/articles/115002829885-How-to-Download-and-Install-a-TRAKTOR-Software-Update`
- Notes:
  - Newer Traktor software updates are mediated through Native Access.
  - Older major-version updates remain available through legacy update surfaces described in support articles.

## Serato

- Serato DJ downloads:
  - `https://serato.com/dj/downloads`
- Serato DJ Pro product page:
  - `https://serato.com/dj/pro`
- OS compatibility/support article:
  - `https://support.serato.com/hc/en-us/articles/204865694-Serato-DJ-Pro-Lite-Operating-System-compatibility`
- Notes:
  - The main download page exposes current release notes inline.
  - Historical version harvesting will likely require pagination, support articles, or archived URLs.

## Denon DJ / Engine DJ

- Denon DJ downloads:
  - `https://www.denondj.com/downloads.html`
- Engine DJ updates and releases:
  - `https://enginedj.com/kb/folders/69000636315/engine-dj-updates-and-releases`
- Example release note:
  - `https://enginedj.com/kb/solutions/69000874617/engine-dj-4-3-4-release-notes`
- Notes:
  - Denon’s downloads page still lists some direct firmware/updater artifacts for mixers and interfaces.
  - Engine OS and Engine Desktop history appear centralized on the Engine DJ site.

## Next Collection Steps

- Convert these surfaces into machine-readable source maps.
- Enumerate product families and pagination patterns.
- Separate directly downloadable artifacts from surfaces that require manual/account-mediated acquisition.
