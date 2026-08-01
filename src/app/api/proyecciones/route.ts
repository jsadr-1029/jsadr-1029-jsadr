import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo } from '@/lib/finanzas'
import { sanitizeError } from '@/lib/error-handler'

export async function GET() {
  try {
    // =====================================================
    // PROYECCIONES FINANCIERAS
    // - Capital activo (saldo capital pendiente)
    // - Intereses proyectados (saldo interés pendiente)
    // - Total a recuperar (capital + interés + mora)
    // - Ganancia esperada (% sobre capital)
    // - Proyección mensual 12 meses (capital + interés)
    // - Desglose por categoría
    // - Desglose por cliente (top 15)
    // - Desglose por préstamo (top 20)
    // =====================================================

    const prestamosActivos = await db.prestamo.findMany({
      where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
      include: {
        cliente: { include: { categoria: true } },
        categoria: true,
        pagos: { where: { estado: 'APLICADO' } },
      },
    })

    // === 1. KPIs principales ===
    const capitalActivo = prestamosActivos.reduce((s, p) => s + p.saldoCapital, 0)
    const interesesProyectados = prestamosActivos.reduce((s, p) => s + p.saldoInteres, 0)
    const moraPendiente = prestamosActivos.reduce((s, p) => s + p.montoMora, 0)
    const totalARecuperar = capitalActivo + interesesProyectados + moraPendiente
    const totalDesembolsado = prestamosActivos.reduce((s, p) => s + p.montoPrincipal, 0)
    const totalInteresGenerado = prestamosActivos.reduce((s, p) => s + p.totalInteres, 0)
    const totalPagado = prestamosActivos.reduce((s, p) => s + p.montoPagado, 0)
    const gananciaEsperadaPct = totalDesembolsado > 0
      ? (interesesProyectados / totalDesembolsado) * 100
      : 0

    // === 2. Proyección mensual 12 meses ===
    // Calcula cuánto capital y cuánto interés se espera recuperar cada mes
    const proyeccionMensual: {
      mes: string
      capital: number
      interes: number
      mora: number
      total: number
    }[] = []

    const hoy = new Date()
    for (let i = 0; i < 12; i++) {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0, 23, 59, 59, 999)
      const nombreMes = inicioMes.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })

      let capitalMes = 0
      let interesMes = 0
      let moraMes = 0

      for (const prestamo of prestamosActivos) {
        if (!prestamo.fechaDesembolso) continue

        const calculo = calcularPrestamo({
          montoPrincipal: prestamo.montoPrincipal,
          tasaInteresAnual: prestamo.tasaInteresAnual,
          tasaMoraAnual: (prestamo as any).tasaMoraAnual ?? prestamo.tasaInteresAnual,
          plazoMeses: prestamo.plazoMeses,
          frecuencia: prestamo.frecuencia as any,
          fechaDesembolso: prestamo.fechaDesembolso,
        })

        for (const cuota of calculo.tablaAmortizacion) {
          const fechaCuota = new Date(cuota.fechaVencimiento)
          if (fechaCuota >= inicioMes && fechaCuota <= finMes) {
            const yaPagada = prestamo.pagos.some(
              (p) => p.numeroCuota === cuota.numero && p.estado === 'APLICADO'
            )
            if (!yaPagada) {
              capitalMes += cuota.capital
              interesMes += cuota.interes
            }
          }
        }
      }

      if (capitalMes > 0 || interesMes > 0) {
        proyeccionMensual.push({
          mes: nombreMes,
          capital: capitalMes,
          interes: interesMes,
          mora: moraMes,
          total: capitalMes + interesMes + moraMes,
        })
      }
    }

    // === 3. Desglose por categoría ===
    const porCategoriaMap: Record<string, {
      categoria: string
      codigo: string
      capitalActivo: number
      interesesProyectados: number
      moraPendiente: number
      totalARecuperar: number
      cantidadPrestamos: number
      sumaTasa: number
    }> = {}

    for (const p of prestamosActivos) {
      const cat = p.categoria || p.cliente.categoria
      const codigo = cat?.codigo || 'SIN-CAT'
      const nombre = cat?.nombre || 'Sin categoría'

      if (!porCategoriaMap[codigo]) {
        porCategoriaMap[codigo] = {
          categoria: nombre,
          codigo,
          capitalActivo: 0,
          interesesProyectados: 0,
          moraPendiente: 0,
          totalARecuperar: 0,
          cantidadPrestamos: 0,
          sumaTasa: 0,
        }
      }

      porCategoriaMap[codigo].capitalActivo += p.saldoCapital
      porCategoriaMap[codigo].interesesProyectados += p.saldoInteres
      porCategoriaMap[codigo].moraPendiente += p.montoMora
      porCategoriaMap[codigo].totalARecuperar += p.saldoTotal + p.montoMora
      porCategoriaMap[codigo].cantidadPrestamos += 1
      porCategoriaMap[codigo].sumaTasa += p.tasaInteresAnual
    }

    const porCategoria = Object.values(porCategoriaMap).map((c) => ({
      ...c,
      tasaPromedio: c.cantidadPrestamos > 0 ? c.sumaTasa / c.cantidadPrestamos : 0,
      gananciaPct: c.capitalActivo > 0 ? (c.interesesProyectados / c.capitalActivo) * 100 : 0,
    }))

    // === 4. Desglose por cliente (top 15 por capital activo) ===
    const porClienteMap: Record<string, {
      clienteId: string
      cliente: string
      cedula: string
      categoria: string
      cantidadPrestamos: number
      capitalActivo: number
      interesesProyectados: number
      moraPendiente: number
      totalARecuperar: number
      proximoVencimiento: string | null
    }> = {}

    for (const p of prestamosActivos) {
      const key = p.clienteId
      if (!porClienteMap[key]) {
        porClienteMap[key] = {
          clienteId: p.clienteId,
          cliente: p.cliente.nombre,
          cedula: p.cliente.cedula,
          categoria: p.cliente.categoria?.codigo || 'SIN-CAT',
          cantidadPrestamos: 0,
          capitalActivo: 0,
          interesesProyectados: 0,
          moraPendiente: 0,
          totalARecuperar: 0,
          proximoVencimiento: null,
        }
      }

      porClienteMap[key].cantidadPrestamos += 1
      porClienteMap[key].capitalActivo += p.saldoCapital
      porClienteMap[key].interesesProyectados += p.saldoInteres
      porClienteMap[key].moraPendiente += p.montoMora
      porClienteMap[key].totalARecuperar += p.saldoTotal + p.montoMora

      // Buscar próximo vencimiento
      if (p.fechaDesembolso) {
        const calculo = calcularPrestamo({
          montoPrincipal: p.montoPrincipal,
          tasaInteresAnual: p.tasaInteresAnual,
          tasaMoraAnual: (p as any).tasaMoraAnual ?? p.tasaInteresAnual,
          plazoMeses: p.plazoMeses,
          frecuencia: p.frecuencia as any,
          fechaDesembolso: p.fechaDesembolso,
        })

        for (const cuota of calculo.tablaAmortizacion) {
          const yaPagada = p.pagos.some(
            (pg) => pg.numeroCuota === cuota.numero && pg.estado === 'APLICADO'
          )
          if (!yaPagada && cuota.fechaVencimiento > hoy) {
            const fechaStr = cuota.fechaVencimiento.toISOString()
            if (!porClienteMap[key].proximoVencimiento || fechaStr < porClienteMap[key].proximoVencimiento!) {
              porClienteMap[key].proximoVencimiento = fechaStr
            }
            break
          }
        }
      }
    }

    const porCliente = Object.values(porClienteMap)
      .sort((a, b) => b.capitalActivo - a.capitalActivo)
      .slice(0, 15)

    // === 5. Desglose por préstamo (top 20) ===
    const porPrestamo = prestamosActivos
      .map((p) => ({
        codigo: p.codigo,
        cliente: p.cliente.nombre,
        cedula: p.cliente.cedula,
        categoria: p.cliente.categoria?.codigo || 'SIN-CAT',
        montoPrincipal: p.montoPrincipal,
        capitalActivo: p.saldoCapital,
        interesesProyectados: p.saldoInteres,
        moraPendiente: p.montoMora,
        totalARecuperar: p.saldoTotal + p.montoMora,
        cuotasPagadas: p.cuotasPagadas,
        totalCuotas: p.numeroCuotas,
        diasMora: p.diasMora,
        estado: p.estado,
        fechaDesembolso: p.fechaDesembolso,
        fechaVencimiento: p.fechaVencimiento,
      }))
      .sort((a, b) => b.totalARecuperar - a.totalARecuperar)
      .slice(0, 20)

    // === 6. Resumen por estado ===
    const resumenEstados = {
      ACTIVO: prestamosActivos.filter((p) => p.estado === 'ACTIVO').length,
      EN_MORA: prestamosActivos.filter((p) => p.estado === 'EN_MORA').length,
      total: prestamosActivos.length,
    }

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          capitalActivo,
          interesesProyectados,
          moraPendiente,
          totalARecuperar,
          totalDesembolsado,
          totalInteresGenerado,
          totalPagado,
          gananciaEsperadaPct,
          cantidadPrestamos: prestamosActivos.length,
        },
        proyeccionMensual,
        porCategoria,
        porCliente,
        porPrestamo,
        resumenEstados,
      },
    })
  } catch (error: any) {
    console.error('Error en /api/proyecciones:', error)
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
