// /api/reportes/pagos v4.13
// Reporte de pagos por período: total, count, separa reversados/anulados.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const metodoPago = searchParams.get('metodoPago')

    const where: any = {}
    if (desde || hasta) {
      where.fechaPago = {}
      if (desde) where.fechaPago.gte = new Date(desde)
      if (hasta) where.fechaPago.lte = new Date(hasta)
    }
    if (metodoPago) where.metodoPago = metodoPago

    const [aplicados, reversados, anulados] = await Promise.all([
      db.pago.findMany({
        where: { ...where, estado: 'APLICADO' },
        include: {
          prestamo: {
            select: { codigo: true, cliente: { select: { nombre: true, cedula: true } } },
          },
        },
        take: 10000,
        orderBy: { fechaPago: 'desc' },
      }),
      db.pago.findMany({
        where: { ...where, estado: 'REVERSADO' },
        include: {
          prestamo: { select: { codigo: true, cliente: { select: { nombre: true, cedula: true } } } },
        },
        take: 10000,
      }),
      db.pago.findMany({
        where: { ...where, estado: 'ANULADO' },
        include: {
          prestamo: { select: { codigo: true, cliente: { select: { nombre: true, cedula: true } } } },
        },
        take: 10000,
      }),
    ])

    const totalAplicados = aplicados.reduce((s, p) => s + p.montoTotal, 0)
    const totalReversados = reversados.reduce((s, p) => s + p.montoTotal, 0)
    const totalAnulados = anulados.reduce((s, p) => s + p.montoTotal, 0)

    return NextResponse.json({
      success: true,
      data: {
        aplicados: {
          count: aplicados.length,
          total: totalAplicados,
          capital: aplicados.reduce((s, p) => s + p.montoCapital, 0),
          interes: aplicados.reduce((s, p) => s + p.montoInteres, 0),
          mora: aplicados.reduce((s, p) => s + p.montoMora, 0),
          detalle: aplicados,
        },
        reversados: {
          count: reversados.length,
          total: totalReversados,
          detalle: reversados,
        },
        anulados: {
          count: anulados.length,
          total: totalAnulados,
          detalle: anulados,
        },
        resumen: {
          totalGeneral: totalAplicados + totalReversados + totalAnulados,
          countGeneral: aplicados.length + reversados.length + anulados.length,
        },
        filtros: { desde, hasta, metodoPago },
      },
    })
  } catch (error) {
    logError('/api/reportes/pagos GET', error)
    return errorResponse('/api/reportes/pagos GET', error)
  }
}
