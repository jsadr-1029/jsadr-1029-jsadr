#!/usr/bin/env bash
# =====================================================
# SMART bootstrap: install Vercel auto-deploy workflow
# =====================================================
# Detecta automáticamente si el token GitHub actual tiene
# scope 'workflow'. Si lo tiene, instala el workflow. Si no,
# muestra instrucciones claras para regenerar el token.
#
# Uso:
#   ./scripts/bootstrap-vercel-workflow.sh
# =====================================================

set -euo pipefail
cd "$(dirname "$0")/.."

TEMPLATE="scripts/deploy-vercel.workflow.yml.template"
TARGET=".github/workflows/deploy-vercel.yml"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_ok()   { echo -e "${GREEN}✓${NC} $1"; }
print_warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }
print_err()  { echo -e "${RED}❌${NC} $1"; }

echo "═══════════════════════════════════════════════════════════════"
echo " Bootstrap — Vercel auto-deploy workflow"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Verify template exists
if [ ! -f "$TEMPLATE" ]; then
  print_err "Template no encontrado: $TEMPLATE"
  exit 1
fi
print_ok "Template encontrado: $TEMPLATE"

# 2. Extract GitHub token from git remote
REMOTE_URL=$(git config --get remote.origin.url)
if ! echo "$REMOTE_URL" | grep -q "github.com"; then
  print_err "El remote origin no apunta a GitHub: $REMOTE_URL"
  exit 1
fi

# Extract token from https://USER:TOKEN@github.com/...
GH_TOKEN=$(echo "$REMOTE_URL" | sed -n 's|https://[^:]*:\([^@]*\)@github\.com/.*|\1|p')
if [ -z "$GH_TOKEN" ]; then
  print_err "No se pudo extraer token del git remote (¿usa HTTPS con credenciales?)"
  exit 1
fi
print_ok "Token GitHub extraído del remote (${#GH_TOKEN} chars)"

# 3. Check token scopes via GitHub API
echo ""
echo "─── Verificando scopes del token ───"
SCOPES=$(curl -sI -H "Authorization: token $GH_TOKEN" https://api.github.com/user 2>&1 | grep -i "^x-oauth-scopes:" | tr -d '\r' | sed 's/^[Xx]-[Oo]auth-[Ss]copes:[[:space:]]*//I')
echo "   Scopes actuales: ${SCOPES:-ninguno}"

if ! echo "$SCOPES" | grep -qw "workflow"; then
  print_warn "El token NO tiene scope 'workflow'"
  echo ""
  echo "Para instalar el workflow necesitas regenerar el token:"
  echo ""
  echo "  1. Ir a https://github.com/settings/tokens"
  echo "  2. Click 'Generate new token (classic)'"
  echo "  3. Marcar scopes: ☑ repo  ☑ workflow"
  echo "  4. Click 'Generate token'"
  echo "  5. Copiar el token (ghp_...)"
  echo "  6. Actualizar el git remote:"
  echo ""
  echo "     git remote set-url origin https://jsadr-1029:<NUEVO_TOKEN>@github.com/jsadr-1029/jsadr-1029-jsadr.git"
  echo ""
  echo "  7. Volver a ejecutar este script:"
  echo ""
  echo "     ./scripts/bootstrap-vercel-workflow.sh"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " ALTERNATIVA — Crear el workflow vía GitHub web UI"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Si NO quieres regenerar el token, puedes crear el archivo"
  echo "manualmente en el navegador:"
  echo ""
  echo "  1. Ir a:"
  echo "     https://github.com/jsadr-1029/jsadr-1029-jsadr/new/main/.github/workflows"
  echo ""
  echo "  2. Nombre del archivo: deploy-vercel.yml"
  echo ""
  echo "  3. Pegar el contenido de:"
  echo "     scripts/deploy-vercel.workflow.yml.template"
  echo "     (cat scripts/deploy-vercel.workflow.yml.template | pbcopy)"
  echo ""
  echo "  4. Click 'Commit changes...'"
  echo ""
  exit 1
fi

print_ok "Token tiene scope 'workflow' — procediendo con la instalación"

# 4. Install workflow file
echo ""
echo "─── Instalando workflow ───"
mkdir -p .github/workflows
cp "$TEMPLATE" "$TARGET"
print_ok "Copiado: $TEMPLATE → $TARGET"

git add "$TARGET"
git commit -m "ci(vercel): auto-deploy workflow on push to main

Workflow triggers on push to main and on workflow_dispatch.
Uses secrets VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
to build and deploy to Vercel production via CLI.

If VERCEL_TOKEN is invalid (HTTP 403), rotate with:
  VERCEL_TOKEN_NEW=\"vcp_xxx\" node scripts/rotate-vercel-token.cjs"
print_ok "Commit creado"

# 5. Push to GitHub
echo ""
echo "─── Push a GitHub ───"
if git push origin main; then
  print_ok "Workflow pushed exitosamente"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " ✅ WORKFLOW INSTALADO"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Próximos pasos:"
  echo ""
  echo "  1. Ver el workflow en:"
  echo "     https://github.com/jsadr-1029/jsadr-1029-jsadr/actions"
  echo ""
  echo "  2. Si falla con HTTP 403 invalidToken, rotar el Vercel token:"
  echo "     VERCEL_TOKEN_NEW=\"vcp_xxx\" node scripts/rotate-vercel-token.cjs"
  echo ""
  echo "  3. Después de rotar, hacer un commit cualquiera y push:"
  echo "     git commit --allow-empty -m 'test: trigger vercel deploy' && git push"
  echo ""
  echo "  4. Ver el deployment en:"
  echo "     https://jsadr-1029-jsadr.vercel.app"
  echo ""
else
  print_err "Push fallido"
  exit 1
fi
