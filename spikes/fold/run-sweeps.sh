#!/bin/bash
# WP0a SPIKE (throwaway): runs the heavy sweeps in parallel shards.
cd "$(dirname "$0")/../.."
S=${SHARDS:-5}
for kind in "$@"; do
  for ((i=0;i<S;i++)); do
    npx vite-node spikes/fold/tests/sweep.ts $kind $i $S spikes/fold/results/$kind-$i.json &
  done
  wait
done
echo ALLDONE
