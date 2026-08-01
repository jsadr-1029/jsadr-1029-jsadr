#!/bin/bash
# Watchdog para next dev (cuando no hay build de producción)
cd /home/z/my-project
LOG=/tmp/next-dev.log

while true; do
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next/dist/bin/next" 2>/dev/null
  sleep 2

  NODE_OPTIONS="--max-old-space-size=768" setsid nohup node node_modules/next/dist/bin/next dev -p 3000 > $LOG 2>&1 < /dev/null &
  echo "[$(date '+%H:%M:%S')] Lanzado next dev (heap 768MB)"

  # Esperar 10s para que arranque
  sleep 10

  FAIL=0
  while true; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/login 2>/dev/null)
    if [ "$CODE" = "000" ]; then
      FAIL=$((FAIL+1))
      if [ $FAIL -ge 2 ]; then
        echo "[$(date '+%H:%M:%S')] ⚠ Caído (HTTP 000 x2). Reiniciando..."
        break
      fi
      sleep 3
    else
      FAIL=0
      sleep 20
    fi
  done
done
