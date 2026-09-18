// =====================================================
// /api/bots/aprendizajes — Gestión de aprendizajes pendientes
// =====================================================
//   GET    → listar aprendizajes (con filtros)
//   POST   → aprobar o rechazar un aprendizaje
//   PATCH  → actualizar respuesta sugerida
//
// Permite al administrador:
//   • Ver preguntas que el bot no supo responder
//   • Aprobar y sugerir respuestas para incorporarlas al dataset
//   • Rechazar aprendizajes no relevantes
//
// Requiere rol: ADMIN o GESTOR
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// GET — Listar aprendizajes
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const botTipo = searchParams.get('botTipo')
    const estado = searchParams.get('estado') // PENDIENTE|APROBADO|RECHAZADO|INTEGRADO
    const categoria = searchParams.get('categoria')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    const where: any = {}
    if (botTipo) where.botTipo = botTipo
    if (estado) where.estado = estado
    if (categoria) where.categoria = categoria

    const [aprendizajes, total, totalPendientes] = await Promise.all([
      db.aprendizajeBot.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.aprendizajeBot.count({ where }),
      db.aprendizajeBot.count({ where: { estado: 'PENDIENTE' } }),
    ])

    // Estadísticas por bot
    const porBot = await db.aprendizajeBot.groupBy({
      by: ['botTipo'],
      _count: { _all: true },
      where: { estado: 'PENDIENTE' },
    })

    return NextResponse.json({
      success: true,
      data: aprendizajes,
      meta: {
        page,
        limit,
        total,
        totalPendientes,
        totalPages: Math.ceil(total / limit),
        pendientesPorBot: porBot.map((p) => ({ botTipo: p.botTipo, count: p._count._all })),
        filtros: { botTipo, estado, categoria },
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// =====================================================
// POST — Aprobar o rechazar un aprendizaje
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { aprendizajeId, accion, respuestaSugerida, observaciones } = body

    if (!aprendizajeId || !accion) {
      return NextResponse.json(
        { success: false, error: 'aprendizajeId y accion son requeridos' },
        { status: 400 }
      )
    }

    if (!['aprobar', 'rechazar', 'integrar'].includes(accion)) {
      return NextResponse.json(
        { success: false, error: 'accion debe ser: aprobar | rechazar | integrar' },
        { status: 400 }
      )
    }

    const nuevoEstado =
      accion === 'aprobar' ? 'APROBADO' :
      accion === 'rechazar' ? 'RECHAZADO' :
      'INTEGRADO'

    const actualizado = await db.aprendizajeBot.update({
      where: { id: aprendizajeId },
      data: {
        estado: nuevoEstado,
        respuestaSugerida: respuestaSugerida || undefined,
        observaciones: observaciones || undefined,
        aprobadoPor: auth.nombre,
        aprobadoAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Aprendizaje ${accion === 'aprobar' ? 'aprobado' : accion === 'rechazar' ? 'rechazado' : 'integrado al dataset'}`,
      data: actualizado,
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
