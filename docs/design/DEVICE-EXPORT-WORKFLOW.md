# DJ Vault — Rekordbox Device Export Workflow

> The practical v1 path for preparing NXS2-era media exports from a distributed DJ Vault catalog.

---

## Goal

Produce a deterministic old-device export bundle even when:

- the catalog lives on one machine
- the canonical library lives on another machine
- the destination USB or staging drive is attached somewhere else

That is the product move. The export compiler is only part of it.

---

## Current Commands

```bash
npm run catalog:save-rekordbox-device-target -- <playlist-ref> <folder-path> [name]
npm run catalog:plan-rekordbox-device-export -- <playlist-ref> <execution-node-ref> [destination-storage-ref] [source-storage-ref] [transport] [note]
npm run catalog:export-rekordbox-device-target -- <playlist-ref>
npm run catalog:validate-rekordbox-device-export -- <export-root>
```

---

## Workflow Shape

1. Save a playlist export target.
2. Record where the relevant media physically lives.
3. Ask DJ Vault to plan the export.
4. Run the export into the saved target root.
5. Validate the staged bundle before touching hardware.

The saved target is per-playlist and lives in `playlist_export_targets`.

The execution plan lives in `export_execution_plans`.

The staged export itself is recorded in `export_jobs`.

---

## What Planning Currently Does

The planner resolves:

- the playlist and its descendant playlists
- all referenced tracks
- available `track_residencies`
- the best source storage with the highest ready coverage
- whether the chosen source or destination is remote from the execution node
- the likely transport (`local`, `tailscale`, `ssh`, `sneakernet`)

The planner is intentionally pragmatic, not magical. It does not yet move data. It picks the best source and records the plan so we can reason about remote USB prep with evidence instead of hand-waving.

---

## What Export Currently Produces

The current staged bundle includes:

- `Contents/` with copied media files
- `PIONEER/rekordbox/dj-vault/DJ_VAULT_COLLECTION.xml`
- `PIONEER/rekordbox/dj-vault/device-export-manifest.json`
- `PIONEER/rekordbox/dj-vault/playlists/*.m3u8`

This is deliberately stronger than “copy some files into a temp folder,” but it is not yet full native Rekordbox USB parity.

Still pending:

- `export.pdb`
- `ANLZ` analysis artifacts

Those gaps are explicit in the manifest and validation output.

---

## Acceptance Shape For V1

V1 is successful when DJ Vault can:

- choose the right physical source for the media
- stage the right files into a deterministic device-export bundle
- compile the traditional Rekordbox metadata needed by NXS2-era gear
- round-trip through one of Greg's owned devices without hidden manual cleanup

That is the line. Not flagship hardware coverage, not Device Library Plus, not every exotic vendor path.
