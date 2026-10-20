// =====================================================
// /api/vehiculos/reservas/[id] — GET, PUT, DELETE
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const reserva = await db.reservaVehiculo.findUnique({
      where: { id },
      include: {
        conductor: true,
        vehiculo: true,
        contrato: true,
      },
    })
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: reserva })
  } catch (error: any) {
    console.error('[vehiculos/reservas GET id] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const reserva = await db.reservaVehiculo.findUnique({ where: { id } })
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 })
    }
    await db.reservaVehiculo.update({
      where: { id },
      data: { estado: 'CANCELADA' },
    })
    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'RESERVA',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Reserva ${reserva.numeroReserva} cancelada`,
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[vehiculos/reservas DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
