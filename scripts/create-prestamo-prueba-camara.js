#!/usr/bin/env node
/**
 * Crea UN préstamo de prueba para validar el flujo de firma electrónica.
 * El préstamo queda en estado PENDIENTE_ACEPTACION con una FirmaElectronica
 * + TokenFirma asociados, listo para abrir el link /firma/<token> y probar
 * los 4 pasos: Documento → Firma → OTP → Selfie.
 *
 * Uso: node scripts/create-prestamo-prueba-camara.js
 */
require('dotenv').config({ path: '.env', override: true })

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const fs = require('fs')

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('CREACIÓN DE PRÉSTAMO DE PRUEBA — "prueba camara"')
  console.log('='.repeat(70))

  // Buscar un cliente activo que tenga email y teléfono
  const cliente = await prisma.cliente.findFirst({
    where: { activo: true, email: { not: null } },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!cliente) {
    console.error('No se encontró ningún cliente activo con email.')
    process.exit(1)
  }

  console.log(`\nCliente seleccionado:`)
  console.log(`  Nombre:   ${cliente.nombre}`)
  console.log(`  CC:       ${cliente.cedula}`)
  console.log(`  Teléfono: ${cliente.telefono}`)
  console.log(`  Email:    ${cliente.email}`)

  // Configuración del préstamo
  const config = {
    monto: 1_000_000,
    plazo: 6,
    frecuencia: 'MENSUAL',
    cuotas: 6,
    tasa: 20,
  }

  // Código único con timestamp para evitar colisiones
  const codigo = `PRUEBA-CAMARA-${Date.now().toString().slice(-6)}`

  console.log(`\nCreando préstamo ${codigo}...`)
  console.log(`  Monto:      $${config.monto.toLocaleString('es-CO')}`)
  console.log(`  Cuotas:     ${config.cuotas} ${config.frecuencia.toLowerCase()}`)
  console.log(`  Tasa:       ${config.tasa}% anual`)
  console.log(`  Etiqueta:   "prueba camara"`)

  const tasaMensual = config.tasa / 12
  const totalInteres = config.monto * (config.tasa / 100) * (config.plazo / 12)
  const totalPagar = config.monto + totalInteres
  const montoCuota = totalPagar / config.cuotas
  const tasaMoraDiaria = (config.tasa / 100) / 30 * 1.5

  const prestamo = await prisma.prestamo.create({
    data: {
      codigo,
      clienteId: cliente.id,
      montoPrincipal: config.monto,
      tasaInteresAnual: config.tasa,
      tasaInteresMensual: tasaMensual,
      tasaMoraDiaria,
      plazoMeses: config.plazo,
      frecuencia: config.frecuencia,
      numeroCuotas: config.cuotas,
      montoCuota,
      totalInteres,
      totalPagar,
      tasaAplicada: config.tasa,
      saldoCapital: config.monto,
      saldoInteres: totalInteres,
      saldoTotal: totalPagar,
      estado: 'PENDIENTE_ACEPTACION',
      tycEnviado: true,
      tycAceptado: false,
      fechaSolicitud: new Date(),
      fechaAprobacion: new Date(),
      // Guardar la etiqueta "prueba camara" en notas
      notas: 'prueba camara — préstamo creado para validar el flujo de firma electrónica (cámara manual v6)',
    },
  })

  console.log(`\n✓ Préstamo creado (ID: ${prestamo.id})`)

  // Crear FirmaElectronica
  const firma = await prisma.firmaElectronica.create({
    data: {
      prestamoId: prestamo.id,
      clienteId: cliente.id,
      tipo: 'PAGARE',
      imagenFirma: '',
      otpCanal: 'AMBOS',
      estadoFirma: 'PENDIENTE',
      esFirmaCodeudor: false,
      firmanteRol: 'DEUDOR',
      firmanteNombre: cliente.nombre,
      firmanteCedula: cliente.cedula,
    },
  })

  console.log(`✓ FirmaElectronica creada (ID: ${firma.id})`)

  // Crear TokenFirma
  const tokenCreado = crypto.randomBytes(32).toString('hex')
  const fechaExp = new Date()
  fechaExp.setDate(fechaExp.getDate() + 7)

  const tokenFirma = await prisma.tokenFirma.create({
    data: {
      token: tokenCreado,
      firmaId: firma.id,
      prestamoId: prestamo.id,
      clienteId: cliente.id,
      fechaExpiracion: fechaExp,
    },
  })

  console.log(`✓ TokenFirma creado`)

  const linkFirma = `https://jsadr.com.co/firma/${tokenFirma.token}`

  console.log('\n' + '='.repeat(70))
  console.log('RESUMEN — PRÉSTAMO "PRUEBA CAMARA" LISTO')
  console.log('='.repeat(70))
  console.log(`\n  Código:       ${codigo}`)
  console.log(`  Cliente:      ${cliente.nombre} (CC: ${cliente.cedula})`)
  console.log(`  Teléfono:     ${cliente.telefono}`)
  console.log(`  Email:        ${cliente.email}`)
  console.log(`  Monto:        $${config.monto.toLocaleString('es-CO')}`)
  console.log(`  Cuotas:       ${config.cuotas} ${config.frecuencia.toLowerCase()}`)
  console.log(`  Tasa:         ${config.tasa}% anual`)
  console.log(`  Estado:       ${prestamo.estado}`)
  console.log(`  Firma ID:     ${firma.id}`)
  console.log(`  Vence:        ${fechaExp.toISOString()}`)
  console.log(`\n  🔗 LINK DE FIRMA:`)
  console.log(`  ${linkFirma}`)

  console.log('\n' + '='.repeat(70))
  console.log('PARA PROBAR EL FLUJO:')
  console.log('  1. Abre el link de firma en el navegador (preferiblemente móvil)')
  console.log('  2. Paso 1: Tomar foto del documento → guardar')
  console.log('     (Verifica: botón CAPTURAR siempre disponible, feedback "Capturando…")')
  console.log('  3. Paso 2: Dibujar firma manuscrita → guardar')
  console.log('  4. Paso 3: Solicitar OTP (AMBOS/WHATSAPP/EMAIL) → validar')
  console.log('  5. Paso 4: Tomar selfie con cédula → finalizar')
  console.log('     (Verifica: cámara frontal, espejado, botón siempre disponible)')
  console.log('  6. Verificar que el préstamo quedó ACTIVO')
  console.log('='.repeat(70))

  // Guardar en archivo para referencia
  const outputDir = '/home/z/my-project/download'
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = `${outputDir}/prestamo-prueba-camara.json`
  fs.writeFileSync(
    outputPath,
    JSON.stringify({
      etiqueta: 'prueba camara',
      codigo,
      cliente: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      email: cliente.email,
      monto: config.monto,
      cuotas: config.cuotas,
      frecuencia: config.frecuencia,
      tasa: config.tasa,
      estado: prestamo.estado,
      linkFirma,
      firmaId: firma.id,
      tokenFirma: tokenFirma.token,
      fechaExpiracion: fechaExp.toISOString(),
      createdAt: new Date().toISOString(),
    }, null, 2)
  )
  console.log(`\nDatos guardados en: ${outputPath}`)
}

main()
  .catch(err => {
    console.error('ERROR:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
