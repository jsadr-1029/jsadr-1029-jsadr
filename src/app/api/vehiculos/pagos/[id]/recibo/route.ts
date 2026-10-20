// =====================================================
// /api/vehiculos/pagos/[id]/recibo — GET
// Devuelve el recibo del pago (JSON) o PDF si ?format=pdf
// El conductor puede descargarlo desde su portal.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'

function fmtCOP(v: number | null | undefined): string {
  if (!v) return '$0'
  return '$' + v.toLocaleString('es-CO')
}

function fmtFecha(f: Date | string | null | undefined): string {
  if (!f) return '—'
  const d = typeof f === 'string' ? new Date(f) : f
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtFechaHora(f: Date | string | null | undefined): string {
  if (!f) return '—'
  const d = typeof f === 'string' ? new Date(f) : f
  return d.toLocaleString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const url = new URL(req.url)
    const format = url.searchParams.get('format') || 'json'

    const recibo = await db.reciboPagoVehiculo.findUnique({
      where: { pagoId: id },
      include: {
        pago: { include: { comprobantes: true } },
        contrato: { include: { vehiculo: true, conductor: true } },
      },
    })

    if (!recibo) {
      return NextResponse.json(
        { success: false, error: 'No hay recibo generado para este pago' },
        { status: 404 }
      )
    }

    if (recibo.anulado) {
      return NextResponse.json(
        { success: false, error: `Recibo anulado: ${recibo.motivoAnulacion || 'sin motivo'}` },
        { status: 400 }
      )
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, data: recibo })
    }

    // === Generar PDF ===
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Recibo ${recibo.numeroRecibo}`,
        Author: 'Sistema de Gestión de Vehículos',
        Subject: 'Recibo de pago - Arrendamiento de vehículo',
      },
    })

    const buffers: Buffer[] = []
    doc.on('data', b => buffers.push(b))

    const ancho = doc.page.width - 100

    // === HEADER ===
    doc.fillColor('#1e40af').fontSize(22).font('Helvetica-Bold')
    doc.text('RECIBO DE PAGO', 50, 50, { align: 'center', width: ancho })

    doc.fillColor('#666').fontSize(10).font('Helvetica')
    doc.text(`Recibo N° ${recibo.numeroRecibo}`, 50, 80, { align: 'center', width: ancho })

    doc.moveTo(50, 100).lineTo(doc.page.width - 50, 100).strokeColor('#1e40af').lineWidth(2).stroke()

    let y = 120

    // === DATOS DEL RECIBO ===
    doc.fillColor('#1e40af').fontSize(13).font('Helvetica-Bold')
    doc.text('DETALLES DEL PAGO', 50, y)
    y += 22

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    const datosPago = [
      ['Número de recibo', recibo.numeroRecibo],
      ['Fecha de pago', fmtFecha(recibo.fechaPago)],
      ['Fecha de aprobación', fmtFechaHora(recibo.fechaAprobacion)],
      ['Monto pagado', fmtCOP(recibo.monto)],
      ['Método de pago', recibo.metodoPago],
      ['Banco origen', recibo.bancoOrigen || '—'],
      ['Referencia', recibo.referencia || '—'],
      ['Código de verificación', recibo.codigoVerificacion],
    ]
    for (const [label, value] of datosPago) {
      doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
      doc.font('Helvetica').text('  ' + value)
      y += 16
    }
    y += 10

    // === DATOS DEL CONTRATO ===
    doc.fillColor('#1e40af').fontSize(13).font('Helvetica-Bold')
    doc.text('CONTRATO Y VEHÍCULO', 50, y)
    y += 22

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    const datosContrato = [
      ['Contrato N°', recibo.numeroContrato],
      ['Conductor', recibo.nombreConductor],
      ['Cédula', recibo.cedulaConductor],
      ['Vehículo', recibo.placaVehiculo],
    ]
    for (const [label, value] of datosContrato) {
      doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
      doc.font('Helvetica').text('  ' + value)
      y += 16
    }
    y += 10

    // === OBLIGACIÓN CANCELADA ===
    if (recibo.numeroCuota) {
      doc.fillColor('#1e40af').fontSize(13).font('Helvetica-Bold')
      doc.text('OBLIGACIÓN CANCELADA', 50, y)
      y += 22

      doc.fillColor('#000').fontSize(10).font('Helvetica')
      const datosOblig = [
        ['Número de cuota', recibo.numeroCuota.toString()],
        ['Monto de la cuota', fmtCOP(recibo.montoCuota)],
        ['Multa aplicada', fmtCOP(recibo.multaAplicada)],
        ['Total cancelado', fmtCOP(recibo.monto)],
      ]
      for (const [label, value] of datosOblig) {
        doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
        doc.font('Helvetica').text('  ' + value)
        y += 16
      }
      y += 10
    }

    // === FIRMA DEL ADMINISTRADOR ===
    if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
    y += 20
    doc.fillColor('#1e40af').fontSize(13).font('Helvetica-Bold')
    doc.text('APROBADO POR', 50, y)
    y += 22

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    doc.text(`Aprobado por: ${recibo.nombreAprobador}`, 50, y)
    y += 16
    doc.text(`Fecha y hora: ${fmtFechaHora(recibo.fechaAprobacion)}`, 50, y)
    y += 30

    // Línea de firma
    doc.moveTo(70, y).lineTo(doc.page.width - 70, y).stroke()
    doc.fillColor('#666').fontSize(9).font('Helvetica-Oblique')
    doc.text(`Firma del administrador: ${recibo.nombreAprobador}`, 70, y + 5, { align: 'center', width: ancho })
    y += 40

    // === CÓDIGO DE VERIFICACIÓN ===
    if (y > doc.page.height - 100) { doc.addPage(); y = 50 }
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#1e40af').lineWidth(1).stroke()
    y += 20

    doc.fillColor('#1e40af').fontSize(11).font('Helvetica-Bold')
    doc.text('VERIFICACIÓN DE AUTENTICIDAD', 50, y, { align: 'center', width: ancho })
    y += 20

    doc.fillColor('#000').fontSize(9).font('Helvetica')
    doc.text(
      'Para verificar la autenticidad de este recibo, compare el siguiente código o escanéelo desde el portal:',
      50, y, { align: 'center', width: ancho }
    )
    y += 20

    doc.fillColor('#1e40af').fontSize(14).font('Courier-Bold')
    doc.text(recibo.codigoVerificacion, 50, y, { align: 'center', width: ancho })
    y += 30

    doc.fillColor('#666').fontSize(8).font('Helvetica-Oblique')
    doc.text(
      `Documento generado automáticamente al aprobar el pago. Recibo N° ${recibo.numeroRecibo} - Pago ID: ${recibo.pagoId}`,
      50, y, { align: 'center', width: ancho }
    )

    // === FOOTER ===
    doc.fillColor('#999').fontSize(8).font('Helvetica')
    doc.text(
      `Sistema de Gestión de Vehículos - Recibo ${recibo.numeroRecibo} - ${new Date().toLocaleString('es-CO')}`,
      50, doc.page.height - 30, { align: 'center', width: ancho }
    )

    // IMPORTANTE: registrar listeners ANTES de end()
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err: any) => reject(err))
      doc.end()
    })

    const filename = `Recibo_${recibo.numeroRecibo}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/pagos/recibo] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
