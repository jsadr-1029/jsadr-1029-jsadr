// /api/reportes/caja v4.13
// Reporte de caja diario: movimientos del día, saldo inicial, saldo final.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const fechaParam = searchParams.get('fecha')
    const cajaId = searchParams.get('cajaId')

    const fecha = fechaParam ? new Date(fechaParam) : new Date()
    const inicioDia = new Date(fecha)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(fecha)
    finDia.setHours(23, 59, 59, 999)

    // Cargar cajas
    const cajas = await db.cajaMenor.findMany({
      where: cajaId ? { id: cajaId } : undefined,
      include: {
        movimientos: {
          where: { fechaMovimiento: { gte: inicioDia, lte: finDia } },
          orderBy: { fechaMovimiento: 'asc' },
        },
      },
    })

    // Para cada caja: calcular saldo inicial (antes del día) y final (con movimientos del día)
    const resultado = await Promise.all(cajas.map(async (caja) => {
      // Saldo inicial = saldo anterior a inicioDia (sumar ingresos - egresos antes del día)
      const movimientosAnteriores = await db.movimientoCaja.findMany({
        where: {
          cajaId: caja.id,
          fechaMovimiento: { lt: inicioDia },
        },
        select: { tipo: true, monto: true },
      })
      const saldoInicial = movimientosAnteriores.reduce((s, m) => {
        return s + (m.tipo === 'INGRESO' ? m.monto : -m.monto)
      }, 0)

      // Movimientos del día
      const movimientosDia = caja.movimientos
      const ingresosDia = movimientosDia
        .filter((m) => m.tipo === 'INGRESO')
        .reduce((s, m) => s + m.monto, 0)
      const egresosDia = movimientosDia
        .filter((m) => m.tipo === 'EGRESO')
        .reduce((s, m) => s + m.monto, 0)
      const saldoFinal = saldoInicial + ingresosDia - egresosDia

      return {
        cajaId: caja.id,
        cajaNombre: caja.nombre,
        fecha: inicioDia.toISOString().split('T')[0],
        saldoInicial,
        ingresosDia,
        egresosDia,
        saldoFinal,
        cantidadMovimientos: movimientosDia.length,
        movimientos: movimientosDia,
      }
    }))

    // Totales consolidados
    const totales = {
      saldoInicialTotal: resultado.reduce((s, r) => s + r.saldoInicial, 0),
      ingresosTotal: resultado.reduce((s, r) => s + r.ingresosDia, 0),
      egresosTotal: resultado.reduce((s, r) => s + r.egresosDia, 0),
      saldoFinalTotal: resultado.reduce((s, r) => s + r.saldoFinal, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        fecha: inicioDia.toISOString().split('T')[0],
        cajas: resultado,
        totales,
      },
    })
  } catch (error) {
    logError('/api/reportes/caja GET', error)
    return errorResponse('/api/reportes/caja GET', error)
  }
}
