export const catalogSchemaVersion = 5;

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
  content_hash_sha256 TEXT,
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

CREATE TABLE IF NOT EXISTS external_playlist_links (
  vendor TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  parent_source_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (vendor, source_ref)
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

CREATE TABLE IF NOT EXISTS playback_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  venue TEXT,
  context TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS playback_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES playback_sessions(id) ON DELETE SET NULL,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at TEXT NOT NULL,
  position_in_session INTEGER,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  confidence REAL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS vault_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  machine_label TEXT,
  transport TEXT,
  address TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storage_locations (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES vault_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mount_path TEXT,
  path_prefix TEXT,
  is_managed_library INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 0,
  last_verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(node_id, name)
);

CREATE TABLE IF NOT EXISTS track_residencies (
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  storage_location_id TEXT NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
  residency_kind TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  status TEXT NOT NULL,
  verified_at TEXT,
  note TEXT,
  PRIMARY KEY (track_id, storage_location_id, residency_kind)
);

CREATE TABLE IF NOT EXISTS export_execution_plans (
  id TEXT PRIMARY KEY,
  export_job_id TEXT REFERENCES export_jobs(id) ON DELETE SET NULL,
  target_kind TEXT NOT NULL,
  execution_node_id TEXT NOT NULL REFERENCES vault_nodes(id) ON DELETE CASCADE,
  source_storage_location_id TEXT REFERENCES storage_locations(id) ON DELETE SET NULL,
  destination_storage_location_id TEXT REFERENCES storage_locations(id) ON DELETE SET NULL,
  requires_remote_access INTEGER NOT NULL DEFAULT 0,
  transport TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracks_hash_sha256 ON tracks(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_tracks_content_hash_sha256 ON tracks(content_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_role ON track_people(role, name);
CREATE INDEX IF NOT EXISTS idx_track_tags_kind_value ON track_tags(tag_kind, value);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track_id ON playlist_items(track_id);
CREATE INDEX IF NOT EXISTS idx_external_playlist_links_playlist_id ON external_playlist_links(playlist_id);
CREATE INDEX IF NOT EXISTS idx_set_tracks_track_id ON set_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_metadata_provenance_lookup ON metadata_provenance(entity_kind, entity_id, field_path);
CREATE INDEX IF NOT EXISTS idx_playback_events_track_id ON playback_events(track_id);
CREATE INDEX IF NOT EXISTS idx_playback_events_session_id ON playback_events(session_id);
CREATE INDEX IF NOT EXISTS idx_playback_events_played_at ON playback_events(played_at);
CREATE INDEX IF NOT EXISTS idx_storage_locations_node_id ON storage_locations(node_id);
CREATE INDEX IF NOT EXISTS idx_track_residencies_storage_location_id ON track_residencies(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_export_execution_plans_node_id ON export_execution_plans(execution_node_id);
`;
