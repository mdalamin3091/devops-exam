#!/usr/bin/env bash
# exit 0 = sob thik | 1 = kono service fail | 2 = config file nai

CONF="${1:-./checks.conf}"
LOG="/var/log/healthcheck_alamin.log"
LOCK="/tmp/healthcheck_alamin.lock"

GREEN=$'\e[32m'; RED=$'\e[31m'; YEL=$'\e[33m'; OFF=$'\e[0m'

# cron jodi ager copy cholte cholte notun ekta start kore, 2nd ta chup kore beriye jabe
exec 9>"$LOCK"
flock -n 9 || exit 0

log() { echo "$(date '+%F %T') | $*" >> "$LOG" 2>/dev/null; }

# -f na diye -r, karon file thakleo permission na thakle pora jabe na
if [ ! -r "$CONF" ]; then
  echo "${RED}ERROR: config file pora jachhe na: $CONF${OFF}"
  log "ERROR config unreadable: $CONF"
  exit 2
fi

FAIL=0
echo "===== healthcheck $(date '+%F %T') ====="

while IFS='|' read -r name url code; do
  [ -z "$name" ] && continue
  case "$name" in \#*) continue ;; esac

  name=$(echo "$name" | xargs); url=$(echo "$url" | xargs); code=$(echo "$code" | xargs)

  # --max-time 3 na dile DNS fail hole onek khon jhule thakto
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null)
  # curl fail korle kichui print kore na, tai khali string check
  [ -z "$got" ] && got="000"

  if [ "$got" = "$code" ]; then
    echo "  ${GREEN}[ OK ]${OFF} $name -> $got"
    log "OK   $name $url expected=$code got=$got"
  else
    echo "  ${RED}[FAIL]${OFF} $name -> got $got (expected $code)"
    log "FAIL $name $url expected=$code got=$got"
    FAIL=1
  fi
done < "$CONF"

USE=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "$USE" -gt 80 ]; then
  echo "  ${YEL}[WARN]${OFF} disk / is ${USE}% full"
  log "WARN disk / ${USE}%"
else
  echo "  ${GREEN}[ OK ]${OFF} disk / is ${USE}% full"
  log "OK   disk / ${USE}%"
fi

exit $FAIL
