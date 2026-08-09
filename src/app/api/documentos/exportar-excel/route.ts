import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import ExcelJS from 'exceljs'

// =====================================================
// GET /api/documentos/exportar-excel
// =====================================================
// Exporta un consolidado en Excel de TODOS los documentos (fotos) del módulo
// DocumentosPrestamosView, ordenados por Cliente → Préstamo → Tipo → Fecha.
//
// Filtros opcionales (query string):
//   ?clienteId=xxx   → solo documentos de un cliente
//   ?prestamoId=xxx  → solo documentos de un préstamo
//   ?tipo=FOTO_SELSI → solo documentos de un tipo
//   ?incluirImagenes=true|false (default true) → embebe las imágenes en una columna
//
// El Excel tiene:
//   - 1 hoja "Inventario" con metadatos de cada documento.
//   - Columna "Imagen" con la foto embebida (si incluirImagenes=true y el
//     archivo es una imagen).
//   - 1 hoja "Resumen" con conteos por cliente y por tipo.
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId') || ''
    const prestamoId = searchParams.get('prestamoId') || ''
    const tipoFiltro = searchParams.get('tipo') || ''
    const incluirImagenes = (searchParams.get('incluirImagenes') || 'true') !== 'false'

    // === Construir filtro ===
    const where: any = {}
    if (clienteId) where.clienteId = clienteId
    if (prestamoId) where.prestamoId = prestamoId
    if (tipoFiltro) where.tipo = tipoFiltro

    // === Cargar documentos con relaciones ===
    // Limitamos a 1000 para no romper el runtime de Vercel.
    const documentos = await db.documentoGestor.findMany({
      where,
      orderBy: [{ cliente: { nombre: 'asc' } }, { prestamo: { codigo: 'asc' } }, { createdAt: 'desc' }],
      take: 1000,
      include: {
        prestamo: { select: { id: true, codigo: true } },
        cliente: { select: { id: true, nombre: true, cedula: true } },
      },
    })

    if (documentos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay documentos para exportar con los filtros especificados.' },
        { status: 404 }
      )
    }

    // === Mapeo de tipos → label legible ===
    const TIPO_LABEL: Record<string, string> = {
      FOTO_CLIENTE: 'Foto del Cliente',
      PANTALLAZO_CONVERSACION: 'Pantallazo Conversación',
      FOTO_DOCUMENTO: 'Foto Documento',
      FOTO_SELFI: 'Selfie con Cédula',
      COMPROBANTE_PAGO: 'Comprobante de Pago',
      PAGARE_FIRMA: 'Pagaré firmado',
      CARTA_INSTRUCCIONES: 'Carta de Instrucciones',
      CERTIFICADO_FIRMA: 'Certificado de Firma',
      OTRO: 'Otro',
    }

    // === Crear workbook ===
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'JSADR - Sistema de Préstamos'
    workbook.created = new Date()

    // ---------- Hoja 1: Inventario ----------
    const ws = workbook.addWorksheet('Inventario', {
      properties: { defaultRowHeight: 80 },
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    ws.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Cliente', key: 'cliente', width: 32 },
      { header: 'Cédula', key: 'cedula', width: 18 },
      { header: 'Código Préstamo', key: 'prestamo', width: 28 },
      { header: 'Tipo documento', key: 'tipo', width: 28 },
      { header: 'Título', key: 'titulo', width: 40 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Fecha subida', key: 'fecha', width: 22 },
      { header: 'Subido por', key: 'subidoPor', width: 24 },
      { header: 'Tamaño (KB)', key: 'tamano', width: 14 },
      { header: 'Nombre archivo', key: 'archivoNombre', width: 30 },
      { header: 'Imagen', key: 'imagen', width: 28 },
    ]

    // Estilo del header
    const headerRow = ws.getRow(1)
    headerRow.height = 22
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // indigo-600
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    headerRow.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }

    let imagenEmbedCount = 0
    const MAX_IMAGENES = 200 // límite para no exceder memoria/tiempo en Vercel

    for (let i = 0; i < documentos.length; i++) {
      const d = documentos[i]
      const rowIdx = i + 2
      const row = ws.getRow(rowIdx)

      row.values = {
        idx: i + 1,
        cliente: d.cliente?.nombre || '—',
        cedula: d.cliente?.cedula || '—',
        prestamo: d.prestamo?.codigo || '—',
        tipo: TIPO_LABEL[d.tipo] || d.tipo,
        titulo: d.titulo,
        descripcion: d.descripcion || '',
        fecha: d.createdAt ? new Date(d.createdAt).toLocaleString('es-CO') : '',
        subidoPor: d.subidoPor || '—',
        tamano: Math.round((d.archivoTamano || 0) / 1024 * 100) / 100,
        archivoNombre: d.archivoNombre,
        imagen: '',
      }

      row.alignment = { vertical: 'top', wrapText: true }
      row.height = 80

      // === Embeber imagen si aplica ===
      if (
        incluirImagenes &&
        imagenEmbedCount < MAX_IMAGENES &&
        d.archivoBase64 &&
        d.archivoTipo &&
        d.archivoTipo.startsWith('image/')
      ) {
        try {
          const base64Data = d.archivoBase64.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          const ext = (d.archivoTipo.split('/')[1] || 'png').toLowerCase()
          const extension: 'png' | 'jpeg' | 'gif' =
            ext === 'jpeg' || ext === 'jpg' ? 'jpeg' : (ext === 'gif' ? 'gif' : 'png')
          const imageId = workbook.addImage({
            buffer: buffer as any,
            extension,
          })
          // Insertar la imagen en la celda de la columna "Imagen" (col 12 = L)
          ws.addImage(imageId, {
            tl: { col: 11, row: rowIdx - 1 },
            ext: { width: 180, height: 130 },
          })
          imagenEmbedCount++
          row.getCell(12).value = '📷 Ver imagen'
        } catch {
          row.getCell(12).value = '⚠️ Error al cargar imagen'
        }
      } else if (incluirImagenes && d.archivoBase64 && d.archivoTipo?.startsWith('image/')) {
        row.getCell(12).value = `📷 Imagen no embebida (límite ${MAX_IMAGENES} alcanzado)`
      } else if (d.archivoBase64) {
        row.getCell(12).value = `📎 ${d.archivoTipo || 'Archivo'}`
      } else {
        row.getCell(12).value = '—'
      }
    }

    // Auto-filtro en la primera fila
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 12 },
    }

    // ---------- Hoja 2: Resumen ----------
    const wsResumen = workbook.addWorksheet('Resumen')
    wsResumen.columns = [
      { header: 'Categoría', key: 'categoria', width: 32 },
      { header: 'Valor', key: 'valor', width: 32 },
      { header: 'Cantidad', key: 'cantidad', width: 14 },
    ]
    const rHeader = wsResumen.getRow(1)
    rHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    rHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    rHeader.alignment = { vertical: 'middle', horizontal: 'center' }

    // Conteos por tipo
    const porTipo: Record<string, number> = {}
    const porCliente: Record<string, number> = {}
    let total = 0
    let totalConImagen = 0

    for (const d of documentos) {
      total++
      const tipoKey = TIPO_LABEL[d.tipo] || d.tipo
      porTipo[tipoKey] = (porTipo[tipoKey] || 0) + 1
      const clienteKey = d.cliente?.nombre
        ? `${d.cliente.nombre} (${d.cliente.cedula || '—'})`
        : 'Sin cliente'
      porCliente[clienteKey] = (porCliente[clienteKey] || 0) + 1
      if (d.archivoBase64 && d.archivoTipo?.startsWith('image/')) totalConImagen++
    }

    let r = 2
    wsResumen.getRow(r).values = ['📊 Total documentos', '', total]
    r++
    wsResumen.getRow(r).values = ['📷 Documentos con imagen', '', totalConImagen]
    r++
    wsResumen.getRow(r).values = ['', '', '']
    r++
    wsResumen.getRow(r).values = ['Conteo por tipo', '', '']
    r++
    for (const [k, v] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
      wsResumen.getRow(r).values = ['', k, v]
      r++
    }
    r++
    wsResumen.getRow(r).values = ['Conteo por cliente', '', '']
    r++
    for (const [k, v] of Object.entries(porCliente).sort((a, b) => b[1] - a[1])) {
      wsResumen.getRow(r).values = ['', k, v]
      r++
    }

    // Aplicar bordes a todas las celdas con datos en Resumen
    for (let i = 1; i <= r; i++) {
      const rr = wsResumen.getRow(i)
      for (let c = 1; c <= 3; c++) {
        const cell = rr.getCell(c)
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        }
      }
    }

    // === Devolver como response con headers de descarga ===
    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `documentos-prestamos-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error en /api/documentos/exportar-excel:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    )
  }
}
