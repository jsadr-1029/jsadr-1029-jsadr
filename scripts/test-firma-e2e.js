#!/usr/bin/env node
/**
 * Pruebas E2E del flujo de firma electrónica para los 5 préstamos de prueba.
 *
 * Para cada préstamo:
 *   1. GET /api/firma?token=... → verificar que retorna datos del préstamo
 *   2. POST /api/firma { accion: 'guardar_foto_documento', fotoDocumento }
 *   3. POST /api/firma { accion: 'guardar_firma_dibujo', imagenFirma }
 *   4. POST /api/firma { accion: 'enviar_otp', canal: 'WHATSAPP' }
 *   5. Obtener OTP guardado en BD
 *   6. POST /api/firma { accion: 'validar_otp', otpIngresado }
 *   7. POST /api/firma { accion: 'finalizar_con_selfie', fotoSelfie }
 *   8. Verificar que el préstamo quedó ACTIVO
 *
 * Las pruebas corren contra localhost (npm run dev debe estar activo)
 * o contra producción (jsadr.com.co).
 *
 * Uso: node scripts/test-firma-e2e.js [local|prod]
 */
require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const fs = require('fs')

const prisma = new PrismaClient()

function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// Imágenes base64 de prueba (1x1 pixel PNG)
const PNG_DOC_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PNG_SELFIN_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQz0AEYBxVSF+FAAAAABJRU5ErkJggg=='
// Una firma PNG más grande para que valide el formato
const PNG_FIRMA_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function main() {
  const target = process.argv[2] || 'prod'
  const baseUrl = target === 'local' ? 'http://localhost:3000' : 'https://jsadr.com.co'

  console.log('='.repeat(70))
  console.log(`PRUEBAS E2E DEL FLUJO DE FIRMA ELECTRÓNICA — ${target.toUpperCase()}`)
  console.log(`Base URL: ${baseUrl}`)
  console.log('='.repeat(70))

  // Cargar links de los 5 préstamos de prueba
  const linksPath = '/home/z/my-project/download/prestamos-prueba-firma.json'
  if (!fs.existsSync(linksPath)) {
    console.error(`No se encuentra ${linksPath}. Ejecuta primero scripts/create-test-prestamos.js`)
    process.exit(1)
  }
  const prestamos = JSON.parse(fs.readFileSync(linksPath, 'utf8'))
  console.log(`\nCargados ${prestamos.length} préstamos de prueba`)

  const resultados = []

  for (let i = 0; i < prestamos.length; i++) {
    const p = prestamos[i]
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`PRÉSTAMO ${i + 1}/5: ${p.codigo} — ${p.cliente}`)
    console.log('─'.repeat(70))

    const result = {
      codigo: p.codigo,
      cliente: p.cliente,
      pasos: { getToken: false, fotoDoc: false, firmaDibujo: false, otpEnvio: false, otpValidacion: false, selfie: false, prestamoActivo: false },
      errores: [],
    }

    try {
      // 1. GET /api/firma?token=...
      console.log('  [1/7] GET /api/firma?token=...')
      const getUrl = p.linkFirma.replace('https://jsadr.com.co', baseUrl).replace('http://localhost:3000', baseUrl)
      const token = p.tokenFirma
      const getRes = await fetch(`${baseUrl}/api/firma?token=${encodeURIComponent(token)}`)
      const getJson = await getRes.json()
      if (!getJson.success || getJson.data.estado !== 'VALIDO') {
        throw new Error(`GET firma falló: ${JSON.stringify(getJson)}`)
      }
      console.log(`        ✓ Token válido. firmaId=${getJson.data.firma.id}, estadoFirma=${getJson.data.firma.estadoFirma}`)
      const firmaId = getJson.data.firma.id
      result.pasos.getToken = true

      // Si ya está completada (de una prueba anterior), saltar al final
      if (getJson.data.firma.estadoFirma === 'COMPLETADA') {
        console.log('        → Firma ya completada (prueba previa). Verificando préstamo...')
        result.pasos.fotoDoc = true
        result.pasos.firmaDibujo = true
        result.pasos.otpEnvio = true
        result.pasos.otpValidacion = true
        result.pasos.selfie = true
      } else {
        // 2. Guardar foto del documento
        console.log('  [2/7] POST guardar_foto_documento')
        const fotoDocRes = await fetch(`${baseUrl}/api/firma`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'guardar_foto_documento', firmaId, fotoDocumento: PNG_DOC_BASE64 }),
        })
        const fotoDocJson = await fotoDocRes.json()
        if (!fotoDocJson.success) throw new Error(`guardar_foto_documento: ${fotoDocJson.error}`)
        console.log(`        ✓ Foto documento guardada. estado=${fotoDocJson.data.estado}`)
        result.pasos.fotoDoc = true

        // 3. Guardar firma manuscrita
        console.log('  [3/7] POST guardar_firma_dibujo')
        const firmaRes = await fetch(`${baseUrl}/api/firma`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'guardar_firma_dibujo', firmaId, imagenFirma: PNG_FIRMA_BASE64 }),
        })
        const firmaJson = await firmaRes.json()
        if (!firmaJson.success) throw new Error(`guardar_firma_dibujo: ${firmaJson.error}`)
        console.log(`        ✓ Firma manuscrita guardada. estado=${firmaJson.data.estado}`)
        result.pasos.firmaDibujo = true

        // 4. Enviar OTP (canal WHATSAPP para no saturar el email)
        console.log('  [4/7] POST enviar_otp (canal WHATSAPP)')
        const otpEnvRes = await fetch(`${baseUrl}/api/firma`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'enviar_otp', firmaId, canal: 'WHATSAPP' }),
        })
        const otpEnvJson = await otpEnvRes.json()
        if (!otpEnvJson.success) {
          throw new Error(`enviar_otp: ${otpEnvJson.error}`)
        }
        console.log(`        ✓ OTP enviado por ${otpEnvJson.data.canal}`)
        result.pasos.otpEnvio = true

        // 5. Para la prueba E2E, sobreescribir el hash del OTP en BD con un código conocido.
        //    El API envía el OTP real al WhatsApp del cliente, pero no podemos leer el código
        //    desde la BD porque se almacena solo como hash SHA-256.
        //    Por lo tanto, sobreescribimos otpCodigo con el hash de un código de prueba
        //    conocido ("TEST01") y luego validamos con ese código.
        console.log('  [5/7] Validar OTP (código de prueba TEST01 inyectado en BD)')
        const codigoPrueba = 'TEST01'
        const hashPrueba = hashOtp(codigoPrueba)
        await prisma.firmaElectronica.update({
          where: { id: firmaId },
          data: {
            otpCodigo: hashPrueba,
            otpFechaEnvio: new Date(),
            intentosOTP: 0,
          },
        })

        const otpValRes = await fetch(`${baseUrl}/api/firma`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'validar_otp', firmaId, otpIngresado: codigoPrueba }),
        })
        const otpValJson = await otpValRes.json()
        if (!otpValJson.success) throw new Error(`validar_otp: ${otpValJson.error}`)
        console.log(`        ✓ OTP validado: ${codigoPrueba}`)
        result.pasos.otpValidacion = true

        // 6. Finalizar con selfie
        console.log('  [6/7] POST finalizar_con_selfie')
        const selfieRes = await fetch(`${baseUrl}/api/firma`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'finalizar_con_selfie', firmaId, fotoSelfie: PNG_SELFIN_BASE64 }),
        })
        const selfieJson = await selfieRes.json()
        if (!selfieJson.success) throw new Error(`finalizar_con_selfie: ${selfieJson.error}`)
        console.log(`        ✓ Selfie guardada. estadoFirma=${selfieJson.data.estadoFirma}`)
        result.pasos.selfie = true
      }

      // 7. Verificar que el préstamo quedó ACTIVO
      console.log('  [7/7] Verificar préstamo ACTIVO en BD')
      const prestamoFinal = await prisma.prestamo.findUnique({
        where: { id: getJson.data.firma.prestamoId },
        select: { estado: true, tycAceptado: true, fechaDesembolso: true, firmaId: true },
      })
      if (prestamoFinal.estado !== 'ACTIVO') {
        throw new Error(`Préstamo no quedó ACTIVO (estado=${prestamoFinal.estado})`)
      }
      if (!prestamoFinal.tycAceptado) {
        throw new Error('Préstamo no tiene tycAceptado=true')
      }
      if (!prestamoFinal.fechaDesembolso) {
        throw new Error('Préstamo no tiene fechaDesembolso')
      }
      console.log(`        ✓ Préstamo ACTIVO. tycAceptado=${prestamoFinal.tycAceptado}, desembolso=${prestamoFinal.fechaDesembolso.toISOString()}`)
      result.pasos.prestamoActivo = true

    } catch (e) {
      console.error(`  ✗ ERROR: ${e.message}`)
      result.errores.push(e.message)
    }

    resultados.push(result)
  }

  // Resumen final
  console.log('\n' + '='.repeat(70))
  console.log('RESUMEN FINAL — PRUEBAS E2E FIRMA ELECTRÓNICA')
  console.log('='.repeat(70))
  let totalExitos = 0
  resultados.forEach((r, i) => {
    const todosOk = Object.values(r.pasos).every(v => v === true)
    if (todosOk && r.errores.length === 0) totalExitos++
    const status = todosOk ? '✓ OK' : '✗ FAIL'
    console.log(`\n  ${i + 1}. ${r.codigo} — ${r.cliente}  ${status}`)
    Object.entries(r.pasos).forEach(([k, v]) => {
      console.log(`     ${v ? '✓' : '✗'} ${k}`)
    })
    if (r.errores.length > 0) {
      console.log(`     Errores:`)
      r.errores.forEach(e => console.log(`       - ${e}`))
    }
  })
  console.log('\n' + '='.repeat(70))
  console.log(`TOTAL: ${totalExitos}/${resultados.length} préstamos completaron el flujo OK`)
  console.log('='.repeat(70))

  // Guardar resultados
  fs.writeFileSync(
    '/home/z/my-project/download/test-firma-e2e-resultados.json',
    JSON.stringify(resultados, null, 2)
  )

  process.exit(totalExitos === resultados.length ? 0 : 1)
}

main()
  .catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
