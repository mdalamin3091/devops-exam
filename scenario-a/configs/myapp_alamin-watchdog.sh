#!/usr/bin/env bash
# /healthz check kore. jodi jobab na dey, service restart kore dey.
# Restart=on-failure eita dhorte pare na, karon process ta mare na.

curl -sf --max-time 5 http://127.0.0.1:30101/healthz >/dev/null \
  || { logger -t myapp_alamin-watchdog "healthz FAILED -> restarting"; \
       systemctl restart myapp_alamin; }
