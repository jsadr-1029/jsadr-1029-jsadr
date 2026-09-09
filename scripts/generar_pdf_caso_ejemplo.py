#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera un PDF con el caso de ejemplo del módulo de Regularización
Inteligente de Cuotas Vencidas, mostrando paso a paso cómo se
negocia desde el portal del cliente.
"""

import os
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# === Registrar fuentes ===
try:
    pdfmetrics.registerFont(TTFont('NotoSans', '/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSans-Bold', '/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf'))
    BODY_FONT = 'NotoSans'
    BOLD_FONT = 'NotoSans-Bold'
except Exception:
    BODY_FONT = 'Helvetica'
    BOLD_FONT = 'Helvetica-Bold'

# === Colores ===
COLOR_PRIMARY = HexColor('#1E40AF')        # blue-800
COLOR_ACCENT = HexColor('#7C3AED')         # violet-600
COLOR_SUCCESS = HexColor('#059669')         # emerald-600
COLOR_WARNING = HexColor('#D97706')         # amber-600
COLOR_DANGER = HexColor('#DC2626')          # red-600
COLOR_BG_LIGHT = HexColor('#F8FAFC')       # slate-50
COLOR_BG_BLUE = HexColor('#EFF6FF')        # blue-50
COLOR_BG_EMERALD = HexColor('#ECFDF5')     # emerald-50
COLOR_BG_AMBER = HexColor('#FFFBEB')       # amber-50
COLOR_BG_RED = HexColor('#FEF2F2')         # red-50
COLOR_TEXT = HexColor('#1F2937')           # gray-800
COLOR_MUTED = HexColor('#6B7280')          # gray-500

# === Estilos ===
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'CustomTitle',
    parent=styles['Title'],
    fontName=BOLD_FONT,
    fontSize=20,
    textColor=COLOR_PRIMARY,
    alignment=TA_CENTER,
    spaceAfter=8,
)

style_subtitle = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=11,
    textColor=COLOR_MUTED,
    alignment=TA_CENTER,
    spaceAfter=20,
)

style_h1 = ParagraphStyle(
    'H1',
    parent=styles['Heading1'],
    fontName=BOLD_FONT,
    fontSize=15,
    textColor=COLOR_PRIMARY,
    spaceBefore=18,
    spaceAfter=8,
    borderPadding=4,
)

style_h2 = ParagraphStyle(
    'H2',
    parent=styles['Heading2'],
    fontName=BOLD_FONT,
    fontSize=12,
    textColor=COLOR_ACCENT,
    spaceBefore=12,
    spaceAfter=6,
)

style_body = ParagraphStyle(
    'Body',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=10,
    textColor=COLOR_TEXT,
    leading=14,
    spaceAfter=6,
    alignment=TA_LEFT,
)

style_chat_system = ParagraphStyle(
    'ChatSystem',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=10,
    textColor=HexColor('#1E3A8A'),
    leading=14,
    leftIndent=20,
    rightIndent=20,
    spaceAfter=8,
    backColor=COLOR_BG_BLUE,
    borderPadding=8,
)

style_chat_client = ParagraphStyle(
    'ChatClient',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=10,
    textColor=HexColor('#065F46'),
    leading=14,
    leftIndent=80,
    rightIndent=20,
    spaceAfter=8,
    backColor=COLOR_BG_EMERALD,
    borderPadding=8,
    alignment=TA_RIGHT,
)

style_warning_box = ParagraphStyle(
    'WarningBox',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=9,
    textColor=HexColor('#92400E'),
    leading=12,
    leftIndent=10,
    rightIndent=10,
    spaceAfter=8,
    backColor=COLOR_BG_AMBER,
    borderPadding=6,
)

style_small = ParagraphStyle(
    'Small',
    parent=styles['Normal'],
    fontName=BODY_FONT,
    fontSize=8,
    textColor=COLOR_MUTED,
    alignment=TA_CENTER,
)

# === Documento ===
output_path = '/home/z/my-project/download/caso_ejemplo_regularizacion_inteligente.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    rightMargin=2 * cm,
    leftMargin=2 * cm,
    topMargin=2 * cm,
    bottomMargin=2 * cm,
    title='Caso de Ejemplo - Regularización Inteligente',
    author='Microfinanciera JSADR',
)

story = []

# =====================================================
# PORTADA
# =====================================================
story.append(Spacer(1, 3 * cm))
story.append(Paragraph('Caso de Ejemplo', style_title))
story.append(Paragraph('Módulo de Regularización Inteligente de Cuotas Vencidas', style_subtitle))
story.append(Spacer(1, 1 * cm))

# Tabla de datos del caso
data_caso = [
    ['Cliente', 'JOHAN SEBASTIAN ALVAREZ DEL RIO'],
    ['Cédula', '1214731649'],
    ['Código del préstamo', 'JA-CC-1214731649-20260626-01'],
    ['Monto principal', '$1.000.000'],
    ['Tasa mensual', '15% (modalidad TASA_FIJA)'],
    ['Tasa moratoria', '1% diario compuesto'],
    ['Número de cuotas', '4 mensuales de $400.000'],
    ['Cuotas vencidas', '2 (Cuota 1 y Cuota 2)'],
    ['Días de mora', 'Cuota 1: 45 días · Cuota 2: 14 días'],
    ['Fecha de desembolso', '26 de junio de 2026'],
]

t = Table(data_caso, colWidths=[5 * cm, 11 * cm])
t.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 10),
    ('FONT', (0, 0), (0, -1), BOLD_FONT, 10),
    ('TEXTCOLOR', (0, 0), (0, -1), COLOR_PRIMARY),
    ('TEXTCOLOR', (1, 0), (1, -1), COLOR_TEXT),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('BACKGROUND', (0, 0), (0, -1), COLOR_BG_LIGHT),
    ('ROWBACKGROUNDS', (1, 0), (1, -1), [white, COLOR_BG_LIGHT]),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(t)

story.append(Spacer(1, 1.5 * cm))
story.append(Paragraph(
    'Este documento muestra paso a paso cómo el cliente interactúa con el asistente conversacional '
    'de Regularización Inteligente desde el portal del cliente. El escenario simulado permite ver '
    'cómo el sistema calcula dinámicamente los valores, presenta alternativas y guarda el acuerdo '
    'para revisión del asesor financiero.',
    style_body
))

story.append(PageBreak())

# =====================================================
# PASO 1: Resumen de cuotas vencidas
# =====================================================
story.append(Paragraph('Paso 1 · Resumen de cuotas vencidas', style_h1))
story.append(Paragraph(
    'Cuando el cliente ingresa al portal y selecciona la opción "Regularizar inteligentemente" '
    'en el banner de mora de su crédito, el sistema le muestra un resumen completo de las cuotas '
    'que tiene vencidas, con el detalle de cada una: número de cuota, fecha de vencimiento, capital '
    'pendiente, intereses generados, días de mora y la mora acumulada al día de hoy. Al final '
    'se muestra el total necesario para quedar al día en el momento actual.',
    style_body
))

story.append(Spacer(1, 0.4 * cm))

# Simulación de pantalla del portal
story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    'Hola <b>Johan</b>. Veo que tienes <b>2 cuotas vencidas</b> en tu crédito '
    '<b>JA-CC-1214731649-20260626-01</b>. Vamos a buscar juntos la mejor forma de ponerte al día.',
    style_chat_system
))

# Tabla de cuotas vencidas
data_cuotas = [
    ['', 'Cuota 1', 'Cuota 2'],
    ['Vencimiento', '26/07/2026', '26/08/2026'],
    ['Capital', '$250.000', '$250.000'],
    ['Interés', '$150.000', '$150.000'],
    ['Días de mora', '45 días', '14 días'],
    ['Mora acumulada', '$564.810', '$149.474'],
    ['Pendiente cuota', '$964.810', '$549.474'],
]

t_cuotas = Table(data_cuotas, colWidths=[3.5 * cm, 5.5 * cm, 5.5 * cm])
t_cuotas.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (-1, 0), BOLD_FONT, 9),
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('BACKGROUND', (0, 1), (0, -1), COLOR_BG_LIGHT),
    ('FONT', (0, 1), (0, -1), BOLD_FONT, 9),
    ('TEXTCOLOR', (0, 1), (0, -1), COLOR_PRIMARY),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_cuotas)

story.append(Spacer(1, 0.3 * cm))

# Total para quedar al día
data_total = [
    ['💰 Total para quedar al día HOY', '$1.514.284'],
]
t_total = Table(data_total, colWidths=[10 * cm, 5 * cm])
t_total.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BOLD_FONT, 13),
    ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_EMERALD),
    ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#065F46')),
    ('TEXTCOLOR', (1, 0), (1, -1), COLOR_SUCCESS),
    ('ALIGN', (0, 0), (0, -1), 'LEFT'),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1.5, COLOR_SUCCESS),
    ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
]))
story.append(t_total)

story.append(Spacer(1, 0.3 * cm))

# Advertencia transparente
story.append(Paragraph(
    '⚠️ <b>Pagar más adelante puede aumentar el valor total</b> debido a los intereses moratorios '
    '(1% diario sobre el capital de $1.000.000 = $10.000 por cada día adicional de atraso).',
    style_warning_box
))

story.append(PageBreak())

# =====================================================
# PASO 2: Selección de fecha
# =====================================================
story.append(Paragraph('Paso 2 · El cliente selecciona una fecha', style_h1))
story.append(Paragraph(
    'El sistema pregunta al cliente para qué fecha cree que podrá realizar el pago. El cliente '
    'tiene dos opciones: (a) seleccionar una fecha específica en el calendario, o (b) indicar que '
    'no está seguro y elegir un número aproximado de días (7, 15, 30, 45, 60 o 90 días).',
    style_body
))

story.append(Spacer(1, 0.4 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    '¿Para qué fecha crees que podrás realizar el pago?',
    style_chat_system
))

story.append(Spacer(1, 0.2 * cm))
story.append(Paragraph('<b>👤 Johan (cliente)</b>', style_h2))
story.append(Paragraph(
    '30 de septiembre de 2026.',
    style_chat_client
))

story.append(Spacer(1, 0.3 * cm))

# =====================================================
# PASO 3: Escenario calculado
# =====================================================
story.append(Paragraph('Paso 3 · Cálculo dinámico del escenario', style_h1))
story.append(Paragraph(
    'El sistema recibe la fecha propuesta (30 de septiembre, dentro de 30 días) y recalcula '
    'automáticamente el valor total que el cliente deberá pagar en esa fecha. La mora se proyecta '
    'usando la fórmula de interés compuesto diario sobre el capital inicial.',
    style_body
))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    'Perfecto. Para el <b>30 de septiembre de 2026</b> (dentro de 30 días), el valor estimado para '
    'regularizar tus cuotas sería de <b>$2.422.223</b>, incluyendo los intereses calculados hasta esa fecha.',
    style_chat_system
))

# Tabla del escenario
data_escenario = [
    ['Concepto', 'Valor'],
    ['Capital pendiente', '$500.000'],
    ['Intereses acumulados', '$300.000'],
    ['Mora acumulada (proyectada)', '$1.622.223'],
    ['Otros cargos', '$0'],
    ['Total estimado al 30/09/2026', '$2.422.223'],
    ['Diferencia frente a pagar HOY', '+$907.938'],
]

t_esc = Table(data_escenario, colWidths=[9 * cm, 6 * cm])
t_esc.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 10),
    ('FONT', (0, 0), (-1, 0), BOLD_FONT, 10),
    ('FONT', (0, -1), (-1, -1), BOLD_FONT, 11),
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, -2), (-1, -1), COLOR_BG_EMERALD),
    ('TEXTCOLOR', (1, -1), (1, -1), COLOR_DANGER),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
]))
story.append(t_esc)

story.append(Spacer(1, 0.4 * cm))

# Tabla comparativa
story.append(Paragraph('<b>📊 Comparativa de fechas (costo de esperar)</b>', style_h2))

data_comp = [
    ['Fecha', 'Días', 'Intereses + Mora', 'Total', 'Diferencia'],
    ['Hoy (09/09)', '0', '$1.014.284', '$1.514.284', '—'],
    ['+15 días (24/09)', '15', '$1.420.000', '$1.920.000', '+$405.715'],
    ['+30 días (09/10)', '30', '$1.922.223', '$2.422.223', '+$907.938'],
    ['+45 días (24/10)', '45', '$2.505.289', '$3.005.289', '+$1.491.004'],
]

t_comp = Table(data_comp, colWidths=[3.2 * cm, 1.5 * cm, 3.8 * cm, 3.3 * cm, 3.2 * cm])
t_comp.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (-1, 0), BOLD_FONT, 9),
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('BACKGROUND', (0, 3), (-1, 3), COLOR_BG_BLUE),  # día seleccionado
    ('FONT', (0, 3), (-1, 3), BOLD_FONT, 9),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(t_comp)

story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph(
    'ℹ️ Este valor es una <b>estimación</b>. El monto definitivo se calculará al momento de realizar '
    'el pago, ya que los intereses moratorios se causan diariamente.',
    style_warning_box
))

story.append(PageBreak())

# =====================================================
# PASO 4: Capacidad de pago
# =====================================================
story.append(Paragraph('Paso 4 · Capacidad de pago del cliente', style_h1))
story.append(Paragraph(
    'Una vez el cliente conoce el valor estimado para la fecha propuesta, el sistema le pregunta '
    'cuánto podrá pagar ese día. Esta información es clave para que el sistema pueda presentarle '
    'alternativas realistas y sostenibles.',
    style_body
))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    '¿Cuánto crees que podrás pagar el 30 de septiembre?',
    style_chat_system
))

story.append(Spacer(1, 0.2 * cm))
story.append(Paragraph('<b>👤 Johan (cliente)</b>', style_h2))
story.append(Paragraph(
    '$700.000',
    style_chat_client
))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    'Entiendo. Con $700.000 podrías cubrir una parte importante de tus cuotas vencidas, pero '
    'quedarían aproximadamente <b>$1.722.223 pendientes</b> frente al total estimado de $2.422.223 '
    'para esa fecha. Tengo estas alternativas disponibles para ti:',
    style_chat_system
))

# Comparación
data_comp_pago = [
    ['Concepto', 'Valor'],
    ['Puedes pagar', '$700.000'],
    ['Necesario para quedar al día', '$2.422.223'],
    ['⚠️ Te falta', '$1.722.223'],
]

t_comp_pago = Table(data_comp_pago, colWidths=[10 * cm, 5 * cm])
t_comp_pago.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 10),
    ('FONT', (0, 0), (-1, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, -1), (-1, -1), COLOR_BG_AMBER),
    ('TEXTCOLOR', (1, -1), (1, -1), COLOR_WARNING),
    ('FONT', (0, -1), (-1, -1), BOLD_FONT, 11),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
]))
story.append(t_comp_pago)

story.append(Spacer(1, 0.5 * cm))

# =====================================================
# PASO 5: Alternativas
# =====================================================
story.append(Paragraph('Paso 5 · Alternativas de regularización', style_h1))
story.append(Paragraph(
    'El sistema presenta al cliente las alternativas permitidas por las políticas de la entidad. '
    'No se otorgan descuentos automáticos: la prioridad es lograr el pago completo de las cuotas '
    'vencidas. Si el cliente no puede cubrir el total, se le ofrece dividir el pago o establecer '
    'un acuerdo de regularización con pagos posteriores.',
    style_body
))

story.append(Spacer(1, 0.3 * cm))

# Alternativa 1
data_alt1 = [
    ['✓ Opción 1 — Pago completo', ''],
    ['', 'Paga $2.422.223 el 30/09/2026. Quedas al día completamente.'],
]
t_alt1 = Table(data_alt1, colWidths=[7 * cm, 8 * cm])
t_alt1.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (0, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_EMERALD),
    ('TEXTCOLOR', (0, 0), (0, 0), COLOR_SUCCESS),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_SUCCESS),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_alt1)
story.append(Spacer(1, 0.2 * cm))

# Alternativa 2
data_alt2 = [
    ['$ Opción 2 — Pago parcial', ''],
    ['', '$700.000 el 30/09/2026 + saldo restante ($1.722.223) según acuerdo.'],
]
t_alt2 = Table(data_alt2, colWidths=[7 * cm, 8 * cm])
t_alt2.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (0, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#ECFEFF')),
    ('TEXTCOLOR', (0, 0), (0, 0), HexColor('#0891B2')),
    ('BOX', (0, 0), (-1, -1), 1, HexColor('#0891B2')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_alt2)
story.append(Spacer(1, 0.2 * cm))

# Alternativa 3 (seleccionada)
data_alt3 = [
    ['🤝 Opción 3 — Acuerdo de regularización', ''],
    ['', '$700.000 el 30/09/2026 + divide el saldo ($1.722.223) en 4 pagos quincenales posteriores:'],
    ['', '  • $430.558 el 15/10/2026'],
    ['', '  • $430.558 el 30/10/2026'],
    ['', '  • $430.558 el 14/11/2026'],
    ['', '  • $430.558 el 29/11/2026'],
]
t_alt3 = Table(data_alt3, colWidths=[7 * cm, 8 * cm])
t_alt3.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (0, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_BLUE),
    ('TEXTCOLOR', (0, 0), (0, 0), COLOR_PRIMARY),
    ('BOX', (0, 0), (-1, -1), 2, COLOR_PRIMARY),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_alt3)
story.append(Spacer(1, 0.2 * cm))

# Alternativa 4
data_alt4 = [
    ['📅 Opción 4 — Promesa de pago', ''],
    ['', 'Te comprometes a pagar el 30/09/2026. Un asesor te contactará para confirmar el monto.'],
]
t_alt4 = Table(data_alt4, colWidths=[7 * cm, 8 * cm])
t_alt4.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (0, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_AMBER),
    ('TEXTCOLOR', (0, 0), (0, 0), COLOR_WARNING),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_WARNING),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_alt4)

story.append(Spacer(1, 0.4 * cm))

story.append(Paragraph('<b>👤 Johan (cliente)</b>', style_h2))
story.append(Paragraph(
    'Opción 3 — Acuerdo de regularización.',
    style_chat_client
))

story.append(PageBreak())

# =====================================================
# PASO 6: Confirmación
# =====================================================
story.append(Paragraph('Paso 6 · Resumen y confirmación', style_h1))
story.append(Paragraph(
    'Antes de registrar el acuerdo, el sistema muestra un resumen final con todos los detalles '
    'para que el cliente confirme. El cliente aún puede elegir "Quiero otra alternativa" si '
    'desea volver atrás.',
    style_body
))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    'Excelente. Este es el resumen de tu acuerdo de regularización. Revísalo y confírmalo:',
    style_chat_system
))

# Resumen final
data_resumen = [
    ['Campo', 'Valor'],
    ['Crédito', 'JA-CC-1214731649-20260626-01'],
    ['Cuotas vencidas', '2'],
    ['Saldo vencido (capital)', '$500.000'],
    ['Intereses estimados', '$300.000'],
    ['Mora acumulada al 30/09/2026', '$1.622.223'],
    ['Otros cargos', '$0'],
    ['Total estimado', '$2.422.223'],
    ['Tipo de acuerdo', 'Acuerdo de regularización'],
    ['Fecha del primer pago', '30 de septiembre de 2026'],
    ['Monto del primer pago', '$700.000'],
    ['Saldo restante', '$1.722.223'],
    ['Pagos posteriores', '4 cuotas quincenales de $430.558'],
]

t_res = Table(data_resumen, colWidths=[6 * cm, 9 * cm])
t_res.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BODY_FONT, 9),
    ('FONT', (0, 0), (-1, 0), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, -7), (-1, -7), COLOR_BG_EMERALD),  # Total estimado
    ('FONT', (0, -7), (-1, -7), BOLD_FONT, 10),
    ('BACKGROUND', (0, 1), (0, -1), COLOR_BG_LIGHT),
    ('FONT', (0, 1), (0, -1), BOLD_FONT, 9),
    ('TEXTCOLOR', (0, 1), (0, -1), COLOR_PRIMARY),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(t_res)

story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph(
    '⚠️ Al confirmar, tu acuerdo quedará registrado y un <b>asesor lo revisará en las próximas 24 horas</b>. '
    'El valor final puede variar según los intereses del día del pago.',
    style_warning_box
))

story.append(Spacer(1, 0.3 * cm))

# Botones simulados
data_btns = [
    ['[ Quiero otra alternativa ]', '[ ✓ Confirmar acuerdo ]'],
]
t_btns = Table(data_btns, colWidths=[7.5 * cm, 7.5 * cm])
t_btns.setStyle(TableStyle([
    ('FONT', (0, 0), (-1, -1), BOLD_FONT, 10),
    ('BACKGROUND', (0, 0), (0, -1), white),
    ('BACKGROUND', (1, 0), (1, -1), COLOR_SUCCESS),
    ('TEXTCOLOR', (0, 0), (0, -1), COLOR_PRIMARY),
    ('TEXTCOLOR', (1, 0), (1, -1), white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (0, -1), 1, COLOR_PRIMARY),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
]))
story.append(t_btns)

story.append(Spacer(1, 0.4 * cm))

story.append(Paragraph('<b>👤 Johan (cliente)</b>', style_h2))
story.append(Paragraph(
    '✓ Confirmar acuerdo',
    style_chat_client
))

# =====================================================
# PASO 7: Confirmación final
# =====================================================
story.append(Spacer(1, 0.5 * cm))
story.append(Paragraph('Paso 7 · Acuerdo registrado', style_h1))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph('<b>🤖 Asistente Lía</b>', style_h2))
story.append(Paragraph(
    '✓ ¡Acuerdo registrado!<br/><br/>'
    'Tu solicitud de regularización ha sido enviada correctamente.<br/><br/>'
    'Código de seguimiento: <b>CMTU7NXJ</b><br/><br/>'
    'Un asesor revisará tu acuerdo en las próximas 24 horas. Si necesitas ajustes, puedes '
    'contactarnos por el centro de comunicaciones.',
    style_chat_system
))

story.append(Spacer(1, 0.5 * cm))

# =====================================================
# CONCLUSIÓN
# =====================================================
story.append(Paragraph('Conclusiones del caso', style_h1))
story.append(Paragraph(
    'El cliente logró regularizar sus cuotas vencidas mediante un acuerdo estructurado que respeta '
    'las políticas de la entidad financiera. El sistema actuó como un asistente financiero '
    'transparente, no como una herramienta de cobranza agresiva:',
    style_body
))

conclusiones = [
    '✓ El cliente vio con claridad el costo de esperar (tabla comparativa: $1.514.284 → $2.422.223 → $3.005.289).',
    '✓ El sistema priorizó el pago completo (Opción 1), no el descuento.',
    '✓ Se ofrecieron 4 alternativas para adaptarse a la capacidad de pago real del cliente.',
    '✓ El acuerdo quedó registrado en la tabla CompromisoPago con estado REGISTRADO.',
    '✓ Un asesor revisará el caso en 24 horas para validar el acuerdo.',
    '✓ Los intereses moratorios se conservaron según las reglas del producto.',
    '✓ La experiencia fue transparente, dinámica y personalizada.',
]

for c in conclusiones:
    story.append(Paragraph(c, style_body))

story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph(
    'Para probar este caso en producción: ingresa a https://jsadr.com.co/, inicia sesión con la '
    'cédula 1214731649 y selecciona el crédito JA-CC-1214731649-20260626-01. Verás el banner de '
    'mora con el botón "Regularizar inteligentemente".',
    style_body
))

# === Build PDF ===
doc.build(story)
print(f'PDF generado: {output_path}')

import os
size = os.path.getsize(output_path)
print(f'Tamaño: {size / 1024:.1f} KB')
