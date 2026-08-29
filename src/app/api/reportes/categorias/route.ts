// /api/reportes/categorias v4.13
// Reporte por categoría: montos por categoriaId.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    // groupBy por categoriaId
    const [porCategoria, categorias] = await Promise.all([
      db.prestamo.groupBy({
        by: ['categoriaId'],
        _count: true,
        _sum: {
          montoPrincipal: true,
          saldoTotal: true,
          totalInteres: true,
          montoMora: true,
        },
      }),
      db.categoriaCliente.findMany({
        select: { id: true, nombre: true, codigo: true, descripcion: true },
      }),
    ])

    const categoriasMap = new Map(categorias.map((c) => [c.id, c]))

    const resultado = porCategoria.map((g) => {
      const cat = categoriasMap.get(g.categoriaId || '')
      return {
        categoriaId: g.categoriaId,
        nombre: cat?.nombre || 'Sin categoría',
        codigo: cat?.codigo || '—',
        descripcion: cat?.descripcion || '',
        cantidadPrestamos: g._count,
        montoPrincipal: g._sum.montoPrincipal || 0,
        saldoTotal: g._sum.saldoTotal || 0,
        totalInteres: g._sum.totalInteres || 0,
        montoMora: g._sum.montoMora || 0,
      }
    })

    // Agregar categorías sin solicitudes
    for (const cat of categorias) {
      if (!porCategoria.some((g) => g.categoriaId === cat.id)) {
        resultado.push({
          categoriaId: cat.id,
          nombre: cat.nombre,
          codigo: cat.codigo,
          descripcion: cat.descripcion || '',
          cantidadPrestamos: 0,
          montoPrincipal: 0,
          saldoTotal: 0,
          totalInteres: 0,
          montoMora: 0,
        })
      }
    }

    const totales = {
      totalCategorias: resultado.length,
      totalPrestamos: resultado.reduce((s, r) => s + r.cantidadPrestamos, 0),
      montoTotal: resultado.reduce((s, r) => s + r.montoPrincipal, 0),
      saldoTotal: resultado.reduce((s, r) => s + r.saldoTotal, 0),
    }

    return NextResponse.json({
      success: true,
      data: { categorias: resultado, totales },
    })
  } catch (error) {
    logError('/api/reportes/categorias GET', error)
    return errorResponse('/api/reportes/categorias GET', error)
  }
}
