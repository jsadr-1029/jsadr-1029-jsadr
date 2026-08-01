#!/bin/bash
# Watchdog persistente para next dev
cd /home/z/my-project
LOG=/tmp/next-dev.log

# Matar instancias previas
pkill -9 -f "next/dist/bin/next" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2

while true; do
  # Lanzar sin DATABASE_URL heredada (dotenv la carga desde .env)
  env -u DATABASE_URL -u NO_COLOR \
    NODE_OPTIONS="--max-old-space-size=768" \
    node node_modules/next/dist/bin/next dev -p 3000 > $LOG 2>&1 &
  PID=$!
  echo "[$(date '+%H:%M:%S')] next dev lanzado (PID $PID)"

  # Esperar 8s para que arranque
  sleep 8

  # Monitorear: si el proceso muere, reiniciar
  while kill -0 $PID 2>/dev/null; do
    sleep 5
  done

  echo "[$(date '+%H:%M:%S')] next dev murió (PID $PID), reiniciando en 3s..."
  sleep 3
done
