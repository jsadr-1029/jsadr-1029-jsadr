#!/usr/bin/env python3
"""
Genera PDF: Inventario completo de credenciales JSADR
Salida: /home/z/my-project/download/JSADR-Inventario-Credenciales.pdf
"""
import os, sys, json, subprocess
from pathlib import Path

# Cargar .env a variables de entorno
env_path = '/home/z/my-project/.env'
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        v = v.strip().strip('"').strip("'")
        env[k] = v

# Obtener datos de la BD via Node.js
node_script = """
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\\n]*)"?\\s*$/);
  if (m) process.env[m[1]] = m[2];
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const usuarios = await prisma.usuario.findMany({ orderBy: { createdAt: 'asc' }});
  const clientes = await prisma.cliente.findMany({ orderBy: { cedula: 'asc' }});
  const plataformas = await prisma.plataformaSync.findMany();
  const conexiones = await prisma.conexionAPI.findMany();
  const variables = await prisma.variableGlobal.findMany();
  console.log(JSON.stringify({ usuarios, clientes, plataformas, conexiones, variables }));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"""
result = subprocess.run(['node', '-e', node_script], capture_output=True, text=True, cwd='/home/z/my-project')
if result.returncode != 0:
    print("ERROR BD:", result.stderr)
    sys.exit(1)
data = json.loads(result.stdout)

# Generar PDF con ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether, HRFlowable)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUT = '/home/z/my-project/download/JSADR-Inventario-Credenciales.pdf'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=18*mm, rightMargin=18*mm,
                        topMargin=18*mm, bottomMargin=18*mm)

styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#0F172A'),
                    spaceAfter=4, spaceBefore=0)
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, textColor=colors.HexColor('#0EA5E9'),
                    spaceAfter=4, spaceBefore=10)
H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=11, textColor=colors.HexColor('#1E40AF'),
                    spaceAfter=2, spaceBefore=6)
BODY = ParagraphStyle('BODY', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#334155'),
                      leading=12, spaceAfter=2)
LABEL = ParagraphStyle('LABEL', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748B'),
                       fontName='Helvetica-Bold', leading=10)
VALUE = ParagraphStyle('VALUE', parent=styles['Normal'], fontSize=8.5, textColor=colors.HexColor('#0F172A'),
                       leading=11)
VALUE_MONO = ParagraphStyle('VMONO', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#0F172A'),
                            fontName='Courier', leading=10)
VALUE_RED = ParagraphStyle('VRED', parent=styles['Normal'], fontSize=8.5, textColor=colors.HexColor('#B91C1C'),
                           leading=11)
VALUE_GREEN = ParagraphStyle('VGRN', parent=styles['Normal'], fontSize=8.5, textColor=colors.HexColor('#15803D'),
                             leading=11, fontName='Helvetica-Bold')
WARN = ParagraphStyle('WARN', parent=styles['Normal'], fontSize=9.5, textColor=colors.HexColor('#B91C1C'),
                      fontName='Helvetica-Bold', leading=12, spaceAfter=6)

def kv_table(rows):
    """rows: list of (label, value, style) tuples"""
    data = []
    for r in rows:
        label = r[0]
        value = r[1] if r[1] is not None else ''
        style = r[2] if len(r) > 2 else VALUE
        if not isinstance(value, str):
            value = str(value)
        data.append([Paragraph(label, LABEL), Paragraph(value, style)])
    t = Table(data, colWidths=[55*mm, 119*mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LINEBELOW', (0,0), (-1,-1), 0.2, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#F8FAFC')),
    ]))
    return t

def fmt_date(d):
    if not d: return ''
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(d.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M UTC')
    except: return d

story = []

# ==================== PORTADA ====================
story.append(Paragraph('INVENTARIO DE CREDENCIALES', H1))
story.append(Paragraph('JSADR — Plataforma de Gestión de Préstamos', H2))
story.append(Spacer(1, 4))
story.append(Paragraph(f'Generado: 2026-08-07 02:50 UTC', BODY))
story.append(Paragraph(f'Dominio: https://jsadr.com.co', BODY))
story.append(Paragraph(f'Repositorio: github.com/jsadr-1029/jsadr-1029-jsadr', BODY))
story.append(Spacer(1, 10))
story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#0EA5E9')))
story.append(Spacer(1, 6))

story.append(Paragraph('Resumen ejecutivo', H3))
resumen = [
    f'• Usuarios internos: {len(data["usuarios"])} (todos con contraseña <b>J s121473164*</b>)',
    f'• Clientes: {len(data["clientes"])} (todos con su cédula como contraseña temporal)',
    f'• Plataformas sincronizadas: {len(data["plataformas"])} (GitHub, Vercel, Neon) — tokens HUÉRFANOS no recuperables',
    f'• Conexiones API: {len(data["conexiones"])} (Brevo SMTP, Bancolombia) — credenciales HUÉRFANAS no recuperables',
    f'• Variables globales: {len(data["variables"])} (parámetros operativos, no credenciales)',
    f'• Secretos en .env: 11 llaves de cifrado/sesión (recuperables)',
    '',
    '<b>ADVERTENCIA:</b> Las credenciales marcadas como "HUÉRFANO" fueron cifradas con una API_ENCRYPTION_KEY que se sobrescribió el 2026-08-07 01:57:24 UTC durante la consolidación del dominio jsadr.com.co. Esas credenciales deben ser reingresadas manualmente desde el panel administrativo.',
]
for r in resumen:
    story.append(Paragraph(r, BODY))
story.append(Spacer(1, 10))
story.append(Paragraph('⚠ DOCUMENTO CONFIDENCIAL — Almacenar en sitio seguro (gestor de contraseñas).', WARN))

story.append(PageBreak())

# ==================== SECCIÓN 1: USUARIOS INTERNOS ====================
story.append(Paragraph('1. Usuarios internos (tabla Usuario)', H2))
story.append(Paragraph(
    f'Total: {len(data["usuarios"])} usuarios. Todos tienen el passwordHash restablecido el 2026-08-07 02:10:08 UTC con la contraseña '
    '<b><font color="#15803D">Js121473164*</font></b> (bcrypt rounds=12). Los usuarios con rol ABOGADO también tienen claveHash '
    '(portal jurídico) restablecida con la misma contraseña.', BODY))
story.append(Spacer(1, 6))

for i, u in enumerate(data['usuarios'], 1):
    story.append(Paragraph(f'[{i}] <b>{u["username"]}</b> — rol: {u["rol"]}', H3))
    rows = [
        ('Nombre completo', u.get('nombre', '')),
        ('Email', u.get('email', '')),
        ('Cédula (jurídico)', u.get('cedula') or '(no aplica)'),
        ('Estado', 'ACTIVO' if u.get('activo') else 'INACTIVO', VALUE_GREEN if u.get('activo') else VALUE_RED),
        ('CONTRASEÑA', 'Js121473164*', VALUE_GREEN),
    ]
    if u.get('claveHash'):
        rows.append(('Clave portal jurídico', 'Js121473164* (mismo que contraseña)', VALUE_GREEN))
    rows += [
        ('Intentos fallidos', str(u.get('intentosFallidos', 0))),
        ('Bloqueado hasta', fmt_date(u.get('bloqueadoHasta')) or 'no'),
        ('MFA', 'HABILITADO' if u.get('mfaEnabled') else 'deshabilitado'),
        ('Último acceso', fmt_date(u.get('ultimoAcceso')) or 'nunca'),
        ('Creado', fmt_date(u.get('createdAt'))),
    ]
    story.append(kv_table(rows))
    story.append(Spacer(1, 8))

story.append(PageBreak())

# ==================== SECCIÓN 2: CLIENTES ====================
story.append(Paragraph('2. Clientes (tabla Cliente)', H2))
story.append(Paragraph(
    f'Total: {len(data["clientes"])} clientes. Todos tienen su claveHash restablecido el 2026-08-07 02:10:08 UTC con su número de cédula '
    'como contraseña temporal. Los clientes deben cambiar su contraseña desde el portal al ingresar por primera vez.', BODY))
story.append(Spacer(1, 6))

for i, c in enumerate(data['clientes'], 1):
    story.append(Paragraph(f'[{i}] CC <b>{c["cedula"]}</b> — {c.get("nombre", "")}', H3))
    rows = [
        ('Email', c.get('email') or '(sin email)'),
        ('Teléfono', c.get('telefono') or ''),
        ('Estado', 'ACTIVO' if c.get('activo') else 'INACTIVO', VALUE_GREEN if c.get('activo') else VALUE_RED),
        ('CONTRASEÑA PORTAL', c['cedula'], VALUE_GREEN),
        ('Intentos', str(c.get('claveIntentos', 0))),
        ('Bloqueado hasta', fmt_date(c.get('claveBloqueadoHasta')) or 'no'),
    ]
    if c.get('bancoCliente'):
        rows.append(('Banco', f'{c["bancoCliente"]} {c.get("tipoCuentaCliente", "")} {c.get("numeroCuentaCliente", "")}'))
    rows.append(('Último acceso portal', fmt_date(c.get('ultimoAccesoPortal')) or 'nunca'))
    story.append(kv_table(rows))
    story.append(Spacer(1, 6))

story.append(PageBreak())

# ==================== SECCIÓN 3: PLATAFORMA SYNC ====================
story.append(Paragraph('3. Plataformas de sincronización (tabla PlataformaSync)', H2))
story.append(Paragraph(
    f'Total: {len(data["plataformas"])} plataformas. Los tokens están cifrados con AES-256-CBC en el campo tokenCifrado. '
    'La API_ENCRYPTION_KEY original se perdió al regenerar .env el 2026-08-07 01:57:24 UTC, por lo que los tokens son '
    '<b><font color="#B91C1C">HUÉRFANOS</font></b>: existen en BD pero NO se pueden descifrar. Deben ser reingresados '
    'manualmente desde el panel administrativo.', BODY))
story.append(Spacer(1, 6))

for i, p in enumerate(data['plataformas'], 1):
    story.append(Paragraph(f'[{i}] <b>{p["plataforma"]}</b> — {p.get("nombreMostrar", "")}', H3))
    tc = p.get('tokenCifrado') or ''
    rows = [
        ('Descripción', p.get('descripcion') or ''),
        ('Endpoint', p.get('endpoint') or ''),
        ('Proyecto ref', p.get('proyectoRef') or ''),
        ('Región', p.get('region') or 'n/a'),
        ('Rama principal', p.get('ramaPrincipal') or 'main'),
        ('Sincronizado', 'SÍ' if p.get('sincronizado') else 'NO', VALUE_GREEN if p.get('sincronizado') else VALUE_RED),
        ('Tiempo real (webhooks)', 'SÍ' if p.get('tiempoReal') else 'NO'),
        ('Webhook URL', p.get('webhookUrl') or ''),
        ('Webhook secret (BD)', p.get('webhookSecret') or '(vacío en BD)'),
        ('Estado del token', 'HUÉRFANO — no descifrable', VALUE_RED),
        ('Token cifrado (BD)', f'{len(tc)} chars: {tc[:60]}...' if tc else '(vacío)', VALUE_MONO),
        ('Último sync', fmt_date(p.get('ultimoSync')) or 'nunca'),
        ('Último estado', p.get('ultimoEstado') or ''),
        ('Último error', p.get('ultimoError') or ''),
        ('Eventos recibidos', str(p.get('eventosRecibidos', 0))),
    ]
    story.append(kv_table(rows))
    story.append(Spacer(1, 6))

story.append(PageBreak())

# ==================== SECCIÓN 4: CONEXIONES API ====================
story.append(Paragraph('4. Conexiones API (tabla ConexionAPI)', H2))
story.append(Paragraph(
    f'Total: {len(data["conexiones"])} conexiones. Las credenciales (apiKey, apiSecret, password) están cifradas con la '
    'misma API_ENCRYPTION_KEY perdida, por lo que son <b><font color="#B91C1C">HUÉRFANAS</font></b> y NO recuperables desde la BD.', BODY))
story.append(Spacer(1, 6))

for i, c in enumerate(data['conexiones'], 1):
    story.append(Paragraph(f'[{i}] <b>{c["tipo"]}</b> — {c.get("nombre", "")}', H3))
    ak = c.get('apiKey') or ''
    ase = c.get('apiSecret') or ''
    pw = c.get('password') or ''
    rows = [
        ('Descripción', c.get('descripcion') or ''),
        ('URL', c.get('url') or '(no set)'),
        ('Usuario', c.get('usuario') or '(vacío)'),
        ('Account ID', c.get('accountId') or '(vacío)'),
        ('apiKey (cifrado)', f'{len(ak)} chars — HUÉRFANO' if ak else '(vacío)', VALUE_RED if ak else VALUE),
        ('apiSecret (cifrado)', f'{ase[:30]}... — HUÉRFANO' if ase else '(vacío)', VALUE_RED if ase else VALUE),
        ('password (cifrado)', f'{pw[:30]}... — HUÉRFANO' if pw else '(vacío)', VALUE_RED if pw else VALUE),
        ('Config extra', (c.get('configuracionExtra') or '')[:200]),
        ('Activa', 'SÍ' if c.get('activa') else 'NO', VALUE_GREEN if c.get('activa') else VALUE_RED),
        ('Probada', 'SÍ' if c.get('probada') else 'NO'),
        ('Fecha última prueba', fmt_date(c.get('fechaUltimaPrueba')) or 'nunca'),
        ('Resultado última prueba', c.get('resultadoUltimaPrueba') or 'n/a'),
    ]
    story.append(kv_table(rows))
    story.append(Spacer(1, 6))

# ==================== SECCIÓN 5: VARIABLES GLOBALES ====================
story.append(Paragraph('5. Variables globales (tabla VariableGlobal)', H2))
story.append(Paragraph(f'Total: {len(data["variables"])} variables. Son parámetros operativos (no credenciales).', BODY))
story.append(Spacer(1, 4))
rows = []
for v in data['variables']:
    val = v.get('valor', '')
    if not isinstance(val, str):
        val = json.dumps(val)
    rows.append((v['clave'], val))
story.append(kv_table(rows))
story.append(Spacer(1, 8))

story.append(PageBreak())

# ==================== SECCIÓN 6: DATOS PÚBLICOS .ENV ====================
story.append(Paragraph('6. Datos públicos de plataformas (archivo .env)', H2))
story.append(Paragraph('Identificadores públicos (no secretos) de cada plataforma, almacenados en .env:', BODY))
story.append(Spacer(1, 4))

story.append(Paragraph('6.1 GitHub', H3))
story.append(kv_table([
    ('Owner', env.get('GITHUB_OWNER', '')),
    ('Repo', env.get('GITHUB_REPO', '')),
    ('Webhook secret', env.get('GITHUB_WEBHOOK_SECRET', ''), VALUE_MONO),
]))

story.append(Paragraph('6.2 Vercel', H3))
story.append(kv_table([
    ('Project ID', env.get('VERCEL_PROJECT_ID', ''), VALUE_MONO),
    ('Team ID', env.get('VERCEL_TEAM_ID', ''), VALUE_MONO),
    ('Webhook secret', env.get('VERCEL_WEBHOOK_SECRET', ''), VALUE_MONO),
]))

story.append(Paragraph('6.3 Neon', H3))
story.append(kv_table([
    ('Project ID', env.get('NEON_PROJECT_ID', ''), VALUE_MONO),
    ('Branch', env.get('NEON_BRANCH', '')),
    ('Webhook secret', env.get('NEON_WEBHOOK_SECRET', ''), VALUE_MONO),
]))

story.append(Paragraph('6.4 SMTP (Brevo)', H3))
smtp_pass = env.get('SMTP_PASS', '')
story.append(kv_table([
    ('Host', env.get('SMTP_HOST', '')),
    ('Port', env.get('SMTP_PORT', '')),
    ('User', env.get('SMTP_USER', ''), VALUE_MONO),
    ('From', env.get('SMTP_FROM', '')),
    ('From name', env.get('SMTP_FROM_NAME', '')),
    ('Password (.env SMTP_PASS)', smtp_pass or '(vacío — reingresar)', VALUE_GREEN if smtp_pass else VALUE_RED),
]))

story.append(Paragraph('6.5 WhatsApp Cloud API', H3))
wt = env.get('WHATSAPP_TOKEN', '')
story.append(kv_table([
    ('Token', wt or '(vacío — pendiente de configurar)', VALUE_GREEN if wt else VALUE_RED),
    ('Phone number ID', env.get('WHATSAPP_PHONE_NUMBER_ID', '') or '(vacío)'),
    ('Business ID', env.get('WHATSAPP_BUSINESS_ID', '') or '(vacío)'),
    ('Webhook secret', env.get('WHATSAPP_WEBHOOK_SECRET', ''), VALUE_MONO),
]))

story.append(Paragraph('6.6 Bancolombia', H3))
bc_id = env.get('BANCOLOMBIA_CLIENT_ID', '')
bc_se = env.get('BANCOLOMBIA_CLIENT_SECRET', '')
bc_cm = env.get('BANCOLOMBIA_COMMERCE_ID', '')
story.append(kv_table([
    ('Client ID', bc_id or '(vacío — reingresar)', VALUE_GREEN if bc_id else VALUE_RED),
    ('Client secret', bc_se or '(vacío — reingresar)', VALUE_GREEN if bc_se else VALUE_RED),
    ('Commerce ID', bc_cm or '(vacío — reingresar)', VALUE_GREEN if bc_cm else VALUE_RED),
    ('Ambiente', env.get('BANCOLOMBIA_AMBIENTE', '')),
]))

story.append(PageBreak())

# ==================== SECCIÓN 7: SECRETOS .ENV ====================
story.append(Paragraph('7. Secretos de cifrado y autenticación (archivo .env)', H2))
story.append(Paragraph(
    'Estos son los secretos críticos del sistema. Están vigentes (regenerados 2026-08-07 01:57:24 UTC). '
    'Cualquier cambio en estos valores invalidará todas las sesiones activas y los datos cifrados.', BODY))
story.append(Spacer(1, 6))

story.append(Paragraph('7.1 Base de datos Neon', H3))
story.append(kv_table([('DATABASE_URL', env.get('DATABASE_URL', ''), VALUE_MONO)]))

story.append(Paragraph('7.2 Cifrado AES-256 (afecta TODOS los datos cifrados)', H3))
story.append(kv_table([('API_ENCRYPTION_KEY', env.get('API_ENCRYPTION_KEY', ''), VALUE_MONO)]))
story.append(Paragraph('Vigente desde 2026-08-07 01:57:24 UTC. Las credenciales cifradas ANTES de esta fecha son huérfanas.', WARN))

story.append(Paragraph('7.3 JWT y sesiones', H3))
story.append(kv_table([
    ('JWT_SECRET', env.get('JWT_SECRET', ''), VALUE_MONO),
    ('JWT_REFRESH_SECRET', env.get('JWT_REFRESH_SECRET', ''), VALUE_MONO),
    ('OTP_CHAT_SECRET', env.get('OTP_CHAT_SECRET', ''), VALUE_MONO),
    ('PORTAL_SESSION_SECRET', env.get('PORTAL_SESSION_SECRET', ''), VALUE_MONO),
    ('ADMIN_SESSION_SECRET', env.get('ADMIN_SESSION_SECRET', ''), VALUE_MONO),
    ('CHAT_DYN_SECRET', env.get('CHAT_DYN_SECRET', ''), VALUE_MONO),
]))

# ==================== SECCIÓN 8: URLs ====================
story.append(Paragraph('8. URLs, dominios y endpoints', H2))
story.append(kv_table([
    ('URL pública', env.get('NEXT_PUBLIC_APP_URL', '')),
    ('Orígenes permitidos (CORS)', env.get('ALLOWED_ORIGINS', '')),
    ('Endpoint webhook plataformas', 'https://jsadr.com.co/api/seguridad/plataformas-sync/webhook'),
    ('Endpoint webhook Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-webhook'),
    ('Endpoint redirect Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-redirect'),
    ('Endpoint checkout Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-checkout'),
    ('Repositorio GitHub', f'https://github.com/{env.get("GITHUB_OWNER", "")}/{env.get("GITHUB_REPO", "")}'),
    ('Proyecto Vercel', f'https://vercel.com/{env.get("VERCEL_TEAM_ID", "")}/{env.get("VERCEL_PROJECT_ID", "")}'),
    ('Proyecto Neon', f'https://console.neon.tech/app/projects/{env.get("NEON_PROJECT_ID", "")}'),
]))

story.append(PageBreak())

# ==================== SECCIÓN 9: ACCIONES PENDIENTES ====================
story.append(Paragraph('9. Acciones pendientes (credenciales huérfanas)', H2))
story.append(Paragraph('Las siguientes credenciales NO se pueden recuperar de la BD ni de .env. Deben ser reingresadas o recreadas manualmente:', BODY))
story.append(Spacer(1, 4))

def action_block(title, lines):
    elems = [Paragraph(title, H3)]
    for l in lines:
        elems.append(Paragraph('• ' + l, BODY))
    elems.append(Spacer(1, 4))
    return KeepTogether(elems)

story.append(action_block('9.1 Token GitHub PAT', [
    'Acceder a: https://github.com/settings/tokens',
    'Generar nuevo token (classic) con scopes: repo, workflow, admin:repo_hook, read:user',
    'O reutilizar token existente si está en gestor de contraseñas',
    'Ingresarlo desde: Panel admin → Config. Global → Seguridad → Plataformas → GitHub',
]))

story.append(action_block('9.2 Token Vercel', [
    'Acceder a: https://vercel.com/account/tokens',
    'Generar nuevo token con scope: Full Account',
    'Ingresarlo desde: Panel admin → Config. Global → Seguridad → Plataformas → Vercel',
]))

story.append(action_block('9.3 API Key Neon', [
    'Acceder a: https://console.neon.tech/app/settings/api-keys',
    'Generar nueva API key',
    'Ingresarla desde: Panel admin → Config. Global → Seguridad → Plataformas → Neon',
]))

story.append(action_block('9.4 Password SMTP Brevo', [
    'Acceder a: https://app.brevo.com/settings/keys/smtp',
    'Copiar el SMTP key actual o generar uno nuevo',
    'Ingresarlo desde: Panel admin → Config. Global → Correo → Editar → SMTP Password',
]))

story.append(action_block('9.5 Credenciales Bancolombia', [
    'Acceder al portal del comercio Bancolombia',
    'Copiar Client ID, Client Secret y Commerce ID',
    'Ingresarlos desde: Panel admin → Config. Global → Integraciones → Botón Bancolombia',
]))

story.append(PageBreak())

# ==================== SECCIÓN 10: RECOMENDACIONES ====================
story.append(Paragraph('10. Recomendaciones de seguridad', H2))

story.append(action_block('10.1 Almacenamiento', [
    'Guardar este PDF en un gestor de contraseñas (Bitwarden, 1Password, KeePassXC).',
    'NO almacenar este PDF en Google Drive, Dropbox o correo sin cifrar.',
    'Borrar este PDF después de migrar las credenciales a un gestor seguro.',
]))

story.append(action_block('10.2 Rotación', [
    'Rotar API_ENCRYPTION_KEY solo después de reingresar TODAS las credenciales huérfanas.',
    'Rotar JWT_SECRET y JWT_REFRESH_SECRET fuerza logout de todas las sesiones activas.',
    'Cambiar contraseña "Js121473164*" por una única por usuario en el primer login.',
]))

story.append(action_block('10.3 Recuperación', [
    'Hacer backup del archivo .env en sitio seguro (gestor de contraseñas).',
    'Hacer backup de la BD Neon semanalmente (pg_dump o backup automático de Neon).',
    'Documentar cualquier cambio de credenciales en bitácora de seguridad.',
]))

story.append(action_block('10.4 MFA', [
    'Habilitar MFA en GitHub (Settings → Password and authentication).',
    'Habilitar MFA en Vercel (Account Settings → Authentication).',
    'Habilitar MFA en Neon (Account → Settings → Security).',
    'Habilitar MFA en Brevo (Account → Security).',
]))

doc.build(story)
print(f'PDF generado: {OUT}')
sz = os.path.getsize(OUT)
print(f'Tamaño: {sz/1024:.1f} KB')
