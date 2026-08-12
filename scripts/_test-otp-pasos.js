#!/usr/bin/env node
/**
 * Prueba focalizada del paso OTP en el flujo de firma pública.
 * Verifica que el endpoint /api/firma con accion=enviar_otp NO valida
 * el estado del préstamo (a diferencia de /api/prestamos/[id]/aceptar-tyc-otp).
 *
 * Préstawo de prueba: PRUEBA-FLUJO-205631
 */
require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const fs = require('fs')

const BASE = 'https://jsadr.com.co'
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Origin': BASE,
  'Referer': BASE + '/',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

// 1x1 PNGs para las fotos
const PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function main() {
  console.log('=== PRUEBA DEL PASO OTP EN FLUJO DE FIRMA PÚBLICA ===\n')

  // Cargar datos del préstamo
  const data = JSON.parse(fs.readFileSync('/home/z/my-project/download/prestamo-prueba-flujo.json', 'utf8'))
  console.log(`Préstamo: ${data.codigo}`)
  console.log(`Token:    ${data.tokenFirma.slice(0, 16)}...`)
  console.log(`Estado:   ${data.estado}`)
  console.log()

  // 1. GET /api/firma?token=...
  console.log('[1/4] GET /api/firma?token=...')
  const getRes = await fetch(`${BASE}/api/firma?token=${encodeURIComponent(data.tokenFirma)}`)
  const getJson = await getRes.json()
  if (!getJson.success) {
    console.error('  ✗ Error:', getJson.error)
    return
  }
  console.log(`  ✓ estado=${getJson.data.estado}, estadoFirma=${getJson.data.firma.estadoFirma}`)
  const firmaId = getJson.data.firma.id
  console.log(`  ✓ firmaId=${firmaId}`)

  // 2. Guardar foto documento (frente + reverso)
  console.log('\n[2/4] POST /api/firma { accion: guardar_foto_documento }')
  const fotoRes = await fetch(`${BASE}/api/firma`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      accion: 'guardar_foto_documento',
      firmaId,
      fotoDocumento: PNG_BASE64,
      fotoDocumentoReverso: PNG_BASE64,
    }),
  })
  const fotoJson = await fotoRes.json()
  if (!fotoJson.success) {
    console.error('  ✗ Error:', fotoJson.error)
    return
  }
  console.log(`  ✓ estado=${fotoJson.data.estado}`)

  // 3. Guardar firma manuscrita
  console.log('\n[3/4] POST /api/firma { accion: guardar_firma_dibujo }')
  const firmaRes = await fetch(`${BASE}/api/firma`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      accion: 'guardar_firma_dibujo',
      firmaId,
      imagenFirma: PNG_BASE64,
    }),
  })
  const firmaJson = await firmaRes.json()
  if (!firmaJson.success) {
    console.error('  ✗ Error:', firmaJson.error)
    return
  }
  console.log(`  ✓ estado=${firmaJson.data.estado}`)

  // 4. Enviar OTP
  console.log('\n[4/4] POST /api/firma { accion: enviar_otp, canal: EMAIL }')
  console.log('  (Este es el paso que el usuario reporta como fallido)')
  const otpRes = await fetch(`${BASE}/api/firma`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      accion: 'enviar_otp',
      firmaId,
      canal: 'EMAIL',
    }),
  })
  const otpJson = await otpRes.json()
  if (!otpJson.success) {
    console.error('  ✗ Error:', otpJson.error)
    console.error('  Status:', otpRes.status)
    return
  }
  console.log(`  ✓ OTP enviado por ${otpJson.data.canal}`)
  console.log(`  ✓ emailDestino: ${otpJson.data.emailDestino}`)
  console.log(`  ✓ expiraEn: ${otpJson.data.expiraEn}`)

  console.log('\n=== RESULTADO: El flujo público /api/firma funciona correctamente ===')
  console.log('=== El error "El préstamo no está pendiente de aceptación" NO aparece en este flujo ===')
  console.log('=== Ese error solo aparece en /api/prestamos/[id]/aceptar-tyc-otp (flujo portal) ===')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
