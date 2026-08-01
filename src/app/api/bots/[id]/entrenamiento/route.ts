// =====================================================
// /api/bots/[id]/entrenamiento — Gestión de entrenamiento de un bot
//   GET    → obtiene métricas de entrenamiento actuales (% visible)
//   POST   → ejecuta entrenamiento (aprende de conversaciones reales)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import {
  calcularPorcentajeEntrenamiento,
  aprenderDeConversaciones,
  obtenerItemsEntrenamiento,
} from '@/lib/bot-trainer'
import { getDatasetPorTipo, getNombreEspecialidad } from '@/lib/bot-datasets'

// =====================================================
// GET — Métricas actuales de entrenamiento
// =====================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id: botId } = await params
    const bot = await db.bot.findUnique({ where: { id: botId } })
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot no encontrado' },
        { status: 404 }
      )
    }

    // Calcular métricas actuales
    const metricas = await calcularPorcentajeEntrenamiento(botId)

    // Obtener items de entrenamiento para mostrar el contenido
    const { items } = await obtenerItemsEntrenamiento(botId)
    const datasetBase = getDatasetPorTipo(bot.tipo)

    // Categorías cubiertas
    const categoriasSet = new Set(items.map((i) => i.categoria).filter(Boolean))
    const categorias = Array.from(categoriasSet)

    // Aprendizajes guardados (si existen)
    let aprendizajesRaw: any = null
    if (bot.aprendizajes) {
      try {
        aprendizajesRaw = JSON.parse(bot.aprendizajes)
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        bot: {
          id: bot.id,
          nombre: bot.nombre,
          tipo: bot.tipo,
          especialidad: getNombreEspecialidad(bot.tipo),
          activo: bot.activo,
          auto: bot.auto,
          ultimaActividad: bot.ultimaActividad,
        },
        metricas,
        especialidad: getNombreEspecialidad(bot.tipo),
        datasetBase: {
          totalItems: datasetBase.length,
          items: datasetBase.map((i) => ({
            id: i.id,
            pregunta: i.pregunta,
            categoria: i.categoria,
            sinonimos: i.sinonimos?.length || 0,
          })),
        },
        aprendizajesDinamicos: aprendizajesRaw
          ? {
              total: aprendizajesRaw.preguntasAprendidas?.length || 0,
              ultimaActualizacion: aprendizajesRaw.ultimaActualizacion,
              totalConversacionesAnalizadas: aprendizajesRaw.totalConversacionesAnalizadas,
              muestra: (aprendizajesRaw.preguntasAprendidas || [])
                .slice(0, 10)
                .map((p: any) => ({
                  pregunta: p.pregunta,
                  frecuencia: p.frecuencia,
                  fuente: p.fuente,
                  categoria: p.categoria,
                })),
            }
          : null,
        categoriasCubiertas: categorias,
        itemsCombinados: items.length,
        metaAlcanzada: metricas.porcentajeEntrenamiento >= 95,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Ejecutar entrenamiento (aprender de conversaciones)
// =====================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const { id: botId } = await params
    const bot = await db.bot.findUnique({ where: { id: botId } })
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot no encontrado' },
        { status: 404 }
      )
    }

    // Ejecutar entrenamiento
    const resultado = await aprenderDeConversaciones(botId)

    // Registrar en audit log
    try {
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.username,
        accion: 'ENTRENAR_BOT',
        modulo: 'automatizacion',
        entidadNombre: bot.nombre,
        detalles: `Bot entrenado por ${auth.username}. ${resultado.aprendizajesNuevos} aprendizajes nuevos de ${resultado.totalAnalizados} mensajes analizados. % final: ${resultado.metricasActualizadas.porcentajeEntrenamiento}%`,
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
        botId: bot.id,
        botNombre: bot.nombre,
        aprendizajesNuevos: resultado.aprendizajesNuevos,
        totalAnalizados: resultado.totalAnalizados,
        metricas: resultado.metricasActualizadas,
        metaAlcanzada: resultado.metricasActualizadas.porcentajeEntrenamiento >= 95,
      },
      message: `Bot "${bot.nombre}" entrenado exitosamente. ${resultado.aprendizajesNuevos} nuevos aprendizajes. Entrenamiento: ${resultado.metricasActualizadas.porcentajeEntrenamiento}%`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
