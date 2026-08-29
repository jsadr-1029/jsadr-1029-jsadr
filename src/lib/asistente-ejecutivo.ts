// =====================================================
// asistente-ejecutivo.ts — Chief of Staff Digital
// Integra datos de TODOS los módulos para análisis consolidado
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'
import { obtenerEstadoModuloPrestamos } from '@/lib/asistente-prestamos'
import { obtenerEstadoCartera } from '@/lib/asistente-cobros'
import { obtenerDashboard } from '@/lib/asistente-personal'
import { obtenerEstadoModuloJuridico } from '@/lib/asesor-juridico'
import { auditarSistema } from '@/lib/ciberseguridad'

// =====================================================
// Obtener dashboard consolidado de TODOS los módulos
// =====================================================
export async function obtenerDashboardConsolidado() {
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0)
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)

  // === Ejecutar todas las consultas en paralelo ===
  const [
    estadoPrestamos,
    estadoCartera,
    dashboardNegocio,
    dashboardPersonal,
    estadoJuridico,
    estadoSeguridad,
    totalClientes,
    clientesNuevosMes,
    clientesNuevosMesAnterior,
    pagosMesActual,
    pagosMesAnterior,
    pagosAnioActual,
  ] = await Promise.all([
    obtenerEstadoModuloPrestamos(),
    obtenerEstadoCartera(),
    obtenerDashboard('NEGOCIO', 30),
    obtenerDashboard('PERSONAL', 30),
    obtenerEstadoModuloJuridico(),
    auditarSistema(),
    db.cliente.count(),
    db.cliente.count({ where: { createdAt: { gte: inicioMes } } }),
    db.cliente.count({ where: { createdAt: { gte: inicioMesAnterior, lte: finMesAnterior } } }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioMes } },
      select: { montoTotal: true, montoInteres: true, montoMora: true },
    }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioMesAnterior, lte: finMesAnterior } },
      select: { montoTotal: true, montoInteres: true, montoMora: true },
    }),
    db.pago.findMany({
      where: { estado: 'APLICADO', fechaPago: { gte: inicioAnio } },
      select: { montoTotal: true, montoInteres: true, montoMora: true },
    }),
  ])

  // === Calcular KPIs consolidados ===
  const recaudoMes = pagosMesActual.reduce((s, p) => s + (p.montoTotal || 0), 0)
  const recaudoMesAnterior = pagosMesAnterior.reduce((s, p) => s + (p.montoTotal || 0), 0)
  const recaudoAnio = pagosAnioActual.reduce((s, p) => s + (p.montoTotal || 0), 0)
  const utilidadMes = pagosMesActual.reduce((s, p) => s + (p.montoInteres || 0) + (p.montoMora || 0), 0)
  const utilidadAnio = pagosAnioActual.reduce((s, p) => s + (p.montoInteres || 0) + (p.montoMora || 0), 0)

  // === Crecimientos ===
  const crecimientoRecaudo = recaudoMesAnterior > 0
    ? Math.round(((recaudoMes - recaudoMesAnterior) / recaudoMesAnterior) * 100)
    : 0
  const crecimientoClientes = clientesNuevosMesAnterior > 0
    ? Math.round(((clientesNuevosMes - clientesNuevosMesAnterior) / clientesNuevosMesAnterior) * 100)
    : 0

  // === Detección de anomalías ===
  const anomalias: Array<{ tipo: string; severidad: string; titulo: string; descripcion: string }> = []

  // 1. Caída de recaudo (>20%)
  if (crecimientoRecaudo < -20) {
    anomalias.push({
      tipo: 'CAIDA_RECAUDO',
      severidad: 'ALTA',
      titulo: `📉 Caída de recaudo del ${Math.abs(crecimientoRecaudo)}%`,
      descripcion: `Recaudo mes actual: ${formatearMoneda(recaudoMes)} vs anterior: ${formatearMoneda(recaudoMesAnterior)}.`,
    })
  }

  // 2. Pico de mora (>25%)
  if (estadoCartera.resumen.tasaMora > 25) {
    anomalias.push({
      tipo: 'PICO_MORA',
      severidad: 'ALTA',
      titulo: `⚠️ Tasa de mora elevada (${estadoCartera.resumen.tasaMora}%)`,
      descripcion: `${estadoCartera.resumen.totalMora} solicitudes en mora de ${estadoCartera.resumen.totalActivos} activos.`,
    })
  }

  // 3. Caída de nuevos clientes
  if (crecimientoClientes < -30 && clientesNuevosMesAnterior > 0) {
    anomalias.push({
      tipo: 'CAIDA_CLIENTES',
      severidad: 'MEDIA',
      titulo: `📉 Caída de nuevos clientes (${crecimientoClientes}%)`,
      descripcion: `${clientesNuevosMes} nuevos este mes vs ${clientesNuevosMesAnterior} el mes anterior.`,
    })
  }

  // 4. Concentración de cartera
  if (estadoPrestamos.porCategoria.length === 1) {
    anomalias.push({
      tipo: 'CONCENTRACION_CARTERA',
      severidad: 'MEDIA',
      titulo: '🎯 Concentración de cartera en una sola categoría',
      descripcion: 'Diversificar reduce el riesgo.',
    })
  }

  // 5. Riesgos de seguridad
  if (estadoSeguridad.resumen.hallazgosCriticos > 0) {
    anomalias.push({
      tipo: 'RIESGO_SEGURIDAD',
      severidad: 'CRITICA',
      titulo: `🔴 ${estadoSeguridad.resumen.hallazgosCriticos} hallazgo(s) crítico(s) de seguridad`,
      descripcion: 'Atender inmediatamente para evitar incidentes.',
    })
  }

  // 6. Balance negativo personal
  if (dashboardPersonal.kpis.balance < 0) {
    anomalias.push({
      tipo: 'BALANCE_NEGATIVO_PERSONAL',
      severidad: 'MEDIA',
      titulo: '🔴 Balance personal negativo',
      descripcion: `Tus gastos personales superan tus ingresos en ${formatearMoneda(Math.abs(dashboardPersonal.kpis.balance))}.`,
    })
  }

  // 7. Sin backups recientes
  if (estadoSeguridad.resumen.backups30dias === 0) {
    anomalias.push({
      tipo: 'SIN_BACKUPS',
      severidad: 'ALTA',
      titulo: '💾 Sin backups en 30 días',
      descripcion: 'Riesgo de pérdida de datos.',
    })
  }

  // === Oportunidades detectadas ===
  const oportunidades: Array<{ tipo: string; titulo: string; descripcion: string; impactoEstimado: string }> = []

  // 1. Clientes aptos para renovación
  if (estadoPrestamos.aptosRenovacion.length > 0) {
    oportunidades.push({
      tipo: 'RENOVACIONES',
      titulo: `🔄 ${estadoPrestamos.aptosRenovacion.length} cliente(s) apto(s) para renovación`,
      descripcion: 'Clientes al día con 70%+ pagado que pueden renovar',
      impactoEstimado: 'Aumento de capital colocado',
    })
  }

  // 2. Crecimiento de recaudo
  if (crecimientoRecaudo > 10) {
    oportunidades.push({
      tipo: 'CRECIMIENTO_RECAUDO',
      titulo: `📈 Crecimiento de recaudo del ${crecimientoRecaudo}%`,
      descripcion: 'Tendencia positiva, considerar expansión',
      impactoEstimado: 'Mayor liquidez para nuevos solicitudes',
    })
  }

  // 3. Buen comportamiento de pago
  if (estadoPrestamos.clientesBuenPagador.length > 0) {
    oportunidades.push({
      tipo: 'BUENOS_CLIENTES',
      titulo: `⭐ ${estadoPrestamos.clientesBuenPagador.length} cliente(s) con excelente pago`,
      descripcion: 'Considerar aumentar límites o pedir referidos',
      impactoEstimado: 'Crecimiento de cartera sana',
    })
  }

  // 4. Capacidad de ahorro
  if (dashboardNegocio.kpis.capacidadAhorro >= 20) {
    oportunidades.push({
      tipo: 'CAPACIDAD_AHORRO',
      titulo: `💰 Capacidad de ahorro del ${dashboardNegocio.kpis.capacidadAhorro}%`,
      descripcion: 'Considerar invertir el excedente o ampliar capital de trabajo',
      impactoEstimado: formatearMoneda(dashboardNegocio.kpis.balance) + ' disponibles',
    })
  }

  // === Resumen ejecutivo consolidado ===
  const resumen = {
    fecha: ahora.toISOString(),
    periodo: 'mes actual',
    // Financiero
    capitalPrestado: estadoPrestamos.resumen.capitalPrestado,
    capitalRecuperado: estadoPrestamos.resumen.capitalRecuperado,
    capitalPendiente: estadoPrestamos.resumen.capitalPendiente,
    utilidadMes,
    utilidadAnio,
    recaudoMes,
    recaudoMesAnterior,
    recaudoAnio,
    crecimientoRecaudo,
    rentabilidadPromedio: estadoPrestamos.resumen.rentabilidadPromedio,
    // Comercial
    totalClientes,
    clientesNuevosMes,
    clientesNuevosMesAnterior,
    crecimientoClientes,
    totalPrestamos: estadoPrestamos.resumen.totalPrestamos,
    prestamosActivos: estadoPrestamos.resumen.totalActivos,
    prestamosMora: estadoPrestamos.resumen.totalMora,
    tasaMora: estadoPrestamos.resumen.tasaMora,
    // Operativo
    casosJuridicos: estadoJuridico.resumen.casosActivos,
    candidatosJuridico: estadoJuridico.resumen.candidatosJuridico,
    hallazgosSeguridad: estadoSeguridad.resumen.totalHallazgos,
    hallazgosCriticos: estadoSeguridad.resumen.hallazgosCriticos,
    // Personal
    balancePersonal: dashboardPersonal.kpis.balance,
    capacidadAhorroPersonal: dashboardPersonal.kpis.capacidadAhorro,
    // Anomalías y oportunidades
    anomalias: anomalias.length,
    oportunidades: oportunidades.length,
  }

  return {
    resumen,
    anomalias,
    oportunidades,
    // Detalle por módulo
    modulos: {
      prestamos: estadoPrestamos.resumen,
      cobros: estadoCartera.resumen,
      finanzasNegocio: dashboardNegocio.kpis,
      finanzasPersonal: dashboardPersonal.kpis,
      juridico: estadoJuridico.resumen,
      seguridad: estadoSeguridad.resumen,
    },
  }
}

// =====================================================
// Generar dashboard ejecutivo en texto
// =====================================================
export async function generarDashboardEjecutivoConsolidado() {
  const data = await obtenerDashboardConsolidado()
  const r = data.resumen

  let texto = `🎯 DASHBOARD EJECUTIVO CONSOLIDADO — ${new Date().toLocaleString('es-CO')}\n\n`

  texto += `═══ RESUMEN EJECUTIVO ═══\n`
  texto += `📊 Período: mes actual\n\n`

  texto += `══️ FINANCIERO ═══\n`
  texto += `Capital prestado: ${formatearMoneda(r.capitalPrestado)}\n`
  texto += `Capital recuperado: ${formatearMoneda(r.capitalRecuperado)} (${data.modulos.prestamos.tasaRecuperacion}%)\n`
  texto += `Capital pendiente: ${formatearMoneda(r.capitalPendiente)}\n`
  texto += `Utilidad del mes: ${formatearMoneda(r.utilidadMes)}\n`
  texto += `Utilidad del año: ${formatearMoneda(r.utilidadAnio)}\n`
  texto += `Recaudo del mes: ${formatearMoneda(r.recaudoMes)} (${r.crecimientoRecaudo >= 0 ? '+' : ''}${r.crecimientoRecaudo}% vs mes anterior)\n`
  texto += `Recaudo del año: ${formatearMoneda(r.recaudoAnio)}\n`
  texto += `Rentabilidad promedio: ${r.rentabilidadPromedio}%\n\n`

  texto += `═══ COMERCIAL ═══\n`
  texto += `Total clientes: ${r.totalClientes}\n`
  texto += `Nuevos este mes: ${r.clientesNuevosMes} (${r.crecimientoClientes >= 0 ? '+' : ''}${r.crecimientoClientes}%)\n`
  texto += `Total solicitudes: ${r.totalPrestamos}\n`
  texto += `• Activos: ${r.prestamosActivos}\n`
  texto += `• En mora: ${r.prestamosMora} (${r.tasaMora}%)\n\n`

  texto += `═══ OPERATIVO ═══\n`
  texto += `Casos jurídicos activos: ${r.casosJuridicos}\n`
  texto += `Candidatos a jurídico: ${r.candidatosJuridico}\n`
  texto += `Hallazgos de seguridad: ${r.hallazgosSeguridad} (${r.hallazgosCriticos} críticos)\n\n`

  texto += `═══ PERSONAL ═══\n`
  texto += `Balance personal: ${formatearMoneda(r.balancePersonal)} ${r.balancePersonal >= 0 ? '✅' : '⚠️'}\n`
  texto += `Capacidad de ahorro personal: ${r.capacidadAhorroPersonal}%\n\n`

  if (data.anomalias.length > 0) {
    texto += `═══ ANOMALÍAS DETECTADAS (${data.anomalias.length}) ═══\n`
    data.anomalias.forEach((a, i) => {
      const emoji = a.severidad === 'CRITICA' ? '🔴' : a.severidad === 'ALTA' ? '🟠' : '🟡'
      texto += `${i + 1}. ${emoji} [${a.severidad}] ${a.titulo}\n   ${a.descripcion}\n\n`
    })
  }

  if (data.oportunidades.length > 0) {
    texto += `═══ OPORTUNIDADES (${data.oportunidades.length}) ═══\n`
    data.oportunidades.forEach((o, i) => {
      texto += `${i + 1}. ${o.titulo}\n   ${o.descripcion}\n   Impacto: ${o.impactoEstimado}\n\n`
    })
  }

  return texto
}

// =====================================================
// Generar análisis estratégico con recomendaciones
// =====================================================
export async function generarAnalisisEstrategicoConsolidado() {
  const data = await obtenerDashboardConsolidado()
  const r = data.resumen

  let texto = `🎯 ANÁLISIS ESTRATÉGICO — ${new Date().toLocaleString('es-CO')}\n\n`

  // Diagnóstico general
  texto += `═══ DIAGNÓSTICO GENERAL ═══\n`
  let estadoGeneral = '🟢 SALUDABLE'
  if (r.hallazgosCriticos > 0 || r.tasaMora > 30) estadoGeneral = '🔴 CRÍTICO'
  else if (data.anomalias.length > 2 || r.tasaMora > 20) estadoGeneral = '🟠 REQUIERE ATENCIÓN'
  else if (data.anomalias.length > 0) estadoGeneral = '🟡 ESTABLE CON ALERTAS'

  texto += `Estado: ${estadoGeneral}\n`
  texto += `Anomalías: ${data.anomalias.length}\n`
  texto += `Oportunidades: ${data.oportunidades.length}\n\n`

  // Análisis por área
  texto += `═══ ANÁLISIS POR ÁREA ═══\n\n`

  // 1. Finanzas
  texto += `💰 FINANZAS\n`
  texto += `• Utilidad mes: ${formatearMoneda(r.utilidadMes)}\n`
  texto += `• Crecimiento recaudo: ${r.crecimientoRecaudo >= 0 ? '📈' : '📉'} ${r.crecimientoRecaudo}%\n`
  texto += `• Rentabilidad: ${r.rentabilidadPromedio}%\n`
  if (r.crecimientoRecaudo < 0) {
    texto += `⚠️ Caída de recaudo — investigar causas y planificar recuperación.\n`
  } else {
    texto += `✅ Tendencia positiva de recaudo.\n`
  }
  texto += `\n`

  // 2. Comercial
  texto += `📊 COMERCIAL\n`
  texto += `• Clientes: ${r.totalClientes} (${r.clientesNuevosMes} nuevos, ${r.crecimientoClientes}%)\n`
  texto += `• Mora: ${r.tasaMora}%\n`
  if (r.tasaMora > 20) {
    texto += `⚠️ Mora elevada — revisar políticas de otorgamiento.\n`
  }
  texto += `\n`

  // 3. Operaciones
  texto += `⚙️ OPERACIONES\n`
  texto += `• Casos jurídicos: ${r.casosJuridicos}\n`
  texto += `• Candidatos a jurídico: ${r.candidatosJuridico}\n`
  if (r.candidatosJuridico > 0) {
    texto += `⚠️ ${r.candidatosJuridico} cliente(s) por escalar a jurídico.\n`
  }
  texto += `\n`

  // 4. Seguridad
  texto += `🛡️ SEGURIDAD\n`
  texto += `• Hallazgos: ${r.hallazgosSeguridad} (${r.hallazgosCriticos} críticos)\n`
  if (r.hallazgosCriticos > 0) {
    texto += `🔴 Atender hallazgos críticos inmediatamente.\n`
  }
  texto += `\n`

  // Prioridades
  texto += `═══ PRIORIDADES EJECUTIVAS ═══\n\n`

  let prioridad = 1
  // CRÍTICAS
  if (r.hallazgosCriticos > 0) {
    texto += `🔴 PRIORIDAD CRÍTICA\n`
    texto += `${prioridad}. Atender ${r.hallazgosCriticos} hallazgo(s) crítico(s) de seguridad\n`
    prioridad++
  }
  if (r.tasaMora > 30) {
    texto += `${prioridad}. Reducir mora crítica (${r.tasaMora}%) — plan de recuperación urgente\n`
    prioridad++
  }
  // ALTAS
  if (r.crecimientoRecaudo < -20) {
    texto += `🟠 PRIORIDAD ALTA\n`
    texto += `${prioridad}. Investigar caída de recaudo del ${Math.abs(r.crecimientoRecaudo)}%\n`
    prioridad++
  }
  if (r.candidatosJuridico > 0) {
    texto += `${prioridad}. Escalar ${r.candidatosJuridico} caso(s) a jurídico\n`
    prioridad++
  }
  // MEDIAS
  if (data.oportunidades.length > 0) {
    texto += `🟡 PRIORIDAD MEDIA\n`
    data.oportunidades.forEach((o) => {
      texto += `${prioridad}. ${o.titulo}\n   ${o.descripcion}\n`
      prioridad++
    })
  }

  // Recomendaciones estratégicas
  texto += `\n═══ RECOMENDACIONES ESTRATÉGICAS ═══\n`
  if (r.rentabilidadPromedio < 20) {
    texto += `• Considerar ajustar tasas para mejorar rentabilidad (actual: ${r.rentabilidadPromedio}%)\n`
  }
  if (r.capitalPendiente > r.capitalPrestado * 0.5) {
    texto += `• Fortalecer gestión de cobranza (capital pendiente: ${formatearMoneda(r.capitalPendiente)})\n`
  }
  if (data.modulos.prestamos.aptosRenovacion > 0) {
    texto += `• Contactar ${data.modulos.prestamos.aptosRenovacion} cliente(s) para renovación\n`
  }
  if (r.crecimientoClientes > 0 && r.crecimientoRecaudo > 0) {
    texto += `• Negocio en crecimiento — considerar expansión o nuevos productos\n`
  }
  texto += `• Implementar backups automáticos si no existen\n`
  texto += `• Revisar semanalmente KPIs consolidados\n`

  return texto
}
