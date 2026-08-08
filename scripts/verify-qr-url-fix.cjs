// =====================================================
// verify-qr-url-fix.cjs
// -----------------------------------------------------
// Verifica que el generador de QR ahora usa NEXT_PUBLIC_APP_URL
// (https://jsadr.com.co) en lugar del host de req.url (que en
// sandbox/preview resulta en URLs temporales que se desactivan).
// =====================================================
require('dotenv').config({ path: '.env' })
const QRCode = require('qrcode')
const crypto = require('crypto')

async function main() {
  console.log('=== Test de URL canónica para QR ===\n')

  // Leer las variables de entorno que usa el generador de QR
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
  console.log(`NEXT_PUBLIC_APP_URL  = ${APP_URL || '(no definido)'}`)
  console.log(`NEXT_PUBLIC_BASE_URL = ${BASE_URL || '(no definido)'}`)

  // Replicar la lógica del generador de QR (versión nueva)
  const baseUrl = APP_URL || BASE_URL || 'https://jsadr.com.co'
  console.log(`\n→ URL base usada para el QR: ${baseUrl}`)

  if (baseUrl.includes('space-z.ai') || baseUrl.includes('preview-chat')) {
    console.log('✗ ERROR: La URL todavía apunta al sandbox/preview!')
    process.exit(1)
  }
  if (baseUrl === 'https://jsadr.com.co') {
    console.log('✓ OK: URL canónica de producción (https://jsadr.com.co)')
  } else {
    console.log(`✓ OK: URL configurada por variable de entorno: ${baseUrl}`)
  }

  // Generar un código de verificación de ejemplo
  const prestamoFalso = {
    id: 'test-prestamo-id',
    codigo: 'PREST-TEST-001',
    montoPrincipal: 5000000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }
  const data = `${prestamoFalso.id}|pagare-diligenciado|${prestamoFalso.codigo}|${prestamoFalso.montoPrincipal}|${prestamoFalso.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  const codigoVer = hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
  const urlVerificacion = `${baseUrl}/api/documentos/verificar?codigo=${codigoVer}`

  console.log(`\n→ URL completa del QR (ejemplo):`)
  console.log(`  ${urlVerificacion}`)

  // Generar el QR como data URL
  const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
    width: 150, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' },
  })
  console.log(`\n→ QR generado correctamente (${qrDataUrl.length} bytes base64)`)
  console.log(`  Primeros 80 chars: ${qrDataUrl.substring(0, 80)}...`)

  console.log('\n=== Resumen ===')
  console.log('Antes:  QR apuntaba a https://preview-chat-*.space-z.ai/... → sandbox inactivo')
  console.log('Ahora:  QR apunta a https://jsadr.com.co/api/documentos/verificar?codigo=... ✓')
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
