#!/bin/bash
# deploy.sh — build locally, ship artifacts to server, restart PM2
# Usage: ./deploy.sh

set -e

SERVER="ubuntu@tendersdev.glasswing.in"
KEY="$HOME/Keys/glasswingdev1.pem"
APP_DIR="/opt/apps/gw_tenders_admin"

echo "▶ Pulling latest from git..."
git pull origin main

echo "▶ Building locally..."
npm run build

echo "▶ Uploading .next to server..."
rsync -az --delete -e "ssh -i $KEY" .next/ "$SERVER:$APP_DIR/.next/"

echo "▶ Syncing package.json and public assets..."
rsync -az -e "ssh -i $KEY" package.json "$SERVER:$APP_DIR/"
rsync -az --delete -e "ssh -i $KEY" public/ "$SERVER:$APP_DIR/public/" 2>/dev/null || true

# Ensure server's Next.js version matches the version used for the local build.
# A mismatch causes "Cannot read properties of undefined" crashes on startup.
LOCAL_NEXT=$(node -p "require('./node_modules/next/package.json').version")
echo "▶ Checking server Next.js version (local build used $LOCAL_NEXT)..."
ssh -i "$KEY" "$SERVER" "
  SERVER_NEXT=\$(node -p \"require('/opt/apps/gw_tenders_admin/node_modules/next/package.json').version\" 2>/dev/null || echo 'none')
  if [ \"\$SERVER_NEXT\" != \"$LOCAL_NEXT\" ]; then
    echo \"   Updating server Next.js: \$SERVER_NEXT → $LOCAL_NEXT\"
    cd /opt/apps/gw_tenders_admin && npm install next@$LOCAL_NEXT --prefer-offline --legacy-peer-deps 2>&1 | tail -3
  else
    echo \"   Server Next.js already at $LOCAL_NEXT — no update needed\"
  fi
"

echo "▶ Restarting app on server..."
ssh -i "$KEY" "$SERVER" "cd $APP_DIR && pm2 restart gw-tenders"

echo "✓ Deployed successfully."
