#!/bin/bash
# Watchdog: mantiene el dev server de Next.js corriendo permanentemente
# Si el proceso muere, lo reinicia automáticamente

LOG=/home/z/my-project/dev.log
cd /home/z/my-project

while true; do
  if ! pgrep -f "next dev -p 3000" > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dev server down — reiniciando..." >> $LOG
    nohup npm run dev >> $LOG 2>&1 &
    sleep 10
  fi
  sleep 30
done
