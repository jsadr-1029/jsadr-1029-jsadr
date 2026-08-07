#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reemplaza rutas absolutas '/home/z/my-project/...' por rutas relativas al cwd
en todos los scripts qa-m0X-*.ts. También robustece la carga de .env en los
scripts que la hacen de forma frágil.

Estrategia:
  1. Para constantes tipo `const X = '/home/z/my-project/...'`:
     - Si la ruta apunta a .env → reemplazar por bloque robusto multi-candidato
     - Si la ruta apunta a cualquier otro archivo del repo → quitar prefijo
       (fs.readFileSync resuelve relativo a process.cwd())
  2. Para fs.readFileSync('/home/z/my-project/...') inline:
     - Mismo criterio
"""
import os
import re
import sys

QA_DIR = '/home/z/my-project/scripts'
ABS_PREFIX = '/home/z/my-project/'

# Patrón robusto para cargar .env (multi-candidato + fallback)
ENV_LOADER_BLOCK = """// Cargar .env (compatible con CI: el archivo .env puede no existir)
// Orden: variables ya presentes en process.env (CI) > .env local > .vercel/.env.production
const envCandidates = [
  `${process.cwd()}/.env`,
  `${process.cwd()}/.vercel/.env.production`,
  '/home/z/my-project/.env',
];
for (const envPath of envCandidates) {
  try {
    if (!fs.existsSync(envPath)) continue;
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }
    break;
  } catch (e) { /* continuar con el siguiente candidato */ }
}
if (!process.env.DATABASE_URL) {
  console.error('⚠️  DATABASE_URL no definida. En CI: el workflow carga .vercel/.env.production.');
  process.exit(1);
}"""

# Identifica los scripts que cargan .env con patrón frágil
FRAGILE_ENV_PATTERN = re.compile(
    r"// Cargar \.env\s*\n"
    r"const envContent = fs\.readFileSync\('[^']*\.env', 'utf8'\);\s*\n"
    r"for \(const line of envContent\.split\('\\\\n'\)\) \{[\s\S]*?\}\s*\n",
    re.MULTILINE,
)

def is_env_path(p):
    return p.rstrip("'").endswith('/.env') or p.rstrip("'").endswith('/.env.local')

def replace_env_loader(content, fname):
    """Reemplaza el bloque frágil de carga de .env por el bloque robusto."""
    # Buscar el patrón frágil exacto (varía ligeramente entre archivos)
    # Patrón genérico: cualquier bloque que lea '/.../.env' con readFileSync + loop
    patterns = [
        # Patrón M02-M08 (similar a M01 original)
        re.compile(
            r"// Cargar \.env\s*\n"
            r"const envContent = fs\.readFileSync\([^)]+\.env[^)]+\);\s*\n"
            r"for \(const line of envContent\.split\([^)]+\)\) \{\s*\n"
            r"\s*const m = line\.match\([^)]+\);\s*\n"
            r"\s*if \(m\) \{\s*\n"
            r"\s*let v = m\[2\];\s*\n"
            r"\s*if \(v\.startsWith\('\"'\) && v\.endsWith\('\"'\)\) v = v\.slice\(1, -1\);\s*\n"
            r"\s*if \(!process\.env\[m\[1\]\]\) process\.env\[m\[1\]\] = v;\s*\n"
            r"\s*\}\s*\n"
            r"\s*\}",
            re.MULTILINE,
        ),
    ]
    new_content = content
    replaced = False
    for pat in patterns:
        if pat.search(new_content):
            new_content = pat.sub(ENV_LOADER_BLOCK, new_content, count=1)
            replaced = True
            break
    return new_content, replaced


def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    
    content = original
    changes = 0
    
    # 1. Reemplazar el cargador de .env frágil si existe
    content, env_replaced = replace_env_loader(content, filepath)
    if env_replaced:
        changes += 1
        print(f'  ✓ Cargador de .env robustecido')
    
    # 2. Reemplazar rutas absolutas restantes
    # Caso A: const X = '/home/z/my-project/...';
    def replace_const(m):
        nonlocal changes
        prefix = m.group(1)  # `const X = '`
        path_part = m.group(2)  # lo que sigue después del prefijo
        # Si es .env, ya fue manejado arriba
        if path_part.rstrip("'").endswith('/.env'):
            return m.group(0)
        changes += 1
        return prefix + path_part  # quita /home/z/my-project/
    
    # Caso A: const X = '/home/z/my-project/...algo...'
    content = re.sub(
        r"(const\s+\w+\s*=\s*)'" + re.escape(ABS_PREFIX) + r"([^']+')",
        lambda m: m.group(1) + "'" + m.group(2),
        content,
    )
    
    # Caso B: fs.readFileSync('/home/z/my-project/...')
    # Reemplazar el primer argumento string
    def replace_readfile(m):
        nonlocal changes
        prefix = m.group(1)  # fs.readFileSync('
        path_part = m.group(2)
        if path_part.rstrip("'").endswith('/.env'):
            return m.group(0)
        changes += 1
        return prefix + path_part
    
    content = re.sub(
        r"(fs\.readFileSync\(\s*)'" + re.escape(ABS_PREFIX) + r"([^']+')",
        lambda m: m.group(1) + "'" + m.group(2),
        content,
    )
    
    # Caso C: arrays de rutas como `['/home/z/my-project/...', '/home/z/my-project/...']`
    # El patrón anterior ya los cubre porque está dentro de readFileSync
    
    # Caso D: rutas en strings sueltos (ej: `'/home/z/my-project/...'` en cualquier contexto)
    # Buscar cualquier otra ocurrencia literal
    remaining = content.count(ABS_PREFIX)
    if remaining > 0:
        # Reemplazar ocurrencias restantes (cuidadosamente)
        # Solo las que están dentro de strings
        def replace_any(m):
            nonlocal changes
            changes += 1
            return m.group(1) + m.group(2)
        content = re.sub(
            r"(['\"])" + re.escape(ABS_PREFIX) + r"([^'\"]+['\"])",
            lambda m: m.group(1) + m.group(2),
            content,
        )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        remaining_after = content.count(ABS_PREFIX)
        print(f'  ✓ {changes} reemplazos hechos, {remaining_after} rutas absolutas restantes')
        return True
    return False


def main():
    # Listar archivos qa-m0X-*.ts
    files = sorted([
        os.path.join(QA_DIR, f) for f in os.listdir(QA_DIR)
        if f.startswith('qa-m') and f.endswith('.ts')
    ])
    print(f'Procesando {len(files)} archivos...\n')
    
    changed = 0
    for fp in files:
        fname = os.path.basename(fp)
        # Saltar M01 (ya arreglado manualmente)
        if fname == 'qa-m01-auth.ts':
            print(f'{fname}: (skipped, ya arreglado manualmente)')
            continue
        print(f'{fname}:')
        if fix_file(fp):
            changed += 1
    
    print(f'\n{changed} archivos modificados.')
    
    # Verificación final: contar rutas absolutas restantes
    print('\nVerificación final:')
    total = 0
    for fp in files:
        with open(fp, 'r', encoding='utf-8') as f:
            c = f.read().count(ABS_PREFIX)
        if c > 0:
            print(f'  ⚠️  {os.path.basename(fp)}: {c} rutas absolutas restantes')
            total += c
    if total == 0:
        print('  ✅ 0 rutas absolutas hardcodeadas en todos los scripts QA.')
    else:
        print(f'  Total restantes: {total}')


if __name__ == '__main__':
    main()
