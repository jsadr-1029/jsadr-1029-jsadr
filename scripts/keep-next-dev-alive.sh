#!/bin/bash
# Watchdog para next dev (cuando no hay build de producción)
# IMPORTANTE: usar patrón ( setsid nohup ... & ) para reparentar a init (PID 1)
# Sin ese patrón, el proceso muere cuando el shell que lo lanzó termina.
cd /home/z/my-project
LOG=/tmp/next-dev.log

while true; do
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next/dist/bin/next" 2>/dev/null
  sleep 2

  # Patrón subshell + setsid + nohup: garantiza reparentado a init (PPID=1)
  ( setsid nohup env NODE_OPTIONS="--max-old-space-size=1024" node node_modules/next/dist/bin/next dev -p 3000 > $LOG 2>&1 < /dev/null & )
  echo "[$(date '+%H:%M:%S')] Lanzado next dev (heap 1024MB, reparentado a init)"

  # Esperar hasta 30s a que arranque y responda HTTP
  READY=0
  for i in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/login 2>/dev/null)
    if [ "$CODE" != "000" ] && [ -n "$CODE" ]; then
      echo "[$(date '+%H:%M:%S')] ✓ Server UP tras ${i}s (HTTP $CODE)"
      READY=1
      break
    fi
    sleep 1
  done
  if [ $READY -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] ⚠ No arrancó tras 30s. Reiniciando..."
    continue
  fi

  # Monitorear caídas
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
