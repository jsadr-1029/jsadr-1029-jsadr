import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// POST - reversar un pago aplicado
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const auth = requireRole(req, ['ADMIN']) // v4.6 (QA M03 TC-PRE-015): solo ADMIN puede reversar pagos
    if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const body = await req.json()
    const { motivoReversion, usuarioId, usuarioNombre } = body

    if (!motivoReversion) {
      return NextResponse.json(
        { success: false, error: 'El motivo de reversión es obligatorio' },
        { status: 400 }
      )
    }

    // Buscar el pago
    const pago = await db.pago.findUnique({
      where: { id },
      include: { prestamo: { include: { cliente: true } } },
    })

    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    if (pago.estado !== 'APLICADO' && pago.estado !== 'PAGO_PARCIAL') {
      // === v4.7 (QA M04 TC-PAG-007): mensaje específico para pago ya REVERSADO ===
      // Si el pago ya está REVERSADO, retornar 409 con codigo PAGO_YA_REVERSADO.
      // Para otros estados (ANULADO, PENDIENTE, etc.) mantener el 400 original.
      if (pago.estado === 'REVERSADO') {
        return NextResponse.json(
          {
            success: false,
            error: 'El pago ya está reversado. No se puede reversar dos veces.',
            codigo: 'PAGO_YA_REVERSADO',
            estadoActual: pago.estado,
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: `Solo se pueden reversar pagos APLICADOS o PAGO_PARCIAL. Estado actual: ${pago.estado}` },
        { status: 400 }
      )
    }

    const prestamoId = pago.prestamoId
    const prestamo = pago.prestamo

    // 1. Marcar pago como REVERSADO
    const pagoReversado = await db.pago.update({
      where: { id },
      data: {
        estado: 'REVERSADO',
        fechaReversion: new Date(),
        motivoReversion,
        reversadoPorId: usuarioId || null,
      },
    })

    // 2. Recalcular automáticamente todos los saldos del solicitud
    // Esto garantiza consistencia total sin cálculos manuales propensos a errores
    const { prestamo: prestamoActualizado, estadisticas } = await recalcularSaldosPrestamo(prestamoId)

    // 3. Si el pago tenía mora cobrada, reversar el ingreso en Caja de Mora
    if (pago.montoMora > 0) {
      const cajaMora = await db.cajaMenor.findUnique({ where: { codigo: 'CAJA-MORA' } })
      if (cajaMora) {
        await db.movimientoCaja.create({
          data: {
            cajaId: cajaMora.id,
            tipo: 'EGRESO',
            monto: pago.montoMora,
            concepto: `REVERSIÓN de mora - Solicitud ${prestamo.codigo} - Cuota ${pago.numeroCuota} - ${motivoReversion}`,
            referencia: prestamo.codigo,
            prestamoId: prestamo.id,
            creadoPor: usuarioNombre || 'Sistema',
            usuarioId: usuarioId || null,
          },
        })
        await db.cajaMenor.update({
          where: { id: cajaMora.id },
          data: {
            saldoActual: { decrement: pago.montoMora },
            totalEgresos: { increment: pago.montoMora },
          },
        })
      }
    }

    // 4. Crear entrada en la bitácora del solicitud
    await db.bitacoraPrestamo.create({
      data: {
        prestamoId: prestamo.id,
        prestamoCodigo: prestamo.codigo,
        usuarioId: usuarioId || null,
        usuarioNombre: usuarioNombre || 'Sistema',
        tipo: 'PAGO',
        titulo: `Pago reversado - Cuota ${pago.numeroCuota}`,
        descripcion: `Se reversó el pago de ${pago.montoTotal} COP (cuota ${pago.numeroCuota}) aplicado el ${pago.fechaPago?.toLocaleDateString('es-CO')}. Motivo: ${motivoReversion}`,
        resultado: `Saldos recalculados automáticamente. Nuevo saldo: ${estadisticas.saldoTotal} COP`,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        pago: pagoReversado,
        prestamo: prestamoActualizado,
      },
      saldosRecalculados: estadisticas,
      mensaje: `Pago reversado correctamente. El solicitud ${prestamo.codigo} recalculado: saldo ${estadisticas.saldoTotal} COP, ${estadisticas.cuotasPagadas} cuota(s) pagada(s).`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
