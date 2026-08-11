// Script para activar el bloqueo de configuración de correo.
// Captura el snapshot actual de ConexionAPI.EMAIL_SMTP + CorreoInstitucional
// y lo persiste en VariableGlobal (cifrado con BACKUP_KEY).
//
// Uso: node scripts/enable-email-lock.js

// Cargar .env (el script se ejecuta fuera del runtime de Next.js)
// override: true → sobrescribe DATABASE_URL del shell si apunta a SQLite fallback
require('dotenv').config({ path: '.env', override: true })

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

// === BACKUP_KEY (debe coincidir con src/lib/security.ts) ===
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
const ALGORITHM = 'aes-256-cbc'

function encryptBackup(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, BACKUP_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function hashEnvVar(name) {
  const v = process.env[name]
  if (!v) return undefined
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 12)
}

async function main() {
  console.log('=== Activando bloqueo de configuración de correo ===\n')

  // 1. Capturar snapshot
  const conexionSMTP = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  const correos = await prisma.correoInstitucional.findMany()

  console.log('ConexionAPI.EMAIL_SMTP activa:', conexionSMTP ? `${conexionSMTP.nombre} (id=${conexionSMTP.id})` : 'NINGUNA')
  console.log(`CorreoInstitucional: ${correos.length} registro(s)`)
  correos.forEach((c) => {
    console.log(`  - ${c.email} (${c.estado}, principal=${c.esPrincipal}, smtpHost=${c.smtpHost || 'null'})`)
  })

  if (!conexionSMTP && correos.length === 0) {
    console.error('\nERROR: No hay configuración de correo válida. No se puede activar el bloqueo.')
    process.exit(1)
  }

  const snapshot = {
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

  const snapshotJson = JSON.stringify(snapshot)
  const snapshotCipher = encryptBackup(snapshotJson)

  console.log(`\nSnapshot tamaño: ${snapshotJson.length} bytes (cifrado: ${snapshotCipher.length} bytes)`)

  // 2. Persistir en VariableGlobal
  const now = new Date().toISOString()
  const meta = {
    createdAt: now,
    createdBy: null,
    createdByName: 'Script de activación inicial',
    reason: 'Bloqueo activado por script de protección inicial — protege configuración de correo en producción.',
  }

  await prisma.variableGlobal.upsert({
    where: { clave: 'EMAIL_CONFIG_LOCK_ENABLED' },
    update: { valor: 'true' },
    create: {
      clave: 'EMAIL_CONFIG_LOCK_ENABLED',
      valor: 'true',
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: 'Bloqueo de configuración de correo activo',
      editable: false,
    },
  })

  await prisma.variableGlobal.upsert({
    where: { clave: 'EMAIL_CONFIG_LOCK_SNAPSHOT' },
    update: { valor: snapshotCipher },
    create: {
      clave: 'EMAIL_CONFIG_LOCK_SNAPSHOT',
      valor: snapshotCipher,
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: 'Snapshot cifrado de configuración de correo',
      editable: false,
    },
  })

  await prisma.variableGlobal.upsert({
    where: { clave: 'EMAIL_CONFIG_LOCK_META' },
    update: { valor: JSON.stringify(meta) },
    create: {
      clave: 'EMAIL_CONFIG_LOCK_META',
      valor: JSON.stringify(meta),
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: 'Metadata del bloqueo de configuración de correo',
      editable: false,
    },
  })

  await prisma.variableGlobal.upsert({
    where: { clave: 'EMAIL_CONFIG_LOCK_LAST_VERIFY' },
    update: { valor: now },
    create: {
      clave: 'EMAIL_CONFIG_LOCK_LAST_VERIFY',
      valor: now,
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: 'Última verificación de integridad',
      editable: false,
    },
  })

  await prisma.variableGlobal.upsert({
    where: { clave: 'EMAIL_CONFIG_LOCK_LAST_DRIFT' },
    update: { valor: 'null' },
    create: {
      clave: 'EMAIL_CONFIG_LOCK_LAST_DRIFT',
      valor: 'null',
      tipo: 'string',
      categoria: 'email_lock',
      descripcion: 'Último drift detectado (null = sin drift)',
      editable: false,
    },
  })

  console.log('\n✅ Bloqueo activado correctamente.')
  console.log('   Variables creadas en VariableGlobal (categoria=email_lock):')
  console.log('   - EMAIL_CONFIG_LOCK_ENABLED = true')
  console.log('   - EMAIL_CONFIG_LOCK_SNAPSHOT = <cifrado>')
  console.log('   - EMAIL_CONFIG_LOCK_META = <metadata>')
  console.log('   - EMAIL_CONFIG_LOCK_LAST_VERIFY = <timestamp>')
  console.log('   - EMAIL_CONFIG_LOCK_LAST_DRIFT = null')
  console.log('\nA partir de ahora:')
  console.log('  • PUT/DELETE/PATCH /api/conexiones/[id] sobre EMAIL_SMTP → HTTP 423 Locked')
  console.log('  • POST /api/conexiones crear EMAIL_SMTP → HTTP 423 Locked')
  console.log('  • PATCH /api/configuracion-global seccion=correos|smtp → HTTP 423 Locked')
  console.log('  • POST /api/configuracion-global accion=crear_correo → HTTP 423 Locked')
  console.log('  • POST /api/configuracion-global accion=eliminar_correo → HTTP 423 Locked')
  console.log('  • POST /api/configuracion-global accion=restaurar_smtp_backup → HTTP 423 Locked')
  console.log('  • enviarEmail() → auto-verifica integridad (caché 60s) y restaura si hay drift')
  console.log('  • GET /api/email-lock/health → endpoint público para monitoreo uptime')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
