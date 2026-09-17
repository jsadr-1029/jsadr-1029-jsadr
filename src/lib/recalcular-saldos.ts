import { db } from './db'
import { calcularPrestamo, calcularMoraCompuesta, calcularDiasMora, getTasaMoraDiaria } from './finanzas'

/**
 * Recalcula automáticamente todos los saldos del préstamo en base a los pagos
 * realmente APLICADOS y PAGO_PARCIAL (excluyendo PENDIENTE, REVERSADO, ANULADO).
 *
 * Esta función debe llamarse SIEMPRE después de:
 * - Aplicar un pago (POST /api/pagos)
 * - Reversar un pago (POST /api/pagos/[id]/reversar)
 * - Eliminar un pago (DELETE /api/pagos/[id])
 *
 * Cálculo:
 * - montoPagado = sum(montoTotal) de pagos APLICADO + PAGO_PARCIAL
 * - montoCapitalPagado = sum(montoCapital) de esos pagos
 * - montoInteresPagado = sum(montoInteres) de esos pagos
 * - montoMoraPagado = sum(montoMora) de esos pagos
 * - saldoCapital = montoPrincipal - montoCapitalPagado (mínimo 0)
 * - saldoInteres = totalInteres - montoInteresPagado (mínimo 0)
 * - saldoTotal = max(0, totalPagar - montoPagado)
 * - cuotasPagadas = número de cuotas completamente pagadas (estado APLICADO)
 * - moraPendiente = cálculo EN VIVO de mora sobre cuotas vencidas NO pagadas (no snapshot stale)
 * - estado: CANCELADO si cuotasPagadas >= numeroCuotas o saldoTotal <= 0
 *           ACTIVO si era EN_MORA y TODAS las cuotas vencidas están APLICADO (pago completo, no parcial)
 *
 * @param prestamoId - ID del préstamo a recalcular
 */
export async function recalcularSaldosPrestamo(prestamoId: string) {
  // Buscar el préstamo con sus pagos
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      pagos: true,
    },
  })

  if (!prestamo) {
    throw new Error(`Préstamo no encontrado: ${prestamoId}`)
  }

  // Filtrar solo pagos que cuentan (APLICADO y PAGO_PARCIAL)
  // Excluir PENDIENTE, REVERSADO, ANULADO
  const pagosValidos = prestamo.pagos.filter(
    (p) => p.estado === 'APLICADO' || p.estado === 'PAGO_PARCIAL'
  )

  // Sumar montos
  const montoPagado = pagosValidos.reduce((s, p) => s + p.montoTotal, 0)
  const montoCapitalPagado = pagosValidos.reduce((s, p) => s + p.montoCapital, 0)
  const montoInteresPagado = pagosValidos.reduce((s, p) => s + p.montoInteres, 0)
  const montoMoraPagado = pagosValidos.reduce((s, p) => s + p.montoMora, 0)

  // Saldos (nunca negativos)
  const saldoCapital = Math.max(0, prestamo.montoPrincipal - montoCapitalPagado)
  const saldoInteres = Math.max(0, prestamo.totalInteres - montoInteresPagado)
  const saldoTotal = Math.max(0, prestamo.totalPagar - montoPagado)

  // Cuotas pagadas: contar cuotas únicas con estado APLICADO (no PAGO_PARCIAL)
  // v4.0: NO contar los pagos de solo intereses (esSoloIntereses=true),
  // porque esos pagos solo cubrieron intereses — el capital sigue pendiente
  // y la cuota técnicamente sigue siendo "no pagada" (solo aplazada).
  const cuotasCompletamentePagadas = new Set(
    prestamo.pagos
      .filter((p) => p.estado === 'APLICADO' && !p.esSoloIntereses)
      .map((p) => p.numeroCuota)
  )
  const cuotasPagadas = cuotasCompletamentePagadas.size

  // === Cálculo EN VIVO de mora pendiente ===
  // Recalcular la tabla de amortización para obtener fechas de vencimiento reales
  // y sumar mora sobre cada cuota vencida NO pagada.
  // Esto reemplaza el snapshot stale `prestamo.montoMora` que se olvidaba de la mora nueva.
  let moraPendiente = 0
  let diasMoraMaximo = 0
  try {
    const tasaMoraEfectiva = getTasaMoraDiaria(prestamo)
    const calc = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: tasaMoraEfectiva,
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    })
    // Para cada cuota NO pagada (sin APLICADO), calcular mora si está vencida
    // Mora sobre CAPITAL INICIAL PRESTADO (política: % diario sobre capital inicial)
    for (const cuota of calc.tablaAmortizacion) {
      const pagada = cuotasCompletamentePagadas.has(cuota.numero)
      if (pagada) continue
      const diasMora = calcularDiasMora(cuota.fechaVencimiento)
      if (diasMora > 0) {
        const moraCuota = calcularMoraCompuesta(prestamo.montoPrincipal, tasaMoraEfectiva, diasMora)
        moraPendiente += moraCuota
        if (diasMora > diasMoraMaximo) diasMoraMaximo = diasMora
      }
    }
  } catch (e) {
    // Fallback: usar el snapshot montoMora del préstamo
    moraPendiente = Math.max(0, prestamo.montoMora - montoMoraPagado)
  }

  // Determinar estado
  let nuevoEstado = prestamo.estado
  if (cuotasPagadas >= prestamo.numeroCuotas || saldoTotal <= 0) {
    nuevoEstado = 'CANCELADO'
  } else if (prestamo.estado === 'EN_MORA') {
    // Solo vuelve a ACTIVO si TODAS las cuotas vencidas están completamente pagadas
    // (no basta un pago parcial para salir de mora)
    try {
      const calc = calcularPrestamo({
        montoPrincipal: prestamo.montoPrincipal,
        tasaInteresAnual: prestamo.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraDiaria(prestamo),
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia as any,
        fechaDesembolso: prestamo.fechaDesembolso || undefined,
      })
      const cuotasVencidasNoPagadas = calc.tablaAmortizacion.filter((c) => {
        const pagada = cuotasCompletamentePagadas.has(c.numero)
        if (pagada) return false
        const dias = calcularDiasMora(c.fechaVencimiento)
        return dias > 0
      })
      if (cuotasVencidasNoPagadas.length === 0 && pagosValidos.length > 0) {
        nuevoEstado = 'ACTIVO'
      }
    } catch {
      // Si falla el cálculo, mantener estado actual
    }
  } else if (prestamo.estado === 'CANCELADO' && saldoTotal > 0) {
    // Si era CANCELADO pero ahora tiene saldo (por reversión/eliminación), volver a ACTIVO
    nuevoEstado = 'ACTIVO'
  }

  // Auto-detección de EN_MORA: si hay mora pendiente > 0 y el préstamo está ACTIVO, pasar a EN_MORA
  if (nuevoEstado === 'ACTIVO' && moraPendiente > 0 && diasMoraMaximo > 0) {
    nuevoEstado = 'EN_MORA'
  }

  // Actualizar préstamo
  const prestamoActualizado = await db.prestamo.update({
    where: { id: prestamoId },
    data: {
      montoPagado,
      saldoCapital,
      saldoInteres,
      saldoTotal,
      cuotasPagadas,
      montoMora: moraPendiente,
      diasMora: diasMoraMaximo,
      estado: nuevoEstado,
    },
    include: { cliente: true },
  })

  return {
    prestamo: prestamoActualizado,
    estadisticas: {
      montoPagado,
      montoCapitalPagado,
      montoInteresPagado,
      montoMoraPagado,
      saldoCapital,
      saldoInteres,
      saldoTotal,
      cuotasPagadas,
      moraPendiente,
      diasMoraMaximo,
      nuevoEstado,
      numPagosValidos: pagosValidos.length,
    },
  }
}
