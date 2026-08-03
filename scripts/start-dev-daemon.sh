#!/bin/bash
# Inicia next dev como daemon real (sobrevive al shell que lo lanzó)
cd /home/z/my-project

# Matar instancias previas
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2

# Lanzar como sesión nueva completamente independiente
LOG=/tmp/next-dev.log
: > "$LOG"

# setsid crea nueva sesión, & pone en background, < /dev/null desvincula stdin
setsid env NODE_OPTIONS="--max-old-space-size=1024" node node_modules/next/dist/bin/next dev -p 3000 >> "$LOG" 2>&1 < /dev/null &
PID=$!
disown $PID 2>/dev/null

echo "$PID" > /tmp/next-dev.pid
echo "Started next dev with PID: $PID"
echo "Log: $LOG"

# Esperar hasta 30s a que responda HTTP
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/login 2>/dev/null)
  if [ "$CODE" != "000" ] && [ -n "$CODE" ]; then
    echo "Server UP after ${i}s (HTTP $CODE on /login)"
    break
  fi
  sleep 1
done

# Verificación final
sleep 1
if ps -p $PID > /dev/null 2>&1; then
  echo "Process $PID still alive"
else
  echo "WARNING: Process $PID died. Last log lines:"
  tail -20 "$LOG"
fi
