// =====================================================
// /api/vehiculos/registro-conductor/admin/[id]/rechazar
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const { motivoRechazo } = body

    if (!motivoRechazo) {
      return NextResponse.json({ success: false, error: 'Motivo de rechazo obligatorio' }, { status: 400 })
    }

    const solicitud = await db.solicitudConductorVehiculo.findUnique({ where: { id } })
    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
    }

    await db.solicitudConductorVehiculo.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        motivoRechazo,
        aprobadoPor: user.id,
        aprobadoAt: new Date(),
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'SOLICITUD_CONDUCTOR',
        entidadId: id,
        accion: 'RECHAZAR',
        descripcion: `Solicitud rechazada por ${user.nombre}. Motivo: ${motivoRechazo}`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, message: 'Solicitud rechazada' })
  } catch (error: any) {
    console.error('[vehiculos/registro-conductor/admin/rechazar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
