#!/usr/bin/env python3
"""Detach Next.js dev server using double-fork."""
import os
import sys
import signal
import subprocess

# Allow port 3000 to be reused
os.environ['PORT'] = '3000'

# First fork
pid = os.fork()
if pid > 0:
    print(f"Parent exiting, child PID={pid}")
    sys.exit(0)

# Decouple from parent environment
os.setsid()

# Ignore signals
signal.signal(signal.SIGHUP, signal.SIG_IGN)

# Second fork
pid = os.fork()
if pid > 0:
    sys.exit(0)

# Now we're the daemon
# Redirect std streams to a log file
log_file = open('/home/z/my-project/dev-server.log', 'w')
sys.stdout = log_file
sys.stderr = log_file

# Exec the dev server
os.chdir('/home/z/my-project')
os.execvp('npx', ['npx', 'next', 'dev', '-p', '3000'])
