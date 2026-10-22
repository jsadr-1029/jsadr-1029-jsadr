// =====================================================
// /api/vehiculos/vehiculos/[id]/pdf-entrega
// Genera un PDF completo con:
//  1. Ficha técnica del vehículo (datos + foto)
//  2. Inventario completo (con fotos de items)
//  3. Documentos del vehículo (con fotos)
//  4. Datos del conductor asignado (con foto/selfie)
//  5. Contrato vigente
//  6. Mantenimientos realizados
//  7. Firmas de entrega
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { getVehiculosPermitidos } from '@/lib/permisos'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'
import https from 'https'
import http from 'http'

// === Helper: obtener imagen desde URL o base64 ===
// Redimensiona imágenes grandes para evitar quedarse sin memoria en Vercel serverless
import { createCanvas, loadImage } from 'canvas'

async function getImage(source: string): Promise<Buffer | null> {
  if (!source) return null

  // Si es base64 data URL (data:image/jpeg;base64,...)
  if (source.startsWith('data:')) {
    try {
      const base64Data = source.split(',')[1]
      if (!base64Data) return null
      const originalBuf = Buffer.from(base64Data, 'base64')
      
      // Si la imagen es menor a 80KB, usarla directamente
      if (originalBuf.length <= 80000) return originalBuf
      
      // Si es mayor a 80KB, redimensionar para reducir tamaño
      try {
        const img = await loadImage(originalBuf)
        const maxDim = 400 // máximo 400px de ancho para el PDF
        let w = img.width, h = img.height
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        const canvas = createCanvas(w, h)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const resizedBuf = canvas.toBuffer('image/jpeg', { quality: 0.5 })
        return resizedBuf
      } catch (resizeErr) {
        // Si no se puede redimensionar, no incluir la imagen
        return null
      }
    } catch {
      return null
    }
  }

  // Si es URL externa (http/https)
  if (source.startsWith('http')) {
    return new Promise((resolve) => {
      try {
        const lib = source.startsWith('https') ? https : http
        const req = lib.get(source, { timeout: 8000 }, (res) => {
          if (res.statusCode !== 200) { resolve(null); return }
          const chunks: Buffer[] = []
          let totalSize = 0
          res.on('data', c => {
            totalSize += c.length
            if (totalSize > 80000) { resolve(null); req.destroy(); return }
            chunks.push(c)
          })
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

  return null
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

// === Helper: agregar imagen al PDF (con manejo de errores robusto) ===
async function addImageToPDF(doc: any, imgSource: string | null | undefined, x: number, y: number, maxWidth: number, maxHeight: number): Promise<number> {
  if (!imgSource) return 0
  try {
    const imgBuffer = await getImage(imgSource)
    if (!imgBuffer || imgBuffer.length === 0) {
      // La imagen existe pero es muy grande para el PDF (>80KB)
      // Mostrar nota de que existe la foto
      if (imgSource && imgSource.startsWith('data:')) {
        const sizeKB = Math.round(imgSource.length * 0.75 / 1024)
        doc.fillColor('#999').fontSize(7).font('Helvetica-Oblique')
        doc.text(`[Foto disponible en sistema - ${sizeKB}KB]`, x, y, { width: maxWidth })
        return 15
      }
      return 0
    }
    doc.image(imgBuffer, x, y, { fit: [maxWidth, maxHeight], align: 'center' })
    return maxHeight + 10
  } catch (e) {
    try {
      doc.fillColor('#999').fontSize(7).font('Helvetica').text('[Imagen no disponible]', x, y, { width: maxWidth })
      return 15
    } catch { return 0 }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

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

    // === VERIFICAR VEHÍCULOS PERMITIDOS POR USUARIO ===
    const vehiculosPermitidos = getVehiculosPermitidos(user.username || user.id)
    if (vehiculosPermitidos !== null && !vehiculosPermitidos.includes(vehiculo.placa.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este vehículo' },
        { status: 403 }
      )
    }

    // Determinar contrato a incluir
    let contrato: any = null
    if (contratoId) {
      contrato = vehiculo.contratos.find(c => c.id === contratoId)
    } else {
      contrato = vehiculo.contratos.find(c => c.estado === 'ACTIVO') || vehiculo.contratos[0]
    }

    const conductor = contrato?.conductor || null

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

    const ancho = doc.page.width - 100

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
      if (y > doc.page.height - 300) { doc.addPage(); y = 50 }
      doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
      doc.text('Foto del vehículo:', 50, y)
      y += 18
      const imgHeight = await addImageToPDF(doc, vehiculo.fotoUrl, 50, y, ancho - 200, 250)
      if (imgHeight > 0) {
        y += imgHeight
      } else {
        doc.fillColor('#999').text('[Foto no disponible]', 50, y)
        y += 20
      }
    }

    // === 2. INVENTARIO (con fotos) ===
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

        for (let idx = 0; idx < vehiculo.inventario.length; idx++) {
          const item = vehiculo.inventario[idx]
          if (y > doc.page.height - 60) { doc.addPage(); y = 50 }
          doc.font('Helvetica').fontSize(9)
          doc.text((idx + 1).toString(), 50, y, { width: 30 })
          doc.text(item.nombre, 80, y, { width: 200 })
          doc.text(item.cantidad.toString(), 280, y, { width: 50, align: 'center' })
          doc.text(item.estado, 330, y, { width: 100 })
          doc.text(item.notas || '', 430, y, { width: 130 })
          y += 18

          // Foto del item (si tiene)
          if (item.fotoUrl) {
            if (y > doc.page.height - 150) { doc.addPage(); y = 50 }
            const itemImgHeight = await addImageToPDF(doc, item.fotoUrl, 80, y, 200, 120)
            if (itemImgHeight > 0) {
              y += itemImgHeight + 5
            }
          }
        }
        y += 10
      }
    }

    // === 3. DOCUMENTOS DEL VEHÍCULO (con fotos) ===
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

          // Foto del documento (si tiene)
          if (d.archivoUrl) {
            if (y > doc.page.height - 250) { doc.addPage(); y = 50 }
            const docImgHeight = await addImageToPDF(doc, d.archivoUrl, 50, y, ancho - 100, 200)
            if (docImgHeight > 0) {
              y += docImgHeight + 10
            }
          }
          y += 10
        }
      }
    }

    // === 4. DATOS DEL CONDUCTOR ASIGNADO (con foto) ===
    if (tipo === 'completo' && conductor) {
      if (y > doc.page.height - 300) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('4. CONDUCTOR ASIGNADO', 50, y)
      y += 22

      // Foto del conductor (selfie)
      if (conductor.fotoUrl) {
        const condImgHeight = await addImageToPDF(doc, conductor.fotoUrl, 50, y, 120, 150)
        if (condImgHeight > 0) {
          // Datos al lado de la foto
          doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
          doc.text('Nombre:', 200, y, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.nombre || '—'))
          doc.font('Helvetica-Bold').text('Cédula:', 200, y + 16, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.cedula || '—'))
          doc.font('Helvetica-Bold').text('Teléfono:', 200, y + 32, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.telefono || '—'))
          doc.font('Helvetica-Bold').text('Email:', 200, y + 48, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.email || '—'))
          doc.font('Helvetica-Bold').text('Dirección:', 200, y + 64, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.direccion || '—') + ', ' + (conductor.ciudad || ''))
          doc.font('Helvetica-Bold').text('Licencia:', 200, y + 80, { continued: true })
          doc.font('Helvetica').text('  ' + (conductor.licenciaCategoria || '—') + ' ' + (conductor.licenciaNumero || ''))
          doc.font('Helvetica-Bold').text('Lic. vence:', 200, y + 96, { continued: true })
          doc.font('Helvetica').text('  ' + fmtFecha(conductor.licenciaVence))
          y += Math.max(condImgHeight, 120) + 10
        } else {
          // Sin foto, solo datos
          doc.fillColor('#000').fontSize(10).font('Helvetica')
          const datosCond = [
            ['Nombre', conductor.nombre || '—'],
            ['Cédula', conductor.cedula || '—'],
            ['Teléfono', conductor.telefono || '—'],
            ['Email', conductor.email || '—'],
            ['Dirección', `${conductor.direccion || '—'}, ${conductor.ciudad || '—'}`],
            ['Licencia', `${conductor.licenciaCategoria || '—'} ${conductor.licenciaNumero || ''}`.trim()],
            ['Lic. vence', fmtFecha(conductor.licenciaVence)],
          ]
          for (const [label, value] of datosCond) {
            doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
            doc.font('Helvetica').text('  ' + value, { indent: 0 })
            y += 16
          }
          y += 10
        }
      } else {
        // Sin foto, solo datos
        doc.fillColor('#000').fontSize(10).font('Helvetica')
        const datosCond = [
          ['Nombre', conductor.nombre || '—'],
          ['Cédula', conductor.cedula || '—'],
          ['Teléfono', conductor.telefono || '—'],
          ['Email', conductor.email || '—'],
          ['Dirección', `${conductor.direccion || '—'}, ${conductor.ciudad || '—'}`],
          ['Licencia', `${conductor.licenciaCategoria || '—'} ${conductor.licenciaNumero || ''}`.trim()],
          ['Lic. vence', fmtFecha(conductor.licenciaVence)],
        ]
        for (const [label, value] of datosCond) {
          doc.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true })
          doc.font('Helvetica').text('  ' + value, { indent: 0 })
          y += 16
        }
        y += 10
      }
    }

    // === 5. CONTRATO ===
    if (tipo === 'completo' && contrato) {
      if (y > doc.page.height - 250) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('5. CONTRATO VIGENTE', 50, y)
      y += 22

      doc.fillColor('#000').fontSize(10).font('Helvetica')
      const datosContrato = [
        ['Número de contrato', contrato.numeroContrato],
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
        doc.font('Helvetica').text('  ' + value, { indent: 0 })
        y += 16
      }
      y += 10
    }

    // === 6. MANTENIMIENTOS ===
    if (tipo === 'completo') {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50 }
      doc.fillColor('#1e40af').fontSize(14).font('Helvetica-Bold')
      doc.text('6. HISTORIAL DE MANTENIMIENTOS', 50, y)
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

    // === 7. FIRMAS ===
    if (y > doc.page.height - 150) { doc.addPage(); y = 50 }
    y += 30
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#1e40af').lineWidth(1).stroke()
    y += 30

    doc.fillColor('#1e40af').fontSize(12).font('Helvetica-Bold')
    doc.text('ENTREGA CONFORME', 50, y, { align: 'center', width: ancho })
    y += 40

    const mitadX = doc.page.width / 2
    doc.moveTo(70, y).lineTo(mitadX - 30, y).stroke()
    doc.moveTo(mitadX + 30, y).lineTo(doc.page.width - 70, y).stroke()

    doc.fillColor('#000').fontSize(10).font('Helvetica')
    doc.text('Entregado por', 70, y + 5, { width: mitadX - 100, align: 'center' })
    doc.text('Recibido por', mitadX + 30, y + 5, { width: mitadX - 100, align: 'center' })
    y += 30

    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666')
    doc.text('Firma', 70, y, { width: mitadX - 100, align: 'center' })
    doc.text(`Conductor: ${conductor?.nombre || '_______'}`, mitadX + 30, y, { width: mitadX - 100, align: 'center' })
    y += 20

    doc.text(`Fecha: ${fmtFecha(new Date())}`, 70, y, { width: mitadX - 100, align: 'center' })
    doc.text(`CC: ${conductor?.cedula || '_______'}`, mitadX + 30, y, { width: mitadX - 100, align: 'center' })

    // === FOOTER en cada página ===
    // FIX: bufferedPageRange() puede no empezar en 0, usar el rango correcto
    try {
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc.fillColor('#999').fontSize(8).font('Helvetica')
        doc.text(
          `Documento generado por Sistema de Gestión de Vehículos - ${vehiculo.placa} - Página ${i - range.start + 1} de ${range.count}`,
          50, doc.page.height - 30, { align: 'center', width: ancho }
        )
      }
    } catch (e) {
      // Si switchToPage falla, simplemente continuar sin footer
      console.error('[pdf-entrega] Error en footer:', e)
    }

    // === IMPORTANTE: registrar listeners ANTES de doc.end() ===
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err: any) => reject(err))
      doc.end()
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
