#!/usr/bin/env bash
# =====================================================
# Bootstrap script: install the Vercel auto-deploy workflow
# =====================================================
# This script copies the workflow template to .github/workflows/
# and pushes it to GitHub.
#
# REQUIREMENT: Your GitHub token must have the 'workflow' scope.
# If it doesn't, regenerate it at:
#   https://github.com/settings/tokens
# Check the "workflow" checkbox alongside "repo", then update
# the git remote URL:
#
#   git remote set-url origin https://jsadr-1029:<NEW_TOKEN>@github.com/jsadr-1029/jsadr-1029-jsadr.git
#
# Then run this script.
# =====================================================

set -euo pipefail
cd "$(dirname "$0")/.."

TEMPLATE="scripts/deploy-vercel.workflow.yml.template"
TARGET=".github/workflows/deploy-vercel.yml"

if [ ! -f "$TEMPLATE" ]; then
  echo "❌ Template not found: $TEMPLATE"
  exit 1
fi

mkdir -p .github/workflows
cp "$TEMPLATE" "$TARGET"
echo "✓ Copied $TEMPLATE → $TARGET"

git add "$TARGET"
git commit -m "ci(vercel): add auto-deploy workflow on push to main

Workflow triggers on push to main and on workflow_dispatch.
Uses secrets VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
to build and deploy to Vercel production via CLI.

If VERCEL_TOKEN is invalid (HTTP 403), rotate with:
  VERCEL_TOKEN_NEW=\"vcp_xxx\" node scripts/rotate-vercel-token.cjs"

echo "✓ Commit created"
echo ""
echo "Pushing to GitHub..."
if git push origin main; then
  echo ""
  echo "✅ Workflow pushed successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Check the workflow run: https://github.com/jsadr-1029/jsadr-1029-jsadr/actions"
  echo "  2. If it fails with HTTP 403 invalidToken, rotate the Vercel token:"
  echo "     VERCEL_TOKEN_NEW=\"vcp_xxx\" node scripts/rotate-vercel-token.cjs"
  echo "  3. After rotation, the next push to main will deploy automatically."
else
  echo ""
  echo "❌ Push failed."
  echo "   If the error mentions 'workflow' scope, regenerate your GitHub token"
  echo "   with the 'workflow' scope at https://github.com/settings/tokens"
  echo "   Then update the git remote:"
  echo "     git remote set-url origin https://jsadr-1029:<NEW_TOKEN>@github.com/jsadr-1029/jsadr-1029-jsadr.git"
  echo "   And re-run this script."
  exit 1
fi
