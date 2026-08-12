// Diagnóstico completo: verificar estado de los últimos OTP enviados por WhatsApp
// y los últimos envíos de correo
const fs = require('fs')
const crypto = require('crypto')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}
const { PrismaClient } = require('@prisma/client')
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
const db = new PrismaClient({ datasources: { db: { url: NEON_URL } } })

async function main() {
  console.log('=== DIAGNÓSTICO COMPLETO OTP ===\n')
  
  // 1. Últimos OtpRegistro
  console.log('--- 1. Últimos 10 OtpRegistro ---')
  const otps = await db.otpRegistro.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  for (const o of otps) {
    const expirado = o.expiraEn < new Date()
    console.log(`  ${o.id}`)
    console.log(`    creado: ${o.createdAt.toISOString()}`)
    console.log(`    metodo: ${o.metodo}  destinatario: ${o.destinatario}`)
    console.log(`    tipo: ${o.tipo}  usado: ${o.usado}  verificado: ${o.verificado}`)
    console.log(`    expira: ${o.expiraEn.toISOString()} ${expirado ? '(EXPIRADO)' : '(vigente)'}`)
    console.log(`    intentos: ${o.intentos}/${o.maxIntentos}  bloqueado: ${o.bloqueado}`)
    console.log('')
  }
  
  // 2. Últimos NotificacionLog (WhatsApp)
  console.log('--- 2. Últimos 10 NotificacionLog ---')
  try {
    const notifs = await db.notificacionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    for (const n of notifs) {
      console.log(`  ${n.id} | tipo=${n.tipo} canal=${n.canal} enviado=${n.enviado}`)
      console.log(`    destinatario=${n.destinatario} wamid=${n.wamid || '-'}`)
      console.log(`    fechaEnvio=${n.fechaEnvio?.toISOString?.() || '-'} error=${n.error || '-'}`)
    }
  } catch (e) { console.log('  Error NotificacionLog:', e.message) }
  
  // 3. Últimos EnvioCorreo
  console.log('\n--- 3. Últimos 10 EnvioCorreo ---')
  try {
    const envios = await db.envioCorreo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    for (const e of envios) {
      console.log(`  ${e.id} | tipo=${e.tipo || '-'} destinatario=${e.destinatario}`)
      console.log(`    estado=${e.estado} asunto=${e.asunto?.substring(0,50) || '-'}`)
      console.log(`    fechaEnvio=${e.fechaEnvio?.toISOString?.() || '-'} error=${e.error || '-'}`)
    }
  } catch (e) { console.log('  Error EnvioCorreo:', e.message) }
  
  // 4. Configuración de email
  console.log('\n--- 4. Configuración email actual ---')
  const brevoKey = await db.variableGlobal.findUnique({ where: { clave: 'BREVO_API_KEY' } })
  if (brevoKey) {
    const val = brevoKey.valor || brevoKey.valorTexto || ''
    console.log(`  BREVO_API_KEY: ${val.substring(0,20)}... (len=${val.length})`)
  }
  
  // 5. Email config lock
  const lockEnabled = await db.variableGlobal.findUnique({ where: { clave: 'EMAIL_CONFIG_LOCK_ENABLED' } })
  console.log(`  EMAIL_CONFIG_LOCK_ENABLED: ${lockEnabled?.valor || '-'}`)
  
  const lockSnapshot = await db.variableGlobal.findUnique({ where: { clave: 'EMAIL_CONFIG_LOCK_SNAPSHOT' } })
  if (lockSnapshot) {
    const val = lockSnapshot.valor || lockSnapshot.valorTexto || ''
    console.log(`  EMAIL_CONFIG_LOCK_SNAPSHOT: ${val.substring(0,80)}... (len=${val.length})`)
  }
  
  // 6. ConexionAPI Brevo
  console.log('\n--- 5. ConexionAPI Brevo SMTP ---')
  const brevo = await db.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (brevo) {
    console.log(`  id: ${brevo.id}  nombre: ${brevo.nombre}`)
    console.log(`  usuario: ${brevo.usuario}`)
    console.log(`  apiKey: ${(brevo.apiKey || '').substring(0,30)}...`)
    console.log(`  activo: ${brevo.activo}`)
  }
  
  // 7. Verificar el último wamid con Meta
  console.log('\n--- 6. Verificar estado del último OTP enviado a Meta ---')
  const lastOtp = otps[0]
  if (lastOtp && lastOtp.destinatario) {
    const telefono = '57' + lastOtp.destinatario.replace(/\D/g, '').replace(/^57/, '')
    // Consultar phone_number_id + check delivery status via API
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
    console.log(`  Phone Number ID: ${PHONE_NUMBER_ID}`)
    console.log(`  Teléfono destino: ${telefono}`)
    
    // Verificar info del número emisor
    const r = await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,code_verification_status,quality_rating`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    )
    const data = await r.json()
    console.log(`  Número emisor: ${data.display_phone_number} (${data.verified_name})`)
    console.log(`  Code verification: ${data.code_verification_status}`)
    console.log(`  Quality: ${data.quality_rating}`)
  }
  
  await db.$disconnect()
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
