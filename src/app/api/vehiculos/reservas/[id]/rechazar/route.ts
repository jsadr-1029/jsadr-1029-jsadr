// =====================================================
// /api/vehiculos/reservas/[id]/rechazar
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

    const reserva = await db.reservaVehiculo.findUnique({ where: { id } })
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 })
    }

    const actualizada = await db.reservaVehiculo.update({
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
        entidad: 'RESERVA',
        entidadId: id,
        accion: 'RECHAZAR',
        descripcion: `Reserva ${reserva.numeroReserva} rechazada. Motivo: ${motivoRechazo}`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizada })
  } catch (error: any) {
    console.error('[vehiculos/reservas/rechazar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
