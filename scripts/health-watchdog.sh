#!/usr/bin/env bash
# =====================================================
# health-watchdog.sh — Health check HTTP + auto-restart
# -----------------------------------------------------
# Vigila que el dev server RESPONDA HTTP en :3000.
# Si falla 3 veces seguidas, mata y reinicia el proceso next.
# Debe ejecutarse con setsid/nohup para sobrevivir.
# =====================================================

cd /home/z/my-project

HEALTH_URL="http://localhost:3000/login"
FAIL_COUNT=0
MAX_FAILS=3
CHECK_INTERVAL=15

echo "[$(date '+%H:%M:%S')] Health watchdog iniciado (check cada ${CHECK_INTERVAL}s)"

while true; do
  # -m 5 = timeout 5s
  HTTP_CODE=$(curl -s -o /dev/null -m 5 -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
    FAIL_COUNT=0
    # echo "[$(date '+%H:%M:%S')] OK ($HTTP_CODE)"
  else
    FAIL_COUNT=$((FAIL_COUNT+1))
    echo "[$(date '+%H:%M:%S')] FAIL $FAIL_COUNT/$MAX_FAILS (HTTP=$HTTP_CODE)"

    if [ $FAIL_COUNT -ge $MAX_FAILS ]; then
      echo "[$(date '+%H:%M:%S')] Reiniciando next dev..."
      pkill -9 -f "next dev" 2>/dev/null
      pkill -9 -f "next-server" 2>/dev/null
      sleep 2
      FAIL_COUNT=0
      # El dev-watchdog.sh principal debería tomar el relevo
    fi
  fi

  sleep $CHECK_INTERVAL
done
