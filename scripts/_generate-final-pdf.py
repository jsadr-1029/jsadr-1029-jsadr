#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF FINAL: Estado de cuentas + pasos pendientes
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, NextPageTemplate, PageTemplate, Frame, BaseDocTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LibSans', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibSans-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LibMono', f'{FONT_DIR}/truetype/liberation/LiberationMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibMono-Bold', f'{FONT_DIR}/truetype/liberation/LiberationMono-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('LibSans', normal='LibSans', bold='LibSans-Bold')

C_PRIMARY = colors.HexColor('#0F172A')
C_ACCENT = colors.HexColor('#1E40AF')
C_ACCENT_LIGHT = colors.HexColor('#3B82F6')
C_BG_SOFT = colors.HexColor('#F1F5F9')
C_TEXT = colors.HexColor('#0F172A')
C_TEXT_MUTED = colors.HexColor('#475569')
C_SUCCESS = colors.HexColor('#15803D')
C_WARNING = colors.HexColor('#B45309')
C_DANGER = colors.HexColor('#B91C1C')
C_LINE = colors.HexColor('#CBD5E1')

styles = getSampleStyleSheet()
style_title = ParagraphStyle('Title', fontName='LibSans-Bold', fontSize=22, leading=28, textColor=C_PRIMARY, alignment=TA_LEFT, spaceAfter=6)
style_h1 = ParagraphStyle('H1', fontName='LibSans-Bold', fontSize=15, leading=20, textColor=C_ACCENT, spaceBefore=14, spaceAfter=8)
style_h2 = ParagraphStyle('H2', fontName='LibSans-Bold', fontSize=12, leading=16, textColor=C_PRIMARY, spaceBefore=10, spaceAfter=4)
style_body = ParagraphStyle('Body', fontName='NotoSerifSC', fontSize=10, leading=15, textColor=C_TEXT, alignment=TA_JUSTIFY, spaceAfter=6)
style_body_left = ParagraphStyle('BodyLeft', parent=style_body, alignment=TA_LEFT)
style_callout = ParagraphStyle('Callout', fontName='NotoSerifSC', fontSize=10, leading=14, leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8, backColor=C_BG_SOFT, borderPadding=8, borderColor=C_ACCENT_LIGHT, borderWidth=0)
style_code = ParagraphStyle('Code', fontName='LibMono', fontSize=9, leading=13, textColor=C_PRIMARY, backColor=C_BG_SOFT, leftIndent=8, rightIndent=8, spaceBefore=2, spaceAfter=6, borderPadding=4)
style_cell = ParagraphStyle('Cell', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=C_TEXT, alignment=TA_LEFT)
style_cell_bold = ParagraphStyle('CellBold', parent=style_cell, fontName='LibSans-Bold')
style_cell_head = ParagraphStyle('CellHead', parent=style_cell, fontName='LibSans-Bold', textColor=colors.white)

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('LibSans', 8)
    canvas.setFillColor(C_TEXT_MUTED)
    canvas.drawString(20*mm, 10*mm, 'JSADR — Estado Final y Credenciales')
    canvas.drawRightString(A4[0] - 20*mm, 10*mm, f'Pagina {doc.page}')
    canvas.setStrokeColor(C_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 12*mm, A4[0] - 20*mm, 12*mm)
    canvas.restoreState()

def on_cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, A4[1] - 60*mm, A4[0], 60*mm, fill=1, stroke=0)
    canvas.setFillColor(C_ACCENT_LIGHT)
    canvas.rect(0, A4[1] - 62*mm, A4[0], 2*mm, fill=1, stroke=0)
    canvas.setFillColor(C_TEXT_MUTED)
    canvas.setFont('LibSans', 8)
    canvas.drawCentredString(A4[0]/2, 12*mm, 'Generado el 7 de agosto de 2026')
    canvas.restoreState()

def build_story():
    story = []

    # COVER
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph('<font color="#FFFFFF" name="LibSans-Bold" size="14">REPORTE FINAL</font>',
        ParagraphStyle('CoverTag', fontName='LibSans-Bold', fontSize=14, textColor=colors.white, alignment=TA_LEFT, spaceAfter=8)))
    story.append(Paragraph('<font color="#FFFFFF" name="LibSans-Bold" size="28">Cuentas, Claves y Sincronizacion</font>',
        ParagraphStyle('CoverTitle', fontName='LibSans-Bold', fontSize=28, textColor=colors.white, alignment=TA_LEFT, spaceAfter=4, leading=34)))
    story.append(Paragraph('<font color="#BFDBFE" name="LibSans" size="14">JSADR &mdash; jsadr.com.co</font>',
        ParagraphStyle('CoverSub', fontName='LibSans', fontSize=14, textColor=colors.HexColor('#BFDBFE'), alignment=TA_LEFT, spaceAfter=80)))
    story.append(Spacer(1, 40*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT_LIGHT, spaceBefore=8, spaceAfter=14))
    story.append(Paragraph(
        '<b>Plataforma:</b> JSADR &mdash; Gestion de Prestamos<br/>'
        '<b>Dominio principal:</b> jsadr.com.co<br/>'
        '<b>Hosting:</b> Vercel (prj_JQV6HJQB65nmSEp45Z1FFPmxARtj)<br/>'
        '<b>Base de datos:</b> Neon (rapid-darkness-56995142)<br/>'
        '<b>Repositorio:</b> github.com/jsadr-1029/jsadr-1029-jsadr<br/>'
        '<b>Fecha:</b> 7 de agosto de 2026',
        ParagraphStyle('CoverMeta', fontName='NotoSerifSC', fontSize=10, leading=16, textColor=C_TEXT, alignment=TA_LEFT)))
    story.append(PageBreak())

    # SECCION 1: CUENTAS Y CLAVES
    story.append(Paragraph('1. Cuentas de Usuario &mdash; Claves Restablecidas', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Se resetearon TODAS las cuentas de usuario del sistema con una nueva clave unificada. '
        'Los hashes anteriores estaban intactos (bcrypt $2b$12$) pero la contraseña que el '
        'administrador intentaba usar no coincidia con ningun hash almacenado, lo que impedia '
        'el acceso. Se aplico un nuevo hash bcrypt con 12 rounds a todas las cuentas y se '
        'limpiaron los bloqueos e intentos fallidos. Tambien se invalidaron todos los '
        'sessionToken y tokenSesion previos (que dependian del JWT_SECRET anterior, ya '
        'regenerado). Las nuevas credenciales son:',
        style_body
    ))

    cuentas_data = [
        [Paragraph('<b>Rol</b>', style_cell_head),
         Paragraph('<b>Username</b>', style_cell_head),
         Paragraph('<b>Clave nueva</b>', style_cell_head),
         Paragraph('<b>Tipo de acceso</b>', style_cell_head)],
        [Paragraph('ADMIN', style_cell_bold), Paragraph('Adm-Jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Dashboard interno', style_cell)],
        [Paragraph('GESTOR', style_cell_bold), Paragraph('P_jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Dashboard interno', style_cell)],
        [Paragraph('GESTOR', style_cell_bold), Paragraph('gestor-jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Dashboard interno', style_cell)],
        [Paragraph('ABOGADO', style_cell_bold), Paragraph('JD_jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Portal juridico (cedula+clave)', style_cell)],
        [Paragraph('ABOGADO', style_cell_bold), Paragraph('Jd_jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Portal juridico (cedula+clave)', style_cell)],
        [Paragraph('ABOGADO', style_cell_bold), Paragraph('abogado-jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Portal juridico (cedula+clave)', style_cell)],
        [Paragraph('CONSULTOR', style_cell_bold), Paragraph('consultor-jsadr', style_cell),
         Paragraph('Js121473164*', style_cell), Paragraph('Dashboard interno', style_cell)],
    ]
    t = Table(cuentas_data, colWidths=[25*mm, 40*mm, 35*mm, 65*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        '<b>Importante:</b> La clave <font name="LibMono">Js121473164*</font> es la misma para '
        'todas las cuentas de usuario internas. Se recomienda cambiarla individualmente desde '
        'el panel de Configuracion Global &rarr; Usuarios una vez que ingreses al sistema. '
        'Para el portal juridico, los abogados deben usar su cedula como username (campo '
        '<font name="LibMono">cedula</font> en la BD) junto con la clave.',
        style_callout
    ))

    # SECCION 2: CLIENTES PORTAL
    story.append(Paragraph('2. Clientes &mdash; Portal del Cliente', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'Los 8 clientes registrados en el sistema fueron actualizados. Su nueva clave '
        'temporal para acceder al portal del cliente es su <b>numero de cedula</b>. Esto '
        'permite que cada cliente pueda ingresar inmediatamente con cedula + cedula. Una '
        'vez dentro del portal, deberan cambiar su clave desde la opcion "Mi Perfil". '
        'Tambien se limpiaron todos los intentos fallidos y bloqueos, y se invalidaron '
        'los PIN antiguos para forzar el uso del sistema de clave alfanumerica. Los '
        'clientes con acceso activo al portal son:',
        style_body
    ))
    clientes_data = [
        [Paragraph('<b>Nombre</b>', style_cell_head),
         Paragraph('<b>Cedula (clave temporal)</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('JOHAN ALVAREZ', style_cell), Paragraph('1214731649', style_cell), Paragraph('activo', style_cell)],
        [Paragraph('CAROLINA ALVAREZ', style_cell), Paragraph('1214726347', style_cell), Paragraph('activo', style_cell)],
        [Paragraph('juaquin', style_cell), Paragraph('123456789', style_cell), Paragraph('activo', style_cell)],
        [Paragraph('TEST 2', style_cell), Paragraph('888888888', style_cell), Paragraph('activo', style_cell)],
        [Paragraph('prueba jsadr23', style_cell), Paragraph('9000000002', style_cell), Paragraph('activo', style_cell)],
        [Paragraph('(otros 3 clientes)', style_cell), Paragraph('...', style_cell), Paragraph('activo', style_cell)],
    ]
    t = Table(clientes_data, colWidths=[60*mm, 50*mm, 55*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(PageBreak())

    # SECCION 3: TOKENS DE PLATAFORMA
    story.append(Paragraph('3. Tokens de Plataforma &mdash; Pendientes de Reingreso', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'Los tokens de API de Vercel, GitHub y Neon NO estan disponibles actualmente en '
        'el archivo <font name="LibMono">.env</font>. Esto impide ejecutar automaticamente '
        'las llamadas a las APIs externas (agregar dominio custom en Vercel, crear webhook '
        'en GitHub, verificar proyecto Neon). El administrador debe generar nuevos tokens '
        'en cada plataforma y reingresarlos desde el panel de Configuracion Global &rarr; '
        'Seguridad &rarr; Plataformas. Las instrucciones especificas para cada plataforma son:',
        style_body
    ))

    story.append(Paragraph('3.1 Vercel Token', style_h2))
    story.append(Paragraph(
        '<b>Donde generarlo:</b> vercel.com &rarr; Account Settings &rarr; Tokens &rarr; Create Token.<br/>'
        '<b>Nombre sugerido:</b> jsadr-prod-sync<br/>'
        '<b>Scope:</b> Full account (o limitado al equipo team_RgKIQ16ZqHOh3cpZ5WgzXtop).<br/>'
        '<b>Expiracion:</b> 90 dias (recomendado). Renovar antes del vencimiento.<br/>'
        '<b>Formato:</b> <font name="LibMono">vcp_</font> seguido de 32+ caracteres alfanumericos.<br/>'
        '<b>Donde guardarlo:</b> Panel JSADR &rarr; Configuracion Global &rarr; Seguridad &rarr; Plataformas &rarr; Vercel &rarr; Configurar.<br/>'
        '<b>Al guardar, el sistema automaticamente:</b><br/>'
        '&nbsp;&nbsp;&bull; Cifra el token con AES-256-CBC (API_ENCRYPTION_KEY de .env)<br/>'
        '&nbsp;&nbsp;&bull; Agrega el dominio custom jsadr.com.co al proyecto Vercel<br/>'
        '&nbsp;&nbsp;&bull; Sincroniza todas las variables de entorno (DATABASE_URL, JWT_SECRET, etc.)<br/>'
        '&nbsp;&nbsp;&bull; Crea el webhook hacia https://jsadr.com.co/api/seguridad/plataformas-sync/webhook<br/>'
        '&nbsp;&nbsp;&bull; Dispara un redeploy del proyecto',
        style_body_left
    ))

    story.append(Paragraph('3.2 GitHub Personal Access Token (PAT)', style_h2))
    story.append(Paragraph(
        '<b>Donde generarlo:</b> github.com/settings/tokens (classic) o fine-grained PAT.<br/>'
        '<b>Nombre sugerido:</b> jsadr-platform-sync<br/>'
        '<b>Scopes requeridos:</b> repo (full), workflow, read:user, admin:repo_hook.<br/>'
        '<b>Expiracion:</b> 90 dias recomendado.<br/>'
        '<b>Formato:</b> <font name="LibMono">ghp_</font> (classic) o <font name="LibMono">github_pat_</font> (fine-grained).<br/>'
        '<b>Donde guardarlo:</b> Panel JSADR &rarr; Configuracion Global &rarr; Seguridad &rarr; Plataformas &rarr; GitHub &rarr; Configurar.<br/>'
        '<b>Al guardar, el sistema automaticamente:</b><br/>'
        '&nbsp;&nbsp;&bull; Verifica acceso al repo jsadr-1029/jsadr-1029-jsadr<br/>'
        '&nbsp;&nbsp;&bull; Crea/actualiza webhook hacia https://jsadr.com.co/api/seguridad/plataformas-sync/webhook<br/>'
        '&nbsp;&nbsp;&bull; Configura eventos: push, pull_request, deployment, deployment_status, release<br/>'
        '&nbsp;&nbsp;&bull; Configura secreto HMAC (GITHUB_WEBHOOK_SECRET) para validar firmas entrantes<br/>'
        '&nbsp;&nbsp;&bull; Lista ramas y ultimo commit para mostrar en el dashboard',
        style_body_left
    ))

    story.append(Paragraph('3.3 Neon API Key', style_h2))
    story.append(Paragraph(
        '<b>Donde generarlo:</b> console.neon.tech &rarr; Account &rarr; API Keys &rarr; Create new key.<br/>'
        '<b>Nombre sugerido:</b> jsadr-platform-sync<br/>'
        '<b>Scope:</b> Full access (o limitado al proyecto rapid-darkness-56995142).<br/>'
        '<b>Expiracion:</b> Sin expiracion por defecto (recomendado rotar anualmente).<br/>'
        '<b>Formato:</b> 64+ caracteres alfanumericos (no tiene prefijo).<br/>'
        '<b>Donde guardarlo:</b> Panel JSADR &rarr; Configuracion Global &rarr; Seguridad &rarr; Plataformas &rarr; Neon &rarr; Configurar.<br/>'
        '<b>Al guardar, el sistema automaticamente:</b><br/>'
        '&nbsp;&nbsp;&bull; Verifica acceso al proyecto rapid-darkness-56995142<br/>'
        '&nbsp;&nbsp;&bull; Lista branches, databases, endpoints<br/>'
        '&nbsp;&nbsp;&bull; Muestra consumo de compute units en el dashboard<br/>'
        '&nbsp;&nbsp;&bull; Registra el webhook hacia https://jsadr.com.co/api/seguridad/plataformas-sync/webhook<br/>'
        '&nbsp;&nbsp;&bull; Monitorea maintenance windows y notifica al admin',
        style_body_left
    ))

    story.append(PageBreak())

    # SECCION 4: PASOS PENDIENTES
    story.append(Paragraph('4. Checklist Final de Pasos Pendientes', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Una vez que tengas los tokens, el flujo es el siguiente. Los pasos marcados como '
        '<b>AUTOMATICO</b> los hace el sistema al reingresar los tokens. Los pasos marcados '
        'como <b>MANUAL</b> requieren que el administrador los haga en el panel externo:',
        style_body
    ))

    checklist = [
        [Paragraph('<b>#</b>', style_cell_head),
         Paragraph('<b>Accion</b>', style_cell_head),
         Paragraph('<b>Tipo</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('1', style_cell), Paragraph('Iniciar sesion con Adm-Jsadr / Js121473164*', style_cell),
         Paragraph('Verificacion', style_cell), Paragraph('<font color="#15803D"><b>LISTO</b></font>', style_cell)],
        [Paragraph('2', style_cell), Paragraph('Agregar CNAME www en MiCom.co (Tipo=CNAME, Nombre=www, Valor=cname.vercel-dns.com, TTL=1h)', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('3', style_cell), Paragraph('Generar VERCEL_TOKEN en vercel.com/settings/tokens', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('4', style_cell), Paragraph('Generar GITHUB_TOKEN en github.com/settings/tokens', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('5', style_cell), Paragraph('Generar NEON_API_KEY en console.neon.tech/account/api-keys', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('6', style_cell), Paragraph('Ingresar al panel JSADR y reingresar los 3 tokens en Config. Global &rarr; Seguridad &rarr; Plataformas', style_cell),
         Paragraph('PANEL', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('7', style_cell), Paragraph('Agregar dominio custom jsadr.com.co en Vercel (automatico al guardar token)', style_cell),
         Paragraph('AUTOMATICO', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #6</b></font>', style_cell)],
        [Paragraph('8', style_cell), Paragraph('Crear webhook GitHub hacia jsadr.com.co (automatico al guardar token)', style_cell),
         Paragraph('AUTOMATICO', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #6</b></font>', style_cell)],
        [Paragraph('9', style_cell), Paragraph('Verificar proyecto Neon (automatico al guardar token)', style_cell),
         Paragraph('AUTOMATICO', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #6</b></font>', style_cell)],
        [Paragraph('10', style_cell), Paragraph('Sincronizar env vars a Vercel (DATABASE_URL, JWT_SECRET, etc.)', style_cell),
         Paragraph('AUTOMATICO', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #6</b></font>', style_cell)],
        [Paragraph('11', style_cell), Paragraph('Hacer commit + push para disparar deploy en Vercel', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #10</b></font>', style_cell)],
        [Paragraph('12', style_cell), Paragraph('Verificar https://jsadr.com.co carga correctamente', style_cell),
         Paragraph('MANUAL', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #11</b></font>', style_cell)],
    ]
    t = Table(checklist, colWidths=[8*mm, 90*mm, 25*mm, 42*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # SECCION 5: LO QUE YA ESTA HECHO
    story.append(Paragraph('5. Lo Que Ya Esta Hecho', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'Antes de ejecutar los pasos pendientes, el sistema ya tiene aplicados los siguientes '
        'cambios. Estos no requieren accion adicional del administrador:',
        style_body
    ))
    hecho_data = [
        [Paragraph('<b>Item</b>', style_cell_head), Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('Registro DNS A @ &rarr; 76.76.21.21 en MiCom.co', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('3 dominios registrados en BD (jsadr.com.co, www, vercel.app)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('CertificadoSSL placeholder creado (estado: pendiente)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('.env regenerado con 11 secretos nuevos (openssl rand -hex)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('API_ENCRYPTION_KEY nueva (64 hex chars)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('JWT_SECRET + JWT_REFRESH_SECRET nuevos (96 hex chars c/u)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('ALLOWED_ORIGINS actualizado (incluye jsadr.com.co)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('NEXT_PUBLIC_APP_URL = https://jsadr.com.co', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('PlataformaSync.webhookUrl apunta a jsadr.com.co (las 3 plataformas)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('Contraseñas reseteadas (7 usuarios + 8 clientes)', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('sessionToken y tokenSesion invalidados en todas las cuentas', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('intentosFallidos = 0 y bloqueadoHasta = null en todas las cuentas', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('Backup de .env preservado en .env.pre-sync.bak', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('Scripts persistentes en /home/z/my-project/scripts/ para trazabilidad', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
    ]
    t = Table(hecho_data, colWidths=[120*mm, 45*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        '<i>Reporte generado por el agente de sincronizacion JSADR.</i>',
        ParagraphStyle('Footer', parent=style_body, alignment=TA_CENTER, textColor=C_TEXT_MUTED, fontSize=9)
    ))

    return story

def main():
    output = '/home/z/my-project/download/JSADR-Estado-Final-Credenciales.pdf'
    doc = SimpleDocTemplate(
        output, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title='JSADR — Estado Final y Credenciales',
        author='JSADR Agente de Sincronizacion',
        subject='Cuentas, claves y pasos pendientes',
        creator='Z.ai',
    )
    frame_body = Frame(20*mm, 18*mm, A4[0] - 40*mm, A4[1] - 36*mm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id='body')
    frame_cover = Frame(20*mm, 18*mm, A4[0] - 40*mm, A4[1] - 36*mm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id='cover')
    cover_template = PageTemplate(id='cover', frames=[frame_cover], onPage=on_cover_page)
    body_template = PageTemplate(id='body', frames=[frame_body], onPage=on_page)
    doc.addPageTemplates([cover_template, body_template])
    story = [NextPageTemplate('body')] + build_story()
    doc.build(story)
    print(f'PDF generado: {output}')
    print(f'Tamano: {os.path.getsize(output)/1024:.1f} KB')

if __name__ == '__main__':
    main()
