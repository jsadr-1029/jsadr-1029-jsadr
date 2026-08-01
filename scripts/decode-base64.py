"""
Decode all base64-encoded source files extracted from snapshot.
Walks src/ and decodes any file whose content looks like base64.
"""
import base64
import os
import re
from pathlib import Path

BASE = Path("/home/z/my-project/src")
# Also process prisma/schema.prisma if it was overwritten — but we skipped it, so it's fine.
# Also process any .ts/.tsx/.js/.json/.mjs/.css/.md files in /home/z/my-project root if they look base64.

BASE64_RE = re.compile(r'^[A-Za-z0-9+/=\s]+$')

def looks_base64(content: str) -> bool:
    # Heuristic: long content, mostly base64 chars, no obvious code keywords
    if len(content) < 50:
        return False
    stripped = content.strip()
    if not stripped:
        return False
    if not BASE64_RE.match(stripped):
        return False
    # Try to decode and see if the result looks like text
    try:
        decoded = base64.b64decode(stripped, validate=True)
        # Heuristic: most files in this project are utf-8 text
        decoded.decode("utf-8")
        return True
    except Exception:
        return False

count_decoded, count_skipped, count_failed = 0, 0, 0

# Walk src/
for path in BASE.rglob("*"):
    if not path.is_file():
        continue
    if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".json", ".mjs",
                                   ".css", ".md", ".html", ".prisma", ".env",
                                   ".yml", ".yaml", ".sh", ".txt"}:
        continue
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if not looks_base64(raw):
        count_skipped += 1
        continue
    try:
        decoded_bytes = base64.b64decode(raw.strip(), validate=True)
        decoded = decoded_bytes.decode("utf-8")
        path.write_text(decoded, encoding="utf-8")
        count_decoded += 1
    except Exception as e:
        print(f"FAIL {path}: {e}")
        count_failed += 1

# Also try prisma/schema.prisma (skip if already decoded)
prisma = Path("/home/z/my-project/prisma/schema.prisma")
if prisma.exists():
    try:
        raw = prisma.read_text(encoding="utf-8")
        if looks_base64(raw):
            decoded = base64.b64decode(raw.strip(), validate=True).decode("utf-8")
            prisma.write_text(decoded, encoding="utf-8")
            count_decoded += 1
            print("Decoded prisma/schema.prisma")
    except Exception as e:
        print(f"FAIL prisma/schema.prisma: {e}")

# Config files in root
for name in ["next.config.ts", "tailwind.config.ts", "postcss.config.mjs",
             "components.json", "eslint.config.mjs", "tsconfig.json",
             "Caddyfile", "vercel.json"]:
    p = Path("/home/z/my-project") / name
    if not p.exists():
        continue
    try:
        raw = p.read_text(encoding="utf-8")
        if looks_base64(raw):
            decoded = base64.b64decode(raw.strip(), validate=True).decode("utf-8")
            p.write_text(decoded, encoding="utf-8")
            count_decoded += 1
            print(f"Decoded {name}")
    except Exception as e:
        print(f"FAIL {name}: {e}")

# scripts/import-backup.ts is from previous session — check if it's base64
imp = Path("/home/z/my-project/scripts/import-backup.ts")
if imp.exists():
    try:
        raw = imp.read_text(encoding="utf-8")
        if looks_base64(raw):
            decoded = base64.b64decode(raw.strip(), validate=True).decode("utf-8")
            imp.write_text(decoded, encoding="utf-8")
            count_decoded += 1
            print("Decoded scripts/import-backup.ts")
    except Exception as e:
        print(f"FAIL scripts/import-backup.ts: {e}")

print(f"\n=== DECODE SUMMARY ===")
print(f"Decoded:  {count_decoded}")
print(f"Skipped:  {count_skipped}")
print(f"Failed:   {count_failed}")
