// =====================================================
// /api/reportes/cartera v4.13
// Reporte de cartera con resumen + filtros + exportación Excel/PDF
// =====================================================
// Soporta:
//   GET /api/reportes/cartera                 → JSON con resumen
//   GET /api/reportes/cartera?format=xlsx     → descarga Excel
//   GET /api/reportes/cartera?format=pdf      → descarga PDF
//   GET /api/reportes/cartera?gestorId=<id>   → filtra por gestor (vía clienteId)
//   GET /api/reportes/cartera?desde=...&hasta=... → filtra por fecha de desembolso
// RBAC: ADMIN y CONSULTOR (lectura)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

export async function GET(req: NextRequest) {
  try {
    // RBAC: ADMIN y CONSULTOR (solo lectura)
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'
    const gestorId = searchParams.get('gestorId')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    // Construir where dinámico
    const where: any = { estado: { in: ['ACTIVO', 'EN_MORA', 'JURIDICO'] } }
    if (gestorId) {
      where.clienteId = gestorId
    }
    if (desde || hasta) {
      where.fechaDesembolso = {} as any
      if (desde) where.fechaDesembolso.gte = new Date(desde)
      if (hasta) where.fechaDesembolso.lte = new Date(hasta)
    }

    // === Carga paralela optimizada ===
    const [prestamos, prestamosMora, pagosAplicados, totalPrestamosCount] = await Promise.all([
      db.prestamo.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
          categoria: { select: { id: true, nombre: true, codigo: true } },
          pagos: { where: { estado: 'APLICADO' }, select: { montoTotal: true, numeroCuota: true } },
        },
        take: 5000,
        orderBy: { saldoTotal: 'desc' },
      }),
      db.prestamo.findMany({
        where: { ...where, estado: 'EN_MORA' },
        select: { id: true, saldoTotal: true, diasMora: true, montoMora: true },
      }),
      db.pago.findMany({
        where: { estado: 'APLICADO', prestamo: { ...where } },
        select: { montoTotal: true, montoCapital: true, montoInteres: true, montoMora: true },
      }),
      db.prestamo.count({ where }),
    ])

    // === KPIs ===
    const carteraTotal = prestamos.reduce((sum, p) => sum + p.saldoTotal, 0)
    const montoEnMora = prestamosMora.reduce((sum, p) => sum + p.saldoTotal, 0)
    const alDia = prestamos
      .filter((p) => p.estado !== 'EN_MORA' && p.estado !== 'JURIDICO')
      .reduce((sum, p) => sum + p.saldoTotal, 0)
    const porcentajeMora = carteraTotal > 0 ? (montoEnMora / carteraTotal) * 100 : 0
    const totalPagosRecibidos = pagosAplicados.reduce((sum, p) => sum + p.montoTotal, 0)
    const totalCapitalPagado = pagosAplicados.reduce((sum, p) => sum + p.montoCapital, 0)
    const totalInteresPagado = pagosAplicados.reduce((sum, p) => sum + p.montoInteres, 0)
    const totalMoraPagada = pagosAplicados.reduce((sum, p) => sum + p.montoMora, 0)

    const detalle = prestamos.map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      cedula: p.cliente.cedula,
      categoria: p.categoria?.nombre || '—',
      montoPrincipal: p.montoPrincipal,
      saldoTotal: p.saldoTotal,
      saldoCapital: p.saldoCapital,
      saldoInteres: p.saldoInteres,
      diasMora: p.diasMora,
      estado: p.estado,
      fechaDesembolso: p.fechaDesembolso?.toISOString().split('T')[0] || '—',
      fechaVencimiento: p.fechaVencimiento?.toISOString().split('T')[0] || '—',
      pagosAplicados: p.pagos.length,
    }))

    const resumen = {
      totalPrestamos: totalPrestamosCount,
      carteraTotal,
      montoEnMora,
      carteraAlDia: alDia,
      cantidadEnMora: prestamosMora.length,
      porcentajeMora: Number(porcentajeMora.toFixed(2)),
      totalPagosRecibidos,
      totalCapitalPagado,
      totalInteresPagado,
      totalMoraPagada,
      filtros: { gestorId, desde, hasta },
    }

    // === JSON ===
    if (format === 'json') {
      return NextResponse.json({ success: true, data: { resumen, detalle } })
    }

    // === Excel ===
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Sistema de Préstamos JSADR'
      workbook.created = new Date()

      const wsResumen = workbook.addWorksheet('Resumen')
      wsResumen.columns = [
        { header: 'Métrica', key: 'metrica', width: 35 },
        { header: 'Valor', key: 'valor', width: 25 },
      ]
      wsResumen.addRow({ metrica: 'Total Préstamos', valor: resumen.totalPrestamos })
      wsResumen.addRow({ metrica: 'Cartera Total', valor: resumen.carteraTotal })
      wsResumen.addRow({ metrica: 'Monto en Mora', valor: resumen.montoEnMora })
      wsResumen.addRow({ metrica: 'Cartera al Día', valor: resumen.carteraAlDia })
      wsResumen.addRow({ metrica: 'Cantidad en Mora', valor: resumen.cantidadEnMora })
      wsResumen.addRow({ metrica: '% Mora', valor: resumen.porcentajeMora })
      wsResumen.addRow({ metrica: 'Total Pagos Recibidos', valor: resumen.totalPagosRecibidos })
      wsResumen.addRow({ metrica: 'Total Capital Pagado', valor: resumen.totalCapitalPagado })
      wsResumen.addRow({ metrica: 'Total Interés Pagado', valor: resumen.totalInteresPagado })
      wsResumen.addRow({ metrica: 'Total Mora Pagada', valor: resumen.totalMoraPagada })
      wsResumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsResumen.getRow(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' }
      }

      const wsDetalle = workbook.addWorksheet('Detalle')
      wsDetalle.columns = [
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Categoría', key: 'categoria', width: 20 },
        { header: 'Monto Principal', key: 'montoPrincipal', width: 18 },
        { header: 'Saldo Total', key: 'saldoTotal', width: 18 },
        { header: 'Saldo Capital', key: 'saldoCapital', width: 18 },
        { header: 'Saldo Interés', key: 'saldoInteres', width: 18 },
        { header: 'Días Mora', key: 'diasMora', width: 12 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'F. Desembolso', key: 'fechaDesembolso', width: 15 },
        { header: 'F. Vencimiento', key: 'fechaVencimiento', width: 15 },
        { header: 'Pagos Aplicados', key: 'pagosAplicados', width: 15 },
      ]
      detalle.forEach((d) => wsDetalle.addRow(d))
      wsDetalle.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      wsDetalle.getRow(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const fechaExport = new Date().toISOString().split('T')[0]
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="reporte_cartera_${fechaExport}.xlsx"`,
        },
      })
    }

    // === PDF ===
    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'letter', layout: 'landscape', margin: 40 })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))

      doc.fontSize(20).fillColor('#1f2937').text('Reporte de Cartera', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).fillColor('#6b7280')
        .text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' })
      if (gestorId || desde || hasta) {
        doc.text(`Filtros: ${gestorId ? `gestorId=${gestorId} ` : ''}${desde ? `desde=${desde} ` : ''}${hasta ? `hasta=${hasta}` : ''}`, { align: 'center' })
      }
      doc.moveDown(1)

      doc.fontSize(12).fillColor('#1f2937').text('Resumen', { underline: true })
      doc.moveDown(0.3)
      doc.fontSize(10).fillColor('#374151')
      doc.text(`Total Préstamos: ${resumen.totalPrestamos}`, { continued: true })
      doc.text(`   Cartera Total: $${resumen.carteraTotal.toLocaleString('es-CO')}`)
      doc.text(`Monto en Mora: $${resumen.montoEnMora.toLocaleString('es-CO')}   (% ${resumen.porcentajeMora}%)`)
      doc.text(`Cartera al Día: $${resumen.carteraAlDia.toLocaleString('es-CO')}`)
      doc.text(`Pagos Recibidos: $${resumen.totalPagosRecibidos.toLocaleString('es-CO')}`)
      doc.moveDown(1)

      doc.fontSize(12).fillColor('#1f2937').text('Detalle (Top 20)', { underline: true })
      doc.moveDown(0.3)
      doc.fontSize(8).fillColor('#374151')
      doc.text('Código      Cliente                          Saldo Total        Días Mora  Estado')
      doc.moveDown(0.2)
      detalle.slice(0, 20).forEach((d) => {
        doc.text(
          `${d.codigo.padEnd(12)} ${d.cliente.slice(0, 25).padEnd(28)} $${d.saldoTotal.toFixed(0).padStart(12)} ${String(d.diasMora).padStart(10)}  ${d.estado.padEnd(10)}`
        )
      })

      doc.end()
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)))
      })

      const fechaExport = new Date().toISOString().split('T')[0]
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reporte_cartera_${fechaExport}.pdf"`,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: `Formato no soportado: ${format}. Use json, xlsx o pdf.` },
      { status: 400 }
    )
  } catch (error) {
    logError('/api/reportes/cartera GET', error)
    return errorResponse('/api/reportes/cartera GET', error)
  }
}
