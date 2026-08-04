#!/usr/bin/env bash
# =====================================================
# start-dev.sh — Inicia el dev server de Jsadr
# -----------------------------------------------------
# Uso:
#   bash scripts/start-dev.sh
#
# Este script inicia el next dev server con límites
# de memoria optimizados para el sandbox (3.9GB RAM).
# Se queda bloqueado hasta que el server muera.
# Si querés auto-restart, usar scripts/dev-watchdog.sh
# =====================================================

cd /home/z/my-project

# Limpiar cualquier proceso next previo
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 1

# Límites de memoria para evitar OOM kill del kernel
export NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=64"

echo "[$(date '+%H:%M:%S')] Iniciando Jsadr dev server..."
echo "  Puerto: 3000"
echo "  Bundler: webpack (más liviano que Turbopack)"
echo "  Heap limit: 1GB"
echo ""

exec node node_modules/.bin/next dev -p 3000 --webpack
