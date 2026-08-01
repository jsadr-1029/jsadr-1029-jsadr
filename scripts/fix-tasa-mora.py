#!/usr/bin/env python3
"""
Reemplaza todos los usos de `prestamo.tasaMoraDiaria * 360` (y variantes)
por llamadas al helper `getTasaMoraAnual(prestamo)`. También añade el import
donde sea necesario.

Estrategia:
  - Pattern A: `prestamo.tasaMoraPersonalizada ?? prestamo.tasaMoraDiaria * 360`
    → `getTasaMoraAnual(prestamo)`
  - Pattern B: `<expr>.tasaMoraDiaria * 360` (con cualquier variable)
    → `getTasaMoraAnual(<expr>)`
  - Pattern C (en strings de template): `<expr>.tasaMoraDiaria * 360` dentro de ${...}
    → tricky, manejamos manualmente caso por caso si aparece

También añade el import `getTasaMoraAnual` a los archivos que lo necesiten.
"""

import re
import os
from pathlib import Path

BASE = Path('/home/z/my-project/src')

# Patrones de búsqueda/reemplazo (en orden de especificidad, más específicos primero)
PATTERNS = [
    # Pattern A: ?? * 360 (con variable `prestamo` o cualquier nombre)
    (re.compile(r'(\w+)\.tasaMoraPersonalizada\s*\?\?\s*\1\.tasaMoraDiaria\s*\*\s*360'),
     lambda m: f'getTasaMoraAnual({m.group(1)})'),
    # Pattern B: `x.tasaMoraDiaria * 360` (cualquier variable de un solo token)
    (re.compile(r'(\w+)\.tasaMoraDiaria\s*\*\s*360'),
     lambda m: f'getTasaMoraAnual({m.group(1)})'),
]

# Archivos a procesar (lista obtenida del grep anterior)
TARGET_FILES = [
    'lib/prestamo-codigo.ts',
    'lib/recalcular-saldos.ts',
    'app/api/prestamos/route.ts',
    'app/api/prestamos/[id]/route.ts',
    'app/api/prestamos/[id]/renovar/route.ts',
    'app/api/prestamos/[id]/aceptar-tyc-otp/route.ts',
    'app/api/prestamos/[id]/enviar-confirmacion/route.ts',
    'app/api/prestamos/[id]/verificar-codigo/route.ts',
    'app/api/dashboard/route.ts',
    'app/api/refinanciaciones/route.ts',
    'app/api/notificaciones/route.ts',
    'app/api/estado-cuenta/route.ts',
    'app/api/documentos/route.ts',
    'app/api/ficha-tecnica/route.ts',
    'app/api/pagos/prediccion-mora/route.ts',
    'app/api/pagos/informe/route.ts',
    'app/api/pagos/aplicar/route.ts',
    'app/api/pagos/boton-pago/route.ts',
    'app/api/pagos/renegociar-mora/route.ts',
    'app/api/pagos/cron/route.ts',
    'app/api/pagos/route.ts',
    'app/api/pagos/proximos/route.ts',
    'app/api/reportes/route.ts',
    'app/api/juridico/[id]/exportar/route.ts',
]

# En ficha-tecnica hay un caso especial: línea 96 setea tasaMoraAnual pero
# línea 97 setea tasaMoraDiaria: prestamo.tasaMoraDiaria (sin * 360).
# Este NO lo tocamos aquí.

def process_file(filepath: Path) -> tuple[int, list[str]]:
    """Procesa un archivo y devuelve (número de reemplazos, líneas modificadas)."""
    if not filepath.exists():
        return (0, [])

    original = filepath.read_text(encoding='utf-8')
    if 'tasaMoraDiaria * 360' not in original and 'tasaMoraPersonalizada ?? ' not in original:
        return (0, [])

    new_content = original
    changes = []

    for pattern, replacement in PATTERNS:
        matches = list(pattern.finditer(new_content))
        if matches:
            new_content = pattern.sub(replacement, new_content)
            changes.append(f'  {len(matches)} reemplazo(s) con patrón {pattern.pattern[:50]}...')

    if new_content == original:
        return (0, [])

    # Verificar si necesita import
    needs_import = 'getTasaMoraAnual(' in new_content and 'getTasaMoraAnual' not in original

    if needs_import:
        # Caso 1: ya hay import desde '@/lib/finanzas'
        import_pattern = re.compile(r"from\s+'@/lib/finanzas'")
        if import_pattern.search(new_content):
            # Añadir getTasaMoraAnual al import existente
            # Buscar el bloque de import multilinea o single-line
            new_content = re.sub(
                r"(import\s+\{[^}]*?)\bcalcularDiasMora\b([^}]*?\}\s*from\s+'@/lib/finanzas')",
                lambda m: f"{m.group(1)}calcularDiasMora, getTasaMoraAnual{m.group(2)}",
                new_content
            )
            # Si no encontró calcularDiasMora, intentar con otra función común
            if 'getTasaMoraAnual' not in new_content:
                new_content = re.sub(
                    r"(import\s+\{[^}]*?)\bcalcularPrestamo\b([^}]*?\}\s*from\s+'@/lib/finanzas')",
                    lambda m: f"{m.group(1)}calcularPrestamo, getTasaMoraAnual{m.group(2)}",
                    new_content
                )
            # Si no encontró calcularPrestamo, intentar con formatearMoneda
            if 'getTasaMoraAnual' not in new_content:
                new_content = re.sub(
                    r"(import\s+\{[^}]*?)\bformatearMoneda\b([^}]*?\}\s*from\s+'@/lib/finanzas')",
                    lambda m: f"{m.group(1)}formatearMoneda, getTasaMoraAnual{m.group(2)}",
                    new_content
                )
            # Último recurso: añadir al final de cualquier import de finanzas
            if 'getTasaMoraAnual' not in new_content:
                new_content = re.sub(
                    r"(import\s+\{)([^}]*)(\}\s*from\s+'@/lib/finanzas')",
                    lambda m: f"{m.group(1)}{m.group(2).rstrip()}, getTasaMoraAnual{m.group(3)}",
                    new_content
                )
            changes.append('  + añadido getTasaMoraAnual al import existente')
        else:
            # Caso 2: no hay import de finanzas, añadir uno nuevo
            # Insertarlo después del último import existente
            import_lines = re.findall(r'^import\s.*$', new_content, re.MULTILINE)
            if import_lines:
                last_import = import_lines[-1]
                new_content = new_content.replace(
                    last_import,
                    last_import + "\nimport { getTasaMoraAnual } from '@/lib/finanzas'",
                    1
                )
                changes.append('  + añadido nuevo import { getTasaMoraAnual }')
            else:
                # Sin imports, añadir al inicio
                new_content = "import { getTasaMoraAnual } from '@/lib/finanzas'\n" + new_content
                changes.append('  + añadido nuevo import al inicio')

    filepath.write_text(new_content, encoding='utf-8')
    return (len(changes), changes)


def main():
    total_changes = 0
    for rel in TARGET_FILES:
        fpath = BASE / rel
        n, changes = process_file(fpath)
        if n > 0:
            print(f'✓ {rel}:')
            for c in changes:
                print(c)
            total_changes += 1
        else:
            print(f'  {rel}: sin cambios')
    print(f'\nTotal archivos modificados: {total_changes}')


if __name__ == '__main__':
    main()
