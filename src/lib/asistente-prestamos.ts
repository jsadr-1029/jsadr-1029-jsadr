// =====================================================
// asistente-prestamos.ts — Director Inteligente del Módulo de Solicitudes
// Función principal: obtenerEstadoModuloPrestamos() — visión 360° del módulo
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// Obtener estado completo del módulo de solicitudes
// =====================================================
export async function obtenerEstadoModuloPrestamos() {
  const ahora = new Date()
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)
  const finHoy = new Date(inicioHoy)
  finHoy.setHours(23, 59, 59, 999)

  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)
  const en7dias = new Date(ahora)
  en7dias.setDate(en7dias.getDate() + 7)

  // === 1. Conteos por estado ===
  const [
    totalSolicitudes,
    totalActivos,
    totalFinalizados,
    totalCancelados,
    totalMora,
    totalJuridico,
    totalPrestamos,
  ] = await Promise.all([
    db.prestamo.count({ where: { estado: { in: ['SOLICITUD', 'PENDIENTE_ACEPTACION'] } } }),
    db.prestamo.count({ where: { estado: 'ACTIVO' } }),
    db.prestamo.count({ where: { estado: 'FINALIZADO' } }),
    db.prestamo.count({ where: { estado: 'CANCELADO' } }),
    db.prestamo.count({ where: { estado: 'EN_MORA' } }),
    db.prestamo.count({ where: { estado: 'JURIDICO' } }),
    db.prestamo.count(),
  ])

  // === 2. Solicitudes activos con detalle ===
  const prestamosActivos = await db.prestamo.findMany({
    where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
      categoria: { select: { id: true, nombre: true, tasaInteresAnual: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // === 3. KPIs financieros ===
  const capitalPrestado = prestamosActivos.reduce((s, p) => s + (p.montoPrincipal || 0), 0)
  const capitalRecuperado = prestamosActivos.reduce((s, p) => s + (p.montoPagado || 0), 0)
  const capitalPendiente = prestamosActivos.reduce((s, p) => s + (p.saldoTotal || 0), 0)
  const interesesCobrados = prestamosActivos.reduce((s, p) => s + (p.totalInteres || 0), 0)
  const interesesPendientes = prestamosActivos.reduce(
    (s, p) => s + Math.max(0, (p.saldoInteres || 0)),
    0
  )
  const moraAcumulada = prestamosActivos.reduce((s, p) => s + (p.montoMora || 0), 0)

  // === 4. Utilidad del mes (intereses cobrados este mes) ===
  const pagosMes = await db.pago.findMany({
    where: { estado: 'APLICADO', fechaPago: { gte: inicioMes } },
    select: { montoInteres: true, montoMora: true, montoCapital: true, montoTotal: true },
  })
  const utilidadMes = pagosMes.reduce((s, p) => s + (p.montoInteres || 0) + (p.montoMora || 0), 0)
  const recaudoMes = pagosMes.reduce((s, p) => s + (p.montoTotal || 0), 0)

  // === 5. Utilidad del año ===
  const pagosAnio = await db.pago.findMany({
    where: { estado: 'APLICADO', fechaPago: { gte: inicioAnio } },
    select: { montoInteres: true, montoMora: true },
  })
  const utilidadAnio = pagosAnio.reduce((s, p) => s + (p.montoInteres || 0) + (p.montoMora || 0), 0)

  // === 6. Solicitudes creados hoy ===
  const creadosHoy = await db.prestamo.count({
    where: { createdAt: { gte: inicioHoy, lte: finHoy } },
  })

  // === 7. Próximos vencimientos (7 días) ===
  const proximosVencer = prestamosActivos.filter((p) => {
    if (!p.fechaVencimiento) return false
    const venc = new Date(p.fechaVencimiento)
    return venc > finHoy && venc <= en7dias
  })

  // === 8. Vencen hoy ===
  const vencenHoy = prestamosActivos.filter((p) => {
    if (!p.fechaVencimiento) return false
    const venc = new Date(p.fechaVencimiento)
    return venc >= inicioHoy && venc <= finHoy
  })

  // === 9. Clientes aptos para renovación (al día, progreso > 70%) ===
  const aptosRenovacion = prestamosActivos
    .filter((p) => {
      const progreso = p.numeroCuotas > 0 ? (p.cuotasPagadas / p.numeroCuotas) * 100 : 0
      return p.diasMora === 0 && progreso >= 70 && p.estado === 'ACTIVO'
    })
    .map((p) => ({
      cliente: p.cliente.nombre,
      cedula: p.cliente.cedula,
      codigo: p.codigo,
      progreso: p.numeroCuotas > 0 ? Math.round((p.cuotasPagadas / p.numeroCuotas) * 100) : 0,
      saldoPendiente: p.saldoTotal || 0,
      cuotasRestantes: p.numeroCuotas - p.cuotasPagadas,
    }))
    .sort((a, b) => b.progreso - a.progreso)

  // === 10. Solicitudes más rentables (mayor interés generado) ===
  const masRentables = [...prestamosActivos]
    .map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      capital: p.montoPrincipal || 0,
      interesGenerado: p.totalInteres || 0,
      rentabilidadPct: p.montoPrincipal > 0
        ? Math.round(((p.totalInteres || 0) / p.montoPrincipal) * 100)
        : 0,
    }))
    .sort((a, b) => b.interesGenerado - a.interesGenerado)
    .slice(0, 5)

  // === 11. Solicitudes de mayor riesgo (mayor mora/días) ===
  const mayorRiesgo = [...prestamosActivos]
    .filter((p) => p.diasMora > 0)
    .map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      diasMora: p.diasMora,
      montoMora: p.montoMora || 0,
      saldoTotal: p.saldoTotal || 0,
      severidad:
        p.diasMora >= 60 ? 'CRITICA' :
        p.diasMora >= 30 ? 'ALTA' :
        p.diasMora >= 15 ? 'MEDIA' : 'BAJA',
    }))
    .sort((a, b) => b.diasMora - a.diasMora)
    .slice(0, 5)

  // === 12. Comportamiento de pago ===
  const clientesBuenPagador = prestamosActivos
    .filter((p) => p.diasMora === 0 && p.cuotasPagadas >= 3)
    .map((p) => ({
      cliente: p.cliente.nombre,
      cuotasPagadas: p.cuotasPagadas,
      cuotasTotales: p.numeroCuotas,
      progreso: p.numeroCuotas > 0 ? Math.round((p.cuotasPagadas / p.numeroCuotas) * 100) : 0,
    }))
    .sort((a, b) => b.cuotasPagadas - a.cuotasPagadas)
    .slice(0, 5)

  // === 13. Concentración por categoría ===
  const porCategoria: Record<string, { count: number; monto: number }> = {}
  prestamosActivos.forEach((p) => {
    const cat = p.categoria?.nombre || 'Sin categoría'
    if (!porCategoria[cat]) porCategoria[cat] = { count: 0, monto: 0 }
    porCategoria[cat].count++
    porCategoria[cat].monto += p.montoPrincipal || 0
  })

  // === 14. Alertas detectadas ===
  const alertas: Array<{ severidad: string; titulo: string; descripcion: string }> = []

  if (totalMora > 0) {
    const pctMora = totalActivos > 0 ? Math.round((totalMora / totalActivos) * 100) : 0
    if (pctMora > 20) {
      alertas.push({
        severidad: 'ALTA',
        titulo: `Tasa de mora elevada (${pctMora}%)`,
        descripcion: 'Revisar políticas de otorgamiento de solicitudes.',
      })
    }
  }

  // Clientes con cuota > 30% del ingreso (no podemos validar sin campo salario, lo omitimos)
  // Concentración excesiva en una categoría
  Object.entries(porCategoria).forEach(([cat, data]) => {
    const pctConcentracion = capitalPrestado > 0 ? Math.round((data.monto / capitalPrestado) * 100) : 0
    if (pctConcentracion > 70) {
      alertas.push({
        severidad: 'MEDIA',
        titulo: `Concentración en categoría "${cat}" (${pctConcentracion}%)`,
        descripcion: 'Diversificar la cartera reduce el riesgo.',
      })
    }
  })

  // === 15. Resumen ejecutivo ===
  const resumen = {
    fecha: ahora.toISOString(),
    totalPrestamos,
    totalSolicitudes,
    totalActivos,
    totalFinalizados,
    totalCancelados,
    totalMora,
    totalJuridico,
    creadosHoy,
    capitalPrestado,
    capitalRecuperado,
    capitalPendiente,
    interesesCobrados,
    interesesPendientes,
    moraAcumulada,
    utilidadMes,
    utilidadAnio,
    recaudoMes,
    vencenHoy: vencenHoy.length,
    proximosVencer: proximosVencer.length,
    aptosRenovacion: aptosRenovacion.length,
    tasaMora: totalActivos > 0 ? Math.round((totalMora / totalActivos) * 100) : 0,
    tasaRecuperacion: capitalPrestado > 0 ? Math.round((capitalRecuperado / capitalPrestado) * 100) : 0,
    rentabilidadPromedio: capitalPrestado > 0 ? Math.round((interesesCobrados / capitalPrestado) * 100) : 0,
  }

  return {
    resumen,
    proximosVencer: proximosVencer.map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      montoCuota: p.montoCuota || 0,
      fechaVencimiento: p.fechaVencimiento,
    })),
    vencenHoy: vencenHoy.map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      montoCuota: p.montoCuota || 0,
    })),
    aptosRenovacion,
    masRentables,
    mayorRiesgo,
    clientesBuenPagador,
    porCategoria: Object.entries(porCategoria).map(([categoria, data]) => ({
      categoria,
      count: data.count,
      monto: data.monto,
    })),
    alertas,
  }
}

// =====================================================
// Generar dashboard ejecutivo en texto
// =====================================================
export async function generarDashboardEjecutivo() {
  const estado = await obtenerEstadoModuloPrestamos()
  const r = estado.resumen

  let texto = `📋 DASHBOARD EJECUTIVO — MÓDULO SOLICITUDES\n`
  texto += `${new Date().toLocaleString('es-CO')}\n\n`

  texto += `═══ PANORAMA GENERAL ═══\n`
  texto += `Total solicitudes: ${r.totalPrestamos}\n`
  texto += `• Solicitudes pendientes: ${r.totalSolicitudes}\n`
  texto += `• Activos: ${r.totalActivos}\n`
  texto += `• Finalizados: ${r.totalFinalizados}\n`
  texto += `• Cancelados: ${r.totalCancelados}\n`
  texto += `• En mora: ${r.totalMora} (${r.tasaMora}%)\n`
  texto += `• En jurídico: ${r.totalJuridico}\n`
  texto += `• Creados hoy: ${r.creadosHoy}\n\n`

  texto += `═══ INDICADORES FINANCIEROS ═══\n`
  texto += `Capital prestado: ${formatearMoneda(r.capitalPrestado)}\n`
  texto += `Capital recuperado: ${formatearMoneda(r.capitalRecuperado)} (${r.tasaRecuperacion}%)\n`
  texto += `Capital pendiente: ${formatearMoneda(r.capitalPendiente)}\n`
  texto += `Intereses cobrados: ${formatearMoneda(r.interesesCobrados)}\n`
  texto += `Intereses pendientes: ${formatearMoneda(r.interesesPendientes)}\n`
  texto += `Mora acumulada: ${formatearMoneda(r.moraAcumulada)}\n`
  texto += `Rentabilidad promedio: ${r.rentabilidadPromedio}%\n\n`

  texto += `═══ UTILIDAD ═══\n`
  texto += `Utilidad del mes: ${formatearMoneda(r.utilidadMes)}\n`
  texto += `Utilidad del año: ${formatearMoneda(r.utilidadAnio)}\n`
  texto += `Recaudo del mes: ${formatearMoneda(r.recaudoMes)}\n\n`

  texto += `═══ VENCIMIENTOS ═══\n`
  texto += `Vencen hoy: ${r.vencenHoy}\n`
  texto += `Próximos a vencer (7 días): ${r.proximosVencer}\n`
  texto += `Aptos para renovación: ${r.aptosRenovacion}\n\n`

  if (estado.alertas.length > 0) {
    texto += `═══ ALERTAS (${estado.alertas.length}) ═══\n`
    estado.alertas.forEach((a, i) => {
      texto += `${i + 1}. [${a.severidad}] ${a.titulo}\n   ${a.descripcion}\n\n`
    })
  }

  if (estado.aptosRenovacion.length > 0) {
    texto += `══️ OPORTUNIDADES DE RENOVACIÓN ═══\n`
    estado.aptosRenovacion.slice(0, 5).forEach((a, i) => {
      texto += `${i + 1}. ${a.cliente} (${a.progreso}% pagado, ${a.cuotasRestantes} cuotas restantes)\n`
      texto += `   Saldo pendiente: ${formatearMoneda(a.saldoPendiente)}\n`
    })
    texto += `\n`
  }

  if (estado.masRentables.length > 0) {
    texto += `═══ SOLICITUDES MÁS RENTABLES ═══\n`
    estado.masRentables.forEach((p, i) => {
      texto += `${i + 1}. ${p.codigo} — ${p.cliente}\n`
      texto += `   Capital: ${formatearMoneda(p.capital)} | Interés: ${formatearMoneda(p.interesGenerado)} (${p.rentabilidadPct}%)\n`
    })
    texto += `\n`
  }

  if (estado.mayorRiesgo.length > 0) {
    texto += `═══ MAYOR RIESGO ═══\n`
    estado.mayorRiesgo.forEach((p, i) => {
      texto += `${i + 1}. ${p.codigo} — ${p.cliente} (${p.diasMora} días mora)\n`
      texto += `   Saldo: ${formatearMoneda(p.saldoTotal)} | Mora: ${formatearMoneda(p.montoMora)} [${p.severidad}]\n`
    })
  }

  return texto
}

// =====================================================
// Simular solicitud (3 modalidades)
// =====================================================
export function simularPrestamo(params: {
  capital: number
  tasaMensual: number // en decimal (ej: 0.025 para 2.5%)
  plazo: number // número de cuotas
  modalidad: 'FRANCES' | 'FIJO_MENSUAL' | 'CUOTA_PERSONALIZADA'
  cuotaPersonalizada?: number
  frecuencia?: 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'
  fondoGarantia?: number
}) {
  const { capital, tasaMensual, plazo, modalidad, cuotaPersonalizada, fondoGarantia = 0 } = params

  let cuota = 0
  let interesTotal = 0
  let totalPagar = 0
  let cronograma: Array<{ cuota: number; capital: number; interes: number; total: number; saldo: number }> = []

  if (modalidad === 'FRANCES') {
    // Sistema francés: cuota fija con amortización variable
    if (tasaMensual === 0) {
      cuota = capital / plazo
    } else {
      cuota = capital * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1)
    }
    interesTotal = cuota * plazo - capital
    totalPagar = cuota * plazo

    let saldo = capital
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * tasaMensual
      const abonoCapital = cuota - interes
      saldo -= abonoCapital
      cronograma.push({
        cuota: i,
        capital: Math.round(abonoCapital),
        interes: Math.round(interes),
        total: Math.round(cuota),
        saldo: Math.max(0, Math.round(saldo)),
      })
    }
  } else if (modalidad === 'FIJO_MENSUAL') {
    // Jsadr: interés fijo sobre capital inicial
    interesTotal = capital * tasaMensual * plazo
    totalPagar = capital + interesTotal
    cuota = totalPagar / plazo

    let saldo = totalPagar
    for (let i = 1; i <= plazo; i++) {
      saldo -= cuota
      cronograma.push({
        cuota: i,
        capital: Math.round(capital / plazo),
        interes: Math.round(interesTotal / plazo),
        total: Math.round(cuota),
        saldo: Math.max(0, Math.round(saldo)),
      })
    }
  } else if (modalidad === 'CUOTA_PERSONALIZADA') {
    // Usuario define la cuota
    cuota = cuotaPersonalizada || 0
    if (cuota <= capital * tasaMensual) {
      return {
        error: 'La cuota personalizada debe ser mayor al interés del primer período.',
      }
    }
    let saldo = capital
    let cuotaNum = 0
    while (saldo > 0 && cuotaNum < 1000) {
      cuotaNum++
      const interes = saldo * tasaMensual
      let abonoCapital = cuota - interes
      if (abonoCapital >= saldo) {
        abonoCapital = saldo
        cronograma.push({
          cuota: cuotaNum,
          capital: Math.round(abonoCapital),
          interes: Math.round(interes),
          total: Math.round(abonoCapital + interes),
          saldo: 0,
        })
        interesTotal += interes
        break
      }
      saldo -= abonoCapital
      cronograma.push({
        cuota: cuotaNum,
        capital: Math.round(abonoCapital),
        interes: Math.round(interes),
        total: Math.round(cuota),
        saldo: Math.max(0, Math.round(saldo)),
      })
      interesTotal += interes
    }
    totalPagar = capital + interesTotal
    plazo // se mantiene como referencia pero el plazo real es cuotaNum
  }

  const rentabilidadPct = capital > 0 ? Math.round((interesTotal / capital) * 100) : 0

  return {
    capital,
    tasaMensual: (tasaMensual * 100).toFixed(2) + '%',
    plazo,
    modalidad,
    cuota: Math.round(cuota),
    interesTotal: Math.round(interesTotal),
    totalPagar: Math.round(totalPagar + fondoGarantia),
    rentabilidadPct,
    fondoGarantia,
    cronograma,
  }
}

// =====================================================
// Generar análisis de rentabilidad
// =====================================================
export async function generarAnalisisRentabilidad() {
  const estado = await obtenerEstadoModuloPrestamos()
  const r = estado.resumen

  let texto = `📊 ANÁLISIS DE RENTABILIDAD — MÓDULO SOLICITUDES\n\n`

  texto += `═══ RENTABILIDAD ACTUAL ═══\n`
  texto += `Capital prestado: ${formatearMoneda(r.capitalPrestado)}\n`
  texto += `Intereses cobrados: ${formatearMoneda(r.interesesCobrados)}\n`
  texto += `Rentabilidad promedio: ${r.rentabilidadPromedio}%\n`
  texto += `Utilidad del mes: ${formatearMoneda(r.utilidadMes)}\n`
  texto += `Utilidad del año: ${formatearMoneda(r.utilidadAnio)}\n\n`

  texto += `═══ CONCENTRACIÓN DE CARTERA ═══\n`
  estado.porCategoria.forEach((c) => {
    const pct = r.capitalPrestado > 0 ? Math.round((c.monto / r.capitalPrestado) * 100) : 0
    texto += `• ${c.categoria}: ${c.count} solicitudes, ${formatearMoneda(c.monto)} (${pct}%)\n`
  })
  texto += `\n`

  texto += `═══ SOLICITUDES MÁS RENTABLES ═══\n`
  estado.masRentables.forEach((p, i) => {
    texto += `${i + 1}. ${p.codigo} — ${p.cliente}\n`
    texto += `   Capital: ${formatearMoneda(p.capital)} → Interés: ${formatearMoneda(p.interesGenerado)} (${p.rentabilidadPct}%)\n`
  })
  texto += `\n`

  texto += `═══ RECOMENDACIONES ═══\n`
  if (r.tasaMora > 20) {
    texto += `🔴 Reducir mora (${r.tasaMora}%) — revisar políticas de otorgamiento.\n`
  }
  if (estado.aptosRenovacion.length > 0) {
    texto += `🟢 ${estado.aptosRenovacion.length} cliente(s) apto(s) para renovación — contáctalos.\n`
  }
  if (r.rentabilidadPromedio < 20) {
    texto += `🟡 Rentabilidad baja (${r.rentabilidadPromedio}%) — considerar ajustar tasas.\n`
  }
  texto += `📊 Diversificar cartera: ${estado.porCategoria.length} categoría(s) activa(s).\n`

  return texto
}
