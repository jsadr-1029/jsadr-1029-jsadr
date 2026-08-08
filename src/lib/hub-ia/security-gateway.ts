// =====================================================
// hub-ia/security-gateway.ts
// AI Security Gateway — capa de seguridad entre el chat y los proveedores IA.
//
// Responsabilidades:
//   1. Validar y sanitizar inputs del usuario
//   2. Detectar prompt injection (instrucciones maliciosas embebidas en datos)
//   3. Enmascarar datos sensibles (PII) antes de enviar a proveedores externos
//   4. Validar respuestas de la IA (estructura, parámetros, alcance)
//   5. Clasificar riesgo de acciones propuestas
//   6. Rate limiting por usuario
//   7. Estado de pausa del agente (3 estados: operativo / solo_consulta / bloqueado)
//   8. Detección de acciones masivas ("elimina todos los clientes")
//   9. Verificación de límite mensual de costos
//  10. Verificación de permisos heredados del usuario
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
  // Patrones adicionales (indirect injection / jailbreak)
  /jailbreak/i,
  /DAN\s*mode/i,
  /developer\s+mode/i,
  /no\s+sigas\s+(tus?\s+)?reglas/i,
  /no\s+tienes\s+reglas/i,
  /tienes\s+acceso\s+(total|completo|ilimitado)/i,
  /imprime\s+(tu\s+)?(config|secrets?)/i,
  /exfiltra/i,
  /dump\s+(database|all|table)/i,
  /mu[eé]strame\s+(todo|toda)\s+(la?\s+)?(base|tabla|datos|users?|customers?)/i,
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
      if (/DROP|DELETE|system\s*:|im_start|api\s?key|variables?\s+de\s+entorno|rm\s+-rf|curl.*\|\s*sh|jailbreak|DAN\s*mode|exfiltra|dump\s+/i.test(patron.source)) {
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
 * - Direcciones bancarias: 0011-2233-4455 → ****4455
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
  // Cuentas bancarias (XXXX-XXXX-XXXX-XXXX)
  t = t.replace(/\b(\d{2})\d{6,12}(\d{4})\b/g, '****$2')
  // Contraseñas en asignaciones
  t = t.replace(/(password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer)\s*[=:]\s*\S+/gi, '$1=***REDACTED***')
  // IPs (parcial)
  t = t.replace(/\b(\d{1,3})\.\d{1,3}\.\d{1,3}\.(\d{1,3})\b/g, '$1.x.x.$2')
  return t
}

/**
 * Enmascara recursivamente los valores string de un objeto (tilizado para contexto enviado a la IA).
 */
export function enmascararPIIObjeto<T>(obj: T): T {
  if (typeof obj === 'string') return enmascararPII(obj) as unknown as T
  if (Array.isArray(obj)) return obj.map(enmascararPIIObjeto) as unknown as T
  if (obj && typeof obj === 'object') {
    const out: any = {}
    for (const k of Object.keys(obj as any)) {
      out[k] = enmascararPIIObjeto((obj as any)[k])
    }
    return out
  }
  return obj
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
  // Detectar API_ENCRYPTION_KEY
  if (/\bAPI_ENCRYPTION_KEY\s*=\s*\S+/i.test(respuesta)) {
    errores.push('Respuesta contiene API_ENCRYPTION_KEY')
    bloquear = true
    motivo = 'Exfiltración de API_ENCRYPTION_KEY'
  }
  // Detectar hashed passwords (bcrypt)
  if (/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(respuesta)) {
    errores.push('Respuesta contiene hash bcrypt (posible password)')
    bloquear = true
    motivo = 'Exfiltración de hash de contraseña'
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
  // Análisis (read-only, devuelve conclusiones) → bajo
  analizar_modulo: 'bajo',
  detectar_errores: 'bajo',
  generar_reporte: 'bajo',
  verificar_servicios: 'bajo',
  // Modificación → medio-alto
  crear_alerta: 'medio',
  modificar_alerta: 'medio',
  crear_registro: 'medio',
  actualizar_registro: 'alto',
  crear_parametro: 'medio',
  actualizar_parametro: 'medio',
  modificar_configuracion: 'alto',
  // Sistema → critico
  ejecutar_validacion: 'medio',
  verificar_integridad: 'bajo',
  analizar_dependencias: 'bajo',
  analizar_configuracion: 'bajo',
  // Crítico (siempre bloquear si no se confirma explícitamente)
  eliminar_registro: 'critico',
  eliminar_todos: 'critico',
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
// 7. ESTADO DE PAUSA DEL AGENTE IA (3 estados)
// ---------------------------------------------------------

export type EstadoAgente = 'operativo' | 'solo_consulta' | 'bloqueado'

const CLAVE_ESTADO_AGENTE = 'agente_ia_estado'

/**
 * Verifica el estado actual del agente IA:
 *   - 'operativo': chat completo + herramientas de consulta y modificación
 *   - 'solo_consulta': chat permitido + solo herramientas de consulta (no modificación)
 *   - 'bloqueado': chat bloqueado por completo
 */
export async function obtenerEstadoAgente(): Promise<EstadoAgente> {
  try {
    const config = await db.hubIAConfig.findUnique({ where: { clave: CLAVE_ESTADO_AGENTE } })
    const valor = config?.valor || 'operativo'
    if (valor === 'solo_consulta' || valor === 'bloqueado') return valor
    return 'operativo'
  } catch {
    return 'operativo'
  }
}

/**
 * Cambia el estado del agente IA.
 */
export async function setEstadoAgente(estado: EstadoAgente, usuarioNombre: string): Promise<void> {
  await db.hubIAConfig.upsert({
    where: { clave: CLAVE_ESTADO_AGENTE },
    create: { clave: CLAVE_ESTADO_AGENTE, valor: estado, descripcion: 'Estado del agente IA (operativo | solo_consulta | bloqueado)', updatedBy: usuarioNombre },
    update: { valor: estado, updatedBy: usuarioNombre },
  })
}

// Backward compat: la pausa binaria antigua se mapea a 'solo_consulta'
export async function estaAgentePausado(): Promise<boolean> {
  const estado = await obtenerEstadoAgente()
  return estado !== 'operativo'
}

export async function setAgentePausado(pausado: boolean, usuarioNombre: string): Promise<void> {
  await setEstadoAgente(pausado ? 'solo_consulta' : 'operativo', usuarioNombre)
}

/**
 * Verifica si el agente puede ejecutar herramientas (cualquier tipo) dado el estado actual.
 */
export async function puedeEjecutarHerramientas(): Promise<{ ok: boolean; soloConsulta: boolean; motivo?: string }> {
  const estado = await obtenerEstadoAgente()
  if (estado === 'bloqueado') {
    return { ok: false, soloConsulta: false, motivo: 'Agente IA bloqueado por el administrador. Chat y herramientas deshabilitados.' }
  }
  if (estado === 'solo_consulta') {
    return { ok: true, soloConsulta: true, motivo: 'Agente IA en modo solo-consulta. Las herramientas de modificación están bloqueadas.' }
  }
  return { ok: true, soloConsulta: false }
}

// ---------------------------------------------------------
// 8. DETECCIÓN DE ACCIONES MASIVAS
// ---------------------------------------------------------

export interface ResultadoAccionMasiva {
  detectado: boolean
  patrones: string[]
  severidad: 'bajo' | 'medio' | 'alto' | 'critico'
  mensaje: string
}

// Patrones de acciones masivas (en español/inglés, case-insensitive)
const PATRONES_ACCION_MASIVA = [
  { patron: /elimina\s+(todos|todas|toda|todo)\s+(los?|las?)\s+/i, severidad: 'critico' as const, desc: 'eliminación masiva' },
  { patron: /borra\s+(todos|todas|toda|todo)\s+/i, severidad: 'critico' as const, desc: 'borrado masivo' },
  { patron: /delete\s+all\s+/i, severidad: 'critico' as const, desc: 'delete all' },
  { patron: /modifica\s+(todos|todas|toda|todo)\s+/i, severidad: 'alto' as const, desc: 'modificación masiva' },
  { patron: /actualiza\s+(todos|todas|toda|todo)\s+/i, severidad: 'alto' as const, desc: 'actualización masiva' },
  { patron: /update\s+all\s+/i, severidad: 'alto' as const, desc: 'update all' },
  { patron: /\b\d{3,}\s+registros?\b/i, severidad: 'alto' as const, desc: 'cantidad masiva de registros' },
  { patron: /\b\d{4,}\s+(clientes?|prestamos?|pagos?|users?|records?)\b/i, severidad: 'critico' as const, desc: 'cantidad muy grande de entidades' },
  { patron: /vac[ií]a\s+(la\s+)?(tabla|base|database)/i, severidad: 'critico' as const, desc: 'vaciar tabla' },
  { patron: /truncate\s+/i, severidad: 'critico' as const, desc: 'truncate' },
  { patron: /restablecer\s+(todo|todos|toda)/i, severidad: 'alto' as const, desc: 'reset masivo' },
  { patron: /aplica\s+(a\s+)?todos/i, severidad: 'alto' as const, desc: 'aplicar a todos' },
  { patron: /env[ií]a\s+(a\s+)?todos/i, severidad: 'medio' as const, desc: 'envío masivo' },
]

/**
 * Detecta si un mensaje del usuario propone una acción masiva.
 * Si detecta, debe bloquear la ejecución y solicitar confirmación inequívoca.
 */
export function detectarAccionMasiva(texto: string): ResultadoAccionMasiva {
  const patronesDetectados: string[] = []
  let severidadMax: ResultadoAccionMasiva['severidad'] = 'bajo'
  const descripciones: string[] = []

  for (const { patron, severidad, desc } of PATRONES_ACCION_MASIVA) {
    if (patron.test(texto)) {
      patronesDetectados.push(patron.source)
      descripciones.push(desc)
      if (severidad === 'critico') severidadMax = 'critico'
      else if (severidad === 'alto' && severidadMax !== 'critico') severidadMax = 'alto'
      else if (severidad === 'medio' && severidadMax === 'bajo') severidadMax = 'medio'
    }
  }

  return {
    detectado: patronesDetectados.length > 0,
    patrones: descripciones,
    severidad: severidadMax,
    mensaje: patronesDetectados.length > 0
      ? `Acción masiva detectada: ${descripciones.join(', ')}. Requiere confirmación explícita y controles adicionales.`
      : '',
  }
}

// ---------------------------------------------------------
// 9. VERIFICACIÓN DE LÍMITE MENSUAL DE COSTOS
// ---------------------------------------------------------

const CLAVE_LIMITE_MENSUAL = 'limite_mensual_usd'

/**
 * Verifica si el usuario/organización está dentro del límite mensual de gasto.
 * Compara el costo total acumulado del mes actual con el límite configurado.
 */
export async function verificarLimiteMensual(): Promise<{ ok: boolean; gastado: number; limite: number; restante: number; porcentaje: number }> {
  try {
    // Leer límite configurado
    const config = await db.hubIAConfig.findUnique({ where: { clave: CLAVE_LIMITE_MENSUAL } })
    const limite = parseFloat(config?.valor || '50')

    // Calcular gasto del mes actual
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const aggregate = await db.hubIAUso.aggregate({
      where: { createdAt: { gte: inicioMes } },
      _sum: { costo: true },
    })
    const gastado = aggregate._sum.costo || 0
    const restante = Math.max(0, limite - gastado)
    const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0

    return {
      ok: gastado < limite,
      gastado,
      limite,
      restante,
      porcentaje,
    }
  } catch {
    return { ok: true, gastado: 0, limite: 50, restante: 50, porcentaje: 0 }
  }
}

// ---------------------------------------------------------
// 10. VERIFICACIÓN DE PERMISOS HEREDADOS DEL USUARIO
// ---------------------------------------------------------

/**
 * Verifica si el usuario tiene permiso para usar una herramienta.
 * Hereda del rol del usuario y, si está disponible, del campo
 * Usuario.permisos (JSON con permisos finos).
 *
 * Reglas:
 *  - Cualquiera autenticado puede consultar (riesgo bajo)
 *  - Solo ADMIN puede modificar (riesgo medio+)
 *  - Acciones críticas requieren confirmación explícita
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

/**
 * Verifica permisos considerando el estado del agente (3 estados).
 * Combina verificación de pausa + verificación de rol.
 */
export async function verificarPermisoCompleto(
  userRol: string,
  toolName: string
): Promise<{ ok: boolean; motivo?: string; estadoAgente?: EstadoAgente }> {
  // 1. Estado del agente
  const estado = await obtenerEstadoAgente()
  if (estado === 'bloqueado') {
    return { ok: false, motivo: 'Agente IA bloqueado por el administrador.', estadoAgente: estado }
  }
  // 2. Si solo_consulta, bloquear herramientas de modificación
  const riesgo = clasificarRiesgo(toolName)
  if (estado === 'solo_consulta' && riesgo !== 'bajo') {
    return { ok: false, motivo: 'Agente IA en modo solo-consulta. Las herramientas de modificación están bloqueadas.', estadoAgente: estado }
  }
  // 3. Permisos del usuario
  const permiso = usuarioPuedeUsarHerramienta(userRol, toolName)
  if (!permiso.ok) return { ...permiso, estadoAgente: estado }
  return { ok: true, estadoAgente: estado }
}
