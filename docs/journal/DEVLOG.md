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

## 2026-04-12 — V1 Scope Narrowing And The Traditional Device Library

The most important thing that happened in the last week is that v1 stopped being about "Pioneer and NI in the abstract" and became about a specific set of gear and a specific export format.

The trigger was a pillar review that forced the scope question honestly. The five AlphaTheta firmware payloads already on disk — CDJ-3000, XDJ-AZ, OMNIS-DUO, OPUS-QUAD, DJM-A9 — are all current-generation flagship hardware that nobody owns unless they are a headlining DJ. Four of those five unpacked to LUKS-encrypted containers, which blocked the Pioneer reverse-engineering lane on a key-derivation question that was going to consume enormous time for no v1 payoff. Meanwhile, the hardware Greg personally has access to — DJM-900NXS2, XDJ-1000MK2, XDJ-RX2 — is all NXS2-era gear that predates the LUKS scheme entirely.

That reframed v1 as a persona decision, not a hardware one. DJ Vault's target user is the working DJ on mid-tier gear, not the flagship-chasing hobbyist. The hardware list follows from that, and so does the export format: the traditional rekordbox device library consumed by NXS2-era gear, regardless of whether rekordbox 6.x or rekordbox 7.x produced it. Device Library Plus and any library behavior that only exists to support bleeding-edge players is out of scope.

The narrowing is captured in [V1 Targets](/Users/theysayheygreg/clawd/projects/dj-vault/docs/design/V1-TARGETS.md) and [Decision Log](/Users/theysayheygreg/clawd/projects/dj-vault/docs/journal/DECISION-LOG.md). It explicitly freezes the current-gen AlphaTheta firmware lane, the LUKS investigation, Denon hardware, Serato hardware, and any rekordbox 7 format work that exists only for flagship players. The work already on disk is kept as reference corpus; no new effort is spent on it until v1 ships.

## 2026-04-12 — Research Pivot And Deep Symmetry Orientation

The narrowed target made the next research tranche concrete. Three artifacts were acquired locally that same day: `rekordbox 6.8.6` as the canonical 6.x desktop package, `DJM-900NXS2_207.upd` firmware, and `XDJ-1000MK2 v145` firmware. The firmware sizes were the first honest signal that the LUKS wall is a current-gen phenomenon and not a Pioneer-wide one: the DJM-900NXS2 payload is 1.2 MB, which is far too small to be a LUKS container. The XDJ-1000MK2 payload is 11.8 MB. Both sit at shapes consistent with plain firmware blobs and not wrapped encrypted images. Final confirmation still requires running `file`/`binwalk` on the extracted `.upd` payloads, but the evidence so far points exactly where the scope decision predicted.

The more significant move on the same day was orientation to the Deep Symmetry reverse-engineering corpus. Pinned commits of `dysentery`, `crate-digger`, and `rekordcrate` are now cloned locally under `tmp/deep-symmetry/`. The orientation note (`research/analysis/deep-symmetry-orientation-2026-04-12.md`) splits the format knowledge cleanly: `export.pdb` and `ANLZ` structure are covered well by the external corpus, Pro DJ Link network behavior is covered by `dysentery`, and DJ Vault still owns the canonical library and provenance model, the vendor-format projection layer, the distributed-topology planning layer, the validation-against-owned-hardware layer, and the policy about what part of rekordbox 7 is in scope. The practical consequence is that the `export.pdb` writer should not be invented from scratch — it should be grounded in existing format docs and the rekordcrate sample pair.

## 2026-04-12 — Device Export Workflow And Distributed Topology

The v1 product spine became end-to-end for the first time this week. The catalog gained a save-target command for per-playlist rekordbox device exports, a transport-aware plan command that resolves source media from track residency records and flags local-vs-remote execution, an execute command that stages a bundle into the saved target root, and a validate command that checks structural sanity before hardware gets touched. The staged bundle now includes a `Contents/` media tree, a collection XML, a manifest JSON, and per-playlist M3U8 files. Native `export.pdb` and `ANLZ` artifacts are still gaps, and those gaps are recorded explicitly in the manifest rather than hidden.

That workflow sits on top of a distributed-topology scaffolding that was introduced the same week. The schema now has first-class tables for `vault_nodes`, `storage_locations`, `track_residencies`, and `export_execution_plans`. The design framing is that the database, the canonical library, and the export destination do not need to live on the same machine — that remote physical export from distributed media is the larger product bet. The first-pass planner now resolves real residency data, picks the best source storage, and records whether the run is local or remote from the execution node.

The topology work is genuinely interesting but it is explicitly ahead of v1 acceptance. The v1 acceptance test is a single laptop producing a rekordbox 6 USB that round-trips through one of Greg's three physical devices. The topology scaffolding does not move data yet, and the laptop-runtime setup doc now recommends single-machine operation for v1 on purpose: prove the library and export loop on one machine before inventing sync problems. How much further the topology lane goes before v1 ships is currently logged as an open decision.

## 2026-04-12 — PDB Write-Plan And Row-Plan Groundwork

The native `export.pdb` writer is approached in three honest steps instead of one heroic one. The first step is the write-plan, which compares an empty and a populated reference `export.pdb` pulled from the rekordcrate sample pair and emits a `pdb-write-plan.json` against the staged export root. That plan names which tables show enough structural movement to be writable from the sample pair alone. The first honest finding was that the sample pair only covers `tracks`, `artists`, `labels`, `keys`, and `history` well — and does not cover `albums`, `playlist_tree`, `playlist_entries`, or `columns` well. That is recorded explicitly in `research/analysis/rekordbox-pdb-baseline-2026-04-12.md` rather than pretended around.

The second step is the row-plan, which reads the staged export manifest plus the DJ Vault catalog and compiles deterministic planned rows for the currently covered tables. That means when the binary writer lands, it will not have to do catalog-to-row transformation on its own — it can focus on bytes and pages. The third step is the actual binary writer. That step has not landed yet. Playlist-oriented tables remain the next blocking native artifact after the first writer tranche is in.

## 2026-04-14 — Sandbox V1 Fixture And The First Real Discovery

The sharpest move of the week was building a controlled lab before pointing DJ Vault at a real library. The `sandbox-v1` fixture is six actual MP3s staged into `tmp/sandbox-v1/source-pool`, reshaped into three intentionally divergent library views under `tmp/sandbox-v1/views`: a `canonical-embedded` view that represents what DJ Vault should believe, a `rekordbox6-dirty` view that simulates ad-hoc booth-prep mess, and a `traktor-dirty` view that simulates path and import drift. The divergence is deliberate: missing artists, bracket-vs-parentheses title drift, spelling drift (`Tommire` vs `Tommie`), semantic drift (`Remix` vs `Dub`), duplicate paths, and playlist disagreements about the same songs. The expected canonical winners are written to `tmp/sandbox-v1/expected/canonical-truth.tsv`. The acceptance bar is explicit: if DJ Vault cannot explain this fixture cleanly, it is not ready for a real library.

The first run of the full system test exposed a real product finding. The naive identity model used full-file SHA-256 as the canonical content hash, which meant the same song wrapped in different tags or filenames produced different hashes and the same audio entered the catalog three times. The fix was to supplement the full-file hash with a metadata-insensitive MP3 content hash that strips tag frames before hashing. The sandbox run now converges 20 track rows down to 6 canonical tracks while preserving the competing title and path opinions in provenance. That is a real improvement, but it is explicitly not the final cross-source identity story — cross-encode duplicates and alternate masters still need a broader answer, probably an audio-content fingerprint. The Canonical Identity decision-log entry now carries an implementation note recording that nuance.

## 2026-04-14 — VaultBuddy Runtime And Laptop Setup

The desktop surface crossed from "development-only viewer" to "practical local tool" this week. The app (currently named `VaultBuddy` as a placeholder for the built `.app` binary, not a canonical product name) now ships as both a Vite dev runtime and a built Node server runtime at `apps/desktop/server.mjs`. The UI is an operator workspace — sidebar, dense track browser, right-hand inspector with tabs — and it edits live catalog state through a small local API. Track metadata edits, playlist membership changes, device target saves, export planning, and export execution all flow through the same API surface in both development and built modes.

The `LAPTOP-RUNTIME-SETUP.md` doc now captures the cleanest first real-world setup: keep VaultBuddy and the SQLite catalog on the laptop that already has the real library, treat the laptop as the canonical media host, and use the Mac mini as a secondary research and export-validation box. That is the shortest path to useful testing and avoids inventing sync problems before the core library and export loop has been proven on a real collection.

## 2026-04-16 — Library Trust Surface

The merge layer matured into a product-facing trust surface rather than a database-arbitration screen. The product stance is now that DJ Vault resolves metadata conflicts automatically when the evidence is strong, preserves every source opinion as provenance, explains the choice on demand, and only interrupts the DJ when uncertainty actually affects prep or export safety. The trust states that back that stance are `trusted`, `chosen`, `needs-attention`, and `blocked` — operational signals to a DJ staring at a large library, not moral judgments about a file.

VaultBuddy now renders these trust states alongside source-opinion counts, rationale, and selected-field context in the dashboard snapshot and inspector. The practical outcome is that the DJ gets a sentence like "DJ Vault chose this title because canonical embedded tags outweighed the other source views. Alternate opinions were preserved in provenance." instead of an IDE-style conflict-resolution screen. The v1 merge policy is intentionally sandbox-shaped and not the final production merge brain, but it is enough to test the product loop against the sandbox fixture and produce honest trust scoring.
