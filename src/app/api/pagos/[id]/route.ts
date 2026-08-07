import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// =====================================================
// /api/pagos/[id] v4.0 — OLA 1
// -----------------------------------------------------
// GET    - obtener pago específico
// DELETE - SOFT-DELETE (anular) en vez de hard-delete.
//          Marca estado='ANULADO', conserva el registro,
//          registra motivo y usuario.
// =====================================================

// DELETE - anular pago (soft-delete v4.0)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: solo ADMIN puede anular (GESTOR usa reversar)
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const motivo = body?.motivoAnulacion || body?.motivo || 'Anulación administrativa'
    const clientInfo = getClientInfo(req)

    const pago = await db.pago.findUnique({
      where: { id },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    if (pago.estado === 'ANULADO') {
      return NextResponse.json({ success: false, error: 'Este pago ya está anulado' }, { status: 400 })
    }

    // === v4.7 (QA M04 TC-PAG-009): no se puede anular un pago REVERSADO ===
    // Un pago REVERSADO ya fue devuelto al cliente (restitución de saldo).
    // Anularlo sería inconsistente: el pago ya no está activo.
    // Si se necesita "re-aplicar" un pago reversado, debe usarse otro flujo.
    if (pago.estado === 'REVERSADO') {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede anular un pago que está REVERSADO. El pago ya fue devuelto al cliente.',
          codigo: 'PAGO_REVERSADO_NO_ANULABLE',
          estadoActual: pago.estado,
        },
        { status: 409 }
      )
    }

    const pagoInfo = {
      id: pago.id, codigo: pago.codigo,
      prestamoId: pago.prestamoId, prestamoCodigo: pago.prestamo.codigo,
      cliente: pago.prestamo.cliente.nombre, cedula: pago.prestamo.cliente.cedula,
      numeroCuota: pago.numeroCuota,
      montoCapital: pago.montoCapital, montoInteres: pago.montoInteres,
      montoMora: pago.montoMora, montoTotal: pago.montoTotal,
      fechaPago: pago.fechaPago, metodoPago: pago.metodoPago,
      estadoAnterior: pago.estado,
      esSoloIntereses: pago.esSoloIntereses,
    }

    // === Soft-delete: marcar ANULADO en vez de borrar ===
    await db.pago.update({
      where: { id },
      data: {
        estado: 'ANULADO',
        motivoAnulacion: motivo,
        anuladoPorId: user.id,
        fechaAnulacion: new Date(),
      },
    })

    const { estadisticas } = await recalcularSaldosPrestamo(pago.prestamoId)

    await registrarAuditLog({
      usuarioId: user.id, usuarioNombre: user.nombre,
      accion: 'PAGO_ANULADO', modulo: 'pagos',
      entidadId: id, entidadNombre: `Pago ${pago.codigo || pago.id} - Cuota ${pago.numeroCuota}`,
      detalles: JSON.stringify({ ...pagoInfo, motivoAnulacion: motivo, saldosRecalculados: estadisticas }),
      ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      mensaje: `Pago anulado (soft-delete). Préstamo ${pago.prestamo.codigo} recalculado: saldo ${estadisticas.saldoTotal} COP, ${estadisticas.cuotasPagadas} cuota(s) pagada(s).`,
      saldosRecalculados: estadisticas,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// GET - obtener un pago específico
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const pago = await db.pago.findUnique({
      where: { id },
      include: {
        prestamo: { include: { cliente: true } },
        cuentaRecaudo: true,
        anuladoPor: { select: { id: true, nombre: true } },
        reversadoPor: { select: { id: true, nombre: true } },
      },
    })
    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: pago })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
