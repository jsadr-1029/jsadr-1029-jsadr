// /api/reportes/auditoria v4.13
// Reporte de AuditLog por usuarioId. SOLO ADMIN (no CONSULTOR, no GESTOR).
// Es solo lectura: no POST, no PUT, no DELETE.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    // RBAC: SOLO ADMIN
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuarioId')
    const modulo = searchParams.get('modulo')
    const accion = searchParams.get('accion')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const entidadId = searchParams.get('entidadId')
    const exito = searchParams.get('exito')

    const where: any = {}
    if (usuarioId) where.usuarioId = usuarioId
    if (modulo) where.modulo = modulo
    if (accion) where.accion = accion
    if (entidadId) where.entidadId = entidadId
    if (exito !== null && exito !== undefined && exito !== '') where.exito = exito === 'true'
    if (desde || hasta) {
      where.fecha = {}
      if (desde) where.fecha.gte = new Date(desde)
      if (hasta) where.fecha.lte = new Date(hasta)
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
        },
        orderBy: { fecha: 'desc' },
        take: 1000, // Reforzado: límite anti-DoS
      }),
      db.auditLog.count({ where }),
    ])

    // Resumen agregado
    const porModulo = await db.auditLog.groupBy({
      by: ['modulo'],
      where,
      _count: true,
    })
    const porAccion = await db.auditLog.groupBy({
      by: ['accion'],
      where,
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        total,
        logs,
        resumen: {
          porModulo: porModulo.map((g) => ({ modulo: g.modulo, count: g._count })),
          porAccion: porAccion.map((g) => ({ accion: g.accion, count: g._count })),
        },
        filtros: { usuarioId, modulo, accion, entidadId, exito, desde, hasta },
      },
    })
  } catch (error) {
    logError('/api/reportes/auditoria GET', error)
    return errorResponse('/api/reportes/auditoria GET', error)
  }
}

// Nota: este endpoint es SOLO LECTURA. No se definen POST/PUT/DELETE.
// AuditLog es inmutable por diseño (solo el sistema puede escribir vía registrarAuditLog).
