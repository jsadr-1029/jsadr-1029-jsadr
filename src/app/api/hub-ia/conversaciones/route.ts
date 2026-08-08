import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'

// GET — lista conversaciones del usuario
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuarioId') || user.id

    const conversaciones = await db.hubIAConversation.findMany({
      where: { usuarioId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        titulo: true,
        provider: true,
        modelo: true,
        modo: true,
        mensajeCount: true,
        totalTokens: true,
        totalCosto: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: { conversaciones } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
