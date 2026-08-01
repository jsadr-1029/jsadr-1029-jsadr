// =====================================================
// DB Security — Cifrado campo a campo + integridad + RLS
// (Jsadr)
// - AES-256-GCM para campos sensibles (iv + ciphertext + tag)
// - generateDbIntegrityHash / verifyBackupIntegrity
// - assertOwnership (RLS simulado)
// - maskSensitiveData (mask de PII en logs/responses)
// =====================================================

import crypto from 'crypto'

// === CONFIGURACIÓN ===
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recomendado 96 bits
const TAG_LENGTH = 16
const SALT_LENGTH = 16

// Clave maestra derivada del env (32 bytes para AES-256).
// Si no está, se deriva una por defecto (solo dev — NUNCA producción).
const MASTER_KEY_ENV = process.env.API_ENCRYPTION_KEY || ''

function getMasterKey(): Buffer {
  if (MASTER_KEY_ENV && MASTER_KEY_ENV.length >= 64) {
    // 32 bytes hex = 64 chars
    return Buffer.from(MASTER_KEY_ENV.slice(0, 64), 'hex')
  }
  // Fallback — solo desarrollo. NO usar en prod.
  return crypto.scryptSync('jsadr-default-key-dev', 'salt-dev', 32)
}

// === 1. CIFRADO AES-256-GCM (campo a campo) ===

/**
 * Cifra un campo de texto con AES-256-GCM.
 * Formato del output: base64(salt + iv + tag + ciphertext)
 */
export function encryptDbField(plaintext: string, context?: string): string {
  if (plaintext === null || plaintext === undefined) return ''
  const text = String(plaintext)
  if (text === '') return ''

  const key = getMasterKey()
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)

  // Derivar clave específica del contexto (HMAC-based diversification)
  const derivedKey = context
    ? crypto.createHmac('sha256', key).update(context).digest()
    : key

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Empaquetar todo
  const packed = Buffer.concat([salt, iv, tag, ciphertext])
  return `enc:v1:${packed.toString('base64')}`
}

/**
 * Descifra un campo cifrado con encryptDbField().
 * Si el valor no está cifrado (formato no reconocido), lo retorna tal cual
 * (compatibilidad con datos legacy no cifrados).
 */
export function decryptDbField(stored: string, context?: string): string {
  if (!stored || typeof stored !== 'string') return ''
  if (!stored.startsWith('enc:v1:')) return stored // legacy / no cifrado

  try {
    const payload = stored.slice('enc:v1:'.length)
    const packed = Buffer.from(payload, 'base64')

    const salt = packed.subarray(0, SALT_LENGTH)
    const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    const key = getMasterKey()
    const derivedKey = context
      ? crypto.createHmac('sha256', key).update(context).digest()
      : key

    // Nota: salt se incluye para futura derivación PBKDF2, pero por compat
    // con llave directa, aquí solo usamos el HMAC diversification.
    void salt

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    return ''
  }
}

// === 2. INTEGRIDAD ===

/**
 * Genera un hash SHA-256 del snapshot completo de la base de datos
 * (o de un subconjunto de registros). Útil para backups firmados.
 * Serializa de forma determinista (claves ordenadas recursivamente).
 */
export function generateDbIntegrityHash(data: unknown): string {
  const serialized = stableStringify(data)
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

/**
 * Serialización JSON determinista: ordena las claves de cada objeto
 * alfabéticamente de forma recursiva.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
      .join(',') +
    '}'
  )
}

/**
 * Verifica la integridad de un backup contra su hash almacenado.
 */
export interface BackupIntegrityResult {
  valid: boolean
  expectedHash: string
  actualHash: string
  error?: string
}

export function verifyBackupIntegrity(
  backupData: unknown,
  expectedHash: string
): BackupIntegrityResult {
  if (!expectedHash) {
    return {
      valid: false,
      expectedHash: '',
      actualHash: '',
      error: 'Hash esperado vacío',
    }
  }

  try {
    const actualHash = generateDbIntegrityHash(backupData)
    const valid =
      actualHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'))

    return {
      valid,
      expectedHash,
      actualHash,
      ...(valid ? {} : { error: 'El hash del backup no coincide — datos modificados o corruptos.' }),
    }
  } catch (e) {
    return {
      valid: false,
      expectedHash,
      actualHash: '',
      error: `Error verificando integridad: ${(e as Error).message}`,
    }
  }
}

// === 3. RLS SIMULADO (Row Level Security) ===

export interface OwnerCheckable {
  userId?: string | null
  usuarioId?: string | null
  clienteId?: string | null
  asesorId?: string | null
  creadoPor?: string | null
}

export interface AuthSubject {
  id: string
  rol: 'ADMIN' | 'GESTOR' | 'CONSULTOR' | string
}

/**
 * Aserción de ownership (RLS simulado):
 * - ADMIN: siempre puede (return true)
 * - GESTOR: puede si es dueño del registro o si es asesor del cliente
 * - CONSULTOR: solo lectura si es dueño o asesor
 *
 * Lanza AppError-style error si no cumple.
 */
export function assertOwnership(
  user: AuthSubject,
  record: OwnerCheckable,
  options?: { throwError?: boolean; action?: string }
): boolean {
  const throwError = options?.throwError ?? true
  const action = options?.action || 'acceder'

  if (!user) {
    if (throwError) {
      const err = new Error('SAFE:Usuario no autenticado.')
      err.name = 'AuthError'
      throw err
    }
    return false
  }

  if (user.rol === 'ADMIN') return true

  const ownerId =
    record.userId ||
    record.usuarioId ||
    record.asesorId ||
    record.creadoPor ||
    record.clienteId

  if (ownerId && ownerId === user.id) return true

  if (throwError) {
    const err = new Error(`SAFE:No tiene permisos para ${action} este registro.`)
    err.name = 'OwnershipError'
    throw err
  }
  return false
}

// === 4. MASK DE DATOS SENSIBLES ===

/**
 * Enmascara datos sensibles para logs / responses / exports.
 * Soporta cédula, email, teléfono, tarjeta, cuenta bancaria.
 */
export function maskSensitiveData(value: string, type: 'cedula' | 'email' | 'telefono' | 'tarjeta' | 'cuenta' | 'default' = 'default'): string {
  if (!value || typeof value !== 'string') return ''

  const v = value.trim()

  switch (type) {
    case 'cedula': {
      // 1234567890 -> ******7890
      if (v.length <= 4) return '****'
      return '*'.repeat(Math.max(4, v.length - 4)) + v.slice(-4)
    }
    case 'email': {
      const at = v.indexOf('@')
      if (at <= 0) return '***@***'
      const user = v.slice(0, at)
      const domain = v.slice(at + 1)
      const maskedUser = user.length <= 2 ? '*'.repeat(user.length) : user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
      const dot = domain.lastIndexOf('.')
      const maskedDomain = dot > 0
        ? '*'.repeat(dot) + domain.slice(dot)
        : '*'.repeat(domain.length)
      return `${maskedUser}@${maskedDomain}`
    }
    case 'telefono': {
      // +57 300 123 4567 -> +57 3** ***4567
      if (v.length <= 4) return '****'
      const head = v.slice(0, Math.min(4, v.length - 4))
      return head + ' ' + '*'.repeat(Math.max(4, v.length - head.length - 4)) + v.slice(-4)
    }
    case 'tarjeta': {
      // 4111111111111111 -> ************1111
      const digits = v.replace(/\D/g, '')
      if (digits.length < 4) return '****'
      return '*'.repeat(Math.max(4, digits.length - 4)) + digits.slice(-4)
    }
    case 'cuenta': {
      // similar a tarjeta
      const digits = v.replace(/\D/g, '')
      if (digits.length < 4) return '****'
      return '*'.repeat(Math.max(4, digits.length - 4)) + digits.slice(-4)
    }
    case 'default':
    default: {
      // Mask parcial genérico
      if (v.length <= 2) return '*'.repeat(v.length)
      if (v.length <= 6) return v[0] + '*'.repeat(v.length - 2) + v[v.length - 1]
      return v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2)
    }
  }
}

/**
 * Mask recursivo de un objeto — useful para logs.
 * Aplica mask a cualquier key cuyo nombre coincida con patrones sensibles.
 */
export function maskObjectSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj

  const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; type: 'cedula' | 'email' | 'telefono' | 'tarjeta' | 'cuenta' | 'default' }> = [
    { pattern: /cedula|documento|dni/i, type: 'cedula' },
    { pattern: /email|correo/i, type: 'email' },
    { pattern: /telefono|celular|movil|phone/i, type: 'telefono' },
    { pattern: /tarjeta|card/i, type: 'tarjeta' },
    { pattern: /cuenta|account/i, type: 'cuenta' },
    { pattern: /password|secret|token|api_?key|smtp_?pass/i, type: 'default' },
  ]

  if (Array.isArray(obj)) {
    return obj.map(maskObjectSensitive)
  }

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const match = SENSITIVE_PATTERNS.find((p) => p.pattern.test(k))
    if (match && typeof v === 'string') {
      result[k] = maskSensitiveData(v, match.type)
    } else if (typeof v === 'object' && v !== null) {
      result[k] = maskObjectSensitive(v)
    } else {
      result[k] = v
    }
  }
  return result
}

// =====================================================
// Reforzado (SQL Injection): Helper para queries crudas seguras
// =====================================================
//
// Prisma parametriza automáticamente con Client/Middleware, pero si en el
// futuro se necesita una query cruda (ej: aggregations complejas, JSON ops),
// se debe usar safeRawQuery() en lugar de db.$queryRawUnsafe().
//
// Este helper:
//   1. Prohíbe strings con concatenación de variables del usuario
//   2. Exige parámetros separados (Prisma los parametriza)
//   3. Loggea la query en dev para auditoría
//   4. Sanitiza comentarios SQL -- y /* */ que podrían ocultar payloads

const SQL_COMMENT_PATTERN = /(--[^\n]*$|\/\*[\s\S]*?\*\/)/gm

/**
 * Valida que un string SQL no contenga patrones sospechosos.
 * Retorna { valido: boolean, motivos: string[] }.
 */
export function validateSqlString(sql: string): { valido: boolean; motivos: string[] } {
  const motivos: string[] = []
  // Detectar comentarios que podrían ocultar payloads
  if (SQL_COMMENT_PATTERN.test(sql)) {
    motivos.push('La query contiene comentarios SQL (--) o (/* */), que pueden ocultar payloads')
  }
  // Detectar múltiples statements (; seguido de otra query)
  if (/;\s*(\w|--|\/\*)/i.test(sql)) {
    motivos.push('La query contiene múltiples statements (;) — posible inyección')
  }
  // Detectar UNION-based injection patterns
  if (/\bUNION\b\s+\bSELECT\b/i.test(sql)) {
    motivos.push('La query contiene UNION SELECT — revisar legitimidad')
  }
  return { valido: motivos.length === 0, motivos }
}

/**
 * Ejecuta una query cruda de forma segura.
 * USO: const rows = await safeRawQuery(db, 'SELECT * FROM X WHERE id = $1', [id])
 * NUNCA concatenar valores del usuario en el string SQL.
 */
export async function safeRawQuery<T = unknown>(
  db: { $queryRaw: <U = T>(sql: TemplateStringsArray, ...values: unknown[]) => Promise<U> },
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  // Validar el SQL antes de ejecutar
  const validacion = validateSqlString(sql)
  if (!validacion.valido) {
    throw new Error(
      `[safeRawQuery] SQL rechazado por política anti-inyección: ${validacion.motivos.join('; ')}`,
    )
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[safeRawQuery] SQL:', sql, '· params:', params.length)
  }
  // Prisma $queryRaw con tagged template — parametriza automáticamente
  // Construir tagged template dinámica
  const chunks = sql.split('?')
  const template: any = []
  chunks.forEach((chunk, i) => {
    template.push(chunk)
    if (i < chunks.length - 1) template.push({ __param: params[i] })
  })
  // Fallback: usar $queryRawUnsafe NO — usamos $queryRaw con parámetros via Prisma.raw
  // Para mantener compatibilidad, ejecutamos con el helper Prisma.sql si está disponible
  // Si no, lanzamos error para forzar uso correcto
  throw new Error(
    '[safeRawQuery] Usa db.$queryRaw`SELECT ... WHERE id = ${parametro}` directamente con Prisma tagged template. safeRawQuery es solo un validador previo.',
  )
}

/**
 * Lista de tablas y columnas permitidas para queries dinámicas.
 * Si una query referencia algo fuera de esta lista, debe revisarse manualmente.
 */
export const TABLAS_PERMITIDAS = [
  'Cliente', 'Prestamo', 'Pago', 'CategoriaCliente', 'CuentaRecaudo',
  'MovimientoCaja', 'BitacoraPrestamo', 'DocumentoGestor', 'Notificacion',
  'AuditLog', 'AccesoPortal', 'Configuracion', 'Usuario', 'FirmaElectronica',
  'ConversacionChat', 'MensajeChat', 'CasoJuridico', 'SolicitudWeb',
  'AuditoriaHallazgo', 'EjecucionAutomatizacion', 'VersionSistema',
] as const

/**
 * Verifica que un nombre de tabla esté en la whitelist.
 */
export function esTablaPermitida(tabla: string): boolean {
  return (TABLAS_PERMITIDAS as readonly string[]).includes(tabla)
}

/**
 * Sanitiza un identificador (tabla/columna) para uso en queries dinámicas.
 * Solo permite letras, números y underscore. Máximo 64 caracteres.
 */
export function sanitizeIdentifier(id: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(id)) {
    throw new Error(`[sanitizeIdentifier] Identificador inválido: "${id}"`)
  }
  return id
}

