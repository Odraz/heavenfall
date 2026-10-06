#!/bin/sh
# The M10 performance gate (M10 §2.3): the three benchmark runs, uncapped (median of 3) and capped
# (one run each), with a cool-down before every run (the laptop throttles when it heats up).
# Usage: sh scripts/bench-gate.sh [runs] [cooldown seconds]   (builds once first)
set -e
RUNS=${1:-3}
COOL=${2:-60}
npm run build > /dev/null
for args in "" "--map pearly-gates" "--map pearly-gates --view arcade"; do
  echo "=== uncapped $args"
  sleep "$COOL"
  node scripts/bench.mjs --uncapped --runs "$RUNS" --cooldown "$COOL" $args | grep -E "^(BENCH|MEDIAN|Warning|Note|Page)"
  echo "=== capped $args"
  sleep "$COOL"
  node scripts/bench.mjs $args | grep -E "^(BENCH|Warning|Page)"
done
