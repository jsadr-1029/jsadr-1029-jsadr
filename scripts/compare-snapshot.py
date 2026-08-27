#!/usr/bin/env python3
"""
Compara el snapshot subido con el estado actual del proyecto en disco.
Reporta:
  - Archivos solo en el snapshot (nuevos a restaurar)
  - Archivos solo en disco (serían eliminados o no están en el snapshot)
  - Archivos en ambos pero con contenido distinto (modificados)
  - Archivos idénticos
"""
import json, os, hashlib, base64, sys

SNAPSHOT_PATH = "/home/z/my-project/upload/snapshot_2ab2ee1c-4213-40c1-9a4d-21f6d5884c8c.json"
PROJECT_ROOT  = "/home/z/my-project"

EXCLUDE_DIRS = {
    'node_modules', '.next', '.git', 'download', 'db', 'scripts',
    'skills', 'tool-results', 'agent-ctx', 'examples', 'mini-services',
    'upload', '.turbo', 'tests'
}
EXCLUDE_FILES = {'.env', '.env.local', 'dev.log', 'bun.lock'}

def hash_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def list_project_files():
    files = set()
    for root, dirs, fnames in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fn in fnames:
            if fn in EXCLUDE_FILES:
                continue
            full = os.path.join(root, fn)
            rel  = os.path.relpath(full, PROJECT_ROOT)
            # only count code-ish files
            ext = os.path.splitext(fn)[1].lower()
            if ext in {'.ts','.tsx','.js','.jsx','.css','.json','.mjs','.prisma','.md'} or fn in {
                'package.json','tsconfig.json','next.config.ts','tailwind.config.ts',
                'postcss.config.mjs','components.json','eslint.config.mjs','Caddyfile','vercel.json'
            }:
                files.add(rel.replace(os.sep, '/'))
    return files

def main():
    with open(SNAPSHOT_PATH, 'r') as f:
        snap = json.load(f)

    snap_files = {f['path']: f for f in snap['files']}
    disk_files = list_project_files()

    only_snap   = sorted(set(snap_files) - set(disk_files))
    only_disk   = sorted(set(disk_files) - set(snap_files))
    in_both     = sorted(set(snap_files) & set(disk_files))

    modified = []
    identical = []
    for p in in_both:
        try:
            with open(os.path.join(PROJECT_ROOT, p), 'rb') as fh:
                disk_hash = hash_bytes(fh.read())
        except Exception as e:
            disk_hash = None
        snap_hash = snap_files[p]['hash']
        if disk_hash == snap_hash:
            identical.append(p)
        else:
            # también comparamos tamaños para distinguir cambios menores
            disk_size = os.path.getsize(os.path.join(PROJECT_ROOT, p))
            snap_size = snap_files[p]['size']
            modified.append({
                'path': p,
                'snap_size': snap_size,
                'disk_size': disk_size,
                'snap_hash': snap_hash[:12],
                'disk_hash': (disk_hash or '')[:12]
            })

    print("=" * 70)
    print("METADATA DEL SNAPSHOT")
    print("=" * 70)
    print(f"  UUID      : {snap.get('uuid')}")
    print(f"  Versión   : {snap.get('version')}")
    print(f"  Nombre    : {snap.get('nombre')}")
    print(f"  Proyecto  : {snap.get('proyecto')}")
    print(f"  Timestamp : {snap.get('timestamp')}")
    print(f"  Archivos  : {len(snap['files'])}")
    print()
    print("=" * 70)
    print("RESUMEN DE COMPARACIÓN")
    print("=" * 70)
    print(f"  Archivos en snapshot                : {len(snap_files)}")
    print(f"  Archivos en disco (mismo scope)     : {len(disk_files)}")
    print(f"  Idénticos (sin cambios)             : {len(identical)}")
    print(f"  Modificados (contenido distinto)    : {len(modified)}")
    print(f"  Solo en snapshot (nuevos/restaurar) : {len(only_snap)}")
    print(f"  Solo en disco (no en snapshot)      : {len(only_disk)}")
    print()

    if only_snap:
        print("=" * 70)
        print(f"SOLO EN SNAPSHOT ({len(only_snap)} archivos — se restaurarían como nuevos)")
        print("=" * 70)
        for p in only_snap[:80]:
            print(f"  + {p}  ({snap_files[p]['size']} bytes)")
        if len(only_snap) > 80:
            print(f"  ... y {len(only_snap)-80} más")
        print()

    if only_disk:
        print("=" * 70)
        print(f"SOLO EN DISCO ({len(only_disk)} archivos — no están en el snapshot)")
        print("=" * 70)
        for p in only_disk[:80]:
            print(f"  - {p}")
        if len(only_disk) > 80:
            print(f"  ... y {len(only_disk)-80} más")
        print()

    if modified:
        print("=" * 70)
        print(f"MODIFICADOS ({len(modified)} archivos — contenido distinto)")
        print("=" * 70)
        # ordenar por tamaño de cambio (diferencia absoluta)
        modified.sort(key=lambda x: abs(x['snap_size'] - x['disk_size']), reverse=True)
        for m in modified[:60]:
            delta = m['snap_size'] - m['disk_size']
            sign  = '+' if delta >= 0 else ''
            print(f"  ~ {m['path']}")
            print(f"      snap={m['snap_size']}B  disk={m['disk_size']}B  (Δ {sign}{delta}B)")
        if len(modified) > 60:
            print(f"  ... y {len(modified)-60} más")
        print()

    # Exportar JSON para uso posterior
    report = {
        "snapshot": {
            "uuid":      snap.get('uuid'),
            "version":   snap.get('version'),
            "nombre":    snap.get('nombre'),
            "proyecto":  snap.get('proyecto'),
            "timestamp": snap.get('timestamp'),
            "total_files": len(snap['files']),
        },
        "summary": {
            "total_in_snapshot":   len(snap_files),
            "total_on_disk":       len(disk_files),
            "identical":           len(identical),
            "modified":            len(modified),
            "only_in_snapshot":    len(only_snap),
            "only_on_disk":        len(only_disk),
        },
        "only_in_snapshot": only_snap,
        "only_on_disk":     only_disk,
        "modified":         modified,
        "identical_count":  len(identical),
    }
    out_path = "/home/z/my-project/scripts/snapshot-diff-report.json"
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Reporte JSON completo: {out_path}")

if __name__ == "__main__":
    main()
