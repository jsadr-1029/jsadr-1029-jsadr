#!/usr/bin/env bash
# =====================================================
# dev-watchdog.sh — Mantiene el dev server vivo
# -----------------------------------------------------
# El sandbox tiene 3.9GB de RAM y Turbopack puede consumir
# 2.2GB+ durante la compilación, gatillando OOM kill y el
# error {"error":"sandbox is inactive"} desde el frontend.
#
# Solución:
#   1. Limitar heap de Node a 1GB
#   2. Usar webpack en lugar de Turbopack
#   3. Reiniciar automáticamente si el proceso muere
#
# Para que el proceso sobreviva al cierre de la sesión
# del agente, este script debe lanzarse con:
#   setsid bash scripts/dev-watchdog.sh </dev/null >dev.log 2>&1 &
#   disown
# =====================================================

cd /home/z/my-project

MAX_RESTARTS=20
RESTART_COUNT=0
SLEEP_BETWEEN=8

# Límites de memoria para evitar OOM kill
export NODE_OPTIONS="--max-old-space-size=768 --max-semi-space-size=32"

# Log directo al archivo (sin tee, que cuelga del process group)
exec >> /home/z/my-project/dev.log 2>&1

echo ""
echo "========================================================"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Watchdog iniciado"
echo "  Límite heap: 1GB | Bundler: webpack | Max reinicios: $MAX_RESTARTS"
echo "========================================================"

# Limpiar log previo para empezar limpio
: > /home/z/my-project/dev.log
echo "[$(date '+%H:%M:%S')] Watchdog iniciado — límite heap 1GB, webpack"

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  echo "[$(date '+%H:%M:%S')] Iniciando next dev (intento $((RESTART_COUNT+1))/$MAX_RESTARTS)..."

  # next-server se bloquea aquí hasta que muera
  node node_modules/.bin/next dev -p 3000 --webpack

  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] next dev terminó con código $EXIT_CODE"

  # 143 = SIGTERM, 130 = SIGINT → terminado externamente, no reiniciar
  if [ $EXIT_CODE -eq 143 ] || [ $EXIT_CODE -eq 130 ]; then
    echo "[$(date '+%H:%M:%S')] Terminado por señal externa. Saliendo."
    break
  fi

  RESTART_COUNT=$((RESTART_COUNT+1))
  echo "[$(date '+%H:%M:%S')] Esperando ${SLEEP_BETWEEN}s antes de reiniciar..."
  sleep $SLEEP_BETWEEN
done

echo "[$(date '+%H:%M:%S')] Watchdog terminado tras $RESTART_COUNT reinicios."
