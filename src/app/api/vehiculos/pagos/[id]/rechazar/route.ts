// =====================================================
// /api/vehiculos/pagos/[id]/rechazar
// Rechaza un pago pendiente con motivo.
// Reversa: si el pago ya estaba aprobado, anula el efecto (reversar).
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
    const { motivo, reversar } = body

    if (!motivo) {
      return NextResponse.json({ success: false, error: 'El motivo es obligatorio' }, { status: 400 })
    }

    const pago = await db.pagoVehiculo.findUnique({
      where: { id },
      include: { obligacion: true },
    })

    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    if (pago.estado === 'RECHAZADO') {
      return NextResponse.json({ success: false, error: 'El pago ya está rechazado' }, { status: 409 })
    }

    const eraAprobado = pago.estado === 'APROBADO'

    const resultado = await db.$transaction(async (tx) => {
      // Marcar como rechazado
      const pagoActualizado = await tx.pagoVehiculo.update({
        where: { id },
        data: {
          estado: 'RECHAZADO',
          motivoRechazo: motivo,
          rechazadoPor: user.id,
          rechazadoAt: new Date(),
        },
      })

      // Si era aprobado, reversar el efecto en la obligación
      let obligacionReversada: any = null
      if (eraAprobado && pago.obligacionId && pago.obligacion) {
        const oblig = pago.obligacion
        const nuevoMontoPagado = Math.max(0, oblig.montoPagado - pago.monto)
        const nuevoMontoPendiente = (oblig.monto + oblig.multa) - nuevoMontoPagado
        const nuevoEstado = nuevoMontoPagado <= 0 ? 'PENDIENTE' : (nuevoMontoPendiente > 0 ? 'PARCIAL' : 'PAGADA')

        obligacionReversada = await tx.obligacionVehiculo.update({
          where: { id: oblig.id },
          data: {
            montoPagado: nuevoMontoPagado,
            montoPendiente: nuevoMontoPendiente,
            estado: nuevoEstado,
            fechaPago: nuevoEstado === 'PAGADA' ? oblig.fechaPago : null,
          },
        })
      }

      return { pagoActualizado, obligacionReversada, reversado: eraAprobado }
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PAGO',
        entidadId: id,
        accion: eraAprobado ? 'REVERSAR' : 'RECHAZAR',
        descripcion: `Pago ${eraAprobado ? 'reversado' : 'rechazado'}. Motivo: ${motivo}`,
        datosAnteriores: JSON.stringify(pago),
        datosNuevos: JSON.stringify(resultado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: resultado,
      message: eraAprobado
        ? 'Pago reversado: el saldo de la obligación fue restaurado'
        : 'Pago rechazado',
    })
  } catch (error: any) {
    console.error('[vehiculos/pagos/rechazar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
