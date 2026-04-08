# Prism Research Brief — DJ Vault UX & Competitive Landscape

> Deep research task for Prism. Target output: a markdown report that DJ Vault's architecture and UX decisions can draw from directly.

---

## Context

DJ Vault is a local-first DJ library organization tool. We've drafted the data model, architecture, and export mapping. What we don't have yet is a grounded view of **what the existing tools do well, what they do badly, and what's missing entirely**. This research fills that gap.

The goal is NOT a marketing roundup. The goal is an engineering/UX intelligence report that answers: *"If a DJ tried to use each of these tools for Greg's workflow, where exactly would they hit a wall?"*

Greg's workflow is: Beatport → iTunes → Traktor (home) → Rekordbox (gig prep) → USB → CDJs. He needs a canonical library, consistent metadata, and a clean set builder. He is specifically frustrated by iCloud symlinks, metadata drift between apps, and the laptop-free gig workflow.

---

## What I Need You to Find

### 1. Existing DJ Library Tools — deep dive

For each of these, find: feature set, metadata handling, playlist/set support, export capabilities, local-vs-cloud stance, active maintenance status, pricing, and user pain points pulled from real forum posts / reviews / subreddit threads.

**Tier 1 (must research deeply):**
- **Lexicon** (lexicondj.com) — the main competitor. What do users love? What do they complain about? Is it actively maintained?
- **Rekordbox** (Pioneer) — the industry-standard gig tool. Where does its library management fall short?
- **Traktor Pro** (Native Instruments) — Greg's home tool. What's the library UX story?
- **Mixed In Key** — metadata-first, library-weak. How does it integrate with other tools?

**Tier 2 (lighter research):**
- **DJoid**
- **Crates** (cratesapp.com)
- **Serato DJ Pro** library management
- **VirtualDJ** library management
- **djay Pro** (Algoriddim)

### 2. Metadata & Export Reality Check

Find real user reports on:
- **Metadata drift between Traktor and Rekordbox** — where does information get lost in transit?
- **iCloud symlink horror stories** — how widespread is this pain?
- **Cue point / beatgrid round-tripping** — what actually survives export/import?
- **Rating scale conversion** — how do tools handle the Traktor (0/51/102/153/204/255) vs Rekordbox (0..5) mismatch?
- **Playlist folder preservation** — do tools preserve nested folder structures on export?

### 3. Set Building Tools

DJ Vault treats sets as distinct from playlists (sequences with intent, not buckets). Find:
- **Tools that explicitly support set building** (with transition notes, roles, energy curves)
- **How DJs currently build sets without dedicated tools** (spreadsheets? notes in playlist comments? paper?)
- **Academic/professional set design workflows** — what do touring DJs actually do?

### 4. Tag Vocabulary & Energy Scales

- **What energy scales do existing tools use?** (0..10, 1..10, 0..100, 1..5?)
- **What mood / vibe / set-function tags are commonly adopted?** (Mixed In Key has "Energy Level", but what about mood?)
- **Is there a de facto standard taxonomy** or does everyone roll their own?

### 5. iCloud / Cloud Storage Failure Modes

- **Concrete examples** of cloud-synced music libraries breaking DJ workflows at gigs
- **Which apps** handle cloud storage well vs poorly
- **Industry consensus** on local-first for DJ libraries

### 6. USB / Gig Workflow

- **Rekordbox USB export** — what does it actually produce on disk?
- **CDJ compatibility requirements** — file formats, directory structure, metadata embedding
- **Pain points** with the current Rekordbox → USB → CDJ flow
- **Tools that streamline gig prep** (if any)

---

## Format of the Output

Post your findings as a structured markdown report. For each section:

1. **Finding** — what you learned (2-3 sentences)
2. **Evidence** — bullet list of sources (URLs, forum threads, documentation, reviews)
3. **Implication for DJ Vault** — how this shapes our design decisions

### Example format for a tool review:

```markdown
## Lexicon

**Finding:** Lexicon is the most comprehensive DJ library tool currently available, but users report [X] and [Y] as major pain points. It is actively maintained as of [date].

**Evidence:**
- [URL] — main feature page showing [relevant feature]
- [URL] — reddit thread with [N] upvotes complaining about [issue]
- [URL] — DJ Tech Tools review calling out [strength]
- [URL] — changelog showing last update was [date]

**Implication for DJ Vault:**
DJ Vault should [specific design decision] because Lexicon's approach to [X] creates [Y] problem. We can differentiate by [Z].
```

---

## What I Do NOT Want

- **Vague summaries** — "Lexicon is a popular DJ tool" is useless. Tell me what it does and doesn't do.
- **Library library library** — you found 40 libraries, great. I need the 5 that matter.
- **Hallucinated URLs** — every link you cite must be real. If you can't find a source, say so.
- **Generic "all DJ tools have metadata" statements** — I need the specifics of how each tool models and exports metadata.
- **Feature matrices** — those are table stakes. The insights are in the user complaints and the workflow gaps.

---

## Ideal Outcome

After reading your report, I should be able to:

1. **Make confident UX decisions** about which features to prioritize for DJ Vault's V1
2. **Identify the sharpest differentiator** — the one thing DJ Vault can do that no existing tool does well
3. **Avoid known landmines** — patterns that have hurt other tools
4. **Ground the architecture** in real workflow evidence, not guesses

Time budget: take as long as you need to get it right. Quality over speed. If you find something unexpected or contradictory, flag it explicitly — those are often the most interesting signals.

---

## When You're Done

Post the report to the main Discord channel as a reply in the DJ Vault thread. I will integrate it into `dj-vault/docs/reference/ux-research-2026-04-06.md` and reference it from the roadmap and backlog.
