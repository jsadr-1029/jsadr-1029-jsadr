// =====================================================
// /api/vehiculos/auditoria — Histórico de auditoría
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const entidad = searchParams.get('entidad')
    const entidadId = searchParams.get('entidadId')
    const accion = searchParams.get('accion')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}
    if (entidad) where.entidad = entidad
    if (entidadId) where.entidadId = entidadId
    if (accion) where.accion = accion

    const auditoria = await db.auditoriaVehiculo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: auditoria })
  } catch (error: any) {
    console.error('[vehiculos/auditoria GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
