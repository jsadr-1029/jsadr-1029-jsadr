// =====================================================
// /api/bots/faqs/[id] — Actualizar/eliminar FAQ
// PATCH  → actualiza una FAQ (rol ADMIN)
// DELETE → elimina una FAQ (rol ADMIN)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await req.json()
    const { pregunta, respuesta, categoria, palabrasClave, activa } = body

    const datos: Record<string, unknown> = {}
    if (pregunta !== undefined) datos.pregunta = String(pregunta).slice(0, 500)
    if (respuesta !== undefined) datos.respuesta = String(respuesta).slice(0, 5000)
    if (categoria !== undefined) datos.categoria = categoria || null
    if (palabrasClave !== undefined) datos.palabrasClave = palabrasClave || null
    if (activa !== undefined) datos.activa = !!activa

    const faq = await db.faqBot.update({ where: { id }, data: datos })

    return NextResponse.json({ success: true, data: faq })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    await db.faqBot.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
