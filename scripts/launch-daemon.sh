#!/usr/bin/env bash
# =====================================================
# launch-daemon.sh — Patrón doble-fork para daemonizar
# -----------------------------------------------------
# Uso: bash scripts/launch-daemon.sh <script-a-ejecutar.sh>
# El proceso resultante queda reparentado a init (PID 1)
# y sobrevive al cierre de la sesión bash del agente.
# =====================================================

SCRIPT_TO_RUN="$1"
LOG_FILE="$2"

if [ -z "$SCRIPT_TO_RUN" ] || [ -z "$LOG_FILE" ]; then
  echo "Uso: $0 <script> <logfile>"
  exit 1
fi

cd /home/z/my-project

# Primer fork
(
  # setsid: nueva sesión, despegado del terminal
  setsid bash "$SCRIPT_TO_RUN" </dev/null >>"$LOG_FILE" 2>&1 &
  # El subshell termina inmediatamente, el hijo queda reparentado a init
) </dev/null >>"$LOG_FILE" 2>&1 &

# Esperar mínimamente para que el fork ocurra
sleep 1
echo "Daemon lanzado para $SCRIPT_TO_RUN -> $LOG_FILE"
