# AlphaTheta Archive Acquisition — 2026-04-08

The corpus now has a bounded archive-acquisition and static-inspection pass for current flagship AlphaTheta products.

## What Was Acquired

The first archive tranche targeted:

- `CDJ-3000`
- `XDJ-AZ`
- `OMNIS-DUO`
- `OPUS-QUAD`
- `DJM-A9`

The bounded archive selector pulled 5 archives, totaling 548,749,209 bytes:

- `XDJAZv124.zip`
- `XDJAZ1000exe.zip`
- `OMNISDUOv123.zip`
- `OMNISDUO1000exe.zip`
- `OPUSQUADv132.zip`

Artifacts are stored under:

- `research/corpus/alphatheta-archives/`

Machine-readable outputs:

- `research/manifests/inventories/alphatheta-acquisition-summary-archive-cdj-3000-xdj-az-omnis-duo-opus-quad-djm-a9-2026-04-08.json`
- `research/manifests/inventories/alphatheta-archive-inspection-summary-2026-04-08.json`

## Static Inspection Result

The inspection pass now records:

- local path
- byte size
- SHA-256
- ZIP payload entries

Useful early examples:

- `XDJAZv124.zip` contains `XDJAZv124.UPD`
- `OMNISDUOv123.zip` contains `OMNISDUOv123.UPD`
- `OPUSQUADv132.zip` contains `OPUSQUADv132.UPD`
- `OMNISDUO1000exe.zip` contains `OMNIS-DUO_1.000.exe` plus `Open Source Code Notice.pdf`

## Why This Matters

This is the first point where the corpus stops being a link index and starts being an artifact repository with verifiable local state. That unlocks:

- repeatable hash-based inspection
- archive payload comparison across versions
- selective unpacking and binary/string analysis
- grounded firmware/driver package timelines

## Next Move

- acquire one bounded firmware ZIP for `CDJ-3000` and `DJM-A9`, since they were not included in this first archive limit
- add unzip-to-staging plus extracted file manifests
- start string and binary-surface indexing on the `.UPD` payloads and Windows installers
