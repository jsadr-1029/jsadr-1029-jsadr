// =====================================================
// /api/vehiculos/reservas/[id]/finalizar
// El conductor reporta los peajes reales al finalizar el viaje
// Recalcula los montos con los peajes reales.
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
    const {
      peajesReportados,
      valorPeajesReportado,
      observacionesConductor,
      fotosPeajesUrl,
    } = body

    const reserva = await db.reservaVehiculo.findUnique({ where: { id } })
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 })
    }

    const cPeajes = peajesReportados !== undefined ? parseInt(peajesReportados) : reserva.cantidadPeajes
    const vPeajes = valorPeajesReportado !== undefined ? parseFloat(valorPeajesReportado) : reserva.valorTotalPeajes

    // Recalcular distribución con los peajes reportados
    const base = reserva.peajesDescontadosDelTotal
      ? Math.max(0, reserva.valorTotal - vPeajes)
      : reserva.valorTotal

    const montoConductor = Math.round((base * reserva.porcentajeConductor) / 100)
    const montoAdministrador = Math.round((base * reserva.porcentajeAdministrador) / 100)
    const montoMantenimiento = Math.round((base * reserva.porcentajeMantenimiento) / 100)

    const actualizada = await db.reservaVehiculo.update({
      where: { id },
      data: {
        estado: 'COMPLETADA',
        peajesReportados: cPeajes,
        valorPeajesReportado: vPeajes,
        cantidadPeajes: cPeajes,
        valorTotalPeajes: vPeajes,
        montoPeajes: vPeajes,
        montoConductor,
        montoAdministrador,
        montoMantenimiento,
        observacionesConductor,
        fotosPeajesUrl,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'RESERVA',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Reserva ${reserva.numeroReserva} finalizada. Peajes reales: ${cPeajes} ($${vPeajes.toLocaleString('es-CO')}). Distribución recalculada: Conductor $${montoConductor.toLocaleString('es-CO')}, Admin $${montoAdministrador.toLocaleString('es-CO')}, Mant $${montoMantenimiento.toLocaleString('es-CO')}`,
        datosAnteriores: JSON.stringify(reserva),
        datosNuevos: JSON.stringify(actualizada),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: actualizada,
      message: 'Reserva finalizada. Montos recalculados con los peajes reales.',
    })
  } catch (error: any) {
    console.error('[vehiculos/reservas/finalizar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
