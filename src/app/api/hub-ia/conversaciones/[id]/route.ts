import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'

// GET — devuelve conversación + mensajes
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const conversation = await db.hubIAConversation.findUnique({
      where: { id },
      include: {
        mensajes: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    })
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: { conversation } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// DELETE — elimina conversación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    await db.hubIAConversation.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { eliminado: true } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
