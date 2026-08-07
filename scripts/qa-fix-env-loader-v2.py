#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reemplaza el cargador de .env frágil por string match exacto.
Más robusto que regex para código TypeScript con secuencias de escape.
"""
import os

QA_DIR = '/home/z/my-project/scripts'

FRAGILE = """const envContent = fs.readFileSync('.env', 'utf8');
for (const line of envContent.split('\\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}"""

ROBUST = """const envCandidates = [
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

def fix_file(filepath):
    fname = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if FRAGILE not in content:
        # Buscar variantes con indentación diferente
        if "readFileSync('.env'" in content:
            # Mostrar contexto para debug
            idx = content.index("readFileSync('.env'")
            snippet = content[max(0,idx-100):idx+400]
            print(f'  ⚠️  {fname}: patrón no matcheó. Contexto:')
            print('     ---')
            for line in snippet.split('\n')[:15]:
                print(f'     | {line}')
            print('     ---')
        return False
    
    new_content = content.replace(FRAGILE, ROBUST, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'  ✓ {fname}: cargador .env robustecido')
    return True


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
