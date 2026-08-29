import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { calcularPrestamo, calcularDiasMora, getTasaMoraAnual } from '@/lib/finanzas'

// =====================================================
// /api/pagos/prediccion-mora v4.0 — OLA 3
// Modelo heurístico simple de predicción de mora.
// Para cada solicitud activo, calcula un score (0-100) de probabilidad
// de atrasarse en la próxima cuota, basado en:
//   - Historial de pagos del cliente (puntualidad)
//   - Días de mora actuales
//   - Número de pagos parciales vs completos
//   - Antigüedad del solicitud
//   - Tasa de mora aplicada (más alta = más probable de no poder pagar)
// =====================================================

interface Prediccion {
  prestamoId: string
  codigo: string
  cliente: string
  cedula: string
  telefono: string
  scoreMora: number // 0-100 (100 = muy probable que se atrase)
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  factores: string[]
  diasMoraActual: number
  probabilidadPagoPuntual: number // 0-100
  recomendacion: string
}

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const prestamos = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
      include: {
        cliente: true,
        pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } },
      },
    })

    const predicciones: Prediccion[] = []
    let totalRiesgo = 0
    const conteoNiveles = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 }

    for (const p of prestamos) {
      const calculo = calcularPrestamo({
        montoPrincipal: p.montoPrincipal,
        tasaInteresAnual: p.tasaInteresAnual,
        tasaMoraAnual: getTasaMoraAnual(p),
        plazoMeses: p.plazoMeses,
        frecuencia: p.frecuencia as any,
        fechaDesembolso: p.fechaDesembolso || undefined,
      })
      const proximaCuotaNum = p.cuotasPagadas + 1
      const cuotaPendiente = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuotaNum)
      if (!cuotaPendiente) continue

      const diasMora = calcularDiasMora(cuotaPendiente.fechaVencimiento)
      const diasAntiguedad = Math.floor((Date.now() - (p.fechaDesembolso?.getTime() || Date.now())) / (1000 * 60 * 60 * 24))

      // === Factores de riesgo ===
      let score = 0
      const factores: string[] = []

      // 1. Días de mora actuales (peso alto)
      if (diasMora > 0) {
        const factorMora = Math.min(40, diasMora * 1.5)
        score += factorMora
        factores.push(`${diasMora} días de mora actual (+${factorMora.toFixed(0)})`)
      }

      // 2. Historial de pagos: cuántos fueron puntuales vs tardíos
      const pagosAplicados = p.pagos.filter((pg) => pg.estado === 'APLICADO')
      let pagosPuntuales = 0
      let pagosTardios = 0
      let pagosParciales = 0
      for (const pg of pagosAplicados) {
        const cuotaOrig = calculo.tablaAmortizacion.find((c) => c.numero === pg.numeroCuota)
        if (!cuotaOrig) continue
        if (pg.fechaPago && pg.fechaPago <= cuotaOrig.fechaVencimiento) {
          pagosPuntuales++
        } else {
          pagosTardios++
        }
      }
      pagosParciales = p.pagos.filter((pg) => pg.estado === 'PAGO_PARCIAL').length

      const totalPagosHistorial = pagosAplicados.length + pagosParciales
      if (totalPagosHistorial > 0) {
        const tasaPuntualidad = pagosPuntuales / totalPagosHistorial
        const factorPuntualidad = (1 - tasaPuntualidad) * 25
        score += factorPuntualidad
        if (factorPuntualidad > 0) {
          factores.push(`Puntualidad ${(tasaPuntualidad * 100).toFixed(0)}% (${pagosPuntuales}/${totalPagosHistorial}) (+${factorPuntualidad.toFixed(0)})`)
        }
        if (pagosParciales > 0) {
          const factorParciales = Math.min(15, pagosParciales * 3)
          score += factorParciales
          factores.push(`${pagosParciales} pago(s) parciales (+${factorParciales})`)
        }
      } else {
        // Solicitud nuevo sin historial: riesgo medio por defecto
        score += 15
        factores.push('Sin historial de pagos (+15)')
      }

      // 3. Tasa de mora alta (>1.5% diario)
      if (p.tasaMoraDiaria > 1.5) {
        const factorTasa = Math.min(10, (p.tasaMoraDiaria - 1.5) * 5)
        score += factorTasa
        factores.push(`Tasa mora alta ${p.tasaMoraDiaria}% (+${factorTasa.toFixed(0)})`)
      }

      // 4. Antigüedad: solicitudes muy nuevos o muy antiguos tienen más riesgo
      if (diasAntiguedad < 30) {
        score += 5
        factores.push('Solicitud reciente (+5)')
      } else if (diasAntiguedad > 365) {
        score += 3
        factores.push('Solicitud antiguo (+3)')
      }

      // 5. Saldo grande relativo al monto original
      if (p.montoPrincipal > 0) {
        const ratioSaldo = p.saldoTotal / (p.totalPagar || 1)
        if (ratioSaldo > 0.7 && p.cuotasPagadas > 0) {
          score += 5
          factores.push('Saldo alto relativo (+5)')
        }
      }

      score = Math.min(100, Math.max(0, score))
      const probabilidadPagoPuntual = Math.max(0, 100 - score)

      const nivelRiesgo: Prediccion['nivelRiesgo'] =
        score >= 75 ? 'CRITICO' :
        score >= 50 ? 'ALTO' :
        score >= 25 ? 'MEDIO' : 'BAJO'
      conteoNiveles[nivelRiesgo]++

      const recomendacion =
        nivelRiesgo === 'CRITICO' ? 'Contactar urgente, considerar refinanciación o jurídico' :
        nivelRiesgo === 'ALTO' ? 'Llamar antes del vencimiento, ofrecer plan de pago' :
        nivelRiesgo === 'MEDIO' ? 'Enviar recordatorio WhatsApp 3 días antes' :
        'Recordatorio estándar por WhatsApp'

      totalRiesgo += score

      predicciones.push({
        prestamoId: p.id,
        codigo: p.codigo,
        cliente: p.cliente.nombre,
        cedula: p.cliente.cedula,
        telefono: p.cliente.telefono,
        scoreMora: Math.round(score),
        nivelRiesgo,
        factores,
        diasMoraActual: diasMora,
        probabilidadPagoPuntual: Math.round(probabilidadPagoPuntual),
        recomendacion,
      })
    }

    predicciones.sort((a, b) => b.scoreMora - a.scoreMora)

    return NextResponse.json({
      success: true,
      data: predicciones,
      resumen: {
        total: predicciones.length,
        promedioRiesgo: predicciones.length > 0 ? Math.round(totalRiesgo / predicciones.length) : 0,
        conteoNiveles: conteoNiveles,
        altoRiesgo: predicciones.filter((p) => p.nivelRiesgo === 'ALTO' || p.nivelRiesgo === 'CRITICO').length,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
