# Laptop Runtime Setup

The cleanest first real-world setup is:

- Keep `VaultBuddy` and the working SQLite catalog on the laptop that already has the real library.
- Treat the laptop as the canonical media host for now.
- Keep the Mac mini as a secondary research and export-validation box until we are ready to test remote execution across nodes on purpose.

That gives us the shortest path to useful testing. We avoid inventing sync problems before we have proven the library, metadata, and export loop on a real collection.

## First Pass On The Laptop

Clone the repo onto the laptop and install dependencies:

```bash
git clone https://github.com/theysayheygreg/gregbot-dj-vault.git
cd gregbot-dj-vault
npm install
```

Initialize a laptop-local catalog database:

```bash
npm run catalog:init
```

Ingest a real slice of the library first, not the whole thing. Start with one crate-sized folder so we can test metadata cleanup and export loops before we commit to a long ingest:

```bash
npm run catalog:ingest -- --library-root /absolute/path/to/VaultBuddyLibrary /absolute/path/to/real/music/folder
```

If you do not want DJ Vault copying files yet, omit `--library-root` and let the laptop point at the current music location while we test the workflow.

## Launch VaultBuddy Against The Laptop Catalog

The default runtime uses `data/dj-vault.sqlite` inside the repo:

```bash
npm run desktop:runtime
```

If you want the database somewhere else on the laptop, point the runtime at it explicitly:

```bash
DJ_VAULT_DB_PATH=/absolute/path/to/dj-vault.sqlite npm run desktop:runtime
```

That opens a local runtime at `http://localhost:4187`.

## Recommended Real-Library Test Sequence

1. Ingest 100-300 tracks from one folder you know well.
2. Use VaultBuddy to correct metadata on a few tracks with missing artist, BPM, or comments.
3. Build one playlist that mirrors a real crate you would actually take to a gig.
4. Save a Rekordbox device target for that playlist.
5. Run one staged export into a scratch folder before touching a real USB.
6. Compare the staged output against what Rekordbox 6 expects.

This is enough to expose the real problems without throwing thousands of tracks at an immature workflow.

## Topology Recommendation For The Next Step

Once the laptop-local setup feels stable, move to this split:

- Laptop: canonical media host and first operator surface
- Mac mini: secondary catalog node, research box, and future remote export worker
- External USB or staging folder: export destination

That is the moment to make `tailscale` or another transport first-class in daily use. Before that, we should prove the core library and export loop on one machine.
