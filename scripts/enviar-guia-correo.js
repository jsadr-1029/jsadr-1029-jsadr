// Script: envía la guía de registro al correo jsa@jsadr.com.co
// Usa el helper interno decryptSensitive para obtener las credenciales SMTP reales
// y luego envía por nodemailer directo con attachments.

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

require('dotenv').config({ path: '/home/z/my-project/.env' })
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

// Importar el módulo de seguridad compilado por Next.js
// ts-node no disponible, así que usamos require del archivo JS ya compilado
// en .next si existe, o cargamos el código inline (re-implementación).

// Re-implementar decryptSensitive con BACKUP_KEY (que es la fallback en producción)
const ALGORITHM = 'aes-256-cbc'
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4' +
  'c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) return null
  try { return Buffer.from(raw, 'hex') } catch { return Buffer.from(raw, 'utf8') }
}

function decryptSensitive(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return ''
  // Probar API_ENCRYPTION_KEY primero
  const keys = [getEncryptionKey(), BACKUP_KEY].filter(Boolean)
  for (const key of keys) {
    try {
      const parts = encrypted.split(':')
      if (parts.length !== 2) continue
      const iv = Buffer.from(parts[0], 'hex')
      const ct = parts[1]
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      let decrypted = decipher.update(ct, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (e) { /* probar siguiente key */ }
  }
  return encrypted // devolver original si no se pudo desencriptar
}

function esCifradoAES(value) {
  if (!value || typeof value !== 'string') return false
  const parts = value.split(':')
  if (parts.length !== 2) return false
  // Ambas partes deben ser hex válidas
  return /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])
}

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const nodemailer = require('nodemailer')
  const prisma = new PrismaClient()

  try {
    const conexion = await prisma.conexionAPI.findFirst({
      where: { tipo: 'EMAIL_SMTP', activa: true },
    })
    if (!conexion) throw new Error('No hay conexión EMAIL_SMTP activa')

    console.log('host:', conexion.url)
    console.log('user:', conexion.usuario)

    // Desencriptar password (que es la SMTP key de Brevo, formato xsmtpsib-...)
    const passEnc = conexion.password
    const passPlain = esCifradoAES(passEnc) ? decryptSensitive(passEnc) : passEnc

    console.log('pass desencriptada (primeros 20):', passPlain.substring(0, 20) + '...')
    console.log('pass length:', passPlain.length)

    // Parsear configExtra
    let host = 'smtp-relay.brevo.com'
    let port = 587
    let secure = false
    let fromName = 'Jsadr'
    let fromEmail = 'jsa@jsadr.com.co'
    if (conexion.configuracionExtra) {
      try {
        const e = JSON.parse(conexion.configuracionExtra)
        if (e.host) host = e.host
        if (e.port) port = parseInt(e.port)
        if (e.secure !== undefined) secure = !!e.secure
        if (e.fromName) fromName = e.fromName
        if (e.fromEmail) fromEmail = e.fromEmail
      } catch {}
    }

    // Crear transporter SMTP
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user: conexion.usuario, pass: passPlain },
    })

    // Verificar conexión
    console.log('Verificando conexión SMTP...')
    await transporter.verify()
    console.log('✓ SMTP OK')

    // Leer archivos
    const pdfPath = '/home/z/my-project/download/Guia_Registro_Cliente_JSADR.pdf'
    const docxPath = '/home/z/my-project/download/Guia_Registro_Cliente_JSADR.docx'

    // Enviar
    console.log('Enviando correo a jsa@jsadr.com.co...')
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: 'jsa@jsadr.com.co',
      subject: 'Guía de Registro de Cliente — Plataforma JSADR',
      html: `
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Guía de Registro de Cliente</h1>
            <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">Plataforma JSADR — Versión 2.0</p>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 12px; color: #111827; font-size: 15px;">Hola,</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
              Adjunto encontrarás la <strong>guía paso a paso con imágenes</strong> para que los clientes nuevos puedan registrarse en la plataforma JSADR.
            </p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">La guía incluye:</p>
            <ul style="margin: 0 0 12px; padding-left: 24px; color: #374151; font-size: 14px; line-height: 1.7;">
              <li>Acceso al formulario de registro (jsadr.com.co/register)</li>
              <li>Los 6 pasos del formulario con capturas de pantalla reales de cada paso</li>
              <li>El nuevo paso de <strong>datos bancarios obligatorios</strong> (banco, tipo de cuenta, número de cuenta)</li>
              <li>Instrucciones para las 3 fotos de verificación de identidad</li>
              <li>Cómo usar el código de seguimiento SNC-XXXXX</li>
              <li>Primer ingreso al portal y cambio de contraseña</li>
              <li>Preguntas frecuentes y canales de contacto</li>
            </ul>
            <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
              Se adjunta la guía en formato PDF (lista para enviar al cliente) y en formato Word editable (por si necesitas personalizarla).
            </p>
            <div style="padding: 12px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">Recordatorio</p>
              <p style="margin: 6px 0 0; color: #78350f; font-size: 12px; line-height: 1.5;">
                Recuerda que el paso de "Crédito solicitado" fue eliminado del formulario de registro. Los clientes ahora se registran únicamente con sus datos personales, ubicación, datos bancarios y fotos. El monto del crédito lo manejan desde el módulo Simulaciones dentro del portal del cliente.
              </p>
            </div>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">Saludos,<br><strong>Sistema JSADR</strong></p>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: 'Guia_Registro_Cliente_JSADR.pdf',
          path: pdfPath,
          contentType: 'application/pdf',
        },
        {
          filename: 'Guia_Registro_Cliente_JSADR.docx',
          path: docxPath,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    })

    console.log('✅ Email enviado correctamente!')
    console.log('  messageId:', info.messageId)
    console.log('  response:', info.response)
  } finally {
    await (require('@prisma/client').PrismaClient ? prisma.$disconnect() : Promise.resolve())
  }
}

main().catch(err => {
  console.error('❌ ERROR:', err.message)
  console.error(err.stack)
  process.exit(1)
})
