// =====================================================
// asistente-personal.ts — Lógica de finanzas del bot Asistente Personal
// Funciones: clasificar, registrar, balance, presupuestos, metas, alertas
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// Clasificar automáticamente un mensaje en categoría
// =====================================================
export async function clasificarMovimiento(
  mensaje: string,
  tipo: 'INGRESO' | 'EGRESO',
  ambito: 'NEGOCIO' | 'PERSONAL'
): Promise<{ categoriaId: string | null; categoriaNombre: string; confianza: number }> {
  const mensajeLower = mensaje.toLowerCase()
  // Normalizar tipo: EGRESO → GASTO (en la BD está como GASTO)
  const tipoBD = tipo === 'EGRESO' ? 'GASTO' : 'INGRESO'
  const categorias = await db.categoriaFinanciera.findMany({
    where: { activa: true, tipo: tipoBD, OR: [{ ambito }, { ambito: 'AMBOS' }] },
  })

  let mejorMatch: { categoriaId: string; categoriaNombre: string; confianza: number } | null = null

  for (const cat of categorias) {
    const keywords = (cat.keywords || '').toLowerCase().split(',').map((k) => k.trim()).filter(Boolean)
    for (const kw of keywords) {
      if (mensajeLower.includes(kw)) {
        // Coincidencia más larga = más confianza
        const confianza = kw.length
        if (!mejorMatch || confianza > mejorMatch.confianza) {
          mejorMatch = { categoriaId: cat.id, categoriaNombre: cat.nombre, confianza }
        }
      }
    }
  }

  if (mejorMatch) return { ...mejorMatch, confianza: mejorMatch.confianza }
  // Fallback a "Otros"
  const otros = categorias.find((c) => c.nombre.toLowerCase().includes('otros'))
  return {
    categoriaId: otros?.id || null,
    categoriaNombre: otros?.nombre || 'Sin clasificar',
    confianza: 0,
  }
}

// =====================================================
// Registrar un movimiento financiero (gasto o ingreso)
// =====================================================
export async function registrarMovimiento(params: {
  tipo: 'INGRESO' | 'EGRESO'
  monto: number
  concepto: string
  ambito: 'NEGOCIO' | 'PERSONAL'
  categoriaId?: string
  usuarioId?: string
  usuarioNombre?: string
}): Promise<{ success: boolean; movimientoId?: string; categoriaNombre?: string; mensaje: string }> {
  try {
    // Buscar caja menor existente (la más reciente)
    const caja = await db.cajaMenor.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!caja) {
      return {
        success: false,
        mensaje: 'No hay una caja menor configurada. Ve a Admin → Caja Menor y crea una primero.',
      }
    }

    // Clasificar si no se provee categoría
    let categoriaId: string | undefined = params.categoriaId || undefined
    let categoriaNombre = 'Sin clasificar'
    if (!categoriaId) {
      const clasif = await clasificarMovimiento(params.concepto, params.tipo, params.ambito)
      categoriaId = clasif.categoriaId || undefined
      categoriaNombre = clasif.categoriaNombre
    } else {
      const cat = await db.categoriaFinanciera.findUnique({ where: { id: categoriaId } })
      categoriaNombre = cat?.nombre || 'Sin clasificar'
    }

    // Crear movimiento en Caja
    const movimiento = await db.movimientoCaja.create({
      data: {
        cajaId: caja.id,
        tipo: params.tipo,
        monto: params.monto,
        concepto: `${params.concepto} (Asistente Personal)`,
        fechaMovimiento: new Date(),
        creadoPor: params.usuarioNombre || 'Asistente Personal',
      },
    })

    // Crear registro extendido con ámbito + categoría
    await db.movimientoCajaExtendido.create({
      data: {
        movimientoId: movimiento.id,
        ambito: params.ambito,
        categoriaId: categoriaId || null,
        subcategoria: params.concepto.slice(0, 100),
      },
    })

    return {
      success: true,
      movimientoId: movimiento.id,
      categoriaNombre,
      mensaje: `Movimiento registrado en caja "${caja.nombre}".`,
    }
  } catch (e: any) {
    return { success: false, mensaje: `Error: ${e.message}` }
  }
}

// =====================================================
// Obtener dashboard financiero con KPIs
// =====================================================
export async function obtenerDashboard(ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS', periodoDias: number = 30) {
  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - periodoDias)

  // Obtener movimientos del período con su extensión
  const movimientos = await db.movimientoCaja.findMany({
    where: { fechaMovimiento: { gte: fechaInicio } },
    include: { movimientoCajaExtendido: true },
  })

  // Filtrar por ámbito
  const filtrados = ambito === 'AMBOS'
    ? movimientos
    : movimientos.filter((m) => m.movimientoCajaExtendido?.ambito === ambito)

  const ingresos = filtrados.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const gastos = filtrados.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
  const balance = ingresos - gastos
  const capacidadAhorro = ingresos > 0 ? Math.round((balance / ingresos) * 100) : 0
  const nivelEndeudamiento = ingresos > 0 ? Math.round((gastos / ingresos) * 100) : 0

  // Top categorías de gasto
  const gastosPorCategoria: Record<string, number> = {}
  filtrados
    .filter((m) => m.tipo === 'EGRESO' && m.movimientoCajaExtendido?.categoriaId)
    .forEach((m) => {
      const catId = m.movimientoCajaExtendido!.categoriaId!
      gastosPorCategoria[catId] = (gastosPorCategoria[catId] || 0) + m.monto
    })

  // Buscar nombres de categorías
  const categoriaIds = Object.keys(gastosPorCategoria)
  const categorias = categoriaIds.length > 0
    ? await db.categoriaFinanciera.findMany({ where: { id: { in: categoriaIds } } })
    : []

  const topGastos = Object.entries(gastosPorCategoria)
    .map(([catId, monto]) => ({
      categoria: categorias.find((c) => c.id === catId)?.nombre || 'Sin categoría',
      icono: categorias.find((c) => c.id === catId)?.icono || '📦',
      monto,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)

  // Metas activas
  const metas = ambito === 'AMBOS'
    ? await db.metaFinanciera.findMany({ where: { estado: 'ACTIVA' } })
    : await db.metaFinanciera.findMany({ where: { estado: 'ACTIVA', ambito } })

  const totalMetasObjetivo = metas.reduce((s, m) => s + m.montoObjetivo, 0)
  const totalMetasActual = metas.reduce((s, m) => s + m.montoActual, 0)
  const cumplimientoMetas = totalMetasObjetivo > 0
    ? Math.round((totalMetasActual / totalMetasObjetivo) * 100)
    : 0

  // Presupuestos
  const presupuestos = ambito === 'AMBOS'
    ? await db.presupuesto.findMany({ where: { activo: true } })
    : await db.presupuesto.findMany({ where: { activo: true, ambito } })

  return {
    periodo: { dias: periodoDias, desde: fechaInicio.toISOString() },
    kpis: {
      ingresos,
      gastos,
      balance,
      capacidadAhorro,
      nivelEndeudamiento,
      totalMovimientos: filtrados.length,
      cumplimientoMetas,
      totalMetas: metas.length,
      totalPresupuestos: presupuestos.length,
    },
    topGastos,
    metas: metas.map((m) => ({
      nombre: m.nombre,
      objetivo: m.montoObjetivo,
      actual: m.montoActual,
      progreso: m.montoObjetivo > 0 ? Math.round((m.montoActual / m.montoObjetivo) * 100) : 0,
      plazo: m.plazo,
    })),
    presupuestos: presupuestos.map((p) => {
      // Calcular gasto actual del presupuesto
      const movsPresupuesto = filtrados.filter((m) =>
        m.tipo === 'EGRESO' &&
        m.movimientoCajaExtendido?.categoriaId === p.categoriaId
      )
      const gastado = movsPresupuesto.reduce((s, m) => s + m.monto, 0)
      return {
        nombre: p.nombre,
        limite: p.montoLimite,
        gastado,
        restante: p.montoLimite - gastado,
        porcentaje: p.montoLimite > 0 ? Math.round((gastado / p.montoLimite) * 100) : 0,
      }
    }),
  }
}

// =====================================================
// Crear presupuesto
// =====================================================
export async function crearPresupuesto(params: {
  nombre: string
  ambito: 'NEGOCIO' | 'PERSONAL'
  montoLimite: number
  categoriaId?: string
  periodo?: 'MENSUAL' | 'SEMANAL' | 'ANUAL'
  alertaEnPorcentaje?: number
  creadoPor?: string
}) {
  const fechaInicio = new Date()
  const fechaFin = new Date()
  if ((params.periodo || 'MENSUAL') === 'MENSUAL') fechaFin.setMonth(fechaFin.getMonth() + 1)
  else if (params.periodo === 'SEMANAL') fechaFin.setDate(fechaFin.getDate() + 7)
  else if (params.periodo === 'ANUAL') fechaFin.setFullYear(fechaFin.getFullYear() + 1)

  const presupuesto = await db.presupuesto.create({
    data: {
      nombre: params.nombre,
      ambito: params.ambito,
      montoLimite: params.montoLimite,
      categoriaId: params.categoriaId || null,
      periodo: params.periodo || 'MENSUAL',
      fechaInicio,
      fechaFin,
      alertaEnPorcentaje: params.alertaEnPorcentaje || 80,
      creadoPor: params.creadoPor || 'Asistente Personal',
    },
  })

  return presupuesto
}

// =====================================================
// Crear meta financiera
// =====================================================
export async function crearMeta(params: {
  nombre: string
  tipo: string
  ambito: 'NEGOCIO' | 'PERSONAL'
  montoObjetivo: number
  fechaObjetivo?: Date
  plazo?: 'CORTO' | 'MEDIANO' | 'LARGO'
  descripcion?: string
  creadoPor?: string
}) {
  const meta = await db.metaFinanciera.create({
    data: {
      nombre: params.nombre,
      tipo: params.tipo,
      ambito: params.ambito,
      montoObjetivo: params.montoObjetivo,
      montoActual: 0,
      fechaObjetivo: params.fechaObjetivo || null,
      plazo: params.plazo || null,
      descripcion: params.descripcion || null,
      creadoPor: params.creadoPor || 'Asistente Personal',
      estado: 'ACTIVA',
    },
  })

  return meta
}

// =====================================================
// Detectar alertas inteligentes
// =====================================================
export async function detectarAlertas(ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS') {
  const alertas: Array<{
    tipo: string
    severidad: string
    titulo: string
    descripcion: string
    montoInvolucrado?: number
  }> = []

  const dashboard = await obtenerDashboard(ambito, 30)

  // 1. Riesgo de iliquidez (gastos > ingresos)
  if (dashboard.kpis.balance < 0) {
    alertas.push({
      tipo: 'RIESGO_LIQUIDEZ',
      severidad: 'CRITICAL',
      titulo: '⚠️ Riesgo de iliquidez',
      descripcion: `En los últimos 30 días tus gastos (${formatearMoneda(dashboard.kpis.gastos)}) superan tus ingresos (${formatearMoneda(dashboard.kpis.ingresos)}). Balance negativo: ${formatearMoneda(dashboard.kpis.balance)}.`,
      montoInvolucrado: Math.abs(dashboard.kpis.balance),
    })
  }

  // 2. Endeudamiento elevado (>80%)
  if (dashboard.kpis.nivelEndeudamiento > 80) {
    alertas.push({
      tipo: 'ENDEUDAMIENTO_ALTO',
      severidad: 'WARNING',
      titulo: '📊 Endeudamiento elevado',
      descripcion: `Tu nivel de endeudamiento es del ${dashboard.kpis.nivelEndeudamiento}% (gastos/ingresos). Se recomienda mantenerlo por debajo del 70%.`,
    })
  }

  // 3. Presupuestos excedidos
  dashboard.presupuestos
    .filter((p) => p.porcentaje >= 100)
    .forEach((p) => {
      alertas.push({
        tipo: 'PRESUPUESTO_EXCEDIDO',
        severidad: 'CRITICAL',
        titulo: `🚨 Presupuesto excedido: ${p.nombre}`,
        descripcion: `Has gastado ${formatearMoneda(p.gastado)} de un límite de ${formatearMoneda(p.limite)} (${p.porcentaje}%).`,
        montoInvolucrado: p.gastado - p.limite,
      })
    })

  // 4. Presupuestos cerca del límite (80-99%)
  dashboard.presupuestos
    .filter((p) => p.porcentaje >= 80 && p.porcentaje < 100)
    .forEach((p) => {
      alertas.push({
        tipo: 'PRESUPUESTO_CERCA_LIMITE',
        severidad: 'WARNING',
        titulo: `⚠️ Presupuesto cerca del límite: ${p.nombre}`,
        descripcion: `Has gastado el ${p.porcentaje}% del presupuesto (${formatearMoneda(p.gastado)} de ${formatearMoneda(p.limite)}).`,
      })
    })

  // 5. Gasto excesivo en una categoría (>30% de gastos totales)
  if (dashboard.topGastos.length > 0 && dashboard.kpis.gastos > 0) {
    const top = dashboard.topGastos[0]
    const porcentajeTop = Math.round((top.monto / dashboard.kpis.gastos) * 100)
    if (porcentajeTop > 30) {
      alertas.push({
        tipo: 'GASTO_EXCESIVO',
        severidad: 'WARNING',
        titulo: `${top.icono} Gasto concentrado en ${top.categoria}`,
        descripcion: `La categoría "${top.categoria}" representa el ${porcentajeTop}% de tus gastos (${formatearMoneda(top.monto)}). Considera revisar y diversificar.`,
        montoInvolucrado: top.monto,
      })
    }
  }

  // 6. Sin ahorro (capacidadAhorro < 10%)
  if (dashboard.kpis.capacidadAhorro < 10 && dashboard.kpis.ingresos > 0) {
    alertas.push({
      tipo: 'OPORTUNIDAD_AHORRO',
      severidad: 'INFO',
      titulo: '💡 Oportunidad de ahorro',
      descripcion: `Tu capacidad de ahorro es del ${dashboard.kpis.capacidadAhorro}%. Se recomienda ahorrar al menos 10-20% de los ingresos.`,
    })
  }

  // Guardar alertas en BD
  for (const a of alertas) {
    await db.alertaFinanciera.create({
      data: {
        tipo: a.tipo,
        ambito,
        severidad: a.severidad,
        titulo: a.titulo,
        descripcion: a.descripcion,
        montoInvolucrado: a.montoInvolucrado || null,
      },
    })
  }

  return alertas
}

// =====================================================
// Generar reporte por período
// =====================================================
export async function generarReporte(
  ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS',
  periodo: 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'ANUAL'
) {
  let dias = 1
  if (periodo === 'SEMANAL') dias = 7
  else if (periodo === 'MENSUAL') dias = 30
  else if (periodo === 'ANUAL') dias = 365

  const dashboard = await obtenerDashboard(ambito, dias)

  let tituloPeriodo = ''
  if (periodo === 'DIARIO') tituloPeriodo = ` Hoy (${new Date().toLocaleDateString('es-CO')})`
  else if (periodo === 'SEMANAL') tituloPeriodo = ' Últimos 7 días'
  else if (periodo === 'MENSUAL') tituloPeriodo = ' Últimos 30 días'
  else if (periodo === 'ANUAL') tituloPeriodo = ' Últimos 365 días'

  const k = dashboard.kpis
  let reporte = `📊 REPORTE FINANCIERO${tituloPeriodo} — Ámbito: ${ambito}\n\n`
  reporte += `═══ RESUMEN ═══\n`
  reporte += `Ingresos: ${formatearMoneda(k.ingresos)}\n`
  reporte += `Gastos:   ${formatearMoneda(k.gastos)}\n`
  reporte += `Balance:  ${formatearMoneda(k.balance)} ${k.balance >= 0 ? '✅' : '⚠️'}\n`
  reporte += `Capacidad de ahorro: ${k.capacidadAhorro}%\n`
  reporte += `Nivel endeudamiento: ${k.nivelEndeudamiento}%\n`
  reporte += `Movimientos: ${k.totalMovimientos}\n\n`

  if (dashboard.topGastos.length > 0) {
    reporte += `═══ TOP GASTOS ═══\n`
    dashboard.topGastos.forEach((g, i) => {
      reporte += `${i + 1}. ${g.icono} ${g.categoria}: ${formatearMoneda(g.monto)}\n`
    })
    reporte += '\n'
  }

  if (dashboard.metas.length > 0) {
    reporte += `═══ METAS ACTIVAS (${dashboard.metas.length}) ═══\n`
    dashboard.metas.forEach((m) => {
      reporte += `• ${m.nombre}: ${formatearMoneda(m.actual)} / ${formatearMoneda(m.objetivo)} (${m.progreso}%)\n`
    })
    reporte += '\n'
  }

  if (dashboard.presupuestos.length > 0) {
    reporte += `═══ PRESUPUESTOS (${dashboard.presupuestos.length}) ═══\n`
    dashboard.presupuestos.forEach((p) => {
      const emoji = p.porcentaje >= 100 ? '🚨' : p.porcentaje >= 80 ? '⚠️' : '✅'
      reporte += `${emoji} ${p.nombre}: ${formatearMoneda(p.gastado)}/${formatearMoneda(p.limite)} (${p.porcentaje}%)\n`
    })
  }

  return reporte
}
