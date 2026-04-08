# DJ Vault — Development Journal

## 2026-04-07 — Workspace Reset

The project stopped being a pure design-doc repo today.

The original design work remains useful, but the scope is now larger and more concrete: DJ Vault is both a software product and a reverse-engineering/research program. The repo was reshaped accordingly. There is now a runnable desktop shell, shared TypeScript packages, a research workspace, and an explicit research program aimed at firmware, software, release notes, and media/export behavior across Pioneer/AlphaTheta, Rekordbox, Native Instruments, Serato, and Denon.

The important strategic shift is this: research is no longer a side task. It is a first-class input into adapter design and emulation design. That should keep the product from drifting into hand-wavy guesses about what vendor ecosystems actually do.

Immediate next work:

- lock the artifact/source manifest format
- inventory the official source surfaces
- build the first collection scripts
- draft the SQLite schema and ingest path

## 2026-04-07 — Day 1 Collector Pass

The first actual research automation now exists. The repo has a corpus collector CLI that reads the source-map manifests, fetches the official source surfaces, and writes dated inventory snapshots under `research/manifests/inventories/`.

That immediately produced a useful directional result. AlphaTheta, rekordbox, and Denon/Engine DJ surfaces fetched cleanly. Native Instruments and part of Serato did not; they returned HTTP 403 from simple scripted fetches. That is not failure in the abstract. It is real ecosystem information that affects how we plan acquisition work.

The practical consequence is simple: push the next automated collection tranche into Pioneer/AlphaTheta plus rekordbox first, and treat NI/Serato as a separate access-strategy problem instead of pretending one crawler will cover all vendors.

## 2026-04-07 / 2026-04-08 — Day 2 and Day 3

The repo now has the minimum public-project hygiene needed to share work without embarrassment: a license, contribution guidance, artifact-handling guidance, and basic issue templates.

More importantly, the first real AlphaTheta product-family enumerator exists and ran successfully after a couple of parser fixes. The important lesson was not glamorous: the category data lives inside the escaped React stream, and the first empty inventories were caused by a combination of parsing the wrong shape and then accidentally racing the enumerator against an old build output. Once fixed, the collector produced dated inventories with real counts and real product-page support sections.

That got us to concrete numbers: 31 DJ players, 43 DJ mixers, 11 all-in-one systems, and 5 rekordbox support products visible from the public support taxonomy at collection time. Product pages also expose structured section labels like `Firmware Update`, `Drivers`, `Software Update`, and `PRO DJ LINK Bridge`, plus highlight articles that clearly include firmware breadcrumbs. That is enough to justify a next collector that walks those per-product sections and highlight articles for actual version histories.

## 2026-04-08 — Day 4, Day 5, and Day 6 Pull-Forward

This tranche finally crossed the line from "workspace with collectors" into "workspace with durable state".

On the research side, two new collectors landed. The first walks the public `rekordbox` release-note archive and writes dated manifests. The second walks targeted AlphaTheta support sections and extracts public article inventories from the streamed Next payload. The AlphaTheta side produced the richer result immediately: 54 products, 121 targeted sections, and 186 collected articles across firmware, software-update, driver, and bridge-related support surfaces.

On the product side, the first executable SQLite schema now exists as a proper package. The bootstrap command creates a real local database with tracks, people, tags, cue points, loops, beat grids, playlists, smart rules, DJ sets, provenance, and import/export job tables. That matters because the project can now generate both corpus artifacts and local catalog state from the command line.

There were two implementation lessons worth keeping. First, the public `rekordbox` archive is straightforward HTML and does not need a hidden API for the visible release-note history. Second, AlphaTheta article data is embedded in the React stream payload, so future collectors against that site should expect escaped JSON instead of relying only on visible card markup.

Later in the same tranche, two more concrete pieces landed. First, AlphaTheta article pages are now being resolved into actual artifact links, which means the corpus can point not only to article metadata but to firmware ZIPs and change-history PDFs. Second, the catalog gained a first ingest writer. It recursively scans files, filters likely audio formats, hashes them, inserts `tracks` rows, records an `import_jobs` row, and writes provenance for the canonical path, hash, and a filename-derived title.

That ingest path is intentionally narrow for now. It does not copy into a managed library root yet, and it does not read embedded tags or audio duration yet. But it is real write-path code against the actual SQLite catalog, which is the important threshold.

That changed again in the next pass. Ingest now uses `ffprobe` with `mdls` fallback, so the catalog writes duration, sample rate, and bitrate where available, and promotes embedded metadata when it exists. On the corpus side, the AlphaTheta lane now has a bounded archive downloader and a ZIP inspection pass with SHA-256 recording. The project is finally starting to accumulate local artifact state instead of only URLs and notes.

Later the archive path stopped being theoretical. The firmware-selection bug that accidentally pulled `CDJ-3000X` instead of `DJM-A9` was fixed by rebuilding cleanly and rerunning the bounded acquisition/unpack lane against an exact product list. The resulting local set is now the intended one: `CDJ-3000`, `XDJ-AZ`, `OMNIS-DUO`, `OPUS-QUAD`, and `DJM-A9`, with unpacked payloads staged under `research/corpus/alphatheta-unpacked/`.

That also surfaced a more useful packaging detail. Four of those unpacked payloads currently identify as LUKS-encrypted containers, while the `DJM-A9` payload currently identifies as generic `data`. That difference is the kind of concrete firmware-shape clue the emulation and update-path work will need later.

The bigger shift in the same pass is that the catalog stopped being almost entirely AlphaTheta-shaped. New collectors now snapshot public software history for `Serato DJ Pro`, `Engine DJ`, and `Traktor`. The repo can now say something concrete across the original project scope: `rekordbox` has 30 visible release-note entries, `Serato DJ Pro` exposes 115 public archive entries from `4.0.5` back to `1.0.0`, `Engine DJ` exposes 9 visible release-note entries from `4.3.4` back to `3.2`, and the current `Traktor` “What’s New” chain exposes versions from `4.4.2` back through `4.1` plus explicit hardware intersections like `DJM-A9`, `DDJ-FLX4`, `DDJ-FLX2`, `S2 MK3`, `Z1 MK2`, and `MX2`.

One more useful distinction emerged immediately after that. Release-note history and current package surfaces are not the same thing, and vendors do not keep them equally synchronized. The repo now captures that explicitly. `rekordbox` exposes a current public package URL for `7.2.13`, and `Engine DJ` exposes current desktop packages plus a hardware updater matrix on the downloads page that is richer than the visible public release-note folder. At collection time, that page exposed `Engine DJ Desktop` packages up through `4.5.0` and 15 hardware updater entries, 11 of them Denon-branded, including `PRIME GO+`, `PRIME 4+`, `SC LIVE 4`, `SC LIVE 2`, `PRIME 4`, `PRIME GO`, `PRIME 2`, `SC6000 PRIME`, `SC6000M PRIME`, `SC5000 PRIME`, and `SC5000M PRIME`.

That stopped being abstract immediately after. The repo now has a bounded local acquisition layer for those public package surfaces. `rekordbox 7.2.13` is on disk as a 649 MB ZIP whose current top-level entry is `Install_rekordbox_x64_7_2_13.exe`. On the Engine side, the repo now has the `Engine DJ Desktop 4.5.0` Windows installer plus three Denon USB update images on disk for `SC6000 PRIME`, `PRIME 4+`, and `SC LIVE 4`, each with SHA-256 recorded in a machine-readable acquisition summary. The most interesting immediate file-shape clue is that `SC6000-4.3.4-Update.img` currently identifies as a Device Tree Blob while the other two current Denon images identify more generically as `data`.

The next pass turned those generic Engine findings into something much more usable. The `PRIME 4+` and `SC LIVE 4` images now parse as `AZ0x` wrapper containers with a string table and typed `BOOT` / `PART` records. That matters because the names are not inferred anymore. The container itself labels the part payloads as `splash`, `updatesplash`, `kernel`, and `rootfs`, and those labels now drive the carve output.

That also made the first real payload classification possible. The carved `kernel` and `rootfs` members are XZ-compressed and identify as ext filesystems after decompression, while the carved `BOOT` members still identify as Device Tree Blob payloads. `SC6000 PRIME` still does not fit that shape, which is now an explicit structural distinction in the corpus rather than a hand-wavy suspicion.
