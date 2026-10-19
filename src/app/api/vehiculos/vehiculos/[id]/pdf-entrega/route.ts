// =====================================================
// /api/vehiculos/vehiculos/[id]/pdf-entrega
// Genera un PDF completo con:
//  1. Ficha técnica del vehículo (datos, fotos)
//  2. Inventario completo del vehículo
//  3. Contrato vigente (si hay)
//  4. Mantenimientos realizados
//  5. Documentos (SOAT, tecno, etc.)
//  6. Fotos del vehículo
//
// Query params:
//  ?contratoId=xxx — incluye un contrato específico
//  ?tipo=ficha — solo ficha técnica
//  ?tipo=inventario — solo inventario
//  ?tipo=completo (default) — todo
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import https from 'https'
import http from 'http'

function fetchImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http
      const req = lib.get(url, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', () => resolve(null))
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch {
      resolve(null)
    }
  })
}

function fmtCOP(v: number | null | undefined): string {
  if (!v) return '$0'
  return '$' + v.toLocaleString('es-CO')
}

function fmtFecha(f: Date | string | null | undefined): string {
  if (!f) return '—'
  const d = typeof f === 'string' ? new Date(f) : f
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
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
    const contratoId = url.searchParams.get('contratoId')
    const tipo = url.searchParams.get('tipo') || 'completo'

    const vehiculo = await db.vehiculo.findUnique({
      where: { id },
      include: {
        documentos: { orderBy: { createdAt: 'desc' } },
        inventario: { orderBy: { createdAt: 'desc' } },
        mantenimientos: {
          include: {
            repuestos: { include: { repuesto: true } },
            proveedorRef: true,
          },
          orderBy: { fecha: 'desc' },
        },
        contratos: {
          include: { conductor: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!vehiculo) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Determinar contrato a incluir
    let contrato: any = null
    if (contratoId) {
      contrato = vehiculo.contratos.find(c => c.id === contratoId)
    } else {
      contrato = vehiculo.contratos.find(c => c.estado === 'ACTIVO') || vehiculo.contratos[0]
    }

    // === Generar PDF ===
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Ficha de Entrega - Vehículo ${vehiculo.placa}`,
        Author: 'Sistema de Gestión de Vehículos',
        Subject: 'Documento de entrega de vehículo',
      },
    })

    const buffers: Buffer[] = []
    doc.on('data', b => buffers.push(b))

    const ancho = doc.page.width - 100 // márgenes

    // === ENCABEZADO ===
    doc.fillColor('#1e40af').fontSize(20).font('Helvetica-Bold')
    doc.text('FICHA DE ENTREGA DE VEHÍCULO', 50, 50, { align: 'center', width: ancho })

    doc.fillColor('#666').fontSize(10).font('Helvetica')
    doc.text(`Generado el ${new Date().toLocaleString('es-CO')}`, 50, 80, { align: 'center', width: ancho })

    doc.moveTo(50, 100).lineTo(doc.page.width - 50, 100).strokeColor('#1e40af').lineWidth(2).stroke()

    let y = 120

    // === 1. DATOS DEL VEHÍCULO ===
    doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
    doc.text('1. DATOS DEL VEHÍCULO', 50, y)
    y += 22

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    const datosVehiculo = [
      ['Placa', vehiculo.placa],
      ['Marca / Modelo', `${vehiculo.marca} ${vehiculo.modelo}`],
      ['Año', vehiculo.anio?.toString() || '—'],
      ['Color', vehiculo.color || '—'],
      ['Kilometraje actual', `${(vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`],
      ['VIN / Chasis', vehiculo.vin || '—'],
      ['N° Motor', vehiculo.motor || '—'],
      ['Estado', vehiculo.estado],
      ['Fecha de compra', fmtFecha(vehiculo.fechaCompra)],
      ['Valor de compra', fmtCOP(vehiculo.valorCompra)],
    ]

    for (const [label, value] of datosVehiculo) {
      doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
      doc.font('Helvetica').text('  ' + value, { indent: 0 })
      y += 16
    }
    y += 10

    // Foto principal del vehículo
    if (vehiculo.fotoUrl) {
      const imgBuffer = await fetchImage(vehiculo.fotoUrl)
      if (imgBuffer) {
        try {
          doc.text('Foto del vehículo:', 50, y)
          y += 18
          doc.image(imgBuffer, 50, y, { fit: [ancho - 200, 250], align: 'center' })
          y += 260
        } catch {
          doc.fillColor('#999').text('[Foto no disponible]', 50, y)
          y += 20
        }
      }
    }

    // === 2. INVENTARIO ===
    if (tipo === 'completo' || tipo === 'inventario') {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('2. INVENTARIO DE ENTREGA', 50, y)
      y += 22

      if (vehiculo.inventario.length === 0) {
        doc.fillColor('#666').fontSize(10).font('Helvetica-Oblique')
        doc.text('No hay items registrados en el inventario.', 50, y)
        y += 20
      } else {
        // Cabecera de tabla
        doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
        doc.text('#', 50, y, { width: 30 })
        doc.text('Item', 80, y, { width: 200 })
        doc.text('Cant.', 280, y, { width: 50, align: 'center' })
        doc.text('Estado', 330, y, { width: 100 })
        doc.text('Notas', 430, y, { width: 130 })
        y += 16
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke()
        y += 8

        doc.font('Helvetica').fontSize(9)
        vehiculo.inventario.forEach((item, idx) => {
          if (y > doc.page.height - 60) { doc.addPage(); y = 50 }
          doc.text((idx + 1).toString(), 50, y, { width: 30 })
          doc.text(item.nombre, 80, y, { width: 200 })
          doc.text(item.cantidad.toString(), 280, y, { width: 50, align: 'center' })
          doc.text(item.estado, 330, y, { width: 100 })
          doc.text(item.notas || '', 430, y, { width: 130 })
          y += 18
        })
        y += 10
      }
    }

    // === 3. DOCUMENTOS ===
    if (tipo === 'completo') {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('3. DOCUMENTOS DEL VEHÍCULO', 50, y)
      y += 22

      if (vehiculo.documentos.length === 0) {
        doc.fillColor('#666').fontSize(10).font('Helvetica-Oblique')
        doc.text('No hay documentos registrados.', 50, y)
        y += 20
      } else {
        for (const d of vehiculo.documentos) {
          if (y > doc.page.height - 80) { doc.addPage(); y = 50 }
          doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
          doc.text(`${d.tipo}${d.numero ? ' - ' + d.numero : ''}`, 50, y)
          y += 16
          doc.font('Helvetica').fontSize(9)
          if (d.entidadEmisora) {
            doc.text(`Emisor: ${d.entidadEmisora}`, 50, y); y += 14
          }
          if (d.fechaEmision) {
            doc.text(`Emitido: ${fmtFecha(d.fechaEmision)}`, 50, y); y += 14
          }
          if (d.fechaVencimiento) {
            const dias = Math.ceil((d.fechaVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            const estadoColor = dias < 0 ? '#dc2626' : dias < 15 ? '#ca8a04' : '#16a34a'
            doc.fillColor(estadoColor).font('Helvetica-Bold')
            doc.text(`Vence: ${fmtFecha(d.fechaVencimiento)} (${dias < 0 ? 'VENCIDO' : dias + ' días'})`, 50, y)
            doc.fillColor('#000').font('Helvetica')
            y += 14
          }
          y += 6
        }
      }
    }

    // === 4. CONTRATO ===
    if (tipo === 'completo' && contrato) {
      if (y > doc.page.height - 250) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('4. CONTRATO VIGENTE', 50, y)
      y += 22

      doc.fillColor('#000').fontSize(10).font('Helvetica')
      const datosContrato = [
        ['Número de contrato', contrato.numeroContrato],
        ['Conductor', contrato.conductor?.nombre || '—'],
        ['Cédula conductor', contrato.conductor?.cedula || '—'],
        ['Teléfono conductor', contrato.conductor?.telefono || '—'],
        ['Licencia conductor', `${contrato.conductor?.licenciaCategoria || ''} ${contrato.conductor?.licenciaNumero || ''}`.trim()],
        ['Fecha inicio', fmtFecha(contrato.fechaInicio)],
        ['Fecha fin', contrato.fechaFin ? fmtFecha(contrato.fechaFin) : 'Indefinida'],
        ['Modalidad de pago', contrato.modalidadPago],
        ['Tarifa', `${fmtCOP(contrato.tarifa)} / ${contrato.modalidadPago}`],
        ['Días de gracia', (contrato.diasGracia || 0).toString()],
        ['Multa diaria', fmtCOP(contrato.multaDiaria)],
        ['Depósito', fmtCOP(contrato.deposito)],
        ['Estado', contrato.estado],
      ]
      for (const [label, value] of datosContrato) {
        doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
        doc.font('Helvetica').text('  ' + value)
        y += 16
      }
      y += 10
    }

    // === 5. MANTENIMIENTOS ===
    if (tipo === 'completo') {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('5. HISTORIAL DE MANTENIMIENTOS', 50, y)
      y += 22

      if (vehiculo.mantenimientos.length === 0) {
        doc.fillColor('#666').fontSize(10).font('Helvetica-Oblique')
        doc.text('No hay mantenimientos registrados.', 50, y)
        y += 20
      } else {
        for (const m of vehiculo.mantenimientos) {
          if (y > doc.page.height - 100) { doc.addPage(); y = 50 }
          doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
          doc.text(`${fmtFecha(m.fecha)} - ${m.tipo} (${m.kilometraje} km)`, 50, y)
          y += 16
          doc.font('Helvetica').fontSize(9)
          doc.text(`Trabajo: ${m.trabajoRealizado}`, 50, y); y += 14
          if (m.taller) { doc.text(`Taller: ${m.taller}`, 50, y); y += 14 }
          if (m.proveedorRef) { doc.text(`Proveedor: ${m.proveedorRef.nombre}`, 50, y); y += 14 }
          doc.text(`Costo: ${fmtCOP(m.costo)}`, 50, y); y += 14
          if (m.proximaRevisionFecha || m.proximaRevisionKm) {
            doc.fillColor('#ca8a04').text(`Próxima revisión: ${m.proximaRevisionFecha ? fmtFecha(m.proximaRevisionFecha) : ''} ${m.proximaRevisionKm ? '· ' + m.proximaRevisionKm + ' km' : ''}`, 50, y)
            doc.fillColor('#000')
            y += 14
          }
          if (m.repuestos && m.repuestos.length > 0) {
            doc.font('Helvetica-Oblique').text(`Repuestos: ${m.repuestos.map((r: any) => r.repuesto?.nombre).join(', ')}`, 50, y)
            doc.font('Helvetica')
            y += 14
          }
          y += 6
        }
      }
    }

    // === 6. FIRMAS ===
    if (y > doc.page.height - 150) { doc.addPage(); y = 50 }
    y += 30
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#1e40af').lineWidth(1).stroke()
    y += 30

    doc.fillColor('#1e40af').fontSize(12).font('Helvetica-Bold')
    doc.text('ENTREGA CONFORME', 50, y, { align: 'center', width: ancho })
    y += 40

    // Líneas de firma
    const mitadX = doc.page.width / 2
    doc.moveTo(70, y).lineTo(mitadX - 30, y).stroke()
    doc.moveTo(mitadX + 30, y).lineTo(doc.page.width - 70, y).stroke()

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    doc.text('Entregado por', 70, y + 5, { width: mitadX - 100, align: 'center' })
    doc.text('Recibido por', mitadX + 30, y + 5, { width: mitadX - 100, align: 'center' })
    y += 30

    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666')
    doc.text('Firma', 70, y, { width: mitadX - 100, align: 'center' })
    doc.text(`Conductor: ${contrato?.conductor?.nombre || '_______'}`, mitadX + 30, y, { width: mitadX - 100, align: 'center' })
    y += 20

    doc.text(`Fecha: ${fmtFecha(new Date())}`, 70, y, { width: mitadX - 100, align: 'center' })
    doc.text(`CC: ${contrato?.conductor?.cedula || '_______'}`, mitadX + 30, y, { width: mitadX - 100, align: 'center' })

    // === FOOTER en cada página ===
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fillColor('#999').fontSize(8).font('Helvetica')
      doc.text(
        `Documento generado por Sistema de Gestión de Vehículos - ${vehiculo.placa} - Página ${i + 1} de ${pages.count}`,
        50, doc.page.height - 30, { align: 'center', width: ancho }
      )
    }

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
    })

    const filename = `Entrega_${vehiculo.placa}_${new Date().toISOString().slice(0, 10)}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/pdf-entrega] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
