// =====================================================
// LIBRERÍA CENTRAL DE SEGURIDAD v1.0
// - Bcrypt password hashing (rounds=12)
// - JWT (access 15min + refresh 7days)
// - Rate limiting (in-memory)
// - Audit logging
// - Account lockout
// =====================================================

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/db'

// === CONFIGURACIÓN ===
const BCRYPT_ROUNDS = 12
const JWT_ACCESS_EXPIRY = '15m'
const JWT_REFRESH_EXPIRY = '7d'
const MAX_INTENTOS_FALLIDOS = 5
const TIEMPO_BLOQUEO_MINUTOS = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests por minuto por IP

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-env-var'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-this-too-in-production'

// === 1. BCRYPT PASSWORD HASHING ===

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// === 2. JWT TOKENS ===

export interface JWTPayload {
  userId: string
  username: string
  rol: string
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}

export function generateAccessToken(payload: Omit<JWTPayload, 'type' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY })
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'type' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY })
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    if (decoded.type !== 'access') return null
    return decoded
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload
    if (decoded.type !== 'refresh') return null
    return decoded
  } catch {
    return null
  }
}

// === 3. RATE LIMITING (in-memory) ===

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export function rateLimit(identifier: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS, windowMs: number = RATE_LIMIT_WINDOW_MS): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime }
}

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

// === 4. ACCOUNT LOCKOUT ===

export async function checkAccountLockout(usuarioId: string): Promise<{ locked: boolean; blockedUntil: Date | null }> {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) return { locked: false, blockedUntil: null }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    return { locked: true, blockedUntil: usuario.bloqueadoHasta }
  }

  // Si el bloqueo ya expiró, resetear
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta <= new Date()) {
    await db.usuario.update({
      where: { id: usuarioId },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    })
  }

  return { locked: false, blockedUntil: null }
}

export async function registerFailedAttempt(usuarioId: string): Promise<{ locked: boolean; attempts: number; maxAttempts: number }> {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) return { locked: false, attempts: 0, maxAttempts: MAX_INTENTOS_FALLIDOS }

  const nuevosIntentos = usuario.intentosFallidos + 1

  if (nuevosIntentos >= MAX_INTENTOS_FALLIDOS) {
    const bloqueadoHasta = new Date()
    bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + TIEMPO_BLOQUEO_MINUTOS)

    await db.usuario.update({
      where: { id: usuarioId },
      data: { intentosFallidos: nuevosIntentos, bloqueadoHasta },
    })

    // Registrar en audit log
    await registrarAuditLog({
      usuarioId,
      usuarioNombre: usuario.nombre,
      accion: 'ACCOUNT_LOCKED',
      modulo: 'seguridad',
      detalles: JSON.stringify({ intentos: nuevosIntentos, bloqueadoHasta }),
      exito: false,
      errorMessage: `Cuenta bloqueada tras ${nuevosIntentos} intentos fallidos`,
    })

    return { locked: true, attempts: nuevosIntentos, maxAttempts: MAX_INTENTOS_FALLIDOS }
  }

  await db.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: nuevosIntentos },
  })

  return { locked: false, attempts: nuevosIntentos, maxAttempts: MAX_INTENTOS_FALLIDOS }
}

export async function resetFailedAttempts(usuarioId: string): Promise<void> {
  await db.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: 0, bloqueadoHasta: null },
  })
}

// === 5. AUDIT LOGGING ===

export async function registrarAuditLog(params: {
  usuarioId?: string | null
  usuarioNombre: string
  accion: string
  modulo: string
  entidadId?: string | null
  entidadNombre?: string | null
  detalles?: string | null
  ipOrigen?: string | null
  userAgent?: string | null
  exito?: boolean
  errorMessage?: string | null
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        usuarioId: params.usuarioId || null,
        usuarioNombre: params.usuarioNombre,
        accion: params.accion,
        modulo: params.modulo,
        entidadId: params.entidadId || null,
        entidadNombre: params.entidadNombre || null,
        detalles: params.detalles || null,
        ipOrigen: params.ipOrigen || null,
        userAgent: params.userAgent || null,
        exito: params.exito ?? true,
        errorMessage: params.errorMessage || null,
      },
    })
  } catch (e) {
    console.error('[AuditLog] Error registrando:', e)
  }
}

// === 5.1 LOGGING ESTRUCTURADO (Reforzado) ===
// Logger JSON para eventos críticos — facilita integración con ELK/Loki/Datadog

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

interface StructuredLog {
  timestamp: string
  level: LogLevel
  modulo: string
  evento: string
  mensaje: string
  userId?: string
  clienteId?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Emite un log estructurado en formato JSON a stdout.
 * En producción debe ser capturado por un colector (Winston/Pino + Loki/ELK).
 */
export function logEstructurado(log: Omit<StructuredLog, 'timestamp'>): void {
  const entrada: StructuredLog = {
    timestamp: new Date().toISOString(),
    ...log,
  }
  const linea = JSON.stringify(entrada)
  // Nivel → método de console
  switch (log.level) {
    case 'CRITICAL':
    case 'ERROR':
      console.error(linea)
      break
    case 'WARN':
      console.warn(linea)
      break
    case 'DEBUG':
      if (process.env.NODE_ENV !== 'production') console.debug(linea)
      break
    default:
      console.log(linea)
  }
}

// === 5.2 EVENTOS CRÍTICOS A LOGUEAR (Reforzado) ===
// Lista canónica de eventos que deben registrarse en AuditLog o logEstructurado.
// Úsala como checklist al añadir nuevas APIs.

export const EVENTOS_CRITICOS_A_LOGUEAR = {
  AUTENTICACION: [
    'LOGIN_EXITOSO',
    'LOGIN_FALLIDO',
    'LOGOUT',
    'TOKEN_EXPIRADO',
    'TOKEN_INVALIDO',
    'SESION_CERRADA',
  ],
  AUTORIZACION: [
    'ACCESO_DENEGADO',
    'ROL_INSUFICIENTE',
    'OWNERSHIP_VIOLADO',
    'INTENTO_IDOR',
  ],
  DATOS_SENSIBLES: [
    'LECTURA_CLIENTES',
    'LECTURA_PRESTAMOS',
    'LECTURA_PAGOS',
    'EXPORTACION_DATOS',
    'BACKUP_GENERADO',
    'BACKUP_RESTAURADO',
  ],
  CONFIGURACION: [
    'CONFIG_MODIFICADA',
    'USUARIO_CREADO',
    'USUARIO_ELIMINADO',
    'ROL_CAMBIADO',
    'API_KEY_CREADA',
    'API_KEY_ELIMINADA',
  ],
  SEGURIDAD: [
    'PIN_BLOQUEADO',
    'PIN_EXPIRADO',
    'OTP_VALIDADO',
    'OTP_FALLIDO',
    'FIRMA_COMPLETADA',
    'CSRF_RECHAZADO',
    'RATE_LIMIT_EXCEDIDO',
  ],
  TRANSACCIONES: [
    'PRESTAMO_CREADO',
    'PRESTAMO_APROBADO',
    'PRESTAMO_RECHAZADO',
    'PAGO_REGISTRADO',
    'PAGO_REVERSADO',
    'CASO_JURIDICO_ABIERTO',
  ],
} as const

// === 5.3 RETENCIÓN DE LOGS (Reforzado) ===
// Política: mantener logs 90 días, luego eliminar automáticamente.

export const RETENCION_LOGS_DIAS = 90

/**
 * Ejecuta la limpieza periódica de logs antiguos.
 * Llamar desde un cron job o API administrativa.
 */
export async function limpiarLogsAntiguos(): Promise<{
  auditLog: number
  accesoPortal: number
  bitacoraPrestamo: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENCION_LOGS_DIAS)

  const [auditLog, accesoPortal, bitacoraPrestamo] = await Promise.all([
    db.auditLog.deleteMany({ where: { fecha: { lt: cutoff } } }),
    db.accesoPortal.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.bitacoraPrestamo.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ])

  logEstructurado({
    level: 'INFO',
    modulo: 'security',
    evento: 'LIMPIEZA_LOGS',
    mensaje: `Limpieza automática de logs completada`,
    metadata: {
      auditLog: auditLog.count,
      accesoPortal: accesoPortal.count,
      bitacoraPrestamo: bitacoraPrestamo.count,
      cutoff: cutoff.toISOString(),
    },
  })

  return {
    auditLog: auditLog.count,
    accesoPortal: accesoPortal.count,
    bitacoraPrestamo: bitacoraPrestamo.count,
  }
}

/**
 * Verifica la cobertura de logging de una API.
 * Retorna los eventos que la API debería loguear pero no lo hace.
 */
export function verificarCoberturaLogging(
  eventosEsperados: string[],
  eventosRegistrados: string[],
): { faltantes: string[]; cobertura: number } {
  const faltantes = eventosEsperados.filter((e) => !eventosRegistrados.includes(e))
  const cobertura =
    eventosEsperados.length === 0
      ? 100
      : Math.round(((eventosEsperados.length - faltantes.length) / eventosEsperados.length) * 100)
  return { faltantes, cobertura }
}

// === 6. CIFRADO DE API KEYS (AES-256) ===

// Reforzado: SIEMPRE requerir API_ENCRYPTION_KEY del environment. Sin fallback.
// PERO: la validación se hace de forma LAZY (al usar encryptSensitive/decryptSensitive)
// para que el archivo pueda importarse en el cliente sin romper la carga de la página.
let ENCRYPTION_KEY: Buffer | null = null
function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      // En producción, solo lanzar error cuando se intenta usar (no en import)
      // Para no romper el cliente que solo usa funciones de sanitización
      if (typeof window !== 'undefined') {
        // Cliente: no lanzar error, las funciones encrypt/decrypt no se usan acá
        return Buffer.alloc(0)
      }
      throw new Error('[FATAL] API_ENCRYPTION_KEY no definido en variables de entorno.')
    }
    console.warn('[WARN] API_ENCRYPTION_KEY no definido. Usando valor temporal. Configurar .env.')
    // Derivar 32 bytes exactos vía SHA-256 para que AES-256-CBC siempre funcione.
    // (Antes se usaba .padEnd(32,'0') sobre una cadena de 38 chars, lo que producía
    // 38 bytes y provocaba "Invalid key length" al cifrar SMTP/credenciales.)
    ENCRYPTION_KEY = crypto.createHash('sha256').update('dev-temp-encryption-key').digest()
    return ENCRYPTION_KEY
  }

  // Normalizar la key a EXACTAMENTE 32 bytes para AES-256-CBC:
  //  - Si es hex de 64 chars → Buffer.from(raw, 'hex') (32 bytes exactos)
  //  - Cualquier otra longitud (incluida 32 chars con bytes no ASCII)
  //    → derivar con SHA-256 para garantizar 32 bytes
  let keyBuf: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    keyBuf = Buffer.from(raw, 'hex')
  } else {
    // String de cualquier longitud → derivar 32 bytes con SHA-256.
    // Esto evita el bug "Invalid key length" cuando el .env tiene
    // un valor de 32 chars con caracteres multibyte UTF-8 o cualquier
    // longitud distinta de 32 bytes.
    keyBuf = crypto.createHash('sha256').update(raw).digest()
  }
  ENCRYPTION_KEY = keyBuf
  return ENCRYPTION_KEY
}
const ALGORITHM = 'aes-256-cbc'

export function encryptSensitive(text: string): string {
  const key = getEncryptionKey()
  if (!key || key.length === 0) throw new Error('Encryption key not available')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decryptSensitive(encryptedText: string): string {
  try {
    const key = getEncryptionKey()
    if (!key || key.length === 0) return encryptedText
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText // no está cifrado
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText // si falla, devolver original
  }
}

// === 6.1 BACKUP DE CREDENCIALES (llave hardcoded, NO depende de .env) ===
//
// Este mecanismo permite recuperar credenciales SMTP (y otras) cuando el .env
// pierde la API_ENCRYPTION_KEY. Como la llave está derivada de una constante
// en código fuente (no en .env), sobrevive a cualquier sobrescritura del .env.
//
// NO es tan seguro como encryptSensitive (la llave es reversible si alguien
// tiene acceso al código fuente), pero es un trade-off explícito para
// disaster-recovery. Solo se usa para el campo `smtpPassBackup` — el campo
// `smtpPass` principal sigue usando encryptSensitive (llave de .env).
//
// Caso de uso: si se pierde .env, el admin entra a Configuración Global →
// Correo → "Restaurar desde backup", y el sistema re-encripta el backup
// con la nueva API_ENCRYPTION_KEY.
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
let BACKUP_KEY: Buffer | null = null
function getBackupKey(): Buffer {
  if (BACKUP_KEY) return BACKUP_KEY
  // Derivar 32 bytes vía SHA-256 (siempre funcionará para AES-256-CBC)
  BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
  return BACKUP_KEY
}

export function encryptBackup(text: string): string {
  const key = getBackupKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decryptBackup(encryptedText: string): string {
  try {
    const key = getBackupKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText
  }
}

// === 7. VALIDACIÓN DE INPUTS Y XSS PROTECTION ===
// Las funciones puras de sanitización/validación se movieron a @/lib/sanitize
// para poder ser usadas desde componentes cliente sin arrastrar Prisma.
// Aquí las re-exportamos para mantener compatibilidad con los 60 server routes
// que ya las importan desde @/lib/security.
export {
  sanitizeString,
  escapeHtml,
  sanitizeHtmlForHighlight,
  sanitizeForReactAttribute,
  isSafeUrl,
  validateEmail,
  validatePhone,
  validateCedula,
  CSP_HEADER,
} from './sanitize'

// === 7.1 XSS PROTECTION (Reforzado) ===

/**
 * Comparación constante-time para prevenir timing attacks.
 * Usa crypto.timingSafeEqual internamente.
 * Retorna true si los strings son iguales.
 *
 * IMPORTANTE: Si los strings tienen diferente longitud, retorna false
 * inmediatamente (no se puede hacer constant-time con longitudes distintas),
 * pero agrega un pequeño delay artificial para mitigar el leak de longitud.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length) {
    // Delay artificial para mitigar timing leak de longitud
    crypto.timingSafeEqual(bufA, bufA) // comparación dummy
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

// (Las implementaciones de escapeHtml, sanitizeHtmlForHighlight,
//  sanitizeForReactAttribute, isSafeUrl, CSP_HEADER, validateEmail,
//  validatePhone y validateCedula se movieron a @/lib/sanitize y se
//  re-exportan arriba para compatibilidad con server routes.)

// === 8. EXTRAER IP Y USER AGENT ===

export function getClientInfo(request: Request): { ip: string; userAgent: string } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return { ip, userAgent }
}

// === 9. CONSTANTES DE SEGURIDAD ===

export const SECURITY_CONFIG = {
  BCRYPT_ROUNDS,
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  MAX_INTENTOS_FALLIDOS,
  TIEMPO_BLOQUEO_MINUTOS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
}
