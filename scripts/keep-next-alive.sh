#!/bin/bash
cd /home/z/my-project
LOG=/tmp/next-prod.log

while true; do
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next/dist/bin/next" 2>/dev/null
  sleep 2

  NODE_OPTIONS="--max-old-space-size=512" setsid nohup node node_modules/next/dist/bin/next start -p 3000 > $LOG 2>&1 < /dev/null &
  echo "[$(date '+%H:%M:%S')] Lanzado next start"

  # Esperar 6s
  sleep 6

  FAIL=0
  while true; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/login 2>/dev/null)
    if [ "$CODE" = "000" ]; then
      FAIL=$((FAIL+1))
      if [ $FAIL -ge 2 ]; then
        echo "[$(date '+%H:%M:%S')] ⚠ Caído. Reiniciando..."
        break
      fi
      sleep 3
    else
      FAIL=0
      sleep 15
    fi
  done
done
