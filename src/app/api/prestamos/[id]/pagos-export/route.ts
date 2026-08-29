import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// Sanitiza un valor para CSV: previene CSV injection (=CMD|cmd...)
// Si el valor empieza con =, +, -, @ o tab/CR, lo prefija con una comilla
// simple para que Excel/Sheets lo trate como texto.
function sanitizarCsv(valor: string | null | undefined): string {
  if (valor == null) return ''
  const s = String(valor)
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s
  }
  // Escapar comillas dobles envolventes
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// GET - exportar relación de pagos de un solicitud
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato') || 'csv'
    const cuotaFiltro = searchParams.get('cuota') // si viene, exporta solo esa cuota

    const prestamo = await db.prestamo.findUnique({
      where: { id },
      include: {
        cliente: true,
        pagos: {
          where: cuotaFiltro && cuotaFiltro !== 'all' ? { numeroCuota: parseInt(cuotaFiltro) } : {},
          include: { cuentaRecaudo: true },
          orderBy: { numeroCuota: 'asc' },
        },
      },
    })

    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrado' }, { status: 404 })
    }

    const fechaExport = new Date().toISOString().split('T')[0]

    if (formato === 'csv') {
      const lineas: string[] = []
      lineas.push('=== RELACIÓN DE PAGOS ===')
      lineas.push(`Solicitud: ${sanitizarCsv(prestamo.codigo)}`)
      lineas.push(`Cliente: ${sanitizarCsv(prestamo.cliente.nombre)}`)
      lineas.push(`Cédula: ${sanitizarCsv(prestamo.cliente.cedula)}`)
      lineas.push(`Monto Principal: ${prestamo.montoPrincipal}`)
      lineas.push(`Total a Pagar: ${prestamo.totalPagar}`)
      lineas.push(`Saldo Actual: ${prestamo.saldoTotal}`)
      lineas.push(`Cuotas Pagadas: ${prestamo.cuotasPagadas}/${prestamo.numeroCuotas}`)
      lineas.push(`Estado: ${sanitizarCsv(prestamo.estado)}`)
      lineas.push(`Fecha Exportación: ${new Date().toISOString()}`)
      lineas.push('')
      lineas.push('Cuota,Fecha Vencimiento,Fecha Pago,Capital,Interés,Mora,Total,Método,Cuenta,Referencia,Estado')

      prestamo.pagos.forEach((p) => {
        lineas.push(
          [
            p.numeroCuota,
            formatearFecha(p.fechaVencimiento),
            formatearFecha(p.fechaPago),
            p.montoCapital,
            p.montoInteres,
            p.montoMora,
            p.montoTotal,
            sanitizarCsv(p.metodoPago),
            sanitizarCsv(p.cuentaRecaudo?.nombre || ''),
            sanitizarCsv(p.referencia || ''),
            sanitizarCsv(p.estado),
          ].join(',')
        )
      })

      const totalPagado = prestamo.pagos.reduce((s, p) => s + p.montoTotal, 0)
      lineas.push('')
      lineas.push(`TOTAL PAGADO: ${totalPagado}`)

      return new NextResponse(lineas.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pagos_${prestamo.codigo}_${fechaExport}.csv"`,
        },
      })
    }

    // Formato JSON
    return new NextResponse(
      JSON.stringify(
        {
          prestamo: {
            codigo: prestamo.codigo,
            cliente: prestamo.cliente.nombre,
            cedula: prestamo.cliente.cedula,
            montoPrincipal: prestamo.montoPrincipal,
            totalPagar: prestamo.totalPagar,
            saldoTotal: prestamo.saldoTotal,
            cuotasPagadas: prestamo.cuotasPagadas,
            numeroCuotas: prestamo.numeroCuotas,
            estado: prestamo.estado,
          },
          pagos: prestamo.pagos,
          totalPagado: prestamo.pagos.reduce((s, p) => s + p.montoTotal, 0),
          fechaExportacion: new Date().toISOString(),
        },
        null,
        2
      ),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="pagos_${prestamo.codigo}_${fechaExport}.json"`,
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
