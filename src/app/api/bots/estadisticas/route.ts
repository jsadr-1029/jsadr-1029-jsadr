// =====================================================
// /api/bots/estadisticas — Estadísticas unificadas de bots
// Devuelve: lista de bots con su % de entrenamiento visible,
// especialidad, estado del sentinel DevOps IA, y métricas globales.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { calcularPorcentajeEntrenamiento } from '@/lib/bot-trainer'
import { obtenerEstadoSentinel } from '@/lib/devops-sentinel'
import { getNombreEspecialidad } from '@/lib/bot-datasets'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    // 1. Listar todos los bots con sus métricas
    const bots = await db.bot.findMany({ orderBy: { createdAt: 'asc' } })

    const botsConMetricas: Array<any> = []
    let sumaPorcentajes = 0
    let botsConMeta95 = 0
    let totalAprendizajes = 0
    let totalItemsQA = 0

    for (const bot of bots) {
      const metricas = await calcularPorcentajeEntrenamiento(bot.id)
      sumaPorcentajes += metricas.porcentajeEntrenamiento
      if (metricas.porcentajeEntrenamiento >= 95) botsConMeta95++
      totalAprendizajes += metricas.totalAprendizajes
      totalItemsQA += metricas.totalItemsQA

      botsConMetricas.push({
        id: bot.id,
        nombre: bot.nombre,
        tipo: bot.tipo,
        especialidad: metricas.especialidad,
        descripcion: bot.descripcion,
        activo: bot.activo,
        auto: bot.auto,
        ultimaActividad: bot.ultimaActividad,
        metricas: {
          porcentajeEntrenamiento: metricas.porcentajeEntrenamiento,
          nivel: metricas.nivelConfianza,
          totalItemsQA: metricas.totalItemsQA,
          totalAprendizajes: metricas.totalAprendizajes,
          totalSinonimos: metricas.totalSinonimos,
          categoriasCubiertas: metricas.categoriasCubiertas,
          preguntasValidacionExitosas: metricas.preguntasValidacionExitosas,
          preguntasValidacionTotal: metricas.preguntasValidacionTotal,
          desglose: {
            dataset: metricas.porcentajeDataset,
            aprendizaje: metricas.porcentajeAprendizaje,
            especialidad: metricas.porcentajeEspecialidad,
          },
        },
        metaAlcanzada: metricas.porcentajeEntrenamiento >= 95,
        esDevOpsSentinel: bot.tipo === 'CONFIGURACION', // El DevOps IA es el sentinel
      })
    }

    // 2. Estado del sentinel DevOps IA
    const sentinelEstado = obtenerEstadoSentinel()

    // 3. Estadísticas de conversaciones (para contexto de aprendizaje)
    let statsConversaciones = {
      totalConversaciones: 0,
      totalMensajes: 0,
      mensajesCliente: 0,
      mensajesAsesor: 0,
      mensajesSistema: 0,
    }
    try {
      const [totalConv, totalMsg, msgCliente, msgAsesor, msgSistema] = await Promise.all([
        db.conversacionChat.count(),
        db.mensajeChat.count(),
        db.mensajeChat.count({ where: { remitenteTipo: 'CLIENTE' } }),
        db.mensajeChat.count({ where: { remitenteTipo: 'ASESOR' } }),
        db.mensajeChat.count({ where: { remitenteTipo: 'SISTEMA' } }),
      ])
      statsConversaciones = {
        totalConversaciones: totalConv,
        totalMensajes: totalMsg,
        mensajesCliente: msgCliente,
        mensajesAsesor: msgAsesor,
        mensajesSistema: msgSistema,
      }
    } catch (e) {
      // Si no hay tabla, mantener valores por defecto
    }

    return NextResponse.json({
      success: true,
      data: {
        bots: botsConMetricas,
        estadisticasGlobales: {
          totalBots: bots.length,
          botsActivos: bots.filter((b) => b.activo).length,
          botsConMeta95,
          promedioEntrenamiento: bots.length > 0 ? Math.round(sumaPorcentajes / bots.length) : 0,
          totalAprendizajes,
          totalItemsQA,
          metaGlobalAlcanzada: bots.length > 0 && botsConMeta95 === bots.length,
        },
        sentinelDevOps: sentinelEstado,
        conversacionesParaAprendizaje: statsConversaciones,
        especialidadesDisponibles: 8,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
