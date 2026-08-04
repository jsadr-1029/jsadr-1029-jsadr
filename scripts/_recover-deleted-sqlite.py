#!/usr/bin/env python3
"""
Recupera datos borrados de una BD SQLite explorando:
1. Freelist pages (páginas marcadas como libres pero con datos aún presentes)
2. Páginas huérfanas (no referenciadas por ningún b-tree)
3. Slack space dentro de páginas activas

Estrategia:
- Abre custom.db en modo lectura binaria
- Lee el header (100 bytes) para obtener page_size y page_count
- Recorre todas las páginas
- Para cada página, escanea contenido buscando patrones JSON de las tablas objetivo:
  * DocumentoGestor (archivoBase64, archivoNombre, tipo)
  * SolicitudWeb (clienteCedula, valorSolicitado, codigo)
  * SolicitudNuevoCliente (nombre, apellido, cedula, valorSolicitado)
  * ConversacionChat (codigo, asunto, clienteId)
  * MensajeChat (conversacionId, contenido, remitente)
"""
import struct
import re
import os
import sys

DB_PATH = '/home/z/my-project/db/custom.db'

def read_header(data):
    page_size = struct.unpack('>H', data[16:18])[0]
    if page_size == 1:
        page_size = 65536
    page_count = struct.unpack('>I', data[28:32])[0]
    freelist_count = struct.unpack('>I', data[36:40])[0]
    return page_size, page_count, freelist_count

def main():
    with open(DB_PATH, 'rb') as f:
        data = f.read()
    
    print(f'File size: {len(data):,} bytes')
    
    page_size, page_count, freelist_count = read_header(data)
    print(f'Page size: {page_size}, Page count: {page_count}, Freelist pages: {freelist_count}')
    print(f'Expected size: {page_size * page_count:,} bytes')
    print()
    
    # === Leer freelist trunk pages ===
    freelist_pages = set()
    first_trunk = struct.unpack('>I', data[32:36])[0]
    print(f'First freelist trunk page: {first_trunk}')
    
    if first_trunk > 0:
        trunk_page_idx = first_trunk
        while trunk_page_idx > 0 and trunk_page_idx <= page_count:
            offset = (trunk_page_idx - 1) * page_size
            if offset + page_size > len(data):
                break
            trunk = data[offset:offset + page_size]
            next_trunk = struct.unpack('>I', trunk[0:4])[0]
            leaf_count = struct.unpack('>I', trunk[4:8])[0]
            for i in range(leaf_count):
                if 8 + i*4 + 4 <= len(trunk):
                    leaf = struct.unpack('>I', trunk[8+i*4:8+i*4+4])[0]
                    if leaf > 0:
                        freelist_pages.add(leaf)
            trunk_page_idx = next_trunk
    
    print(f'Freelist leaf pages found: {len(freelist_pages)}')
    print(f'Sample freelist pages: {list(freelist_pages)[:20]}')
    print()
    
    # === Patrones de búsqueda por tabla ===
    patterns = {
        'DocumentoGestor': [b'archivoBase64', b'archivoNombre', b'Selfie', b'selfie', b'Comprobante', b'foto'],
        'SolicitudWeb': [b'valorSolicitado', b'clienteCedula', b'clienteNombre', b'SOL-', b'Pendiente'],
        'SolicitudNuevoCliente': [b'referidoPorNombre', b'destinoCredito', b'plazoDeseado', b'ocupacion'],
        'ConversacionChat': [b'codigo', b'asesorId', b'Conversacion general', b'ACTIVA', b'otpVerificado'],
        'MensajeChat': [b'conversacionId', b'remitente', b'contenido'],
    }
    
    # cuid IDs (24 chars hex) — buscaremos también
    cuid_pattern = re.compile(rb'cm[a-z0-9]{22}')
    
    # === Escanear todas las páginas buscando patrones ===
    print('=== ESCANEANDO PÁGINAS ===')
    findings = {k: 0 for k in patterns}
    interesting_pages = {k: [] for k in patterns}
    
    for page_idx in range(1, page_count + 1):
        offset = (page_idx - 1) * page_size
        if offset + page_size > len(data):
            break
        page = data[offset:offset + page_size]
        is_freelist = page_idx in freelist_pages
        
        for table, pats in patterns.items():
            for pat in pats:
                if pat in page:
                    findings[table] += 1
                    interesting_pages[table].append((page_idx, is_freelist, pat))
                    break
    
    print('Patrones encontrados por tabla:')
    for t, c in findings.items():
        print(f'  {t}: {c} páginas con coincidencias')
    print()
    
    # === Detalle: mostrar contenido de páginas interesantes ===
    print('=== DETALLE DE PÁGINAS INTERESANTES ===')
    for table, pages in interesting_pages.items():
        if not pages:
            continue
        print(f'\n--- {table} ---')
        # Mostrar solo las primeras 5 páginas freelist y primeras 3 activas
        free_pages = [p for p in pages if p[1]][:5]
        active_pages = [p for p in pages if not p[1]][:3]
        for page_idx, is_free, pat in free_pages + active_pages:
            print(f'\nPage #{page_idx} ({"FREELIST" if is_free else "ACTIVE"}), matched {pat}')
            offset = (page_idx - 1) * page_size
            page = data[offset:offset + page_size]
            # Buscar texto imprimible en la página
            text = page.decode('latin-1', errors='replace')
            # Encontrar secuencias largas de texto imprimible
            chunks = re.findall(r'[\x20-\x7e]{40,}', text)
            for chunk in chunks[:5]:
                print(f'   | {chunk[:200]}')

if __name__ == '__main__':
    main()
