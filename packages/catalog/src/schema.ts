export const catalogSchemaVersion = 1;

export const catalogSchemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_sec REAL NOT NULL,
  sample_rate_hz INTEGER,
  bitrate_kbps INTEGER,
  hash_sha256 TEXT NOT NULL UNIQUE,
  audio_format TEXT NOT NULL,
  modified_at TEXT,
  added_at TEXT NOT NULL,
  title TEXT NOT NULL,
  mix_name TEXT,
  album TEXT,
  label TEXT,
  catalog_no TEXT,
  year INTEGER,
  release_date TEXT,
  track_number INTEGER,
  disc_number INTEGER,
  isrc TEXT,
  source TEXT,
  source_url TEXT,
  bpm REAL,
  bpm_float REAL,
  key_display TEXT,
  key_camelot TEXT,
  key_open_key TEXT,
  key_estimated INTEGER NOT NULL DEFAULT 0,
  energy INTEGER,
  genre TEXT,
  color TEXT,
  rating INTEGER,
  comment TEXT,
  description TEXT,
  loudness_db REAL,
  peak_db REAL,
  analysis_source TEXT,
  analyzed_at TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TEXT,
  liked INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  traktor_collection_path_key TEXT,
  traktor_audio_id TEXT,
  rekordbox_track_id TEXT,
  rekordbox_location_uri TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_people (
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (track_id, role, position)
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_kind TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (track_id, tag_kind, position)
);

CREATE TABLE IF NOT EXISTS cue_points (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT NOT NULL,
  cue_index INTEGER,
  start_sec REAL NOT NULL,
  color TEXT,
  comment TEXT
);

CREATE TABLE IF NOT EXISTS loop_points (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name TEXT,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  loop_index INTEGER,
  active INTEGER NOT NULL DEFAULT 0,
  color TEXT
);

CREATE TABLE IF NOT EXISTS beat_grids (
  track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  anchor_sec REAL NOT NULL,
  bpm REAL NOT NULL,
  meter_numerator INTEGER,
  meter_denominator INTEGER,
  locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS beat_grid_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  bpm REAL NOT NULL,
  beat_number INTEGER
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT REFERENCES playlists(id) ON DELETE SET NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sort_mode TEXT
);

CREATE TABLE IF NOT EXISTS playlist_tags (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, position)
);

CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  note TEXT,
  transition_note TEXT,
  PRIMARY KEY (playlist_id, position)
);

CREATE TABLE IF NOT EXISTS playlist_export_targets (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  folder_path TEXT,
  PRIMARY KEY (playlist_id, target_kind)
);

CREATE TABLE IF NOT EXISTS smart_rule_groups (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  parent_group_id TEXT REFERENCES smart_rule_groups(id) ON DELETE CASCADE,
  op TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_rules (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES smart_rule_groups(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value_json TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dj_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event TEXT,
  target_duration_min INTEGER,
  vibe TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS set_tracks (
  dj_set_id TEXT NOT NULL REFERENCES dj_sets(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_order INTEGER NOT NULL,
  role TEXT,
  in_cue_id TEXT REFERENCES cue_points(id) ON DELETE SET NULL,
  out_cue_id TEXT REFERENCES cue_points(id) ON DELETE SET NULL,
  transition_method TEXT,
  transition_note TEXT,
  energy_delta INTEGER,
  PRIMARY KEY (dj_set_id, track_order)
);

CREATE TABLE IF NOT EXISTS metadata_provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_ref TEXT,
  confidence REAL,
  observed_at TEXT NOT NULL,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_path TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_path TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracks_hash_sha256 ON tracks(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_role ON track_people(role, name);
CREATE INDEX IF NOT EXISTS idx_track_tags_kind_value ON track_tags(tag_kind, value);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track_id ON playlist_items(track_id);
CREATE INDEX IF NOT EXISTS idx_set_tracks_track_id ON set_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_metadata_provenance_lookup ON metadata_provenance(entity_kind, entity_id, field_path);
`;
