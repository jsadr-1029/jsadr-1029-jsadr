// Script para verificar integridad del bloqueo de correo.
// Llama a verifyEmailConfigIntegrity() y muestra el reporte.
//
// Uso: node scripts/verify-email-lock.js

require('dotenv').config({ path: '.env', override: true })

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
const ALGORITHM = 'aes-256-cbc'

function decryptBackup(encryptedText) {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, BACKUP_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText
  }
}

function hashEnvVar(name) {
  const v = process.env[name]
  if (!v) return undefined
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 12)
}

async function main() {
  console.log('=== Verificación de integridad del bloqueo de correo ===\n')

  // 1. Leer variables del bloqueo
  const vars = await prisma.variableGlobal.findMany({
    where: { categoria: 'email_lock' },
  })
  const varMap = new Map(vars.map((v) => [v.clave, v.valor]))

  const enabled = varMap.get('EMAIL_CONFIG_LOCK_ENABLED') === 'true'
  const snapshotCipher = varMap.get('EMAIL_CONFIG_LOCK_SNAPSHOT')
  const metaStr = varMap.get('EMAIL_CONFIG_LOCK_META')
  const lastVerify = varMap.get('EMAIL_CONFIG_LOCK_LAST_VERIFY')
  const lastDriftStr = varMap.get('EMAIL_CONFIG_LOCK_LAST_DRIFT')

  console.log(`Lock habilitado: ${enabled ? 'SÍ' : 'NO'}`)
  console.log(`Snapshot existe: ${snapshotCipher ? 'SÍ' : 'NO'}`)
  console.log(`Última verificación: ${lastVerify || 'nunca'}`)
  console.log(`Último drift: ${lastDriftStr || 'null'}`)

  if (metaStr) {
    try {
      const meta = JSON.parse(metaStr)
      console.log(`Creado: ${meta.createdAt} por ${meta.createdByName}`)
      console.log(`Motivo: ${meta.reason}`)
    } catch {}
  }

  if (!enabled || !snapshotCipher) {
    console.log('\n⚠️  El bloqueo no está activo o no hay snapshot. No se puede verificar.')
    return
  }

  // 2. Desencriptar snapshot
  let snapshot
  try {
    snapshot = JSON.parse(decryptBackup(snapshotCipher))
  } catch (err) {
    console.error('\n❌ Error desencriptando snapshot:', err.message)
    return
  }
  console.log(`\nSnapshot del: ${snapshot.createdAt}`)
  console.log(`  ConexionSMTP: ${snapshot.conexionSMTP ? snapshot.conexionSMTP.nombre : 'ninguna'}`)
  console.log(`  Correos: ${snapshot.correosInstitucionales.length}`)

  // 3. Capturar estado actual
  const conexionSMTP = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  const correos = await prisma.correoInstitucional.findMany()

  // 4. Comparar
  const drifts = []

  // ConexionSMTP
  if (!snapshot.conexionSMTP && conexionSMTP) {
    drifts.push({ field: 'conexionSMTP', expected: 'null', actual: `${conexionSMTP.nombre} (id=${conexionSMTP.id})` })
  } else if (snapshot.conexionSMTP && !conexionSMTP) {
    drifts.push({ field: 'conexionSMTP', expected: snapshot.conexionSMTP.nombre, actual: 'null (eliminada o desactivada)' })
  } else if (snapshot.conexionSMTP && conexionSMTP) {
    if (snapshot.conexionSMTP.id !== conexionSMTP.id) {
      drifts.push({ field: 'conexionSMTP.id', expected: snapshot.conexionSMTP.id, actual: conexionSMTP.id })
    }
    if (snapshot.conexionSMTP.usuario !== conexionSMTP.usuario) {
      drifts.push({ field: 'conexionSMTP.usuario', expected: snapshot.conexionSMTP.usuario, actual: conexionSMTP.usuario })
    }
    if (snapshot.conexionSMTP.apiKeyCipher !== conexionSMTP.apiKey) {
      drifts.push({ field: 'conexionSMTP.apiKey', expected: 'cifrado original', actual: 'cifrado modificado' })
    }
    if (snapshot.conexionSMTP.passwordCipher !== conexionSMTP.password) {
      drifts.push({ field: 'conexionSMTP.password', expected: 'cifrado original', actual: 'cifrado modificado' })
    }
  }

  // Correos
  const snapMap = new Map(snapshot.correosInstitucionales.map((c) => [c.id, c]))
  const currMap = new Map(correos.map((c) => [c.id, c]))
  for (const [id, s] of snapMap.entries()) {
    const c = currMap.get(id)
    if (!c) {
      drifts.push({ field: `correo.${id}`, expected: `existe (${s.email})`, actual: 'eliminado' })
      continue
    }
    if (s.email !== c.email) drifts.push({ field: `correo.${id}.email`, expected: s.email, actual: c.email })
    if (s.smtpHost !== c.smtpHost) drifts.push({ field: `correo.${id}.smtpHost`, expected: s.smtpHost, actual: c.smtpHost })
    if (s.smtpPort !== c.smtpPort) drifts.push({ field: `correo.${id}.smtpPort`, expected: s.smtpPort, actual: c.smtpPort })
    if (s.smtpUser !== c.smtpUser) drifts.push({ field: `correo.${id}.smtpUser`, expected: s.smtpUser, actual: c.smtpUser })
    if (s.smtpPassCipher !== c.smtpPass) drifts.push({ field: `correo.${id}.smtpPass`, expected: 'original', actual: 'modificado' })
    if (s.estado !== c.estado) drifts.push({ field: `correo.${id}.estado`, expected: s.estado, actual: c.estado })
    if (s.esPrincipal !== c.esPrincipal) drifts.push({ field: `correo.${id}.esPrincipal`, expected: String(s.esPrincipal), actual: String(c.esPrincipal) })
  }

  // Env vars
  for (const key of Object.keys(snapshot.envHashes)) {
    const expected = snapshot.envHashes[key]
    const actual = hashEnvVar(key)
    if (expected !== actual) {
      drifts.push({ field: `env.${key}`, expected: expected || 'ausente', actual: actual || 'ausente' })
    }
  }

  // 5. Resultado
  if (drifts.length === 0) {
    console.log('\n✅ Integridad OK — no se detectaron cambios. La configuración de correo coincide con el snapshot.')
  } else {
    console.log(`\n❌ DRIFT DETECTADO — ${drifts.length} diferencia(s):`)
    drifts.forEach((d) => {
      console.log(`   • ${d.field}: esperado=${d.expected}, actual=${d.actual}`)
    })
    console.log('\nEjecuta: POST /api/email-lock {accion:"restore"} para restaurar desde el snapshot.')
  }

  // 6. Test del endpoint de health
  console.log('\n=== Test del endpoint /api/email-lock/health ===')
  try {
    const rootUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${rootUrl}/api/email-lock/health`)
    const data = await res.json()
    console.log(`HTTP ${res.status} — status: ${data.status}`)
    console.log('Checks:', JSON.stringify(data.checks, null, 2))
  } catch (err) {
    console.log(`(No se pudo consultar el endpoint de health — el servidor probablemente no está corriendo localmente. Esto es normal en CI.)`)
    console.log(`Error: ${err.message}`)
  }
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
