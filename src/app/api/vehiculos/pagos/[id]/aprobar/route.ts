// =====================================================
// /api/vehiculos/pagos/[id]/aprobar
// Aprueba un pago pendiente:
//  - Verifica que no haya sido ya aprobado (idempotente)
//  - Solo admin/gestor (NO el conductor)
//  - Aplica el pago a la obligación: actualiza saldo, estado
//  - Registra auditoría
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
    const body = await req.json().catch(() => ({}))
    const { montoAprobado, notasAdmin } = body

    const pago = await db.pagoVehiculo.findUnique({
      where: { id },
      include: { obligacion: true },
    })

    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    if (pago.estado === 'APROBADO') {
      return NextResponse.json({
        success: false,
        error: 'El pago ya está aprobado (operación idempotente)',
        code: 'ALREADY_APPROVED',
      }, { status: 409 })
    }

    if (pago.estado === 'RECHAZADO') {
      return NextResponse.json({
        success: false,
        error: 'El pago fue rechazado, no se puede aprobar',
        code: 'REJECTED',
      }, { status: 400 })
    }

    // Verificar que el usuario NO sea el conductor (no aprueba su propio pago)
    if (user.id === pago.conductorId) {
      return NextResponse.json({
        success: false,
        error: 'No puedes aprobar tu propio pago',
        code: 'CANNOT_APPROVE_OWN_PAYMENT',
      }, { status: 403 })
    }

    const montoFinal = montoAprobado !== undefined ? parseFloat(montoAprobado) : pago.monto

    // Transacción: actualizar pago + obligación + auditoría
    const resultado = await db.$transaction(async (tx) => {
      // Marcar pago como aprobado
      const pagoActualizado = await tx.pagoVehiculo.update({
        where: { id },
        data: {
          estado: 'APROBADO',
          monto: montoFinal,
          aprobadoPor: user.id,
          aprobadoAt: new Date(),
        },
      })

      // Si hay obligación, actualizar saldo
      let obligacionActualizada: any = null
      if (pago.obligacionId && pago.obligacion) {
        const oblig = pago.obligacion
        const nuevoMontoPagado = oblig.montoPagado + montoFinal
        const nuevoMontoPendiente = Math.max(0, (oblig.monto + oblig.multa) - nuevoMontoPagado)
        const nuevoEstado = nuevoMontoPendiente <= 0 ? 'PAGADA' : (nuevoMontoPagado > 0 ? 'PARCIAL' : oblig.estado)

        obligacionActualizada = await tx.obligacionVehiculo.update({
          where: { id: oblig.id },
          data: {
            montoPagado: nuevoMontoPagado,
            montoPendiente: nuevoMontoPendiente,
            estado: nuevoEstado,
            fechaPago: nuevoEstado === 'PAGADA' ? new Date() : oblig.fechaPago,
          },
        })
      }

      return { pagoActualizado, obligacionActualizada }
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PAGO',
        entidadId: id,
        accion: 'APROBAR',
        descripcion: `Pago de $${montoFinal.toLocaleString('es-CO')} aprobado${pago.obligacionId ? ' y aplicado a obligación' : ''}. ${notasAdmin ? 'Notas: ' + notasAdmin : ''}`,
        datosAnteriores: JSON.stringify(pago),
        datosNuevos: JSON.stringify(resultado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: resultado,
      message: 'Pago aprobado y aplicado al saldo correctamente',
    })
  } catch (error: any) {
    console.error('[vehiculos/pagos/aprobar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
