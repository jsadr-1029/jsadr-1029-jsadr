// Envía la guía de registro de cliente al correo jsa@jsadr.com.co
// Usa Brevo HTTPS API (https://api.brevo.com/v3/smtp/email) con attachments base64.
//
// Por qué HTTPS API en vez de SMTP:
// - SMTP relay de Brevo tiene timeout frecuente desde contenedores sin reverse DNS.
// - HTTPS API es más rápido, soporta attachments como base64, y maneja mejor errores.
// - La API key (xkeysib-...) se guarda en ConexionAPI.apiKey (cifrada con BACKUP_KEY_SEED).

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// ────────────────────────────────────────────────────────────────────────────
// 1. BACKUP_KEY_SEED — debe coincidir EXACTAMENTE con src/lib/security.ts
// ────────────────────────────────────────────────────────────────────────────
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()

const ALGORITHM = 'aes-256-cbc'

function decryptWithBackup(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return null
  const parts = encryptedText.split(':')
  if (parts.length !== 2) return null
  if (!/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1])) return null
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, BACKUP_KEY, iv)
    let decrypted = decipher.update(parts[1], 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (e) {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Lee las credenciales Brevo desde Neon (ConexionAPI.EMAIL_SMTP)
// ────────────────────────────────────────────────────────────────────────────
async function getBrevoCreds() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60',
      },
    },
  })
  try {
    const conexion = await prisma.conexionAPI.findFirst({
      where: { tipo: 'EMAIL_SMTP', activa: true },
    })
    if (!conexion) throw new Error('No hay conexión EMAIL_SMTP activa en la BD')

    let apiKey = conexion.apiKey
    if (apiKey && apiKey.includes(':')) {
      const dec = decryptWithBackup(apiKey)
      if (dec) apiKey = dec
    }

    if (!apiKey || !apiKey.startsWith('xkeysib-')) {
      throw new Error(`API key desencriptada no es válida (no empieza con xkeysib-). Longitud: ${apiKey?.length}`)
    }

    // fromEmail del configuracionExtra
    let fromEmail = 'jsa@jsadr.com.co'
    let fromName = 'Jsadr'
    if (conexion.configuracionExtra) {
      try {
        const e = JSON.parse(conexion.configuracionExtra)
        if (e.fromEmail) fromEmail = e.fromEmail
        if (e.fromName) fromName = e.fromName
      } catch {}
    }

    return { apiKey, fromEmail, fromName }
  } finally {
    await prisma.$disconnect()
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Lee los archivos a adjuntar
// ────────────────────────────────────────────────────────────────────────────
const PDF_PATH = '/home/z/my-project/download/Guia_Registro_Cliente_JSADR.pdf'
const DOCX_PATH = '/home/z/my-project/download/Guia_Registro_Cliente_JSADR.docx'

function checkFiles() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`No existe el PDF: ${PDF_PATH}`)
  }
  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`No existe el DOCX: ${DOCX_PATH}`)
  }
  const pdfSize = fs.statSync(PDF_PATH).size
  const docxSize = fs.statSync(DOCX_PATH).size
  console.log(`📄 PDF: ${PDF_PATH} (${(pdfSize / 1024).toFixed(1)} KB)`)
  console.log(`📝 DOCX: ${DOCX_PATH} (${(docxSize / 1024).toFixed(1)} KB)`)
  if (pdfSize < 10000) throw new Error('PDF demasiado pequeño — posible archivo corrupto')
  if (docxSize < 10000) throw new Error('DOCX demasiado pequeño — posible archivo corrupto')
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Envía por Brevo HTTPS API
// ────────────────────────────────────────────────────────────────────────────
async function sendViaBrevo({ apiKey, fromEmail, fromName, to }) {
  const pdfBase64 = fs.readFileSync(PDF_PATH).toString('base64')
  const docxBase64 = fs.readFileSync(DOCX_PATH).toString('base64')

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: to }],
    replyTo: { email: fromEmail, name: fromName },
    subject: 'Guía de Registro de Cliente — Plataforma JSADR',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background: #f3f4f6;">
  <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: 0.3px;">Guía de Registro de Cliente</h1>
    <p style="color: #e0e7ff; margin: 0; font-size: 13px;">Plataforma JSADR · Versión 2.0 · ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>
  <div style="padding: 28px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 0 0 14px; color: #111827; font-size: 15px;">Hola,</p>
    <p style="margin: 0 0 14px; color: #374151; font-size: 14px; line-height: 1.55;">
      Adjunto encontrarás la <strong>guía paso a paso con imágenes</strong> para que los clientes nuevos puedan registrarse en la plataforma JSADR.
    </p>
    <p style="margin: 0 0 8px; color: #374151; font-size: 14px; line-height: 1.55; font-weight: 600;">La guía incluye:</p>
    <ul style="margin: 0 0 14px; padding-left: 22px; color: #374151; font-size: 14px; line-height: 1.7;">
      <li>Acceso al formulario de registro (<a href="https://jsadr.com.co/register" style="color: #4f46e5;">jsadr.com.co/register</a>)</li>
      <li>Los 6 pasos del formulario con <strong>capturas de pantalla reales</strong> de cada paso</li>
      <li>El nuevo paso de <strong>datos bancarios obligatorios</strong> (banco, tipo de cuenta, número de cuenta)</li>
      <li>Instrucciones para las 3 fotos de verificación de identidad (cédula frente, cédula reverso, selfie)</li>
      <li>Cómo usar el código de seguimiento <strong>SNC-XXXXX</strong></li>
      <li>Primer ingreso al portal y cambio de contraseña temporal</li>
      <li>Preguntas frecuentes y canales de contacto</li>
    </ul>
    <p style="margin: 0 0 14px; color: #374151; font-size: 14px; line-height: 1.55;">
      Se adjunta la guía en formato <strong>PDF</strong> (lista para reenviar al cliente) y en formato <strong>Word editable</strong> (por si necesitas personalizarla).
    </p>
    <div style="padding: 16px 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; margin: 18px 0;">
      <p style="margin: 0 0 6px; color: #1e40af; font-size: 13px; font-weight: 700;">Descarga directa</p>
      <p style="margin: 0 0 10px; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
        Si el adjunto no aparece o prefieres descargar directamente, usa estos enlaces públicos:
      </p>
      <p style="margin: 0 0 6px; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
        📄 <a href="https://jsadr-1029-jsadr.vercel.app/guia-registro-cliente.pdf" style="color: #4f46e5; font-weight: 600;">Descargar PDF (770 KB, 17 páginas)</a>
      </p>
      <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
        📝 <a href="https://jsadr-1029-jsadr.vercel.app/guia-registro-cliente.docx" style="color: #4f46e5; font-weight: 600;">Descargar Word editable (1 MB)</a>
      </p>
    </div>
    <div style="padding: 14px 18px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 18px 0; border-radius: 4px;">
      <p style="margin: 0 0 4px; color: #92400e; font-size: 13px; font-weight: 700;">Recordatorio importante</p>
      <p style="margin: 0; color: #78350f; font-size: 12.5px; line-height: 1.55;">
        El paso de "Crédito solicitado" fue <strong>eliminado</strong> del formulario de registro. Los clientes ahora se registran únicamente con sus datos personales, ubicación, datos bancarios y fotos. El monto del crédito lo manejan desde el módulo <strong>Simulaciones</strong> dentro del portal del cliente, una vez su solicitud sea aprobada.
      </p>
    </div>
    <p style="margin: 18px 0 0; color: #6b7280; font-size: 13px;">Saludos,<br><strong style="color: #4f46e5;">Sistema JSADR</strong></p>
  </div>
  <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="margin: 0; color: #9ca3af; font-size: 11px;">© ${new Date().getFullYear()} JSADR · Aurora Bancaria · Este correo es confidencial</p>
  </div>
</body>
</html>`,
    attachments: [
      {
        name: 'Guia_Registro_Cliente_JSADR.pdf',
        content: pdfBase64,
      },
      {
        name: 'Guia_Registro_Cliente_JSADR.docx',
        content: docxBase64,
      },
    ],
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  if (!res.ok) {
    throw new Error(`Brevo API error ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━'.repeat(60))
  console.log('  ENVÍO DE GUÍA DE REGISTRO → jsa@jsadr.com.co')
  console.log('━'.repeat(60))

  // 1. Verificar que los archivos existen
  checkFiles()

  // 2. Leer credenciales Brevo desde BD
  console.log('\n🔐 Obteniendo credenciales Brevo desde Neon...')
  const { apiKey, fromEmail, fromName } = await getBrevoCreds()
  console.log(`   ✓ API key: ${apiKey.substring(0, 12)}...${apiKey.slice(-4)} (${apiKey.length} chars)`)
  console.log(`   ✓ From: "${fromName}" <${fromEmail}>`)

  // 3. Enviar
  console.log('\n📤 Enviando correo a jsa@jsadr.com.co vía Brevo HTTPS API...')
  const result = await sendViaBrevo({ apiKey, fromEmail, fromName, to: 'jsa@jsadr.com.co' })
  console.log('   ✅ ENVIADO')
  console.log(`   messageId: ${result.messageId || '(no devuelto)'}`)
  console.log(`   response:  ${JSON.stringify(result)}`)
  console.log('\n🎯 Listo. Revisa jsa@jsadr.com.co (también carpeta Spam si no llega en 5 min).')
}

main().catch(err => {
  console.error('\n❌ ERROR:')
  console.error('  Mensaje:', err.message)
  if (err.stack) console.error('  Stack:', err.stack)
  process.exit(1)
})
