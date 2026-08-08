// =====================================================
// hub-ia/security-gateway.ts
// AI Security Gateway — capa de seguridad entre el chat y los proveedores IA.
//
// Responsabilidades:
//   1. Validar y sanitizar inputs del usuario
//   2. Detectar prompt injection (instrucciones maliciosas embebidas en datos)
//   3. Enmascarar datos sensibles (PII) antes de enviar a proveedores externos
//   4. Validar respuestas de la IA (estructura, parametros, alcance)
//   5. Clasificar riesgo de acciones propuestas
//   6. Rate limiting por usuario
//
// Principio: ZERO TRUST. La IA es un componente no confiable.
// =====================================================

import { db } from '@/lib/db'

// ---------------------------------------------------------
// 1. SANITIZACIÓN DE INPUT
// ---------------------------------------------------------

const MAX_INPUT_LENGTH = 8000 // 8 KB máximo por mensaje

/**
 * Sanitiza el input del usuario antes de enviarlo a la IA.
 * - Trunca a MAX_INPUT_LENGTH
 * - Elimina caracteres de control no imprimibles
 * - Detecta intentos obvios de prompt injection
 */
export function sanitizarInput(texto: string): { ok: boolean; texto: string; warnings: string[] } {
  const warnings: string[] = []
  if (!texto || typeof texto !== 'string') {
    return { ok: false, texto: '', warnings: ['Input vacío o inválido'] }
  }
  let t = texto.trim()
  if (t.length > MAX_INPUT_LENGTH) {
    t = t.slice(0, MAX_INPUT_LENGTH)
    warnings.push(`Input truncado a ${MAX_INPUT_LENGTH} caracteres`)
  }
  // Eliminar caracteres de control (excepto \n, \r, \t)
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return { ok: true, texto: t, warnings }
}

// ---------------------------------------------------------
// 2. DETECCIÓN DE PROMPT INJECTION
// ---------------------------------------------------------

// Patrones típicos de prompt injection (case-insensitive)
const PATRONES_INJECTION = [
  /ignora\s+(todas?\s+)?las?\s+instrucciones/i,
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /olvida\s+(tus?\s+)?instrucciones/i,
  /act[uú]a\s+como\s+si\s+fueras/i,
  /act\s+as\s+if\s+you\s+were/i,
  /eres\s+ahora\s+(un|una)\s+/i,
  /you\s+are\s+now\s+a\s+/i,
  /system\s*:\s*/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
  /<\s*system\s*>/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /mu[eé]strame\s+(tu\s+)?(system\s+)?prompt/i,
  /dame\s+(tu\s+)?api\s?key/i,
  /show\s+me\s+(your\s+)?api\s?key/i,
  /dame\s+(las?\s+)?variables?\s+de\s+entorno/i,
  /show\s+environment\s+variables/i,
  /ejecuta\s+sql/i,
  /execute\s+sql/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /;\s*DROP\s+/i,
  /rm\s+-rf\s+\//i,
  /curl\s+.*\|\s*sh/i,
  /wget\s+.*\|\s*sh/i,
]

export interface ResultadoInjection {
  detectado: boolean
  patrones: string[]
  severidad: 'bajo' | 'medio' | 'alto' | 'critico'
  mensaje: string
}

/**
 * Detecta patrones típicos de prompt injection en el input del usuario.
 * NO bloquea automáticamente (puede ser falso positivo) pero marca
 * el mensaje para que el orquestador lo trate con cuidado.
 */
export function detectarPromptInjection(texto: string): ResultadoInjection {
  const patronesDetectados: string[] = []
  let severidad: ResultadoInjection['severidad'] = 'bajo'

  for (const patron of PATRONES_INJECTION) {
    if (patron.test(texto)) {
      patronesDetectados.push(patron.source)
      // Patrones de sql/system prompt son criticos
      if (/DROP|DELETE|system\s*:|im_start|api\s?key|variables?\s+de\s+entorno|rm\s+-rf|curl.*\|\s*sh/i.test(patron.source)) {
        severidad = 'critico'
      } else if (severidad !== 'critico') {
        severidad = 'medio'
      }
    }
  }

  return {
    detectado: patronesDetectados.length > 0,
    patrones: patronesDetectados,
    severidad,
    mensaje: patronesDetectados.length > 0
      ? `Posible prompt injection detectado (${patronesDetectados.length} patrón(es))`
      : '',
  }
}

// ---------------------------------------------------------
// 3. DATA MASKING — enmascara PII antes de enviar a proveedores externos
// ---------------------------------------------------------

/**
 * Enmascara datos sensibles en un texto antes de enviarlo a un proveedor IA.
 * - Cédulas: 1234567890 → ********7890
 * - Teléfonos: 3001234567 → *******4567
 * - Emails: usuario@dominio.com → u******@dominio.com
 * - Tarjetas de crédito: 4111111111111111 → ************1111
 * - Contraseñas: password=xyz → password=***
 */
export function enmascararPII(texto: string): string {
  if (!texto) return texto
  let t = texto
  // Cédulas colombianas (10-12 dígitos consecutivos)
  t = t.replace(/\b(\d{6,8})(\d{3,4})\b/g, '********$2')
  // Teléfonos (10 dígitos)
  t = t.replace(/\b(\d{3})(\d{4})(\d{3})\b/g, '$1****$3')
  // Emails
  t = t.replace(/\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, '$1******@$2')
  // Tarjetas de crédito (13-19 dígitos)
  t = t.replace(/\b(\d{4})\d{8,11}(\d{4})\b/g, '************$2')
  // Contraseñas en asignaciones
  t = t.replace(/(password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=***REDACTED***')
  return t
}

// ---------------------------------------------------------
// 4. VALIDACIÓN DE RESPUESTAS DE LA IA
// ---------------------------------------------------------

export interface ResultadoValidacion {
  ok: boolean
  errores: string[]
  bloquear: boolean
  motivo?: string
}

/**
 * Valida que una respuesta de la IA sea segura y cumpla estructura.
 * - No debe contener API keys o secretos
 * - No debe contener SQL arbitrario
 * - No debe intentar ejecutar comandos del sistema
 */
export function validarRespuestaIA(respuesta: string): ResultadoValidacion {
  const errores: string[] = []
  let bloquear = false
  let motivo: string | undefined

  // Detectar exfiltración de secretos en la respuesta
  if (/sk-[a-zA-Z0-9]{20,}/.test(respuesta)) {
    errores.push('Respuesta contiene posible API key (sk-*)')
    bloquear = true
    motivo = 'Exfiltración de API key detectada'
  }
  // Detectar JWT tokens
  if (/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/.test(respuesta)) {
    errores.push('Respuesta contiene posible JWT')
    bloquear = true
    motivo = 'Exfiltración de JWT detectada'
  }
  // Detectar variables de entorno
  if (/\bJWT_SECRET\s*=\s*\S+/i.test(respuesta) || /\bDATABASE_URL\s*=\s*\S+/i.test(respuesta)) {
    errores.push('Respuesta contiene variables de entorno sensibles')
    bloquear = true
    motivo = 'Exfiltración de variables de entorno'
  }
  // Detectar comandos shell peligrosos
  if (/\brm\s+-rf\b/.test(respuesta) || /:\(\)\s*\{/.test(respuesta)) {
    errores.push('Respuesta contiene comandos shell peligrosos')
    bloquear = true
    motivo = 'Comando shell peligroso detectado'
  }
  return { ok: errores.length === 0, errores, bloquear, motivo }
}

// ---------------------------------------------------------
// 5. CLASIFICACIÓN DE RIESGO DE ACCIONES
// ---------------------------------------------------------

// Mapa de herramientas → nivel de riesgo
const RIESGO_HERRAMIENTAS: Record<string, 'bajo' | 'medio' | 'alto' | 'critico'> = {
  // Consultas (read-only) → bajo
  consultar_clientes: 'bajo',
  consultar_prestamos: 'bajo',
  consultar_pagos: 'bajo',
  consultar_mora: 'bajo',
  consultar_configuracion: 'bajo',
  consultar_usuarios: 'bajo',
  consultar_modulos: 'bajo',
  consultar_permisos: 'bajo',
  consultar_reportes: 'bajo',
  consultar_logs: 'bajo',
  consultar_estado_sistema: 'bajo',
  // Modificación → medio-alto
  crear_alerta: 'medio',
  modificar_alerta: 'medio',
  modificar_configuracion: 'alto',
  crear_parametro: 'medio',
  actualizar_parametro: 'medio',
  crear_registro: 'alto',
  actualizar_registro: 'alto',
  // Sistema → critico
  detectar_errores: 'bajo',
  ejecutar_validacion: 'medio',
  verificar_integridad: 'bajo',
  generar_reporte: 'bajo',
}

/**
 * Clasifica el riesgo de una herramienta propuesta por la IA.
 */
export function clasificarRiesgo(toolName: string): 'bajo' | 'medio' | 'alto' | 'critico' {
  return RIESGO_HERRAMIENTAS[toolName] || 'alto' // desconocido = alto por defecto
}

/**
 * Determina si una acción requiere confirmación explícita del usuario.
 */
export function requiereConfirmacion(toolName: string): boolean {
  const r = clasificarRiesgo(toolName)
  return r === 'medio' || r === 'alto' || r === 'critico'
}

// ---------------------------------------------------------
// 6. RATE LIMITING — por usuario
// ---------------------------------------------------------

const RATE_LIMIT_VENTANA_MS = 60_000 // 1 minuto
const RATE_LIMIT_MAX_POR_VENTANA = 20 // 20 mensajes/minuto/usuario

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

/**
 * Verifica rate limit por usuario.
 * Retorna { ok, intentosRestantes, resetEnMs }
 */
export function checkRateLimit(usuarioId: string): {
  ok: boolean
  intentosRestantes: number
  resetEnMs: number
} {
  const now = Date.now()
  const entry = rateLimitMap.get(usuarioId)
  if (!entry || now - entry.windowStart > RATE_LIMIT_VENTANA_MS) {
    rateLimitMap.set(usuarioId, { count: 1, windowStart: now })
    return { ok: true, intentosRestantes: RATE_LIMIT_MAX_POR_VENTANA - 1, resetEnMs: RATE_LIMIT_VENTANA_MS }
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX_POR_VENTANA) {
    return { ok: false, intentosRestantes: 0, resetEnMs: RATE_LIMIT_VENTANA_MS - (now - entry.windowStart) }
  }
  return {
    ok: true,
    intentosRestantes: RATE_LIMIT_MAX_POR_VENTANA - entry.count,
    resetEnMs: RATE_LIMIT_VENTANA_MS - (now - entry.windowStart),
  }
}

// ---------------------------------------------------------
// 7. ESTADO DE PAUSA DEL AGENTE IA
// ---------------------------------------------------------

const CLAVE_PAUSA = 'agente_ia_pausado'

/**
 * Verifica si el agente IA está pausado.
 * Cuando está pausado, NO se pueden ejecutar herramientas
 * (solo chat consultivo).
 */
export async function estaAgentePausado(): Promise<boolean> {
  try {
    const config = await db.hubIAConfig.findUnique({ where: { clave: CLAVE_PAUSA } })
    return config?.valor === 'true'
  } catch {
    return false
  }
}

/**
 * Pausa o reanuda el agente IA.
 */
export async function setAgentePausado(pausado: boolean, usuarioNombre: string): Promise<void> {
  await db.hubIAConfig.upsert({
    where: { clave: CLAVE_PAUSA },
    create: { clave: CLAVE_PAUSA, valor: String(pausado), descripcion: 'Pausa global del agente IA', updatedBy: usuarioNombre },
    update: { valor: String(pausado), updatedBy: usuarioNombre },
  })
}

// ---------------------------------------------------------
// 8. VERIFICACIÓN DE PERMISOS
// ---------------------------------------------------------

/**
 * Verifica si el usuario tiene permiso para usar una herramienta.
 * Por ahora: solo ADMIN puede usar herramientas de modificación.
 * ADMIN y GESTOR pueden usar herramientas de consulta.
 */
export function usuarioPuedeUsarHerramienta(
  userRol: string,
  toolName: string
): { ok: boolean; motivo?: string } {
  const riesgo = clasificarRiesgo(toolName)
  // Cualquiera autenticado puede consultar
  if (riesgo === 'bajo') return { ok: true }
  // Solo ADMIN puede modificar
  if (userRol === 'ADMIN') return { ok: true }
  return {
    ok: false,
    motivo: `Tu rol (${userRol}) no tiene permiso para usar herramientas de riesgo ${riesgo}. Solo ADMIN puede ejecutar modificaciones.`,
  }
}
