// /api/reportes/clientes-activos v4.13
// Reporte de clientes activos con # préstamos y # pagos.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'
import { excluirPruebaCliente, excluirPruebaPago } from '@/lib/cliente-prueba'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    // Se excluyen automáticamente los clientes de prueba (esPrueba=true)
    const clientes = await db.cliente.findMany({
      where: { activo: true, ...excluirPruebaCliente() },
      include: {
        prestamos: {
          where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
          select: { id: true, codigo: true, saldoTotal: true, estado: true },
        },
        _count: {
          select: {
            prestamos: true,
          },
        },
      },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    })

    // Para cada cliente, contar pagos aplicados (excluyendo pagos de préstamos de prueba)
    const clienteIds = clientes.map((c) => c.id)
    const pagosPorCliente = await db.pago.groupBy({
      by: ['prestamoId'],
      where: {
        estado: 'APLICADO',
        ...excluirPruebaPago(),
        prestamo: { clienteId: { in: clienteIds } },
      },
      _count: true,
      _sum: { montoTotal: true },
    })

    // Mapa prestamoId → {count, total}
    const pagosMap = new Map(pagosPorCliente.map((p) => [p.prestamoId, { count: p._count, total: p._sum.montoTotal || 0 }]))

    // Agregar número de pagos por cliente
    const resultado = clientes.map((c) => {
      const prestamosActivos = c.prestamos.length
      const saldoTotal = c.prestamos.reduce((s, p) => s + p.saldoTotal, 0)
      // Sumar pagos de todos los préstamos del cliente
      let numeroPagos = 0
      let totalPagos = 0
      for (const p of c.prestamos) {
        const pp = pagosMap.get(p.id)
        if (pp) {
          numeroPagos += pp.count
          totalPagos += pp.total
        }
      }
      return {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        telefono: c.telefono,
        email: c.email,
        numeroPrestamos: c._count.prestamos,
        prestamosActivos,
        saldoTotal,
        numeroPagos,
        totalPagos,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        total: resultado.length,
        clientes: resultado,
      },
    })
  } catch (error) {
    logError('/api/reportes/clientes-activos GET', error)
    return errorResponse('/api/reportes/clientes-activos GET', error)
  }
}
