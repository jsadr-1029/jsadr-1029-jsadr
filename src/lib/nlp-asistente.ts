// =====================================================
// nlp-asistente.ts — Sistema de NLP para el Asistente Personal
// Matching semántico con sinónimos, intents y detección de entidades
// =====================================================

// =====================================================
// 1. DETECCIÓN DE INTENTS CON SINÓNIMOS
// =====================================================
interface Intent {
  id: string
  sinonimos: string[]  // palabras/frases que activan este intent
  patrones?: RegExp[]  // patrones regex alternativos
  confianza?: number   // peso del match
}

const INTENTS: Intent[] = [
  {
    id: 'REGISTRAR_GASTO',
    sinonimos: [
      'gasto', 'gasté', 'gaste', 'gastar', 'pagué', 'pague', 'pagar',
      'compré', 'compre', 'comprar', 'gaste de', 'anota gasto',
      'registrar gasto', 'apuntar gasto', 'guardar gasto',
      'salida de dinero', 'egreso', 'pérdida', 'perdida',
      'me costó', 'me costo', 'me salió', 'me salio',
      'cuánto gasté', 'gastado',
    ],
    patrones: [
      /(?:gasto|gasté|gaste|pagué|pague|compré|compre|anot[aá]\s+gasto|registrar\s+gasto)\s+(?:de\s+)?\$?\s*([\d.]+)/i,
      /(?:me\s+costó|me\s+costo|me\s+salió|me\s+salio)\s+\$?\s*([\d.]+)/i,
    ],
  },
  {
    id: 'REGISTRAR_INGRESO',
    sinonimos: [
      'ingreso', 'recibí', 'recibi', 'gané', 'gane', 'recibir',
      'cobré', 'cobre', 'me pagaron', 'me depositaron',
      'entrad de dinero', 'entrada', 'ganancia', 'comisión',
      'comision', 'venta', 'vendí', 'vendi', 'sueldo',
      'salario', 'honorarios', 'registrar ingreso', 'anota ingreso',
    ],
    patrones: [
      /(?:ingreso|recibí|recibi|gané|gane|cobré|cobre|vendí|vendi)\s+(?:de\s+)?\$?\s*([\d.]+)/i,
      /(?:me\s+pagaron|me\s+depositaron)\s+\$?\s*([\d.]+)/i,
    ],
  },
  {
    id: 'DASHBOARD',
    sinonimos: [
      'balance', 'como va', 'cómo va', 'dashboard', 'resumen',
      'finanzas', 'cuánto dinero', 'cuanto dinero', 'cuánto tengo',
      'cuanto tengo', 'mi plata', 'mi dinero', 'mi saldo',
      'estado financiero', 'salud financiera', 'kpi', 'indicadores',
      'cómo van mis', 'como van mis', 'cómo estoy', 'como estoy',
      'mi situación', 'mi situacion', 'panorama', 'overview',
      'cómo voy', 'como voy', 'en qué estoy', 'en que estoy',
    ],
  },
  {
    id: 'ALERTAS',
    sinonimos: [
      'alerta', 'alertas', 'problema', 'problemas', 'qué está mal',
      'que esta mal', 'riesgo', 'peligro', 'preocupación',
      'preocupacion', 'aviso', 'notificación', 'notificacion',
      'algo malo', 'qué me preocupa', 'que me preocupa',
    ],
  },
  {
    id: 'REPORTE',
    sinonimos: [
      'reporte', 'report', 'informe', 'resumen del', 'detall',
      'desglose', 'desglose de', 'listado', 'historial',
    ],
  },
  {
    id: 'COMPARATIVO',
    sinonimos: [
      'comparativo', 'compara', 'comparar', 'mes anterior',
      'vs mes', 'versus mes', 'diferencia', 'evolución',
      'evolucion', 'cambio', 'cambios', 'antes vs ahora',
      'cómo iba', 'como iba', 'cómo estaba', 'como estaba',
    ],
  },
  {
    id: 'PRESUPUESTO_CREAR',
    sinonimos: [
      'presupuesto', 'presupuestar', 'límite', 'limite',
      'tope de gasto', 'control de gasto', 'asignar',
    ],
  },
  {
    id: 'META_CREAR',
    sinonimos: [
      'meta de', 'crear meta', 'objetivo de', 'ahorrar',
      'ahorro para', 'fondo de', 'juntar', 'reunir',
      'quiero comprar', 'planeo comprar', 'meta financiera',
    ],
  },
  {
    id: 'VER_METAS',
    sinonimos: [
      'ver metas', 'mis metas', 'metas activas', 'cuáles son mis metas',
      'cuales son mis metas', 'cómo van las metas', 'como van las metas',
      'progreso de metas', 'avance de metas',
    ],
  },
  {
    id: 'VER_PRESUPUESTOS',
    sinonimos: [
      'ver presupuestos', 'mis presupuestos', 'presupuestos activos',
      'cuáles son mis presupuestos', 'cuales son mis presupuestos',
      'cómo van los presupuestos', 'como van los presupuestos',
    ],
  },
  {
    id: 'RECOMENDACIONES',
    sinonimos: [
      'recomendación', 'recomendacion', 'recomendaciones',
      'qué hago', 'que hago', 'consejo', 'consejos',
      'sugerencia', 'sugerencias', 'qué me sugieres',
      'que me sugieres', 'qué me recomiendas', 'que me recomiendas',
      'mejoras', 'optimizar', 'qué mejorar', 'que mejorar',
    ],
  },
  {
    id: 'PREDICTIVO',
    sinonimos: [
      'predicción', 'prediccion', 'predecir', 'pronóstico',
      'pronostico', 'proyección', 'proyeccion', 'futuro',
      'qué pasará', 'que pasara', 'cómo estaré', 'como estare',
      'dónde estaré', 'donde estare', 'escenario', 'simulación',
      'simulacion', 'forecast', 'prever',
    ],
  },
  {
    id: 'CONSEJOS_AHORRO',
    sinonimos: [
      'consejos de ahorro', 'cómo ahorrar', 'como ahorrar',
      'ahorrar más', 'ahorrar mas', 'reducir gastos',
      'gastar menos', 'economizar', 'ahorrar dinero',
      'tips de ahorro', 'trucos de ahorro', 'estrategias de ahorro',
    ],
  },
  {
    id: 'PREGUNTAS_FRECUENTES',
    sinonimos: [
      'preguntas frecuentes', 'qué puedes hacer', 'que puedes hacer',
      'qué preguntas', 'que preguntas', 'ayuda', 'help',
      'cómo funcionas', 'como funcionas', 'qué sabes hacer',
      'que sabes hacer', 'para qué sirves', 'para que sirves',
      'qué opciones', 'que opciones', 'menú', 'menu',
    ],
  },
  {
    id: 'MOVIMIENTOS_RECIENTES',
    sinonimos: [
      'movimientos recientes', 'últimos movimientos', 'ultimos movimientos',
      'ver movimientos', 'historial de movimientos', 'qué movimientos',
      'que movimientos', 'transacciones', 'últimas transacciones',
      'ultimas transacciones', 'registro de', 'ver mis gastos',
      'qué he gastado', 'que he gastado', 'qué he comprado',
      'que he comprado', 'últimos gastos', 'ultimos gastos',
    ],
  },
  {
    id: 'CAMBIAR_AMBITO',
    sinonimos: [
      'cambiar ámbito', 'cambiar ambito', 'cambiar a personal',
      'cambiar a negocio', 'modo personal', 'modo negocio',
      'ver personal', 'ver negocio', 'ámbito personal', 'ambito personal',
      'ámbito negocio', 'ambito negocio',
    ],
  },
]

// =====================================================
// 2. DETECCIÓN DE INTENT
// =====================================================
export function detectarIntent(mensaje: string): { intent: string | null; confianza: number; matchData?: any } {
  const mensajeLower = mensaje.toLowerCase().trim()

  let mejorMatch: { intent: string; confianza: number; matchData?: any } | null = null

  for (const intent of INTENTS) {
    // 1. Matching por sinónimos
    for (const sinonimo of intent.sinonimos) {
      const sinonimoLower = sinonimo.toLowerCase()
      // Coincidencia exacta de palabra/frase
      if (mensajeLower === sinonimoLower) {
        if (!mejorMatch || 1.0 > mejorMatch.confianza) {
          mejorMatch = { intent: intent.id, confianza: 1.0 }
        }
        continue
      }
      // Coincidencia como substring
      if (mensajeLower.includes(sinonimoLower)) {
        const confianza = sinonimoLower.length / mensajeLower.length
        if (!mejorMatch || confianza > mejorMatch.confianza) {
          mejorMatch = { intent: intent.id, confianza }
        }
      }
    }

    // 2. Matching por patrones regex
    if (intent.patrones) {
      for (const patron of intent.patrones) {
        const match = mensajeLower.match(patron)
        if (match) {
          if (!mejorMatch || 0.9 > mejorMatch.confianza) {
            mejorMatch = { intent: intent.id, confianza: 0.9, matchData: match }
          }
        }
      }
    }
  }

  return {
    intent: mejorMatch?.intent || null,
    confianza: mejorMatch?.confianza || 0,
    matchData: mejorMatch?.matchData,
  }
}

// =====================================================
// 3. EXTRACCIÓN DE ENTIDADES (monto, concepto, ámbito)
// =====================================================
export function extraerMonto(mensaje: string): number | null {
  const mensajeLower = mensaje.toLowerCase()

  // 1. "50 mil" → 50000
  const milMatch = mensajeLower.match(/(\d+)\s*(?:mil|miles)/i)
  if (milMatch) {
    return parseInt(milMatch[1]) * 1000
  }

  // 2. "2 millones" → 2000000
  const millonesMatch = mensajeLower.match(/(\d+(?:\.\d+)?)\s*(?:millones?|mm|millon)/i)
  if (millonesMatch) {
    return Math.round(parseFloat(millonesMatch[1]) * 1000000)
  }

  // 3. Número con separadores de miles: "$50.000" o "50,000" o "50000"
  const numMatch = mensajeLower.match(/\$?\s*([\d][\d.,]*)/)
  if (numMatch) {
    const raw = numMatch[1]
    // Si tiene punto y coma: "50.000,50" → formato colombiano
    if (raw.includes('.') && raw.includes(',')) {
      const limpio = raw.replace(/\./g, '').replace(',', '.')
      const num = parseFloat(limpio)
      return isNaN(num) ? null : num
    }
    // Si solo tiene punto: "50.000" → podría ser miles o decimal
    if (raw.includes('.')) {
      const partes = raw.split('.')
      if (partes.length === 2 && partes[1].length === 3) {
        // "50.000" → formato miles
        return parseInt(raw.replace(/\./g, ''))
      }
      // "50.5" → decimal
      return parseFloat(raw)
    }
    // Si solo tiene coma: "50,000" o "50,5"
    if (raw.includes(',')) {
      const partes = raw.split(',')
      if (partes.length === 2 && partes[1].length === 3) {
        // "50,000" → formato miles
        return parseInt(raw.replace(/,/g, ''))
      }
      // "50,5" → decimal
      return parseFloat(raw.replace(',', '.'))
    }
    // Solo números
    return parseInt(raw)
  }

  return null
}

export function extraerAmbito(mensaje: string): 'NEGOCIO' | 'PERSONAL' {
  const mensajeLower = mensaje.toLowerCase()

  // Detectar explícitamente "personal"
  const palabrasPersonal = [
    'personal', 'mi casa', 'mi familia', 'mi comida', 'mi transporte',
    'mi vivienda', 'mi salud', 'mi educación', 'mi educacion',
    'yo pagué', 'yo pague', 'de mi bolsillo',
  ]

  // Detectar explícitamente "negocio"
  const palabrasNegocio = [
    'negocio', 'empresa', 'jsadr', 'oficina', 'operación',
    'operacion', 'staff', 'empleado', 'marketing', 'inventario',
  ]

  // Verificar personal primero (con límites de palabra)
  for (const palabra of palabrasPersonal) {
    const regex = new RegExp(`\\b${palabra}\\b`, 'i')
    if (regex.test(mensajeLower)) return 'PERSONAL'
  }

  // Verificar negocio
  for (const palabra of palabrasNegocio) {
    const regex = new RegExp(`\\b${palabra}\\b`, 'i')
    if (regex.test(mensajeLower)) return 'NEGOCIO'
  }

  // Default: NEGOCIO
  return 'NEGOCIO'
}

export function extraerConcepto(mensaje: string, monto: number | null): string {
  if (!monto) return 'Gasto general'

  // Buscar el monto en el mensaje y extraer lo que viene después
  const montoStr = monto.toString()
  const idx = mensaje.indexOf(montoStr)
  if (idx === -1) {
    // Buscar por el monto con formato
    const montoFormateado = monto.toLocaleString('es-CO')
    const idx2 = mensaje.indexOf(montoFormateado)
    if (idx2 !== -1) {
      const despues = mensaje.substring(idx2 + montoFormateado.length).trim()
      const limpio = despues.replace(/^(?:en|de|para|por)\s+/i, '').trim()
      return limpio || 'Gasto general'
    }
    return 'Gasto general'
  }

  const despues = mensaje.substring(idx + montoStr.length).trim()
  // Remover preposiciones iniciales y el ámbito
  const limpio = despues
    .replace(/^(?:en|de|para|por)\s+/i, '')
    .replace(/\b(?:personal|negocio)\b/i, '')
    .trim()
  return limpio || 'Gasto general'
}

// =====================================================
// 4. DETECCIÓN DE PERÍODO
// =====================================================
export function detectarPeriodo(mensaje: string): 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'ANUAL' {
  const m = mensaje.toLowerCase()
  if (m.includes('hoy') || m.includes('diario') || m.includes('día') || m.includes('dia')) return 'DIARIO'
  if (m.includes('semana') || m.includes('semanal') || m.includes('últimos 7') || m.includes('ultimos 7')) return 'SEMANAL'
  if (m.includes('año') || m.includes('anual') || m.includes('anualmente')) return 'ANUAL'
  return 'MENSUAL'
}

// =====================================================
// 5. BASE DE PREGUNTAS Y RESPUESTAS SEMÁNTICAS
// =====================================================
interface QA {
  pregunta: string
  sinonimos: string[]
  respuesta: string
  categoria: string
}

export const BASE_CONOCIMIENTO: QA[] = [
  {
    categoria: 'Registro',
    pregunta: '¿Cómo registro un gasto?',
    sinonimos: ['cómo anoto un gasto', 'cómo apunto un gasto', 'cómo guardo un gasto', 'cómo registro un egreso', 'cómo registro una salida'],
    respuesta: 'Para registrar un gasto, escribe el monto y el concepto. Ejemplos:\n• "gasto de 50000 en comida"\n• "anota 200000 de gasolina personal"\n• "me costó 100000 en marketing"\n• "compré 30000 de café personal"\n\nEl bot clasifica automáticamente la categoría usando IA.',
  },
  {
    categoria: 'Registro',
    pregunta: '¿Cómo registro un ingreso?',
    sinonimos: ['cómo anoto un ingreso', 'cómo guardo un ingreso', 'cómo registro una ganancia', 'cómo registro una venta', 'cómo registro un pago recibido'],
    respuesta: 'Para registrar un ingreso, escribe el monto y el motivo. Ejemplos:\n• "ingreso de 2000000 por venta"\n• "recibí 500000 de comisión"\n• "me pagaron 1000000"\n• "cobré 300000 personal"\n\nEl bot clasifica automáticamente la categoría.',
  },
  {
    categoria: 'Análisis',
    pregunta: '¿Cómo veo mi balance?',
    sinonimos: ['cómo veo mis finanzas', 'cómo veo mi dinero', 'cómo sé cuánto tengo', 'cómo veo mi saldo', 'cómo veo mi situación', 'cómo veo mi panorama'],
    respuesta: 'Para ver tu balance, escribe:\n• "cómo va el balance"\n• "dashboard"\n• "cómo van mis finanzas"\n• "cuánto dinero tengo"\n\nEl bot mostrará ingresos, gastos, balance, capacidad de ahorro y top gastos.',
  },
  {
    categoria: 'Análisis',
    pregunta: '¿Cómo veo mis gastos por categoría?',
    sinonimos: ['cómo veo en qué gasto', 'cómo veo mi desglose', 'cómo veo dónde gasto', 'cómo veo mis top gastos'],
    respuesta: 'Para ver gastos por categoría, escribe:\n• "gastos por categoría"\n• "en qué gasto más"\n• "top gastos"\n\nEl bot mostrará el ranking de categorías con montos y porcentajes.',
  },
  {
    categoria: 'Planificación',
    pregunta: '¿Cómo creo un presupuesto?',
    sinonimos: ['cómo pongo un límite', 'cómo controlo mis gastos', 'cómo asigno un tope', 'cómo establezco un límite'],
    respuesta: 'Para crear un presupuesto, escribe:\n• "presupuesto de 2000000 para alimentación"\n• "límite de 1000000 para marketing"\n• "tope de 500000 para transporte personal"\n\nEl bot alertará cuando llegues al 80% del límite.',
  },
  {
    categoria: 'Planificación',
    pregunta: '¿Cómo creo una meta financiera?',
    sinonimos: ['cómo establezco un objetivo', 'cómo planeo ahorrar', 'cómo me propongo una meta', 'cómo defino una meta'],
    respuesta: 'Para crear una meta, escribe:\n• "meta de ahorrar 5000000"\n• "objetivo de comprar vivienda de 50 millones largo plazo"\n• "fondo de emergencias de 10000000"\n\nEl bot hará seguimiento automático del progreso.',
  },
  {
    categoria: 'Inteligencia',
    pregunta: '¿Cómo veo alertas?',
    sinonimos: ['cómo sé si hay problemas', 'cómo veo riesgos', 'cómo sé qué me preocupa', 'cómo veo avisos'],
    respuesta: 'Para ver alertas, escribe:\n• "alertas"\n• "¿hay problemas?"\n• "¿qué está mal?"\n\nEl bot detecta automáticamente: riesgo de iliquidez, endeudamiento alto, presupuestos excedidos, gastos excesivos.',
  },
  {
    categoria: 'Inteligencia',
    pregunta: '¿Cómo veo predicciones?',
    sinonimos: ['cómo veo el futuro', 'cómo veo proyecciones', 'cómo veo escenarios', 'cómo me veré en 3 meses'],
    respuesta: 'Para ver predicciones, escribe:\n• "predicción"\n• "proyección a 90 días"\n• "qué pasará en 3 meses"\n\nEl bot proyecta balance a 30/60/90 días con escenarios.',
  },
  {
    categoria: 'Inteligencia',
    pregunta: '¿Cómo obtengo consejos de ahorro?',
    sinonimos: ['cómo ahorro más', 'cómo gasto menos', 'cómo economizo', 'tips de ahorro'],
    respuesta: 'Para consejos de ahorro, escribe:\n• "consejos de ahorro"\n• "cómo ahorrar más"\n• "cómo reducir gastos"\n\nEl bot analiza tus gastos y sugiere recortes específicos con impacto estimado.',
  },
  {
    categoria: 'Comparativos',
    pregunta: '¿Cómo comparo con el mes anterior?',
    sinonimos: ['cómo veo la diferencia', 'cómo veo la evolución', 'cómo voy vs antes', 'cómo comparo meses'],
    respuesta: 'Para comparar meses, escribe:\n• "comparativo"\n• "compara con el mes anterior"\n• "cómo voy vs el mes pasado"\n\nEl bot muestra ingresos, gastos y balance con variación porcentual.',
  },
]

// =====================================================
// 6. BÚSQUEDA SEMÁNTICA EN BASE DE CONOCIMIENTO
// =====================================================
export function buscarRespuestaQA(mensaje: string): QA | null {
  const mensajeLower = mensaje.toLowerCase().trim()
  let mejorMatch: { qa: QA; score: number } | null = null

  for (const qa of BASE_CONOCIMIENTO) {
    let score = 0

    // Coincidencia con pregunta exacta
    if (mensajeLower === qa.pregunta.toLowerCase()) {
      return qa
    }

    // Coincidencia con sinónimos
    for (const sinonimo of qa.sinonimos) {
      const sinonimoLower = sinonimo.toLowerCase()
      if (mensajeLower.includes(sinonimoLower) || sinonimoLower.includes(mensajeLower)) {
        const s = sinonimoLower.length / Math.max(mensajeLower.length, 1)
        if (s > score) score = s
      }
    }

    // Coincidencia con palabras de la pregunta
    const palabrasPregunta = qa.pregunta.toLowerCase().split(/\s+/)
    const palabrasMensaje = mensajeLower.split(/\s+/)
    let coincidencias = 0
    for (const palabra of palabrasMensaje) {
      if (palabra.length < 3) continue
      for (const palabraPregunta of palabrasPregunta) {
        if (palabraPregunta.includes(palabra) || palabra.includes(palabraPregunta)) {
          coincidencias++
          break
        }
      }
    }
    const scorePalabras = coincidencias / palabrasMensaje.length
    if (scorePalabras > score) score = scorePalabras

    if (score > 0.3 && (!mejorMatch || score > mejorMatch.score)) {
      mejorMatch = { qa, score }
    }
  }

  return mejorMatch?.qa || null
}

// =====================================================
// 7. NORMALIZACIÓN DE MENSAJES
// =====================================================
export function normalizarMensaje(mensaje: string): string {
  return mensaje
    .toLowerCase()
    .trim()
    // Remover acentos para matching
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    // Normalizar signos de puntuación
    .replace(/[¿?¡!]/g, '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// =====================================================
// 8. VALIDACIÓN DE MONTO
// =====================================================
export function validarMonto(monto: number): { valido: boolean; error?: string } {
  if (isNaN(monto)) {
    return { valido: false, error: 'El monto no es un número válido' }
  }
  if (monto <= 0) {
    return { valido: false, error: 'El monto debe ser mayor a 0' }
  }
  if (monto > 1000000000) {
    return { valido: false, error: 'El monto excede el límite máximo (1000 millones)' }
  }
  return { valido: true }
}
