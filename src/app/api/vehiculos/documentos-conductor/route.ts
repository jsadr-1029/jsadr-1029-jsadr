// =====================================================
// /api/vehiculos/documentos-conductor
// GET: lista documentos de conductores (con filtro por conductorId)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const conductorId = searchParams.get('conductorId')

    const where: any = {}
    if (conductorId) where.conductorId = conductorId

    const documentos = await db.documentoConductor.findMany({
      where,
      include: { conductor: { select: { id: true, nombre: true, cedula: true, fotoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: documentos })
  } catch (error: any) {
    console.error('[documentos-conductor] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
