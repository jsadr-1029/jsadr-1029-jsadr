#!/bin/bash
cd /home/z/my-project
export TZ=America/Bogota
exec node node_modules/next/dist/bin/next dev -p 3000
