# Source Surface Inventory — 2026-04-07

## Question

What official public surfaces are available right now for collecting firmware, software packages, release notes, and support details across the first DJ Vault vendor set?

## Evidence

- AlphaTheta support: `https://alphatheta.com/en/support/`
- AlphaTheta help center: `https://support.alphatheta.com/`
- OMNIS-DUO firmware page: `https://support.alphatheta.com/en-us/articles/26559347114649`
- rekordbox release notes: `https://rekordbox.com/en/support/releasenote/`
- rekordbox download page: `https://rekordbox.com/en/download/`
- Native Instruments downloads: `https://www.native-instruments.com/en/support/downloads/`
- Traktor setup: `https://www.native-instruments.com/en/specials/traktor/setup-traktor/`
- Traktor X1 downloads example: `https://www.native-instruments.com/en/products/traktor/dj-controllers/traktor-x1/downloads/`
- NI Traktor update article: `https://support.native-instruments.com/hc/en-us/articles/115002829885-How-to-Download-and-Install-a-TRAKTOR-Software-Update`
- Serato DJ downloads: `https://serato.com/dj/downloads`
- Serato DJ Pro page: `https://serato.com/dj/pro`
- Denon DJ downloads: `https://www.denondj.com/downloads.html`
- Engine DJ updates and releases: `https://enginedj.com/kb/folders/69000636315/engine-dj-updates-and-releases`

## Findings

### Pioneer / AlphaTheta is split across multiple surfaces

The AlphaTheta ecosystem appears to use a public support landing page, a help-center surface, and a dedicated downloads host. Product firmware pages can contain direct package links, release histories, and even open-source notices. That is promising for systematic collection.

### rekordbox has a strong public release-note surface

rekordbox release notes are public and appear to have durable URLs. This should make software-history scraping and behavior tracking much easier than ecosystems that hide older versions behind account walls.

### Native Instruments is partially account-mediated

NI’s public support pages confirm that newer Traktor software distribution is routed through Native Access, while older major-version installers remain on legacy update surfaces. That means the inventory work can start from public documentation, but actual package acquisition may be uneven across versions without account-mediated access.

### Serato exposes the latest release clearly, but historical harvesting may be trickier

The current Serato DJ downloads page surfaces the latest release notes inline. It is a strong starting point, but the historical 10-year archive may require pagination, support articles, or archived URLs rather than a single public index.

### Denon splits device artifacts between Denon DJ and Engine DJ

Denon’s downloads page still exposes some direct firmware and driver artifacts, while Engine DJ centralizes OS/Desktop release history. That split matters because the device/software boundary is explicit in the ecosystem.

## Design Implications for DJ Vault

- The corpus pipeline should model source surfaces separately from artifacts. Some vendors expose nice public archives; others expose only the latest surface plus hints about older flows.
- Acquisition needs per-vendor strategies instead of one generic scraper.
- The emulation and export design should assume vendor behavior is discoverable in uneven layers: release notes, manuals, package contents, updater apps, and media/database outputs.

## Open Unknowns

- How complete the accessible 10-year firmware history is on current AlphaTheta/Pioneer support surfaces.
- Whether official historical rekordbox packages remain publicly accessible by stable URLs or only through current-version download flows.
- How far Traktor package acquisition can go without authenticated Native Access flows.
- How much historical Serato release-note history is still live on first-party URLs.
