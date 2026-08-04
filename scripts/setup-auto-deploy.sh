#!/usr/bin/env bash
# =====================================================
# SETUP-AUTO-DEPLOY — Punto de entrada único
# =====================================================
# Este script orquesta todo el flujo de reconexión
# Vercel-GitHub para auto-deploy:
#
#   1. Verifica prerrequisitos
#   2. Si se pasa VERCEL_TOKEN_NEW, rota el token
#   3. Si el token GitHub tiene scope 'workflow', instala el workflow
#   4. Si no, muestra instrucciones claras
#
# Uso:
#   Caso A — Solo instalar workflow (token Vercel ya rotado):
#     ./scripts/setup-auto-deploy.sh
#
#   Caso B — Rotar Vercel token + instalar workflow:
#     VERCEL_TOKEN_NEW="vcp_xxx" ./scripts/setup-auto-deploy.sh
#
#   Caso C — Solo rotar Vercel token (workflow ya instalado):
#     VERCEL_TOKEN_NEW="vcp_xxx" ./scripts/setup-auto-deploy.sh --rotate-only
#
# Salidas:
#   - Workflow instalado en .github/workflows/deploy-vercel.yml
#   - Token Vercel rotado en Neon, .env, Vercel env vars, GitHub secret
#   - Deploy de prueba disparado al hacer push
# =====================================================

set -euo pipefail
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_ok()   { echo -e "${GREEN}✓${NC} $1"; }
print_warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }
print_err()  { echo -e "${RED}❌${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ️ ${NC} $1"; }

ROTATE_ONLY=false
if [ "${1:-}" = "--rotate-only" ]; then
  ROTATE_ONLY=true
fi

echo "═══════════════════════════════════════════════════════════════"
echo " SETUP AUTO-DEPLOY — Vercel ↔ GitHub"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Modo: $([ "$ROTATE_ONLY" = "true" ] && echo 'solo rotar token' || echo 'completo')"
echo "Token Vercel nuevo: ${VERCEL_TOKEN_NEW:-(no proporcionado)}"
echo ""

# 1. Prerrequisitos
echo "─── 1) Verificando prerrequisitos ───"

# Node.js
if ! command -v node &>/dev/null; then
  print_err "Node.js no está instalado"
  exit 1
fi
print_ok "Node.js: $(node --version)"

# Git remote a GitHub
REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
if ! echo "$REMOTE_URL" | grep -q "github.com"; then
  print_err "git remote origin no apunta a GitHub"
  exit 1
fi
SAFE_REMOTE=$(echo "$REMOTE_URL" | sed 's|:[^@]*@|:***@|')
print_ok "Git remote: $SAFE_REMOTE"

# Workflow template existe
if [ ! -f "scripts/deploy-vercel.workflow.yml.template" ]; then
  print_err "Falta scripts/deploy-vercel.workflow.yml.template"
  exit 1
fi
print_ok "Workflow template presente"

# Scripts de rotación
if [ ! -f "scripts/rotate-vercel-token.cjs" ]; then
  print_err "Falta scripts/rotate-vercel-token.cjs"
  exit 1
fi
print_ok "Script de rotación presente"

# 2. Detectar scopes del token GitHub
echo ""
echo "─── 2) Scopes del token GitHub ───"
GH_TOKEN=$(echo "$REMOTE_URL" | sed -n 's|https://[^:]*:\([^@]*\)@github\.com/.*|\1|p')
SCOPES=$(curl -sI -H "Authorization: token $GH_TOKEN" https://api.github.com/user 2>&1 | grep -i "^x-oauth-scopes:" | tr -d '\r' | sed 's/^[Xx]-[Oo]auth-[Ss]copes:[[:space:]]*//I')
echo "   Scopes: ${SCOPES:-ninguno}"

HAS_WORKFLOW_SCOPE=false
if echo "$SCOPES" | grep -qw "workflow"; then
  HAS_WORKFLOW_SCOPE=true
  print_ok "Scope 'workflow' presente"
else
  print_warn "Scope 'workflow' AUSENTE — no se puede instalar workflow automáticamente"
fi

# 3. Rotar Vercel token si se proporcionó
if [ -n "${VERCEL_TOKEN_NEW:-}" ]; then
  echo ""
  echo "─── 3) Rotar Vercel token ───"
  if [ "${VERCEL_TOKEN_NEW#vcp_}" = "${VERCEL_TOKEN_NEW}" ]; then
    print_warn "El token no empieza con 'vcp_' — puede ser inválido"
  fi
  if node scripts/rotate-vercel-token.cjs; then
    print_ok "Token rotado exitosamente en todos los sitios"
  else
    print_err "Rotación fallida"
    exit 1
  fi
else
  echo ""
  print_info "No se proporcionó VERCEL_TOKEN_NEW — omitiendo rotación"
  echo "   (Si el token actual está expirado, genera uno nuevo en:"
  echo "    https://vercel.com/account/tokens)"
fi

# 4. Instalar workflow si el scope lo permite
if [ "$ROTATE_ONLY" = "true" ]; then
  echo ""
  print_info "Modo --rotate-only: omitiendo instalación del workflow"
  exit 0
fi

echo ""
echo "─── 4) Instalar workflow ───"

if [ "$HAS_WORKFLOW_SCOPE" = "true" ]; then
  # Instalar directamente
  mkdir -p .github/workflows
  cp scripts/deploy-vercel.workflow.yml.template .github/workflows/deploy-vercel.yml
  print_ok "Workflow copiado a .github/workflows/deploy-vercel.yml"

  git add .github/workflows/deploy-vercel.yml
  git commit -m "ci(vercel): auto-deploy workflow on push to main

Workflow triggers on push to main and on workflow_dispatch.
Uses secrets VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
to build and deploy to Vercel production via CLI."

  if git push origin main; then
    print_ok "Workflow pushed a GitHub"
  else
    print_err "Push fallido"
    exit 1
  fi
else
  # Sin scope workflow — no podemos instalar automáticamente
  print_warn "No se puede instalar el workflow automáticamente"
  echo ""
  echo "   Tienes 2 opciones:"
  echo ""
  echo "   Opción A — Regenerar token GitHub con scope 'workflow':"
  echo "     1. https://github.com/settings/tokens"
  echo "     2. Marcar: ☑ repo  ☑ workflow"
  echo "     3. Actualizar remote:"
  echo "        git remote set-url origin https://jsadr-1029:<NEW_TOKEN>@github.com/jsadr-1029/jsadr-1029-jsadr.git"
  echo "     4. Re-ejecutar:"
  echo "        ./scripts/setup-auto-deploy.sh"
  echo ""
  echo "   Opción B — Crear el workflow vía web UI:"
  echo "     1. https://github.com/jsadr-1029/jsadr-1029-jsadr/new/main/.github/workflows"
  echo "     2. Nombre: deploy-vercel.yml"
  echo "     3. Pegar contenido de: scripts/deploy-vercel.workflow.yml.template"
  echo "        (pbcopy < scripts/deploy-vercel.workflow.yml.template)"
  echo "     4. Commit changes"
  echo ""
  echo "   Después de instalar el workflow, verificar en:"
  echo "   https://github.com/jsadr-1029/jsadr-1029-jsadr/actions"
  echo ""
fi

# 5. Resumen final
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " RESUMEN"
echo "═══════════════════════════════════════════════════════════════"
if [ -n "${VERCEL_TOKEN_NEW:-}" ]; then
  print_ok "Vercel token rotado en Neon + .env + Vercel env vars + GitHub secret"
fi
if [ "$HAS_WORKFLOW_SCOPE" = "true" ] && [ "$ROTATE_ONLY" = "false" ]; then
  print_ok "Workflow instalado y pushed a GitHub"
  print_info "Próximo push a main desplegará automáticamente a Vercel"
elif [ "$ROTATE_ONLY" = "false" ]; then
  print_warn "Workflow NO instalado (falta scope 'workflow' o acción manual)"
fi
echo ""
echo "Diagnóstico completo:"
echo "  node scripts/check-vercel-github-integration.cjs"
echo ""
echo "Ver deployments:"
echo "  https://github.com/jsadr-1029/jsadr-1029-jsadr/actions"
echo "  https://vercel.com/jsadr-1029/jsadr-1029-jsadr/deployments"
