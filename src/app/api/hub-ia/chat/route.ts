import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { orchestrate, confirmarYEjecutarHerramienta, type ChatRequest } from '@/lib/hub-ia/orchestrator'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const chatReq: ChatRequest = {
      mensaje: body.mensaje,
      conversationId: body.conversationId,
      provider: body.provider,
      modelo: body.modelo,
      toolCallIdAprobar: body.toolCallIdAprobar,
      confirmado: body.confirmado,
    }

    // Si es confirmación de herramienta pendiente
    if (body.accion === 'confirmar' && body.toolCallId && body.conversationId) {
      const r = await confirmarYEjecutarHerramienta(body.conversationId, body.toolCallId, user, req)
      return NextResponse.json({ success: r.ok, data: r, error: r.error })
    }

    if (!chatReq.mensaje || typeof chatReq.mensaje !== 'string') {
      return NextResponse.json(
        { success: false, error: 'mensaje es requerido' },
        { status: 400 }
      )
    }

    const result = await orchestrate(chatReq, user, req)
    return NextResponse.json({ success: result.ok, data: result, error: result.error })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
