// =====================================================
// bot-fuzzy-matcher.ts — Motor de matching fuzzy/similitud
// Combina múltiples algoritmos para entender lenguaje natural
// sin requerir respuestas exactas o lineales.
//
// Algoritmos:
// 1. Normalización (acentos, mayúsculas, puntuación)
// 2. Tokenización + Jaccard similarity
// 3. Distancia Levenshtein (tolerancia a typos)
// 4. N-gramas (2-grams y 3-grams)
// 5. Coincidencia por sinónimos/intents
// 6. Score ponderado final
// =====================================================

// =====================================================
// 1. NORMALIZACIÓN
// =====================================================

/**
 * Normaliza texto para comparación:
 * - lowercase
 * - quita acentos
 * - quita puntuación excesiva
 * - colapsa espacios
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^\w\sñ]/g, ' ')       // conserva ñ, quita puntuación
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokeniza en palabras (filtrando stopwords en español)
 */
const STOPWORDS_ES = new Set([
  'el','la','los','las','un','una','unos','unas','de','del','al','a','ante','bajo',
  'con','contra','desde','en','entre','hacia','hasta','para','por','segun','sin','so',
  'sobre','tras','y','o','u','ni','que','como','cuando','donde','quien','cual','cuales',
  'cuyo','cuya','mi','mis','tu','tus','su','sus','nuestro','nuestra','vuestro','vuestra',
  'esto','eso','aquel','esta','esa','aquella','estos','esos','aquellos','estas','esas',
  'aquellas','me','te','se','nos','os','le','les','lo','yo','tu','el','ella','nosotros',
  'vosotros','ellos','ellas','si','no','ya','mas','menos','muy','mucho','poco','tanto',
  'tan','pero','aunque','porque','pues','sino','entonces','luego','mientras','mientras',
  'tanto','ademas','asi','aun','tambien','solo','solamente','casi','siempre','nunca',
  'jamás','hoy','ayer','mañana','ahora','antes','despues','luego','pronto','tarde',
  'temprano','aqui','alli','alla','cerca','lejos','dentro','fuera','arriba','abajo',
  'delante','detras','hay','es','son','era','eran','fue','fueron','ser','estar','estoy',
  'estas','esta','estan','estaba','estaban','estuvo','estuvieron','ha','he','han','has',
  'habia','habian','tener','tengo','tienes','tiene','tienen','tenia','tenian','tuvo',
  'tuvieron','quiero','quieres','quiere','quieren','queria','querian','puedo','puedes',
  'puede','pueden','podia','podian','debo','debes','debe','deben','saber','se','sabes',
  'sabe','saben','hacer','hago','haces','hace','hacen','decir','digo','dices','dice',
  'dicen','ir','voy','vas','va','van','ver','veo','ves','ve','ven','dar','doy','das',
  'da','dan','q','k','x','c','umo','ustd','ud','vd','sr','sra','srta','don','dona',
])

export function tokenizar(texto: string): string[] {
  const normalizado = normalizarTexto(texto)
  return normalizado
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS_ES.has(t))
}

// =====================================================
// 2. SIMILITUD JACCARD (token-based)
// =====================================================

export function similitudJaccard(a: string, b: string): number {
  const tokensA = new Set(tokenizar(a))
  const tokensB = new Set(tokenizar(b))
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let interseccion = 0
  tokensA.forEach((t) => { if (tokensB.has(t)) interseccion++ })
  const union = tokensA.size + tokensB.size - interseccion
  return interseccion / union
}

// =====================================================
// 3. DISTANCIA LEVENSHTEIN (typos)
// =====================================================

export function distanciaLevenshtein(a: string, b: string): number {
  const s1 = normalizarTexto(a)
  const s2 = normalizarTexto(b)
  if (s1.length === 0) return s2.length
  if (s2.length === 0) return s1.length

  const matriz: number[][] = Array(s1.length + 1)
    .fill(null)
    .map(() => Array(s2.length + 1).fill(0))

  for (let i = 0; i <= s1.length; i++) matriz[i][0] = i
  for (let j = 0; j <= s2.length; j++) matriz[0][j] = j

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const costo = s1[i - 1] === s2[j - 1] ? 0 : 1
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,        // borrado
        matriz[i][j - 1] + 1,        // inserción
        matriz[i - 1][j - 1] + costo // sustitución
      )
    }
  }
  return matriz[s1.length][s2.length]
}

/**
 * Similitud basada en Levenshtein normalizada a 0-1
 */
export function similitudLevenshtein(a: string, b: string): number {
  const s1 = normalizarTexto(a)
  const s2 = normalizarTexto(b)
  if (s1.length === 0 && s2.length === 0) return 1
  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1
  const dist = distanciaLevenshtein(s1, s2)
  return 1 - dist / maxLen
}

// =====================================================
// 4. N-GRAMAS (2-grams y 3-grams)
// =====================================================

function generarNgramas(texto: string, n: number): Set<string> {
  const normalizado = normalizarTexto(texto).replace(/\s+/g, ' ')
  if (normalizado.length < n) return new Set()
  const ngramas = new Set<string>()
  for (let i = 0; i <= normalizado.length - n; i++) {
    ngramas.add(normalizado.substring(i, i + n))
  }
  return ngramas
}

export function similitudNgramas(a: string, b: string, n: number = 2): number {
  const ngA = generarNgramas(a, n)
  const ngB = generarNgramas(b, n)
  if (ngA.size === 0 || ngB.size === 0) return 0
  let interseccion = 0
  ngA.forEach((ng) => { if (ngB.has(ng)) interseccion++ })
  const union = ngA.size + ngB.size - interseccion
  return interseccion / union
}

// =====================================================
// 5. COINCIDENCIA POR SINÓNIMOS/INTENTS
// =====================================================

export interface IntentMatch {
  id: string
  sinonimos: string[]
}

/**
 * Comprueba si el texto del usuario coincide con alguno de los sinónimos
 * del intent. Devuelve un score 0-1 basado en el mejor match.
 */
export function similitudIntents(textoUsuario: string, intents: IntentMatch[]): {
  mejorIntentId: string | null
  score: number
} {
  const textoNorm = normalizarTexto(textoUsuario)
  let mejorScore = 0
  let mejorIntentId: string | null = null

  for (const intent of intents) {
    for (const sinonimo of intent.sinonimos) {
      const sinNorm = normalizarTexto(sinonimo)
      // Coincidencia exacta (peso máximo)
      if (textoNorm === sinNorm) {
        return { mejorIntentId: intent.id, score: 1.0 }
      }
      // Coincidencia parcial (el sinónimo aparece dentro del texto del usuario)
      if (textoNorm.includes(sinNorm) && sinNorm.length > 3) {
        const score = sinNorm.length / textoNorm.length
        if (score > mejorScore) {
          mejorScore = Math.min(0.9, score + 0.2) // bonus por aparición
          mejorIntentId = intent.id
        }
      }
      // Coincidencia al revés (el texto del usuario aparece dentro del sinónimo)
      if (sinNorm.includes(textoNorm) && textoNorm.length > 3) {
        const score = textoNorm.length / sinNorm.length
        if (score > mejorScore) {
          mejorScore = Math.min(0.85, score + 0.15)
          mejorIntentId = intent.id
        }
      }
    }
  }

  return { mejorIntentId, score: mejorScore }
}

// =====================================================
// 6. SCORE PONDERADO FINAL
// =====================================================

export interface ResultadoMatch {
  score: number              // 0-1
  metodo: 'EXACTO' | 'JACCARD' | 'LEVENSHTEIN' | 'NGRAMA' | 'INTENT' | 'COMBINADO' | 'NINGUNO'
  confianza: 'ALTA' | 'MEDIA' | 'BAJA' | 'NULA'
  detalle: {
    jaccard: number
    levenshtein: number
    ngrama2: number
    ngrama3: number
    intent: number
  }
}

/**
 * Calcula el score ponderado de similitud entre dos textos.
 * Combina múltiples algoritmos para máxima robustez.
 */
export function calcularSimilitud(
  textoUsuario: string,
  textoReferencia: string,
  intents?: IntentMatch[]
): ResultadoMatch {
  const tu = normalizarTexto(textoUsuario)
  const tr = normalizarTexto(textoReferencia)

  // Coincidencia exacta
  if (tu === tr && tu.length > 0) {
    return {
      score: 1.0,
      metodo: 'EXACTO',
      confianza: 'ALTA',
      detalle: { jaccard: 1, levenshtein: 1, ngrama2: 1, ngrama3: 1, intent: 0 },
    }
  }

  const jaccard = similitudJaccard(tu, tr)
  const levenshtein = similitudLevenshtein(tu, tr)
  const ngrama2 = similitudNgramas(tu, tr, 2)
  const ngrama3 = similitudNgramas(tu, tr, 3)
  let intentScore = 0
  if (intents && intents.length > 0) {
    const intentResult = similitudIntents(textoUsuario, intents)
    intentScore = intentResult.score
  }

  // Score ponderado: Jaccard 30%, Levenshtein 25%, N-gramas 25%, Intents 20%
  const scorePonderado =
    jaccard * 0.30 +
    levenshtein * 0.25 +
    (ngrama2 * 0.15 + ngrama3 * 0.10) +
    intentScore * 0.20

  let metodo: ResultadoMatch['metodo'] = 'COMBINADO'
  if (jaccard >= 0.8) metodo = 'JACCARD'
  else if (levenshtein >= 0.85) metodo = 'LEVENSHTEIN'
  else if (ngrama2 >= 0.8) metodo = 'NGRAMA'
  else if (intentScore >= 0.8) metodo = 'INTENT'

  let confianza: ResultadoMatch['confianza'] = 'NULA'
  if (scorePonderado >= 0.75) confianza = 'ALTA'
  else if (scorePonderado >= 0.55) confianza = 'MEDIA'
  else if (scorePonderado >= 0.35) confianza = 'BAJA'

  return {
    score: Math.min(1, Math.round(scorePonderado * 1000) / 1000),
    metodo,
    confianza,
    detalle: {
      jaccard: Math.round(jaccard * 1000) / 1000,
      levenshtein: Math.round(levenshtein * 1000) / 1000,
      ngrama2: Math.round(ngrama2 * 1000) / 1000,
      ngrama3: Math.round(ngrama3 * 1000) / 1000,
      intent: Math.round(intentScore * 1000) / 1000,
    },
  }
}

// =====================================================
// 7. BUSCAR MEJOR COINCIDENCIA EN UN CONJUNTO
// =====================================================

export interface ItemEntrenamiento {
  id: string
  pregunta: string
  respuesta: string
  categoria?: string
  sinonimos?: string[]
}

export interface ResultadoBusqueda {
  item: ItemEntrenamiento | null
  score: number
  confianza: 'ALTA' | 'MEDIA' | 'BAJA' | 'NULA'
  metodo: string
  topCandidatos: Array<{ item: ItemEntrenamiento; score: number }>
}

/**
 * Busca la mejor coincidencia para la pregunta del usuario
 * dentro de un conjunto de items de entrenamiento.
 *
 * @param preguntaUsuario Texto escrito por el usuario
 * @param items Conjunto de Q&A disponibles
 * @param umbral Mínimo score para considerar match (default 0.45)
 */
export function buscarMejorMatch(
  preguntaUsuario: string,
  items: ItemEntrenamiento[],
  umbral: number = 0.45
): ResultadoBusqueda {
  if (!preguntaUsuario || items.length === 0) {
    return {
      item: null,
      score: 0,
      confianza: 'NULA',
      metodo: 'NINGUNO',
      topCandidatos: [],
    }
  }

  const candidatos: Array<{ item: ItemEntrenamiento; score: number; metodo: string }> = []

  for (const item of items) {
    // Construye intents a partir de los sinónimos del item si los tiene
    const intents: IntentMatch[] | undefined = item.sinonimos && item.sinonimos.length > 0
      ? [{ id: item.id, sinonimos: [...item.sinonimos, item.pregunta] }]
      : undefined

    const resultado = calcularSimilitud(preguntaUsuario, item.pregunta, intents)
    candidatos.push({
      item,
      score: resultado.score,
      metodo: resultado.metodo,
    })
  }

  // Ordenar por score descendente
  candidatos.sort((a, b) => b.score - a.score)

  const mejor = candidatos[0]
  if (!mejor || mejor.score < umbral) {
    return {
      item: null,
      score: mejor?.score || 0,
      confianza: 'NULA',
      metodo: 'NINGUNO',
      topCandidatos: candidatos.slice(0, 3),
    }
  }

  let confianza: ResultadoBusqueda['confianza'] = 'BAJA'
  if (mejor.score >= 0.75) confianza = 'ALTA'
  else if (mejor.score >= 0.55) confianza = 'MEDIA'

  return {
    item: mejor.item,
    score: mejor.score,
    confianza,
    metodo: mejor.metodo,
    topCandidatos: candidatos.slice(0, 3),
  }
}

// =====================================================
// 8. DETECCIÓN DE INTENCIÓN GENERAL
// =====================================================

export type IntencionGeneral =
  | 'SALUDO'
  | 'DESPEDIDA'
  | 'AGRADECIMIENTO'
  | 'AYUDA'
  | 'CONSULTA'
  | 'QUEJA'
  | 'URGENCIA'
  | 'ESCALAR_HUMANO'
  | 'OTRO'

const PATRONES_INTENCION: Array<{ intencion: IntencionGeneral; patrones: string[] }> = [
  {
    intencion: 'SALUDO',
    patrones: ['hola','buenas','buenos dias','buenas tardes','buenas noches','saludos','hey','hi','hello','que mas','q mas','buen dia'],
  },
  {
    intencion: 'DESPEDIDA',
    patrones: ['chao','adios','hasta luego','nos vemos','bye','goodbye','me voy','hasta pronto','suerte'],
  },
  {
    intencion: 'AGRADECIMIENTO',
    patrones: ['gracias','muchas gracias','mil gracias','agradezco','thanks','thank you','ty','thx'],
  },
  {
    intencion: 'AYUDA',
    patrones: ['ayuda','help','no se','no entiendo','que hago','que puedo hacer','menu','opciones','comandos'],
  },
  {
    intencion: 'ESCALAR_HUMANO',
    patrones: ['asesor','humano','persona','operador','alguien','hablar con','quiero hablar','atencion al cliente','llamenme','contactenme'],
  },
  {
    intencion: 'URGENCIA',
    patrones: ['urgente','urgent','ya','rapido','inmediato','cuanto antes','pronto','ahora mismo','emergencia'],
  },
  {
    intencion: 'QUEJA',
    patrones: ['queja','reclamo','reclamacion','problema','error','falla','no sirve','malo','pésimo','horrible','descontento','molesto','furioso'],
  },
]

export function detectarIntencion(texto: string): IntencionGeneral {
  const textoNorm = normalizarTexto(texto)
  for (const { intencion, patrones } of PATRONES_INTENCION) {
    for (const patron of patrones) {
      if (textoNorm.includes(normalizarTexto(patron))) {
        return intencion
      }
    }
  }
  return 'CONSULTA'
}

// =====================================================
// 9. UTILIDADES
// =====================================================

/**
 * Calcula un porcentaje de cobertura de entrenamiento basado en:
 * - Cantidad de items Q&A
 * - Cantidad de sinónimos
 * - Distribución por categorías
 */
export function calcularCoberturaEntrenamiento(items: ItemEntrenamiento[]): {
  porcentaje: number
  desglose: {
    cantidadItems: number
    cantidadSinonimos: number
    categoriasCubiertas: number
    scoreCantidad: number
    scoreSinonimos: number
    scoreCategorias: number
  }
} {
  const cantidadItems = items.length
  const cantidadSinonimos = items.reduce((s, it) => s + (it.sinonimos?.length || 0), 0)
  const categoriasSet = new Set(items.map((i) => i.categoria).filter(Boolean))
  const categoriasCubiertas = categoriasSet.size

  // Score por cantidad de items (escala logarítmica, máximo a 15 items)
  const scoreCantidad = Math.min(1, Math.log10(Math.max(1, cantidadItems)) / Math.log10(15))
  // Score por sinónimos (máximo a 3 por item en promedio)
  const promedioSinonimos = cantidadItems > 0 ? cantidadSinonimos / cantidadItems : 0
  const scoreSinonimos = Math.min(1, promedioSinonimos / 3)
  // Score por categorías (máximo a 4 categorías)
  const scoreCategorias = Math.min(1, categoriasCubiertas / 4)

  // Ponderación: 50% items, 30% sinónimos, 20% categorías
  const porcentaje = Math.round((scoreCantidad * 0.5 + scoreSinonimos * 0.3 + scoreCategorias * 0.2) * 100)

  return {
    porcentaje: Math.min(100, porcentaje),
    desglose: {
      cantidadItems,
      cantidadSinonimos,
      categoriasCubiertas,
      scoreCantidad: Math.round(scoreCantidad * 100) / 100,
      scoreSinonimos: Math.round(scoreSinonimos * 100) / 100,
      scoreCategorias: Math.round(scoreCategorias * 100) / 100,
    },
  }
}
