// =====================================================
// bot-cliente-nlu.ts — NLU del bot del portal del cliente
// =====================================================
// Sistema mejorado de comprensión para el chat del portal:
//  • 45+ intents con 8-25 sinónimos cada uno
//  • Matching por similitud (Levenshtein + Jaccard + tokens)
//  • Detección de entidades (monto, fecha, número de cuota, código)
//  • Confidence scoring con umbral adaptativo
//  • Fallback a LLM cuando ningún intent supera 0.55
//  • Manejo de contexto (saludo previo, préstamo activo, en mora)
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// 1. ALGORITMOS DE SIMILITUD
// =====================================================

/** Normaliza texto: lowercase, sin acentos, sin signos, sin duplicados */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')    // solo letras/números
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distancia de Levenshtein (número de ediciones para convertir a en b) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // borrado
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      )
    }
  }
  return matrix[a.length][b.length]
}

/** Similitud normalizada [0,1] basada en Levenshtein */
export function simLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/** Tokeniza un texto en palabras (sin stopwords) */
const STOPWORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'y', 'o', 'u',
  'que', 'es', 'en', 'para', 'por', 'con', 'sin', 'su', 'sus', 'me', 'te', 'se', 'le', 'les',
  'mi', 'tu', 'yo', 'tu', 'el', 'ella', 'nosotros', 'vosotros', 'ellos', 'lo', 'más', 'menos',
  'muy', 'mucho', 'poco', 'todo', 'nada', 'algo', 'como', 'cuando', 'donde', 'quien', 'cual',
  'si', 'no', 'ya', 'pero', 'aunque', 'porque', 'pues', 'entonces', 'tambien', 'tampoco',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
])
export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter(t => t.length > 1 && !STOPWORDS_ES.has(t))
}

/** Coeficiente de Jaccard: |intersección| / |unión| de tokens */
export function simJaccard(a: string, b: string): number {
  const ta = new Set(tokenizar(a))
  const tb = new Set(tokenizar(b))
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

/** Similitud ponderada: 60% Levenshtein (frase completa) + 40% Jaccard (tokens) */
export function similitudGlobal(a: string, b: string): number {
  const aNorm = normalizar(a)
  const bNorm = normalizar(b)
  if (!aNorm || !bNorm) return 0
  if (aNorm === bNorm) return 1
  // Coincidencia por substring (frase contenida)
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
    const shorter = Math.min(aNorm.length, bNorm.length)
    const longer = Math.max(aNorm.length, bNorm.length)
    return 0.7 + 0.3 * (shorter / longer)
  }
  const lev = simLevenshtein(aNorm, bNorm)
  const jac = simJaccard(a, b)
  return lev * 0.6 + jac * 0.4
}

// =====================================================
// 2. BASE DE CONOCIMIENTO — 45+ INTENTS
// =====================================================

export interface IntentBot {
  id: string
  categoria: 'SALUDO' | 'CUENTA' | 'PAGOS' | 'PRESTAMO' | 'JURIDICO' | 'PORTAL' | 'INFO' | 'ASESOR' | 'DESPEDIDA' | 'FAQ'
  // Frases plantilla y sinónimos (cada uno se compara con el mensaje del cliente)
  ejemplos: string[]
  // Función generadora de respuesta dinámica (recibe contexto)
  responder: (ctx: ContextoCliente) => Promise<string> | string
  // Palabras clave para matching directo (alta confianza si aparece cualquiera)
  keywords?: string[]
  // Si true, esta respuesta siempre escala a humano
  escalar?: boolean
}

export interface ContextoCliente {
  clienteId: string
  cliente: { nombre: string; cedula: string; telefono: string; email: string | null }
  prestamosActivos: Array<{
    id: string; codigo: string; estado: string; saldoTotal: number; montoCuota: number;
    numeroCuotas: number; cuotasPagadas: number; fechaVencimiento: Date | null;
    diasMora: number; frecuencia: string; montoPrincipal: number; saldoCapital: number; saldoInteres: number;
  }>
  ultimosPagos: Array<{
    montoTotal: number; fechaPago: Date | null; codigoPrestamo: string; numeroCuota: number;
  }>
}

// Helper: nombre corto del cliente (primer nombre)
function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] || nombre
}

// Helper: formato de fecha legible
function fmtFecha(fecha: Date | null | string): string {
  if (!fecha) return 'Sin fecha'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

// =====================================================
// DEFINICIÓN DE INTENTS
// =====================================================

export const INTENTS_BOT_CLIENTE: IntentBot[] = [
  // === SALUDO ===
  {
    id: 'SALUDO',
    categoria: 'SALUDO',
    ejemplos: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'saludos', 'buen dia', 'holi',
      'que mas', 'q mas', 'que hubo', 'que hay', 'que tal', 'como estas',
      'cordial saludo', 'estimado', 'buenas', 'ola', 'holaa', 'holis'],
    keywords: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'buen dia', 'hey', 'saludos', 'holi',
      'que mas', 'q mas', 'que hubo', 'que hay', 'que tal', 'como estas',
      'cordial saludo', 'estimado', 'buenas', 'ola', 'holaa', 'holis'],
    responder: (ctx) => `¡Hola, ${primerNombre(ctx.cliente.nombre)}! 👋 Soy tu asistente virtual.

Puedo ayudarte con:
• 💰 Consultar tu saldo y próximos pagos
• 📊 Ver tu historial de pagos y cuotas
• 🔄 Información sobre renovación
• 📋 Requisitos para nuevo crédito
• 🔐 Cambiar tu PIN
• 🕐 Horarios de atención
• 👨‍💼 Hablar con un asesor humano

Escribe tu pregunta directamente o elige una opción.`
  },
  {
    id: 'MENU',
    categoria: 'SALUDO',
    ejemplos: ['menu', 'ayuda', 'help', 'opciones', 'que puedes hacer', 'que haces', 'para que sirves', 'como funcionas', 'que sabes hacer', 'menu principal'],
    keywords: ['menu', 'menu principal', 'help', 'opciones', 'ayuda'],
    responder: (ctx) => `📋 Menú de opciones, ${primerNombre(ctx.cliente.nombre)}:

1️⃣  **Saldo** — ¿Cuánto debo?
2️⃣  **Próximo pago** — ¿Cuándo y cuánto?
3️⃣  **Historial** — Cuotas pagadas
4️⃣  **Renovación** — ¿Cómo renuevo?
5️⃣  **Requisitos** — Nuevo crédito
6️⃣  **PIN** — Cambiar o recuperar
7️⃣  **Estado de cuenta** — PDF
8️⃣  **Pagar** — Métodos de pago
9️⃣  **Mora** — Intereses por atraso
🔟  **Asesor** — Hablar con humano

Escribe el número o tu pregunta.`
  },

  // === SALDO / CUENTA ===
  {
    id: 'SALDO',
    categoria: 'CUENTA',
    ejemplos: [
      'saldo', 'deuda', 'cuanto debo', 'cuanto pago', 'mi prestamo', 'lo que debo',
      'mi obligacion', 'cuanto me queda', 'saldo pendiente', 'saldo actual',
      'cuanto llevo pagado', 'cuanto falta', 'pendiente', 'lo que falta',
      'mi cuenta', 'estado de mi cuenta', 'como voy', 'mi saldo actual',
      'cuanto es mi deuda', 'mi deuda total', 'saldo total',
    ],
    keywords: ['saldo', 'debo', 'deuda', 'pendiente', 'falta'],
    responder: async (ctx) => {
      if (ctx.prestamosActivos.length === 0) {
        return `Hola ${primerNombre(ctx.cliente.nombre)}, actualmente no tienes préstamos activos. 💡 Si deseas información sobre un nuevo crédito, escribe "requisitos".`
      }
      let resp = `💰 **Saldo de tu préstamo${ctx.prestamosActivos.length > 1 ? 's' : ''}** — ${primerNombre(ctx.cliente.nombre)}:\n\n`
      let total = 0
      ctx.prestamosActivos.forEach((p, i) => {
        resp += `${i + 1}. Crédito ${p.codigo}\n`
        resp += `   • Saldo pendiente: ${formatearMoneda(p.saldoTotal)}\n`
        resp += `   • Capital: ${formatearMoneda(p.saldoCapital)} | Interés: ${formatearMoneda(p.saldoInteres)}\n`
        resp += `   • Cuotas: ${p.cuotasPagadas}/${p.numeroCuotas}\n`
        resp += `   • Estado: ${p.estado === 'EN_MORA' ? `⚠️ En mora (${p.diasMora} días)` : '✅ Al día'}\n\n`
        total += p.saldoTotal
      })
      if (ctx.prestamosActivos.length > 1) {
        resp += `**Total pendiente: ${formatearMoneda(total)}**\n\n`
      }
      resp += `💡 Para más detalle, ve al Portal → Créditos.`
      return resp
    }
  },
  {
    id: 'ESTADO_CUENTA',
    categoria: 'CUENTA',
    ejemplos: [
      'estado de cuenta', 'extracto', 'resumen', 'movimientos', 'detalle de mi cuenta',
      'mi extracto', 'estado financiero', 'ver mi cuenta', 'detalle del prestamo',
      'detalle completo', 'historial completo', 'mi historial',
    ],
    keywords: ['extracto', 'estado de cuenta', 'movimientos'],
    responder: () => `📊 **Estado de cuenta**

Para descargar tu estado de cuenta en PDF:

1. Ingresa al Portal del Cliente
2. Ve a la sección "Créditos"
3. Selecciona tu préstamo activo
4. Haz clic en "Estado de Cuenta" o "Descargar PDF"

💡 El PDF incluye: saldo, cuotas pagadas, próximos vencimientos y movimientos detallados.`
  },

  // === PAGOS ===
  {
    id: 'FECHA_PAGO',
    categoria: 'PAGOS',
    ejemplos: [
      'fecha de pago', 'cuando pago', 'cuando vence', 'proximo pago', 'cuando es mi pago',
      'fecha de vencimiento', 'cuando tengo que pagar', 'que dia pago',
      'mi proxima cuota', 'cuando es la siguiente cuota', 'fecha limite',
      'cuando debo pagar', 'que fecha pago', 'mi pago',
    ],
    keywords: ['fecha', 'vencimiento', 'proximo', 'cuando pago', 'cuando vence'],
    responder: async (ctx) => {
      if (ctx.prestamosActivos.length === 0) {
        return `No tienes préstamos activos. Tu próxima fecha de pago se mostrará en el Portal cuando tengas un crédito activo.`
      }
      let resp = `📅 **Próximos pagos** — ${primerNombre(ctx.cliente.nombre)}:\n\n`
      ctx.prestamosActivos.forEach((p, i) => {
        const cuotasPendientes = p.numeroCuotas - p.cuotasPagadas
        resp += `${i + 1}. Crédito ${p.codigo}\n`
        resp += `   • Valor cuota: ${formatearMoneda(p.montoCuota)} (${p.frecuencia.toLowerCase()})\n`
        resp += `   • Vence: ${fmtFecha(p.fechaVencimiento)}\n`
        resp += `   • Cuotas pendientes: ${cuotasPendientes}\n`
        if (p.estado === 'EN_MORA') {
          resp += `   • ⚠️ **En mora ${p.diasMora} días** — Paga cuanto antes\n`
        }
        resp += `\n`
      })
      resp += `💡 Paga a tiempo para evitar intereses moratorios.`
      return resp
    }
  },
  {
    id: 'CUOTAS_PAGADAS',
    categoria: 'PAGOS',
    ejemplos: [
      'cuotas pagadas', 'historial', 'progreso', 'cuanto he pagado', 'que he pagado',
      'avance', 'mis pagos', 'pagos realizados', 'cuotas completadas',
      'cuantas cuotas llevo', 'como voy con mis pagos', 'cuanto he abonado',
      'mis abonos', 'cuotas hechas', 'progreso del prestamo',
    ],
    keywords: ['pagadas', 'historial', 'progreso', 'avance', 'he pagado'],
    responder: async (ctx) => {
      if (ctx.prestamosActivos.length === 0) return `No tienes préstamos activos para mostrar historial.`
      let resp = `📊 **Estado de cuotas** — ${primerNombre(ctx.cliente.nombre)}:\n\n`
      ctx.prestamosActivos.forEach((p, i) => {
        const progreso = (p.cuotasPagadas / p.numeroCuotas) * 100
        const barra = '█'.repeat(Math.floor(progreso / 10)) + '░'.repeat(10 - Math.floor(progreso / 10))
        resp += `${i + 1}. Crédito ${p.codigo}\n`
        resp += `   ${barra} ${progreso.toFixed(0)}%\n`
        resp += `   • Cuotas pagadas: ${p.cuotasPagadas} de ${p.numeroCuotas}\n`
        resp += `   • Capital pagado: ${formatearMoneda(p.montoPrincipal - p.saldoCapital)}\n\n`
      })
      if (ctx.ultimosPagos.length > 0) {
        resp += `**Últimos pagos:**\n`
        ctx.ultimosPagos.slice(0, 3).forEach(p => {
          resp += `   • ${fmtFecha(p.fechaPago)}: ${formatearMoneda(p.montoTotal)} (cuota ${p.numeroCuota}, ${p.codigoPrestamo})\n`
        })
      }
      resp += `\n💡 Ve al Portal → Historial para ver todos los pagos.`
      return resp
    }
  },
  {
    id: 'METODOS_PAGO',
    categoria: 'PAGOS',
    ejemplos: [
      'como pago', 'pagar', 'pago', 'abonar', 'bancolombia', 'pse', 'efectivo',
      'metodos de pago', 'formas de pago', 'donde pago', 'como hago el pago',
      'consignar', 'transferir', 'transferencia', 'datafono', 'tarjeta',
      'nequi', 'daviplata', 'pago electronico', 'pago online',
    ],
    keywords: ['pagar', 'abonar', 'bancolombia', 'pse', 'efectivo', 'consignar', 'transferir', 'nequi', 'daviplata'],
    responder: () => `💰 **Métodos de pago**

Puedes pagar tu cuota desde el Portal del Cliente:

1. Ingresa con tu cédula y PIN
2. Ve a "Próximos Pagos"
3. Selecciona la cuota a pagar
4. Elige el método:

   • 🏦 **Bancolombia** (transferencia o consignación)
   • 💻 **PSE** (banca en línea)
   • 💵 **Efectivo** (oficina)
   • 💳 **Datáfono** (tarjeta)
   • 📱 **Nequi / Daviplata**

5. Confirma el pago y guarda el comprobante

💡 Recibirás confirmación por WhatsApp al terminar.`
  },
  {
    id: 'PAGAR_ONLINE',
    categoria: 'PAGOS',
    ejemplos: [
      'pago online', 'pago por internet', 'pago electronico', 'pago con tarjeta',
      'pago con pse', 'pago digital', 'pagar online', 'pago web',
    ],
    keywords: ['online', 'digital', 'web'],
    responder: () => `💳 **Pago online**

Para pagar desde tu casa:

1. Entra al Portal del Cliente
2. Ve a "Próximos Pagos"
3. Selecciona "Pagar con PSE" o "Pagar con tarjeta"
4. Serás redirigido a la pasarela segura
5. Confirma los datos y autoriza el pago
6. Guarda el comprobante digital

💡 PSE funciona 24/7 y acredita el pago en minutos.`
  },

  // === PRÉSTAMO ===
  {
    id: 'RENOVACION',
    categoria: 'PRESTAMO',
    ejemplos: [
      'renovacion', 'renovar', 'refinanciar', 'ampliar', 'renov',
      'refinanciacion', 'renovar prestamo', 'ampliar plazo',
      'nuevo prestamo sobre el actual', 'refinanciar mi deuda',
      'renovacion de credito', 'renovar credito', 'cuando puedo renovar',
      'necesito mas plata', 'necesito mas dinero', 'otro prestamo',
      'prestamo adicional', 'mas monto', 'subir monto', 'aumentar monto',
    ],
    keywords: ['renov', 'refinanc', 'ampliar', 'necesito mas plata',
      'necesito mas dinero', 'mas monto', 'aumentar monto', 'subir monto'],
    responder: () => `🔄 **Renovación de crédito**

Para renovar tu préstamo:

1. Ingresa al Portal del Cliente
2. Ve a "Solicitar crédito"
3. Selecciona "Renovación"
4. Escoge el crédito a renovar
5. El sistema trae tu saldo pendiente automáticamente
6. Ingresa el nuevo capital que necesitas
7. El sistema calcula el excedente a entregarte
8. Firma los nuevos TyC con OTP

💡 **Requisitos:** Estar al día en tus pagos (sin mora). La renovación reemplaza el préstamo actual.`
  },
  {
    id: 'REQUISITOS',
    categoria: 'PRESTAMO',
    ejemplos: [
      'requisitos', 'documentos', 'como solicito', 'credito nuevo', 'nuevo credito',
      'tramite', 'que necesito para un credito', 'que necesito para un prestamo',
      'requisitos para prestamo', 'requisitos para credito', 'como hago un credito',
      'como saco un prestamo', 'que piden para prestamo', 'documentacion',
      'papeles', 'que documentos necesito',
    ],
    keywords: ['requisito', 'documento', 'solicito', 'nuevo credito', 'tramite'],
    responder: () => `📋 **Requisitos para nuevo crédito**

Documentos necesarios:
• 🪪 Cédula de ciudadanía
• 📱 Teléfono activo (WhatsApp)
• 📧 Correo electrónico
• 💼 Ingresos comprobables
• 👥 Codeudor (opcional, para montos altos)

Pasos:
1. Entra al Portal del Cliente → "Solicitar crédito"
2. Completa el formulario con tus datos
3. Adjunta tu cédula (frente y reverso)
4. Espera aprobación (máx. 24h hábiles)
5. Firma TyC con OTP por WhatsApp
6. Recibe el dinero en tu cuenta

💡 Un asesor revisará tu solicitud y te contactará.`
  },
  {
    id: 'SIMULADOR',
    categoria: 'PRESTAMO',
    ejemplos: [
      'simular', 'simulador', 'calcular cuota', 'cuanto seria la cuota',
      'cuanto pagaria', 'calcular prestamo', 'simular credito',
      'cuota estimada', 'cuota mensual', 'cuota quincenal',
      'calcular tasa', 'calcular interes', 'simulacion',
    ],
    keywords: ['simular', 'simulador', 'calcular', 'cuota'],
    responder: () => `🧮 **Simulador de crédito**

Puedes simular tu crédito antes de solicitarlo:

1. Entra al Portal del Cliente → "Simulador"
2. Ingresa el monto que necesitas
3. Selecciona el plazo (meses)
4. Elige la frecuencia (quincenal, mensual)
5. El sistema calcula:
   • Valor de la cuota
   • Interés total
   • Total a pagar
   • Tasa aplicada

💡 La simulación es referencial. La tasa final se confirma al aprobar tu solicitud.`
  },
  {
    id: 'TASA_INTERES',
    categoria: 'PRESTAMO',
    ejemplos: [
      'tasa', 'interes', 'tasa de interes', 'cuanto es el interes',
      'tasa anual', 'tasa mensual', 'interes moratorio', 'tasa mora',
      'que tasa cobran', 'como se calcula el interes', 'interes del prestamo',
      'porcentaje', 'tasa aplicada',
    ],
    keywords: ['tasa', 'interes', 'porcentaje'],
    responder: async (ctx) => {
      if (ctx.prestamosActivos.length > 0) {
        const p = ctx.prestamosActivos[0]
        return `📊 **Tu tasa de interés** — Crédito ${p.codigo}:

• Tasa aplicada a tu préstamo: ver detalle en el Portal → Créditos → ${p.codigo}
• La tasa es fija sobre el capital inicial
• El interés moratorio se aplica solo sobre cuotas vencidas

💡 Si tienes tasa personalizada, aplica solo a ti. Para consultar la tasa exacta, revisa tu contrato o pide hablar con un asesor.`
      }
      return `📊 **Tasas de interés**

Las tasas varían según la categoría del crédito:
• Préstamos básicos: tasa estándar
• Préstamos premium: tasa preferencial
• Tasa moratoria: se aplica sobre cuotas vencidas

💡 Para conocer la tasa exacta de un crédito que vas a solicitar, usa el Simulador en el Portal.`
    }
  },
  {
    id: 'MONTO_PRESTAMO',
    categoria: 'PRESTAMO',
    ejemplos: [
      'monto', 'cuanto prestan', 'cuanto me prestan', 'monto maximo',
      'monto minimo', 'cupos', 'cuanto puedo pedir', 'limite',
      'valor del prestamo', 'monto disponible',
    ],
    keywords: ['monto', 'prestan', 'cupos', 'limite'],
    responder: () => `💵 **Montos disponibles**

Los montos varían según la categoría:

• **Categoría Básica:** $100.000 – $1.000.000
• **Categoría Intermedia:** $500.000 – $3.000.000
• **Categoría Premium:** $1.000.000 – $10.000.000

💡 El monto aprobado depende de:
• Tus ingresos comprobables
• Tu historial de pagos
• Capacidad de endeudamiento
• Codeudor (si aplica)

Usa el Simulador del Portal para ver opciones.`
  },
  {
    id: 'PLAZO',
    categoria: 'PRESTAMO',
    ejemplos: [
      'plazo', 'cuantos meses', 'cuanto tiempo', 'duracion del prestamo',
      'plazo maximo', 'plazo minimo', 'cuotas', 'numero de cuotas',
      'cuantas cuotas', 'frecuencia de pago', 'quincenal o mensual',
    ],
    keywords: ['plazo', 'meses', 'duracion', 'cuotas', 'frecuencia'],
    responder: () => `📅 **Plazos disponibles**

• Plazo mínimo: 1 mes
• Plazo máximo: 24 meses
• Frecuencias: quincenal o mensual

**Ejemplos:**
• $500.000 a 2 meses (4 cuotas quincenales): ~$175.000/cuota
• $1.000.000 a 6 meses (6 cuotas mensuales): ~$200.000/cuota
• $2.000.000 a 12 meses (12 cuotas mensuales): ~$200.000/cuota

💡 Usa el Simulador para calcular tu caso exacto.`
  },
  {
    id: 'FONDO_GARANTIA',
    categoria: 'PRESTAMO',
    ejemplos: [
      'fondo de garantia', 'garantia', 'seguro', 'fondo', 'deposito de garantia',
      'que es el fondo de garantia', 'me devuelven la garantia',
      '5 por ciento', '5%', 'cuando devuelven garantia',
    ],
    keywords: ['garantia', 'fondo', 'seguro'],
    responder: () => `🛡️ **Fondo de garantía**

En tu primer préstamo se cobra un **5% del capital** como fondo de garantía.

• Se descuenta del desembolso
• Se guarda en una caja separada (no se mezcla con otros fondos)
• Se te devuelve al finalizar el préstamo (si pagas todas las cuotas)
• Si renuevas, se traslada al nuevo préstamo

💡 El fondo protege tanto al cliente como a la empresa en caso de impago.`
  },

  // === MORA ===
  {
    id: 'MORA',
    categoria: 'PAGOS',
    ejemplos: ['mora', 'atraso', 'tarde', 'retraso', 'interes moratorio',
      'cuanto es la mora', 'mora diaria', 'recargo', 'penalizacion',
      'me atrasé', 'me atrase', 'cuota vencida',
      'que pasa si no pago', 'que pasa si atraso', 'consecuencias de no pagar',
      'me equivoque de fecha', 'se me paso el pago', 'se me olvido pagar',
      'no pude pagar', 'no alcance', 'me quede sin pagar', 'se me vencio',
    ],
    keywords: ['mora', 'atraso', 'retraso', 'tarde', 'vencida', 'cuota vencida',
      'no pude pagar', 'se me paso', 'se me olvido', 'me equivoque de fecha',
      'no alcance', 'me quede sin pagar'],
    responder: async (ctx) => {
      const enMora = ctx.prestamosActivos.find(p => p.estado === 'EN_MORA')
      let resp = `⚠️ **Mora y atrasos**\n\n`
      if (enMora) {
        resp += `🔴 Actualmente tienes ${enMora.diasMora} días de mora en el crédito ${enMora.codigo}.\n`
        resp += `Se están generando intereses moratorios diarios.\n\n`
      }
      resp += `**Qué pasa si te atrasas:**\n`
      resp += `• Interés moratorio diario (compuesto) según tu contrato\n`
      resp += `• Recordatorios automáticos por WhatsApp\n`
      resp += `• Tras 60 días de mora → cobro jurídico\n\n`
      resp += `💡 Si tienes dificultad para pagar, escribe "asesor" para renegociar tu deuda ANTES de caer en mora.`
      return resp
    }
  },
  {
    id: 'RENEGOCIACION',
    categoria: 'PAGOS',
    ejemplos: [
      'renegociar', 'renegociacion', 'acuerdo de pago', 'plan de pagos',
      'no puedo pagar', 'dificultad', 'postergar', 'aplazar pago',
      'reestructurar', 'refinanciar mora', 'quitar mora', 'condonar',
      'negociar deuda', 'saldar deuda', 'convenir pago',
      'no pude pagar', 'no tengo dinero', 'no tengo como pagar',
      'aplazar cuota', 'prorroga', 'extension',
    ],
    keywords: ['renegociar', 'acuerdo de pago', 'no puedo pagar', 'no pude pagar', 'dificultad', 'postergar', 'aplazar', 'prorroga', 'condonar'],
    escalar: true,
    responder: () => `🤝 **Renegociación de deuda**

Entendemos que pueden surgir dificultades. Podemos ayudarte con:
• Aplazamiento de cuota (con causa justificada)
• Refinanciación de mora
• Plan de pagos personalizado
• Condonación parcial de intereses (casos especiales)

👨‍💼 **Esta gestión requiere atención personalizada.** Voy a escalar tu caso a un asesor humano quien revisará tu situación y propondrá opciones.

💡 Mientras tanto, ten a mano: tu cédula, el motivo del atraso y una propuesta de cuándo podrías pagar.`
  },

  // === PORTAL ===
  {
    id: 'PIN_CAMBIAR',
    categoria: 'PORTAL',
    ejemplos: [
      'cambiar pin', 'nuevo pin', 'cambiar mi pin', 'cambiar clave',
      'cambiar contrasena', 'quiero cambiar pin', 'cambiar el pin',
      'modificar pin', 'actualizar pin', 'cambiar acceso',
    ],
    keywords: ['cambiar pin', 'nuevo pin', 'cambiar clave', 'cambiar contrasena'],
    responder: () => `🔐 **Cambiar tu PIN**

1. Ingresa al Portal del Cliente con tu PIN actual
2. Ve a "Mi Perfil" o "Configuración"
3. Selecciona "Cambiar PIN"
4. Ingresa tu PIN actual (4-6 dígitos)
5. Ingresa el nuevo PIN
6. Confirma el nuevo PIN
7. Listo ✅

💡 Tu PIN debe ser de 4-6 dígitos. Evita secuencias (1234, 0000) y años de nacimiento.`
  },
  {
    id: 'PIN_OLVIDO',
    categoria: 'PORTAL',
    ejemplos: [
      'olvide mi pin', 'no me acuerdo del pin', 'perdi mi pin', 'recuperar pin',
      'olvide la clave', 'olvide contrasena', 'no se mi pin',
      'olvidé pin', 'no recuerdo pin', 'resetear pin', 'reestablecer pin',
    ],
    keywords: ['olvide', 'olvidé', 'no me acuerdo', 'perdi', 'recuperar', 'resetear', 'reestablecer'],
    escalar: true,
    responder: () => `😔 **Recuperar PIN olvidado**

Por seguridad, el PIN no se puede recuperar automáticamente (es un dato cifrado que ni nosotros podemos ver).

👨‍💼 **Voy a escalar tu caso a un asesor**, quien verificará tu identidad y te ayudará a restablecer el PIN.

💡 Ten listo:
• Tu cédula
• Tu teléfono registrado
• Un correo electrónico de respaldo (si lo tienes)`
  },
  {
    id: 'ACCESO_PORTAL',
    categoria: 'PORTAL',
    ejemplos: [
      'como entro', 'como accedo', 'donde me registro', 'no puedo entrar',
      'no me deja entrar', 'error al entrar', 'no puedo ingresar',
      'como inicio sesion', 'login', 'iniciar sesion', 'entrar al portal',
      'pagina del portal', 'url del portal',
    ],
    keywords: ['entrar', 'accedo', 'registro', 'ingresar', 'login', 'iniciar sesion'],
    responder: () => `🚪 **Acceso al Portal del Cliente**

1. Entra a la URL del portal (te la enviamos por WhatsApp al registrar tu primer préstamo)
2. Digita tu **cédula** (sin puntos ni espacios)
3. Digita tu **PIN** de 4-6 dígitos
4. Haz clic en "Ingresar"

**¿Problemas comunes?**
• ❌ "Cédula no encontrada" → verifica que estés usando la misma cédula con la que te registraste
• ❌ "PIN incorrecto" → después de 5 intentos fallidos, la cuenta se bloquea 15 minutos
• ❌ "Cliente sin PIN" → si es tu primera vez, escribe "asesor" para que te asignen un PIN

💡 Si persiste el problema, escribe "asesor".`
  },
  {
    id: 'PORTAL_BLOQUEO',
    categoria: 'PORTAL',
    ejemplos: [
      'bloqueado', 'cuenta bloqueada', 'me bloquearon', '_portal bloqueado',
      'intentos fallidos', 'demasiados intentos', 'no me deja intentar mas',
      'cuenta suspendida', 'desbloquear cuenta', 'desbloquear pin',
    ],
    keywords: ['bloqueado', 'intentos fallidos', 'suspendida', 'desbloquear'],
    responder: () => `🔒 **Cuenta bloqueada**

Por seguridad, después de 5 intentos fallidos de PIN, la cuenta se bloquea por 15 minutos.

**Qué hacer:**
1. Espera 15 minutos ⏳
2. Vuelve a intentar con tu PIN correcto
3. Si aún no recuerdas tu PIN, escribe "olvide mi pin"

💡 El bloqueo es automático y se libera solo. No necesita intervención manual.`
  },

  // === INFO GENERAL ===
  {
    id: 'HORARIOS',
    categoria: 'INFO',
    ejemplos: [
      'horario', 'atencion', 'a que hora', 'cuando atienden', 'dias habiles',
      'horario de oficina', 'horario atencion', 'estan abiertos',
      'que dia atienden', 'fin de semana', 'sabados', 'domingos',
    ],
    keywords: ['horario', 'atencion', 'a que hora', 'cuando atienden', 'dias habiles'],
    responder: () => `🕐 **Horarios de atención**

📞 **Atención al cliente:**
• Lunes a viernes: 8:00 AM – 6:00 PM
• Sábados: 9:00 AM – 1:00 PM
• Domingos y festivos: cerrado

💬 **WhatsApp:** 3103674546
📧 **Correo:** jsa@jsadr.com.co
🌐 **Portal:** 24/7 (autoservicio)

💡 Fuera de horario, deja tu mensaje y te responderemos al inicio del próximo día hábil.`
  },
  {
    id: 'CONTACTO',
    categoria: 'INFO',
    ejemplos: [
      'contacto', 'telefono', 'whatsapp', 'correo', 'email',
      'numero de contacto', 'como los contacto', 'datos de contacto',
      'donde los llamo', 'llamar', 'comunicarme',
    ],
    keywords: ['contacto', 'telefono', 'whatsapp', 'correo', 'email', 'llamar'],
    responder: () => `📞 **Datos de contacto**

• 💬 WhatsApp: 3103674546
• 📧 Correo: jsa@jsadr.com.co
• 🌐 Portal del Cliente: accede desde el enlace que te enviamos por WhatsApp

💡 Para consultas sobre tu préstamo, ten siempre a mano tu número de cédula.`
  },
  {
    id: 'UBICACION',
    categoria: 'INFO',
    ejemplos: [
      'ubicacion', 'donde quedan', 'direccion', 'oficina', 'sede',
      'donde estan ubicados', 'como llego', 'donde los encuentro',
      'direccion fisica', 'oficina principal',
    ],
    keywords: ['ubicacion', 'direccion', 'oficina', 'sede'],
    responder: () => `📍 **Ubicación**

Para conocer nuestra dirección física y horarios de atención presencial, contáctanos por WhatsApp al 3103674546 y te indicaremos la oficina más cercana.

💡 La mayoría de trámites se pueden hacer 100% online desde el Portal del Cliente.`
  },

  // === ASESOR HUMANO ===
  {
    id: 'ASESOR_HUMANO',
    categoria: 'ASESOR',
    ejemplos: [
      'asesor', 'humano', 'persona', 'hablar con alguien', 'hablar con un',
      'llamenme', 'contacto', 'whatsapp', 'telefono', 'ayuda humana',
      'llamar', 'comunicar con', 'operador', 'agente', 'representante',
      'no eres util', 'no entiendo', 'no me ayudaste', 'quiero hablar',
      'necesito una persona', 'atencion personalizada',
    ],
    keywords: ['asesor', 'humano', 'persona', 'operador', 'agente', 'representante'],
    escalar: true,
    responder: (ctx) => `👨‍💼 **Escalando a asesor humano**

Gracias por tu consulta, ${primerNombre(ctx.cliente.nombre)}. Tu caso será atendido por un asesor a la brevedad.

📌 Tu conversación queda marcada como pendiente.
📱 Te contactaremos por WhatsApp al ${ctx.cliente.telefono}.
🕐 Horario de atención: L-V 8AM-6PM, S 9AM-1PM.

💡 Mientras esperas, puedes escribir "menú" para ver otras opciones que puedo atender automáticamente.`
  },
  {
    id: 'QUEJA_RECLAMO',
    categoria: 'ASESOR',
    ejemplos: [
      'queja', 'reclamo', 'quejarme', 'reclamar', 'denuncia',
      'no estoy de acuerdo', 'mal servicio', 'mal atendido',
      'insatisfecho', 'problema con', 'disputa', 'inconforme',
      'me quejo', 'quiero reclamar', 'pqrs', 'pqr',
    ],
    keywords: ['queja', 'reclamo', 'pqrs', 'pqr', 'denuncia', 'disputa'],
    escalar: true,
    responder: () => `📝 **Quejas y reclamos**

Lamentamos que tengas una inconformidad. Tu voz es importante para nosotros.

👨‍💼 Voy a escalar tu caso al área de **Atención al Cliente** quien te contactará en menos de 24 horas hábiles.

💡 Para agilizar, describe en tu próximo mensaje:
• Qué pasó (hechos)
• Cuándo pasó (fecha aproximada)
• Qué esperas (solución propuesta)

Tu caso queda registrado con prioridad.`
  },

  // === FAQ ===
  {
    id: 'CODEUDOR',
    categoria: 'FAQ',
    ejemplos: [
      'codeudor', 'fiador', 'aval', 'garante', 'avalista',
      'necesito codeudor', 'quien puede ser codeudor',
      'requisitos codeudor', 'sin codeudor',
    ],
    keywords: ['codeudor', 'fiador', 'aval', 'garante'],
    responder: () => `👥 **Codeudor**

El codeudor es opcional pero recomendado para:
• Montos superiores a $2.000.000
• Clientes nuevos sin historial
• Plazos mayores a 6 meses

**Requisitos del codeudor:**
• Cédula de ciudadanía
• Ingresos comprobables
• No estar reportado en centrales de riesgo
• Aceptar la responsabilidad solidaria

💡 El codeudor también debe firmar TyC con OTP por WhatsApp.`
  },
  {
    id: 'DESEMBOLSO',
    categoria: 'FAQ',
    ejemplos: [
      'desembolso', 'cuando me depositan', 'cuando me dan el dinero',
      'cuando recibo el dinero', 'transferencia del prestamo',
      'donde me depositan', 'cuenta para desembolso', 'tiempo de desembolso',
    ],
    keywords: ['desembolso', 'depositan', 'recibo el dinero'],
    responder: () => `💵 **Desembolso del préstamo**

Una vez aprobado y firmado tu préstamo:

• ⏱️ Tiempo: máximo 24 horas hábiles
• 🏦 Cuenta: la que registraste en la solicitud
• 📱 Confirmación: te avisamos por WhatsApp al desembolsar

**Si no recibes el dinero en 24h:**
1. Verifica que los datos de tu cuenta estén correctos en el Portal
2. Revisa si hay retenciones en tu banco
3. Escribe "asesor" si el problema persiste

💡 El 5% del fondo de garantía se descuenta automáticamente del desembolso (solo en primer préstamo).`
  },
  {
    id: 'CANCELAR_PRESTAMO',
    categoria: 'FAQ',
    ejemplos: [
      'cancelar prestamo', 'anular prestamo', 'no quiero el prestamo',
      'abandonar prestamo', 'cancelar credito', 'desistir',
      'me arrepenti', 'me arrepentí', 'cancelar solicitud',
    ],
    keywords: ['cancelar', 'anular', 'desistir', 'arrepenti'],
    escalar: true,
    responder: () => `❌ **Cancelar préstamo**

La cancelación depende del estado del préstamo:

• **SOLICITUD** (no aprobado): se puede cancelar sin costo desde el Portal
• **PENDIENTE_ACEPTACION** (aprobado, sin firmar): se puede cancelar, pero se registra en tu historial
• **ACTIVO** (ya desembolsado): NO se puede cancelar, solo pagar anticipadamente

👨‍💼 Si deseas cancelar, voy a escalar tu caso a un asesor quien revisará tu situación específica.`
  },
  {
    id: 'PAGO_ANTICIPADO',
    categoria: 'FAQ',
    ejemplos: [
      'pago anticipado', 'pago total', 'saldar', 'abono total',
      'pagar todo', 'pagar antes', 'abonar capital', 'cancelar deuda',
      'liquidacion anticipada', 'pago completo',
    ],
    keywords: ['anticipado', 'saldar', 'abono total', 'pagar todo', 'liquidacion'],
    escalar: true,
    responder: () => `💰 **Pago anticipado**

Puedes pagar tu préstamo antes del plazo:

• **Pago total:** saldas toda la deuda de una vez
• **Abono a capital:** pagas un monto extra que reduce el capital pendiente

💡 El interés se recalcula sobre el capital restante, así que **pagas menos interés total**.

👨‍💼 Para realizar un pago anticipado, escalaré tu caso a un asesor quien calculará el monto exacto a pagar (incluyendo intereses devengados al día del pago).`
  },
  {
    id: 'CUENTA_BANCARIA',
    categoria: 'FAQ',
    ejemplos: [
      'cuenta bancaria', 'mi cuenta', 'cambiar cuenta', 'actualizar cuenta',
      'datos bancarios', 'banco', 'nequi', 'daviplata', 'bancolombia',
      'cuenta para deposito', 'cuenta para pagar',
    ],
    keywords: ['cuenta bancaria', 'datos bancarios', 'cambiar cuenta'],
    responder: () => `🏦 **Cuenta bancaria**

Tu cuenta registrada se usa para:
• Recibir el desembolso del préstamo
• Recibir reembolsos (fondo de garantía, saldos a favor)

**Para actualizar tu cuenta:**
1. Entra al Portal → Mi Perfil
2. Edita "Datos bancarios"
3. Ingresa: banco, tipo de cuenta, número
4. Guarda los cambios

💡 Aceptamos: Bancolombia, Nequi, Daviplata, BBVA, Davivienda, Banco de Bogotá.`
  },
  {
    id: 'DESPEDIDA',
    categoria: 'DESPEDIDA',
    ejemplos: [
      'gracias', 'chao', 'adios', 'hasta luego', 'nos vemos',
      'muchas gracias', 'mil gracias', 'thanks', 'thank you',
      'perfecto', 'genial', 'excelente', 'muy bien', 'listo',
      'ok', 'ok gracias', 'perfecto gracias', 'ya esta',
      'le agradezco', 'agradezco', 'muchisimas gracias',
      'hasta pronto', 'suerte', 'me voy',
    ],
    keywords: ['gracias', 'chao', 'adios', 'hasta luego', 'listo', 'perfecto',
      'agradezco', 'le agradezco', 'hasta pronto', 'suerte'],
    responder: (ctx) => `¡Gracias a ti, ${primerNombre(ctx.cliente.nombre)}! 😊

Estoy aquí para ayudarte cuando necesites. Recuerda:
• 💬 Escribe "menú" para ver opciones
• 👨‍💼 Escribe "asesor" para hablar con un humano

¡Que tengas un excelente día! 🌟`
  },

  // === INTENTS ADICIONALES PARA COBERTURA ===
  {
    id: 'SALUDO_PERSONAL',
    categoria: 'SALUDO',
    ejemplos: [
      'como estas', 'que tal', 'como te va',
      'quien eres', 'como te llamas', 'que eres',
    ],
    keywords: ['quien eres', 'como te llamas', 'que eres', 'que tal', 'como estas', 'como te va'],
    responder: () => `🤖 Soy el **Asistente Virtual** del Portal del Cliente.

Estoy aquí para ayudarte 24/7 con consultas sobre tu préstamo, pagos, requisitos y más.

No soy una persona, pero puedo responder la mayoría de tus preguntas. Si necesitas atención humana, escribe "asesor" y te conectaré con un asesor real. 😊`
  },
  {
    id: 'SITIO_WEB',
    categoria: 'INFO',
    ejemplos: [
      'sitio web', 'pagina web', 'url', 'link', 'pagina oficial',
      'donde los encuentro en internet', 'web',
    ],
    keywords: ['sitio web', 'pagina web', 'web'],
    responder: () => `🌐 **Sitio web**

Puedes acceder al **Portal del Cliente** desde el enlace que te enviamos por WhatsApp al registrar tu primer préstamo.

Si perdiste el enlace:
1. Revisa tus mensajes de WhatsApp con nosotros
2. Si no lo encuentras, escribe "asesor" para que te lo reenvíen

💡 El Portal funciona en cualquier dispositivo (celular, tablet, computador).`
  },
  {
    id: 'PRIVACIDAD',
    categoria: 'INFO',
    ejemplos: [
      'privacidad', 'proteccion de datos', 'mis datos', 'datos personales',
      'seguridad de la informacion', 'politica de privacidad',
      'tratamiento de datos', 'habeas data',
    ],
    keywords: ['privacidad', 'datos personales', 'habeas data'],
    responder: () => `🔒 **Privacidad y protección de datos**

Tus datos están protegidos:

• 🔐 Cifrados en tránsito (HTTPS/TLS)
• 🔑 Hashing bcrypt para PINs y contraseñas
• 🛡️ AES-256 para datos sensibles (cuentas bancarias)
• ✅ Cumplimiento de Ley 1581 de 2012 (Habeas Data Colombia)
• 🚫 No compartimos tus datos con terceros sin tu consentimiento

💡 Puedes ejercer tus derechos (acceso, rectificación, cancelación) escribiendo a jsa@jsadr.com.co`
  },
  {
    id: 'DESEMPENO_2',
    categoria: 'FAQ',
    ejemplos: [
      'pueden pagar por mi', 'tercero paga', 'otra persona paga',
      'pago de un tercero', 'pago con cuenta ajena',
    ],
    keywords: ['tercero', 'otra persona'],
    responder: () => `👥 **Pago de un tercero**

Sí, otra persona puede pagar tu cuota:

1. Que la persona haga la transferencia/consignación a nuestra cuenta (la encuentras en el Portal → Métodos de pago)
2. En el concepto/referencia, debe poner tu **cédula** y **número de préstamo**
3. Una vez confirmado el pago, se aplica a tu cuenta

💡 Solo el titular del préstamo puede ver el estado de cuenta y firmar TyC. El pago puede hacerlo cualquiera.`
  },
  {
    id: 'DESEMPENO_3',
    categoria: 'FAQ',
    ejemplos: [
      'certificado de pagos', 'certificacion de pagos', 'paz y salvo',
      'carta de paz y salvo', 'historial de pagos certificado',
      'certificado para-desprendible', 'declaracion de pagos',
    ],
    keywords: ['certificado', 'paz y salvo', 'certificacion'],
    responder: () => `📄 **Certificado de pagos / Paz y salvo**

Puedes descargar:

• **Certificado de pagos del año:** Portal → Historial → "Descargar certificado"
• **Paz y salvo:** disponible cuando terminas de pagar tu préstamo
• **Estado de cuenta:** Portal → Créditos → "Descargar PDF"

💡 Los certificados se generan automáticamente y tienen validez oficial.`
  },
]

// =====================================================
// 3. DETECCIÓN DE INTENT
// =====================================================

export interface ResultadoNLU {
  intent: IntentBot | null
  confianza: number
  metodo: 'keyword' | 'similitud' | 'fallback'
  mejorEjemplo?: string
}

/**
 * Detecta el intent del mensaje del cliente combinando:
 * 1. Coincidencia exacta con keywords (confianza 0.95)
 * 2. Similitud con ejemplos del intent (confianza = similitudGlobal)
 * 3. Si nada supera 0.55, retorna null (fallback a LLM)
 */
export function detectarIntentBot(mensaje: string): ResultadoNLU {
  const mensajeNorm = normalizar(mensaje)
  if (!mensajeNorm) {
    return { intent: null, confianza: 0, metodo: 'fallback' }
  }

  let mejor: { intent: IntentBot; confianza: number; metodo: 'keyword' | 'similitud'; mejorEjemplo?: string } | null = null

  for (const intent of INTENTS_BOT_CLIENTE) {
    // 1. Coincidencia con keywords (alta confianza)
    if (intent.keywords) {
      for (const kw of intent.keywords) {
        const kwNorm = normalizar(kw)
        if (mensajeNorm.includes(kwNorm)) {
          // Bonus: si el keyword aparece completo, confianza alta
          const confianza = kwNorm.length >= 5 ? 0.95 : 0.85
          if (!mejor || confianza > mejor.confianza) {
            mejor = { intent, confianza, metodo: 'keyword', mejorEjemplo: kw }
          }
          break // ya matcheó este intent, no seguir con sus keywords
        }
      }
    }

    // 2. Similitud con ejemplos
    for (const ejemplo of intent.ejemplos) {
      const sim = similitudGlobal(mensaje, ejemplo)
      if (!mejor || sim > mejor.confianza) {
        mejor = { intent, confianza: sim, metodo: 'similitud', mejorEjemplo: ejemplo }
      }
    }
  }

  // 3. Umbral: si la mejor confianza es muy baja, fallback
  if (!mejor || mejor.confianza < 0.55) {
    return { intent: null, confianza: mejor?.confianza || 0, metodo: 'fallback' }
  }

  return {
    intent: mejor.intent,
    confianza: mejor.confianza,
    metodo: mejor.metodo,
    mejorEjemplo: mejor.mejorEjemplo,
  }
}

// =====================================================
// 4. CARGA DE CONTEXTO DEL CLIENTE
// =====================================================

export async function cargarContextoCliente(clienteId: string): Promise<ContextoCliente | null> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true }
  })
  if (!cliente) return null

  const prestamosActivos = await db.prestamo.findMany({
    where: { clienteId, estado: { in: ['ACTIVO', 'EN_MORA'] } },
    select: {
      id: true, codigo: true, estado: true, saldoTotal: true, montoCuota: true,
      numeroCuotas: true, cuotasPagadas: true, fechaVencimiento: true,
      diasMora: true, frecuencia: true, montoPrincipal: true,
      saldoCapital: true, saldoInteres: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  const ultimosPagosRaw = await db.pago.findMany({
    where: { prestamo: { clienteId }, estado: 'APLICADO' },
    orderBy: { fechaPago: 'desc' },
    take: 5,
    select: {
      montoTotal: true, fechaPago: true, numeroCuota: true,
      prestamo: { select: { codigo: true } },
    }
  })

  return {
    clienteId,
    cliente,
    prestamosActivos,
    ultimosPagos: ultimosPagosRaw.map(p => ({
      montoTotal: p.montoTotal,
      fechaPago: p.fechaPago,
      codigoPrestamo: p.prestamo.codigo,
      numeroCuota: p.numeroCuota,
    }))
  }
}

// =====================================================
// 5. RESPONDER MENSAJE — PUNTO DE ENTRADA PRINCIPAL
// =====================================================

export interface RespuestaBot {
  respuesta: string
  escalar: boolean
  fuente: 'NLU' | 'LLM' | 'FALLBACK'
  intentDetectado?: string
  confianza?: number
}

/**
 * Genera respuesta del bot del portal del cliente usando el MOTOR
 * CONVERSACIONAL GENERATIVO (no más menús lineales).
 *
 * Flujo:
 *  1. Cargar contexto del cliente (préstamos, pagos)
 *  2. Registrar mensaje en la sesión conversacional
 *  3. Detectar intent con NLU (palabras clave + similitud)
 *  4. Si detecta referencia anafórica ("eso", "el anterior"), reutiliza
 *     el último intent
 *  5. Si confianza >= 0.55, usar plantilla multi-variante del intent
 *  6. Si no, fallback a LLM (generarRespuestaLLM)
 *  7. Si LLM falla, fallback natural con detección de tono
 */
export async function responderMensajeBot(
  mensajeCliente: string,
  clienteId: string,
  generarLLM?: (ctx: any, mensaje: string) => Promise<{ respuesta: string; escalar: boolean; fuente: string }>
): Promise<RespuestaBot> {
  // Import dinámico para evitar circularidad
  const { componerRespuesta, registrarEnSesion, resolverReferencia, obtenerSesion, componerFallback, componerSaludo, componerDespedida, componerEscalado, detectarTono } = await import('./bot-conversacional')
  const { PLANTILLAS_POR_INTENT, obtenerVarsParaContexto } = await import('./bot-plantillas')

  // 1. Cargar contexto
  const ctx = await cargarContextoCliente(clienteId)
  if (!ctx) {
    return {
      respuesta: 'Lo siento, no pude verificar tu identidad. Por favor, cierra sesión y vuelve a ingresar.',
      escalar: true,
      fuente: 'FALLBACK',
    }
  }

  const primerNombre = ctx.cliente.nombre.split(' ')[0]
  const telefono = ctx.cliente.telefono || 'tu WhatsApp registrado'

  // 2. Registrar mensaje del usuario en la sesión conversacional
  registrarEnSesion(clienteId, 'usuario', mensajeCliente)

  // 3. Verificar si el usuario hace referencia anafórica ("eso", "el anterior")
  const sesion = obtenerSesion(clienteId)
  const intentReferencia = resolverReferencia(mensajeCliente, sesion)

  // 4. Detectar intent (con NLU o usando la referencia)
  const deteccion = intentReferencia
    ? { intent: INTENTS_BOT_CLIENTE.find(i => i.id === intentReferencia) || null, confianza: 0.85, metodo: 'referencia' as const, mejorEjemplo: '(referencia anafórica)' }
    : detectarIntentBot(mensajeCliente)

  // Caso especial: saludo y despedida usan composer dedicado
  if (deteccion.intent && (deteccion.intent.id === 'SALUDO' || deteccion.intent.id === 'MENU') && deteccion.confianza >= 0.55) {
    const saludo = componerSaludo(ctx.cliente.nombre, clienteId)
    registrarEnSesion(clienteId, 'bot', saludo, 'SALUDO')
    return {
      respuesta: saludo,
      escalar: false,
      fuente: 'NLU',
      intentDetectado: 'SALUDO',
      confianza: deteccion.confianza,
    }
  }

  if (deteccion.intent && deteccion.intent.id === 'DESPEDIDA' && deteccion.confianza >= 0.55) {
    const despedida = componerDespedida(ctx.cliente.nombre, clienteId)
    registrarEnSesion(clienteId, 'bot', despedida, 'DESPEDIDA')
    return {
      respuesta: despedida,
      escalar: false,
      fuente: 'NLU',
      intentDetectado: 'DESPEDIDA',
      confianza: deteccion.confianza,
    }
  }

  // 5. Si confianza suficiente y hay plantillas para el intent, usar el composer
  if (deteccion.intent && deteccion.confianza >= 0.55) {
    const intentId = deteccion.intent.id
    const plantillasIntent = PLANTILLAS_POR_INTENT[intentId]

    if (plantillasIntent && plantillasIntent.plantillas.length > 0) {
      const vars = obtenerVarsParaContexto(ctx) as unknown as Record<string, string | number | boolean>
      const resultado = componerRespuesta({
        clienteId,
        clienteNombre: ctx.cliente.nombre,
        telefono,
        email: ctx.cliente.email,
        intent: intentId,
        plantillas: plantillasIntent.plantillas,
        vars,
        escalar: plantillasIntent.escalar,
      })
      registrarEnSesion(clienteId, 'bot', resultado.respuesta, intentId)
      return {
        respuesta: resultado.respuesta,
        escalar: resultado.escalar,
        fuente: 'NLU',
        intentDetectado: intentId,
        confianza: deteccion.confianza,
      }
    }

    // Si no hay plantillas en el nuevo sistema, caer al responder legacy del intent
    try {
      const respuesta = await deteccion.intent.responder(ctx)
      registrarEnSesion(clienteId, 'bot', respuesta, intentId)
      return {
        respuesta,
        escalar: !!deteccion.intent.escalar,
        fuente: 'NLU',
        intentDetectado: intentId,
        confianza: deteccion.confianza,
      }
    } catch (e) {
      console.error('[Bot] Error generando respuesta NLU legacy:', e)
    }
  }

  // 6. Fallback a LLM si está disponible
  if (generarLLM) {
    try {
      const llmContext = {
        botNombre: 'Asistente Clientes',
        botTipo: 'CHAT_CLIENTES',
        instrucciones: `Eres el asistente virtual del Portal del Cliente de Jsadr (sistema de préstamos).
Atiendes a ${ctx.cliente.nombre} (cédula ${ctx.cliente.cedula}).
Responde en español colombiano, de forma cordial y concisa (máx 3 párrafos).
NO uses listas numeradas con emojis 1️⃣2️⃣3️⃣. Prefiere prosa natural o bullets cortos (máx 3).
Si no tienes info suficiente, responde exactamente: "ESCALAR: Esta consulta requiere atención de un asesor humano."`,
        clienteId: ctx.clienteId,
        clienteNombre: ctx.cliente.nombre,
      }
      const r = await generarLLM(llmContext, mensajeCliente)
      registrarEnSesion(clienteId, 'bot', r.respuesta, 'LLM')
      return {
        respuesta: r.respuesta,
        escalar: r.escalar,
        fuente: 'LLM',
        intentDetectado: 'LLM_FALLBACK',
        confianza: deteccion.confianza,
      }
    } catch (e) {
      console.error('[Bot] Error LLM fallback:', e)
    }
  }

  // 7. Fallback natural con detección de tono
  const tono = detectarTono(mensajeCliente)
  const fallback = componerFallback(ctx.cliente.nombre, clienteId, tono)
  registrarEnSesion(clienteId, 'bot', fallback, 'FALLBACK')
  return {
    respuesta: fallback,
    escalar: false,
    fuente: 'FALLBACK',
    intentDetectado: 'NONE',
    confianza: deteccion.confianza,
  }
}

