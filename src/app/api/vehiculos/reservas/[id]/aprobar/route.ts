// =====================================================
// /api/vehiculos/reservas/[id]/aprobar
// Aprueba una reserva pendiente → estado APROBADA
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
    const reserva = await db.reservaVehiculo.findUnique({ where: { id } })
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 })
    }
    if (reserva.estado !== 'PENDIENTE_APROBACION') {
      return NextResponse.json({
        success: false,
        error: `La reserva no está pendiente (estado actual: ${reserva.estado})`,
      }, { status: 400 })
    }

    const actualizada = await db.reservaVehiculo.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        aprobadoPor: user.id,
        aprobadoAt: new Date(),
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'RESERVA',
        entidadId: id,
        accion: 'APROBAR',
        descripcion: `Reserva ${reserva.numeroReserva} aprobada por ${user.nombre}`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizada })
  } catch (error: any) {
    console.error('[vehiculos/reservas/aprobar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
