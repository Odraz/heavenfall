#!/bin/sh
# Two builds back to back (M10 gate §4, as bench.md's "M10 final"): alternating single uncapped runs,
# two each (A B A B), then one capped run each, with a cool-down before every run. Each directory is a
# checkout with its own built dist/ and node_modules; build A runs from A's scripts/bench.mjs, so an
# older checkout keeps its own benchmark.
# Usage: sh scripts/bench-ab.sh <dir A> <dir B> [bench args...]   (COOL=<seconds>, default 60)
set -e
A=$1
B=$2
shift 2
COOL=${COOL:-60}
for i in 1 2; do
  for d in "$A" "$B"; do
    echo "=== uncapped $d $*"
    sleep "$COOL"
    (cd "$d" && node scripts/bench.mjs --uncapped "$@") | grep -E "^(BENCH|Warning|Page)" || true
  done
done
for d in "$A" "$B"; do
  echo "=== capped $d $*"
  sleep "$COOL"
  (cd "$d" && node scripts/bench.mjs "$@") | grep -E "^(BENCH|Warning|Page)" || true
done
