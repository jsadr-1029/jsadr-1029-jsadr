import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
} from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'

// =====================================================
// POST /api/pagos/renegociar-mora
// =====================================================
// Permite al gestor ANULAR o NEGOCIAR la mora acumulada de un préstamo.
// - ANULAR: fija la mora renegociada en 0 (elimina toda la mora pendiente)
// - NEGOCIAR: fija la mora renegociada en un valor acordado con el cliente
//
// Registra:
//  1. Audit log inmutable con el acuerdo
//  2. Bitácora del préstamo con la observación del gestor
//  3. Snapshot de la mora original calculada al momento de renegociar
//
// El valor queda almacenado en Prestamo.moraRenegociada y reemplaza
// la mora calculada automáticamente en el módulo de pagos.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`pagos-renegociar-mora:${clientInfo.ip}`, 10)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const {
      prestamoId,
      accion, // 'ANULAR' | 'NEGOCIAR'
      nuevaMora, // number (0 si ANULAR, valor acordado si NEGOCIAR)
      observacion, // explicación del acuerdo
    } = body || {}

    // === Validaciones ===
    if (!prestamoId || typeof prestamoId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'prestamoId es requerido' },
        { status: 400 }
      )
    }
    if (!['ANULAR', 'NEGOCIAR'].includes(accion)) {
      return NextResponse.json(
        { success: false, error: 'accion debe ser ANULAR o NEGOCIAR' },
        { status: 400 }
      )
    }
    if (accion === 'NEGOCIAR') {
      if (typeof nuevaMora !== 'number' || isNaN(nuevaMora) || nuevaMora < 0) {
        return NextResponse.json(
          { success: false, error: 'nuevaMora debe ser un número >= 0 cuando la acción es NEGOCIAR' },
          { status: 400 }
        )
      }
    }
    if (!observacion || typeof observacion !== 'string' || observacion.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'La observación debe tener al menos 10 caracteres explicando el acuerdo' },
        { status: 400 }
      )
    }

    // === Buscar el préstamo ===
    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        cliente: true,
        pagos: {
          where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } },
          orderBy: { numeroCuota: 'asc' },
        },
      },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }
    if (!['ACTIVO', 'EN_MORA'].includes(prestamo.estado)) {
      return NextResponse.json(
        { success: false, error: `No se puede renegociar la mora de un préstamo en estado ${prestamo.estado}` },
        { status: 400 }
      )
    }

    // === Calcular mora actual (snapshot antes de renegociar) ===
    const cuotasPagadasSet = new Set(
      prestamo.pagos.filter((pg) => pg.estado === 'APLICADO').map((pg) => pg.numeroCuota)
    )
    const cuotasPagadasCompletamente = cuotasPagadasSet.size
    const proximaCuota = cuotasPagadasCompletamente + 1

    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraAnual(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || prestamo.fechaSolicitud,
    })
    const cuotaPendiente = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuota)
    const fechaVencimiento = cuotaPendiente?.fechaVencimiento

    let diasMora = 0
    let moraCalculadaActual = 0
    if (fechaVencimiento) {
      diasMora = calcularDiasMora(fechaVencimiento)
      moraCalculadaActual = diasMora > 0
        ? calcularMoraCompuesta(prestamo.montoPrincipal, getTasaMoraAnual(prestamo), diasMora)
        : 0
    }

    // Mora ya pagada en la cuota (parcial)
    const pagosCuota = prestamo.pagos.filter((pg) => pg.numeroCuota === proximaCuota)
    const moraPagadaCuota = pagosCuota.reduce((s, pg) => s + pg.montoMora, 0)
    const moraPendienteActual = Math.max(0, moraCalculadaActual - moraPagadaCuota)

    // === Determinar el valor final de la mora renegociada ===
    const valorFinalMora = accion === 'ANULAR' ? 0 : Number(nuevaMora)

    // === Transacción: actualizar préstamo + crear bitácora + crear audit log ===
    const fechaAhora = new Date()
    const descripcionBitacora =
      accion === 'ANULAR'
        ? `MORA ANULADA por acuerdo con el cliente.\n` +
          `• Mora calculada al momento del acuerdo: ${formatCOP(moraCalculadaActual)}\n` +
          `• Mora pendiente (descontando pagos parciales): ${formatCOP(moraPendienteActual)}\n` +
          `• Días de mora: ${diasMora}\n` +
          `• Nueva mora acordada: $0 (eliminada)\n` +
          `• Observación del gestor: ${observacion.trim()}`
        : `MORA NEGOCIADA por acuerdo con el cliente.\n` +
          `• Mora calculada al momento del acuerdo: ${formatCOP(moraCalculadaActual)}\n` +
          `• Mora pendiente (descontando pagos parciales): ${formatCOP(moraPendienteActual)}\n` +
          `• Días de mora: ${diasMora}\n` +
          `• Nueva mora acordada: ${formatCOP(valorFinalMora)}\n` +
          `• Ahorro para el cliente: ${formatCOP(Math.max(0, moraPendienteActual - valorFinalMora))}\n` +
          `• Observación del gestor: ${observacion.trim()}`

    const [prestamoActualizado] = await db.$transaction([
      // 1. Actualizar préstamo con la mora renegociada
      db.prestamo.update({
        where: { id: prestamoId },
        data: {
          moraRenegociada: valorFinalMora,
          moraRenegociadaAccion: accion,
          moraRenegociadaFecha: fechaAhora,
          moraRenegociadaPorId: user.id === 'system' ? null : user.id,
          moraRenegociadaPorNombre: user.nombre,
          moraRenegociadaObservacion: observacion.trim(),
          moraRenegociadaMoraOriginal: moraCalculadaActual,
          // Si se anula la mora y el préstamo estaba en EN_MORA, volver a ACTIVO
          estado: accion === 'ANULAR' && prestamo.estado === 'EN_MORA' ? 'ACTIVO' : prestamo.estado,
        },
      }),
      // 2. Crear entrada en bitácora del préstamo
      db.bitacoraPrestamo.create({
        data: {
          prestamoId,
          prestamoCodigo: prestamo.codigo,
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          tipo: 'OTRO',
          titulo:
            accion === 'ANULAR'
              ? 'Mora anulada por acuerdo con el cliente'
              : 'Mora renegociada por acuerdo con el cliente',
          descripcion: descripcionBitacora,
          resultado: `Nueva mora: ${formatCOP(valorFinalMora)}`,
          fechaEvento: fechaAhora,
        },
      }),
      // 3. Crear audit log inmutable
      db.auditLog.create({
        data: {
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          accion: 'MORA_RENEGOCIADA',
          modulo: 'pagos',
          entidadId: prestamoId,
          entidadNombre: `${prestamo.codigo} - ${prestamo.cliente.nombre}`,
          detalles: JSON.stringify({
            accion,
            moraCalculadaOriginal: moraCalculadaActual,
            moraPendienteOriginal: moraPendienteActual,
            moraPagadaCuota,
            nuevaMora: valorFinalMora,
            diasMora,
            clienteId: prestamo.clienteId,
            clienteCedula: prestamo.cliente.cedula,
            clienteNombre: prestamo.cliente.nombre,
            observacion: observacion.trim(),
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        prestamoId,
        codigo: prestamo.codigo,
        accion,
        moraCalculadaOriginal: moraCalculadaActual,
        moraPendienteOriginal: moraPendienteActual,
        nuevaMora: valorFinalMora,
        diasMora,
        observacion: observacion.trim(),
        fecha: fechaAhora.toISOString(),
        renegociadaPor: user.nombre,
        estadoPrestamo: prestamoActualizado.estado,
      },
      mensaje:
        accion === 'ANULAR'
          ? `Mora anulada para el préstamo ${prestamo.codigo}. El cliente ya no debe mora pendiente.`
          : `Mora renegociada a ${formatCOP(valorFinalMora)} para el préstamo ${prestamo.codigo}.`,
    })
  } catch (error: any) {
    console.error('[renegociar-mora] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE /api/pagos/renegociar-mora?prestamoId=xxx
// Revierte la renegociación: vuelve a calcular la mora automáticamente
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)

    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    if (!prestamoId) {
      return NextResponse.json(
        { success: false, error: 'prestamoId es requerido' },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }
    if (prestamo.moraRenegociada === null) {
      return NextResponse.json(
        { success: false, error: 'Este préstamo no tiene una renegociación activa' },
        { status: 400 }
      )
    }

    await db.$transaction([
      db.prestamo.update({
        where: { id: prestamoId },
        data: {
          moraRenegociada: null,
          moraRenegociadaAccion: null,
          moraRenegociadaFecha: null,
          moraRenegociadaPorId: null,
          moraRenegociadaPorNombre: null,
          moraRenegociadaObservacion: null,
          moraRenegociadaMoraOriginal: null,
        },
      }),
      db.bitacoraPrestamo.create({
        data: {
          prestamoId,
          prestamoCodigo: prestamo.codigo,
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          tipo: 'OTRO',
          titulo: 'Reversión de renegociación de mora',
          descripcion:
            `Se revirtió la renegociación de mora del préstamo.\n` +
            `• Mora renegociada previa: ${formatCOP(prestamo.moraRenegociada || 0)}\n` +
            `• Acción previa: ${prestamo.moraRenegociadaAccion}\n` +
            `• Observación previa: ${prestamo.moraRenegociadaObservacion || '(sin observación)'}\n` +
            `• La mora vuelve a calcularse automáticamente según los días de atraso.`,
          resultado: 'Mora volvió a cálculo automático',
          fechaEvento: new Date(),
        },
      }),
      db.auditLog.create({
        data: {
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          accion: 'MORA_RENEGOCIACION_REVERSADA',
          modulo: 'pagos',
          entidadId: prestamoId,
          entidadNombre: `${prestamo.codigo} - ${prestamo.cliente.nombre}`,
          detalles: JSON.stringify({
            moraRenegociadaPrevia: prestamo.moraRenegociada,
            accionPrevia: prestamo.moraRenegociadaAccion,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      mensaje: `Renegociación de mora revertida para el préstamo ${prestamo.codigo}. La mora vuelve a calcularse automáticamente.`,
    })
  } catch (error: any) {
    console.error('[renegociar-mora DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// === Utilitario local de formato COP ===
function formatCOP(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor || 0)
}
