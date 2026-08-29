// =====================================================
// asesor-juridico.ts — Asesor Jurídico Inteligente
// Función: gestionar módulo Jurídico + asesoría legal
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// Obtener estado completo del módulo jurídico
// =====================================================
export async function obtenerEstadoModuloJuridico() {
  const ahora = new Date()

  // === 1. Casos por estado ===
  const [
    totalCasos,
    casosPreJudicial,
    casosDemanda,
    casosEjecucion,
    casosCobroJudicial,
    casosConciliacion,
    casosSentencia,
    casosCerrados,
  ] = await Promise.all([
    db.casoJuridico.count(),
    db.casoJuridico.count({ where: { estado: 'PRE_JUDICIAL' } }),
    db.casoJuridico.count({ where: { estado: 'DEMANDA' } }),
    db.casoJuridico.count({ where: { estado: 'EJECUCION' } }),
    db.casoJuridico.count({ where: { estado: 'COBRO_JUDICIAL' } }),
    db.casoJuridico.count({ where: { estado: 'CONCILIACION' } }),
    db.casoJuridico.count({ where: { estado: 'SENTENCIA' } }),
    db.casoJuridico.count({ where: { estado: 'CERRADO' } }),
  ])

  // === 2. Casos activos con detalle ===
  const casosActivos = await db.casoJuridico.findMany({
    where: { estado: { not: 'CERRADO' } },
    include: {
      prestamo: {
        select: {
          codigo: true, saldoTotal: true, diasMora: true,
          cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // === 3. Monto total en cobro jurídico ===
  const montoTotalJuridico = casosActivos.reduce(
    (s, c) => s + (c.valorReclamado || c.prestamo?.saldoTotal || 0),
    0
  )

  // === 4. Alertas legales pendientes ===
  const alertasPendientes = await db.alertaLegal.findMany({
    where: { atendida: false },
    include: {
      caso: {
        select: {
          id: true, radicado: true,
          prestamo: { select: { cliente: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // === 5. Candidatos a jurídico (solicitudes con 60+ días mora sin caso jurídico) ===
  const prestamosMoraAlta = await db.prestamo.findMany({
    where: {
      estado: 'EN_MORA',
      diasMora: { gte: 60 },
      casoJuridico: { is: null },
    },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
    },
    orderBy: { diasMora: 'desc' },
  })

  const candidatosJuridico = prestamosMoraAlta.map((p) => ({
    prestamoId: p.id,
    codigo: p.codigo,
    cliente: p.cliente.nombre,
    cedula: p.cliente.cedula,
    telefono: p.cliente.telefono,
    diasMora: p.diasMora,
    saldoTotal: p.saldoTotal || 0,
    montoMora: p.montoMora || 0,
    severidad:
      p.diasMora >= 90 ? 'CRITICA' :
      p.diasMora >= 60 ? 'ALTA' : 'MEDIA',
    recomendacion:
      p.diasMora >= 90 ? 'DEMANDAR_INMEDIATAMENTE' :
      'INICIAR_PROCESO_PREJURIDICO',
  }))

  // === 6. Distribución por tipo de proceso ===
  const casosPorTipoRaw = await db.casoJuridico.findMany({
    where: { estado: { not: 'CERRADO' } },
    select: { tipoProceso: true },
  })
  const casosPorTipoMap: Record<string, number> = {}
  casosPorTipoRaw.forEach((c) => {
    const tipo = c.tipoProceso || 'SIN_TIPO'
    casosPorTipoMap[tipo] = (casosPorTipoMap[tipo] || 0) + 1
  })

  // === 7. Resumen ejecutivo ===
  const resumen = {
    fecha: ahora.toISOString(),
    totalCasos,
    casosActivos: totalCasos - casosCerrados,
    casosPreJudicial,
    casosDemanda,
    casosEjecucion,
    casosCobroJudicial,
    casosConciliacion,
    casosSentencia,
    casosCerrados,
    montoTotalJuridico,
    alertasPendientes: alertasPendientes.length,
    candidatosJuridico: candidatosJuridico.length,
  }

  return {
    resumen,
    casosActivos: casosActivos.map((c) => ({
      id: c.id,
      codigo: c.radicado || c.prestamo?.codigo || 'SIN-CODIGO',
      cliente: c.prestamo?.cliente?.nombre || 'N/A',
      cedula: c.prestamo?.cliente?.cedula,
      estado: c.estado,
      tipoProceso: c.tipoProceso,
      montoDemandado: c.valorReclamado || 0,
      abogado: c.abogadoNombre || 'Sin asignar',
      createdAt: c.createdAt,
      prestamo: c.prestamo ? {
        codigo: c.prestamo.codigo,
        saldoTotal: c.prestamo.saldoTotal,
        diasMora: c.prestamo.diasMora,
      } : null,
    })),
    alertasPendientes: alertasPendientes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      descripcion: a.descripcion,
      fecha: a.fechaAlerta,
      caso: a.caso ? {
        codigo: a.caso.radicado || 'SIN-RADICADO',
        cliente: a.caso.prestamo?.cliente?.nombre,
      } : null,
    })),
    candidatosJuridico,
    casosPorTipo: Object.entries(casosPorTipoMap).map(([tipo, count]) => ({ tipo, count })),
  }
}

// =====================================================
// Generar resumen ejecutivo del módulo jurídico en texto
// =====================================================
export async function generarResumenJuridico() {
  const estado = await obtenerEstadoModuloJuridico()
  const r = estado.resumen

  let texto = `⚖️ RESUMEN MÓDULO JURÍDICO — ${new Date().toLocaleString('es-CO')}\n\n`

  texto += `═══ PANORAMA GENERAL ═══\n`
  texto += `Total casos: ${r.totalCasos}\n`
  texto += `• Activos: ${r.casosActivos}\n`
  texto += `• Pre-judicial: ${r.casosPreJudicial}\n`
  texto += `• Demanda: ${r.casosDemanda}\n`
  texto += `• Ejecución: ${r.casosEjecucion}\n`
  texto += `• Cobro judicial: ${r.casosCobroJudicial}\n`
  texto += `• Conciliación: ${r.casosConciliacion}\n`
  texto += `• Sentencia: ${r.casosSentencia}\n`
  texto += `• Cerrados: ${r.casosCerrados}\n\n`

  texto += `═══ INDICADORES ═══\n`
  texto += `Monto total en cobro jurídico: ${formatearMoneda(r.montoTotalJuridico)}\n`
  texto += `Alertas pendientes: ${r.alertasPendientes}\n`
  texto += `Candidatos a jurídico: ${r.candidatosJuridico}\n\n`

  if (estado.casosPorTipo.length > 0) {
    texto += `═══ CASOS POR TIPO ═══\n`
    estado.casosPorTipo.forEach((c) => {
      texto += `• ${c.tipo}: ${c.count}\n`
    })
    texto += `\n`
  }

  if (estado.casosActivos.length > 0) {
    texto += `═══ CASOS ACTIVOS (top 10) ═══\n`
    estado.casosActivos.slice(0, 10).forEach((c, i) => {
      texto += `${i + 1}. ${c.codigo} — ${c.cliente}\n`
      texto += `   Estado: ${c.estado} | Tipo: ${c.tipoProceso || 'N/A'}\n`
      texto += `   Monto: ${formatearMoneda(c.montoDemandado)} | Abogado: ${c.abogado}\n\n`
    })
  }

  if (estado.alertasPendientes.length > 0) {
    texto += `═══ ALERTAS PENDIENTES ═══\n`
    estado.alertasPendientes.forEach((a, i) => {
      texto += `${i + 1}. ${a.tipo} — ${a.descripcion}\n`
      if (a.caso) texto += `   Caso: ${a.caso.codigo} (${a.caso.cliente})\n`
    })
    texto += `\n`
  }

  if (estado.candidatosJuridico.length > 0) {
    texto += `═══ CANDIDATOS A COBRO JURÍDICO (${estado.candidatosJuridico.length}) ═══\n`
    texto += `Solicitudes con 60+ días de mora sin caso jurídico:\n\n`
    estado.candidatosJuridico.forEach((c, i) => {
      texto += `${i + 1}. ${c.cliente} — ${c.diasMora} días mora [${c.severidad}]\n`
      texto += `   Saldo: ${formatearMoneda(c.saldoTotal)} | Mora: ${formatearMoneda(c.montoMora)}\n`
      texto += `   🎯 Recomendación: ${c.recomendacion}\n\n`
    })
  }

  return texto
}

// =====================================================
// Obtener detalle de un caso específico
// =====================================================
export async function obtenerDetalleCaso(casoId: string) {
  const caso = await db.casoJuridico.findUnique({
    where: { id: casoId },
    include: {
      prestamo: {
        select: {
          codigo: true, montoPrincipal: true, saldoTotal: true, diasMora: true, montoMora: true,
          cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true, direccion: true } },
        },
      },
      cronologias: { orderBy: { fecha: 'desc' }, take: 20 },
      documentos: { orderBy: { fechaSubida: 'desc' }, take: 10 },
      alertas: { where: { atendida: false }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!caso) return null

  return {
    caso: {
      id: caso.id,
      codigo: caso.radicado || caso.prestamo?.codigo || 'SIN-CODIGO',
      estado: caso.estado,
      tipoProceso: caso.tipoProceso,
      montoDemandado: caso.valorReclamado || 0,
      descripcion: caso.descripcion,
      juzgado: caso.juzgado,
      abogado: caso.abogadoNombre,
      createdAt: caso.createdAt,
      updatedAt: caso.updatedAt,
    },
    cliente: caso.prestamo?.cliente,
    prestamo: caso.prestamo ? {
      codigo: caso.prestamo.codigo,
      montoPrincipal: caso.prestamo.montoPrincipal,
      saldoTotal: caso.prestamo.saldoTotal,
      diasMora: caso.prestamo.diasMora,
      montoMora: caso.prestamo.montoMora,
    } : null,
    cronologia: caso.cronologias,
    documentos: caso.documentos,
    alertas: caso.alertas,
  }
}

// =====================================================
// Generar análisis jurídico de un caso
// =====================================================
export async function generarAnalisisCaso(casoId: string) {
  const detalle = await obtenerDetalleCaso(casoId)
  if (!detalle) return null

  const c = detalle.caso
  const cliente = detalle.cliente
  const prestamo = detalle.prestamo

  let texto = `⚖️ ANÁLISIS JURÍDICO DEL CASO\n\n`
  texto += `═══ INFORMACIÓN DEL CASO ═══\n`
  texto += `Código: ${c.codigo}\n`
  texto += `Estado: ${c.estado}\n`
  texto += `Tipo de proceso: ${c.tipoProceso || 'N/A'}\n`
  texto += `Monto demandado: ${formatearMoneda(c.montoDemandado)}\n`
  if (c.juzgado) texto += `Juzgado: ${c.juzgado}\n`
  if (c.abogado) texto += `Abogado: ${c.abogado}\n\n`

  if (cliente) {
    texto += `═══ CLIENTE ═══\n`
    texto += `Nombre: ${cliente.nombre || 'N/A'}\n`
    texto += `Cédula: ${cliente.cedula || 'N/A'}\n`
    texto += `Teléfono: ${cliente.telefono || 'N/A'}\n\n`
  }

  if (prestamo) {
    texto += `═══ SOLICITUD ═══\n`
    texto += `Código: ${prestamo.codigo}\n`
    texto += `Saldo total: ${formatearMoneda(prestamo.saldoTotal || 0)}\n`
    texto += `Días de mora: ${prestamo.diasMora}\n`
    texto += `Mora acumulada: ${formatearMoneda(prestamo.montoMora || 0)}\n\n`
  }

  // Análisis de viabilidad
  texto += `═══ ANÁLISIS DE VIABILIDAD ═══\n`
  if (prestamo && prestamo.diasMora >= 60) {
    texto += `✅ Viabilidad: ALTA — mora superior a 60 días justifica proceso ejecutivo.\n`
    texto += `📊 Fundamento: Art. 1551 Código Civil (incumplimiento de obligación).\n`
    texto += `⚖️ Proceso recomendado: ${prestamo.diasMora >= 90 ? 'Proceso Ejecutivo (Ley 1564/2012 art. 420)' : 'Cobro Prejurídico + Preparación de Demanda'}.\n\n`
  } else if (prestamo && prestamo.diasMora >= 30) {
    texto += `🟡 Viabilidad: MEDIA — mora intermedia, considerar acuerdo de pago primero.\n`
    texto += `📊 Recomendación: requerimiento prejurídico antes de demandar.\n\n`
  } else {
    texto += `🔴 Viabilidad: BAJA — mora insuficiente para proceso judicial.\n`
    texto += `📊 Recomendación: continuar cobro persuasivo.\n\n`
  }

  // Cronología
  if (detalle.cronologia.length > 0) {
    texto += `═══ CRONOLOGÍA (${detalle.cronologia.length} eventos) ═══\n`
    detalle.cronologia.slice(0, 10).forEach((e, i) => {
      texto += `${i + 1}. [${new Date(e.fecha).toLocaleDateString('es-CO')}] ${e.titulo}\n`
      if (e.descripcion) texto += `   ${e.descripcion}\n`
    })
    texto += `\n`
  }

  // Recomendaciones
  texto += `═══ RECOMENDACIONES ═══\n`
  if (c.estado === 'PRE_JUDICIAL') {
    texto += `1. Notificar al cliente (requerimiento de pago).\n2. Preparar demanda ejecutiva.\n3. Radicar ante juzgado competente.\n`
  } else if (c.estado === 'DEMANDA' || c.estado === 'EJECUCION') {
    texto += `1. Verificar emplazamiento del demandado.\n2. Solicitar medidas cautelares si aplica.\n3. Preparar pruebas documentales.\n`
  } else if (c.estado === 'SENTENCIA') {
    texto += `1. Solicitar ejecución de sentencia.\n2. Embargo de bienes si procede.\n3. Liquidación de costas.\n`
  } else {
    texto += `1. Revisar estado procesal.\n2. Actualizar cronología.\n3. Programar seguimiento.\n`
  }

  return texto
}
