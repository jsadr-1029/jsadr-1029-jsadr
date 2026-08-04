#!/usr/bin/env bash
# =====================================================
# dev-watchdog.sh — Mantiene el dev server vivo
# -----------------------------------------------------
# RCA (2026-08-04): el error {"error":"sandbox is inactive"} era
# causado por un bucle de auto-restart de Next.js 16: cuando
# used_heap_size > 0.8 * heap_size_limit, Next invoca
# process.exit(RESTART_EXIT_CODE=77) AL FINAL DE CADA REQUEST.
# Con --max-old-space-size=768, el umbral era 614MB, y compilar
# la ruta "/" (que importa 34 vistas estáticamente) lo superaba.
#
# Solución basada en evidencia:
#   1. Subir heap a 2048MB (umbral Next 80% = 1638MB, holgada
#      para compilar la ruta "/" sin auto-restart).
#      El cgroup tiene 4GB, RSS pico observado = 948MB.
#   2. Usar Turbopack (default en Next 16): compila 5-10x más
#      rápido y consume MENOS memoria que webpack por request.
#      El flag --webpack fue removido porque el comentario
#      "Turbopack consume 2.2GB" era de Next 14/15, ya obsoleto.
#   3. Code-splitting con next/dynamic en page.tsx para reducir
#      el heap del primer compile.
#   4. Reconocer exit code 77 como auto-restart gracefully
#      manejado por next dev padre (no es error fatal).
# =====================================================

cd /home/z/my-project

MAX_RESTARTS=20
RESTART_COUNT=0
SLEEP_BETWEEN=8

# Heap elevado a 2GB: el cgroup tiene 4GB y RSS pico observado es 948MB.
# Esto deja el umbral de auto-restart de Next 16 en 1638MB, suficiente
# para compilar rutas complejas sin disparar RESTART_EXIT_CODE=77.
export NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=64"

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

  # next dev con Turbopack (default en Next 16, más rápido y eficiente en memoria que webpack).
  # NO usar --webpack: era un workaround para Next 14/15 donde Turbopack consumía 2.2GB.
  # En Next 16, Turbopack es estable y consume MENOS memoria que webpack.
  node node_modules/.bin/next dev -p 3000

  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] next dev terminó con código $EXIT_CODE"

  # 143 = SIGTERM, 130 = SIGINT → terminado externamente, no reiniciar
  if [ $EXIT_CODE -eq 143 ] || [ $EXIT_CODE -eq 130 ]; then
    echo "[$(date '+%H:%M:%S')] Terminado por señal externa. Saliendo."
    break
  fi
  # 77 = RESTART_EXIT_CODE de Next 16 (auto-restart por umbral de memoria).
  # Es manejado internamente por `next dev` padre que reinicia al hijo.
  # Si llega aquí, significa que el padre también murió, lo cual requiere investigación
  # pero no es necesariamente fatal. Continuamos con el ciclo de reinicio.
  if [ $EXIT_CODE -eq 77 ]; then
    echo "[$(date '+%H:%M:%S')] Auto-restart de Next 16 (code 77). El padre next dev murió, reiniciando..."
  fi

  RESTART_COUNT=$((RESTART_COUNT+1))
  echo "[$(date '+%H:%M:%S')] Esperando ${SLEEP_BETWEEN}s antes de reiniciar..."
  sleep $SLEEP_BETWEEN
done

echo "[$(date '+%H:%M:%S')] Watchdog terminado tras $RESTART_COUNT reinicios."
