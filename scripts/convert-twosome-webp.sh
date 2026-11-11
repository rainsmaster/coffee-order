#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 ORIGINAL_IMAGE_DIR WEBP_OUTPUT_DIR" >&2
  exit 1
fi

INPUT_DIR=$1
OUTPUT_DIR=$2

case "$INPUT_DIR" in
  ""|/|*..*)
    echo "Unsafe ORIGINAL_IMAGE_DIR: $INPUT_DIR" >&2
    exit 1
    ;;
esac

case "$OUTPUT_DIR" in
  ""|/|*..*)
    echo "Unsafe WEBP_OUTPUT_DIR: $OUTPUT_DIR" >&2
    exit 1
    ;;
esac

if [ ! -d "$INPUT_DIR" ]; then
  echo "Original image directory does not exist: $INPUT_DIR" >&2
  exit 1
fi

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
TEMP_FILE=
cleanup() {
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

CONVERTED=0
SKIPPED=0
ORIGINAL_BYTES=0
WEBP_BYTES=0

for SOURCE in "$INPUT_DIR"/*.jpg "$INPUT_DIR"/*.jpeg "$INPUT_DIR"/*.png; do
  if [ ! -f "$SOURCE" ]; then
    continue
  fi

  NAME=${SOURCE##*/}
  TARGET="$OUTPUT_DIR/$NAME.webp"
  if [ -f "$TARGET" ] && [ "$TARGET" -nt "$SOURCE" ]; then
    SKIPPED=$((SKIPPED + 1))
  else
    TEMP_FILE="$TARGET.tmp.$$"
    cwebp -quiet -q 82 -mt "$SOURCE" -o "$TEMP_FILE"
    if [ ! -s "$TEMP_FILE" ]; then
      echo "WebP conversion produced an empty file: $SOURCE" >&2
      exit 1
    fi
    mv "$TEMP_FILE" "$TARGET"
    TEMP_FILE=
    CONVERTED=$((CONVERTED + 1))
  fi

  SOURCE_SIZE=$(wc -c < "$SOURCE" | tr -d ' ')
  TARGET_SIZE=$(wc -c < "$TARGET" | tr -d ' ')
  ORIGINAL_BYTES=$((ORIGINAL_BYTES + SOURCE_SIZE))
  WEBP_BYTES=$((WEBP_BYTES + TARGET_SIZE))
done

if [ "$((CONVERTED + SKIPPED))" -eq 0 ]; then
  echo "No JPG, JPEG, or PNG images found: $INPUT_DIR" >&2
  exit 1
fi

printf 'WebP conversion completed: converted=%s skipped=%s original_bytes=%s webp_bytes=%s\n' \
  "$CONVERTED" "$SKIPPED" "$ORIGINAL_BYTES" "$WEBP_BYTES"
