// /api/reportes/morosidad v4.13
// Reporte de morosidad por rango de fechas con agrupación por día/semana/mes.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import { excluirPruebaPrestamo } from '@/lib/cliente-prueba'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const agruparPor = searchParams.get('agruparPor') || 'dia' // dia | semana | mes

    // Defaults: últimos 30 días si no se especifica
    const fechaInicio = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fechaFin = hasta ? new Date(hasta) : new Date()
    fechaFin.setHours(23, 59, 59, 999)

    // Cargar préstamos EN_MORA en el rango (excluyendo clientes de prueba)
    const prestamosMora = await db.prestamo.findMany({
      where: {
        estado: 'EN_MORA',
        ...excluirPruebaPrestamo(),
        OR: [
          { fechaDesembolso: { gte: fechaInicio, lte: fechaFin } },
          { updatedAt: { gte: fechaInicio, lte: fechaFin } },
        ],
      },
      include: {
        cliente: { select: { nombre: true, cedula: true } },
      },
      take: 5000,
    })

    // Agrupar por día/semana/mes
    const grupos = new Map<string, { count: number; montoTotal: number; diasMoraAcum: number }>()
    for (const p of prestamosMora) {
      const fechaRef = p.updatedAt
      let key: string
      if (agruparPor === 'mes') {
        key = `${fechaRef.getFullYear()}-${String(fechaRef.getMonth() + 1).padStart(2, '0')}`
      } else if (agruparPor === 'semana') {
        const semana = Math.floor((fechaRef.getTime() - fechaInicio.getTime()) / (7 * 24 * 60 * 60 * 1000))
        key = `Semana ${semana + 1}`
      } else {
        key = fechaRef.toISOString().split('T')[0]
      }
      const g = grupos.get(key) || { count: 0, montoTotal: 0, diasMoraAcum: 0 }
      g.count++
      g.montoTotal += p.saldoTotal
      g.diasMoraAcum += p.diasMora
      grupos.set(key, g)
    }

    const porPeriodo = Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, g]) => ({
        periodo,
        cantidadPrestamos: g.count,
        montoTotal: g.montoTotal,
        diasMoraPromedio: g.count > 0 ? Math.round(g.diasMoraAcum / g.count) : 0,
      }))

    const resumen = {
      totalEnMora: prestamosMora.length,
      montoTotalEnMora: prestamosMora.reduce((s, p) => s + p.saldoTotal, 0),
      diasMoraPromedio: prestamosMora.length > 0
        ? Math.round(prestamosMora.reduce((s, p) => s + p.diasMora, 0) / prestamosMora.length)
        : 0,
      rango: { desde: fechaInicio.toISOString(), hasta: fechaFin.toISOString() },
      agruparPor,
    }

    return NextResponse.json({
      success: true,
      data: { resumen, porPeriodo, detalle: prestamosMora },
    })
  } catch (error) {
    logError('/api/reportes/morosidad GET', error)
    return errorResponse('/api/reportes/morosidad GET', error)
  }
}
