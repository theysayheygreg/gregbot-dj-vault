# DJ Vault — Data Model

> Canonical TypeScript interfaces for the core DJ Vault types.
> These are the authoritative shapes. Everything else (SQLite schema, export formats) derives from these.

---

## Track

```ts
type Track = {
  id: string;                 // DJ Vault UUID — never use Traktor/Rekordbox IDs as canonical

  file: {
    canonicalPath: string;    // physical managed file path
    fileName: string;
    extension: string;
    sizeBytes: number;
    durationSec: number;
    sampleRateHz?: number;
    bitrateKbps?: number;
    hashSha256: string;       // identity hardening + dedupe
    audioFormat: 'mp3' | 'aiff' | 'wav' | 'flac' | 'm4a' | string;
    modifiedAt?: string;
    addedAt: string;
  };

  identity: {
    title: string;
    artist: string[];
    remixer?: string[];
    mixName?: string;         // "Original Mix", "Extended Mix"
    album?: string;
    label?: string;
    catalogNo?: string;
    year?: number;
    releaseDate?: string;
    trackNumber?: number;
    discNumber?: number;
    isrc?: string;
    source?: string;          // Beatport / Bandcamp / Promo / Local
    sourceUrl?: string;
  };

  musical: {
    bpm?: number;
    bpmFloat?: number;
    keyDisplay?: string;      // canonical display: "8A" or "F#m"
    keyCamelot?: string;
    keyOpenKey?: string;
    keyEstimated?: boolean;
    energy?: number;          // 1..10, pick one scale and stick to it
    genre?: string;           // primary genre
    genres?: string[];        // multi-tag fallback
    moodTags: string[];       // deep, euphoric, dark, chunky
    setTags: string[];        // opener, builder, peak, reset, closer
    customTags: string[];     // freeform searchable tags
    color?: string;
    rating?: number;          // 0..5 stars internally
  };

  notes: {
    comment?: string;         // user-facing DJ notes
    description?: string;     // longer note if wanted
  };

  analysis: {
    cuePoints: CuePoint[];
    loops: LoopPoint[];
    beatGrid?: BeatGrid;
    loudnessDb?: number;
    peakDb?: number;
    analysisSource?: string;  // mixedinkey | rekordbox | traktor | internal
    analyzedAt?: string;
  };

  usage: {
    playCount?: number;
    lastPlayedAt?: string;
    liked?: boolean;
    hidden?: boolean;
    recency?: {
      addedDaysAgo?: number;
      playedDaysAgo?: number;
      recentSessionCount?: number;
      recencyBucket?: 'new' | 'hot' | 'cooling' | 'dormant' | 'never-played';
      mentalWeight?: 'front-of-mind' | 'active-option' | 'archive-pressure' | 'unknown';
      recencyScore?: number;
    };
  };

  links: {
    traktor?: {
      collectionPathKey?: string;
      audioId?: string;
    };
    rekordbox?: {
      trackId?: string;
      locationUri?: string;
    };
  };
};
```

Vendor library-state import now maps selected Rekordbox and Traktor cue/grid structures into this `analysis` block, not only track identity and playlists.

---

## Cue Points & Loops

```ts
type CuePoint = {
  id: string;
  name?: string;
  type: 'memory' | 'hotcue' | 'grid' | 'load' | 'fadein' | 'fadeout';
  index?: number;             // hot cue slot number if relevant
  startSec: number;
  color?: string;
  comment?: string;
};

type LoopPoint = {
  id: string;
  name?: string;
  startSec: number;
  endSec: number;
  index?: number;
  active?: boolean;
  color?: string;
};

type BeatGrid = {
  anchorSec: number;
  bpm: number;
  meterNumerator?: number;
  meterDenominator?: number;
  markers?: { startSec: number; bpm: number; beatNumber?: number }[];
  locked?: boolean;
};
```

---

## Playlists

Playlists are buckets with optional smart rules. They can be nested in folders.

```ts
type Playlist = {
  id: string;
  name: string;
  type: 'crate' | 'playlist' | 'smart' | 'set';
  parentId?: string;          // folder tree
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sortMode?: 'manual' | 'title' | 'artist' | 'bpm' | 'key' | 'energy' | 'dateAdded';
  items: PlaylistItem[];
  rules?: SmartRuleGroup;     // only for smart playlists
  exportTargets?: {
    traktor?: { enabled: boolean; name?: string; folderPath?: string };
    rekordbox?: { enabled: boolean; name?: string; folderPath?: string };
  };
  externalLinks?: {
    rekordbox?: { sourceRef: string };
    traktor?: { sourceRef: string };
  };
};

type PlaylistItem = {
  trackId: string;
  position: number;
  note?: string;
  transitionNote?: string;    // why this track belongs here / segue idea
};

type SmartRuleGroup = {
  op: 'and' | 'or';
  rules: (SmartRule | SmartRuleGroup)[];
};

type SmartRule = {
  field: string;              // bpm, keyCamelot, energy, genre, tags, rating
  operator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'in' | 'between';
  value: string | number | boolean | string[] | [number, number];
};
```

---

## DJ Sets

Sets are sequenced performances with intent. They extend playlists with role, transition method, and energy tracking.

```ts
type DJSet = {
  id: string;
  name: string;
  event?: string;
  targetDurationMin?: number;
  vibe?: string;
  tracks: SetTrack[];
};

type SetTrack = {
  trackId: string;
  order: number;
  role?: 'intro' | 'warmup' | 'builder' | 'peak' | 'breather' | 'closer';
  inCueId?: string;
  outCueId?: string;
  transitionToNext?: {
    method?: 'blend' | 'cut' | 'echo-out' | 'loop-roll' | 'drop-swap';
    note?: string;
    energyDelta?: number;
  };
};
```

**The distinction:** Playlists are dumb collections. Sets are sequences with intent. See [PILLARS.md](PILLARS.md#5-sets-are-not-playlists).

---

## Playback History

Playback history is a first-class source of truth for recency.

```ts
type PlaybackSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  sourceKind: string;         // dj-vault | rekordbox-history | traktor-history
  sourceRef?: string;
  venue?: string;
  context?: string;
  note?: string;
};

type PlaybackEvent = {
  id: string;
  sessionId?: string;
  trackId: string;
  playedAt: string;
  positionInSession?: number;
  sourceKind: string;
  sourceRef?: string;
  confidence?: number;
  note?: string;
};
```

---

## Identity Rules

- **Canonical identity** = DJ Vault UUID + `file.hashSha256`
- **Never** use Traktor `AUDIO_ID` or Rekordbox `TrackID` as canonical identity
- App-specific IDs live in `links.*` and are export-only
- Hash is the dedupe primitive — same hash = same track regardless of path or filename

---

## Rating Mapping

Internal scale: **0..5**

| DJ Vault | Traktor NML | Rekordbox XML |
|----------|-------------|---------------|
| 0 | 0 | 0 |
| 1 | 51 | 1 |
| 2 | 102 | 2 |
| 3 | 153 | 3 |
| 4 | 204 | 4 |
| 5 | 255 | 5 |
