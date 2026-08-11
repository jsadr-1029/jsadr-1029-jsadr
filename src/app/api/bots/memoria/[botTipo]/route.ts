// =====================================================
// /api/bots/memoria/[botTipo] — Gestión de memoria persistente
// =====================================================
//   GET    → listar memorias (con filtros opcionales)
//   DELETE → borrar memorias (todas o por usuarioId)
//
// Permite al administrador:
//   • Ver qué recuerda cada bot
//   • Borrar la memoria de un usuario específico (olvido, GDPR)
//   • Ver estadísticas de memoria por bot
//
// Requiere rol: ADMIN
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import {
  cargarContextoMemoria,
  obtenerEstadisticasMemoria,
  borrarMemoriaUsuario,
  limpiarMemoriasExpiradas,
} from '@/lib/bot-memoria'

interface Params {
  params: Promise<{ botTipo: string }>
}

// =====================================================
// GET — Listar memorias de un bot
// =====================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { botTipo } = await params
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuarioId')
    const conversacionId = searchParams.get('conversacionId')
    const tipoMemoria = searchParams.get('tipoMemoria') // CONTEXTO|HECHO|PREFERENCIA|RESUMEN
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const stats = searchParams.get('stats') === 'true'

    // === Modo estadísticas ===
    if (stats) {
      const estadisticas = await obtenerEstadisticasMemoria(botTipo)
      return NextResponse.json({
        success: true,
        data: estadisticas,
      })
    }

    // === Modo contexto (memoria completa de un usuario) ===
    if (usuarioId) {
      const ctx = await cargarContextoMemoria({
        botTipo,
        usuarioId,
        conversacionId: conversacionId || undefined,
      })
      return NextResponse.json({
        success: true,
        data: ctx,
      })
    }

    // === Listado paginado ===
    const where: any = { botTipo }
    if (tipoMemoria) where.tipoMemoria = tipoMemoria
    if (conversacionId) where.conversacionId = conversacionId

    const [memorias, total] = await Promise.all([
      db.memoriaBot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          botTipo: true,
          usuarioId: true,
          usuarioNombre: true,
          conversacionId: true,
          tipoMemoria: true,
          categoria: true,
          contenido: true,
          peso: true,
          vecesRecordada: true,
          ultimaRecuperada: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.memoriaBot.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: memorias,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        botTipo,
        filtros: { tipoMemoria, conversacionId },
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
// DELETE — Borrar memoria
// =====================================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { botTipo } = await params
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuarioId')
    const conversacionId = searchParams.get('conversacionId')
    const limpiarExpiradas = searchParams.get('limpiarExpiradas') === 'true'

    // === Limpiar memorias expiradas ===
    if (limpiarExpiradas) {
      const count = await limpiarMemoriasExpiradas()
      return NextResponse.json({
        success: true,
        message: `${count} memorias expiradas eliminadas`,
        data: { eliminadas: count },
      })
    }

    // === Borrar por usuarioId ===
    if (usuarioId) {
      const result = await borrarMemoriaUsuario({ botTipo, usuarioId })
      return NextResponse.json({
        success: true,
        message: `Memoria del usuario ${usuarioId} eliminada (${result.memoriasBorradas} registros)`,
        data: result,
      })
    }

    // === Borrar por conversacionId ===
    if (conversacionId) {
      const result = await db.memoriaBot.deleteMany({
        where: { botTipo, conversacionId },
      })
      return NextResponse.json({
        success: true,
        message: `Memoria de la conversación ${conversacionId} eliminada (${result.count} registros)`,
        data: { eliminadas: result.count },
      })
    }

    // === Borrar TODA la memoria del bot (peligroso) ===
    const confirm = searchParams.get('confirm') === 'BORRAR_TODO'
    if (!confirm) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para borrar TODA la memoria del bot, agrega ?confirm=BORRAR_TODO',
          code: 'CONFIRMATION_REQUIRED',
        },
        { status: 400 }
      )
    }
    const result = await db.memoriaBot.deleteMany({ where: { botTipo } })
    return NextResponse.json({
      success: true,
      message: `Toda la memoria del bot ${botTipo} eliminada (${result.count} registros)`,
      data: { eliminadas: result.count },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
