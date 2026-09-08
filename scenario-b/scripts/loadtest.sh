#!/usr/bin/env bash
# curl + xargs -P diye simple load generator. baiti kono package lage na.
# babohar: ./loadtest.sh <url> [concurrency] [seconds]
set -u

URL="${1:?usage: loadtest.sh <url> [concurrency] [seconds]}"
CONC="${2:-10}"
SECS="${3:-60}"
END=$(( $(date +%s) + SECS ))
export URL END

# ek ta worker: somoy sesh na howa porjonto request pathiye jay, sesh e count bole
worker() {
  n=0
  while [ "$(date +%s)" -lt "$END" ]; do
    curl -s -o /dev/null -H "X-Tenant: acme" "$URL"
    n=$((n + 1))
  done
  echo "$n"
}
export -f worker

echo "start : $URL"
echo "config: concurrency=$CONC duration=${SECS}s"

TOTAL=$(seq 1 "$CONC" | xargs -P "$CONC" -I{} bash -c 'worker' | awk '{s+=$1} END {print s}')

echo "done  : $TOTAL request in ${SECS}s  (~$(( TOTAL / SECS )) req/s client side)"
