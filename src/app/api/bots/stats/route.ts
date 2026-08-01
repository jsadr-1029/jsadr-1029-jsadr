// =====================================================
// /api/bots/stats — Estadísticas del bot Clientes
// Devuelve KPIs del panel de análisis del módulo Comunicaciones
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    // 1. Total conversaciones
    const totalConversaciones = await db.conversacionChat.count()

    // 2. Conversaciones activas
    const conversacionesActivas = await db.conversacionChat.count({
      where: { estado: 'ACTIVA' },
    })

    // 3. Conversaciones escaladas (marcadas como pendientes sin respuesta del bot)
    // Aproximación: conversaciones donde el último mensaje del cliente no tuvo respuesta del asesor
    const conversacionesPendientes = await db.conversacionChat.count({
      where: { estado: 'ACTIVA', asesorId: null },
    })

    // 4. Total mensajes
    const totalMensajes = await db.mensajeChat.count()

    // 5. Mensajes del cliente vs asesor vs sistema
    const mensajesCliente = await db.mensajeChat.count({ where: { remitenteTipo: 'CLIENTE' } })
    const mensajesAsesor = await db.mensajeChat.count({ where: { remitenteTipo: 'ASESOR' } })
    const mensajesSistema = await db.mensajeChat.count({ where: { remitenteTipo: 'SISTEMA' } })

    // 6. Top FAQs más usadas
    const topFaqs = await db.faqBot.findMany({
      where: { vecesUsada: { gt: 0 } },
      orderBy: { vecesUsada: 'desc' },
      take: 5,
      select: { id: true, pregunta: true, vecesUsada: true, categoria: true },
    })

    // 7. Total FAQs activas
    const totalFaqs = await db.faqBot.count({ where: { activa: true } })

    // 8. Conversaciones por día (últimos 7 días)
    const hace7dias = new Date()
    hace7dias.setDate(hace7dias.getDate() - 7)
    const conversaciones7dias = await db.conversacionChat.findMany({
      where: { createdAt: { gte: hace7dias } },
      select: { createdAt: true, estado: true },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por día
    const porDia: Record<string, { total: number; activas: number; finalizadas: number }> = {}
    conversaciones7dias.forEach((c) => {
      const dia = new Date(c.createdAt).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit' })
      if (!porDia[dia]) porDia[dia] = { total: 0, activas: 0, finalizadas: 0 }
      porDia[dia].total++
      if (c.estado === 'ACTIVA') porDia[dia].activas++
      if (c.estado === 'FINALIZADA') porDia[dia].finalizadas++
    })

    // 9. Conversaciones por hora del día (para detectar horarios pico)
    const todasConversaciones = await db.conversacionChat.findMany({
      select: { createdAt: true },
      take: 1000,
    })
    const porHora: Record<number, number> = {}
    for (let h = 0; h < 24; h++) porHora[h] = 0
    todasConversaciones.forEach((c) => {
      const hora = new Date(c.createdAt).getHours()
      porHora[hora]++
    })

    // Hora pico
    let horaPico = 0
    let maxConversaciones = 0
    Object.entries(porHora).forEach(([h, count]) => {
      if (count > maxConversaciones) {
        maxConversaciones = count
        horaPico = parseInt(h)
      }
    })

    // 10. Configuración actual del bot
    const config = await db.configBot.findMany()
    const configObj: Record<string, string> = {}
    config.forEach((c) => { configObj[c.clave] = c.valor })

    // 11. Tasa de automatización (mensajes del sistema / total mensajes del cliente)
    const tasaAutomatizacion = mensajesCliente > 0
      ? Math.round((mensajesSistema / mensajesCliente) * 100)
      : 0

    // 12. Tiempo promedio de respuesta (aproximación: diferencia entre mensaje cliente y siguiente asesor)
    // Para simplificar, devolvemos null si no hay datos suficientes
    let tiempoPromedioRespuestaMs: number | null = null
    try {
      const conversacionesConAsesor = await db.conversacionChat.findMany({
        where: { asesorId: { not: null } },
        include: {
          mensajes: {
            where: { remitenteTipo: { in: ['CLIENTE', 'ASESOR'] } },
            orderBy: { fechaEnvio: 'asc' },
            select: { remitenteTipo: true, fechaEnvio: true },
          },
        },
        take: 50,
      })

      const tiempos: number[] = []
      conversacionesConAsesor.forEach((conv) => {
        for (let i = 0; i < conv.mensajes.length - 1; i++) {
          const actual = conv.mensajes[i]
          const siguiente = conv.mensajes[i + 1]
          if (actual.remitenteTipo === 'CLIENTE' && siguiente.remitenteTipo === 'ASESOR') {
            const diff = new Date(siguiente.fechaEnvio).getTime() - new Date(actual.fechaEnvio).getTime()
            if (diff > 0 && diff < 24 * 60 * 60 * 1000) { // menos de 24h
              tiempos.push(diff)
            }
          }
        }
      })

      if (tiempos.length > 0) {
        tiempoPromedioRespuestaMs = Math.round(tiempos.reduce((s, t) => s + t, 0) / tiempos.length)
      }
    } catch (e) {
      // Si falla, mantener null
    }

    return NextResponse.json({
      success: true,
      data: {
        conversaciones: {
          total: totalConversaciones,
          activas: conversacionesActivas,
          pendientes: conversacionesPendientes,
          porDia: Object.entries(porDia).map(([dia, d]) => ({ dia, ...d })),
          horaPico,
          conversacionesEnHoraPico: maxConversaciones,
        },
        mensajes: {
          total: totalMensajes,
          cliente: mensajesCliente,
          asesor: mensajesAsesor,
          sistema: mensajesSistema,
          tasaAutomatizacion,
        },
        faqs: {
          total: totalFaqs,
          topUsadas: topFaqs,
        },
        tiempoPromedioRespuestaMs,
        config: configObj,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
