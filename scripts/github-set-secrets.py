#!/usr/bin/env python3
"""Configura los 4 secrets necesarios en GitHub para el workflow de Vercel."""
import base64
import json
import os
import sys
import urllib.request
from urllib.error import HTTPError

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or open("/home/z/my-project/.env").read().split("GITHUB_TOKEN=")[1].split('"')[1]
REPO = "jsadr-1029/jsadr-1029-jsadr"
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}

# Secrets to set
# Valores tomados de variables de entorno (no hardcodear tokens en el script)
SECRETS = {
    "VERCEL_TOKEN": os.environ.get("VERCEL_TOKEN") or "",
    "VERCEL_ORG_ID": os.environ.get("VERCEL_ORG_ID") or "team_RgKIQ16ZqHOh3cpZ5WgzXtop",
    "VERCEL_PROJECT_ID": os.environ.get("VERCEL_PROJECT_ID") or "prj_JQV6HJQB65nmSEp45Z1FFPmxARtj",
    "DATABASE_URL": os.environ.get("DATABASE_URL") or "",
}

if not SECRETS["VERCEL_TOKEN"] or not SECRETS["DATABASE_URL"]:
    print("✗ Faltan VERCEL_TOKEN o DATABASE_URL en entorno")
    sys.exit(1)


def api(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, method=method, headers={**HEADERS, "Content-Type": "application/json"}, data=data)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except HTTPError as e:
        return e.code, e.read()


def get_public_key():
    status, body = api("GET", f"https://api.github.com/repos/{REPO}/actions/secrets/public-key")
    if status != 200:
        raise RuntimeError(f"public-key failed: {status} {body}")
    d = json.loads(body)
    return d["key_id"], d["key"]


def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    """Encrypt secret value with the repo's public key using PyNaCl (libsodium)."""
    try:
        from nacl import encoding, public
    except ImportError:
        # Install on the fly
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "pynacl"])
        from nacl import encoding, public

    pub = public.PublicKey(public_key_b64.encode(), encoding.Base64Encoder())
    box = public.SealedBox(pub)
    encrypted = box.encrypt(secret_value.encode())
    return base64.b64encode(encrypted).decode()


def set_secret(name, value, key_id, public_key_b64):
    encrypted = encrypt_secret(public_key_b64, value)
    body = {"encrypted_value": encrypted, "key_id": key_id}
    status, resp = api("PUT", f"https://api.github.com/repos/{REPO}/actions/secrets/{name}", body)
    return status


def main():
    print("Fetching repo public key...")
    key_id, pub = get_public_key()
    print(f"  key_id: {key_id}")
    print()
    for name, value in SECRETS.items():
        print(f"Setting {name}...", end=" ")
        status = set_secret(name, value, key_id, pub)
        if status in (201, 204):
            print(f"✓ ({status})")
        else:
            print(f"✗ ({status})")
    print()
    # Verify
    print("Verifying...")
    status, body = api("GET", f"https://api.github.com/repos/{REPO}/actions/secrets")
    if status == 200:
        d = json.loads(body)
        names = [s["name"] for s in d.get("secrets", [])]
        print(f"Secrets configured: {', '.join(names)}")


if __name__ == "__main__":
    main()
