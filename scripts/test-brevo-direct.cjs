// Direct test of enviarEmail() to verify Brevo SMTP works end-to-end
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const fs = require('fs')
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m)
if (dbUrlMatch) process.env.DATABASE_URL = dbUrlMatch[1].trim().replace(/^["']|["']$/g, '')
const encKeyMatch = envContent.match(/^API_ENCRYPTION_KEY=(.+)$/m)
if (encKeyMatch) process.env.API_ENCRYPTION_KEY = encKeyMatch[1].trim().replace(/^["']|["']$/g, '')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Cargar nodemailer dinámicamente
const nodemailer = require('nodemailer')

async function main() {
  console.log('=== Test directo de Brevo SMTP con nueva clave ===')

  // Obtener la config SMTP desde ConexionAPI (como hace lib/email.ts)
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!conexion) {
    console.log('❌ No hay ConexionAPI.EMAIL_SMTP activa')
    return
  }

  // Parsear configuracionExtra
  let host = 'smtp-relay.brevo.com'
  let port = 587
  let secure = false
  let fromName = 'Jsadr'
  let fromEmail = 'jsa@jsadr.com.co'
  if (conexion.configuracionExtra) {
    try {
      const extra = JSON.parse(conexion.configuracionExtra)
      if (extra.host) host = extra.host
      if (extra.port) port = parseInt(extra.port)
      if (extra.fromName) fromName = extra.fromName
      if (extra.fromEmail) fromEmail = extra.fromEmail
    } catch {}
  }

  // Desencriptar password (igual que lib/security.ts)
  const crypto = require('crypto')
  const keyBytes = Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex')
  const [ivHex, encHex] = conexion.password.split(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, Buffer.from(ivHex, 'hex'))
  const pass = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')

  console.log(`  Host: ${host}:${port}`)
  console.log(`  User: ${conexion.usuario}`)
  console.log(`  Pass length: ${pass.length} (starts with ${pass.substring(0, 30)}...)`)
  console.log(`  From: "${fromName}" <${fromEmail}>`)

  // Crear transporter
  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user: conexion.usuario, pass },
  })

  // Verificar conexión
  console.log('\n=== Verificando conexión SMTP ===')
  try {
    await transporter.verify()
    console.log('✅ SMTP verify OK')
  } catch (e) {
    console.log('❌ SMTP verify falló:', e.message)
    await prisma.$disconnect()
    return
  }

  // Enviar correo de prueba a jsa@jsadr.com.co (el mismo correo institucional)
  console.log('\n=== Enviando correo de prueba ===')
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: fromEmail,
      subject: '[TEST JSADR] Recuperación de contraseña — Brevo OK',
      text: `Este es un correo de prueba enviado desde el sistema JSADR.

Se verificó que la nueva clave SMTP de Brevo funciona correctamente.

Fecha: ${new Date().toISOString()}
Servidor: ${host}:${port}
Usuario: ${conexion.usuario}

Si recibes este correo, la recuperación de contraseña está operativa.`,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #6366f1;">✅ Test SMTP — JSADR</h2>
        <p>Este es un correo de prueba enviado desde el sistema JSADR.</p>
        <p>Se verificó que la nueva clave SMTP de Brevo funciona correctamente.</p>
        <ul>
          <li><strong>Fecha:</strong> ${new Date().toISOString()}</li>
          <li><strong>Servidor:</strong> ${host}:${port}</li>
          <li><strong>Usuario:</strong> ${conexion.usuario}</li>
        </ul>
        <p>Si recibes este correo, la recuperación de contraseña está operativa.</p>
      </div>`,
    })
    console.log('✅ Correo enviado! MessageId:', info.messageId)
    console.log('  Response:', info.response)
  } catch (e) {
    console.log('❌ Falló el envío:', e.message)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
