"""
Probe every API route with a 1-second delay between requests to avoid rate limit.
"""
import http.client
import os
import time
from pathlib import Path

API_ROOT = Path("/home/z/my-project/src/app/api")
HOST, PORT = "localhost", 3000

routes = []
for route_file in API_ROOT.rglob("route.ts"):
    rel = route_file.relative_to(API_ROOT).parent
    segments = []
    for part in rel.parts:
        if part.startswith("[") and part.endswith("]"):
            segments.append("1")
        else:
            segments.append(part)
    path = "/api/" + "/".join(segments) if segments else "/api"
    routes.append(path)

routes = sorted(set(routes))
print(f"Found {len(routes)} routes. Probing with 1s delay...")

ok, client_errors, server_errors = [], [], []
for i, path in enumerate(routes):
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=15)
        conn.request("GET", path)
        resp = conn.getresponse()
        body = resp.read(200)
        if resp.status < 400:
            ok.append((path, resp.status))
        elif resp.status < 500:
            client_errors.append((path, resp.status, body[:80].decode("utf-8", "ignore")))
        else:
            server_errors.append((path, resp.status, body[:200].decode("utf-8", "ignore")))
        conn.close()
    except Exception as e:
        server_errors.append((path, "ERR", str(e)[:80]))
    if i % 20 == 0:
        print(f"  ... {i+1}/{len(routes)}")
    time.sleep(1.0)

print(f"\n✅ OK (2xx/3xx): {len(ok)}")
print(f"⚠️  Client errors (4xx, mostly expected): {len(client_errors)}")
print(f"❌ Server errors (5xx, real bugs): {len(server_errors)}")

print("\n=== SERVER ERRORS ===")
for p, s, b in server_errors:
    print(f"  {s}  {p}")
    print(f"      {b}")
