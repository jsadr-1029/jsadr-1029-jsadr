// =====================================================
// asistente-personal-mejorado.ts
// Mejoras: categorización IA + memoria conversacional + análisis predictivo
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'
import { clasificarMovimiento, registrarMovimiento, obtenerDashboard, detectarAlertas, crearPresupuesto, crearMeta, generarReporte } from '@/lib/asistente-personal'

// =====================================================
// 1. CATEGORIZACIÓN CON IA
// Usa LLM para clasificar movimientos que la clasificación por
// keywords no puede resolver bien
// =====================================================
export async function clasificarConIA(
  concepto: string,
  tipo: 'INGRESO' | 'EGRESO',
  ambito: 'NEGOCIO' | 'PERSONAL'
): Promise<{ categoriaId: string | null; categoriaNombre: string; confianza: number; metodo: 'KEYWORDS' | 'IA' | 'FALLBACK' }> {
  // 1. Intentar primero con keywords (rápido)
  const resultadoKeywords = await clasificarMovimiento(concepto, tipo, ambito)
  if (resultadoKeywords.confianza > 0) {
    return { ...resultadoKeywords, metodo: 'KEYWORDS' }
  }

  // 2. Si keywords no encontró, usar IA (LLM)
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const categorias = await db.categoriaFinanciera.findMany({
      where: { activa: true, tipo: tipo === 'EGRESO' ? 'GASTO' : 'INGRESO' },
      select: { id: true, nombre: true, keywords: true },
    })

    const listaCategorias = categorias.map((c) => `- ${c.nombre}`).join('\n')

    const prompt = `Eres un clasificador de movimientos financieros. Dado un concepto de ${tipo === 'EGRESO' ? 'gasto' : 'ingreso'}, debes clasificarlo en UNA de estas categorías:

${listaCategorias}

Concepto a clasificar: "${concepto}"
Ámbito: ${ambito}

Responde SOLO con el nombre exacto de la categoría (sin comillas, sin explicación). Si ninguna categoría encaja, responde "Otros".`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: prompt },
        { role: 'user', content: concepto },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    })

    const respuesta = completion.choices?.[0]?.message?.content?.trim()

    if (respuesta) {
      // Buscar la categoría que coincida
      const categoriaEncontrada = categorias.find(
        (c) => c.nombre.toLowerCase() === respuesta.toLowerCase() ||
               c.nombre.toLowerCase().includes(respuesta.toLowerCase()) ||
               respuesta.toLowerCase().includes(c.nombre.toLowerCase())
      )

      if (categoriaEncontrada) {
        return {
          categoriaId: categoriaEncontrada.id,
          categoriaNombre: categoriaEncontrada.nombre,
          confianza: 0.8,
          metodo: 'IA',
        }
      }
    }
  } catch (e) {
    // Si la IA falla, continuar con fallback
  }

  // 3. Fallback: usar el resultado de keywords (que ya tiene "Otros")
  return { ...resultadoKeywords, metodo: 'FALLBACK' }
}

// =====================================================
// 2. MEMORIA CONVERSACIONAL
// Almacena contexto entre mensajes para conversaciones naturales
// =====================================================

interface MemoriaConversacion {
  ultimoMovimientoId?: string
  ultimoMovimientoTipo?: 'GASTO' | 'INGRESO'
  ultimoMovimientoMonto?: number
  ultimoMovimientoConcepto?: string
  ultimoMovimientoAmbito?: 'NEGOCIO' | 'PERSONAL'
  ultimoMovimientoCategoria?: string
  ultimoComando?: string
  ultimoResultado?: string
  // === Sistema de confirmación de ámbito ===
  pendienteConfirmarAmbito?: {
    tipo: 'GASTO' | 'INGRESO'
    monto: number
    concepto: string
    categoria?: string
    timestamp: number
  }
  timestamp: number
}

// Cache en memoria (en producción sería Redis o BD)
const memorias: Map<string, MemoriaConversacion> = new Map()

export function guardarMemoria(sessionId: string, memoria: Partial<MemoriaConversacion>) {
  const actual = memorias.get(sessionId) || { timestamp: Date.now() }
  memorias.set(sessionId, { ...actual, ...memoria, timestamp: Date.now() })
}

export function obtenerMemoria(sessionId: string): MemoriaConversacion | null {
  const memoria = memorias.get(sessionId)
  if (!memoria) return null
  // Expirar después de 30 minutos
  if (Date.now() - memoria.timestamp > 30 * 60 * 1000) {
    memorias.delete(sessionId)
    return null
  }
  return memoria
}

export function limpiarMemoria(sessionId: string) {
  memorias.delete(sessionId)
}

// =====================================================
// 3. ANÁLISIS PREDICTIVO
// Proyecciones a 30/60/90 días basadas en tendencia
// =====================================================
export async function generarAnalisisPredictivo(ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS') {
  const dashboard = ambito === 'AMBOS'
    ? await obtenerDashboard('NEGOCIO', 90)
    : await obtenerDashboard(ambito, 90)

  const k = dashboard.kpis
  const balance90dias = k.balance
  const balanceMensualEstimado = balance90dias / 3

  let texto = `🔮 ANÁLISIS PREDICTIVO — ${ambito}\n`
  texto += `Basado en últimos 90 días\n\n`

  texto += `═══ TENDENCIA ACTUAL ═══\n`
  texto += `Balance 90 días: ${formatearMoneda(balance90dias)}\n`
  texto += `Balance mensual promedio: ${formatearMoneda(balanceMensualEstimado)}\n`
  texto += `Capacidad de ahorro: ${k.capacidadAhorro}%\n`
  texto += `Nivel de endeudamiento: ${k.nivelEndeudamiento}%\n\n`

  texto += `══️ PROYECCIÓN 30 DÍAS ═══\n`
  const proy30 = balanceMensualEstimado
  texto += `Balance proyectado: ${formatearMoneda(proy30)} ${proy30 >= 0 ? '✅' : '⚠️'}\n`
  if (proy30 > 0) {
    texto += `Patrimonio proyectado: +${formatearMoneda(proy30)}\n`
  } else {
    texto += `Déficit proyectado: ${formatearMoneda(Math.abs(proy30))}\n`
  }
  texto += `\n`

  texto += `═══ PROYECCIÓN 60 DÍAS ═══\n`
  const proy60 = balanceMensualEstimado * 2
  texto += `Balance proyectado: ${formatearMoneda(proy60)} ${proy60 >= 0 ? '✅' : '⚠️'}\n\n`

  texto += `═══ PROYECCIÓN 90 DÍAS ═══\n`
  const proy90 = balanceMensualEstimado * 3
  texto += `Balance proyectado: ${formatearMoneda(proy90)} ${proy90 >= 0 ? '✅' : '⚠️'}\n\n`

  // Escenarios
  texto += `═══ ESCENARIOS ═══\n`
  texto += `Si mantienes ritmo actual:\n`
  texto += `• 6 meses: ${formatearMoneda(balanceMensualEstimado * 6)}\n`
  texto += `• 1 año: ${formatearMoneda(balanceMensualEstimado * 12)}\n\n`

  if (balanceMensualEstimado > 0) {
    texto += `Si recortas 15% de gastos:\n`
    const nuevoBalance = k.ingresos - k.gastos * 0.85
    texto += `• Ahorro extra/mes: ${formatearMoneda(nuevoBalance - balanceMensualEstimado)}\n`
    texto += `• 1 año: ${formatearMoneda(nuevoBalance * 12)}\n\n`
  }

  // Top gastos
  if (dashboard.topGastos.length > 0) {
    texto += `══️ TOP GASTOS (para optimizar) ═══\n`
    dashboard.topGastos.forEach((g, i) => {
      const pct = k.gastos > 0 ? Math.round((g.monto / k.gastos) * 100) : 0
      texto += `${i + 1}. ${g.icono} ${g.categoria}: ${formatearMoneda(g.monto)} (${pct}%)\n`
    })
    texto += `\n`
  }

  // Recomendaciones
  texto += `═══ RECOMENDACIONES ═══\n`
  if (balanceMensualEstimado < 0) {
    texto += `🔴 Tu balance mensual es NEGATIVO. Prioridad:\n`
    texto += `   1. Reducir gastos en ${dashboard.topGastos[0]?.categoria || 'tu categoría más alta'}\n`
    texto += `   2. Crear presupuesto mensual\n`
    texto += `   3. Buscar fuentes de ingreso adicionales\n`
  } else if (k.capacidadAhorro < 10) {
    texto += `🟡 Tu capacidad de ahorro es baja. Considera:\n`
    texto += `   1. Recortar 15% en ${dashboard.topGastos[0]?.categoria || 'tu categoría más alta'}\n`
    texto += `   2. Crear meta de ahorro mensual\n`
    texto += `   3. Revisar suscripciones no usadas\n`
  } else if (k.capacidadAhorro >= 20) {
    texto += `🟢 Excelente capacidad de ahorro. Sugerencias:\n`
    texto += `   1. Invertir el excedente (${formatearMoneda(balanceMensualEstimado)}/mes)\n`
    texto += `   2. Crear fondo de emergencias (3-6 meses de gastos)\n`
    texto += `   3. Establecer metas a mediano plazo\n`
  }

  return texto
}

// =====================================================
// 4. COMPARATIVO MES ANTERIOR
// =====================================================
export async function generarComparativoMes(ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS') {
  const ahora = new Date()
  const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0)

  // Movimientos mes actual
  const movsActual = await db.movimientoCaja.findMany({
    where: { fechaMovimiento: { gte: inicioMesActual }, movimientoCajaExtendido: ambito === 'AMBOS' ? undefined : { ambito } },
    include: { movimientoCajaExtendido: true },
  })

  // Movimientos mes anterior
  const movsAnterior = await db.movimientoCaja.findMany({
    where: { fechaMovimiento: { gte: inicioMesAnterior, lte: finMesAnterior }, movimientoCajaExtendido: ambito === 'AMBOS' ? undefined : { ambito } },
    include: { movimientoCajaExtendido: true },
  })

  const filtrarAmbito = (movs: typeof movsActual) =>
    ambito === 'AMBOS' ? movs : movs.filter((m) => m.movimientoCajaExtendido?.ambito === ambito)

  const actual = filtrarAmbito(movsActual)
  const anterior = filtrarAmbito(movsAnterior)

  const ingresosActual = actual.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const gastosActual = actual.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
  const balanceActual = ingresosActual - gastosActual

  const ingresosAnterior = anterior.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const gastosAnterior = anterior.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
  const balanceAnterior = ingresosAnterior - gastosAnterior

  const calcPct = (actual: number, anterior: number) => {
    if (anterior === 0) return actual > 0 ? 100 : 0
    return Math.round(((actual - anterior) / anterior) * 100)
  }

  let texto = `📊 COMPARATIVO MES — ${ambito}\n\n`
  texto += `═══ INGRESOS ═══\n`
  texto += `Mes actual: ${formatearMoneda(ingresosActual)}\n`
  texto += `Mes anterior: ${formatearMoneda(ingresosAnterior)}\n`
  texto += `Variación: ${calcPct(ingresosActual, ingresosAnterior) >= 0 ? '📈 +' : '📉 '}${calcPct(ingresosActual, ingresosAnterior)}%\n\n`

  texto += `═══ GASTOS ═══\n`
  texto += `Mes actual: ${formatearMoneda(gastosActual)}\n`
  texto += `Mes anterior: ${formatearMoneda(gastosAnterior)}\n`
  texto += `Variación: ${calcPct(gastosActual, gastosAnterior) >= 0 ? '📈 +' : '📉 '}${calcPct(gastosActual, gastosAnterior)}%\n\n`

  texto += `═══ BALANCE ═══\n`
  texto += `Mes actual: ${formatearMoneda(balanceActual)} ${balanceActual >= 0 ? '✅' : '⚠️'}\n`
  texto += `Mes anterior: ${formatearMoneda(balanceAnterior)} ${balanceAnterior >= 0 ? '✅' : '⚠️'}\n`
  texto += `Variación: ${calcPct(balanceActual, balanceAnterior) >= 0 ? '📈 +' : '📉 '}${calcPct(balanceActual, balanceAnterior)}%\n\n`

  // Análisis
  texto += `═══ ANÁLISIS ═══\n`
  if (ingresosActual > ingresosAnterior && gastosActual < gastosAnterior) {
    texto += `🟢 Situación mejorando: más ingresos y menos gastos\n`
  } else if (ingresosActual < ingresosAnterior && gastosActual > gastosAnterior) {
    texto += `🔴 Situación empeorando: menos ingresos y más gastos\n`
  } else if (gastosActual > gastosAnterior) {
    texto += `🟡 Gastos en aumento — revisar categorías\n`
  } else if (ingresosActual > ingresosAnterior) {
    texto += `🟢 Ingresos en aumento — tendencia positiva\n`
  } else {
    texto += `🟡 Situación estable\n`
  }

  return texto
}

// =====================================================
// 5. CONSEJOS DE AHORRO PERSONALIZADOS
// =====================================================
export async function generarConsejosAhorro(ambito: 'NEGOCIO' | 'PERSONAL' | 'AMBOS') {
  const dashboard = ambito === 'AMBOS'
    ? await obtenerDashboard('NEGOCIO', 30)
    : await obtenerDashboard(ambito, 30)

  const k = dashboard.kpis
  let texto = `💡 CONSEJOS DE AHORRO PERSONALIZADOS — ${ambito}\n\n`

  // Análisis de top gastos
  if (dashboard.topGastos.length > 0) {
    texto += `═══ OPTIMIZACIÓN DE GASTOS ═══\n\n`
    dashboard.topGastos.forEach((g, i) => {
      const pct = k.gastos > 0 ? Math.round((g.monto / k.gastos) * 100) : 0
      const ahorro15 = Math.round(g.monto * 0.15)
      texto += `${i + 1}. ${g.icono} ${g.categoria} — ${formatearMoneda(g.monto)} (${pct}% del total)\n`
      texto += `   💡 Si recortas 15%: ahorro de ${formatearMoneda(ahorro15)}/mes\n`
      texto += `   📊 En 1 año: ${formatearMoneda(ahorro15 * 12)}\n\n`
    })
  }

  // Análisis de capacidad de ahorro
  texto += `═══ CAPACIDAD DE AHORRO ═══\n`
  texto += `Actual: ${k.capacidadAhorro}%\n`
  if (k.capacidadAhorro < 10) {
    texto += `🔴 Baja — meta recomendada: 10-20%\n`
    texto += `💡 Para llegar a 10%: reduce ${formatearMoneda(k.ingresos * 0.1 - k.balance)} en gastos\n\n`
  } else if (k.capacidadAhorro < 20) {
    texto += `🟡 Aceptable — meta recomendada: 20%+\n`
    texto += `💡 Para llegar a 20%: reduce ${formatearMoneda(k.ingresos * 0.2 - k.balance)} en gastos\n\n`
  } else {
    texto += `🟢 Excelente — considera invertir el excedente\n\n`
  }

  // Metas sugeridas
  texto += `═══ METAS SUGERIDAS ═══\n`
  if (k.balance > 0) {
    texto += `1. Fondo de emergencias: ${formatearMoneda(k.gastos * 3)} (3 meses de gastos)\n`
    texto += `   Tiempo estimado: ${Math.ceil((k.gastos * 3) / k.balance)} meses\n\n`
    texto += `2. Ahorro mensual: ${formatearMoneda(k.balance)} (tu excedente actual)\n`
    texto += `   En 1 año: ${formatearMoneda(k.balance * 12)}\n\n`
  } else {
    texto += `⚠️ Sin capacidad de ahorro actual. Prioridad: equilibrar gastos.\n\n`
  }

  // Consejos generales
  texto += `═══ CONSEJOS GENERALES ═══\n`
  texto += `• Revisa suscripciones no usadas (Netflix, Spotify, gimnasio)\n`
  texto += `• Compara precios antes de compras grandes\n`
  texto += `• Usa presupuesto mensual por categoría\n`
  texto += `• Automatiza ahorro (transferencia automática)\n`
  texto += `• Paga deudas de mayor interés primero\n`
  texto += `• Negocia tarifas de servicios (internet, teléfono)\n`

  return texto
}

// =====================================================
// 6. PREGUNTAS FRECUENTES QUE EL BOT PUEDE RESPONDER
// =====================================================
export const PREGUNTAS_FRECUENTES = [
  { categoria: 'Registro', preguntas: [
    'Registra un gasto de 50000 en comida',
    'Anota un gasto de 200000 en gasolina personal',
    'Registra ingreso de 2000000 por venta',
    'Anota un ingreso de 500000 por comisión',
    'Crea un gasto de 100000 en marketing',
    'Registra un gasto de 30000 en almuerzo personal',
  ]},
  { categoria: 'Análisis', preguntas: [
    'Cómo va el balance del mes',
    'Muéstrame el dashboard',
    'Cuáles son mis top gastos',
    'Cuánto he gastado este mes',
    'Cuál es mi capacidad de ahorro',
    'Cuál es mi nivel de endeudamiento',
  ]},
  { categoria: 'Comparativos', preguntas: [
    'Compara con el mes anterior',
    'Cómo voy vs el mes pasado',
    'Comparativo de gastos',
    'Evolución de mis ingresos',
  ]},
  { categoria: 'Planificación', preguntas: [
    'Crea un presupuesto de 2000000 para alimentación',
    'Crea una meta de ahorrar 5000000',
    'Crea una meta de comprar vivienda de 50000000 largo plazo',
    'Presupuesto de 1000000 para marketing',
    'Ver mis metas activas',
    'Ver mis presupuestos',
  ]},
  { categoria: 'Inteligencia', preguntas: [
    'Muéstrame alertas',
    'Qué recomendaciones tienes',
    'Analiza mi salud financiera',
    'Cómo puedo ahorrar más',
    'Es buen momento para invertir',
    'Puedo asumir un crédito de 5000000',
    'Predicción a 90 días',
    'Consejos de ahorro',
  ]},
  { categoria: 'Reportes', preguntas: [
    'Reporte mensual',
    'Reporte semanal',
    'Reporte diario',
    'Reporte anual',
    'Resumen de hoy',
  ]},
]

export function generarListaPreguntas() {
  let texto = `❓ PREGUNTAS QUE PUEDO RESPONDER\n\n`
  PREGUNTAS_FRECUENTES.forEach((cat) => {
    texto += `═══ ${cat.categoria.toUpperCase()} ═══\n`
    cat.preguntas.forEach((p) => {
      texto += `• "${p}"\n`
    })
    texto += `\n`
  })
  texto += `💡 También puedes escribir directamente lo que necesites.\n`
  texto += `El bot entiende lenguaje natural y mantiene contexto entre mensajes.`
  return texto
}
