"""
Extract snapshot files to /home/z/my-project/
Snapshot format:
  { files: [{path, hash, size, content}], configFiles: {name: content, ...} }
"""
import json
import os
import sys
from pathlib import Path

SNAPSHOT = "/home/z/my-project/upload/snapshot_f37b856a-531e-46c6-9d27-11b391e0977f (3).json"
BASE     = Path("/home/z/my-project")

with open(SNAPSHOT, "r", encoding="utf-8") as f:
    snap = json.load(f)

ok, fail, skipped = 0, 0, 0
config_written, config_skipped = 0, 0

# 1. Source files
for item in snap["files"]:
    rel = item["path"]
    if rel.startswith("/"):
        rel = rel.lstrip("/")
    target = BASE / rel
    # Skip if outside base
    try:
        target.resolve().relative_to(BASE.resolve())
    except ValueError:
        print(f"SKIP out-of-base: {rel}")
        skipped += 1
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(target, "w", encoding="utf-8") as out:
            out.write(item["content"])
        ok += 1
    except Exception as e:
        print(f"FAIL {rel}: {e}")
        fail += 1

# 2. Config files (only if missing — let user keep existing tweaks)
KEEP_EXISTING = {"package.json", "tsconfig.json", "next.config.ts", "tailwind.config.ts",
                 "postcss.config.mjs", "components.json", "eslint.config.mjs",
                 "Caddyfile", "vercel.json"}
# prisma/schema.prisma already exists and was restored from backup; do not overwrite
KEEP_EXISTING.add("prisma/schema.prisma")

for name, content in snap["configFiles"].items():
    target = BASE / name
    if name in KEEP_EXISTING and target.exists():
        config_skipped += 1
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as out:
        out.write(content)
    config_written += 1

print(f"\n=== EXTRACTION SUMMARY ===")
print(f"Source files written:  {ok}")
print(f"Source files failed:   {fail}")
print(f"Source files skipped:  {skipped}")
print(f"Config files written:  {config_written}")
print(f"Config files skipped (existing): {config_skipped}")
print(f"Total in snapshot:     {len(snap['files'])} files + {len(snap['configFiles'])} configs")
