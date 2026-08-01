#!/bin/bash
cd /home/z/my-project
export TZ=America/Bogota
exec npx next dev -p 3000 > /tmp/next-server.log 2>&1
