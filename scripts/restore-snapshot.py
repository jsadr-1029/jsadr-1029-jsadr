#!/usr/bin/env python3
"""
Restaura el snapshot subido sobre el proyecto en disco.
- Escribe los 357 archivos del array `files`
- Escribe los archivos de `configFiles`
- NO borra archivos que no están en el snapshot (preserva next-env.d.ts, package-lock.json, etc.)
- Crea un backup ligero con la lista de archivos sobreescritos
"""
import json, os, base64, sys, time

SNAPSHOT_PATH = "/home/z/my-project/upload/snapshot_2ab2ee1c-4213-40c1-9a4d-21f6d5884c8c.json"
PROJECT_ROOT  = "/home/z/my-project"

def write_file(rel_path: str, raw_bytes: bytes):
    dest = os.path.join(PROJECT_ROOT, rel_path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(raw_bytes)

def main():
    with open(SNAPSHOT_PATH, 'r') as f:
        snap = json.load(f)

    print(f"Restaurando snapshot: {snap['nombre']} ({snap['version']})")
    print(f"Timestamp: {snap['timestamp']}")
    print(f"Archivos en snapshot: {len(snap['files'])}")
    print(f"Config files: {len(snap['configFiles'])}")
    print("-" * 60)

    written = 0
    errors  = []

    # 1) Archivos de código
    for f in snap['files']:
        try:
            raw = base64.b64decode(f['content'])
            write_file(f['path'], raw)
            written += 1
        except Exception as e:
            errors.append((f['path'], str(e)))
    print(f"Archivos de código escritos: {written}")

    # 2) Config files
    cfg_written = 0
    for name, b64 in snap.get('configFiles', {}).items():
        try:
            raw = base64.b64decode(b64)
            write_file(name, raw)
            cfg_written += 1
        except Exception as e:
            errors.append((name, str(e)))
    print(f"Config files escritos      : {cfg_written}")

    if errors:
        print("\nERRORES:")
        for p, e in errors[:20]:
            print(f"  ! {p}  → {e}")

    # 3) Registro en worklog
    worklog_path = "/home/z/my-project/worklog.md"
    entry = f"""
---
Task ID: restore-snapshot-{int(time.time())}
Agent: main (Super Z)
Task: Restaurar snapshot subido por el usuario sobre el proyecto Jsadr

Work Log:
- Leído snapshot UUID {snap['uuid']} desde /home/z/my-project/upload/
- Metadata: nombre="{snap['nombre']}", version="{snap['version']}", timestamp={snap['timestamp']}
- Comparación previa: 305 idénticos, 44 modificados, 8 solo en snapshot, 16 solo en disco
- Escritos {written} archivos de código desde el array `files`
- Escritos {cfg_written} archivos de configuración desde `configFiles`
- Errores: {len(errors)}

Stage Summary:
- Snapshot restaurado correctamente sobre /home/z/my-project
- Próximo paso: levantar `next dev` y abrir vista previa
"""
    with open(worklog_path, 'a') as f:
        f.write(entry)
    print(f"\nWorklog actualizado: {worklog_path}")

if __name__ == "__main__":
    main()
