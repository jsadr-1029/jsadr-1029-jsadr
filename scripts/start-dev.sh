#!/bin/bash
cd /home/z/my-project
pkill -9 -f "next" 2>/dev/null
sleep 3
export DATABASE_URL="postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public"
export DIRECT_URL="postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public"
exec node /home/z/my-project/node_modules/.bin/next dev -H 0.0.0.0 -p 3000
