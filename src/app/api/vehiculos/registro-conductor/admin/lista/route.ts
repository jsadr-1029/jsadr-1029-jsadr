// =====================================================
// /api/vehiculos/registro-conductor/admin/lista
// Lista todas las solicitudes de registro (solo ADMIN/GESTOR)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')

    const where: any = {}
    if (estado) where.estado = estado

    const solicitudes = await db.solicitudConductorVehiculo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: solicitudes })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/admin/lista] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
