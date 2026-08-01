// =====================================================
// bot-conversacional.ts — MOTOR CONVERSACIONAL GENERATIVO
// =====================================================
// Sustituye el patrón "pregunta → respuesta fija con menú numerado"
// por un motor que produce respuestas naturales, variables y
// contextuales. Diseñado para que el bot se sienta como un asesor
// humano, no como un menú automatizado.
//
// Capacidades clave:
//  1. PLANTILLAS MULTI-VARIANTE: cada intent tiene 3-6 formas de
//     responder. Se elige pseudoaleatoriamente con semilla por
//     usuario+mensaje para no repetir la misma variante seguida.
//
//  2. CONTEXTO MULTI-TURNO: memoria de los últimos N intercambios
//     del usuario. Permite resolver referencias ("eso", "el anterior",
//     "el otro crédito", "¿y los pagos?").
//
//  3. DETECCIÓN DE TONO: urgente, casual, formal, frustrado, o
//     neutral. El bot ajusta la longitud y el tono de su respuesta.
//
//  4. FOLLOW-UPS NATURALES: en lugar de "Escribe menú", propone
//     contextualmente ("¿Quieres que revise también los pagos del
//     otro crédito?"). Los follow-ups rotan y son específicos al
//     tema del que se está hablando.
//
//  5. FRASES PUENTE: "Déjame revisar…" / "Buena pregunta," /
//     "Claro, mira," — se insertan al inicio de la respuesta para
//     darle naturalidad. Nunca dos veces seguidas la misma.
//
//  6. VARIACIÓN DE EMOJIS Y FORMATO: a veces responde en prosa
//     corrida, a veces con bullets cortos, a veces con cifras
//     destacadas. Evita el patrón "emoji+bold+lista" repetitivo.
// =====================================================

import { detectarIntencion } from './bot-fuzzy-matcher'

// =====================================================
// 1. TIPOS
// =====================================================

export type TonoUsuario = 'URGENTE' | 'CASUAL' | 'FORMAL' | 'FRUSTRADO' | 'NEUTRO'

export interface MensajeContextual {
  rol: 'usuario' | 'bot'
  texto: string
  intent?: string
  ts: number
}

export interface SesionConversacion {
  clienteId: string
  mensajes: MensajeContextual[]
  ultimoIntent?: string
  ultimoTema?: string
  contadorTurno: number
}

// Mapa en memoria de sesiones activas (clave: clienteId)
const SESIONES = new Map<string, SesionConversacion>()

const MAX_MENSAJES_SESION = 12

export function obtenerSesion(clienteId: string): SesionConversacion {
  let s = SESIONES.get(clienteId)
  if (!s) {
    s = {
      clienteId,
      mensajes: [],
      contadorTurno: 0,
    }
    SESIONES.set(clienteId, s)
  }
  return s
}

export function registrarEnSesion(clienteId: string, rol: 'usuario' | 'bot', texto: string, intent?: string) {
  const s = obtenerSesion(clienteId)
  s.mensajes.push({ rol, texto, intent, ts: Date.now() })
  if (s.mensajes.length > MAX_MENSAJES_SESION) {
    s.mensajes = s.mensajes.slice(-MAX_MENSAJES_SESION)
  }
  if (rol === 'usuario') {
    s.contadorTurno++
    if (intent) s.ultimoIntent = intent
  }
}

// =====================================================
// 2. DETECCIÓN DE TONO
// =====================================================

const PATRONES_TONO: Array<{ tono: TonoUsuario; patrones: string[] }> = [
  {
    tono: 'URGENTE',
    patrones: [
      'urgente','ya','rapido','inmediato','cuanto antes','pronto','ahora mismo',
      'emergencia','hoy','ya mismo','ya mismo','no tengo tiempo','perdi tiempo',
      'cuanto demoras','cuando me respondes','llevas mucho','demorado','tarde',
    ],
  },
  {
    tono: 'FRUSTRADO',
    patrones: [
      'no sirve','no funciona','otra vez','siempre lo mismo','mande eso',
      'ya mande','ya envie','ya dije','no entiendes','no me entendiste',
      'pesimo','pésimo','horrible','malo','malisimo','increible','increíble',
      'burla','me estas','estafando','estafa','denuncia','abogado','demanda',
      'mentira','enganando','engañando','perdid','perdi','me robaron','robo',
    ],
  },
  {
    tono: 'CASUAL',
    patrones: [
      'que mas','q mas','buenas','holi','hello','hi','hey','ola','que hubo',
      'como vas','como vamos','bonito','chevere','chimba','bacano',
      'listo parc','listo socio','okis','ok','dale','va','sisisi','nono',
      'jaja','jeje','jiji','wow','ahh','mmm','ah bueno','ah ya','ah ok',
    ],
  },
  {
    tono: 'FORMAL',
    patrones: [
      'buenos dias','buenas tardes','buenas noches','estimado','estimada',
      'cordial saludo','respetado','distinguido','señor','señora','don',
      'solicit','requerir','solicito','requiero','agradeceria','agradezco',
      'amablemente','comedidamente','fervientemente',
    ],
  },
]

export function detectarTono(texto: string): TonoUsuario {
  const t = texto.toLowerCase()
  for (const { tono, patrones } of PATRONES_TONO) {
    for (const p of patrones) {
      if (t.includes(p)) return tono
    }
  }
  // Mayúsculas excesivas → urgente/frustrado
  const alfa = texto.replace(/[^a-zA-ZáéíóúñÑ]/g, '')
  if (alfa.length > 8) {
    const mayusc = alfa.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length
    if (mayusc / alfa.length > 0.6) return 'URGENTE'
  }
  // Signos de exclamación múltiples → urgente/frustrado
  if (/[!]{2,}/.test(texto) || /\?{2,}/.test(texto)) return 'URGENTE'
  return 'NEUTRO'
}

// =====================================================
// 3. FRASES PUENTE (apertura natural)
// =====================================================

const FRASES_PUENTE_POR_TONO: Record<TonoUsuario, string[]> = {
  URGENTE: [
    'Listo, voy al grano: ',
    'Entendido, aquí va: ',
    'Vamos con eso ya: ',
    'Claro, te respondo directo: ',
  ],
  FRUSTRADO: [
    'Entiendo tu molestia, déjame ayudarte. ',
    'Te pido una disculpa por la experiencia. Vamos a resolverlo: ',
    'Veo que esto ha sido frustrante. Vamos paso a paso: ',
    'Gracias por contármelo, aquí va lo que puedo hacer: ',
  ],
  CASUAL: [
    '¡Claro! ',
    'Dale, mira: ',
    'Listo, ',
    'Por supuesto. ',
    'Bueno, ',
  ],
  FORMAL: [
    'Con gusto le respondo. ',
    'Estimado usuario, ',
    'A continuación le comparto la información. ',
    'Por supuesto. ',
  ],
  NEUTRO: [
    'Claro, ',
    'Vale, ',
    'Bueno, ',
    'Mira: ',
    'Déjame revisar… ',
    'Buena pregunta. ',
  ],
}

const FRASES_PUENTE_DEFAULT = ['Claro, ', 'Vale, ', 'Bueno, ']

function elegirPuente(tono: TonoUsuario, clienteId: string): string {
  const pool = FRASES_PUENTE_POR_TONO[tono] || FRASES_PUENTE_DEFAULT
  // Semilla basada en clienteId + minuto actual → variabilidad por sesión
  const seed = hashSeed(clienteId + Math.floor(Date.now() / 60000))
  return pool[seed % pool.length]
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// =====================================================
// 4. FOLLOW-UPS NATURALES (en vez de "escribe menú")
// =====================================================

const FOLLOWUPS_POR_INTENT: Record<string, string[]> = {
  SALDO: [
    '¿Quieres que te muestre también la fecha del próximo pago?',
    '¿Te interesa ver el detalle de intereses pagados?',
    '¿Necesitas el historial completo de cuotas?',
    '',
  ],
  FECHA_PAGO: [
    '¿Te ayudo a configurar un recordatorio por WhatsApp?',
    '¿Quieres ver también el saldo total?',
    '¿Revisamos los métodos de pago disponibles?',
    '',
  ],
  CUOTAS_PAGADAS: [
    '¿Quieres descargar el certificado de pagos?',
    '¿Te interesa ver el saldo restante?',
    '',
    '',
  ],
  METODOS_PAGO: [
    '¿Quieres que te explique cómo pagar por PSE paso a paso?',
    '¿Revisamos el saldo pendiente antes de pagar?',
    '',
  ],
  MORA: [
    '¿Quieres que te conecte con un asesor para renegociar?',
    '¿Te muestro cómo calcular la mora diaria?',
    '',
  ],
  RENOVACION: [
    '¿Quieres simular tu nuevo monto?',
    '¿Te interesa conocer los requisitos actualizados?',
    '',
  ],
  REQUISITOS: [
    '¿Quieres que te explique el paso a paso de la solicitud?',
    '¿Te ayudo a estimar cuánto podrías pedir?',
    '',
  ],
  TASA_INTERES: [
    '¿Quieres ver el detalle de cómo se calculó tu tasa?',
    '¿Te muestro el comparativo con otras categorías?',
    '',
  ],
  DESEMBOLSO: [
    '¿Quieres verificar los datos de tu cuenta registrada?',
    '¿Te explico cómo funciona el fondo de garantía?',
    '',
  ],
  ASESOR_HUMANO: [
    '',
    '',
    '',
  ],
  HORARIOS: [
    '¿Necesitas que te contacten en horario específico?',
    '',
  ],
}

function elegirFollowUp(intent: string, clienteId: string): string {
  const pool = FOLLOWUPS_POR_INTENT[intent]
  if (!pool || pool.length === 0) return ''
  const seed = hashSeed(clienteId + intent + Math.floor(Date.now() / 60000))
  return pool[seed % pool.length]
}

// =====================================================
// 5. PLANTILLAS MULTI-VARIANTE
// =====================================================

/**
 * Plantilla de respuesta generativa. Cada intent puede tener varias
 * plantillas. La función resolverPlantilla elige una variante y
 * sustituye los placeholders ${cliente}, ${saldo}, etc.
 *
 * Sintaxis de placeholders:
 *   ${cliente}  -> primer nombre del cliente
 *   ${saldo}    -> monto del saldo (string ya formateado)
 *   ${fecha}    -> fecha formateada
 *   ${cantidad} -> número formateado
 */
export type Plantilla = (ctx: PlantillaContexto) => string

export interface PlantillaContexto {
  cliente: string        // primer nombre
  clienteCompleto: string
  telefono?: string
  email?: string | null
  // Datos variables específicos (saldo, fecha, etc.) - el llamador los pasa
  vars?: Record<string, string | number | boolean>
}

/**
 * Toma un arreglo de plantillas (strings con ${placeholders}) y elige
 * una pseudoaleatoriamente basándose en el clienteId + intent para
 * evitar repetir la misma variante seguida en la misma sesión.
 */
export function resolverPlantilla(
  plantillas: string[],
  intent: string,
  clienteId: string,
  ctx: PlantillaContexto
): string {
  if (plantillas.length === 0) return ''

  // Buscar la sesión para ver qué variantes ya se usaron
  const sesion = SESIONES.get(clienteId)
  const variantesUsadas = sesion?.mensajes
    .filter(m => m.rol === 'bot' && m.intent === intent)
    .map((_, i) => i) || []

  // Elegir una variante que no sea la última usada
  const seed = hashSeed(clienteId + intent + sesion?.contadorTurno.toString())
  let idx = seed % plantillas.length
  if (variantesUsadas.length > 0 && plantillas.length > 1) {
    // Si la última respuesta de este intent usó esta variante, saltar a la siguiente
    const ultima = variantesUsadas[variantesUsadas.length - 1]
    if (idx === ultima) {
      idx = (idx + 1) % plantillas.length
    }
  }

  const plantilla = plantillas[idx]
  return sustituirPlaceholders(plantilla, ctx)
}

function sustituirPlaceholders(texto: string, ctx: PlantillaContexto): string {
  return texto
    .replace(/\$\{cliente\}/g, ctx.cliente)
    .replace(/\$\{clienteCompleto\}/g, ctx.clienteCompleto)
    .replace(/\$\{telefono\}/g, ctx.telefono || '')
    .replace(/\$\{email\}/g, ctx.email || '')
    .replace(/\$\{(\w+)\}/g, (_, key) => {
      const v = ctx.vars?.[key]
      return v !== undefined ? String(v) : ''
    })
}

// =====================================================
// 6. COMPOSITOR DE RESPUESTA FINAL
// =====================================================

export interface OpcionesRespuesta {
  clienteId: string
  clienteNombre: string
  telefono?: string
  email?: string | null
  intent: string
  plantillas: string[]
  vars?: Record<string, string | number | boolean>
  // Si se pasa, se usa como respuesta completa (sin componer)
  respuestaDirecta?: string
  // Si se quiere omitir frase puente (por ejemplo, respuesta ya larga)
  sinPuente?: boolean
  // Si se quiere omitir follow-up
  sinFollowUp?: boolean
  escalar?: boolean
}

export interface RespuestaCompuesta {
  respuesta: string
  escalar: boolean
  tonoDetectado: TonoUsuario
  intentDetectado: string
  followUpUsado: string
}

export function componerRespuesta(opts: OpcionesRespuesta): RespuestaCompuesta {
  const tono = detectarTono(
    obtenerSesion(opts.clienteId).mensajes
      .filter(m => m.rol === 'usuario')
      .slice(-1)[0]?.texto || ''
  )

  // 1. Cuerpo de la respuesta
  let cuerpo: string
  if (opts.respuestaDirecta) {
    cuerpo = opts.respuestaDirecta
  } else {
    const ctx: PlantillaContexto = {
      cliente: opts.clienteNombre.split(' ')[0] || opts.clienteNombre,
      clienteCompleto: opts.clienteNombre,
      telefono: opts.telefono,
      email: opts.email,
      vars: opts.vars,
    }
    cuerpo = resolverPlantilla(opts.plantillas, opts.intent, opts.clienteId, ctx)
  }

  // 2. Componer: puente + cuerpo + follow-up
  const partes: string[] = []
  if (!opts.sinPuente && !cuerpo.startsWith('¡') && !cuerpo.startsWith('✅') && !cuerpo.startsWith('⚠️')) {
    const puente = elegirPuente(tono, opts.clienteId)
    partes.push(puente)
  }
  partes.push(cuerpo)

  if (!opts.sinFollowUp && tono !== 'URGENTE') {
    // En urgente, no poner follow-up para no distraer
    const fu = elegirFollowUp(opts.intent, opts.clienteId)
    if (fu) partes.push(fu)
  }

  const respuestaFinal = partes.join('').trim()

  return {
    respuesta: respuestaFinal,
    escalar: !!opts.escalar,
    tonoDetectado: tono,
    intentDetectado: opts.intent,
    followUpUsado: partes.length > 2 ? partes[partes.length - 1] : '',
  }
}

// =====================================================
// 7. DETECCIÓN DE REFERENCIAS ANAFÓRICAS
// =====================================================

/**
 * Detecta si el mensaje del usuario hace referencia a algo dicho antes.
 * Retorna el intent previo que se debe reutilizar.
 *
 * Ejemplos:
 *   "y el otro?" → reutiliza último intent
 *   "¿cuánto de ese?" → reutiliza SALDO
 *   "¿y los pagos?" → si estaba viendo un crédito, va a FECHA_PAGO
 */
export function resolverReferencia(mensaje: string, sesion: SesionConversacion): string | null {
  const m = mensaje.toLowerCase().trim()

  // Si no hay último intent, no hay referencia que resolver
  if (!sesion.ultimoIntent) return null

  // No resolver referencia si el mensaje parece una consulta nueva completa
  // (más de 5 palabras que no sean anafóricas)
  const palabras = m.split(/\s+/).filter(p => p.length > 0)
  if (palabras.length > 8) return null

  // Patrones de referencia anafórica
  const patrones = [
    { patron: /^(y|que|cual|cuales|cuanto|cuando|donde|como)\s+(el|la|los|las|eso|esa|esos|esas|este|esta|estos|estas|otro|otra)/, peso: 0.9 },
    { patron: /\b(y el otro|y la otra|el otro|la otra|el anterior|la anterior)\b/, peso: 0.9 },
    { patron: /\b(eso|esa|esto|este)\b/, peso: 0.7 },
    { patron: /\b(y bien|y entonces|y que mas|y que|y cual|y cuando)\b/, peso: 0.6 },
    { patron: /\b(de ese|de esa|de esto|de este|del anterior|de la anterior|del otro|de la otra)\b/, peso: 0.8 },
    { patron: /\b tambien\b/, peso: 0.5 },
    { patron: /\b igual\b/, peso: 0.4 },
  ]

  let maxPeso = 0
  for (const { patron, peso } of patrones) {
    if (patron.test(m) && peso > maxPeso) {
      maxPeso = peso
    }
  }

  // Si hay una coincidencia fuerte, reutilizar el último intent
  if (maxPeso >= 0.7) {
    return sesion.ultimoIntent
  }

  // Si el mensaje es MUY corto y hay contexto previo, asumir referencia
  if (palabras.length <= 3 && maxPeso >= 0.5) {
    return sesion.ultimoIntent
  }

  return null
}

// =====================================================
// 8. SALUDOS Y DESPEDIDAS NATURALES (multi-variante)
// =====================================================

const SALUDOS_NATURALES = [
  '¡Hola, ${cliente}! 👋 ¿En qué te puedo ayudar hoy?',
  '¡Buenas! Cuéntame, ${cliente}, ¿qué necesitas?',
  'Hola ${cliente}, aquí estoy. ¿Qué consulta tienes?',
  '¡Hey, ${cliente}! Listo para ayudarte. ¿Qué quieres saber?',
  'Holaa ${cliente} 😊 Cuéntame qué necesitas.',
]

const DESPEDIDAS_NATURALES = [
  '¡Listo, ${cliente}! Si necesitas algo más, aquí estaré. 😊',
  'Perfecto, cualquier cosa me escribes. ¡Buen día!',
  'Dale, quedo atento. ¡Suerte!',
  'Para servirte, ${cliente}. Vuelve cuando quieras.',
  'Genial. Aquí estoy si surge algo más. 👋',
]

export function componerSaludo(clienteNombre: string, clienteId: string): string {
  return resolverPlantilla(SALUDOS_NATURALES, 'SALUDO', clienteId, {
    cliente: clienteNombre.split(' ')[0] || clienteNombre,
    clienteCompleto: clienteNombre,
  })
}

export function componerDespedida(clienteNombre: string, clienteId: string): string {
  return resolverPlantilla(DESPEDIDAS_NATURALES, 'DESPEDIDA', clienteId, {
    cliente: clienteNombre.split(' ')[0] || clienteNombre,
    clienteCompleto: clienteNombre,
  })
}

// =====================================================
// 9. FALLBACK NATURAL (en vez de "escribe menú")
// =====================================================

const FALLBACKS_NATURALES = [
  'Mira, ${cliente}, no estoy seguro de entender a qué te refieres. ¿Puedes darme un poco más de contexto? Por ejemplo, dime si es sobre tu saldo, un pago, la renovación, o algo más específico.',
  'Déjame ver si te entiendo bien, ${cliente}. ¿Lo que necesitas es sobre el saldo, un pago, requisitos para nuevo crédito, o algo distinto?',
  'Hmm, no me queda claro. ¿Me cuentas con otras palabras? Estoy habilitado para ayudarte con saldos, fechas de pago, renovaciones, requisitos, y trámites del portal.',
  'Lo siento, ${cliente}, no logré captar bien tu pregunta. ¿Puedes reformular? Mientras más detalle me des, mejor te puedo ayudar.',
]

const FALLBACKS_FRUSTRADO = [
  '${cliente}, entiendo que esto puede ser molesto. Para ayudarte más rápido, cuéntame exactamente qué intentas hacer y qué mensaje de error o resultado obtuviste.',
  'Te pido una disculpa, ${cliente}. Para ir directo al punto, dime: ¿es sobre tu saldo, un pago que no se ve, un problema con el portal, o qué?',
]

export function componerFallback(clienteNombre: string, clienteId: string, tono: TonoUsuario): string {
  const ctx: PlantillaContexto = {
    cliente: clienteNombre.split(' ')[0] || clienteNombre,
    clienteCompleto: clienteNombre,
  }
  const plantillas = tono === 'FRUSTRADO' ? FALLBACKS_FRUSTRADO : FALLBACKS_NATURALES
  return resolverPlantilla(plantillas, 'FALLBACK', clienteId, ctx)
}

// =====================================================
// 10. ESCALADO A HUMANO NATURAL
// =====================================================

const ESCALADOS_NATURALES = [
  'Voy a conectar tu caso con un asesor humano, ${cliente}. Me queda tu conversación registrada y te contactarán por WhatsApp al ${telefono}. Mientras esperas, ¿hay algo más en lo que te pueda ayudar?',
  'Listo, ${cliente}, ya dejé tu caso escalado. Un asesor se comunicará contigo al ${telefono} en horario hábil (L-V 8AM-6PM, S 9AM-1PM). Si quieres seguir consultando algo más mientras tanto, estoy disponible.',
  'Entendido. Tu caso requiere atención de un humano, así que lo paso al equipo. Te escriben por WhatsApp al ${telefono}. Cuéntame si necesitas algo más por aquí.',
]

export function componerEscalado(clienteNombre: string, clienteId: string, telefono: string): string {
  return resolverPlantilla(ESCALADOS_NATURALES, 'ESCALADO', clienteId, {
    cliente: clienteNombre.split(' ')[0] || clienteNombre,
    clienteCompleto: clienteNombre,
    telefono,
  })
}

// =====================================================
// 11. UTILIDAD: formatear fecha relativa
// =====================================================

export function formatearRelativo(fecha: Date | null | string): string {
  if (!fecha) return 'sin fecha'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return 'sin fecha'

  const ahora = new Date()
  const diffMs = d.getTime() - ahora.getTime()
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias === 0) return 'hoy'
  if (diffDias === 1) return 'mañana'
  if (diffDias === -1) return 'ayer'
  if (diffDias > 1 && diffDias <= 7) return `en ${diffDias} días`
  if (diffDias < -1 && diffDias >= -7) return `hace ${Math.abs(diffDias)} días`

  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// =====================================================
// 12. ESTADÍSTICAS DE USO (para el panel de bots)
// =====================================================

export function obtenerEstadisticasMotor(): {
  sesionesActivas: number
  promedioMensajesPorSesion: number
} {
  let totalMensajes = 0
  for (const s of SESIONES.values()) {
    totalMensajes += s.mensajes.length
  }
  return {
    sesionesActivas: SESIONES.size,
    promedioMensajesPorSesion: SESIONES.size > 0 ? Math.round(totalMensajes / SESIONES.size) : 0,
  }
}
