import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import ExcelJS from 'exceljs'

// =====================================================
// /api/pagos/export-anio
// -----------------------------------------------------
// Exporta TODOS los pagos del año vigente a Excel (.xlsx).
// Cada fila = 1 pago con TODOS los datos del cliente y el crédito.
//
// Permisos: ADMIN, GESTOR, CONSULTOR.
//
// Parámetros:
//   - anio (opcional): Año a exportar. Default = año actual.
//   - estado (opcional): Filtrar por estado. Default = APLICADO.
//                       Use 'TODOS' para incluir todos los estados.
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const anioParam = searchParams.get('anio')
    const estadoFiltro = searchParams.get('estado') || 'APLICADO'

    const hoy = new Date()
    const anio = anioParam ? parseInt(anioParam, 10) : hoy.getFullYear()
    if (isNaN(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json(
        { success: false, error: 'Año inválido' },
        { status: 400 }
      )
    }

    // Rango de fechas: 01/ene al 31/dic del año indicado
    const inicio = new Date(anio, 0, 1, 0, 0, 0, 0)
    const fin = new Date(anio, 11, 31, 23, 59, 59, 999)

    // Construir filtro WHERE
    const where: any = {
      fechaPago: { gte: inicio, lte: fin },
    }
    if (estadoFiltro !== 'TODOS') {
      where.estado = estadoFiltro
    } else {
      // Excluir ANULADO por defecto cuando se piden TODOS
      where.estado = { not: 'ANULADO' }
    }

    // Consultar todos los pagos con datos completos
    const pagos = await db.pago.findMany({
      where,
      include: {
        prestamo: {
          include: {
            cliente: true,
            categoria: { include: { cuentaRecaudo: true } },
          },
        },
        cuentaRecaudo: true,
      },
      orderBy: [{ fechaPago: 'asc' }, { createdAt: 'asc' }],
    })

    // === Crear workbook Excel ===
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Microfinanciera JSADR'
    workbook.created = new Date()
    workbook.modified = new Date()

    // ----- HOJA 1: Pagos -----
    const ws = workbook.addWorksheet('Pagos', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { defaultRowHeight: 18 },
    })

    // Definir columnas con encabezados y anchos
    const columns = [
      { header: '#', key: 'idx', width: 5 },
      { header: 'Código Pago', key: 'codigoPago', width: 22 },
      { header: 'Fecha Pago', key: 'fechaPago', width: 20 },
      { header: 'Hora', key: 'horaPago', width: 10 },
      { header: 'Estado', key: 'estado', width: 12 },

      // --- Datos del crédito ---
      { header: 'Código Crédito', key: 'creditoCodigo', width: 28 },
      { header: 'Estado Crédito', key: 'creditoEstado', width: 14 },
      { header: 'Modalidad', key: 'creditoModalidad', width: 18 },
      { header: 'Frecuencia', key: 'creditoFrecuencia', width: 12 },
      { header: 'Monto Principal', key: 'creditoMonto', width: 16 },
      { header: 'Tasa Mensual %', key: 'creditoTasa', width: 14 },
      { header: 'N° Cuotas', key: 'creditoNumCuotas', width: 10 },
      { header: 'Plazo (meses)', key: 'creditoPlazo', width: 12 },
      { header: 'Fecha Desembolso', key: 'creditoFechaDesembolso', width: 18 },
      { header: 'Fecha Vencimiento', key: 'creditoFechaVenc', width: 18 },
      { header: 'Cuotas Pagadas', key: 'creditoCuotasPagadas', width: 12 },
      { header: 'Saldo Capital', key: 'creditoSaldoCapital', width: 16 },
      { header: 'Saldo Total', key: 'creditoSaldoTotal', width: 16 },

      // --- Datos de la cuota ---
      { header: 'N° Cuota', key: 'numCuota', width: 10 },
      { header: 'Fecha Vencimiento Cuota', key: 'fechaVencCuota', width: 20 },
      { header: 'Capital Pagado', key: 'capital', width: 16 },
      { header: 'Interés Pagado', key: 'interes', width: 16 },
      { header: 'Mora Pagada', key: 'mora', width: 14 },
      { header: 'Total Pagado', key: 'total', width: 16 },
      { header: 'Método de Pago', key: 'metodo', width: 18 },
      { header: 'Referencia', key: 'referencia', width: 22 },
      { header: 'Cuenta de Recaudo', key: 'cuentaRecaudo', width: 22 },
      { header: 'Solo Intereses', key: 'soloIntereses', width: 12 },
      { header: 'Notas', key: 'notas', width: 30 },

      // --- Datos del cliente ---
      { header: 'Nombre Cliente', key: 'clienteNombre', width: 28 },
      { header: 'Cédula', key: 'clienteCedula', width: 14 },
      { header: 'Teléfono', key: 'clienteTelefono', width: 14 },
      { header: 'Email', key: 'clienteEmail', width: 30 },
      { header: 'Departamento', key: 'clienteDepto', width: 16 },
      { header: 'Municipio', key: 'clienteMunicipio', width: 18 },
      { header: 'Ciudad', key: 'clienteCiudad', width: 18 },
      { header: 'Barrio', key: 'clienteBarrio', width: 20 },
      { header: 'Dirección', key: 'clienteDireccion', width: 28 },
      { header: 'Salario', key: 'clienteSalario', width: 14 },
      { header: 'Banco', key: 'clienteBanco', width: 16 },
      { header: 'Tipo Cuenta', key: 'clienteTipoCuenta', width: 14 },
      { header: 'N° Cuenta', key: 'clienteNumCuenta', width: 18 },
      { header: 'Cliente Activo', key: 'clienteActivo', width: 12 },
    ]

    ws.columns = columns

    // Estilo encabezados
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // blue-800
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    headerRow.height = 32

    // === Filas de datos ===
    const fmtFecha = (d: Date | null | undefined): string => {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
      })
    }
    const fmtFechaHora = (d: Date | null | undefined): { fecha: string; hora: string } => {
      if (!d) return { fecha: '—', hora: '—' }
      const dt = new Date(d).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
      const [fecha, hora] = dt.split(', ')
      return { fecha, hora: hora || '—' }
    }
    const fmtMoneda = (n: number | null | undefined): number => {
      const v = Number(n || 0)
      return Math.round(v)
    }

    let idx = 1
    for (const p of pagos) {
      const { fecha: fechaPagoStr, hora: horaPagoStr } = fmtFechaHora(p.fechaPago)
      const cliente = p.prestamo.cliente
      const credito = p.prestamo

      const row = {
        idx: idx++,
        codigoPago: p.codigo || '—',
        fechaPago: fechaPagoStr,
        horaPago: horaPagoStr,
        estado: p.estado || '—',

        creditoCodigo: credito.codigo || '—',
        creditoEstado: credito.estado || '—',
        creditoModalidad: credito.modalidadAmortizacion || 'FRANCES',
        creditoFrecuencia: credito.frecuencia || '—',
        creditoMonto: fmtMoneda(credito.montoPrincipal),
        creditoTasa: Number(credito.tasaInteresMensual || 0),
        creditoNumCuotas: credito.numeroCuotas || 0,
        creditoPlazo: credito.plazoMeses || 0,
        creditoFechaDesembolso: fmtFecha(credito.fechaDesembolso),
        creditoFechaVenc: fmtFecha(credito.fechaVencimiento),
        creditoCuotasPagadas: credito.cuotasPagadas || 0,
        creditoSaldoCapital: fmtMoneda(credito.saldoCapital),
        creditoSaldoTotal: fmtMoneda(credito.saldoTotal),

        numCuota: p.numeroCuota || 0,
        fechaVencCuota: fmtFecha(p.fechaVencimiento),
        capital: fmtMoneda(p.montoCapital),
        interes: fmtMoneda(p.montoInteres),
        mora: fmtMoneda(p.montoMora),
        total: fmtMoneda(p.montoTotal),
        metodo: p.metodoPago || '—',
        referencia: p.referencia || '',
        cuentaRecaudo: p.cuentaRecaudo?.codigo || p.cuentaRecaudo?.nombre || '',
        soloIntereses: p.esSoloIntereses ? 'SÍ' : 'NO',
        notas: p.notas || '',

        clienteNombre: cliente.nombre || '—',
        clienteCedula: cliente.cedula || '—',
        clienteTelefono: cliente.telefono || '—',
        clienteEmail: cliente.email || '',
        clienteDepto: cliente.departamento || '',
        clienteMunicipio: cliente.municipio || '',
        clienteCiudad: cliente.ciudad || '',
        clienteBarrio: cliente.barrio || '',
        clienteDireccion: cliente.direccion || '',
        clienteSalario: fmtMoneda(cliente.salario),
        clienteBanco: cliente.bancoCliente || '',
        clienteTipoCuenta: cliente.tipoCuentaCliente || '',
        clienteNumCuenta: cliente.numeroCuentaCliente || '',
        clienteActivo: cliente.activo ? 'SÍ' : 'NO',
      }

      ws.addRow(row)
    }

    // Formato de columnas numéricas (moneda)
    const colsMoneda = [
      'creditoMonto', 'creditoSaldoCapital', 'creditoSaldoTotal',
      'capital', 'interes', 'mora', 'total', 'clienteSalario',
    ]
    for (const key of colsMoneda) {
      const col = ws.getColumn(key)
      col.numFmt = '#,##0'
    }
    // Tasa como número con 2 decimales
    ws.getColumn('creditoTasa').numFmt = '0.00'

    // Bordes y alineación para todas las celdas con datos
    const lastRow = ws.rowCount
    for (let r = 2; r <= lastRow; r++) {
      const row = ws.getRow(r)
      row.alignment = { vertical: 'middle', horizontal: 'left' }
      row.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
      // Alternar color de fila (zebra)
      if (r % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // slate-50
        }
      }
    }

    // Auto-filtro en la primera fila
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }

    // ----- HOJA 2: Resumen -----
    const wsRes = workbook.addWorksheet('Resumen', {
      properties: { defaultRowHeight: 22 },
    })
    wsRes.columns = [
      { header: 'Métrica', key: 'metrica', width: 38 },
      { header: 'Valor', key: 'valor', width: 28 },
    ]
    const resHeader = wsRes.getRow(1)
    resHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    resHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' },
    }
    resHeader.alignment = { horizontal: 'center' }

    const totalPagos = pagos.length
    const totalCapital = pagos.reduce((s, p) => s + (p.montoCapital || 0), 0)
    const totalInteres = pagos.reduce((s, p) => s + (p.montoInteres || 0), 0)
    const totalMora = pagos.reduce((s, p) => s + (p.montoMora || 0), 0)
    const totalGeneral = pagos.reduce((s, p) => s + (p.montoTotal || 0), 0)

    // Contar clientes únicos y créditos únicos
    const clientesUnicos = new Set(pagos.map(p => p.prestamo.clienteId))
    const creditosUnicos = new Set(pagos.map(p => p.prestamoId))

    // Desglose por método de pago
    const porMetodo: Record<string, { count: number; total: number }> = {}
    for (const p of pagos) {
      const m = p.metodoPago || 'OTRO'
      if (!porMetodo[m]) porMetodo[m] = { count: 0, total: 0 }
      porMetodo[m].count++
      porMetodo[m].total += p.montoTotal || 0
    }

    // Desglose por mes
    const porMes: Record<number, { count: number; total: number }> = {}
    for (const p of pagos) {
      if (!p.fechaPago) continue
      const m = new Date(p.fechaPago).getMonth() + 1
      if (!porMes[m]) porMes[m] = { count: 0, total: 0 }
      porMes[m].count++
      porMes[m].total += p.montoTotal || 0
    }

    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    const resumenRows: Array<{ metrica: string; valor: any }> = [
      { metrica: `AÑO EXPORTADO`, valor: anio.toString() },
      { metrica: `Estado de pagos incluidos`, valor: estadoFiltro },
      { metrica: `Total de pagos`, valor: totalPagos.toLocaleString('es-CO') },
      { metrica: `Clientes únicos`, valor: clientesUnicos.size.toLocaleString('es-CO') },
      { metrica: `Créditos únicos`, valor: creditosUnicos.size.toLocaleString('es-CO') },
      { metrica: ``, valor: '' },
      { metrica: `Total Capital Recaudado`, valor: totalCapital },
      { metrica: `Total Interés Recaudado`, valor: totalInteres },
      { metrica: `Total Mora Recaudada`, valor: totalMora },
      { metrica: `TOTAL GENERAL RECAUDADO`, valor: totalGeneral },
      { metrica: ``, valor: '' },
      { metrica: `=== DESGLOSE POR MES ===`, valor: '' },
    ]
    for (let m = 1; m <= 12; m++) {
      if (porMes[m]) {
        resumenRows.push({
          metrica: `${nombresMeses[m - 1]} ${anio}`,
          valor: `${porMes[m].count} pagos — $${porMes[m].total.toLocaleString('es-CO')}`,
        })
      }
    }
    resumenRows.push({ metrica: ``, valor: '' })
    resumenRows.push({ metrica: `=== DESGLOSE POR MÉTODO DE PAGO ===`, valor: '' })
    for (const [m, data] of Object.entries(porMetodo)) {
      resumenRows.push({
        metrica: m,
        valor: `${data.count} pagos — $${data.total.toLocaleString('es-CO')}`,
      })
    }

    for (const r of resumenRows) {
      wsRes.addRow(r)
    }

    // Formatear montos en hoja resumen
    for (let r = 1; r <= wsRes.rowCount; r++) {
      const row = wsRes.getRow(r)
      const val = row.getCell(2).value
      if (typeof val === 'number' && val > 100) {
        row.getCell(2).numFmt = '"$" #,##0'
      }
      row.alignment = { vertical: 'middle' }
    }

    // Generar buffer Excel
    const buffer = await workbook.xlsx.writeBuffer()

    const filename = `pagos_anio_${anio}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('[pagos/export-anio] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
