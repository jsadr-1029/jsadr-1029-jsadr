// =====================================================
// /api/reportes/accesos-portal — Reporte de accesos al portal v3.0
// GET: lista accesos al portal con filtros
// Requiere autenticación ADMIN o GESTOR
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    const clienteCedula = searchParams.get('clienteCedula')
    const accion = searchParams.get('accion')
    const exito = searchParams.get('exito')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const dias = parseInt(searchParams.get('dias') || '0', 10)
    const limit = parseInt(searchParams.get('limit') || '500', 10)

    const where: any = {}
    if (clienteId) where.clienteId = clienteId
    if (clienteCedula) where.clienteCedula = clienteCedula
    if (accion) where.accion = accion
    if (exito === 'true') where.exito = true
    if (exito === 'false') where.exito = false

    // Filtro por fecha
    const rangoFecha: any = {}
    if (dias > 0) {
      const desde = new Date()
      desde.setDate(desde.getDate() - dias)
      desde.setHours(0, 0, 0, 0)
      rangoFecha.gte = desde
    }
    if (fechaDesde) rangoFecha.gte = new Date(fechaDesde)
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      rangoFecha.lte = hasta
    }
    if (Object.keys(rangoFecha).length > 0) {
      where.createdAt = rangoFecha
    }

    const [accesos, total] = await Promise.all([
      db.accesoPortal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 1000),
      }),
      db.accesoPortal.count({ where }),
    ])

    // === KPIs del reporte ===
    const totalHoy = await db.accesoPortal.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    })

    // Intentos fallidos en el rango
    const whereFallidos: any = { accion: 'INTENTO_FALLIDO', exito: false }
    if (Object.keys(rangoFecha).length > 0) {
      whereFallidos.createdAt = rangoFecha
    }
    const intentosFallidosRango = await db.accesoPortal.count({
      where: whereFallidos,
    })

    const intentosFallidosHoy = await db.accesoPortal.count({
      where: {
        accion: 'INTENTO_FALLIDO',
        exito: false,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    })

    const loginsExitososHoy = await db.accesoPortal.count({
      where: {
        accion: 'LOGIN',
        exito: true,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    })

    // Clientes únicos hoy
    const clientesUnicosHoy = await db.accesoPortal.groupBy({
      by: ['clienteCedula'],
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
        clienteCedula: { not: null },
      },
      _count: true,
    })

    // Clientes únicos en el rango
    const clientesUnicosRango = await db.accesoPortal.groupBy({
      by: ['clienteCedula'],
      where: {
        ...where,
        clienteCedula: { not: null },
      },
      _count: true,
    })

    // Top 15 clientes con más accesos en el rango
    const topClientes = await db.accesoPortal.groupBy({
      by: ['clienteCedula', 'clienteNombre'],
      where: {
        ...where,
        clienteCedula: { not: null },
      },
      _count: true,
      orderBy: { _count: { clienteCedula: 'desc' } },
      take: 15,
    })

    // Accesos por acción en el rango
    const porAccion = await db.accesoPortal.groupBy({
      by: ['accion'],
      where,
      _count: true,
    })

    // === Agregaciones en memoria (por día y por dispositivo) ===
    const porDiaMap = new Map<
      string,
      { fecha: string; logins: number; consultas: number; fallidos: number }
    >()
    const porDispositivoMap = new Map<string, number>()

    for (const a of accesos) {
      // Por día
      const fechaStr = new Date(a.createdAt).toISOString().split('T')[0]
      const existing = porDiaMap.get(fechaStr) || {
        fecha: fechaStr,
        logins: 0,
        consultas: 0,
        fallidos: 0,
      }
      if (a.accion === 'LOGIN' && a.exito) existing.logins++
      else if (a.accion === 'CONSULTA') existing.consultas++
      else if (a.accion === 'INTENTO_FALLIDO' || !a.exito) existing.fallidos++
      porDiaMap.set(fechaStr, existing)

      // Por dispositivo (parsear userAgent)
      const ua = a.userAgent || ''
      let dispositivo = 'Otro'
      if (/mobile|android|iphone|ipad/i.test(ua)) dispositivo = 'Móvil'
      else if (/tablet|ipad/i.test(ua)) dispositivo = 'Tablet'
      else if (/windows|macintosh|linux/i.test(ua)) dispositivo = 'Escritorio'
      porDispositivoMap.set(dispositivo, (porDispositivoMap.get(dispositivo) || 0) + 1)
    }

    const porDia = Array.from(porDiaMap.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    )
    const porDispositivo = Array.from(porDispositivoMap.entries()).map(([name, value]) => ({
      name,
      value,
    }))

    return NextResponse.json({
      success: true,
      data: accesos,
      kpis: {
        totalRegistros: total,
        totalHoy,
        intentosFallidosHoy,
        loginsExitososHoy,
        clientesUnicosHoy: clientesUnicosHoy.length,
        clientesUnicosRango: clientesUnicosRango.length,
        intentosFallidosRango,
      },
      resumen: {
        topClientes,
        porAccion,
        porDia,
        porDispositivo,
      },
    })
  } catch (error) {
    logError('/api/reportes/accesos-portal GET', error)
    return errorResponse('/api/reportes/accesos-portal GET', error)
  }
}
