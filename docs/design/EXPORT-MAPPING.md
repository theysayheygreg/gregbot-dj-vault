# DJ Vault — Export Field Mapping

> Deterministic translation tables from DJ Vault canonical model to Traktor NML and Rekordbox XML.

---

## DJ Vault → Traktor NML

| DJ Vault Field | Traktor NML Target | Notes |
|----------------|-------------------|-------|
| `identity.title` | `ENTRY@TITLE` | |
| `identity.artist` (joined) | `ENTRY@ARTIST` | Joined with "/" or ", " per Traktor convention |
| `file.canonicalPath` | `LOCATION` | Path split into DIR/FILE/VOLUME |
| `identity.album` | `ALBUM@TITLE` | |
| `identity.trackNumber` | `ALBUM@TRACK` | |
| `musical.genre` | `INFO@GENRE` | |
| `notes.comment` | `INFO@COMMENT` | |
| `musical.keyDisplay` | `INFO@KEY` | |
| `musical.rating` (0..5) | `INFO@RANKING` | Map to 0 / 51 / 102 / 153 / 204 / 255 |
| `file.durationSec` | `INFO@PLAYTIME` | Seconds |
| `file.addedAt` | `INFO@IMPORT_DATE` | |
| `identity.releaseDate` or `year` | `INFO@RELEASE_DATE` | |
| `musical.bpm` | `TEMPO@BPM` | |
| `analysis.loudnessDb` | `LOUDNESS@PEAK_DB` | If present |
| `musical.keyCamelot` | `MUSICAL_KEY@VALUE` | Camelot enum if supported |
| `analysis.cuePoints` | `CUE_V2` | Repeat per cue |
| `analysis.loops` | `CUE_V2` (type=5) | Traktor uses CUE_V2 for loops |
| `analysis.beatGrid.anchorSec` | `CUE_V2` (type=4 / gridmarker) | |

### Playlist mapping
- `Playlist` folder tree → `PLAYLISTS / NODE (TYPE="FOLDER")` nested
- `Playlist` (`type: 'playlist'`) → `NODE (TYPE="PLAYLIST")`
- `PlaylistItem` → `ENTRY / PRIMARYKEY (TYPE="TRACK" KEY="<collection-path-key>")`

### Canonical path quirks
- Traktor uses `DIR`, `FILE`, `VOLUME` components
- Volume is the mount point or device root
- DIR uses Traktor's backslash-encoded path format inside NML
- File paths must match the canonical library root exactly

---

## DJ Vault → Rekordbox XML

| DJ Vault Field | Rekordbox XML Target | Notes |
|----------------|---------------------|-------|
| `identity.title` | `TRACK@Name` | |
| `identity.artist` (joined) | `TRACK@Artist` | Joined per Rekordbox convention |
| `identity.remixer` (joined) | `TRACK@Remixer` | |
| `identity.album` | `TRACK@Album` | |
| `identity.label` | `TRACK@Label` | |
| `identity.mixName` | `TRACK@Mix` | |
| `musical.genre` | `TRACK@Genre` | |
| `identity.year` | `TRACK@Year` | |
| `identity.releaseDate` | `TRACK@DateAdded` or release-specific if populated | |
| `file.durationSec` | `TRACK@TotalTime` | Seconds |
| `file.bitrateKbps` | `TRACK@BitRate` | |
| `file.sampleRateHz` | `TRACK@SampleRate` | |
| `file.sizeBytes` | `TRACK@Size` | |
| `file.canonicalPath` | `TRACK@Location` | As `file://localhost/...` URI |
| `musical.bpm` | `TRACK@AverageBpm` | |
| `musical.keyDisplay` | `TRACK@Tonality` | |
| `notes.comment` | `TRACK@Comments` | |
| `musical.rating` (0..5) | `TRACK@Rating` | Direct 0..5 |
| `usage.playCount` | `TRACK@PlayCount` | |
| `file.addedAt` | `TRACK@DateAdded` | |
| `analysis.beatGrid.markers` | `TEMPO` (repeated, child of `TRACK`) | `Inizio`, `Bpm`, `Metro`, `Battito` |
| `analysis.cuePoints` (memory) | `POSITION_MARK` with `Type=0`, `Num=-1` | |
| `analysis.cuePoints` (hotcue) | `POSITION_MARK` with `Type=0`, `Num=<index>` | |
| `analysis.cuePoints` (fade-in) | `POSITION_MARK` with `Type=1` | |
| `analysis.cuePoints` (fade-out) | `POSITION_MARK` with `Type=2` | |
| `analysis.cuePoints` (load) | `POSITION_MARK` with `Type=3` | |
| `analysis.loops` | `POSITION_MARK` with `Type=4`, `Start` and `End` | |

### Playlist mapping
- `Playlist` folder tree → `PLAYLISTS / NODE (Type="0" Name="..." Count="...")` folder
- `Playlist` (`type: 'playlist'`) → `NODE (Type="1" Name="..." Entries="...")`
- `PlaylistItem` → `TRACK Key="<TrackID>"` (references TRACK@TrackID in COLLECTION)

### Rekordbox quirks
- `TrackID` is required inside the XML world but is NOT a universal identity — only stable within a single Rekordbox export
- DJ Vault should mint stable `TrackID` values per export target (stored in `links.rekordbox.trackId`)
- `Location` uses `file://localhost/` URI prefix, URL-encoded path

---

## POSITION_MARK Type Reference (Rekordbox)

| Type | Meaning |
|------|---------|
| 0 | Cue (memory or hotcue, distinguished by Num) |
| 1 | Fade-in |
| 2 | Fade-out |
| 3 | Load |
| 4 | Loop (uses Start + End) |

`Num=-1` = memory cue. `Num=0..7` = hot cue slots.

---

## Export Determinism Rules

1. **Stable ordering** — tracks and playlists serialize in a deterministic order (by DJ Vault UUID lexicographic sort, then by position for playlists)
2. **Stable IDs** — Rekordbox `TrackID` and Traktor `AUDIO_ID` are minted once per track per target and persisted in `links.*`
3. **Idempotent output** — running export twice with no intervening changes produces byte-identical files (modulo the DJ_PLAYLISTS/COLLECTION header timestamp)
4. **Validate before write** — run a schema check and a round-trip parse before overwriting the target file
5. **Atomic writes** — write to `file.tmp`, fsync, rename — never corrupt a working collection

## Current Compiler Surface

Current implementation:

- `packages/catalog/src/export.ts`
- `packages/catalog/src/rekordbox-device-export.ts`
- `packages/catalog/src/cli/export-rekordbox-device.ts`
- `packages/catalog/src/cli/export-rekordbox-xml.ts`
- `packages/catalog/src/cli/export-traktor-nml.ts`

Current commands:

- `npm run catalog:save-rekordbox-device-target -- <playlist-ref> <folder-path> [name]`
- `npm run catalog:plan-rekordbox-device-export -- <playlist-ref> <execution-node-ref> [destination-storage-ref] [source-storage-ref] [transport] [note]`
- `npm run catalog:export-rekordbox-device -- <staging-root> [playlist-id ...]`
- `npm run catalog:export-rekordbox-device-target -- <playlist-ref>`
- `npm run catalog:prepare-rekordbox-pdb-plan -- <staging-root> [empty-reference-pdb] [populated-reference-pdb]`
- `npm run catalog:validate-rekordbox-device-export -- <staging-root>`
- `npm run catalog:export-rekordbox-xml -- <output-path> [playlist-id ...]`
- `npm run catalog:export-traktor-nml -- <output-path> [playlist-id ...]`

Current behavior:

- `catalog:save-rekordbox-device-target` persists a playlist-specific destination root for the traditional-device path
- `catalog:plan-rekordbox-device-export` chooses the best current media source from `track_residencies` and records an `export_execution_plans` row
- `catalog:export-rekordbox-device` stages a traditional-device export tree with:
  - `Contents/` media copies in deterministic artist/album/title layout
  - `PIONEER/rekordbox/dj-vault/DJ_VAULT_COLLECTION.xml` as an inspection mirror
  - `PIONEER/rekordbox/dj-vault/device-export-manifest.json` as the machine-readable copy/export plan
  - `PIONEER/rekordbox/dj-vault/playlists/*.m3u8` for quick sanity-checking playlist order
- `catalog:export-rekordbox-device-target` runs that same export directly against a saved playlist target
- `catalog:prepare-rekordbox-pdb-plan` compares local Deep Symmetry reference PDBs and emits `pdb-write-plan.json` for the staged export
- `catalog:validate-rekordbox-device-export` checks the staged manifest, media files, playlist references, and XML references
- exports the selected playlist tree, or all playlists when no IDs are passed
- includes referenced tracks only
- emits cue points, loops, and beat-grid markers from DJ Vault analysis tables
- records an `export_jobs` row for each completed export
- persists missing Rekordbox `TrackID` and Traktor `AUDIO_ID` values back into `tracks`

### Device-export caveat

The current `catalog:export-rekordbox-device` command is intentionally a strong staging layer, not full native media parity yet. It does **not** currently emit:

- `export.pdb`
- `ANLZ` analysis blobs

That gap is now explicit in the staged manifest so the next implementation tranche can close it without ambiguity.
