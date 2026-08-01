"""
Probe every API route under src/app/api and report HTTP status.
Run dev server first, then run this script.
"""
import http.client
import os
import re
import time
from pathlib import Path

API_ROOT = Path("/home/z/my-project/src/app/api")
HOST, PORT = "localhost", 3000

# Collect route paths. Each route.ts file represents an endpoint.
# Static routes: api/<segments...>/route.ts -> /api/<segments...>
# Dynamic routes: [id]/route.ts -> use a placeholder "1" for the probe
routes = []
for route_file in API_ROOT.rglob("route.ts"):
    rel = route_file.relative_to(API_ROOT).parent
    segments = []
    for part in rel.parts:
        if part.startswith("[") and part.endswith("]"):
            # Dynamic segment — use "1" as placeholder
            segments.append("1")
        else:
            segments.append(part)
    path = "/api/" + "/".join(segments) if segments else "/api"
    routes.append(path)

routes = sorted(set(routes))
print(f"Found {len(routes)} routes. Probing...")

ok, fail, slow = [], [], []
for path in routes:
    t0 = time.time()
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request("GET", path)
        resp = conn.getresponse()
        body = resp.read(200)
        elapsed = time.time() - t0
        if resp.status < 400:
            ok.append((path, resp.status, elapsed))
        else:
            fail.append((path, resp.status, elapsed, body[:120].decode("utf-8", "ignore")))
        conn.close()
    except Exception as e:
        fail.append((path, "ERR", time.time() - t0, str(e)[:120]))

print(f"\n✅ OK: {len(ok)}    ❌ FAIL: {len(fail)}")
print("\n=== FAILED ROUTES (first 30) ===")
for p, s, t, b in fail[:30]:
    print(f"  {s}  {p}  ({t:.2f}s)  {b}")
print(f"\n... and {max(0, len(fail)-30)} more failures" if len(fail) > 30 else "")
