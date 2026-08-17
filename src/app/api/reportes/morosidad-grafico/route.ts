// /api/reportes/morosidad-grafico v4.13
// Datos estructurados para gráfico de morosidad (formato Chart.js: labels + datasets).
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
    const rango = searchParams.get('rango') || '30d' // 7d | 30d | 90d | 12m

    const dias = rango === '7d' ? 7 : rango === '90d' ? 90 : 30
    const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    // Cargar préstamos EN_MORA con sus fechas (excluyendo clientes de prueba)
    const prestamosMora = await db.prestamo.findMany({
      where: {
        estado: 'EN_MORA',
        ...excluirPruebaPrestamo(),
        updatedAt: { gte: fechaInicio },
      },
      select: { diasMora: true, saldoTotal: true, updatedAt: true, montoMora: true },
      take: 5000,
    })

    // Agrupar por día
    const porDia = new Map<string, { count: number; monto: number }>()
    for (let i = 0; i < dias; i++) {
      const fecha = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const fechaStr = fecha.toISOString().split('T')[0]
      porDia.set(fechaStr, { count: 0, monto: 0 })
    }
    for (const p of prestamosMora) {
      const fechaStr = p.updatedAt.toISOString().split('T')[0]
      const g = porDia.get(fechaStr)
      if (g) {
        g.count++
        g.monto += p.saldoTotal
      }
    }

    // Ordenar por fecha ascendente
    const labels: string[] = []
    const dataCount: number[] = []
    const dataMonto: number[] = []
    Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([fecha, g]) => {
        labels.push(fecha)
        dataCount.push(g.count)
        dataMonto.push(g.monto)
      })

    // Distribución por rango de días de mora
    const rangos = [
      { label: '1-7 días', min: 1, max: 7 },
      { label: '8-30 días', min: 8, max: 30 },
      { label: '31-60 días', min: 31, max: 60 },
      { label: '60+ días', min: 61, max: 99999 },
    ]
    const distribucion = rangos.map((r) => ({
      label: r.label,
      count: prestamosMora.filter((p) => p.diasMora >= r.min && p.diasMora <= r.max).length,
      monto: prestamosMora
        .filter((p) => p.diasMora >= r.min && p.diasMora <= r.max)
        .reduce((s, p) => s + p.saldoTotal, 0),
    }))

    return NextResponse.json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de préstamos en mora',
            data: dataCount,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
          },
          {
            label: 'Monto en mora ($)',
            data: dataMonto,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            yAxisID: 'y1',
          },
        ],
        distribucion,
        summary: {
          totalEnMora: prestamosMora.length,
          montoTotal: prestamosMora.reduce((s, p) => s + p.saldoTotal, 0),
          diasMoraPromedio: prestamosMora.length > 0
            ? Math.round(prestamosMora.reduce((s, p) => s + p.diasMora, 0) / prestamosMora.length)
            : 0,
        },
      },
    })
  } catch (error) {
    logError('/api/reportes/morosidad-grafico GET', error)
    return errorResponse('/api/reportes/morosidad-grafico GET', error)
  }
}
