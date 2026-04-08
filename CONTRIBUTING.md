# Contributing

DJ Vault has two primary contribution lanes:

1. Product code
2. Research corpus and reverse-engineering notes

Both matter. Neither should drift away from evidence.

## Ground Rules

- Prefer small, defensible changes over sweeping speculative rewrites.
- Tie format and hardware claims back to an artifact, support page, package, release note, or inspection note.
- Keep downloaded proprietary artifacts out of git unless there is a specific, explicit reason to include them.
- Do not add cloud-service lock-in assumptions casually. Local-first is core to the project.
- Do not weaken the legal boundary around public artifacts and lawful reverse engineering.

## Repo Shape

- `apps/`: runnable software
- `packages/`: shared code and tooling
- `research/analysis/`: narrative findings
- `research/manifests/`: machine-readable inventories
- `research/corpus/`: extracted local notes and per-artifact observations

## Development

Install dependencies:

```bash
npm install
```

Verify the workspace:

```bash
npm run build
npm run check
```

Run the source collector:

```bash
npm run corpus:collect-sources
```

## Research Contributions

When adding or updating research notes:

- include the question
- include the evidence
- state the finding plainly
- state the design implication for DJ Vault
- list the open unknowns

If you add a collector, make it write dated output under `research/manifests/inventories/`.

## Pull Requests

- Say what changed.
- Say how you verified it.
- Say what remains uncertain.
