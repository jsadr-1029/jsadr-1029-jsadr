#!/bin/bash
# Start Next.js dev server with proper env vars
cd /home/z/my-project

# Kill any existing dev servers
pkill -f "next dev" 2>/dev/null
sleep 2

# Force the Neon DATABASE_URL (override any stale shell env)
export DATABASE_URL="postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public"

# Start dev server in background
nohup npx next dev -p 3000 > /tmp/next-dev.log 2>&1 &
DEV_PID=$!
echo "Dev server started with PID $DEV_PID"

# Wait for it to be ready
for i in {1..30}; do
  if curl -s -o /dev/null -w "" http://localhost:3000/login 2>/dev/null; then
    if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login 2>/dev/null)" = "200" ]; then
      echo "Dev server is READY (attempt $i)"
      break
    fi
  fi
  sleep 2
done

# Final check
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login 2>/dev/null)
echo "Final HTTP: $HTTP_CODE"
echo "PID alive: $(ps -p $DEV_PID > /dev/null 2>&1 && echo YES || echo NO)"
