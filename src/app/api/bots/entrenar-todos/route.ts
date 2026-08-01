// =====================================================
// /api/bots/entrenar-todos — Entrena todos los bots a la vez
//   POST → ejecuta entrenamiento masivo de todos los bots activos
//   GET  → obtiene estadísticas globales de entrenamiento
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import {
  entrenarTodosLosBots,
  obtenerEstadisticasGlobales,
} from '@/lib/bot-trainer'

// =====================================================
// GET — Estadísticas globales
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const stats = await obtenerEstadisticasGlobales()

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Entrenar todos los bots
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)

    // Ejecutar entrenamiento masivo
    const resultados = await entrenarTodosLosBots()

    // Estadísticas finales
    const stats = await obtenerEstadisticasGlobales()

    // Calcular totales
    const totalAprendizajes = resultados.reduce((s, r) => s + r.aprendizajesNuevos, 0)
    const botsConMeta = resultados.filter(
      (r) => r.metricas.porcentajeEntrenamiento >= 95
    ).length

    // Registrar en audit log
    try {
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.username,
        accion: 'ENTRENAR_TODOS_BOTS',
        modulo: 'automatizacion',
        entidadNombre: 'Sistema completo',
        detalles: `Entrenamiento masivo por ${auth.username}. ${resultados.length} bots entrenados. ${totalAprendizajes} aprendizajes nuevos. ${botsConMeta}/${resultados.length} bots alcanzaron meta 95%.`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch (e) {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: {
        resultados,
        estadisticasGlobales: stats,
        resumen: {
          totalBots: resultados.length,
          botsConMeta95: botsConMeta,
          totalAprendizajesNuevos: totalAprendizajes,
          promedioEntrenamiento: stats.promedioEntrenamiento,
          todosAlcanzaronMeta: botsConMeta === resultados.length,
        },
      },
      message: `Entrenamiento masivo completado. ${resultados.length} bots entrenados, ${totalAprendizajes} aprendizajes nuevos. ${botsConMeta}/${resultados.length} bots alcanzaron la meta del 95%.`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
