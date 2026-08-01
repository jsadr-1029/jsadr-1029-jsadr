// =====================================================
// /api/bots/[id]/probar — Probar una pregunta contra el bot entrenado
//   POST → envía una pregunta y devuelve la respuesta del bot con score
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { responderConBotEntrenado } from '@/lib/bot-trainer'

export async function POST(
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

    const body = await req.json()
    const { pregunta } = body

    if (!pregunta || typeof pregunta !== 'string') {
      return NextResponse.json(
        { success: false, error: 'pregunta es requerida (string)' },
        { status: 400 }
      )
    }

    // Responder usando el bot entrenado
    const resultado = await responderConBotEntrenado(botId, pregunta)

    return NextResponse.json({
      success: true,
      data: {
        bot: {
          id: bot.id,
          nombre: bot.nombre,
          tipo: bot.tipo,
        },
        pregunta,
        respuesta: resultado.respuesta,
        score: resultado.score,
        confianza: resultado.confianza,
        metodo: resultado.metodo,
        categoriaDetectada: resultado.categoriaDetectada,
        escalar: resultado.escalar,
        topCandidatos: resultado.topCandidatos,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
