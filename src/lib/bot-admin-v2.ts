// =====================================================
// BOT ADMIN v2.0 — Motor NLU Avanzado + Aprendizaje + Comandos Numerados
// =====================================================
// Capacidades:
//   1. NLU con scoring por sinónimos y similares
//   2. Aprendizaje conversacional (recuerda qué intente el usuario usó)
//   3. Fallback inteligente cuando no reconoce un intent
//   4. Sistema de comandos numerados accesible con "menu"
//   5. Sin guion rígido: lenguaje natural fluido
// =====================================================

import { db } from '@/lib/db'
import { fechaHoraTextoColombia } from '@/lib/timezone'
import { formatearMoneda } from '@/lib/finanzas'
import {
  registrarMovimiento,
  obtenerDashboard,
  detectarAlertas,
  crearPresupuesto,
  crearMeta,
  generarReporte,
} from '@/lib/asistente-personal'
import {
  clasificarConIA,
  guardarMemoria,
  obtenerMemoria,
  generarAnalisisPredictivo,
  generarComparativoMes,
  generarConsejosAhorro,
} from '@/lib/asistente-personal-mejorado'
import { obtenerEstadoCartera, generarResumenEjecutivo } from '@/lib/asistente-cobros'
import { obtenerEstadoModuloPrestamos, generarDashboardEjecutivo } from '@/lib/asistente-prestamos'
import { generarResumenJuridico } from '@/lib/asesor-juridico'
import { generarInformeSeguridad } from '@/lib/ciberseguridad'
import { generarDashboardEjecutivoConsolidado } from '@/lib/asistente-ejecutivo'
import { buscarConocimientoPlataforma } from '@/lib/bot-conocimiento-plataforma'

// =====================================================
// TIPOS
// =====================================================

export interface ComandoBot {
  id: number
  categoria: 'FINANZAS' | 'SISTEMA' | 'ANALISIS' | 'CLIENTES' | 'SEGURIDAD' | 'CONFIG' | 'AYUDA'
  nombre: string
  descripcion: string
  ejemplo: string
  ejecutar: (ctx: ContextoBot) => Promise<RespuestaBot>
}

export interface ContextoBot {
  mensajeOriginal: string
  mensajeNormalizado: string
  sessionId: string
  memoria: any
  args: { monto?: number; concepto?: string; categoria?: string; periodo?: string; ambito?: string }
}

export interface RespuestaBot {
  texto: string
  tipo: 'TEXTO' | 'ACCION' | 'REPORTE' | 'CONFIRMACION' | 'MENU'
  accionEjecutada?: boolean
  detalleAccion?: string
}

// =====================================================
// CATÁLOGO DE SINÓNIMOS — permite que el bot entienda
// diferentes maneras de decir lo mismo
// =====================================================

const SINONIMOS: Record<string, string[]> = {
  // Acciones
  registrar: ['registra', 'registrar', 'anota', 'anotar', 'crea', 'crear', 'aplica', 'aplicar', 'agrega', 'agregar', 'guarda', 'guardar', 'asienta', 'asentar', 'pon', 'sube', 'cargar', 'cargo', 'imputar', 'imputa'],
  consultar: ['muestra', 'mostrar', 'muéstrame', 'mira', 'mirar', 'ver', 'dame', 'dame el', 'consultar', 'consulta', 'cuanto', 'cuánto', 'cuantos', 'cuántos', 'listar', 'lista', 'trae', 'traer', 'ver', 'consultame', 'info', 'información', 'informacion', 'reporte', 'reportar', 'resumen', 'dame info'],
  crear: ['crea', 'crear', 'nuevo', 'nueva', 'genera', 'generar', 'inicia', 'iniciar', 'abrir', 'abre', 'configurar', 'define', 'definir', 'establece', 'establecer'],
  eliminar: ['elimina', 'eliminar', 'borra', 'borrar', 'quita', 'quitar', 'suprime', 'suprimir', 'anula', 'anular', 'revierte', 'revertir'],
  actualizar: ['actualiza', 'actualizar', 'modifica', 'modificar', 'edita', 'editar', 'cambia', 'cambiar', 'ajusta', 'ajustar', 'corrije', 'corregir'],
  analizar: ['analiza', 'analizar', 'estudia', 'estudiar', 'revisa', 'revisar', 'evalua', 'evaluar', 'calcula', 'calcular', 'proyecta', 'proyectar', 'predice', 'predecir'],
  // Tipos de movimiento
  gasto: ['gasto', 'gaste', 'gasté', 'gastos', 'egreso', 'egresos', 'salida', 'salidas', 'pago', 'pagos', 'compra', 'compras', 'factura', 'facturas', 'cuenta por pagar', 'gastado', 'gastada'],
  ingreso: ['ingreso', 'ingresos', 'entra', 'entraron', 'entran', 'entrada', 'entradas', 'recibí', 'recibi', 'recibiste', 'cobro', 'cobros', 'venta', 'ventas', 'deposito', 'depósito', 'depositaron', 'abono', 'abonaron', 'pago recibido', 'entró dinero', 'entro dinero', 'ganancia', 'ganancias'],
  // Ámbitos
  negocio: ['negocio', 'empresa', 'labor', 'trabajo', 'sistema', 'plataforma', 'jsadr', 'oficina', 'comercial'],
  personal: ['personal', 'mio', 'mío', 'familia', 'casa', 'privado', 'propio'],
  // Entidades del sistema
  prestamo: ['préstamo', 'prestamo', 'préstamos', 'prestamos', 'crédito', 'credito', 'créditos', 'creditos', 'loan', 'loans'],
  cliente: ['cliente', 'clientes', 'usuario', 'usuarios', 'beneficiario', 'beneficiarios', 'deudor', 'deudores'],
  pago: ['pago', 'pagos', 'abono', 'abonos', 'cuota', 'cuotas', 'installment', 'payment'],
  mora: ['mora', 'moroso', 'morosos', 'atrasado', 'atrasados', 'vencido', 'vencidos', 'deuda', 'deudas', 'impago', 'impagados'],
  cartera: ['cartera', 'portfolio', 'prestamos activos', 'créditos activos', 'prestamos vigentes'],
  juridico: ['jurídico', 'juridico', 'legal', 'abogado', 'demanda', 'embargo', 'cobro judicial'],
  seguridad: ['seguridad', 'audit', 'auditoría', 'auditoria', 'vulnerabilidad', 'riesgo', 'ataque', 'hackeo', 'brecha', 'ciberseguridad'],
  auditoria: ['auditoría', 'auditoria', 'logs', 'bitácora', 'bitacora', 'historial', 'rastro', 'eventos'],
  alerta: ['alerta', 'alertas', 'aviso', 'avisos', 'notificación', 'notificacion', 'alarma', 'recordatorio'],
  // Conceptos financieros
  balance: ['balance', 'saldo', 'flujo', 'caja', 'liquidez', 'disponible', 'efectivo', 'capital'],
  presupuesto: ['presupuesto', 'presupuestos', 'budget', 'plan de gastos', 'plan financiero'],
  meta: ['meta', 'metas', 'objetivo', 'objetivos', 'ahorro', 'ahorros', 'goal', 'target'],
  reporte: ['reporte', 'informe', 'reportes', 'informes', 'resumen', 'sintesis', 'síntesis', 'estado'],
  categoria: ['categoría', 'categoria', 'rubro', 'tipo de gasto', 'clasificación'],
  // Periodos
  hoy: ['hoy', 'dia', 'día', 'actual', 'ahora', 'en este momento'],
  ayer: ['ayer', 'anterior', 'dia anterior'],
  semana: ['semana', 'semanal', 'esta semana', 'últimos 7 dias', 'ultimos 7 dias'],
  mes: ['mes', 'mensual', 'este mes', 'mes actual', 'mensualidad'],
  trimestre: ['trimestre', 'trimestral', '3 meses', 'tres meses'],
  ano: ['año', 'anual', 'anuality', 'year', '12 meses'],
  // Salududos y navegación
  saludo: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'qué tal', 'que tal', 'saludos'],
  agradecimiento: ['gracias', 'thx', 'muchas gracias', 'agradezco', 'ty'],
  menu: ['menu', 'menú', 'comandos', 'opciones', 'ayuda', 'help', 'qué puedo hacer', 'que puedo hacer', 'qué haces', 'que haces', 'funciones', 'capabilities'],
}

// =====================================================
// NORMALIZACIÓN Y SCORING
// =====================================================

/**
 * Normaliza el mensaje del usuario:
 * - lowercase
 * - quita acentos
 * - normaliza espacios
 * - quita puntuación
 */
export function normalizar(mensaje: string): string {
  return mensaje
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^\w\s$%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta qué conceptos (claves de SINONIMOS) están presentes en el mensaje.
 * Retorna un mapa concepto -> score (0-100).
 */
export function detectarConceptos(mensaje: string): Record<string, number> {
  const norm = normalizar(mensaje)
  const scores: Record<string, number> = {}

  for (const [concepto, palabras] of Object.entries(SINONIMOS)) {
    let maxScore = 0
    for (const palabra of palabras) {
      const p = normalizar(palabra)
      // Buscar como palabra completa o substring
      const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(norm)) {
        // Palabra más larga = mejor match
        const score = Math.min(100, 50 + p.length * 5)
        if (score > maxScore) maxScore = score
      } else if (norm.includes(p)) {
        // Substring (menos peso)
        const score = Math.min(70, 30 + p.length * 2)
        if (score > maxScore) maxScore = score
      }
    }
    if (maxScore > 0) scores[concepto] = maxScore
  }

  return scores
}

/**
 * Extrae el monto monetario del mensaje.
 * Soporta formatos: 50000, 50.000, $50.000, 50,000, 50 mil, 1.5 millones
 */
export function extraerMonto(mensaje: string): number | undefined {
  const norm = normalizar(mensaje)
  // 50 mil / 50m
  const mil = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|m\b)/)
  if (mil) {
    return Math.round(parseFloat(mil[1].replace(',', '.')) * 1000)
  }
  // 1.5 millones / 1 millon
  const millon = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:millones|millon|m\b)/)
  if (millon) {
    return Math.round(parseFloat(millon[1].replace(',', '.')) * 1000000)
  }
  // $50.000 o 50.000
  const match = norm.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/)
  if (match) {
    const numStr = match[1].replace(/\./g, '').replace(',', '.')
    const num = parseFloat(numStr)
    if (!isNaN(num) && num > 0) return num
  }
  return undefined
}

/**
 * Extrae el concepto/descripción de un movimiento.
 * Busca "por", "en", "para", "de" + palabra(s)
 */
export function extraerConcepto(mensaje: string): string {
  const norm = normalizar(mensaje)
  // Por/En/Para/De + concepto
  const match = norm.match(/(?:por|en|para|de)\s+([a-záéíóúñ\s]{3,40}?)(?:\s*$|,|\sy\s)/i)
  if (match) return match[1].trim()
  // Si no hay preposición, tomar las últimas palabras después del monto
  const sinMonto = norm.replace(/\$?\s*\d[\d.,]*\s*(?:mil|millones|millon|m\b)?/g, '').trim()
  const palabras = sinMonto.split(' ').filter((p) => !['registra', 'registrar', 'anota', 'gasto', 'ingreso', 'gaste', 'gasté', 'un', 'una', 'de'].includes(p))
  return palabras.slice(0, 4).join(' ') || 'Sin concepto'
}

// =====================================================
// APRENDIZAJE — el bot recuerda patrones que el usuario usó
// =====================================================

interface AprendizajeUsuario {
  // Guarda el mapping de frase del usuario → comando ejecutado
  // Para sugerir el comando la próxima vez que use una frase similar
  patrones: Array<{
    frase: string
    comandoId: number
    timestamp: number
    exito: boolean
  }>
  // Último comando ejecutado (para "repetir último")
  ultimoComando?: { id: number; timestamp: number }
  // Preferencias detectadas
  ambitoPreferido?: 'NEGOCIO' | 'PERSONAL'
}

// En memoria (sesión); en producción migrar a BD
const aprendizajes = new Map<string, AprendizajeUsuario>()

export function aprenderDeInteraccion(sessionId: string, frase: string, comandoId: number, exito: boolean) {
  const actual = aprendizajes.get(sessionId) || { patrones: [] }
  actual.patrones.push({
    frase: normalizar(frase),
    comandoId,
    timestamp: Date.now(),
    exito,
  })
  // Limitar a 50 patrones por sesión
  if (actual.patrones.length > 50) {
    actual.patrones = actual.patrones.slice(-50)
  }
  actual.ultimoComando = { id: comandoId, timestamp: Date.now() }
  aprendizajes.set(sessionId, actual)
}

export function obtenerAprendizaje(sessionId: string): AprendizajeUsuario | undefined {
  return aprendizajes.get(sessionId)
}

/**
 * Si la frase del usuario coincide con un patrón aprendido,
 * retorna el comandoId correspondiente.
 */
export function buscarComandoAprendido(sessionId: string, frase: string): number | undefined {
  const aprend = aprendizajes.get(sessionId)
  if (!aprend) return undefined
  const fraseNorm = normalizar(frase)
  // Buscar patrón exacto primero
  const exacto = aprend.patrones.find((p) => p.frase === fraseNorm && p.exito)
  if (exacto) return exacto.comandoId
  // Buscar patrón similar (al menos 60% de palabras en común)
  for (const p of aprend.patrones) {
    if (!p.exito) continue
    const palabrasFrase = new Set(fraseNorm.split(' '))
    const palabrasPatron = new Set(p.frase.split(' '))
    const interseccion = [...palabrasFrase].filter((x) => palabrasPatron.has(x)).length
    const union = new Set([...palabrasFrase, ...palabrasPatron]).size
    const similitud = interseccion / union
    if (similitud >= 0.6) return p.comandoId
  }
  return undefined
}

// =====================================================
// CATÁLOGO DE COMANDOS NUMERADOS (accesible con "menu")
// =====================================================

export const COMANDOS: ComandoBot[] = [
  // === FINANZAS ===
  {
    id: 1,
    categoria: 'FINANZAS',
    nombre: 'Registrar gasto',
    descripcion: 'Anota un gasto (monto + concepto) — siempre pregunta NEGOCIO o PERSONAL',
    ejemplo: '1   →   te pedirá monto y concepto',
    ejecutar: async (ctx) => {
      const monto = ctx.args.monto
      const concepto = ctx.args.concepto || 'Gasto'
      if (!monto) {
        return {
          texto: '💰 Vamos a registrar tu gasto. Por favor dime:\n\n• ¿Cuál es el **monto**?\n• ¿Cuál es el **motivo/concepto**? (ej: comida, transporte, oficina)\n\n⚠️ **Importante:** Te preguntaré si el gasto es de **NEGOCIO** o **PERSONAL** antes de registrarlo. Es obligatorio confirmarlo.\n\nEjemplo: *"Registra un gasto de 50.000 por comida"*',
          tipo: 'TEXTO',
        }
      }
      // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
      // Aunque el mensaje original contenga "personal" o "negocio",
      // SIEMPRE guardamos en memoria y pedimos confirmación explícita.
      // El admin debe responder "negocio" o "personal" para que se registre.
      guardarMemoria(ctx.sessionId, {
        pendienteConfirmarAmbito: {
          tipo: 'GASTO',
          monto,
          concepto,
          timestamp: Date.now(),
        },
      } as any)
      // Sugerencia visual: si el admin ya escribió "personal"/"negocio" en el mensaje,
      // se lo marcamos como opción resaltada pero igual pedimos confirmación.
      const mensajeNorm = ctx.mensajeNormalizado || ''
      const detectoPersonal = /\bpersonal\b/i.test(mensajeNorm) && !/personalizar/i.test(mensajeNorm)
      const detectoNegocio = /\b(?:negocio|empresa)\b/i.test(mensajeNorm)
      const sugerencia = detectoPersonal
        ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
        : detectoNegocio
        ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
        : ''
      return {
        texto: `💰 **Gasto detectado**\n\n💰 Monto: ${formatearMoneda(monto)}\n📝 Motivo: ${concepto}\n${sugerencia ? `\n💡 ${sugerencia}\n` : ''}\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este gasto es para **NEGOCIO** o **PERSONAL**?\n\nResponde:\n  • **negocio** o **1** → Gasto del negocio\n  • **personal** o **2** → Gasto personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`,
        tipo: 'CONFIRMACION',
      }
    },
  },
  {
    id: 2,
    categoria: 'FINANZAS',
    nombre: 'Registrar ingreso',
    descripcion: 'Anota un ingreso (monto + concepto) — siempre pregunta NEGOCIO o PERSONAL',
    ejemplo: '2   →   te pedirá monto y concepto',
    ejecutar: async (ctx) => {
      const monto = ctx.args.monto
      const concepto = ctx.args.concepto || 'Ingreso'
      if (!monto) {
        return {
          texto: '💵 Vamos a registrar tu ingreso. Por favor dime:\n\n• ¿Cuál es el **monto**?\n• ¿Cuál es el **concepto**? (ej: venta, comisión, abono)\n\n⚠️ **Importante:** Te preguntaré si el ingreso es de **NEGOCIO** o **PERSONAL** antes de registrarlo. Es obligatorio confirmarlo.\n\nEjemplo: *"Registra un ingreso de 200.000 por venta"*',
          tipo: 'TEXTO',
        }
      }
      // === CONFIRMACIÓN OBLIGATORIA DE ÁMBITO ===
      guardarMemoria(ctx.sessionId, {
        pendienteConfirmarAmbito: {
          tipo: 'INGRESO',
          monto,
          concepto,
          timestamp: Date.now(),
        },
      } as any)
      const mensajeNorm = ctx.mensajeNormalizado || ''
      const detectoPersonal = /\bpersonal\b/i.test(mensajeNorm) && !/personalizar/i.test(mensajeNorm)
      const detectoNegocio = /\b(?:negocio|empresa)\b/i.test(mensajeNorm)
      const sugerencia = detectoPersonal
        ? 'Detecté "personal" en tu mensaje → responde **personal** para confirmar'
        : detectoNegocio
        ? 'Detecté "negocio" en tu mensaje → responde **negocio** para confirmar'
        : ''
      return {
        texto: `📈 **Ingreso detectado**\n\n💵 Monto: ${formatearMoneda(monto)}\n📝 Concepto: ${concepto}\n${sugerencia ? `\n💡 ${sugerencia}\n` : ''}\n━━━━━━━━━━━━━━━━━━\n⚠️ **CONFIRMACIÓN OBLIGATORIA**\n━━━━━━━━━━━━━━━━━━\n\n¿Este ingreso es para **NEGOCIO** o **PERSONAL**?\n\nResponde:\n  • **negocio** o **1** → Ingreso del negocio\n  • **personal** o **2** → Ingreso personal\n\n🔒 No puedo registrarlo hasta que confirmes el ámbito.`,
        tipo: 'CONFIRMACION',
      }
    },
  },
  {
    id: 3,
    categoria: 'FINANZAS',
    nombre: 'Balance del mes',
    descripcion: 'Muestra ingresos, egresos y balance neto del mes',
    ejemplo: '3',
    ejecutar: async () => {
      const dash = await obtenerDashboard('AMBOS', 30)
      const k = dash.kpis
      return {
        texto: `📊 **BALANCE DEL MES**\n\n💰 Ingresos: ${formatearMoneda(k.ingresos)}\n💸 Egresos: ${formatearMoneda(k.gastos)}\n📈 Balance neto: ${formatearMoneda(k.balance)}\n\nCaja actual: ${formatearMoneda(k.balance)}\nMovimientos del mes: ${k.totalMovimientos}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 4,
    categoria: 'FINANZAS',
    nombre: 'Gastos por categoría',
    descripcion: 'Resume cuánto se ha gastado en cada categoría',
    ejemplo: '4',
    ejecutar: async () => {
      const inicio = new Date()
      inicio.setDate(1)
      const movs = await db.movimientoCaja.findMany({
        where: { tipo: 'EGRESO', fechaMovimiento: { gte: inicio } },
        select: { monto: true, concepto: true, ambito: true },
      })
      if (movs.length === 0) {
        return { texto: 'No hay gastos registrados este mes.', tipo: 'TEXTO' }
      }
      const porCategoria: Record<string, number> = {}
      let total = 0
      for (const m of movs) {
        const cat = m.ambito || m.concepto || 'SIN_CATEGORIA'
        porCategoria[cat] = (porCategoria[cat] || 0) + m.monto
        total += m.monto
      }
      const lineas = Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, monto]) => `• ${cat}: ${formatearMoneda(monto)} (${((monto / total) * 100).toFixed(1)}%)`)
        .join('\n')
      return {
        texto: `📊 **GASTOS POR CATEGORÍA (mes actual)**\n\n${lineas}\n\nTotal: ${formatearMoneda(total)}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 5,
    categoria: 'FINANZAS',
    nombre: 'Crear presupuesto',
    descripcion: 'Crea un presupuesto mensual por categoría',
    ejemplo: '5   →   te pedirá categoría y monto límite',
    ejecutar: async (ctx) => {
      const monto = ctx.args.monto
      const categoria = ctx.args.categoria || 'GENERAL'
      if (!monto) {
        return {
          texto: '📋 Para crear un presupuesto dime:\n• **Categoría** (TRANSPORTE, ALIMENTACION, SERVICIOS, OFICINA, PERSONAL, INVERSION, SALUD)\n• **Monto límite mensual**\n\nEjemplo: *"Crea presupuesto de 500.000 para ALIMENTACION"*',
          tipo: 'TEXTO',
        }
      }
      try {
        await crearPresupuesto({
          nombre: categoria,
          ambito: 'NEGOCIO',
          montoLimite: monto,
          periodo: 'MENSUAL',
        })
        return {
          texto: `✅ Presupuesto creado\n\n🏷️ Categoría: ${categoria}\n💰 Límite mensual: ${formatearMoneda(monto)}`,
          tipo: 'ACCION',
          accionEjecutada: true,
        }
      } catch (e: any) {
        return {
          texto: `❌ ${e.message || 'Error al crear presupuesto'}`,
          tipo: 'ACCION',
          accionEjecutada: false,
        }
      }
    },
  },
  {
    id: 6,
    categoria: 'FINANZAS',
    nombre: 'Crear meta de ahorro',
    descripcion: 'Define una meta con monto objetivo y fecha',
    ejemplo: '6   →   te pedirá objetivo, monto y fecha',
    ejecutar: async (ctx) => {
      const monto = ctx.args.monto
      if (!monto) {
        return {
          texto: '🎯 Para crear una meta dime:\n• **Nombre de la meta** (ej: Viaje, Computador, Reserva)\n• **Monto objetivo**\n• **Fecha límite** (opcional)\n\nEjemplo: *"Crea meta Viaje 5.000.000 para diciembre"*',
          tipo: 'TEXTO',
        }
      }
      const concepto = ctx.args.concepto || 'Meta de ahorro'
      try {
        await crearMeta({
          nombre: concepto,
          tipo: 'AHORRO',
          ambito: 'NEGOCIO',
          montoObjetivo: monto,
        })
        return {
          texto: `✅ Meta creada\n\n🎯 ${concepto}\n💰 Objetivo: ${formatearMoneda(monto)}`,
          tipo: 'ACCION',
          accionEjecutada: true,
        }
      } catch (e: any) {
        return {
          texto: `❌ ${e.message || 'Error al crear meta'}`,
          tipo: 'ACCION',
          accionEjecutada: false,
        }
      }
    },
  },
  {
    id: 7,
    categoria: 'FINANZAS',
    nombre: 'Reporte mensual',
    descripcion: 'Genera un reporte completo del mes',
    ejemplo: '7',
    ejecutar: async () => {
      const reporte = await generarReporte('AMBOS', 'MENSUAL')
      return {
        texto: `📋 **REPORTE MENSUAL**\n\n${reporte || 'Generando reporte...'}\n\nGenerado: ${fechaHoraTextoColombia()}`,
        tipo: 'REPORTE',
      }
    },
  },

  // === SISTEMA ===
  {
    id: 8,
    categoria: 'SISTEMA',
    nombre: 'Estado de préstamos',
    descripcion: 'Cuántos préstamos activos, en mora, vencidos',
    ejemplo: '8',
    ejecutar: async () => {
      const estado = await obtenerEstadoModuloPrestamos()
      return {
        texto: `🏦 **ESTADO DE PRÉSTAMOS**\n\n${typeof estado.resumen === 'string' ? estado.resumen : JSON.stringify(estado.resumen || estado, null, 2)}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 9,
    categoria: 'SISTEMA',
    nombre: 'Préstamos en mora',
    descripcion: 'Lista de préstamos con cuotas vencidas',
    ejemplo: '9',
    ejecutar: async () => {
      const enMora = await db.prestamo.findMany({
        where: { estado: { in: ['EN_MORA', 'VENCIDO'] } },
        select: {
          id: true,
          montoPrincipal: true,
          saldoTotal: true,
          diasMora: true,
          cliente: { select: { nombre: true, cedula: true } },
          fechaDesembolso: true,
        },
        take: 20,
      })
      if (enMora.length === 0) {
        return { texto: '✅ No hay préstamos en mora actualmente.', tipo: 'REPORTE' }
      }
      const lineas = enMora.map((p, i) =>
        `${i + 1}. ${p.cliente.nombre} (cc ${p.cliente.cedula}) — Saldo: ${formatearMoneda(p.saldoTotal || p.montoPrincipal)} | ${p.diasMora || 0} días de mora`
      ).join('\n')
      return {
        texto: `⚠️ **PRÉSTAMOS EN MORA (${enMora.length})**\n\n${lineas}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 10,
    categoria: 'SISTEMA',
    nombre: 'Estado de cartera',
    descripcion: 'Resumen ejecutivo de la cartera de créditos',
    ejemplo: '10',
    ejecutar: async () => {
      try {
        const estado = await obtenerEstadoCartera()
        const resumen = await generarResumenEjecutivo()
        // Normalizar cualquier tipo de respuesta a string
        const texto1 = typeof estado === 'string' ? estado
          : (estado as any)?.resumen || (estado as any)?.contenido || (estado as any)?.texto || ''
        const texto2 = typeof resumen === 'string' ? resumen
          : (resumen as any)?.contenido || (resumen as any)?.resumen || (resumen as any)?.texto || ''
        const combined = (texto1 + '\n\n' + texto2).trim()
        return {
          texto: `💼 **ESTADO DE CARTERA**\n\n${combined || 'No hay datos de cartera disponibles en este momento.'}`,
          tipo: 'REPORTE',
        }
      } catch (e: any) {
        return {
          texto: `💼 **ESTADO DE CARTERA**\n\nError al generar el resumen: ${e.message}\n\nIntenta de nuevo o usa el comando **9** para ver préstamos en mora.`,
          tipo: 'REPORTE',
        }
      }
    },
  },
  {
    id: 11,
    categoria: 'SISTEMA',
    nombre: 'Auditoría reciente',
    descripcion: 'Últimos eventos del sistema (log de auditoría)',
    ejemplo: '11',
    ejecutar: async () => {
      const eventos = await db.auditLog.findMany({
        take: 15,
        orderBy: { fecha: 'desc' },
        select: { fecha: true, usuarioNombre: true, accion: true, modulo: true, exito: true, errorMessage: true },
      })
      if (eventos.length === 0) {
        return { texto: 'No hay eventos de auditoría registrados.', tipo: 'REPORTE' }
      }
      const lineas = eventos.map((e) => {
        const hora = new Date(e.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        const status = e.exito ? '✓' : '✗'
        return `[${hora}] ${status} ${e.usuarioNombre} → ${e.accion} (${e.modulo})${e.errorMessage ? ` ERR: ${e.errorMessage.slice(0, 60)}` : ''}`
      }).join('\n')
      return {
        texto: `📜 **AUDITORÍA RECIENTE (últimos ${eventos.length} eventos)**\n\n${lineas}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 12,
    categoria: 'SISTEMA',
    nombre: 'Alertas activas',
    descripcion: 'Alertas del sistema y del negocio',
    ejemplo: '12',
    ejecutar: async () => {
      const alertas = await detectarAlertas('AMBOS')
      if (!alertas || alertas.length === 0) {
        return { texto: '✅ No hay alertas activas.', tipo: 'REPORTE' }
      }
      const lineas = alertas.map((a, i) => `${i + 1}. ${a.tipo || 'ALERTA'}: ${a.titulo || a.descripcion || JSON.stringify(a)}`).join('\n')
      return {
        texto: `🔔 **ALERTAS ACTIVAS (${alertas.length})**\n\n${lineas}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 13,
    categoria: 'SISTEMA',
    nombre: 'Crear evento de calendario',
    descripcion: 'Programa un evento o recordatorio',
    ejemplo: '13   →   te pedirá título y fecha',
    ejecutar: async (ctx) => {
      const concepto = ctx.args.concepto
      if (!concepto) {
        return {
          texto: '📅 Para crear un evento dime:\n• **Título** (ej: Pagar tarjeta)\n• **Fecha** (día del mes o fecha completa)\n\nEjemplo: *"Crea evento Pagar tarjeta el 30"*',
          tipo: 'TEXTO',
        }
      }
      // Extraer día del mes
      const diaMatch = ctx.mensajeOriginal.match(/\b(\d{1,2})\b/)
      const dia = diaMatch ? parseInt(diaMatch[1]) : new Date().getDate()
      const fecha = new Date()
      fecha.setDate(dia)
      try {
        await (db as any).eventoCalendario.create({
          data: {
            titulo: concepto,
            fecha,
            tipo: 'RECORDATORIO',
            estado: 'PROGRAMADO',
          },
        })
        return {
          texto: `✅ Evento creado\n\n📅 ${concepto}\n🗓️ ${fecha.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`,
          tipo: 'ACCION',
          accionEjecutada: true,
          detalleAccion: `Evento: ${concepto} el ${dia}`,
        }
      } catch (e: any) {
        return { texto: `❌ Error creando evento: ${e.message}`, tipo: 'TEXTO' }
      }
    },
  },
  {
    id: 14,
    categoria: 'SISTEMA',
    nombre: 'Resumen jurídico',
    descripcion: 'Estado de casos jurídicos',
    ejemplo: '14',
    ejecutar: async () => {
      const resumen = await generarResumenJuridico()
      return {
        texto: `⚖️ **RESUMEN JURÍDICO**\n\n${resumen || 'Generando resumen...'}`,
        tipo: 'REPORTE',
      }
    },
  },

  // === ANÁLISIS ===
  {
    id: 15,
    categoria: 'ANALISIS',
    nombre: 'Recomendaciones financieras',
    descripcion: 'Consejos personalizados basados en tu actividad',
    ejemplo: '15',
    ejecutar: async () => {
      const consejos = await generarConsejosAhorro('AMBOS')
      return {
        texto: `💡 **RECOMENDACIONES FINANCIERAS**\n\n${consejos || 'Generando recomendaciones...'}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 16,
    categoria: 'ANALISIS',
    nombre: 'Análisis predictivo 90 días',
    descripcion: 'Proyección de caja y flujo a 90 días',
    ejemplo: '16',
    ejecutar: async () => {
      const analisis = await generarAnalisisPredictivo('AMBOS')
      return {
        texto: `🔮 **ANÁLISIS PREDICTIVO (90 días)**\n\n${analisis || 'Generando análisis...'}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 17,
    categoria: 'ANALISIS',
    nombre: 'Comparativo mes anterior',
    descripcion: 'Compara este mes con el mes pasado',
    ejemplo: '17',
    ejecutar: async () => {
      const comp = await generarComparativoMes('AMBOS')
      return {
        texto: `📊 **COMPARATIVO MES ANTERIOR**\n\n${comp || 'Generando comparativo...'}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 18,
    categoria: 'ANALISIS',
    nombre: 'Dashboard ejecutivo consolidado',
    descripcion: 'Vista 360° de todo el negocio',
    ejemplo: '18',
    ejecutar: async () => {
      const dash = await generarDashboardEjecutivoConsolidado()
      return {
        texto: `🎯 **DASHBOARD EJECUTIVO CONSOLIDADO**\n\n${dash || 'Generando dashboard...'}`,
        tipo: 'REPORTE',
      }
    },
  },

  // === SEGURIDAD ===
  {
    id: 19,
    categoria: 'SEGURIDAD',
    nombre: 'Informe de seguridad',
    descripcion: 'Auditoría completa de ciberseguridad',
    ejemplo: '19',
    ejecutar: async () => {
      const informe = await generarInformeSeguridad()
      return {
        texto: `🛡️ **INFORME DE SEGURIDAD**\n\n${informe || 'Generando informe...'}`,
        tipo: 'REPORTE',
      }
    },
  },
  {
    id: 20,
    categoria: 'SEGURIDAD',
    nombre: 'Estado del sistema (DevOps)',
    descripcion: 'Salud técnica del sistema',
    ejemplo: '20',
    ejecutar: async () => {
      // DevOps check rápido
      const uptime = process.uptime()
      const mem = process.memoryUsage()
      return {
        texto: `⚙️ **ESTADO DEL SISTEMA**\n\n⏱️ Uptime: ${Math.floor(uptime / 60)} min\n💾 Memoria: ${(mem.rss / 1024 / 1024).toFixed(1)} MB\n🌐 TZ: ${process.env.TZ || 'America/Bogota'}\n📅 Hora Colombia: ${fechaHoraTextoColombia()}`,
        tipo: 'REPORTE',
      }
    },
  },

  // === CONFIG ===
  {
    id: 21,
    categoria: 'CONFIG',
    nombre: 'Configurar ámbito preferido',
    descripcion: 'Define si por defecto los movimientos son negocio o personal',
    ejemplo: '21   →   te pedirá NEGOCIO o PERSONAL',
    ejecutar: async (ctx) => {
      const ambito = (ctx.args.ambito as 'NEGOCIO' | 'PERSONAL') || ctx.memoria?.ambitoPreferido
      if (!ambito) {
        return {
          texto: '⚙️ Para configurar tu ámbito preferido dime: **NEGOCIO** o **PERSONAL**\n\nEsto se usará por defecto en todos los registros.',
          tipo: 'TEXTO',
        }
      }
      guardarMemoria(ctx.sessionId, { ambitoPreferido: ambito })
      return {
        texto: `✅ Ámbito preferido configurado: **${ambito}**\n\nA partir de ahora, todos los movimientos que registres se asignarán a este ámbito automáticamente.`,
        tipo: 'ACCION',
        accionEjecutada: true,
      }
    },
  },
  {
    id: 22,
    categoria: 'AYUDA',
    nombre: 'Repetir último comando',
    descripcion: 'Vuelve a ejecutar el último comando',
    ejemplo: '22',
    ejecutar: async (ctx) => {
      const aprend = obtenerAprendizaje(ctx.sessionId)
      if (!aprend?.ultimoComando) {
        return { texto: 'No hay un comando previo para repetir. Escribe **menu** para ver las opciones.', tipo: 'TEXTO' }
      }
      const cmd = COMANDOS.find((c) => c.id === aprend.ultimoComando!.id)
      if (!cmd) return { texto: 'El último comando ya no está disponible.', tipo: 'TEXTO' }
      return cmd.ejecutar(ctx)
    },
  },
  {
    id: 23,
    categoria: 'AYUDA',
    nombre: 'Aprender nueva frase',
    descripcion: 'Enseña al bot a reconocer una frase personalizada',
    ejemplo: '23   →   te pedirá la frase y el comando al que apunta',
    ejecutar: async (ctx) => {
      return {
        texto: '🧠 **MODO APRENDIZAJE**\n\nPara enseñarme una nueva frase, escribe:\n`aprender: <frase> = <número de comando>`\n\nEjemplo: `aprender: cuanto debo = 10` (asocia "cuanto debo" con el comando 10 - Estado de cartera)\n\nTambién puedo aprender automáticamente: cada vez que ejecutes un comando, recordaré la frase que usaste para sugerírtelo la próxima vez.',
        tipo: 'TEXTO',
      }
    },
  },
  {
    id: 0,
    categoria: 'AYUDA',
    nombre: 'Mostrar menú completo',
    descripcion: 'Lista todos los comandos numerados',
    ejemplo: 'menu o 0',
    ejecutar: async () => {
      return { texto: generarMenuCompleto(), tipo: 'MENU' }
    },
  },
]

// =====================================================
// MENÚ DE BIENVENIDA (lo que ve el admin al abrir el chat)
// =====================================================

export function generarMenuBienvenida(): string {
  return `👋 ¡Hola! Soy tu asistente del Portal Admin.

Puedo ayudarte con **finanzas**, **préstamos**, **cobros**, **seguridad**, **auditoría** y mucho más. No estoy limitado a un menú fijo: háblame en lenguaje natural y te entiendo.

💡 **Ejemplos rápidos:**
• "Registra un gasto de 50.000 por comida"
• "¿Cómo va el balance del mes?"
• "Muéstrame los préstamos en mora"
• "Auditoría reciente"
• "Recomendaciones financieras"

📋 Escribe **menu** para ver la lista completa de comandos numerados (también puedes escribir solo el número, ej: \`3\` para ver el balance del mes).

🕐 Hora Colombia: ${fechaHoraTextoColombia()}`
}

// =====================================================
// GENERAR MENÚ COMPLETO NUMERADO
// =====================================================

export function generarMenuCompleto(): string {
  const categorias: ComandoBot['categoria'][] = ['FINANZAS', 'SISTEMA', 'ANALISIS', 'SEGURIDAD', 'CONFIG', 'AYUDA']
  const iconos: Record<string, string> = {
    FINANZAS: '💰',
    SISTEMA: '🛡️',
    ANALISIS: '📊',
    SEGURIDAD: '🔐',
    CONFIG: '⚙️',
    AYUDA: '❓',
  }
  const partes: string[] = []
  partes.push('📋 **MENÚ COMPLETO — Asistente Admin**\n')
  partes.push(`_Hora: ${fechaHoraTextoColombia()}_\n`)
  for (const cat of categorias) {
    partes.push(`\n${iconos[cat]} **${cat}**\n`)
    const cmds = COMANDOS.filter((c) => c.categoria === cat && c.id !== 0)
    for (const c of cmds) {
      partes.push(`  ${String(c.id).padStart(2, '0')}. **${c.nombre}** — ${c.descripcion}`)
    }
  }
  partes.push('\n📝 **Cómo usar:**')
  partes.push('• Escribe solo el **número** del comando (ej: `3`) para ejecutarlo')
  partes.push('• O escribe en lenguaje natural (ej: *"balance del mes"*)')
  partes.push('• Escribe **menu** o **0** para volver a ver este menú')
  partes.push('• Escribe **22** para repetir el último comando')
  return partes.join('\n')
}

// =====================================================
// DESPACHADOR PRINCIPAL
// =====================================================

export async function procesarMensajeAdmin(
  mensaje: string,
  sessionId: string
): Promise<RespuestaBot> {
  const mensajeNorm = normalizar(mensaje)

  // ===================================================================
  // 0. CONFIRMACIÓN OBLIGATORIA DE ÁMBITO (personal / negocio)
  // -------------------------------------------------------------------
  // Si hay un gasto/ingreso pendiente de confirmar ámbito, este handler
  // se ejecuta PRIMERO y es INELUDIBLE. El admin DEBE responder
  // "negocio" o "personal" para poder continuar.
  //
  // Casos:
  //  a) Admin responde "negocio"/"personal"/"1"/"2"/"n"/"p" → registra
  //  b) Admin pide "menu"/"ayuda"/"hola" → permite salir (sin registrar)
  //  c) Admin escribe cualquier otra cosa → RE-PREGUNTA (no cancela)
  // ===================================================================
  const memoriaPendiente = obtenerMemoria(sessionId)
  if (memoriaPendiente?.pendienteConfirmarAmbito) {
    const pendiente = memoriaPendiente.pendienteConfirmarAmbito
    // Expiración: 10 minutos (tiempo amplio para que el admin responda)
    if (Date.now() - pendiente.timestamp > 10 * 60 * 1000) {
      guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
    } else {
      const mensajeLower = mensaje.toLowerCase().trim()
      // Detectar respuesta del admin
      const esNegocio =
        mensajeLower === 'negocio' ||
        mensajeLower === '1' ||
        mensajeLower === 'n' ||
        mensajeLower.includes('negocio') ||
        mensajeLower.includes('empresa')
      const esPersonal =
        mensajeLower === 'personal' ||
        mensajeLower === '2' ||
        mensajeLower === 'p' ||
        (mensajeLower.includes('personal') && !mensajeLower.includes('personalizar'))

      // Permitir SALIR del flujo de confirmación con comandos de navegación
      const esComandoNavegacion =
        mensajeLower === 'menu' ||
        mensajeLower === 'menú' ||
        mensajeLower === 'ayuda' ||
        mensajeLower === 'hola' ||
        mensajeLower === 'cancelar' ||
        mensajeLower === 'salir' ||
        mensajeLower === 'cancel'

      if (esNegocio || esPersonal) {
        const ambito = esNegocio ? 'NEGOCIO' : 'PERSONAL'
        try {
          const resultado = await registrarMovimiento({
            tipo: pendiente.tipo === 'GASTO' ? 'EGRESO' : 'INGRESO',
            monto: pendiente.monto,
            concepto: pendiente.concepto,
            ambito: ambito as 'NEGOCIO' | 'PERSONAL',
            usuarioNombre: 'Admin',
          })
          // Limpiar pendiente
          guardarMemoria(sessionId, {
            pendienteConfirmarAmbito: undefined,
            ultimoMovimientoId: resultado.movimientoId,
            ultimoMovimientoTipo: pendiente.tipo,
            ultimoMovimientoMonto: pendiente.monto,
            ultimoMovimientoConcepto: pendiente.concepto,
            ultimoMovimientoAmbito: ambito as any,
            ultimoMovimientoCategoria: resultado.categoriaNombre,
          } as any)
          return {
            texto: resultado.success
              ? `✅ ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} registrado (${ambito})\n\n💰 Monto: ${formatearMoneda(pendiente.monto)}\n📝 Motivo: ${pendiente.concepto}\n🏷️ Categoría: ${resultado.categoriaNombre}\n📅 ${fechaHoraTextoColombia()}`
              : `❌ ${resultado.mensaje}`,
            tipo: 'ACCION',
            accionEjecutada: resultado.success,
            detalleAccion: `${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} ${ambito}: ${formatearMoneda(pendiente.monto)} | Motivo: ${pendiente.concepto} | Categoría: ${resultado.categoriaNombre}`,
          }
        } catch (e: any) {
          guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
          return {
            texto: `❌ No pude registrar el movimiento. Error: ${e instanceof Error ? e.message : 'desconocido'}`,
            tipo: 'TEXTO',
          }
        }
      }

      if (esComandoNavegacion) {
        // El admin quiere salir del flujo de confirmación sin registrar
        guardarMemoria(sessionId, { pendienteConfirmarAmbito: undefined } as any)
        // Caer al flujo normal (no retornar aquí)
      } else {
        // === RE-PREGUNTAR: la confirmación es OBLIGATORIA ===
        // No cancelamos el pendiente. El admin debe responder explícitamente.
        return {
          texto: `🔒 **Tienes un ${pendiente.tipo === 'GASTO' ? 'gasto' : 'ingreso'} pendiente de confirmar.**\n\n💰 Monto: ${formatearMoneda(pendiente.monto)}\n📝 ${pendiente.tipo === 'GASTO' ? 'Motivo' : 'Concepto'}: ${pendiente.concepto}\n\n━━━━━━━━━━━━━━━━━━\n⚠️ **DEBES confirmar el ámbito para continuar**\n━━━━━━━━━━━━━━━━━━\n\nResponde:\n  • **negocio** o **1** → ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} del negocio\n  • **personal** o **2** → ${pendiente.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} personal\n  • **cancelar** → abandona el registro (no se guarda nada)`,
          tipo: 'CONFIRMACION',
        }
      }
    }
  }

  // 1. Si es solo un número, ejecutar comando directo
  const numMatch = mensajeNorm.match(/^(\d{1,2})$/)
  if (numMatch) {
    const id = parseInt(numMatch[1])
    const cmd = COMANDOS.find((c) => c.id === id)
    if (cmd) {
      const memoria = obtenerMemoria(sessionId) || {}
      const ctx: ContextoBot = {
        mensajeOriginal: mensaje,
        mensajeNormalizado: mensajeNorm,
        sessionId,
        memoria,
        args: {},
      }
      const resp = await cmd.ejecutar(ctx)
      aprenderDeInteraccion(sessionId, mensaje, id, resp.accionEjecutada !== false)
      return resp
    }
  }

  // 2. Si pide "menu", mostrar menú
  if (/^(menu|menú|comandos|opciones|ayuda|help|qué puedo hacer|que puedo hacer|qué haces|que haces|funciones)\b/i.test(mensajeNorm)) {
    return { texto: generarMenuCompleto(), tipo: 'MENU' }
  }

  // 3. Si es saludo, responder amablemente (sin menú gigante)
  if (SINONIMOS.saludo.some((s) => mensajeNorm === normalizar(s) || mensajeNorm.startsWith(normalizar(s) + ' '))) {
    return {
      texto: `👋 ¡Hola! Soy tu asistente del Portal Admin.\n\nPuedo ayudarte con finanzas, préstamos, cobros, seguridad y más. Escribe en lenguaje natural lo que necesites, o escribe **menu** para ver todos los comandos disponibles.\n\n💡 Ejemplo: *"balance del mes"*, *"préstamos en mora"*, *"registrar gasto de 50.000 por comida"*.`,
      tipo: 'TEXTO',
    }
  }

  // 4. Agradecimientos — solo si el mensaje es CORTO y contiene la palabra exacta
  if (mensajeNorm.length < 30 && SINONIMOS.agradecimiento.some((s) => {
    const sn = normalizar(s)
    return mensajeNorm === sn || mensajeNorm.startsWith(sn + ' ') || mensajeNorm.endsWith(' ' + sn)
  })) {
    return {
      texto: '😊 ¡De nada! Estoy aquí para ayudarte cuando necesites. Escribe **menu** si quieres ver más opciones.',
      tipo: 'TEXTO',
    }
  }

  // 5. Aprendizaje explícito: "aprender: frase = comando"
  const aprenderMatch = mensaje.match(/^aprender:\s*(.+?)\s*=\s*(\d{1,2})\s*$/i)
  if (aprenderMatch) {
    const frase = aprenderMatch[1]
    const comandoId = parseInt(aprenderMatch[2])
    const cmd = COMANDOS.find((c) => c.id === comandoId)
    if (!cmd) {
      return { texto: `❌ No existe el comando #${comandoId}. Escribe **menu** para ver los disponibles.`, tipo: 'TEXTO' }
    }
    aprenderDeInteraccion(sessionId, frase, comandoId, true)
    return {
      texto: `🧠 ¡Aprendido!\n\nCuando escribas **"${frase}"**, ejecutaré el comando **#${comandoId} — ${cmd.nombre}**.`,
      tipo: 'ACCION',
      accionEjecutada: true,
    }
  }

  // 6. Buscar comando aprendido previamente
  const cmdAprendido = buscarComandoAprendido(sessionId, mensaje)
  if (cmdAprendido !== undefined) {
    const cmd = COMANDOS.find((c) => c.id === cmdAprendido)
    if (cmd) {
      const memoria = obtenerMemoria(sessionId) || {}
      const monto = extraerMonto(mensaje)
      const concepto = extraerConcepto(mensaje)
      const ctx: ContextoBot = {
        mensajeOriginal: mensaje,
        mensajeNormalizado: mensajeNorm,
        sessionId,
        memoria,
        args: { monto, concepto },
      }
      const resp = await cmd.ejecutar(ctx)
      aprenderDeInteraccion(sessionId, mensaje, cmdAprendido, resp.accionEjecutada !== false)
      return resp
    }
  }

  // 7. Detección por conceptos (scoring)
  const conceptos = detectarConceptos(mensaje)
  const comandoElegido = elegirComandoPorConceptos(conceptos)
  if (comandoElegido) {
    const memoria = obtenerMemoria(sessionId) || {}
    const monto = extraerMonto(mensaje)
    const concepto = extraerConcepto(mensaje)
    const ambito = conceptos.negocio ? 'NEGOCIO' : conceptos.personal ? 'PERSONAL' : undefined
    const ctx: ContextoBot = {
      mensajeOriginal: mensaje,
      mensajeNormalizado: mensajeNorm,
      sessionId,
      memoria,
      args: { monto, concepto, ambito },
    }
    const resp = await comandoElegido.ejecutar(ctx)
    aprenderDeInteraccion(sessionId, mensaje, comandoElegido.id, resp.accionEjecutada !== false)
    return resp
  }

  // 8. Conocimiento de la plataforma — si el mensaje pregunta por
  // módulos, seguridad, cajas, portales, etc., responder con info detallada.
  const conocimiento = buscarConocimientoPlataforma(mensaje)
  if (conocimiento) {
    return {
      texto: conocimiento,
      tipo: 'TEXTO',
    }
  }

  // 9. Fallback inteligente — sugerir comandos similares
  const sugerencias = sugerirComandos(mensaje)
  return {
    texto: `🤔 No estoy seguro de qué necesitas. ${sugerencias ? `¿Quizás querías alguno de estos?\n\n${sugerencias}` : ''}\n\n💡 Escribe **menu** para ver todos los comandos disponibles, o pruébame con frases como:\n• *"balance del mes"*\n• *"préstamos en mora"*\n• *"registrar gasto de 50.000 por comida"*\n• *"auditoría reciente"*\n• *"qué seguridad tiene la plataforma"*\n• *"qué cajas tiene el sistema"*\n• *"cómo entro al portal jurídico"`,
    tipo: 'TEXTO',
  }
}

// =====================================================
// ELECCIÓN DE COMANDO POR CONCEPTOS DETECTADOS
// =====================================================

function elegirComandoPorConceptos(conceptos: Record<string, number>): ComandoBot | undefined {
  // Buscar el comando que mejor encaje con los conceptos detectados
  const mapConceptoComando: Record<string, number> = {
    registrar_gasto: 1,
    registrar_ingreso: 2,
    balance: 3,
    categoria: 4,
    presupuesto: 5,
    meta: 6,
    reporte: 7,
    prestamo: 8,
    mora: 9,
    cartera: 10,
    auditoria: 11,
    alerta: 12,
    juridico: 14,
    // Análisis
  }

  // Caso especial: "registrar" + "gasto" → 1
  if (conceptos.registrar && conceptos.gasto) return COMANDOS.find((c) => c.id === 1)!
  if (conceptos.registrar && conceptos.ingreso) return COMANDOS.find((c) => c.id === 2)!
  if (conceptos.crear && conceptos.gasto) return COMANDOS.find((c) => c.id === 1)!
  if (conceptos.crear && conceptos.ingreso) return COMANDOS.find((c) => c.id === 2)!
  if (conceptos.crear && conceptos.presupuesto) return COMANDOS.find((c) => c.id === 5)!
  if (conceptos.crear && conceptos.meta) return COMANDOS.find((c) => c.id === 6)!
  if (conceptos.crear && conceptos.alerta) return COMANDOS.find((c) => c.id === 13)!

  // Casos simples por concepto principal
  if (conceptos.balance && conceptos.mes) return COMANDOS.find((c) => c.id === 3)!
  if (conceptos.categoria && conceptos.consultar) return COMANDOS.find((c) => c.id === 4)!
  if (conceptos.presupuesto) return COMANDOS.find((c) => c.id === 5)!
  if (conceptos.meta) return COMANDOS.find((c) => c.id === 6)!
  if (conceptos.reporte && conceptos.mes) return COMANDOS.find((c) => c.id === 7)!
  if (conceptos.prestamo && conceptos.mora) return COMANDOS.find((c) => c.id === 9)!
  if (conceptos.prestamo) return COMANDOS.find((c) => c.id === 8)!
  if (conceptos.mora) return COMANDOS.find((c) => c.id === 9)!
  if (conceptos.cartera) return COMANDOS.find((c) => c.id === 10)!
  if (conceptos.auditoria) return COMANDOS.find((c) => c.id === 11)!
  if (conceptos.alerta) return COMANDOS.find((c) => c.id === 12)!
  if (conceptos.juridico) return COMANDOS.find((c) => c.id === 14)!
  if (conceptos.seguridad) return COMANDOS.find((c) => c.id === 19)!
  if (conceptos.balance) return COMANDOS.find((c) => c.id === 3)!
  if (conceptos.reporte) return COMANDOS.find((c) => c.id === 7)!

  // Análisis
  if (conceptos.analizar && conceptos.prestamo) return COMANDOS.find((c) => c.id === 8)!

  return undefined
}

// =====================================================
// SUGERENCIAS PARA FALLBACK
// =====================================================

function sugerirComandos(mensaje: string): string {
  const conceptos = detectarConceptos(mensaje)
  const topConceptos = Object.entries(conceptos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)
  if (topConceptos.length === 0) return ''
  // Mapear concepto a comando sugerido
  const sugerencias: string[] = []
  for (const c of topConceptos) {
    const map: Record<string, number> = {
      gasto: 1, ingreso: 2, balance: 3, categoria: 4, presupuesto: 5,
      meta: 6, reporte: 7, prestamo: 8, mora: 9, cartera: 10,
      auditoria: 11, alerta: 12, juridico: 14, seguridad: 19,
    }
    if (map[c]) {
      const cmd = COMANDOS.find((x) => x.id === map[c])
      if (cmd) sugerencias.push(`  ${cmd.id}. ${cmd.nombre}`)
    }
  }
  return sugerencias.length > 0 ? `Intenta con:\n${sugerencias.join('\n')}` : ''
}
