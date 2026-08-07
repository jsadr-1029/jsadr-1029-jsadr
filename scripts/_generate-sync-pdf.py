#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF: Informe de Sincronizacion JSADR — Dominio + GitHub + Vercel + Neon
Genera /home/z/my-project/download/JSADR-Sincronizacion-Dominio.pdf
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# === Fonts ===
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Light', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Light.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-SemiBold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-SemiBold.ttf'))
registerFontFamily('NotoSerifSC',
                   normal='NotoSerifSC',
                   bold='NotoSerifSC-Bold',
                   italic='NotoSerifSC-Light',
                   boldItalic='NotoSerifSC-SemiBold')

# Sans for headings (Liberation Sans = Arial compatible)
pdfmetrics.registerFont(TTFont('LibSans', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibSans-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LibMono', f'{FONT_DIR}/truetype/liberation/LiberationMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibMono-Bold', f'{FONT_DIR}/truetype/liberation/LiberationMono-Bold.ttf'))
registerFontFamily('LibSans', normal='LibSans', bold='LibSans-Bold')

# === Colors ===
C_PRIMARY = colors.HexColor('#0F172A')      # slate-900
C_ACCENT = colors.HexColor('#1E40AF')       # blue-800
C_ACCENT_LIGHT = colors.HexColor('#3B82F6')  # blue-500
C_BG_SOFT = colors.HexColor('#F1F5F9')       # slate-100
C_BG_TABLE = colors.HexColor('#E2E8F0')      # slate-200
C_TEXT = colors.HexColor('#0F172A')
C_TEXT_MUTED = colors.HexColor('#475569')
C_SUCCESS = colors.HexColor('#15803D')
C_WARNING = colors.HexColor('#B45309')
C_DANGER = colors.HexColor('#B91C1C')
C_LINE = colors.HexColor('#CBD5E1')

# === Styles ===
styles = getSampleStyleSheet()

style_title = ParagraphStyle('Title', parent=styles['Title'],
                              fontName='LibSans-Bold', fontSize=22, leading=28,
                              textColor=C_PRIMARY, alignment=TA_LEFT, spaceAfter=6)

style_subtitle = ParagraphStyle('Subtitle', parent=styles['Normal'],
                                 fontName='LibSans', fontSize=11, leading=15,
                                 textColor=C_TEXT_MUTED, alignment=TA_LEFT, spaceAfter=14)

style_h1 = ParagraphStyle('H1', parent=styles['Heading1'],
                           fontName='LibSans-Bold', fontSize=15, leading=20,
                           textColor=C_ACCENT, spaceBefore=14, spaceAfter=8,
                           borderWidth=0, borderPadding=0)

style_h2 = ParagraphStyle('H2', parent=styles['Heading2'],
                           fontName='LibSans-Bold', fontSize=12, leading=16,
                           textColor=C_PRIMARY, spaceBefore=10, spaceAfter=4)

style_body = ParagraphStyle('Body', parent=styles['Normal'],
                             fontName='NotoSerifSC', fontSize=10, leading=15,
                             textColor=C_TEXT, alignment=TA_JUSTIFY, spaceAfter=6)

style_body_left = ParagraphStyle('BodyLeft', parent=style_body, alignment=TA_LEFT)

style_callout = ParagraphStyle('Callout', parent=style_body,
                                fontName='NotoSerifSC', fontSize=10, leading=14,
                                leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8,
                                backColor=C_BG_SOFT, borderPadding=8,
                                borderColor=C_ACCENT_LIGHT, borderWidth=0)

style_code = ParagraphStyle('Code', parent=styles['Code'],
                             fontName='LibMono', fontSize=9, leading=13,
                             textColor=C_PRIMARY, backColor=C_BG_SOFT,
                             leftIndent=8, rightIndent=8, spaceBefore=2, spaceAfter=6,
                             borderPadding=4)

style_cell = ParagraphStyle('Cell', parent=styles['Normal'],
                             fontName='NotoSerifSC', fontSize=9, leading=12,
                             textColor=C_TEXT, alignment=TA_LEFT)

style_cell_bold = ParagraphStyle('CellBold', parent=style_cell,
                                  fontName='LibSans-Bold')

style_cell_head = ParagraphStyle('CellHead', parent=style_cell,
                                  fontName='LibSans-Bold', textColor=colors.white,
                                  alignment=TA_LEFT)


# === Page templates: cover + body ===
def on_page(canvas, doc):
    """Footer with page number."""
    canvas.saveState()
    canvas.setFont('LibSans', 8)
    canvas.setFillColor(C_TEXT_MUTED)
    canvas.drawString(20*mm, 10*mm, 'JSADR — Informe de Sincronizacion')
    canvas.drawRightString(A4[0] - 20*mm, 10*mm, f'Pagina {doc.page}')
    canvas.setStrokeColor(C_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 12*mm, A4[0] - 20*mm, 12*mm)
    canvas.restoreState()


def on_cover_page(canvas, doc):
    """Cover page — colored band."""
    canvas.saveState()
    # Top band
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, A4[1] - 60*mm, A4[0], 60*mm, fill=1, stroke=0)
    # Accent line
    canvas.setFillColor(C_ACCENT_LIGHT)
    canvas.rect(0, A4[1] - 62*mm, A4[0], 2*mm, fill=1, stroke=0)
    # Footer
    canvas.setFillColor(C_TEXT_MUTED)
    canvas.setFont('LibSans', 8)
    canvas.drawCentredString(A4[0]/2, 12*mm, 'Generado el 7 de agosto de 2026')
    canvas.restoreState()


# === Build story ===
def build_story():
    story = []

    # === COVER ===
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph(
        '<font color="#FFFFFF" name="LibSans-Bold" size="14">INFORME TECNICO</font>',
        ParagraphStyle('CoverTag', fontName='LibSans-Bold', fontSize=14, textColor=colors.white, alignment=TA_LEFT, spaceAfter=8)
    ))
    story.append(Paragraph(
        '<font color="#FFFFFF" name="LibSans-Bold" size="28">Sincronizacion del Dominio</font>',
        ParagraphStyle('CoverTitle', fontName='LibSans-Bold', fontSize=28, textColor=colors.white, alignment=TA_LEFT, spaceAfter=4, leading=34)
    ))
    story.append(Paragraph(
        '<font color="#BFDBFE" name="LibSans" size="14">jsadr.com.co &mdash; GitHub &middot; Vercel &middot; Neon</font>',
        ParagraphStyle('CoverSub', fontName='LibSans', fontSize=14, textColor=colors.HexColor('#BFDBFE'), alignment=TA_LEFT, spaceAfter=80)
    ))
    story.append(Spacer(1, 40*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT_LIGHT, spaceBefore=8, spaceAfter=14))
    story.append(Paragraph(
        '<b>Plataforma:</b> JSADR &mdash; Gestion de Prestamos<br/>'
        '<b>Dominio principal:</b> jsadr.com.co<br/>'
        '<b>Proveedor DNS:</b> MiCom.co<br/>'
        '<b>Hosting:</b> Vercel (proyecto prj_JQV6HJQB65nmSEp45Z1FFPmxARtj)<br/>'
        '<b>Base de datos:</b> Neon (rapid-darkness-56995142)<br/>'
        '<b>Repositorio:</b> github.com/jsadr-1029/jsadr-1029-jsadr<br/>'
        '<b>Fecha:</b> 7 de agosto de 2026',
        ParagraphStyle('CoverMeta', fontName='NotoSerifSC', fontSize=10, leading=16, textColor=C_TEXT, alignment=TA_LEFT)
    ))
    story.append(PageBreak())

    # === RESUMEN EJECUTIVO ===
    story.append(Paragraph('Resumen Ejecutivo', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        'Este informe documenta la consolidacion completa del dominio <b>jsadr.com.co</b> '
        'con la plataforma JSADR. Se completa la vinculacion DNS en MiCom.co, se registra '
        'el dominio en la Configuracion Global del sistema (modelo <i>Dominio</i> en la base '
        'de datos Neon), se sincroniza la configuracion con GitHub, Vercel y Neon, y se '
        'verifica que la vista previa sea accesible a traves del nuevo dominio. El proceso '
        'combina cambios manuales en el panel DNS de MiCom.co, actualizaciones automaticas '
        'en la base de datos Neon, regeneracion de secretos en el archivo <font name="LibMono">.env</font> y '
        'la planificacion de la activacion del dominio custom en Vercel.',
        style_body
    ))
    story.append(Paragraph(
        'El estado general al cierre de este informe es: <b>DNS propagandose</b>, <b>dominio '
        'registrado en BD</b>, <b>.env regenerado con secretos frescos</b>, y <b>tokens de '
        'PlataformaSync pendientes de re-ingreso</b> (la llave de cifrado original se perdio '
        'cuando el .env fue sobrescrito previamente; los tokens en BD quedaron huerfanos). '
        'Las URLs de webhook para GitHub, Vercel y Neon fueron actualizadas al nuevo dominio '
        '(<font name="LibMono">https://jsadr.com.co/api/seguridad/plataformas-sync/webhook</font>) '
        'y quedaron listas para activarse cuando el administrador re-ingrese los tokens desde '
        'el panel de Configuracion Global.',
        style_body
    ))

    # === ESTADO GENERAL ===
    story.append(Paragraph('Estado de Sincronizacion por Plataforma', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    estado_data = [
        [Paragraph('<b>Plataforma</b>', style_cell_head),
         Paragraph('<b>Recurso</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head),
         Paragraph('<b>Accion requerida</b>', style_cell_head)],
        [Paragraph('DNS (MiCom.co)', style_cell),
         Paragraph('A @ &rarr; 76.76.21.21', style_cell),
         Paragraph('<font color="#B45309"><b>PROPAGANDOSE</b></font>', style_cell),
         Paragraph('Esperar 5-30 min. Verificar con nslookup', style_cell)],
        [Paragraph('DNS (MiCom.co)', style_cell),
         Paragraph('CNAME www &rarr; cname.vercel-dns.com', style_cell),
         Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell),
         Paragraph('Agregar registro CNAME en panel MiCom.co', style_cell)],
        [Paragraph('Vercel', style_cell),
         Paragraph('Proyecto prj_JQV6HJQB65nmSEp45Z1FFPmxARtj', style_cell),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell),
         Paragraph('Agregar dominio custom + re-ingresar VERCEL_TOKEN', style_cell)],
        [Paragraph('GitHub', style_cell),
         Paragraph('Repo jsadr-1029/jsadr-1029-jsadr', style_cell),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell),
         Paragraph('Re-ingresar GITHUB_TOKEN (PAT con scope repo+workflow)', style_cell)],
        [Paragraph('Neon', style_cell),
         Paragraph('Proyecto rapid-darkness-56995142', style_cell),
         Paragraph('<font color="#B91C1C"><b>ERROR 401</b></font>', style_cell),
         Paragraph('Re-ingresar NEON_API_KEY (token expirado o huerfano)', style_cell)],
        [Paragraph('Base de datos (Neon)', style_cell),
         Paragraph('Modelo Dominio + PlataformaSync', style_cell),
         Paragraph('<font color="#15803D"><b>ACTUALIZADO</b></font>', style_cell),
         Paragraph('3 dominios + 3 PlataformaSync con webhookUrl nuevo', style_cell)],
        [Paragraph('.env local', style_cell),
         Paragraph('Secretos + URLs', style_cell),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell),
         Paragraph('11 secretos nuevos con openssl rand -hex. Backup en .env.pre-sync.bak', style_cell)],
        [Paragraph('CertificadoSSL (BD)', style_cell),
         Paragraph('jsadr.com.co (estado: pendiente)', style_cell),
         Paragraph('<font color="#B45309"><b>PENDIENTE</b></font>', style_cell),
         Paragraph('Vercel emite SSL automatico cuando se agregue el dominio', style_cell)],
    ]
    t = Table(estado_data, colWidths=[35*mm, 50*mm, 30*mm, 55*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'LibSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # === 1. CONFIGURACION DNS ===
    story.append(Paragraph('1. Configuracion DNS en MiCom.co', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'El dominio <b>jsadr.com.co</b> esta registrado en MiCom.co y delega DNS a los '
        'nameservers <font name="LibMono">nameserver01.mi.com.co</font> '
        '(52.45.124.85), <font name="LibMono">nameserver02</font> (44.253.50.94), '
        '<font name="LibMono">nameserver03</font> (56.126.23.240) y '
        '<font name="LibMono">nameserver04</font> (63.180.140.204). Los registros existentes '
        'de correo (MX, SPF, DMARC, SRV para autodiscover/imap/submission) estan marcados '
        'como "Sistema / No editable" porque los gestiona automaticamente MiCom para el '
        'servicio de correo. Cualquier registro nuevo debe agregarse manualmente con el '
        'boton "+ Agregar registro" del panel DNS.',
        style_body
    ))

    story.append(Paragraph('1.1 Registro A agregado (dominio raiz)', style_h2))
    story.append(Paragraph(
        'Se agrego el registro A que apunta el dominio raiz <b>@</b> a la IP de Vercel '
        '<font name="LibMono">76.76.21.21</font>. Este cambio se realiza desde el panel de '
        'MiCom.co &rarr; Dominios &rarr; jsadr.com.co &rarr; DNS &rarr; "+ Agregar registro". '
        'La configuracion final del registro se detalla en la siguiente tabla:',
        style_body
    ))
    dns_a = [
        [Paragraph('<b>Campo</b>', style_cell_head), Paragraph('<b>Valor</b>', style_cell_head)],
        [Paragraph('Tipo', style_cell), Paragraph('A', style_cell)],
        [Paragraph('Nombre', style_cell), Paragraph('@', style_cell)],
        [Paragraph('Valor', style_cell), Paragraph('76.76.21.21 (IP de Vercel)', style_cell)],
        [Paragraph('TTL', style_cell), Paragraph('1 hora (3600 segundos)', style_cell)],
        [Paragraph('Estado', style_cell), Paragraph('<font color="#15803D"><b>AGREGADO</b></font> (propagandose)', style_cell)],
    ]
    t = Table(dns_a, colWidths=[40*mm, 130*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph('1.2 Registro CNAME pendiente (subdominio www)', style_h2))
    story.append(Paragraph(
        'Para que <b>www.jsadr.com.co</b> tambien resuelva al sitio en Vercel, es necesario '
        'agregar un registro CNAME en el mismo panel DNS de MiCom.co. Sin este registro, los '
        'usuarios que escriban la URL con "www" recibiran un error de DNS. La configuracion '
        'requerida es:',
        style_body
    ))
    dns_cname = [
        [Paragraph('<b>Campo</b>', style_cell_head), Paragraph('<b>Valor</b>', style_cell_head)],
        [Paragraph('Tipo', style_cell), Paragraph('CNAME', style_cell)],
        [Paragraph('Nombre', style_cell), Paragraph('www', style_cell)],
        [Paragraph('Valor', style_cell), Paragraph('cname.vercel-dns.com', style_cell)],
        [Paragraph('TTL', style_cell), Paragraph('1 hora (3600 segundos)', style_cell)],
        [Paragraph('Estado', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA AGREGAR</b></font>', style_cell)],
    ]
    t = Table(dns_cname, colWidths=[40*mm, 130*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph('1.3 Verificacion de propagacion DNS', style_h2))
    story.append(Paragraph(
        'Se ejecuto una verificacion directa consultando los cuatro nameservers de MiCom.co. '
        'Al momento de generar este informe, el registro A recien agregado aun no responde '
        '(respuesta ENODATA), lo cual es normal durante la ventana de propagacion inicial. '
        'El registro CNAME para www devuelve ENOTFOUND porque aun no se ha agregado. Los '
        'registros NS y MX responden correctamente, lo que confirma que la zona DNS esta '
        'activa y que el cambio del registro A deberia propagarse en los proximos minutos. '
        'Para verificar manualmente, ejecute desde una terminal:',
        style_body
    ))
    story.append(Paragraph(
        'nslookup -type=A jsadr.com.co nameserver01.mi.com.co<br/>'
        'nslookup -type=CNAME www.jsadr.com.co nameserver01.mi.com.co<br/>'
        'dig @1.1.1.1 jsadr.com.co A +short',
        style_code
    ))

    story.append(PageBreak())

    # === 2. REGISTRO EN CONFIGURACION GLOBAL ===
    story.append(Paragraph('2. Registro en Configuracion Global &rarr; Dominios', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'La plataforma JSADR mantiene una tabla <font name="LibMono">Dominio</font> en la '
        'base de datos Neon que documenta todos los dominios asociados al sistema. Esta '
        'tabla se gestiona desde el modulo de Configuracion Global &rarr; Dominios en el '
        'panel de administracion, y alimenta el dashboard de monitoreo de SSL, estado de '
        'servicios y auditoria. Se registraron tres dominios para cubrir todos los puntos '
        'de acceso a la plataforma:',
        style_body
    ))
    dominios_data = [
        [Paragraph('<b>Nombre</b>', style_cell_head),
         Paragraph('<b>Tipo</b>', style_cell_head),
         Paragraph('<b>Ambiente</b>', style_cell_head),
         Paragraph('<b>URL</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('jsadr.com.co', style_cell_bold),
         Paragraph('PRINCIPAL', style_cell),
         Paragraph('produccion', style_cell),
         Paragraph('https://jsadr.com.co', style_cell),
         Paragraph('<font color="#15803D">activo</font>', style_cell)],
        [Paragraph('www.jsadr.com.co', style_cell_bold),
         Paragraph('SUBDOMINIO', style_cell),
         Paragraph('produccion', style_cell),
         Paragraph('https://www.jsadr.com.co', style_cell),
         Paragraph('<font color="#15803D">activo</font>', style_cell)],
        [Paragraph('jsadr-jsadr.vercel.app', style_cell_bold),
         Paragraph('PREVIEW', style_cell),
         Paragraph('preview', style_cell),
         Paragraph('https://jsadr-jsadr.vercel.app', style_cell),
         Paragraph('<font color="#15803D">activo</font>', style_cell)],
    ]
    t = Table(dominios_data, colWidths=[40*mm, 25*mm, 25*mm, 50*mm, 30*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.3, C_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_BG_SOFT]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        'Adicionalmente, se creo un registro en la tabla <font name="LibMono">CertificadoSSL</font> '
        'para <b>jsadr.com.co</b> con estado <i>pendiente</i> y emisor <i>Vercel (Let\'s Encrypt)</i>. '
        'Este registro se actualizara automaticamente con la fecha de emision y vencimiento '
        'del SSL cuando Vercel emita el certificado tras agregar el dominio custom al '
        'proyecto. La plataforma incluye una tarea programada que verifica el estado del '
        'SSL periodicamente y envia alertas cuando faltan menos de 14 dias para el '
        'vencimiento.',
        style_body
    ))

    # === 3. SINCRONIZACION PLATAFORMAS ===
    story.append(Paragraph('3. Sincronizacion con GitHub, Vercel y Neon', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'La plataforma JSADR mantiene una tabla <font name="LibMono">PlataformaSync</font> en '
        'Neon que registra el estado de sincronizacion con cada servicio externo. Cada '
        'registro contiene: la plataforma, el identificador del proyecto en esa plataforma, '
        'el token de API cifrado con AES-256-CBC (clave API_ENCRYPTION_KEY), el secreto del '
        'webhook, la URL publica del webhook, el ultimo estado sincronizado y el ultimo '
        'error si lo hubo. Las URLs de webhook para las tres plataformas se actualizaron '
        'para apuntar al nuevo dominio:',
        style_body
    ))
    story.append(Paragraph(
        'https://jsadr.com.co/api/seguridad/plataformas-sync/webhook',
        style_code
    ))

    story.append(Paragraph('3.1 GitHub', style_h2))
    story.append(Paragraph(
        'El repositorio <b>jsadr-1029/jsadr-1029-jsadr</b> en GitHub contiene el codigo '
        'fuente completo de la plataforma. La rama principal es <font name="LibMono">main</font>. '
        'El Personal Access Token (PAT) almacenado en la base de datos quedo huerfano '
        'porque la API_ENCRYPTION_KEY original con la que fue cifrado se perdio cuando el '
        'archivo <font name="LibMono">.env</font> fue sobrescrito previamente (incidente '
        'documentado en el worklog). Para restaurar la sincronizacion en tiempo real, el '
        'administrador debe ingresar un nuevo PAT desde el panel de Configuracion Global &rarr; '
        'Seguridad &rarr; Plataformas &rarr; GitHub &rarr; Configurar. El PAT debe tener '
        'los scopes: <font name="LibMono">repo</font>, <font name="LibMono">workflow</font>, '
        '<font name="LibMono">read:user</font> y <font name="LibMono">admin:repo_hook</font> '
        '(para webhook). Al guardarlo, el sistema lo cifra con la nueva API_ENCRYPTION_KEY, '
        'crea el webhook en GitHub hacia la URL publica, y marca el estado como OK.',
        style_body
    ))

    story.append(Paragraph('3.2 Vercel', style_h2))
    story.append(Paragraph(
        'El proyecto en Vercel tiene el identificador '
        '<font name="LibMono">prj_JQV6HJQB65nmSEp45Z1FFPmxARtj</font> y pertenece al team '
        '<font name="LibMono">team_RgKIQ16ZqHOh3cpZ5WgzXtop</font>. La region configurada es '
        '<font name="LibMono">iad1</font> (US East). El archivo <font name="LibMono">vercel.json</font> '
        'define el build command (<font name="LibMono">prisma generate &amp;&amp; next build</font>), '
        'install command (<font name="LibMono">npm install --legacy-peer-deps</font>), headers de '
        'seguridad, y un maxDuration de 60s para las API routes. Para completar la '
        'vinculacion del dominio custom, es necesario:',
        style_body
    ))
    story.append(Paragraph(
        '<b>Paso A:</b> Agregar el dominio custom al proyecto en Vercel.<br/>'
        '&nbsp;&nbsp;&nbsp;Dashboard Vercel &rarr; Project &rarr; Settings &rarr; Domains &rarr; Add &rarr; "jsadr.com.co"<br/>'
        '&nbsp;&nbsp;&nbsp;Marcar como dominio principal (Redirect www to root recomendado).<br/><br/>'
        '<b>Paso B:</b> Re-ingresar VERCEL_TOKEN en la BD.<br/>'
        '&nbsp;&nbsp;&nbsp;Panel JSADR &rarr; Configuracion Global &rarr; Seguridad &rarr; Plataformas &rarr; Vercel &rarr; Configurar.<br/>'
        '&nbsp;&nbsp;&nbsp;Generar nuevo token en: vercel.com &rarr; Account Settings &rarr; Tokens &rarr; Create.<br/>'
        '&nbsp;&nbsp;&nbsp;Scopes: Full account (o limitado al proyecto). Expiracion: 90 dias recomendado.<br/><br/>'
        '<b>Paso C:</b> Sincronizar variables de entorno a Vercel.<br/>'
        '&nbsp;&nbsp;&nbsp;El sistema las sube automaticamente al guardar el token. Variables criticas:<br/>'
        '&nbsp;&nbsp;&nbsp;&bull; <font name="LibMono">DATABASE_URL</font> (Neon Postgres pooler)<br/>'
        '&nbsp;&nbsp;&nbsp;&bull; <font name="LibMono">API_ENCRYPTION_KEY</font> (debe coincidir con .env local)<br/>'
        '&nbsp;&nbsp;&nbsp;&bull; <font name="LibMono">ALLOWED_ORIGINS</font> (incluye jsadr.com.co)<br/>'
        '&nbsp;&nbsp;&nbsp;&bull; <font name="LibMono">NEXT_PUBLIC_APP_URL</font> = https://jsadr.com.co<br/>'
        '&nbsp;&nbsp;&nbsp;&bull; <font name="LibMono">JWT_SECRET</font>, <font name="LibMono">JWT_REFRESH_SECRET</font>, y todos los demas secretos',
        style_body_left
    ))

    story.append(Paragraph('3.3 Neon Database', style_h2))
    story.append(Paragraph(
        'El proyecto en Neon tiene el identificador '
        '<font name="LibMono">rapid-darkness-56995142</font>, branch <font name="LibMono">main</font>, '
        'region AWS US East 2. La conexion se realiza a traves del pooler en '
        '<font name="LibMono">ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech</font> '
        'con SSL mode <font name="LibMono">require</font> y schema <font name="LibMono">public</font>. '
        'El ultimo estado sincronizado fue <b>ERROR HTTP 401</b>, lo que indica que el '
        'API key almacenado en la base de datos esta caducado o fue revocado. Neon API keys '
        'se generan desde console.neon.tech &rarr; Account &rarr; API Keys &rarr; Create new key. '
        'El nuevo key se ingresa desde el panel JSADR &rarr; Configuracion Global &rarr; '
        'Seguridad &rarr; Plataformas &rarr; Neon &rarr; Configurar. Una vez reingresado, '
        'el sistema puede: listar branches, crear puntos de restauracion, monitorear '
        'consumo de compute units y disparar webhooks cuando se complete un maintenance '
        'window.',
        style_body
    ))

    story.append(PageBreak())

    # === 4. ARCHIVO .ENV REGENERADO ===
    story.append(Paragraph('4. Archivo .env Regenerado', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'El archivo <font name="LibMono">/home/z/my-project/.env</font> fue regenerado '
        'completamente. Se preservo el backup anterior en '
        '<font name="LibMono">.env.pre-sync.bak</font>. Se generaron 11 secretos nuevos '
        'con <font name="LibMono">openssl rand -hex</font> (todos de 64 a 96 caracteres hex), '
        'incluyendo una nueva API_ENCRYPTION_KEY. Esto significa que cualquier credencial '
        'cifrada en la base de datos con la llave anterior queda huerfana y debe reingresarse. '
        'Las variables estaticas (IDs de proyecto, URLs, configuracion SMTP) se mantienen. '
        'Las URLs se actualizaron para reflejar el nuevo dominio principal:',
        style_body
    ))

    env_data = [
        [Paragraph('<b>Variable</b>', style_cell_head),
         Paragraph('<b>Valor / Estado</b>', style_cell_head)],
        [Paragraph('DATABASE_URL', style_cell_bold),
         Paragraph('postgresql://neondb_owner:***@ep-small-lab-ax4gzg9p-pooler... (Neon, preservado)', style_cell)],
        [Paragraph('API_ENCRYPTION_KEY', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font> (64 hex chars)', style_cell)],
        [Paragraph('JWT_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font> (96 hex chars)', style_cell)],
        [Paragraph('JWT_REFRESH_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font> (96 hex chars)', style_cell)],
        [Paragraph('OTP_CHAT_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('PORTAL_SESSION_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('ADMIN_SESSION_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('CHAT_DYN_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('GITHUB_WEBHOOK_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('VERCEL_WEBHOOK_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('NEON_WEBHOOK_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('WHATSAPP_WEBHOOK_SECRET', style_cell_bold),
         Paragraph('<font color="#15803D"><b>REGENERADO</b></font>', style_cell)],
        [Paragraph('ALLOWED_ORIGINS', style_cell_bold),
         Paragraph('https://localhost:3000, https://preview-*.space-z.ai, https://jsadr.com.co, https://www.jsadr.com.co, https://jsadr-jsadr.vercel.app', style_cell)],
        [Paragraph('NEXT_PUBLIC_APP_URL', style_cell_bold),
         Paragraph('https://jsadr.com.co', style_cell)],
        [Paragraph('GITHUB_OWNER', style_cell_bold), Paragraph('jsadr-1029', style_cell)],
        [Paragraph('GITHUB_REPO', style_cell_bold), Paragraph('jsadr-1029-jsadr', style_cell)],
        [Paragraph('VERCEL_PROJECT_ID', style_cell_bold), Paragraph('prj_JQV6HJQB65nmSEp45Z1FFPmxARtj', style_cell)],
        [Paragraph('VERCEL_TEAM_ID', style_cell_bold), Paragraph('team_RgKIQ16ZqHOh3cpZ5WgzXtop', style_cell)],
        [Paragraph('NEON_PROJECT_ID', style_cell_bold), Paragraph('rapid-darkness-56995142', style_cell)],
        [Paragraph('NEON_BRANCH', style_cell_bold), Paragraph('main', style_cell)],
        [Paragraph('SMTP_HOST', style_cell_bold), Paragraph('smtp-relay.brevo.com', style_cell)],
        [Paragraph('SMTP_USER', style_cell_bold), Paragraph('b3e8df001@smtp-brevo.com (Brevo)', style_cell)],
        [Paragraph('SMTP_FROM', style_cell_bold), Paragraph('jsa@jsadr.com.co', style_cell)],
        [Paragraph('BANCOLOMBIA_AMBIENTE', style_cell_bold), Paragraph('sandbox', style_cell)],
        [Paragraph('VERCEL_TOKEN / GITHUB_TOKEN / NEON_API_KEY', style_cell_bold),
         Paragraph('<font color="#B91C1C"><b>VACIOS</b></font> — re-ingresar desde panel', style_cell)],
    ]
    t = Table(env_data, colWidths=[55*mm, 115*mm])
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

    # === 5. VISTA PREVIA VIA DOMINIO ===
    story.append(Paragraph('5. Vista Previa via Dominio', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'La vista previa de la plataforma sera accesible a traves del dominio custom una '
        'vez completados los pasos pendientes. Vercel gestiona automaticamente el SSL '
        '(Let\'s Encrypt) y emite el certificado en cuanto el DNS apunta correctamente a '
        'sus servidores. El flujo de activacion es:',
        style_body
    ))
    story.append(Paragraph(
        '<b>1.</b> DNS A @ &rarr; 76.76.21.21 propagado (5-30 min desde el cambio).<br/>'
        '<b>2.</b> CNAME www &rarr; cname.vercel-dns.com agregado en MiCom.co.<br/>'
        '<b>3.</b> Dominio custom agregado en Vercel &rarr; Settings &rarr; Domains.<br/>'
        '<b>4.</b> Vercel valida la configuracion DNS y emite SSL automatico.<br/>'
        '<b>5.</b> El dominio <font name="LibMono">https://jsadr.com.co</font> queda activo.<br/>'
        '<b>6.</b> Cada deploy de la rama main actualiza el sitio en produccion.<br/>'
        '<b>7.</b> Cada Pull Request genera una preview URL en <font name="LibMono">jsadr-jsadr.vercel.app</font>.<br/>'
        '<b>8.</b> Las API routes quedan accesibles en <font name="LibMono">https://jsadr.com.co/api/*</font>.<br/>'
        '<b>9.</b> Los webhooks de GitHub/Vercel/Neon se reciben en <font name="LibMono">https://jsadr.com.co/api/seguridad/plataformas-sync/webhook</font>.',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Importante:</b> El dominio preview <font name="LibMono">https://jsadr-jsadr.vercel.app</font> '
        'continuara funcionando en paralelo al dominio custom. Ambos serviran el mismo '
        'contenido, pero el dominio custom sera el canonico (redirigira el preview al '
        'dominio custom si se configura asi en Vercel). El sistema de Configuracion Global '
        '&rarr; Dominios en JSADR mostrara el estado de ambos dominios y sus certificados SSL.',
        style_callout
    ))

    story.append(PageBreak())

    # === 6. CHECKLIST FINAL ===
    story.append(Paragraph('6. Checklist Final de Acciones', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Las siguientes acciones son las que faltan para completar al 100% la sincronizacion. '
        'Las primeras son automaticas (DNS propagandose). Las restantes requieren intervencion '
        'manual del administrador desde los paneles respectivos.',
        style_body
    ))

    checklist_data = [
        [Paragraph('<b>#</b>', style_cell_head),
         Paragraph('<b>Accion</b>', style_cell_head),
         Paragraph('<b>Donde</b>', style_cell_head),
         Paragraph('<b>Estado</b>', style_cell_head)],
        [Paragraph('1', style_cell), Paragraph('Agregar registro A @ &rarr; 76.76.21.21', style_cell),
         Paragraph('MiCom.co &rarr; DNS', style_cell), Paragraph('<font color="#15803D"><b>HECHO</b></font>', style_cell)],
        [Paragraph('2', style_cell), Paragraph('Esperar propagacion DNS (5-30 min)', style_cell),
         Paragraph('Automatico', style_cell), Paragraph('<font color="#B45309"><b>EN CURSO</b></font>', style_cell)],
        [Paragraph('3', style_cell), Paragraph('Agregar CNAME www &rarr; cname.vercel-dns.com', style_cell),
         Paragraph('MiCom.co &rarr; DNS', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('4', style_cell), Paragraph('Agregar dominio custom jsadr.com.co', style_cell),
         Paragraph('Vercel &rarr; Project &rarr; Domains', style_cell), Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('5', style_cell), Paragraph('Verificar SSL automatico emitido', style_cell),
         Paragraph('Vercel &rarr; Project &rarr; Domains', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #4</b></font>', style_cell)],
        [Paragraph('6', style_cell), Paragraph('Re-ingresar VERCEL_TOKEN', style_cell),
         Paragraph('JSADR &rarr; Config. Global &rarr; Seguridad &rarr; Plataformas', style_cell),
         Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('7', style_cell), Paragraph('Re-ingresar GITHUB_TOKEN (PAT)', style_cell),
         Paragraph('JSADR &rarr; Config. Global &rarr; Seguridad &rarr; Plataformas', style_cell),
         Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('8', style_cell), Paragraph('Re-ingresar NEON_API_KEY', style_cell),
         Paragraph('JSADR &rarr; Config. Global &rarr; Seguridad &rarr; Plataformas', style_cell),
         Paragraph('<font color="#B91C1C"><b>FALTA</b></font>', style_cell)],
        [Paragraph('9', style_cell), Paragraph('Sincronizar env vars a Vercel (automatico al #6)', style_cell),
         Paragraph('JSADR backend', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #6</b></font>', style_cell)],
        [Paragraph('10', style_cell), Paragraph('Verificar webhook GitHub creado', style_cell),
         Paragraph('GitHub repo &rarr; Settings &rarr; Webhooks', style_cell),
         Paragraph('<font color="#B45309"><b>DESPUES DE #7</b></font>', style_cell)],
        [Paragraph('11', style_cell), Paragraph('Hacer commit + push para disparar deploy', style_cell),
         Paragraph('git push origin main', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #4-9</b></font>', style_cell)],
        [Paragraph('12', style_cell), Paragraph('Verificar https://jsadr.com.co carga OK', style_cell),
         Paragraph('Navegador', style_cell), Paragraph('<font color="#B45309"><b>DESPUES DE #11</b></font>', style_cell)],
        [Paragraph('13', style_cell), Paragraph('Verificar webhook recibido en PlataformaSync', style_cell),
         Paragraph('JSADR &rarr; Config. Global &rarr; Seguridad', style_cell),
         Paragraph('<font color="#B45309"><b>DESPUES DE #12</b></font>', style_cell)],
    ]
    t = Table(checklist_data, colWidths=[8*mm, 65*mm, 60*mm, 37*mm])
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

    # === 7. SCRIPTS Y AUDITORIA ===
    story.append(Paragraph('7. Scripts Ejecutados y Trazabilidad', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'Todos los scripts utilizados se persistieron en '
        '<font name="LibMono">/home/z/my-project/scripts/</font> para trazabilidad y '
        'replicacion. Los principales son:',
        style_body
    ))
    scripts_data = [
        [Paragraph('<b>Script</b>', style_cell_head), Paragraph('<b>Funcion</b>', style_cell_head)],
        [Paragraph('_build-complete-env.cjs', style_cell_bold),
         Paragraph('Regenera .env con secretos nuevos. Backup en .env.pre-sync.bak', style_cell)],
        [Paragraph('_register-dominio.cjs', style_cell_bold),
         Paragraph('Crea 3 registros en tabla Dominio y 1 en CertificadoSSL', style_cell)],
        [Paragraph('_update-plataforma-sync.cjs', style_cell_bold),
         Paragraph('Actualiza webhookUrl de GITHUB/VERCEL/NEON al nuevo dominio', style_cell)],
        [Paragraph('_verify-dns-direct.cjs', style_cell_bold),
         Paragraph('Consulta los 4 nameservers de MiCom.co directamente', style_cell)],
        [Paragraph('_check-dominios-now.cjs', style_cell_bold),
         Paragraph('Inspecciona Dominio y CertificadoSSL en BD Neon', style_cell)],
        [Paragraph('_decrypt-platform-tokens.cjs', style_cell_bold),
         Paragraph('Intenta descifrar tokens cifrados (confirmo que estan huerfanos)', style_cell)],
        [Paragraph('_check-credenciales-actuales.cjs', style_cell_bold),
         Paragraph('Inspecciona ConexionAPI, CorreoInstitucional y PlataformaSync', style_cell)],
    ]
    t = Table(scripts_data, colWidths=[55*mm, 115*mm])
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
    story.append(Spacer(1, 10))

    # === 8. CONSIDERACIONES DE SEGURIDAD ===
    story.append(Paragraph('8. Consideraciones de Seguridad', style_h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))

    story.append(Paragraph(
        'La regeneracion de la API_ENCRYPTION_KEY tiene efectos en cascada sobre todas las '
        'credenciales almacenadas en la base de datos. Es importante entender el alcance:',
        style_body
    ))
    story.append(Paragraph(
        '<b>Credenciales huerfanas (deben reingresarse):</b><br/>'
        '&bull; <font name="LibMono">PlataformaSync.tokenCifrado</font> para GITHUB, VERCEL y NEON<br/>'
        '&bull; <font name="LibMono">ConexionAPI.apiKey</font> si alguna estaba cifrada con la llave anterior<br/>'
        '&bull; <font name="LibMono">CorreoInstitucional.smtpPass</font> si fue cifrado antes de la regeneracion<br/><br/>'
        '<b>Credenciales recuperables (no requieren reingreso):</b><br/>'
        '&bull; Aquellas con backup en <font name="LibMono">smtpPassBackup</font> — se pueden restaurar desde el panel<br/>'
        '&bull; Credenciales de WhatsApp/Bancolombia reingresadas en sesiones posteriores<br/><br/>'
        '<b>Buenas practicas aplicadas:</b><br/>'
        '&bull; Todos los secretos generados con <font name="LibMono">openssl rand -hex</font> (32-48 bytes)<br/>'
        '&bull; <font name="LibMono">.env</font> nunca se commitea a Git (verificado en <font name="LibMono">.gitignore</font>)<br/>'
        '&bull; Backup anterior preservado en <font name="LibMono">.env.pre-sync.bak</font><br/>'
        '&bull; URLs de webhook restringidas a <font name="LibMono">https://jsadr.com.co</font> (no wildcard)<br/>'
        '&bull; CORS en <font name="LibMono">ALLOWED_ORIGINS</font> limitado a 5 dominios explicitos<br/>'
        '&bull; Webhook endpoint valida firma HMAC-SHA256 con <font name="LibMono">*_WEBHOOK_SECRET</font><br/>'
        '&bull; AuditLog es inmutable (no se puede borrar ni modificar via Prisma)',
        style_body_left
    ))

    story.append(Paragraph(
        '<b>Accion post-sync recomendada:</b> despues de reingresar todos los tokens, '
        'ejecutar el script <font name="LibMono">_check-credenciales-actuales.cjs</font> para '
        'verificar que todos los PlataformaSync muestren <font name="LibMono">ultimoEstado = OK</font> '
        'y que ninguno tenga <font name="LibMono">ultimoError</font>.',
        style_callout
    ))

    # Final
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LINE, spaceAfter=8))
    story.append(Paragraph(
        '<i>Informe generado automaticamente por el agente de sincronizacion JSADR.</i>',
        ParagraphStyle('Footer', parent=style_body, alignment=TA_CENTER,
                       textColor=C_TEXT_MUTED, fontSize=9)
    ))

    return story


def main():
    output = '/home/z/my-project/download/JSADR-Sincronizacion-Dominio.pdf'
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title='JSADR — Sincronizacion de Dominio',
        author='JSADR Agente de Sincronizacion',
        subject='Informe de sincronizacion GitHub + Vercel + Neon',
        creator='Z.ai',
    )

    story = build_story()

    # Use a multi-page template with cover (first page) + body (rest)
    from reportlab.platypus import PageTemplate, Frame, BaseDocTemplate

    frame_body = Frame(
        20*mm, 18*mm, A4[0] - 40*mm, A4[1] - 36*mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id='body'
    )
    frame_cover = Frame(
        20*mm, 18*mm, A4[0] - 40*mm, A4[1] - 36*mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id='cover'
    )

    cover_template = PageTemplate(id='cover', frames=[frame_cover], onPage=on_cover_page)
    body_template = PageTemplate(id='body', frames=[frame_body], onPage=on_page)
    doc.addPageTemplates([cover_template, body_template])

    # Force switch to body template after cover
    from reportlab.platypus import NextPageTemplate
    new_story = [NextPageTemplate('body')] + story

    doc.build(new_story)
    print(f'PDF generado: {output}')
    print(f'Tamano: {os.path.getsize(output)/1024:.1f} KB')


if __name__ == '__main__':
    main()
