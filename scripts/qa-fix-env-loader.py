#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reemplaza el cargador de .env frágil en qa-m02 a qa-m08 por el patrón robusto
multi-candidato (igual al de M01).
"""
import os
import re

QA_DIR = '/home/z/my-project/scripts'

# Patrón robusto (identico al de M01)
ROBUST_BLOCK = """// Cargar .env (compatible con CI: el archivo .env puede no existir)
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

# Patrón frágil: lee `.env` con readFileSync, sin fallback.
# Acepta variantes menores (comentarios, spacing, etc.)
FRAGILE_PATTERN = re.compile(
    r"// ─── Cargar \.env [^\n]*\n"
    r"const envContent = fs\.readFileSync\('\.env', 'utf8'\);\s*\n"
    r"for \(const line of envContent\.split\('\\\\n'\)\) \{\s*\n"
    r"\s*const m = line\.match\(/\^\(\[A-Z_\]\[A-Z0-9_\]\*\)=\(\.\*\)\$/\);\s*\n"
    r"\s*if \(m\) \{\s*\n"
    r"\s*let v = m\[2\];\s*\n"
    r"\s*if \(v\.startsWith\('\"'\) && v\.endsWith\('\"'\)\) v = v\.slice\(1, -1\);\s*\n"
    r"\s*if \(!process\.env\[m\[1\]\]\) process\.env\[m\[1\]\] = v;\s*\n"
    r"\s*\}\s*\n"
    r"\s*\}",
    re.MULTILINE,
)

# Variante más simple sin el commentario prefix
FRAGILE_PATTERN_2 = re.compile(
    r"const envContent = fs\.readFileSync\('\.env', 'utf8'\);\s*\n"
    r"for \(const line of envContent\.split\('\\\\n'\)\) \{\s*\n"
    r"\s*const m = line\.match\(/\^\(\[A-Z_\]\[A-Z0-9_\]\*\)=\(\.\*\)\$/\);\s*\n"
    r"\s*if \(m\) \{\s*\n"
    r"\s*let v = m\[2\];\s*\n"
    r"\s*if \(v\.startsWith\('\"'\) && v\.endsWith\('\"'\)\) v = v\.slice\(1, -1\);\s*\n"
    r"\s*if \(!process\.env\[m\[1\]\]\) process\.env\[m\[1\]\] = v;\s*\n"
    r"\s*\}\s*\n"
    r"\s*\}",
    re.MULTILINE,
)


def fix_file(filepath):
    fname = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pat in [FRAGILE_PATTERN, FRAGILE_PATTERN_2]:
        if pat.search(content):
            content = pat.sub(ROBUST_BLOCK, content, count=1)
            break
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✓ {fname}: cargador .env robustecido')
        return True
    else:
        # Verificar si aún tiene el patrón frágil simple
        if "readFileSync('.env'" in content:
            print(f'  ⚠️  {fname}: todavía tiene readFileSync(".env") pero no matcheó el patrón — revisar manualmente')
        return False


def main():
    files = sorted([
        os.path.join(QA_DIR, f) for f in os.listdir(QA_DIR)
        if f.startswith('qa-m') and f.endswith('.ts')
    ])
    print(f'Procesando {len(files)} archivos...\n')
    
    changed = 0
    for fp in files:
        if fix_file(fp):
            changed += 1
    
    print(f'\n{changed} archivos modificados.')


if __name__ == '__main__':
    main()
