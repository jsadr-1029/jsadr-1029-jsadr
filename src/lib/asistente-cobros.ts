// =====================================================
// asistente-cobros.ts — Lógica del Gerente de Cobranza
// Función principal: obtenerEstadoCartera() — visión global 360°
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// Obtener estado completo de la cartera (monitoreo permanente)
// =====================================================
export async function obtenerEstadoCartera() {
  const ahora = new Date()
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)
  const finHoy = new Date(inicioHoy)
  finHoy.setHours(23, 59, 59, 999)

  const inicioSemana = new Date(ahora)
  inicioSemana.setDate(inicioSemana.getDate() - 7)

  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)

  // === 1. Préstamos por estado ===
  const [
    totalActivos,
    totalPendientes,
    totalAlDia,
    totalMora,
    totalJuridico,
    totalPrestamos,
  ] = await Promise.all([
    db.prestamo.count({ where: { estado: 'ACTIVO' } }),
    db.prestamo.count({ where: { estado: { in: ['SOLICITUD', 'PENDIENTE_ACEPTACION'] } } }),
    db.prestamo.count({ where: { estado: 'ACTIVO', diasMora: 0 } }),
    db.prestamo.count({ where: { estado: 'EN_MORA' } }),
    db.prestamo.count({ where: { estado: 'JURIDICO' } }),
    db.prestamo.count(),
  ])

  // === 2. Detalle de préstamos activos ===
  const prestamosActivos = await db.prestamo.findMany({
    where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
    },
    orderBy: { diasMora: 'desc' },
  })

  // === 3. Capital pendiente por recuperar ===
  const sumaSaldos = prestamosActivos.reduce((s, p) => s + (p.saldoTotal || 0), 0)
  const sumaCapital = prestamosActivos.reduce((s, p) => s + (p.saldoCapital || 0), 0)
  const sumaInteresCorriente = prestamosActivos.reduce(
    (s, p) => s + Math.max(0, (p.saldoTotal || 0) - (p.saldoCapital || 0) - (p.montoMora || 0)),
    0
  )
  const sumaMoraAcumulada = prestamosActivos.reduce((s, p) => s + (p.montoMora || 0), 0)

  // === 4. Morosos (ordenados por días de mora) ===
  const morosos = prestamosActivos
    .filter((p) => p.diasMora > 0)
    .map((p) => ({
      id: p.id,
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      cedula: p.cliente.cedula,
      telefono: p.cliente.telefono,
      saldoTotal: p.saldoTotal || 0,
      montoMora: p.montoMora || 0,
      diasMora: p.diasMora,
      montoCuota: p.montoCuota || 0,
      cuotasPagadas: p.cuotasPagadas,
      numeroCuotas: p.numeroCuotas,
      severidad:
        p.diasMora >= 60 ? 'CRITICA' :
        p.diasMora >= 30 ? 'ALTA' :
        p.diasMora >= 15 ? 'MEDIA' :
        p.diasMora >= 7 ? 'BAJA' : 'LEVE',
      accionRecomendada:
        p.diasMora >= 60 ? 'ESCALAR_JURIDICO' :
        p.diasMora >= 30 ? 'ULTIMA_OPORTUNIDAD' :
        p.diasMora >= 15 ? 'OFRECER_REFINANCIACION' :
        p.diasMora >= 7 ? 'PLAN_PAGO' :
        p.diasMora >= 1 ? 'COBRO_PERSUASIVO' : 'RECORDATORIO',
    }))
    .sort((a, b) => b.diasMora - a.diasMora)

  // === 5. Cuotas que vencen hoy ===
  const vencenHoy = prestamosActivos.filter((p) => {
    if (!p.fechaVencimiento) return false
    const venc = new Date(p.fechaVencimiento)
    return venc >= inicioHoy && venc <= finHoy
  })

  // === 6. Cuotas que vencen en próximos 7 días ===
  const en7dias = new Date(ahora)
  en7dias.setDate(en7dias.getDate() + 7)
  const vencenProximos7 = prestamosActivos.filter((p) => {
    if (!p.fechaVencimiento) return false
    const venc = new Date(p.fechaVencimiento)
    return venc > finHoy && venc <= en7dias
  })

  // === 7. Recaudo (diario, semanal, mensual, anual) ===
  const [pagosHoy, pagosSemana, pagosMes, pagosAnio] = await Promise.all([
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioHoy, lte: finHoy } },
      select: { montoTotal: true, montoCapital: true, montoInteres: true, montoMora: true },
    }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioSemana } },
      select: { montoTotal: true },
    }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioMes } },
      select: { montoTotal: true },
    }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioAnio } },
      select: { montoTotal: true },
    }),
  ])

  const recaudo = {
    diario: pagosHoy.reduce((s, p) => s + (p.montoTotal || 0), 0),
    semanal: pagosSemana.reduce((s, p) => s + (p.montoTotal || 0), 0),
    mensual: pagosMes.reduce((s, p) => s + (p.montoTotal || 0), 0),
    anual: pagosAnio.reduce((s, p) => s + (p.montoTotal || 0), 0),
    countDiario: pagosHoy.length,
    countSemanal: pagosSemana.length,
    countMensual: pagosMes.length,
    countAnual: pagosAnio.length,
  }

  // === 8. Indicadores de recuperación ===
  const capitalPrestadoTotal = prestamosActivos.reduce((s, p) => s + (p.montoPrincipal || 0), 0)
  const capitalRecuperado = prestamosActivos.reduce((s, p) => s + (p.montoPagado || 0), 0)
  const tasaRecuperacion = capitalPrestadoTotal > 0
    ? Math.round((capitalRecuperado / capitalPrestadoTotal) * 100)
    : 0
  const tasaMora = totalActivos > 0 ? Math.round((totalMora / totalActivos) * 100) : 0
  const promedioDiasMora = morosos.length > 0
    ? Math.round(morosos.reduce((s, m) => s + m.diasMora, 0) / morosos.length)
    : 0

  // === 9. Clientes reincidentes (más de 1 préstamo en mora) ===
  const moraPorCliente: Record<string, number> = {}
  morosos.forEach((m) => {
    moraPorCliente[m.cedula] = (moraPorCliente[m.cedula] || 0) + 1
  })
  const reincidentes = Object.entries(moraPorCliente)
    .filter(([_, count]) => count > 1)
    .map(([cedula, count]) => ({
      cedula,
      count,
      nombre: morosos.find((m) => m.cedula === cedula)?.cliente || 'N/A',
    }))

  // === 10. Clientes con excelente comportamiento (al día con varios préstamos pagados) ===
  const clientesAlDia = prestamosActivos
    .filter((p) => p.diasMora === 0 && p.cuotasPagadas > 0)
    .map((p) => ({
      nombre: p.cliente.nombre,
      cedula: p.cliente.cedula,
      cuotasPagadas: p.cuotasPagadas,
      numeroCuotas: p.numeroCuotas,
      progreso: p.numeroCuotas > 0 ? Math.round((p.cuotasPagadas / p.numeroCuotas) * 100) : 0,
    }))
    .sort((a, b) => b.progreso - a.progreso)
    .slice(0, 5)

  // === 11. Alertas críticas detectadas ===
  const alertas: Array<{ severidad: string; titulo: string; descripcion: string; monto?: number }> = []

  // Mora crítica (>= 60 días)
  const moraCritica = morosos.filter((m) => m.diasMora >= 60)
  if (moraCritica.length > 0) {
    alertas.push({
      severidad: 'CRITICA',
      titulo: `🚨 ${moraCritica.length} cliente(s) con mora crítica (60+ días)`,
      descripcion: `Total mora crítica: ${formatearMoneda(moraCritica.reduce((s, m) => s + m.saldoTotal, 0))}. Acción: escalar a jurídico.`,
      monto: moraCritica.reduce((s, m) => s + m.saldoTotal, 0),
    })
  }

  // Mora alta (30-59 días)
  const moraAlta = morosos.filter((m) => m.diasMora >= 30 && m.diasMora < 60)
  if (moraAlta.length > 0) {
    alertas.push({
      severidad: 'ALTA',
      titulo: `⚠️ ${moraAlta.length} cliente(s) con mora alta (30-59 días)`,
      descripcion: `Total: ${formatearMoneda(moraAlta.reduce((s, m) => s + m.saldoTotal, 0))}. Acción: última oportunidad de acuerdo.`,
    })
  }

  // Tasa de mora > 20%
  if (tasaMora > 20) {
    alertas.push({
      severidad: 'ALTA',
      titulo: `📊 Tasa de mora elevada (${tasaMora}%)`,
      descripcion: `Tu tasa de mora supera el 20%. Recomendado: revisar políticas de otorgamiento.`,
    })
  }

  // Disminución del recaudo (comparar hoy vs promedio semanal)
  if (recaudo.countSemanal > 0) {
    const promedioDiario = recaudo.semanal / 7
    if (recaudo.diario < promedioDiario * 0.5) {
      alertas.push({
        severidad: 'MEDIA',
        titulo: `📉 Recaudo diario por debajo del promedio`,
        descripcion: `Hoy: ${formatearMoneda(recaudo.diario)}. Promedio semanal: ${formatearMoneda(promedioDiario)}.`,
      })
    }
  }

  // Clientes reincidentes
  if (reincidentes.length > 0) {
    alertas.push({
      severidad: 'MEDIA',
      titulo: `🔁 ${reincidentes.length} cliente(s) reincidente(s) en mora`,
      descripcion: `Clientes con más de un préstamo en mora. Considerar restricción de nuevos créditos.`,
    })
  }

  // === 12. Resumen ejecutivo ===
  const resumen = {
    fecha: ahora.toISOString(),
    totalPrestamos,
    totalActivos,
    totalPendientes,
    totalAlDia,
    totalMora,
    totalJuridico,
    tasaMora,
    tasaRecuperacion,
    promedioDiasMora,
    capitalPendiente: sumaSaldos,
    capitalPrestado: capitalPrestadoTotal,
    capitalRecuperado,
    interesCorrientePendiente: sumaInteresCorriente,
    moraAcumulada: sumaMoraAcumulada,
    recaudoDiario: recaudo.diario,
    recaudoSemanal: recaudo.semanal,
    recaudoMensual: recaudo.mensual,
    recaudoAnual: recaudo.anual,
    vencenHoy: vencenHoy.length,
    vencenProximos7: vencenProximos7.length,
    countMorosos: morosos.length,
    countReincidentes: reincidentes.length,
    countAlertas: alertas.length,
  }

  return {
    resumen,
    morosos,
    vencenHoy: vencenHoy.map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      montoCuota: p.montoCuota || 0,
      saldoTotal: p.saldoTotal || 0,
    })),
    vencenProximos7: vencenProximos7.map((p) => ({
      codigo: p.codigo,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      montoCuota: p.montoCuota || 0,
      fechaVencimiento: p.fechaVencimiento,
    })),
    recaudo,
    clientesAlDia,
    reincidentes,
    alertas,
  }
}

// =====================================================
// Generar resumen ejecutivo en texto
// =====================================================
export async function generarResumenEjecutivo() {
  const estado = await obtenerEstadoCartera()
  const r = estado.resumen

  let texto = `💼 RESUMEN EJECUTIVO DE CARTERA — ${new Date().toLocaleString('es-CO')}\n\n`

  texto += `═══ PANORAMA GENERAL ═══\n`
  texto += `Total préstamos: ${r.totalPrestamos}\n`
  texto += `• Activos: ${r.totalActivos}\n`
  texto += `• Pendientes: ${r.totalPendientes}\n`
  texto += `• Al día: ${r.totalAlDia}\n`
  texto += `• En mora: ${r.totalMora} (${r.tasaMora}%)\n`
  texto += `• En jurídico: ${r.totalJuridico}\n\n`

  texto += `═══ INDICADORES FINANCIEROS ═══\n`
  texto += `Capital prestado: ${formatearMoneda(r.capitalPrestado)}\n`
  texto += `Capital recuperado: ${formatearMoneda(r.capitalRecuperado)} (${r.tasaRecuperacion}%)\n`
  texto += `Capital pendiente: ${formatearMoneda(r.capitalPendiente)}\n`
  texto += `Interés corriente pendiente: ${formatearMoneda(r.interesCorrientePendiente)}\n`
  texto += `Mora acumulada: ${formatearMoneda(r.moraAcumulada)}\n\n`

  texto += `═══ RECAUDO ═══\n`
  texto += `Hoy: ${formatearMoneda(r.recaudoDiario)} (${estado.recaudo.countDiario} pagos)\n`
  texto += `Semana: ${formatearMoneda(r.recaudoSemanal)} (${estado.recaudo.countSemanal} pagos)\n`
  texto += `Mes: ${formatearMoneda(r.recaudoMensual)} (${estado.recaudo.countMensual} pagos)\n`
  texto += `Año: ${formatearMoneda(r.recaudoAnual)} (${estado.recaudo.countAnual} pagos)\n\n`

  texto += `═══ VENCIMIENTOS ═══\n`
  texto += `Vencen hoy: ${r.vencenHoy}\n`
  texto += `Vencen en 7 días: ${r.vencenProximos7}\n\n`

  texto += `═══ MORA ═══\n`
  texto += `Clientes en mora: ${r.countMorosos}\n`
  texto += `Promedio días mora: ${r.promedioDiasMora}\n`
  texto += `Reincidentes: ${r.countReincidentes}\n\n`

  if (estado.alertas.length > 0) {
    texto += `═══ ALERTAS (${estado.alertas.length}) ═══\n`
    estado.alertas.forEach((a, i) => {
      texto += `${i + 1}. [${a.severidad}] ${a.titulo}\n   ${a.descripcion}\n\n`
    })
  }

  if (estado.morosos.length > 0) {
    texto += `═══ TOP 5 MOROSOS ═══\n`
    estado.morosos.slice(0, 5).forEach((m, i) => {
      texto += `${i + 1}. ${m.cliente} (${m.diasMora} días) — ${formatearMoneda(m.saldoTotal)} [${m.severidad}]\n`
      texto += `   Acción: ${m.accionRecomendada}\n`
    })
  }

  return texto
}

// =====================================================
// Generar análisis estratégico con recomendaciones
// =====================================================
export async function generarAnalisisEstrategico() {
  const estado = await obtenerEstadoCartera()
  const r = estado.resumen

  let texto = `📊 ANÁLISIS ESTRATÉGICO DE CARTERA\n\n`

  texto += `═══ DIAGNÓSTICO ═══\n`
  if (r.tasaMora < 10) {
    texto += `🟢 Cartera saludable (mora ${r.tasaMora}%)\n`
  } else if (r.tasaMora < 20) {
    texto += `🟡 Cartera con atención (mora ${r.tasaMora}%)\n`
  } else {
    texto += `🔴 Cartera en riesgo (mora ${r.tasaMora}%)\n`
  }
  texto += `Tasa de recuperación: ${r.tasaRecuperacion}%\n`
  texto += `Promedio días mora: ${r.promedioDiasMora}\n\n`

  texto += `═══ PRIORIDADES ═══\n`
  let prioridad = 1
  if (estado.alertas.some((a) => a.severidad === 'CRITICA')) {
    texto += `${prioridad}. 🔴 Atender mora crítica (60+ días) — escalar a jurídico\n`
    prioridad++
  }
  if (r.vencenHoy > 0) {
    texto += `${prioridad}. 📞 Contactar ${r.vencenHoy} cliente(s) con vencimiento hoy\n`
    prioridad++
  }
  if (r.tasaMora > 20) {
    texto += `${prioridad}. ⚠️ Revisar políticas de otorgamiento (mora > 20%)\n`
    prioridad++
  }
  if (estado.reincidentes.length > 0) {
    texto += `${prioridad}. 🔁 Restringir nuevos créditos a ${estado.reincidentes.length} reincidente(s)\n`
    prioridad++
  }
  if (estado.alertas.some((a) => a.severidad === 'ALTA')) {
    texto += `${prioridad}. 🟡 Negociar acuerdos de pago con mora alta (30-59 días)\n`
    prioridad++
  }

  texto += `\n══️ RECOMENDACIONES ═══\n`
  texto += `1. Enviar recordatorios WhatsApp a ${r.vencenProximos7} cliente(s) con vencimiento en 7 días\n`
  texto += `2. Ofrecer refinanciación a mora 15-29 días\n`
  texto += `3. Reconocer a ${estado.clientesAlDia.length} cliente(s) con excelente comportamiento\n`
  texto += `4. Monitorear recaudo diario vs promedio semanal\n`

  texto += `\n═══ PROYECCIÓN 30/60/90 DÍAS ═══\n`
  if (r.recaudoMensual > 0) {
    const proy30 = r.recaudoMensual / 30 * 30
    const proy60 = r.recaudoMensual / 30 * 60
    const proy90 = r.recaudoMensual / 30 * 90
    texto += `Si mantienes ritmo actual:\n`
    texto += `• 30 días: ${formatearMoneda(proy30)} recaudo estimado\n`
    texto += `• 60 días: ${formatearMoneda(proy60)}\n`
    texto += `• 90 días: ${formatearMoneda(proy90)}\n`
  }

  return texto
}
