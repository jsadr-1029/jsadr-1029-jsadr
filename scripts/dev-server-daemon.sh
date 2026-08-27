#!/bin/bash
# Daemon que mantiene vivo el dev server
cd /home/z/my-project

while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] iniciando next dev" >> /home/z/my-project/dev.log
    bun run next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    NEXT_PID=$!
    # esperar a que termine o se caiga
    wait $NEXT_PID
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] next dev terminado (exit $?), reintentando en 5s" >> /home/z/my-project/dev.log
  fi
  sleep 5
done
