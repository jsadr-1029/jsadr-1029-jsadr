#!/bin/bash
# Mantiene vivo el dev server de Next.js
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null; then
    echo "[$(date +%H:%M:%S)] (re)iniciando next dev..." >> /home/z/my-project/dev.log
    nohup bun run next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    echo $! > /home/z/my-project/dev.pid
  fi
  sleep 10
done
