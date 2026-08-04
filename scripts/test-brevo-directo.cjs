// Test direct Brevo SMTP login + send with the new key (local nodemailer)
const fs = require('fs')
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
const prisma = new PrismaClient()

async function main() {
  // 1. Get latest EnvioCorreo error
  console.log('=== Latest EnvioCorreo registros ===')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      destinatario: true,
      asunto: true,
      estado: true,
      mensajeError: true,
      createdAt: true,
    },
  })
  for (const e of envios) {
    console.log({
      id: e.id,
      destinatario: e.destinatario,
      asunto: e.asunto,
      estado: e.estado,
      mensajeError: e.mensajeError?.slice(0, 250),
      createdAt: e.createdAt,
    })
  }

  // 2. Test Brevo SMTP directly with nodemailer (local, not via Vercel)
  console.log('\n=== Test directo Brevo SMTP con nodemailer ===')
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: 'b3e8df001@smtp-brevo.com',
      pass: process.env.BREVO_SMTP_KEY,
    },
  })

  try {
    console.log('Verificando conexión SMTP...')
    await transporter.verify()
    console.log('✅ SMTP verify OK — autenticación exitosa')
  } catch (e) {
    console.log(`❌ SMTP verify fallido: ${e.message}`)
    await prisma.$disconnect()
    return
  }

  // 3. Enviar correo de prueba
  console.log('\nEnviando correo de prueba a jsa@jsadr.com.co...')
  try {
    const info = await transporter.sendMail({
      from: '"JSADR Test" <jsa@jsadr.com.co>',
      to: 'jsa@jsadr.com.co',
      subject: 'Test Brevo SMTP — nueva key',
      text: 'Si recibiste este correo, la nueva key Brevo SMTP funciona correctamente.',
    })
    console.log(`✅ Correo enviado! messageId=${info.messageId}`)
  } catch (e) {
    console.log(`❌ Envío fallido: ${e.message}`)
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
