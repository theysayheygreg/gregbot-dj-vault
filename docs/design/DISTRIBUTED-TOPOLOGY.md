# DJ Vault — Distributed Topology

DJ Vault should not assume that:

- the database lives on the same machine as the media
- the export worker is the same machine as the media host
- the machine you are holding is the machine that owns the full library

That assumption is the real limit in current DJ prep tooling.

## Core Split

DJ Vault needs three independent concerns:

1. **Catalog truth**
   - SQLite database
   - canonical metadata
   - playlists, sets, provenance, job history

2. **Media residency**
   - where the physical audio bytes actually live
   - managed library roots
   - replicas, caches, and staging copies

3. **Export execution**
   - the machine that can physically build a USB, export folder, or sync drop
   - often not the same machine that owns the full library

## New Topology Model

The schema now has first-class topology tables for:

- `vault_nodes`
- `storage_locations`
- `track_residencies`
- `export_execution_plans`

This lets DJ Vault describe a real-world setup like:

- `Greg MacBook Pro` as a `media-host`
- `Mac mini` as a `catalog-primary` or `export-worker`
- `Basement NAS` as a `nas` storage location
- `Remote USB staging` as an export destination

## Why This Matters

The important product move is not just "export from another machine."

The stronger move is:

> the catalog can decide *where* a build should happen based on where the bytes are, where the target drive is, and what transport is available.

That opens the door to workflows like:

- library stays on a MacBook or NAS
- catalog stays on a Mac mini
- export plan targets a remote machine that has the destination USB attached
- transport uses `tailscale`, `ssh`, or another authenticated tunnel
- DJ Vault compiles the job, stages missing media, and executes the export remotely

## The Big Product Bet

This is the "nuclear bomb" product opportunity:

**remote physical export from distributed media.**

Meaning:

- your full library does not need to travel with you
- your database does not need to sit next to the drives
- your USB export can still be prepared where the destination device physically exists

That is much more interesting than "another local library manager."

## Near-Term Structure

The current scaffolding does not solve remote execution yet.

It does create the planning model needed to solve it cleanly:

- register nodes
- register storage locations
- record where tracks reside
- plan which node should execute an export

## Example

```text
Catalog primary:
- Mac mini

Media hosts:
- MacBook Pro with main library
- NAS with archive mirror

Export worker:
- Studio Mac mini with USB attached

Plan:
1. DJ Vault catalog lives on Mac mini
2. Track residency points at MacBook + NAS
3. Export execution plan selects Studio Mac mini
4. Missing media is staged remotely
5. USB build happens on the machine that has the USB physically attached
```

## Next Engineering Step

The next implementation step should be a transport-aware export planner that answers:

- can the selected node see the required media directly?
- if not, which residency should be pulled?
- what transport should be used?
- what staging path should receive the pulled files?
- can the export be completed without moving the full library?
