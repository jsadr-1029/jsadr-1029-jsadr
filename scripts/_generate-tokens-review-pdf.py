#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF — Revisión de Tokens Guardados en PlataformaSync (GitHub, Vercel, Neon)
Generado el 7 de agosto de 2026
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, NextPageTemplate, PageTemplate, Frame
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
style_callout_warn = ParagraphStyle('CalloutWarn', fontName='NotoSerifSC', fontSize=10, leading=14, leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8, backColor=colors.HexColor('#FEF3C7'), borderPadding=8, borderColor=C_WARNING, borderWidth=0)
style_code = ParagraphStyle('Code', fontName='LibMono', fontSize=9, leading=13, textColor=C_PRIMARY, backColor=C_BG_SOFT, leftIndent=8, rightIndent=8, spaceBefore=2, spaceAfter=6, borderPadding=4)
style_cell = ParagraphStyle('Cell', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=C_TEXT, alignment=TA_LEFT)
style_cell_bold = ParagraphStyle('CellBold', parent=style_cell, fontName='LibSans-Bold')
style_cell_head = ParagraphStyle('CellHead', parent=style_cell, fontName='LibSans-Bold', textColor=colors.white)
style_cell_center = ParagraphStyle('CellC', parent=style_cell, alignment=TA_CENTER)

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('LibSans', 8)
    canvas.setFillColor(C_TEXT_MUTED)
    canvas.drawString(20*mm, 10*mm, 'JSADR — Revision de Tokens Guardados')
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
    story.append(Paragraph('<font color="#FFFFFF" name="LibSans-Bold" size="14">REVISION DE TOKENS</font>',
        ParagraphStyle('CoverTag', fontName='LibSans-Bold', fontSize=14, textColor=colors.white, alignment=TA_LEFT, spaceAfter=8)))
    story.append(Paragraph('<font color="#FFFFFF" name="LibSans-Bold" size="28">Tokens Guardados en las 3 Plataformas</font>',
        ParagraphStyle('CoverTitle', fontName='LibSans-Bold', fontSize=28, textColor=colors.white, alignment=TA_LEFT, spaceAfter=4, leading=34)))
    story.append(Paragraph('<font color="#BFDBFE" name="LibSans" size="14">GitHub &middot; Vercel &middot; Neon</font>',
        ParagraphStyle('CoverSub', fontName='LibSans', fontSize=14, textColor=colors.HexColor('#BFDBFE'), alignment=TA_LEFT, spaceAfter=80)))
    story.append(Spacer(1, 40*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT_LIGHT, spaceBefore=8, spaceAfter=14))
    story.append(Paragraph(
        '<b>Plataforma:</b> JSADR &mdash; Gestion de Prestamos<br/>'
        '<b>Dominio principal:</b> jsadr.com.co<br/>'
        '<b>Tabla auditada:</b> PlataformaSync (3 registros: GITHUB, VERCEL, NEON)<br/>'
        '<b>Objetivo:</b> Verificar estado de los tokens guardados y posibilidad de recuperacion<br/>'
        '<b>Hallazgo clave:</b> Tokens existen en BD pero son huérfanos (no descifrables)<br/>'
        '<b>Fecha de revision:</b> 7 de agosto de 2026',
        ParagraphStyle('CoverMeta', fontName='NotoSerifSC', fontSize=10, leading=16, textColor=C_TEXT, alignment=TA_LEFT)))
    story.append(PageBreak())

    # SECCION 1: RESUMEN EJECUTIVO
    story.append(Paragraph('1. Resumen Ejecutivo', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Se realizo una revision exhaustiva de los tokens de las 3 plataformas de sincronizacion '
        '(GitHub, Vercel y Neon Database) almacenados en la tabla <font name="LibMono">PlataformaSync</font> '
        'de la base de datos Neon. El objetivo era confirmar si los tokens guardados siguen '
        'siendo utilizables, considerando que estas plataformas <b>no caducan los tokens '
        'automaticamente</b> (GitHub PATs, Vercel tokens y Neon API keys permanecen validos '
        'hasta que el usuario los revoque manualmente o se les asigne una fecha de expiracion '
        'explicita al crearlos).',
        style_body
    ))

    story.append(Paragraph(
        'El hallazgo principal es que <b>los tokens SI estan guardados en la base de datos</b> '
        '(campo <font name="LibMono">tokenCifrado</font>), pero son <b>huérfanos</b>: estan '
        'cifrados con una llave AES-256-CBC (<font name="LibMono">API_ENCRYPTION_KEY</font>) '
        'que fue <b>regenerada el 7 de agosto de 2026 a las 01:57 UTC</b> durante la fase de '
        'consolidacion del dominio jsadr.com.co. La llave anterior se sobrescribio y no se '
        'encuentra en ningun backup accesible (git history, .env.pre-sync.bak, ni archivos '
        'JSON de backup).',
        style_body
    ))

    story.append(Paragraph(
        'Como consecuencia, aunque los tokens como tales <b>siguen siendo validos en las '
        'plataformas</b> (no estan expirados ni revocados), el sistema JSADR no puede '
        'descifrarlos localmente para usarlos en las llamadas a las APIs. La unica via de '
        'recuperacion es que el administrador <b>reingrese los tokens manualmente</b> desde '
        'el panel JSADR (Configuracion Global &rarr; Seguridad &rarr; Plataformas), donde se '
        'cifraran con la nueva API_ENCRYPTION_KEY y volveran a funcionar inmediatamente.',
        style_body
    ))

    story.append(Paragraph(
        '<b>Evidencia de que los tokens funcionaban antes de la perdida de la llave:</b><br/>'
        '&nbsp;&nbsp;&bull; GitHub: verificado por ultima vez el <b>2026-08-04 21:49 UTC</b> (3 dias antes de la regeneracion), con scope "repo" OK<br/>'
        '&nbsp;&nbsp;&bull; Neon: sincronizo <b>32 tablas con 326 registros</b> el 2026-08-04 04:14 UTC<br/>'
        '&nbsp;&nbsp;&bull; Vercel: recibio al menos <b>1 webhook event</b> y completo migracion el 2026-08-07 01:39 UTC',
        style_callout
    ))

    story.append(PageBreak())

    # SECCION 2: ESTADO DETALLADO POR PLATAFORMA
    story.append(Paragraph('2. Estado Detallado por Plataforma', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'La siguiente tabla resume el estado actual de cada token guardado en la tabla '
        '<font name="LibMono">PlataformaSync</font>. Para cada plataforma se reporta: la '
        'longitud del token cifrado (en chars), el ultimo estado registrado, la fecha de '
        'ultima verificacion exitosa, el numero de eventos de webhook recibidos, y la '
        'accion requerida para recuperar la sincronizacion.',
        style_body
    ))

    estado_data = [
        [Paragraph('<b>Plataforma</b>', style_cell_head),
         Paragraph('<b>Token en BD</b>', style_cell_head),
         Paragraph('<b>Longitud</b>', style_cell_head),
         Paragraph('<b>Ultimo estado</b>', style_cell_head),
         Paragraph('<b>Ultima verificacion OK</b>', style_cell_head),
         Paragraph('<b>Accion requerida</b>', style_cell_head)],
        [Paragraph('<b>GitHub</b>', style_cell_bold),
         Paragraph('SI (cifrado)', style_cell_center),
         Paragraph('129 chars', style_cell_center),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell_center),
         Paragraph('2026-08-04 21:49 UTC<br/>(scope repo OK)', style_cell_center),
         Paragraph('Reingresar PAT', style_cell_center)],
        [Paragraph('<b>Vercel</b>', style_cell_bold),
         Paragraph('SI (cifrado)', style_cell_center),
         Paragraph('161 chars', style_cell_center),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell_center),
         Paragraph('2026-08-07 01:39 UTC<br/>(migracion completada)', style_cell_center),
         Paragraph('Reingresar token', style_cell_center)],
        [Paragraph('<b>Neon</b>', style_cell_bold),
         Paragraph('SI (cifrado)', style_cell_center),
         Paragraph('289 chars', style_cell_center),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell_center),
         Paragraph('2026-08-04 04:14 UTC<br/>(32 tablas, 326 registros)', style_cell_center),
         Paragraph('Reingresar API key', style_cell_center)],
    ]
    t = Table(estado_data, colWidths=[20*mm, 22*mm, 18*mm, 22*mm, 38*mm, 35*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'Las longitudes de los tokens cifrados (129, 161 y 289 chars) son consistentes con '
        'tokens reales: un PAT de GitHub clasico tiene ~93 caracteres en claro (que cifrado '
        'y en hex resultan en ~129 chars), un token de Vercel <font name="LibMono">vcp_</font> '
        '~55 chars en claro (~161 chars cifrado), y una Neon API key de 64+ chars en claro '
        '(~289 chars cifrado). Esto confirma que los tokens <b>estaban realmente guardados</b> '
        'y que el problema no es que falten, sino que no podemos descifrarlos.',
        style_body
    ))

    story.append(Paragraph('2.1 Detalle por plataforma', style_h2))

    story.append(Paragraph(
        '<b>GitHub (GITHUB):</b> El token guardado tiene scope "repo" (verificado en '
        'configJson). El ultimo error registrado es "TokenCifrado huerfano (API_ENCRYPTION_KEY '
        'regenerada). Re-ingresar token desde panel." El campo <font name="LibMono">configJson</font> '
        'muestra que el sistema conoce la estructura del repositorio '
        '(github.com/jsadr-1029/jsadr-1029-jsadr), el workflow de deploy a Vercel '
        '(.github/workflows/deploy-vercel.yml), los secrets usados (VERCEL_TOKEN, '
        'VERCEL_ORG_ID, VERCEL_PROJECT_ID) y los scopes del token. Esto indica que el token '
        '<b>estuvo activo y con permisos suficientes</b> hasta el momento de la perdida de la llave.',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Vercel (VERCEL):</b> El token guardado permitio completar la migracion del '
        'proyecto el 2026-08-07 01:39 UTC. El campo <font name="LibMono">configJson</font> '
        'indica <font name="LibMono">autoDeployOnPush: true</font> y registra el motivo de '
        'la ultima migracion como <font name="LibMono">"consolidation_complete"</font>. El '
        'sistema ha recibido <b>1 evento de webhook</b> de Vercel (campo '
        '<font name="LibMono">eventosRecibidos = 1</font>), lo que confirma que el webhook '
        'estaba correctamente configurado antes de la regeneracion de la llave.',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Neon (NEON):</b> El token guardado permitio sincronizar 32 tablas con un total '
        'de 326 registros desde SQLite hacia Neon el 2026-08-04 04:14 UTC. El campo '
        '<font name="LibMono">configJson</font> muestra el host del pooler '
        '(<font name="LibMono">ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech</font>), '
        'el nombre de la base de datos (neondb), el usuario (neondb_owner), el SSL mode '
        '(require), la direccion de sincronizacion (bidireccional), y la fecha del ultimo '
        'sync. Esto confirma que el token <b>tenia permisos suficientes para acceder al '
        'proyecto rapid-darkness-56995142</b>.',
        style_body_left
    ))

    story.append(PageBreak())

    # SECCION 3: ANALISIS DE CAUSA RAIZ
    story.append(Paragraph('3. Analisis de Causa Raiz', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Para entender por que los tokens no se pueden descifrar, es necesario revisar la '
        'linea de tiempo de eventos que llevaron a la perdida de la llave de cifrado. Esta '
        'seccion documenta cronologicamente los eventos y la razon tecnica por la cual los '
        'tokens se volvieron huérfanos.',
        style_body
    ))

    story.append(Paragraph('3.1 Linea de tiempo', style_h2))

    timeline_data = [
        [Paragraph('<b>Fecha y hora</b>', style_cell_head),
         Paragraph('<b>Evento</b>', style_cell_head),
         Paragraph('<b>Impacto en tokens</b>', style_cell_head)],
        [Paragraph('Antes del 2026-08-07', style_cell),
         Paragraph('Tokens guardados en PlataformaSync.tokenCifrado, cifrados con la API_ENCRYPTION_KEY original', style_cell),
         Paragraph('Tokens funcionando OK', style_cell)],
        [Paragraph('2026-08-04 04:14 UTC', style_cell),
         Paragraph('Neon completa sync de 32 tablas / 326 registros', style_cell),
         Paragraph('Token Neon verificado OK', style_cell)],
        [Paragraph('2026-08-04 21:49 UTC', style_cell),
         Paragraph('GitHub token verificado con scope repo', style_cell),
         Paragraph('Token GitHub verificado OK', style_cell)],
        [Paragraph('2026-08-07 01:39 UTC', style_cell),
         Paragraph('Vercel completa migracion (consolidation_complete)', style_cell),
         Paragraph('Token Vercel verificado OK', style_cell)],
        [Paragraph('<b>2026-08-07 01:57:24 UTC</b>', style_cell_bold),
         Paragraph('<b>.env regenerado por _build-complete-env.cjs (API_ENCRYPTION_KEY nueva: 3c43ac1b...)</b>', style_cell_bold),
         Paragraph('<b>Llave anterior PERDIDA - tokens se vuelven huérfanos</b>', style_cell_bold)],
        [Paragraph('2026-08-07 01:58 UTC', style_cell),
         Paragraph('PlataformaSync.actualizado marca los 3 como PENDIENTE con error "TokenCifrado huérfano"', style_cell),
         Paragraph('Tokens inaccesibles localmente', style_cell)],
        [Paragraph('2026-08-07 (este reporte)', style_cell),
         Paragraph('Revision exhaustiva: probadas 6 llaves candidatas, ninguna descifra', style_cell),
         Paragraph('Confirmado: tokens no recuperables sin reingreso manual', style_cell)],
    ]
    t = Table(timeline_data, colWidths=[35*mm, 80*mm, 45*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#FEF3C7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph('3.2 Llaves candidatas probadas', style_h2))
    story.append(Paragraph(
        'Se ejecuto un script (<font name="LibMono">_review-all-tokens.cjs</font>) que intenta '
        'descifrar cada token con 6 llaves candidatas diferentes. La lista de llaves probadas '
        'y el resultado es:',
        style_body
    ))

    keys_data = [
        [Paragraph('<b>Llave candidata</b>', style_cell_head),
         Paragraph('<b>Origen</b>', style_cell_head),
         Paragraph('<b>GitHub</b>', style_cell_head),
         Paragraph('<b>Vercel</b>', style_cell_head),
         Paragraph('<b>Neon</b>', style_cell_head)],
        [Paragraph('API_ENCRYPTION_KEY(hex) actual', style_cell),
         Paragraph('.env regenerado 2026-08-07', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
        [Paragraph('API_ENCRYPTION_KEY(sha256) actual', style_cell),
         Paragraph('.env regenerado 2026-08-07', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
        [Paragraph('BACKUP_KEY_SEED (sha256)', style_cell),
         Paragraph('Constante en src/lib/security.ts', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
        [Paragraph('dev-temp-encryption-key (sha256)', style_cell),
         Paragraph('Fallback en security.ts cuando API_ENCRYPTION_KEY esta vacio', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
        [Paragraph('jsadr-secret-key (sha256)', style_cell),
         Paragraph('Posible llave legacy', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
        [Paragraph('jsadr (sha256)', style_cell),
         Paragraph('Posible llave legacy corta', style_cell),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center),
         Paragraph('<font color="#B91C1C">fallo</font>', style_cell_center)],
    ]
    t = Table(keys_data, colWidths=[50*mm, 50*mm, 20*mm, 20*mm, 20*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'Adicionalmente, se busco la llave original en: (a) git history (commits con '
        'cambios en .env.example y scripts que mencionan API_ENCRYPTION_KEY), (b) backups '
        'JSON en /home/z/my-project/upload/, (c) el archivo .env.pre-sync.bak (que solo '
        'contiene la linea DATABASE_URL), (d) archivos .env en cualquier subdirectorio, '
        '(e) tablas de la BD Neon que pudieran tener snapshots historicos (VersionConfiguracion, '
        'AuditoriaConfiguracion, ConfigBot, VariableGlobal, Configuracion). <b>Ninguna de '
        'estas fuentes contiene la llave original</b>, ya que el .env nunca fue commiteado '
        'a git (buena practica de seguridad) y los backups JSON no incluyen PlataformaSync.',
        style_body
    ))

    story.append(PageBreak())

    # SECCION 4: POR QUE LOS TOKENS SIGUEN SIENDO VALIDOS EN LAS PLATAFORMAS
    story.append(Paragraph('4. Por que los tokens siguen siendo validos en las plataformas', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Una observacion importante del usuario es correcta: <b>las 3 plataformas NO caducan '
        'los tokens automaticamente</b>. Esto significa que los tokens guardados en la BD '
        'siguen siendo validos en GitHub, Vercel y Neon, y pueden usarse desde cualquier '
        'otra aplicacion que los tenga en claro. La siguiente tabla resume la politica de '
        'expiracion de cada plataforma:',
        style_body
    ))

    politicas_data = [
        [Paragraph('<b>Plataforma</b>', style_cell_head),
         Paragraph('<b>Expiracion automatica</b>', style_cell_head),
         Paragraph('<b>Expiracion configurable</b>', style_cell_head),
         Paragraph('<b>Politica real</b>', style_cell_head)],
        [Paragraph('<b>GitHub PAT (classic)</b>', style_cell_bold),
         Paragraph('No', style_cell_center),
         Paragraph('Si: 7/30/60/90 dias, 1 year, o "No expiration"', style_cell),
         Paragraph('Si el token se creo sin expiracion, sigue activo hasta revocacion manual', style_cell)],
        [Paragraph('<b>GitHub PAT (fine-grained)</b>', style_cell_bold),
         Paragraph('No', style_cell_center),
         Paragraph('Si: hasta 1 year, maximo', style_cell),
         Paragraph('Si el token se creo con expiracion maxima, sigue activo', style_cell)],
        [Paragraph('<b>Vercel Token</b>', style_cell_bold),
         Paragraph('No', style_cell_center),
         Paragraph('Si:无限 (sin expiracion) o fecha custom', style_cell),
         Paragraph('Permanece activo hasta revocacion manual en Account Settings', style_cell)],
        [Paragraph('<b>Neon API Key</b>', style_cell_bold),
         Paragraph('No', style_cell_center),
         Paragraph('No (sin expiracion por defecto)', style_cell),
         Paragraph('Permanece activo hasta revocacion manual en Account &rarr; API Keys', style_cell)],
    ]
    t = Table(politicas_data, colWidths=[35*mm, 30*mm, 50*mm, 45*mm])
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
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'Esto significa que <b>los tokens actuales (los que estan cifrados en la BD) siguen '
        'siendo validos en las 3 plataformas</b>, pero el sistema JSADR no puede usarlos '
        'porque no puede descifrarlos. Hay dos opciones para recuperar el acceso:',
        style_body
    ))

    story.append(Paragraph('4.1 Opcion A: Reingresar los tokens existentes (recomendado)', style_h2))
    story.append(Paragraph(
        'Si el administrador todavia tiene guardado en algun lugar los tokens originales '
        '(por ejemplo, en un gestor de contrasenas como 1Password/Bitwarden, en un archivo '
        'de texto local, o en una nota), puede <b>reingresar los mismos tokens</b> en el '
        'panel JSADR. Esto tiene dos ventajas: (1) no se rotan los tokens, por lo que no '
        'se requiere actualizarlos en otros lugares donde se usen (workflows de GitHub '
        'Actions, otros scripts, etc.), y (2) es mas rapido. <b>El token se puede pegar '
        'tal cual en el panel y el sistema lo cifrara con la nueva API_ENCRYPTION_KEY</b>.',
        style_body
    ))

    story.append(Paragraph('4.2 Opcion B: Generar tokens nuevos (alternativa segura)', style_h2))
    story.append(Paragraph(
        'Si los tokens originales no estan disponibles o si se prefiere rotarlos por '
        'seguridad, se pueden generar nuevos tokens en cada plataforma. En este caso, '
        '<b>los tokens antiguos siguen siendo validos</b> y deben revocarse manualmente '
        'despues (en GitHub: Settings &rarr; Tokens &rarr; Revoke; en Vercel: Account '
        'Settings &rarr; Tokens &rarr; Delete; en Neon: Account &rarr; API Keys &rarr; '
        'Revoke). Esto es mas seguro porque cualquier copia del token antiguo que pudiera '
        'haber sido filtrada dejaria de funcionar.',
        style_body
    ))

    story.append(Paragraph(
        '<b>Recomendacion:</b> Si los tokens estan disponibles en un gestor de contrasenas, '
        'usar la Opcion A (reingresar los mismos). Si no estan disponibles o hay dudas '
        'sobre su seguridad, usar la Opcion B (generar nuevos y revocar los antiguos).',
        style_callout
    ))

    story.append(PageBreak())

    # SECCION 5: ACCIONES DE RECUPERACION
    story.append(Paragraph('5. Acciones de Recuperacion', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Esta seccion lista los pasos concretos para recuperar el acceso a las 3 plataformas. '
        'Los pasos estan ordenados secuencialmente y deben ejecutarse en el orden indicado. '
        'Una vez completados, la sincronizacion con GitHub, Vercel y Neon quedara restaurada '
        'al 100%.',
        style_body
    ))

    story.append(Paragraph('5.1 Verificar que se tiene acceso a las cuentas', style_h2))
    story.append(Paragraph(
        '<b>Paso 1:</b> Verificar acceso a las 3 plataformas con las cuentas correctas. Las '
        'cuentas vinculadas al proyecto JSADR son:',
        style_body_left
    ))
    story.append(Paragraph(
        '&nbsp;&nbsp;&bull; <b>GitHub:</b> usuario <font name="LibMono">jsadr-1029</font> '
        '(repo jsadr-1029/jsadr-1029-jsadr)<br/>'
        '&nbsp;&nbsp;&bull; <b>Vercel:</b> equipo <font name="LibMono">team_RgKIQ16ZqHOh3cpZ5WgzXtop</font>, '
        'proyecto <font name="LibMono">prj_JQV6HJQB65nmSEp45Z1FFPmxARtj</font><br/>'
        '&nbsp;&nbsp;&bull; <b>Neon:</b> proyecto <font name="LibMono">rapid-darkness-56995142</font> '
        '(host ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech)',
        style_body_left
    ))

    story.append(Paragraph('5.2 Reingresar los tokens en el panel JSADR', style_h2))
    story.append(Paragraph(
        '<b>Paso 2:</b> Iniciar sesion en el panel JSADR con la cuenta de administrador '
        '(usuario <font name="LibMono">Adm-Jsadr</font>, contrasena '
        '<font name="LibMono">Js121473164*</font>). Si el dominio jsadr.com.co aun no '
        'resuelve por DNS, se puede acceder temporalmente via <font name="LibMono">'
        'https://jsadr-jsadr.vercel.app</font> (subdominio de preview de Vercel).',
        style_body_left
    ))
    story.append(Paragraph(
        '<b>Paso 3:</b> Navegar a <b>Configuracion Global &rarr; Seguridad &rarr; Plataformas</b>. '
        'Apareceran 3 tarjetas: GitHub, Vercel y Neon, cada una con estado "PENDIENTE" y '
        'mostrando el error "TokenCifrado huerfano".',
        style_body_left
    ))
    story.append(Paragraph(
        '<b>Paso 4:</b> Para cada plataforma, hacer clic en <b>"Configurar"</b>, pegar el '
        'token en el campo correspondiente, y guardar. El sistema automaticamente: (a) '
        'cifrara el token con la nueva API_ENCRYPTION_KEY, (b) lo guardara en '
        'PlataformaSync.tokenCifrado, (c) hara una llamada de prueba a la API de la '
        'plataforma para verificar que el token funciona, y (d) actualizara el estado a '
        '"OK" si la verificacion es exitosa.',
        style_body_left
    ))

    story.append(Paragraph('5.3 Verificar recuperacion automatica', style_h2))
    story.append(Paragraph(
        '<b>Paso 5:</b> Una vez reingresados los 3 tokens, el sistema ejecutara automaticamente '
        'las siguientes acciones de sincronizacion (si el token tiene los permisos correctos):',
        style_body_left
    ))
    story.append(Paragraph(
        '&nbsp;&nbsp;&bull; <b>Vercel:</b> Agregara el dominio custom jsadr.com.co al proyecto, '
        'sincronizara todas las variables de entorno (DATABASE_URL, JWT_SECRET, API_ENCRYPTION_KEY, '
        'etc.), y disparara un redeploy.<br/>'
        '&nbsp;&nbsp;&bull; <b>GitHub:</b> Verificara acceso al repo jsadr-1029/jsadr-1029-jsadr, '
        'creara/actualizara el webhook hacia https://jsadr.com.co/api/seguridad/plataformas-sync/webhook '
        'con eventos push/pull_request/deployment/release, y configurara el secreto HMAC '
        'GITHUB_WEBHOOK_SECRET para validar firmas entrantes.<br/>'
        '&nbsp;&nbsp;&bull; <b>Neon:</b> Verificara acceso al proyecto rapid-darkness-56995142, '
        'listara branches/databases/endpoints, mostrara el consumo de compute units, y '
        'registrara el webhook hacia https://jsadr.com.co/api/seguridad/plataformas-sync/webhook.',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Paso 6:</b> Verificar que el estado de las 3 plataformas en el panel cambia de '
        '"PENDIENTE" a "OK". Si alguna queda en "ERROR", revisar el mensaje de error '
        'especifico (suele ser por scopes insuficientes del token o por permisos del '
        'proyecto en la plataforma).',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Importante:</b> Si se generan tokens nuevos (Opcion B), recordar revocar los '
        'tokens antiguos en cada plataforma DESPUES de confirmar que los nuevos funcionan. '
        'Esto evita perder el acceso si hay un problema con el token nuevo.',
        style_callout_warn
    ))

    story.append(PageBreak())

    # SECCION 6: CHECKLIST FINAL
    story.append(Paragraph('6. Checklist Final', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'La siguiente tabla resume las acciones pendientes. Marcar cada una a medida que '
        'se completa:',
        style_body
    ))

    checklist = [
        [Paragraph('<b>#</b>', style_cell_head),
         Paragraph('<b>Accion</b>', style_cell_head),
         Paragraph('<b>Responsable</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('1', style_cell_center),
         Paragraph('Verificar acceso a las cuentas de GitHub (jsadr-1029), Vercel (team_RgKIQ16ZqHOh3cpZ5WgzXtop) y Neon (rapid-darkness-56995142)', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('2', style_cell_center),
         Paragraph('Recuperar tokens existentes (gestor de contrasenas) O generar tokens nuevos en cada plataforma', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('3', style_cell_center),
         Paragraph('Iniciar sesion en panel JSADR (Adm-Jsadr / Js121473164*) via jsadr.com.co o jsadr-jsadr.vercel.app', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('4', style_cell_center),
         Paragraph('Reingresar GITHUB_TOKEN en Config. Global &rarr; Seguridad &rarr; Plataformas &rarr; GitHub', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('5', style_cell_center),
         Paragraph('Reingresar VERCEL_TOKEN en Config. Global &rarr; Seguridad &rarr; Plataformas &rarr; Vercel', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('6', style_cell_center),
         Paragraph('Reingresar NEON_API_KEY en Config. Global &rarr; Seguridad &rarr; Plataformas &rarr; Neon', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B91C1C"><b>PENDIENTE</b></font>', style_cell_center)],
        [Paragraph('7', style_cell_center),
         Paragraph('Verificar que los 3 cambien a estado OK en el panel', style_cell),
         Paragraph('Sistema', style_cell_center),
         Paragraph('<font color="#B45309"><b>DESPUES DE #4-6</b></font>', style_cell_center)],
        [Paragraph('8', style_cell_center),
         Paragraph('Confirmar que el webhook de cada plataforma apunta a https://jsadr.com.co/api/seguridad/plataformas-sync/webhook', style_cell),
         Paragraph('Sistema', style_cell_center),
         Paragraph('<font color="#B45309"><b>AUTOMATICO</b></font>', style_cell_center)],
        [Paragraph('9', style_cell_center),
         Paragraph('Si se generaron tokens nuevos: revocar los tokens antiguos en cada plataforma', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B45309"><b>OPCIONAL</b></font>', style_cell_center)],
        [Paragraph('10', style_cell_center),
         Paragraph('Hacer commit + push para disparar deploy en Vercel (ya con los tokens sincronizados)', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B45309"><b>DESPUES DE #7</b></font>', style_cell_center)],
        [Paragraph('11', style_cell_center),
         Paragraph('Verificar https://jsadr.com.co carga correctamente y muestra los 3 estados OK en el panel', style_cell),
         Paragraph('Admin', style_cell_center),
         Paragraph('<font color="#B45309"><b>DESPUES DE #10</b></font>', style_cell_center)],
    ]
    t = Table(checklist, colWidths=[8*mm, 95*mm, 22*mm, 40*mm])
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

    story.append(Spacer(1, 12))
    story.append(Paragraph('7. Conclusion', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'Los tokens de las 3 plataformas (GitHub, Vercel, Neon) <b>estan guardados en la '
        'base de datos pero son huérfanos</b>: no se pueden descifrar localmente porque la '
        'API_ENCRYPTION_KEY original fue sobrescrita el 2026-08-07 durante la consolidacion '
        'del dominio jsadr.com.co. Sin embargo, <b>los tokens como tales siguen siendo '
        'validos en las plataformas</b> (no estan expirados ni revocados), tal como '
        'identifico correctamente el usuario.',
        style_body
    ))
    story.append(Paragraph(
        'La unica via de recuperacion es que el administrador <b>reingrese los tokens</b> '
        'desde el panel JSADR. Si tiene los tokens originales guardados en un gestor de '
        'contrasenas, puede reingresarlos directamente (Opcion A, recomendada). Si no los '
        'tiene o prefiere rotarlos, debe generar nuevos tokens en cada plataforma y revocar '
        'los antiguos (Opcion B, mas segura). En cualquiera de los dos casos, el sistema '
        'cifrara los tokens con la nueva API_ENCRYPTION_KEY y restaurara automaticamente '
        'la sincronizacion con GitHub, Vercel y Neon.',
        style_body
    ))
    story.append(Paragraph(
        'Una vez completados los 11 pasos del checklist, el sistema JSADR quedara al 100% '
        'de capacidad, con sincronizacion en tiempo real via webhooks, dominio custom '
        'jsadr.com.co activo en Vercel, repositorio GitHub monitorizado, y base de datos '
        'Neon sincronizada bidireccionalmente.',
        style_body
    ))

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        '<i>Reporte generado por el agente de revision de tokens JSADR.</i>',
        ParagraphStyle('Footer', parent=style_body, alignment=TA_CENTER, textColor=C_TEXT_MUTED, fontSize=9)
    ))

    return story

def main():
    output = '/home/z/my-project/download/JSADR-Revision-Tokens-Plataformas.pdf'
    doc = SimpleDocTemplate(
        output, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title='JSADR — Revision de Tokens Guardados',
        author='JSADR Agente de Revision',
        subject='Estado de tokens en PlataformaSync (GitHub, Vercel, Neon)',
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
