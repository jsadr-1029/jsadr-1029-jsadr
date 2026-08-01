// =====================================================
// /api/chat/mensajes/[id] — Actualiza estado de mensaje
// PATCH /api/chat/mensajes/:id   → marcar leído / entregado
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// === PATCH — actualizar estado de un mensaje ===
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json()
    const { estado } = body

    if (!estado || !['ENVIADO', 'ENTREGADO', 'LEIDO'].includes(estado)) {
      return NextResponse.json(
        { success: false, error: 'estado debe ser ENVIADO, ENTREGADO o LEIDO' },
        { status: 400 }
      )
    }

    const existente = await db.mensajeChat.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Mensaje no encontrado' },
        { status: 404 }
      )
    }

    const datos: Record<string, unknown> = { estado }
    if (estado === 'ENTREGADO' && !existente.fechaEntregado) {
      datos.fechaEntregado = new Date()
    }
    if (estado === 'LEIDO') {
      if (!existente.fechaEntregado) datos.fechaEntregado = new Date()
      datos.fechaLeido = new Date()
    }

    const mensaje = await db.mensajeChat.update({
      where: { id },
      data: datos,
    })

    return NextResponse.json({ success: true, data: mensaje })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
