#!/usr/bin/env python3
"""
Escaneo profundo de la BD SQLite buscando RESTOS de datos reales (no DDL).
Si freelist=0, los datos pueden estar en:
1. Slack space dentro de páginas b-tree (entre celdas)
2. Registros no sobreescritos en páginas reutilizadas
3. Páginas con cells que fueron vaciadas pero no se hizo VACUUM completo

Buscaremos por:
- Strings JSON largos que parezcan registros (no CREATE TABLE)
- cuid IDs (cm[a-z0-9]{22})
- Emails, teléfonos colombianos
- Valores numéricos con formato COP (millones)
"""
import struct
import re
import json
import os
from collections import defaultdict

DB_PATH = '/home/z/my-project/db/custom.db'

def main():
    with open(DB_PATH, 'rb') as f:
        data = f.read()
    
    page_size = struct.unpack('>H', data[16:18])[0]
    if page_size == 1:
        page_size = 65536
    page_count = struct.unpack('>I', data[28:32])[0]
    
    print(f'=== ESCANEO PROFUNDO ===')
    print(f'Page size: {page_size}, Page count: {page_count}')
    print(f'File size: {len(data):,}')
    
    # === Patrones de datos reales ===
    cuid_re = re.compile(rb'cm[a-z0-9]{22}')
    email_re = re.compile(rb'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    phone_re = re.compile(rb'3\d{9}')  # Celulares colombianos
    cedula_re = re.compile(rb'\b1\d{8,11}\b')  # Cédulas colombianas
    codigo_prestamo_re = re.compile(rb'PREST-\d{4,6}')
    codigo_sol_re = re.compile(rb'SOL-\d{4,6}')
    
    # Búsqueda más específica de registros (con campos JSON)
    json_like_re = re.compile(rb'\{"id":"cm[a-z0-9]{22"[^\}]{50,500}\}')
    
    findings = defaultdict(list)
    
    for page_idx in range(1, page_count + 1):
        offset = (page_idx - 1) * page_size
        if offset + page_size > len(data):
            break
        page = data[offset:offset + page_size]
        
        # Saltar páginas que solo contienen DDL/schema
        # (ya las detectamos en el script anterior)
        
        # Buscar cuid IDs (marcador fuerte de registros)
        cuids = cuid_re.findall(page)
        if len(cuids) > 3:  # Si hay >3 cuids en una página, probablemente son registros
            # Buscar también strings largos imprimibles
            text = page.decode('latin-1', errors='replace')
            # Filtrar chunks que parezcan CREATE TABLE o index (DDL)
            chunks = re.findall(r'[\x20-\x7e]{60,}', text)
            data_chunks = [c for c in chunks if 'CREATE TABLE' not in c and 'CREATE INDEX' not in c and 'sqlite_autoindex' not in c]
            
            if data_chunks:
                findings['pages_with_cuids'].append({
                    'page': page_idx,
                    'cuid_count': len(cuids),
                    'sample_cuids': [c.decode('latin-1') for c in cuids[:5]],
                    'data_chunks': data_chunks[:3]
                })
        
        # Buscar emails (marcador de clientes/solicitudes)
        emails = email_re.findall(page)
        if emails:
            for em in emails:
                em_str = em.decode('latin-1', errors='replace')
                if em_str not in ['admin@example.com', 'system@local', 'noreply@local']:
                    findings['emails'].append({'page': page_idx, 'email': em_str})
        
        # Buscar códigos de préstamo/solicitud
        for m in codigo_prestamo_re.finditer(page):
            findings['codigos_prestamo'].append({'page': page_idx, 'value': m.group().decode()})
        for m in codigo_sol_re.finditer(page):
            findings['codigos_solicitud'].append({'page': page_idx, 'value': m.group().decode()})
    
    # === REPORTE ===
    print('\n=== RESUMEN DE HALLAZGOS ===')
    for k, v in findings.items():
        print(f'\n{k}: {len(v)} coincidencias')
        if k == 'pages_with_cuids':
            for p in v[:10]:
                print(f'  Page #{p["page"]}: {p["cuid_count"]} cuids, ej: {p["sample_cuids"][:2]}')
                for c in p['data_chunks']:
                    print(f'     | {c[:300]}')
        elif k == 'emails':
            seen = set()
            for p in v[:20]:
                if p['email'] not in seen:
                    print(f'  Page #{p["page"]}: {p["email"]}')
                    seen.add(p['email'])
        elif k == 'codigos_prestamo':
            seen = set()
            for p in v[:20]:
                if p['value'] not in seen:
                    print(f'  Page #{p["page"]}: {p["value"]}')
                    seen.add(p['value'])
        elif k == 'codigos_solicitud':
            seen = set()
            for p in v[:20]:
                if p['value'] not in seen:
                    print(f'  Page #{p["page"]}: {p["value"]}')
                    seen.add(p['value'])
    
    # === Búsqueda específica de tablas objetivo ===
    print('\n=== BÚSQUEDA DE REGISTROS DE TABLAS OBJETIVO ===')
    
    # DocumentoGestor: buscar secuencia "archivoBase64 + archivoNombre + archivoTipo"
    # En SQLite, los campos TEXT se almacenan como strings.
    # Un registro de DocumentoGestor tendría: tipo|titulo|descripcion|archivoBase64|archivoNombre|...
    
    target_patterns = {
        'DocumentoGestor_registro': [
            rb'foto', rb'selfie', rb'Selfie', rb'foto_cliente', rb'comprobante',
            rb'image/png', rb'image/jpeg', rb'application/pdf',
            rb'data:image', rb'/9j/',  # base64 prefix de JPEG
        ],
        'SolicitudWeb_registro': [
            rb'SOL-', rb'PORTAL_CLIENTE', rb'tablaAmortizacion',
        ],
        'SolicitudNuevoCliente_registro': [
            rb'Pendiente', rb'PENDIENTE', rb'referidoPor', rb'plazoDeseado',
        ],
        'ConversacionChat_registro': [
            rb'Conversacion general', rb'ACTIVA', rb'asesorId', 
        ],
        'MensajeChat_registro': [
            rb'remitente', rb'contenido',
        ],
    }
    
    for target, pats in target_patterns.items():
        print(f'\n--- {target} ---')
        total = 0
        for page_idx in range(1, page_count + 1):
            offset = (page_idx - 1) * page_size
            page = data[offset:offset + page_size]
            for pat in pats:
                if pat in page:
                    # Mostrar contexto
                    idx = page.find(pat)
                    context = page[max(0,idx-80):idx+200].decode('latin-1', errors='replace')
                    # Filtrar si es DDL
                    if 'CREATE TABLE' in context or 'CREATE INDEX' in context:
                        continue
                    print(f'  Page #{page_idx} [{pat.decode()}]: ...{context[:250]}...')
                    total += 1
                    break
        print(f'  Total: {total} páginas con datos potencialmente recuperables')

if __name__ == '__main__':
    main()
