// /api/reportes/balance v4.13
// Balance de cartera: capital prestado, intereses, mora, pagos recibidos.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import { excluirPruebaPago, excluirPruebaPrestamo } from '@/lib/cliente-prueba'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    const wherePrestamo: any = { ...excluirPruebaPrestamo() }
    if (desde || hasta) {
      wherePrestamo.fechaDesembolso = {}
      if (desde) wherePrestamo.fechaDesembolso.gte = new Date(desde)
      if (hasta) wherePrestamo.fechaDesembolso.lte = new Date(hasta)
    }

    const wherePago: any = { estado: 'APLICADO', ...excluirPruebaPago() }
    if (desde || hasta) {
      wherePago.fechaPago = {}
      if (desde) wherePago.fechaPago.gte = new Date(desde)
      if (hasta) wherePago.fechaPago.lte = new Date(hasta)
    }

    const [prestamos, pagos] = await Promise.all([
      db.prestamo.findMany({
        where: wherePrestamo,
        select: {
          montoPrincipal: true,
          totalInteres: true,
          totalPagar: true,
          saldoTotal: true,
          saldoCapital: true,
          saldoInteres: true,
          montoMora: true,
          estado: true,
        },
        take: 10000,
      }),
      db.pago.findMany({
        where: wherePago,
        select: { montoTotal: true, montoCapital: true, montoInteres: true, montoMora: true },
      }),
    ])

    const capitalPrestado = prestamos.reduce((s, p) => s + p.montoPrincipal, 0)
    const interesesGenerados = prestamos.reduce((s, p) => s + p.totalInteres, 0)
    const moraGenerada = prestamos.reduce((s, p) => s + (p.montoMora || 0), 0)
    const saldoPendiente = prestamos.reduce((s, p) => s + p.saldoTotal, 0)

    const pagosRecibidos = pagos.reduce((s, p) => s + p.montoTotal, 0)
    const capitalPagado = pagos.reduce((s, p) => s + p.montoCapital, 0)
    const interesPagado = pagos.reduce((s, p) => s + p.montoInteres, 0)
    const moraPagada = pagos.reduce((s, p) => s + p.montoMora, 0)

    return NextResponse.json({
      success: true,
      data: {
        capitalPrestado,
        interesesGenerados,
        moraGenerada,
        saldoPendiente,
        pagosRecibidos,
        capitalPagado,
        interesPagado,
        moraPagada,
        // Indicadores derivados
        rentabilidad: capitalPrestado > 0 ? Number(((interesesGenerados / capitalPrestado) * 100).toFixed(2)) : 0,
        ratioMora: capitalPrestado > 0 ? Number(((moraGenerada / capitalPrestado) * 100).toFixed(2)) : 0,
        totalPréstamos: prestamos.length,
        totalPagos: pagos.length,
        rango: { desde, hasta },
      },
    })
  } catch (error) {
    logError('/api/reportes/balance GET', error)
    return errorResponse('/api/reportes/balance GET', error)
  }
}
