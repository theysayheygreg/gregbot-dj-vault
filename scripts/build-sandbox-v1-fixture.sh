#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${1:-/Users/theysayheygreg/clawd/projects/dj-vault/tmp/sandbox-v1}"
SOURCE_POOL="$ROOT_DIR/source-pool"
VIEWS_DIR="$ROOT_DIR/views"
PLAYLISTS_DIR="$ROOT_DIR/playlists"
EXPECTED_DIR="$ROOT_DIR/expected"

required_files=(
  "$SOURCE_POOL/01-dare-soulwax.mp3"
  "$SOURCE_POOL/02-a-pain-that-im-used-to-jlc.mp3"
  "$SOURCE_POOL/03-le-disko-retouch.mp3"
  "$SOURCE_POOL/04-rocker-prydz-remix.mp3"
  "$SOURCE_POOL/05-no-more-conversations-mylo.mp3"
  "$SOURCE_POOL/06-zdarlight.mp3"
)

for file_path in "${required_files[@]}"; do
  if [[ ! -f "$file_path" ]]; then
    echo "Missing source pool file: $file_path" >&2
    echo "Hydrate the source pool before building the fixture." >&2
    exit 1
  fi
done

rm -rf "$VIEWS_DIR" "$PLAYLISTS_DIR" "$EXPECTED_DIR"
mkdir -p "$VIEWS_DIR" "$PLAYLISTS_DIR" "$EXPECTED_DIR"

rewrite_mp3() {
  local input_path="$1"
  local output_path="$2"
  local title="$3"
  local artist="$4"
  local album="$5"
  local year="$6"
  local genre="$7"
  local comment="$8"

  mkdir -p "$(dirname "$output_path")"

  ffmpeg -loglevel error -y \
    -i "$input_path" \
    -map 0:a:0 \
    -codec copy \
    -map_metadata -1 \
    -id3v2_version 3 \
    -write_id3v1 1 \
    -metadata title="$title" \
    -metadata artist="$artist" \
    -metadata album="$album" \
    -metadata date="$year" \
    -metadata genre="$genre" \
    -metadata comment="$comment" \
    "$output_path"
}

write_playlist() {
  local output_path="$1"
  shift

  mkdir -p "$(dirname "$output_path")"
  : > "$output_path"
  for entry in "$@"; do
    printf '%s\n' "$entry" >> "$output_path"
  done
}

CANONICAL_MUSIC="$VIEWS_DIR/canonical-embedded/music"
REKORDBOX_MUSIC="$VIEWS_DIR/rekordbox6-dirty/music"
TRAKTOR_MUSIC="$VIEWS_DIR/traktor-dirty/music"

rewrite_mp3 "$SOURCE_POOL/01-dare-soulwax.mp3" \
  "$CANONICAL_MUSIC/warmup/Gorillaz - Dare (Soulwax Remix).mp3" \
  "Dare (Soulwax Remix)" "Gorillaz" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical title style uses parentheses."
rewrite_mp3 "$SOURCE_POOL/02-a-pain-that-im-used-to-jlc.mp3" \
  "$CANONICAL_MUSIC/peak/Depeche Mode - A Pain That I'm Used To (Jacques Lu Cont Remix).mp3" \
  "A Pain That I'm Used To (Jacques Lu Cont Remix)" "Depeche Mode" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical reference version."
rewrite_mp3 "$SOURCE_POOL/03-le-disko-retouch.mp3" \
  "$CANONICAL_MUSIC/warmup/Shiny Toy Guns - Le Disko (Tommie Sunshine Brooklyn Fire Retouch).mp3" \
  "Le Disko (Tommie Sunshine Brooklyn Fire Retouch)" "Shiny Toy Guns" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical view fixes the Tommie spelling."
rewrite_mp3 "$SOURCE_POOL/04-rocker-prydz-remix.mp3" \
  "$CANONICAL_MUSIC/peak/Alter Ego - Rocker (Eric Prydz Remix).mp3" \
  "Rocker (Eric Prydz Remix)" "Alter Ego" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical peak-time version."
rewrite_mp3 "$SOURCE_POOL/05-no-more-conversations-mylo.mp3" \
  "$CANONICAL_MUSIC/curveballs/Freeform Five - No More Conversations (Mylo Remix).mp3" \
  "No More Conversations (Mylo Remix)" "Freeform Five" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical view treats this as a curveball utility."
rewrite_mp3 "$SOURCE_POOL/06-zdarlight.mp3" \
  "$CANONICAL_MUSIC/warmup/Digitalism - Zdarlight.mp3" \
  "Zdarlight" "Digitalism" "Sandbox V1 Canonical" "2006" "Electronic" "Canonical spelling without spaces."

rewrite_mp3 "$SOURCE_POOL/01-dare-soulwax.mp3" \
  "$REKORDBOX_MUSIC/warmup/Gorillaz - D.A.R.E. [Soulwax Remix].mp3" \
  "D.A.R.E. [Soulwax Remix]" "Gorillaz" "Ultra Electro" "2006" "Electronic" "Played @ Brooklyn opener 2024."
rewrite_mp3 "$SOURCE_POOL/01-dare-soulwax.mp3" \
  "$REKORDBOX_MUSIC/warmup/Gorillaz - Dare (Soulwax Club Copy).mp3" \
  "Dare (Soulwax Club Copy)" "Gorillaz" "Ultra Electro" "2006" "Electronic" "Duplicate path only for identity tests."
rewrite_mp3 "$SOURCE_POOL/02-a-pain-that-im-used-to-jlc.mp3" \
  "$REKORDBOX_MUSIC/peak/Depeche Mode - A Pain That I'm Used To [Jacques Lu Cont Remix].mp3" \
  "A Pain That I'm Used To [Jacques Lu Cont Remix]" "" "Ultra Electro" "2006" "Electronic" "Artist intentionally blank in Rekordbox dirty view."
rewrite_mp3 "$SOURCE_POOL/03-le-disko-retouch.mp3" \
  "$REKORDBOX_MUSIC/warmup/Shiny Toy Guns - Le Disko [Tommire Sunshine's Brooklyn Fire Retouch].mp3" \
  "Le Disko [Tommire Sunshine's Brooklyn Fire Retouch]" "Shiny Toy Guns" "Ultra Electro" "2006" "Electronic" "Filename typo preserved from legacy collection."
rewrite_mp3 "$SOURCE_POOL/04-rocker-prydz-remix.mp3" \
  "$REKORDBOX_MUSIC/peak/Alter Ego - Rocker [Eric Prydz Remix].mp3" \
  "Rocker [Eric Prydz Remix]" "Alter Ego" "Ultra Electro" "2006" "Electronic" "5-star peak tool in old USB lore."
rewrite_mp3 "$SOURCE_POOL/05-no-more-conversations-mylo.mp3" \
  "$REKORDBOX_MUSIC/curveballs/Freeform Five - No More Conversations [Mylo Remix].mp3" \
  "No More Conversations [Mylo Remix]" "Freeform Five" "" "2006" "Electronic" "Album intentionally blank in Rekordbox dirty view."
rewrite_mp3 "$SOURCE_POOL/06-zdarlight.mp3" \
  "$REKORDBOX_MUSIC/warmup/Digitalism - Zdarlight.mp3" \
  "Zdarlight" "Digitalism" "Ultra Electro" "2006" "Electronic" "Marked as a fresh add."

rewrite_mp3 "$SOURCE_POOL/01-dare-soulwax.mp3" \
  "$TRAKTOR_MUSIC/warmup/Gorillaz feat. Soulwax - Dare [Soulwax Remix].mp3" \
  "Dare [Soulwax Remix]" "Gorillaz feat. Soulwax" "Electro Folder" "2006" "Electronic" "Artist inflated by Traktor import habits."
rewrite_mp3 "$SOURCE_POOL/02-a-pain-that-im-used-to-jlc.mp3" \
  "$TRAKTOR_MUSIC/peak/Depeche Mode - A Pain That I'm Used To (Jacques Lu Cont Mix).mp3" \
  "A Pain That I'm Used To (Jacques Lu Cont Mix)" "Depeche Mode" "Electro Folder" "2006" "Electronic" "Shortened mix name in Traktor view."
rewrite_mp3 "$SOURCE_POOL/03-le-disko-retouch.mp3" \
  "$TRAKTOR_MUSIC/warmup/Shiny Toy Guns - Le Disko [Tommire Sunshine's Brooklyn Fire Retouch].mp3" \
  "Le Disko [Tommire Sunshine's Brooklyn Fire Retouch]" "Shiny Toy Guns" "Electro Folder" "2006" "Electronic" "Legacy typo kept on title and filename."
rewrite_mp3 "$SOURCE_POOL/04-rocker-prydz-remix.mp3" \
  "$TRAKTOR_MUSIC/peak/Alter Ego - Rocker (Eric Prydz Remix).mp3" \
  "Rocker (Eric Prydz Remix)" "Alter Ego" "Electro Folder" "2006" "Electronic" "Parentheses style already corrected here."
rewrite_mp3 "$SOURCE_POOL/05-no-more-conversations-mylo.mp3" \
  "$TRAKTOR_MUSIC/curveballs/Freeform Five - No More Conversations (Mylo Dub).mp3" \
  "No More Conversations (Mylo Dub)" "Freeform Five" "Electro Folder" "2006" "Electronic" "Title drifted to dub in Traktor view."
rewrite_mp3 "$SOURCE_POOL/06-zdarlight.mp3" \
  "$TRAKTOR_MUSIC/warmup/Unknown Artist - Zdar Light.mp3" \
  "Zdar Light" "" "Electro Folder" "2006" "Electronic" "Spacing drift and missing artist."
rewrite_mp3 "$SOURCE_POOL/06-zdarlight.mp3" \
  "$TRAKTOR_MUSIC/duplicates/Digitalism - Zdarlight (Alt Path).mp3" \
  "Zdarlight" "Digitalism" "Electro Folder" "2006" "Electronic" "Same audio, alternate path duplicate."

write_playlist "$PLAYLISTS_DIR/canonical-embedded/Warmup Tools.m3u8" \
  "../../views/canonical-embedded/music/warmup/Gorillaz - Dare (Soulwax Remix).mp3" \
  "../../views/canonical-embedded/music/warmup/Shiny Toy Guns - Le Disko (Tommie Sunshine Brooklyn Fire Retouch).mp3" \
  "../../views/canonical-embedded/music/warmup/Digitalism - Zdarlight.mp3"
write_playlist "$PLAYLISTS_DIR/canonical-embedded/Peak Pressure.m3u8" \
  "../../views/canonical-embedded/music/peak/Depeche Mode - A Pain That I'm Used To (Jacques Lu Cont Remix).mp3" \
  "../../views/canonical-embedded/music/peak/Alter Ego - Rocker (Eric Prydz Remix).mp3" \
  "../../views/canonical-embedded/music/curveballs/Freeform Five - No More Conversations (Mylo Remix).mp3"
write_playlist "$PLAYLISTS_DIR/canonical-embedded/Left Turns.m3u8" \
  "../../views/canonical-embedded/music/warmup/Digitalism - Zdarlight.mp3" \
  "../../views/canonical-embedded/music/curveballs/Freeform Five - No More Conversations (Mylo Remix).mp3" \
  "../../views/canonical-embedded/music/warmup/Gorillaz - Dare (Soulwax Remix).mp3"

write_playlist "$PLAYLISTS_DIR/rekordbox6-dirty/Warmup Tools.m3u8" \
  "../../views/rekordbox6-dirty/music/warmup/Gorillaz - Dare (Soulwax Club Copy).mp3" \
  "../../views/rekordbox6-dirty/music/warmup/Shiny Toy Guns - Le Disko [Tommire Sunshine's Brooklyn Fire Retouch].mp3" \
  "../../views/rekordbox6-dirty/music/warmup/Digitalism - Zdarlight.mp3"
write_playlist "$PLAYLISTS_DIR/rekordbox6-dirty/Peak Pressure.m3u8" \
  "../../views/rekordbox6-dirty/music/peak/Depeche Mode - A Pain That I'm Used To [Jacques Lu Cont Remix].mp3" \
  "../../views/rekordbox6-dirty/music/peak/Alter Ego - Rocker [Eric Prydz Remix].mp3" \
  "../../views/rekordbox6-dirty/music/curveballs/Freeform Five - No More Conversations [Mylo Remix].mp3"
write_playlist "$PLAYLISTS_DIR/rekordbox6-dirty/Last Session.m3u8" \
  "../../views/rekordbox6-dirty/music/peak/Alter Ego - Rocker [Eric Prydz Remix].mp3" \
  "../../views/rekordbox6-dirty/music/curveballs/Freeform Five - No More Conversations [Mylo Remix].mp3"

write_playlist "$PLAYLISTS_DIR/traktor-dirty/Warmup Tools.m3u8" \
  "../../views/traktor-dirty/music/warmup/Unknown Artist - Zdar Light.mp3" \
  "../../views/traktor-dirty/music/warmup/Gorillaz feat. Soulwax - Dare [Soulwax Remix].mp3" \
  "../../views/traktor-dirty/music/warmup/Shiny Toy Guns - Le Disko [Tommire Sunshine's Brooklyn Fire Retouch].mp3"
write_playlist "$PLAYLISTS_DIR/traktor-dirty/Peak Pressure.m3u8" \
  "../../views/traktor-dirty/music/peak/Depeche Mode - A Pain That I'm Used To (Jacques Lu Cont Mix).mp3" \
  "../../views/traktor-dirty/music/peak/Alter Ego - Rocker (Eric Prydz Remix).mp3" \
  "../../views/traktor-dirty/music/curveballs/Freeform Five - No More Conversations (Mylo Dub).mp3"
write_playlist "$PLAYLISTS_DIR/traktor-dirty/Dubious Duplicates.m3u8" \
  "../../views/traktor-dirty/music/warmup/Unknown Artist - Zdar Light.mp3" \
  "../../views/traktor-dirty/music/duplicates/Digitalism - Zdarlight (Alt Path).mp3"

cat > "$EXPECTED_DIR/canonical-truth.tsv" <<'EOF'
slug	expected_title	expected_artist	expected_album	expected_notes
dare	Dare (Soulwax Remix)	Gorillaz	Sandbox V1 Canonical	Resolve bracket style and reject duplicate club-copy suffix.
a-pain	A Pain That I'm Used To (Jacques Lu Cont Remix)	Depeche Mode	Sandbox V1 Canonical	Fill missing artist from Rekordbox dirty view.
le-disko	Le Disko (Tommie Sunshine Brooklyn Fire Retouch)	Shiny Toy Guns	Sandbox V1 Canonical	Fix the Tommie spelling and normalize brackets.
rocker	Rocker (Eric Prydz Remix)	Alter Ego	Sandbox V1 Canonical	Accept either bracket or parentheses style as same work.
no-more-conversations	No More Conversations (Mylo Remix)	Freeform Five	Sandbox V1 Canonical	Reject Traktor dub drift.
zdarlight	Zdarlight	Digitalism	Sandbox V1 Canonical	Merge Zdar Light spacing drift and alternate duplicate path.
EOF

{
  echo "fixture_root=$ROOT_DIR"
  echo "generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "view_file_count=$(find "$VIEWS_DIR" -type f -iname '*.mp3' | wc -l | tr -d ' ')"
  echo "playlist_count=$(find "$PLAYLISTS_DIR" -type f -iname '*.m3u8' | wc -l | tr -d ' ')"
} > "$EXPECTED_DIR/fixture-summary.env"

echo "Built sandbox fixture at $ROOT_DIR"
printf 'mp3_files=%s\n' "$(find "$VIEWS_DIR" -type f -iname '*.mp3' | wc -l | tr -d ' ')"
printf 'playlists=%s\n' "$(find "$PLAYLISTS_DIR" -type f -iname '*.m3u8' | wc -l | tr -d ' ')"
