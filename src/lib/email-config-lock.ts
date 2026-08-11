// =====================================================
// BLOQUEO DE PROTECCIÓN DE CONFIGURACIÓN DE CORREO v1.0
// -----------------------------------------------------
// Garantiza que la configuración de envío de correos
// (ConexionAPI.EMAIL_SMTP y CorreoInstitucional principal)
// NO pueda ser modificada, eliminada ni desactivada
// mientras el bloqueo esté activo.
//
// Componentes:
//   1. SNAPSHOT — Captura el estado conocido-bueno de la
//      configuración de correo (cifrado con BACKUP_KEY
//      para sobrevivir a pérdida de API_ENCRYPTION_KEY).
//   2. VERIFY — Compara el estado actual de la BD contra
//      el snapshot. Detecta drift (cambios no autorizados).
//   3. RESTORE — Si se detecta drift, restaura la config
//      desde el snapshot automáticamente.
//   4. GUARD — Bloquea PUT/DELETE/PATCH en rutas que
//      modificarían la config de correo cuando el lock
//      está activo (retorno HTTP 423 Locked).
//   5. AUTO-VERIFY en enviarEmail() — Antes de cada envío,
//      si el lock está activo, verifica integridad (con
//      caché de 60s). Si hay drift, restaura antes de enviar.
//
// Estado del bloqueo persistido en tabla VariableGlobal:
//   - EMAIL_CONFIG_LOCK_ENABLED  ("true" | "false")
//   - EMAIL_CONFIG_LOCK_SNAPSHOT  (JSON cifrado con BACKUP_KEY)
//   - EMAIL_CONFIG_LOCK_META      (JSON: createdAt, createdBy, reason)
//   - EMAIL_CONFIG_LOCK_LAST_VERIFY (ISO timestamp)
//   - EMAIL_CONFIG_LOCK_LAST_DRIFT  (JSON del último drift detectado, o "null")
// =====================================================

import { db } from './db'
import { encryptBackup, decryptBackup, registrarAuditLog } from './security'

// === CONSTANTES ===
const VAR_LOCK_ENABLED = 'EMAIL_CONFIG_LOCK_ENABLED'
const VAR_LOCK_SNAPSHOT = 'EMAIL_CONFIG_LOCK_SNAPSHOT'
const VAR_LOCK_META = 'EMAIL_CONFIG_LOCK_META'
const VAR_LOCK_LAST_VERIFY = 'EMAIL_CONFIG_LOCK_LAST_VERIFY'
const VAR_LOCK_LAST_DRIFT = 'EMAIL_CONFIG_LOCK_LAST_DRIFT'

// Caché en memoria para no leer la BD en cada llamada a enviarEmail()
let cachedLockEnabled: boolean | null = null
let cachedLockEnabledAt: number = 0
const LOCK_ENABLED_CACHE_TTL_MS = 30 * 1000 // 30s

// Caché del resultado de verificación de integridad
interface IntegrityCache {
  result: IntegrityReport
  at: number
}
let integrityCache: IntegrityCache | null = null
const INTEGRITY_CACHE_TTL_MS = 60 * 1000 // 60s

// === TIPOS ===

export interface EmailConfigSnapshot {
  createdAt: string // ISO
  // ConexionAPI.EMAIL_SMTP activa (puede ser null si no hay)
  conexionSMTP: {
    id: string
    nombre: string
    tipo: string
    url: string | null
    usuario: string | null
    apiKeyCipher: string | null // ya está cifrado en BD, se guarda tal cual
    passwordCipher: string | null
    configuracionExtra: string | null
    activa: boolean
  } | null
  // Todos los CorreoInstitucional activos (con SMTP configurado)
  correosInstitucionales: Array<{
    id: string
    nombre: string
    email: string
    tipo: string
    responsable: string | null
    estado: string
    prioridad: number
    esPrincipal: boolean
    esRespaldo: boolean
    esNoReply: boolean
    smtpHost: string | null
    smtpPort: number | null
    smtpUser: string | null
    smtpPassCipher: string | null
    smtpPassBackupCipher: string | null
    smtpAuthType: string | null
    ssl: boolean
    tls: boolean
    starttls: boolean
    timeout: number
    maxReintentos: number
    limitePorMinuto: number
    aliasRemitente: string | null
    nombreRemitente: string | null
  }>
  // Variables de entorno relevantes (hash, no valor plano)
  envHashes: {
    BREVO_API_KEY?: string // sha256[:12]
    BREVO_SMTP_KEY?: string
    API_ENCRYPTION_KEY?: string
  }
}

export interface IntegrityReport {
  locked: boolean
  snapshotExists: boolean
  snapshotAt: string | null
  driftDetected: boolean
  driftDetails: Array<{
    field: string
    expected: string
    actual: string
  }>
  verifiedAt: string
  restored: boolean // true si se auto-restauró en esta verificación
}

export class EmailConfigLockError extends Error {
  statusCode: number
  code: string
  constructor(message: string, code: string = 'LOCKED', statusCode: number = 423) {
    super(message)
    this.name = 'EmailConfigLockError'
    this.code = code
    this.statusCode = statusCode
  }
}

// === HELPERS DE VARIABLESGLOBAL ===

async function getVar(clave: string): Promise<string | null> {
  try {
    const v = await db.variableGlobal.findUnique({ where: { clave } })
    return v?.valor ?? null
  } catch {
    return null
  }
}

async function setVar(clave: string, valor: string, descripcion?: string): Promise<void> {
  await db.variableGlobal.upsert({
    where: { clave },
    update: { valor },
    create: {
      clave,
      valor,
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: descripcion || 'Bloqueo de configuración de correo',
      editable: false,
    },
  })
}

// === ESTADO DEL LOCK ===

/**
 * Verifica si el bloqueo está activo.
 * Usa caché en memoria de 30s para evitar consultar la BD en cada enviarEmail().
 */
export async function isEmailConfigLocked(): Promise<boolean> {
  const now = Date.now()
  if (cachedLockEnabled !== null && (now - cachedLockEnabledAt) < LOCK_ENABLED_CACHE_TTL_MS) {
    return cachedLockEnabled
  }
  const val = await getVar(VAR_LOCK_ENABLED)
  const enabled = val === 'true'
  cachedLockEnabled = enabled
  cachedLockEnabledAt = now
  return enabled
}

/** Invalida la caché en memoria (después de cambiar el estado del lock). */
function invalidateLockCache(): void {
  cachedLockEnabled = null
  cachedLockEnabledAt = 0
  integrityCache = null
}

// === CAPTURA DE SNAPSHOT ===

function hashEnvVar(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  // Solo guardar un hash para detectar cambios, no el valor plano
  // Usar crypto subtle sha-256 no es sincrónico; usar un hash simple basado en Node crypto
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 12)
}

async function captureSnapshot(): Promise<EmailConfigSnapshot> {
  // 1. ConexionAPI.EMAIL_SMTP activa
  const conexionSMTP = await db.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  // 2. Todos los CorreoInstitucional
  const correos = await db.correoInstitucional.findMany()

  return {
    createdAt: new Date().toISOString(),
    conexionSMTP: conexionSMTP
      ? {
          id: conexionSMTP.id,
          nombre: conexionSMTP.nombre,
          tipo: conexionSMTP.tipo,
          url: conexionSMTP.url,
          usuario: conexionSMTP.usuario,
          apiKeyCipher: conexionSMTP.apiKey,
          passwordCipher: conexionSMTP.password,
          configuracionExtra: conexionSMTP.configuracionExtra,
          activa: conexionSMTP.activa,
        }
      : null,
    correosInstitucionales: correos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      tipo: c.tipo,
      responsable: c.responsable,
      estado: c.estado,
      prioridad: c.prioridad,
      esPrincipal: c.esPrincipal,
      esRespaldo: c.esRespaldo,
      esNoReply: c.esNoReply,
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      smtpUser: c.smtpUser,
      smtpPassCipher: c.smtpPass,
      smtpPassBackupCipher: c.smtpPassBackup,
      smtpAuthType: c.smtpAuthType,
      ssl: c.ssl,
      tls: c.tls,
      starttls: c.starttls,
      timeout: c.timeout,
      maxReintentos: c.maxReintentos,
      limitePorMinuto: c.limitePorMinuto,
      aliasRemitente: c.aliasRemitente,
      nombreRemitente: c.nombreRemitente,
    })),
    envHashes: {
      BREVO_API_KEY: hashEnvVar('BREVO_API_KEY'),
      BREVO_SMTP_KEY: hashEnvVar('BREVO_SMTP_KEY'),
      API_ENCRYPTION_KEY: hashEnvVar('API_ENCRYPTION_KEY'),
    },
  }
}

// === ACTIVAR BLOQUEO ===

export async function enableEmailConfigLock(params: {
  usuarioId?: string | null
  usuarioNombre: string
  reason?: string
}): Promise<{ success: boolean; snapshotAt: string; message: string }> {
  const snapshot = await captureSnapshot()

  if (!snapshot.conexionSMTP && snapshot.correosInstitucionales.length === 0) {
    return {
      success: false,
      snapshotAt: snapshot.createdAt,
      message:
        'No se puede activar el bloqueo: no hay configuración de correo válida en la BD ' +
        '(ni ConexionAPI.EMAIL_SMTP activa ni CorreoInstitucional). ' +
        'Configura el correo primero en Configuración Global → Correos.',
    }
  }

  // Cifrar el snapshot con BACKUP_KEY (sobrevive a pérdida de API_ENCRYPTION_KEY)
  const snapshotJson = JSON.stringify(snapshot)
  const snapshotCipher = encryptBackup(snapshotJson)

  await setVar(VAR_LOCK_SNAPSHOT, snapshotCipher, 'Snapshot cifrado de configuración de correo')
  await setVar(VAR_LOCK_ENABLED, 'true', 'Bloqueo de configuración de correo activo')
  await setVar(
    VAR_LOCK_META,
    JSON.stringify({
      createdAt: snapshot.createdAt,
      createdBy: params.usuarioId || null,
      createdByName: params.usuarioNombre,
      reason: params.reason || 'Bloqueo activado para proteger configuración de correo',
    }),
    'Metadata del bloqueo de configuración de correo',
  )
  await setVar(VAR_LOCK_LAST_VERIFY, snapshot.createdAt, 'Última verificación de integridad')
  await setVar(VAR_LOCK_LAST_DRIFT, 'null', 'Último drift detectado (null = sin drift)')

  invalidateLockCache()

  await registrarAuditLog({
    usuarioId: params.usuarioId || null,
    usuarioNombre: params.usuarioNombre,
    accion: 'EMAIL_CONFIG_LOCK_ENABLED',
    modulo: 'email-lock',
    detalles: JSON.stringify({
      snapshotAt: snapshot.createdAt,
      reason: params.reason,
      hasConexionSMTP: !!snapshot.conexionSMTP,
      correosCount: snapshot.correosInstitucionales.length,
    }),
    exito: true,
  })

  return {
    success: true,
    snapshotAt: snapshot.createdAt,
    message: `Bloqueo activado. Snapshot capturado con ${
      snapshot.conexionSMTP ? '1 conexión SMTP' : '0 conexiones SMTP'
    } y ${snapshot.correosInstitucionales.length} correo(s) institucional(es).`,
  }
}

// === DESACTIVAR BLOQUEO ===

export async function disableEmailConfigLock(params: {
  usuarioId?: string | null
  usuarioNombre: string
  reason: string // obligatorio
}): Promise<{ success: boolean; message: string }> {
  if (!params.reason || params.reason.trim().length < 10) {
    return {
      success: false,
      message: 'Se requiere un motivo de al menos 10 caracteres para desactivar el bloqueo.',
    }
  }

  await setVar(VAR_LOCK_ENABLED, 'false')
  await setVar(
    VAR_LOCK_META,
    JSON.stringify({
      disabledAt: new Date().toISOString(),
      disabledBy: params.usuarioId || null,
      disabledByName: params.usuarioNombre,
      reason: params.reason,
    }),
  )

  invalidateLockCache()

  await registrarAuditLog({
    usuarioId: params.usuarioId || null,
    usuarioNombre: params.usuarioNombre,
    accion: 'EMAIL_CONFIG_LOCK_DISABLED',
    modulo: 'email-lock',
    detalles: JSON.stringify({ reason: params.reason }),
    exito: true,
  })

  return {
    success: true,
    message: 'Bloqueo desactivado. La configuración de correo puede modificarse nuevamente.',
  }
}

// === VERIFICACIÓN DE INTEGRIDAD ===

function safeJsonEq(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export async function verifyEmailConfigIntegrity(): Promise<IntegrityReport> {
  const now = new Date().toISOString()
  const locked = await isEmailConfigLocked()
  const snapshotCipher = await getVar(VAR_LOCK_SNAPSHOT)

  if (!locked || !snapshotCipher) {
    return {
      locked,
      snapshotExists: !!snapshotCipher,
      snapshotAt: null,
      driftDetected: false,
      driftDetails: [],
      verifiedAt: now,
      restored: false,
    }
  }

  // Desencriptar snapshot
  let snapshot: EmailConfigSnapshot
  try {
    const json = decryptBackup(snapshotCipher)
    snapshot = JSON.parse(json)
  } catch (err: any) {
    return {
      locked,
      snapshotExists: true,
      snapshotAt: null,
      driftDetected: true,
      driftDetails: [
        {
          field: 'snapshot',
          expected: 'JSON válido',
          actual: `Error desencriptando: ${err.message}`,
        },
      ],
      verifiedAt: now,
      restored: false,
    }
  }

  // Capturar estado actual
  const current = await captureSnapshot()
  const driftDetails: IntegrityReport['driftDetails'] = []

  // Comparar ConexionAPI.EMAIL_SMTP
  if (
    !snapshot.conexionSMTP &&
    current.conexionSMTP
  ) {
    driftDetails.push({
      field: 'conexionSMTP',
      expected: 'null (sin conexión SMTP en snapshot)',
      actual: `id=${current.conexionSMTP.id} nombre=${current.conexionSMTP.nombre}`,
    })
  } else if (
    snapshot.conexionSMTP &&
    !current.conexionSMTP
  ) {
    driftDetails.push({
      field: 'conexionSMTP',
      expected: `id=${snapshot.conexionSMTP.id} nombre=${snapshot.conexionSMTP.nombre}`,
      actual: 'null (conexión SMTP eliminada o desactivada)',
    })
  } else if (snapshot.conexionSMTP && current.conexionSMTP) {
    const s = snapshot.conexionSMTP
    const c = current.conexionSMTP
    if (s.id !== c.id) {
      driftDetails.push({ field: 'conexionSMTP.id', expected: s.id, actual: c.id })
    }
    if (s.usuario !== c.usuario) {
      driftDetails.push({ field: 'conexionSMTP.usuario', expected: String(s.usuario), actual: String(c.usuario) })
    }
    if (s.apiKeyCipher !== c.apiKeyCipher) {
      driftDetails.push({ field: 'conexionSMTP.apiKey', expected: 'cifrado original', actual: 'cifrado modificado' })
    }
    if (s.passwordCipher !== c.passwordCipher) {
      driftDetails.push({ field: 'conexionSMTP.password', expected: 'cifrado original', actual: 'cifrado modificado' })
    }
    if (s.configuracionExtra !== c.configuracionExtra) {
      driftDetails.push({
        field: 'conexionSMTP.configuracionExtra',
        expected: String(s.configuracionExtra),
        actual: String(c.configuracionExtra),
      })
    }
    if (s.activa !== c.activa) {
      driftDetails.push({ field: 'conexionSMTP.activa', expected: String(s.activa), actual: String(c.activa) })
    }
  }

  // Comparar CorreoInstitucional
  const snapshotCorreosMap = new Map(snapshot.correosInstitucionales.map((c) => [c.id, c]))
  const currentCorreosMap = new Map(current.correosInstitucionales.map((c) => [c.id, c]))

  for (const [id, s] of snapshotCorreosMap.entries()) {
    const c = currentCorreosMap.get(id)
    if (!c) {
      driftDetails.push({
        field: `correoInstitucional.${id}`,
        expected: `existe (email=${s.email})`,
        actual: 'eliminado',
      })
      continue
    }
    if (s.smtpHost !== c.smtpHost) {
      driftDetails.push({ field: `correoInstitucional.${id}.smtpHost`, expected: String(s.smtpHost), actual: String(c.smtpHost) })
    }
    if (s.smtpPort !== c.smtpPort) {
      driftDetails.push({ field: `correoInstitucional.${id}.smtpPort`, expected: String(s.smtpPort), actual: String(c.smtpPort) })
    }
    if (s.smtpUser !== c.smtpUser) {
      driftDetails.push({ field: `correoInstitucional.${id}.smtpUser`, expected: String(s.smtpUser), actual: String(c.smtpUser) })
    }
    if (s.smtpPassCipher !== c.smtpPassCipher) {
      driftDetails.push({
        field: `correoInstitucional.${id}.smtpPass`,
        expected: 'cifrado original',
        actual: 'cifrado modificado',
      })
    }
    if (s.smtpPassBackupCipher !== c.smtpPassBackupCipher) {
      driftDetails.push({
        field: `correoInstitucional.${id}.smtpPassBackup`,
        expected: 'cifrado original',
        actual: 'cifrado modificado',
      })
    }
    if (s.email !== c.email) {
      driftDetails.push({ field: `correoInstitucional.${id}.email`, expected: s.email, actual: c.email })
    }
    if (s.nombre !== c.nombre) {
      driftDetails.push({ field: `correoInstitucional.${id}.nombre`, expected: s.nombre, actual: c.nombre })
    }
    if (s.tipo !== c.tipo) {
      driftDetails.push({ field: `correoInstitucional.${id}.tipo`, expected: s.tipo, actual: c.tipo })
    }
    if (s.estado !== c.estado) {
      driftDetails.push({ field: `correoInstitucional.${id}.estado`, expected: s.estado, actual: c.estado })
    }
    if (s.esPrincipal !== c.esPrincipal) {
      driftDetails.push({ field: `correoInstitucional.${id}.esPrincipal`, expected: String(s.esPrincipal), actual: String(c.esPrincipal) })
    }
    if (s.ssl !== c.ssl) {
      driftDetails.push({ field: `correoInstitucional.${id}.ssl`, expected: String(s.ssl), actual: String(c.ssl) })
    }
    if (s.tls !== c.tls) {
      driftDetails.push({ field: `correoInstitucional.${id}.tls`, expected: String(s.tls), actual: String(c.tls) })
    }
    if (s.aliasRemitente !== c.aliasRemitente) {
      driftDetails.push({ field: `correoInstitucional.${id}.aliasRemitente`, expected: String(s.aliasRemitente), actual: String(c.aliasRemitente) })
    }
    if (s.nombreRemitente !== c.nombreRemitente) {
      driftDetails.push({ field: `correoInstitucional.${id}.nombreRemitente`, expected: String(s.nombreRemitente), actual: String(c.nombreRemitente) })
    }
  }

  // Comparar hashes de env vars
  for (const key of Object.keys(snapshot.envHashes)) {
    const expected = (snapshot.envHashes as any)[key]
    const actual = hashEnvVar(key)
    if (expected !== actual) {
      driftDetails.push({
        field: `env.${key}`,
        expected: expected || 'ausente',
        actual: actual || 'ausente',
      })
    }
  }

  const driftDetected = driftDetails.length > 0

  // Actualizar VariableGlobal con el resultado de la verificación
  await setVar(VAR_LOCK_LAST_VERIFY, now)
  await setVar(
    VAR_LOCK_LAST_DRIFT,
    driftDetected
      ? JSON.stringify({ detectedAt: now, details: driftDetails })
      : 'null',
  )

  return {
    locked,
    snapshotExists: true,
    snapshotAt: snapshot.createdAt,
    driftDetected,
    driftDetails,
    verifiedAt: now,
    restored: false,
  }
}

// === RESTAURACIÓN DESDE SNAPSHOT ===

export async function restoreEmailConfigFromSnapshot(params: {
  usuarioId?: string | null
  usuarioNombre: string
}): Promise<{ success: boolean; restored: boolean; message: string; details?: any }> {
  const snapshotCipher = await getVar(VAR_LOCK_SNAPSHOT)
  if (!snapshotCipher) {
    return { success: false, restored: false, message: 'No hay snapshot para restaurar.' }
  }

  let snapshot: EmailConfigSnapshot
  try {
    snapshot = JSON.parse(decryptBackup(snapshotCipher))
  } catch (err: any) {
    return {
      success: false,
      restored: false,
      message: `Error desencriptando snapshot: ${err.message}`,
    }
  }

  const restoredItems: string[] = []

  // 1. Restaurar ConexionAPI.EMAIL_SMTP
  if (snapshot.conexionSMTP) {
    const s = snapshot.conexionSMTP
    const existing = await db.conexionAPI.findUnique({ where: { id: s.id } }).catch(() => null)
    if (existing) {
      // Restaurar campos sensibles si cambiaron
      await db.conexionAPI.update({
        where: { id: s.id },
        data: {
          nombre: s.nombre,
          url: s.url,
          usuario: s.usuario,
          apiKey: s.apiKeyCipher,
          password: s.passwordCipher,
          configuracionExtra: s.configuracionExtra,
          activa: s.activa,
        },
      })
      restoredItems.push(`conexionSMTP(${s.id}) restaurada`)
    } else {
      // Fue eliminada → recrear
      await db.conexionAPI.create({
        data: {
          id: s.id,
          nombre: s.nombre,
          tipo: s.tipo,
          url: s.url,
          usuario: s.usuario,
          apiKey: s.apiKeyCipher,
          password: s.passwordCipher,
          configuracionExtra: s.configuracionExtra,
          activa: s.activa,
        },
      })
      restoredItems.push(`conexionSMTP(${s.id}) recreada (había sido eliminada)`)
    }
    // Desactivar otras EMAIL_SMTP que pudieran haber sido creadas después
    await db.conexionAPI.updateMany({
      where: { tipo: 'EMAIL_SMTP', NOT: { id: s.id } },
      data: { activa: false },
    })
  }

  // 2. Restaurar CorreoInstitucional
  for (const s of snapshot.correosInstitucionales) {
    const existing = await db.correoInstitucional.findUnique({ where: { id: s.id } }).catch(() => null)
    const data = {
      nombre: s.nombre,
      email: s.email,
      tipo: s.tipo,
      responsable: s.responsable,
      estado: s.estado,
      prioridad: s.prioridad,
      esPrincipal: s.esPrincipal,
      esRespaldo: s.esRespaldo,
      esNoReply: s.esNoReply,
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpUser: s.smtpUser,
      smtpPass: s.smtpPassCipher,
      smtpPassBackup: s.smtpPassBackupCipher,
      smtpAuthType: s.smtpAuthType,
      ssl: s.ssl,
      tls: s.tls,
      starttls: s.starttls,
      timeout: s.timeout,
      maxReintentos: s.maxReintentos,
      limitePorMinuto: s.limitePorMinuto,
      aliasRemitente: s.aliasRemitente,
      nombreRemitente: s.nombreRemitente,
    }
    if (existing) {
      await db.correoInstitucional.update({
        where: { id: s.id },
        data,
      })
      restoredItems.push(`correoInstitucional(${s.id}=${s.email}) restaurado`)
    } else {
      await db.correoInstitucional.create({
        data: { id: s.id, ...data },
      })
      restoredItems.push(`correoInstitucional(${s.id}=${s.email}) recreado`)
    }
  }

  await registrarAuditLog({
    usuarioId: params.usuarioId || null,
    usuarioNombre: params.usuarioNombre,
    accion: 'EMAIL_CONFIG_RESTORED',
    modulo: 'email-lock',
    detalles: JSON.stringify({ restoredItems, snapshotAt: snapshot.createdAt }),
    exito: true,
  })

  // Marcar último drift como restaurado
  await setVar(
    VAR_LOCK_LAST_DRIFT,
    JSON.stringify({
      detectedAt: new Date().toISOString(),
      restoredAt: new Date().toISOString(),
      restoredItems,
    }),
  )

  invalidateLockCache()

  return {
    success: true,
    restored: true,
    message: `Configuración restaurada desde snapshot del ${snapshot.createdAt}.`,
    details: { restoredItems },
  }
}

// === AUTO-VERIFY CON CACHÉ ===
// Llamado por enviarEmail() antes de cada envío. Si el lock está activo
// y hay drift, restaura automáticamente antes de enviar.

export async function autoVerifyAndRestoreIfNeeded(): Promise<{
  verified: boolean
  restored: boolean
  driftDetails?: any[]
}> {
  const locked = await isEmailConfigLocked()
  if (!locked) {
    return { verified: false, restored: false }
  }

  // Caché: solo verificar una vez por minuto
  const now = Date.now()
  if (integrityCache && now - integrityCache.at < INTEGRITY_CACHE_TTL_MS) {
    return {
      verified: true,
      restored: integrityCache.result.restored,
      driftDetails: integrityCache.result.driftDetails,
    }
  }

  const report = await verifyEmailConfigIntegrity()

  if (report.driftDetected) {
    // Auto-restaurar
    const restoreResult = await restoreEmailConfigFromSnapshot({
      usuarioId: null,
      usuarioNombre: 'Sistema (auto-restore)',
    })
    report.restored = restoreResult.restored
    integrityCache = { result: report, at: now }
    return {
      verified: true,
      restored: restoreResult.restored,
      driftDetails: report.driftDetails,
    }
  }

  integrityCache = { result: report, at: now }
  return { verified: true, restored: false }
}

// === GUARDA PARA RUTAS DE MODIFICACIÓN ===
// Llamar al inicio de PUT/DELETE/PATCH en rutas que modifican config de correo.
// Si el lock está activo, lanza EmailConfigLockError (HTTP 423).

export async function assertEmailConfigNotLocked(action: string): Promise<void> {
  const locked = await isEmailConfigLocked()
  if (!locked) return
  throw new EmailConfigLockError(
    `No se puede ${action} la configuración de correo: el bloqueo de protección está activo. ` +
      `Para modificarla, desactiva el bloqueo primero en /api/email-lock con accion=disable ` +
      `(requiere motivo).`,
    'EMAIL_CONFIG_LOCKED',
    423,
  )
}

// === ESTADO PÚBLICO (para UI / monitoreo) ===

export async function getEmailLockStatus(): Promise<{
  enabled: boolean
  snapshotAt: string | null
  meta: any
  lastVerify: string | null
  lastDrift: any
}> {
  const [enabledStr, snapshotCipher, metaStr, lastVerify, lastDriftStr] = await Promise.all([
    getVar(VAR_LOCK_ENABLED),
    getVar(VAR_LOCK_SNAPSHOT),
    getVar(VAR_LOCK_META),
    getVar(VAR_LOCK_LAST_VERIFY),
    getVar(VAR_LOCK_LAST_DRIFT),
  ])

  let meta: any = null
  try {
    if (metaStr) meta = JSON.parse(metaStr)
  } catch {}

  let lastDrift: any = null
  try {
    if (lastDriftStr && lastDriftStr !== 'null') lastDrift = JSON.parse(lastDriftStr)
  } catch {}

  // snapshotAt está dentro del snapshot cifrado; intentar extraerlo
  let snapshotAt: string | null = null
  if (snapshotCipher) {
    try {
      const snap = JSON.parse(decryptBackup(snapshotCipher))
      snapshotAt = snap.createdAt || null
    } catch {}
  }

  return {
    enabled: enabledStr === 'true',
    snapshotAt,
    meta,
    lastVerify,
    lastDrift,
  }
}
