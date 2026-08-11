#!/usr/bin/env node
/**
 * Crea 5 préstamos de prueba en estado PENDIENTE_ACEPTACION.
 * Cada préstamo se asigna a un cliente distinto (de los 16 importados).
 * Después de creado cada préstamo, genera un FirmaElectronica + TokenFirma
 * para poder probar el flujo completo de firma electrónica.
 *
 * Uso: node scripts/create-test-prestamos.js
 */
require('dotenv').config({ path: '.env', override: true })

// Forzar DATABASE_URL si el shell la sobreescribe
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

const PRESTAMOS_TEST = [
  { monto: 1_000_000, plazo: 6,  frecuencia: 'MENSUAL',   cuotas: 6,  tasa: 20 },
  { monto: 2_000_000, plazo: 12, frecuencia: 'MENSUAL',   cuotas: 12, tasa: 20 },
  { monto:   500_000, plazo: 4,  frecuencia: 'QUINCENAL', cuotas: 8,  tasa: 20 },
  { monto: 3_500_000, plazo: 18, frecuencia: 'MENSUAL',   cuotas: 18, tasa: 20 },
  { monto:   800_000, plazo: 3,  frecuencia: 'SEMANAL',   cuotas: 12, tasa: 20 },
]

async function main() {
  console.log('='.repeat(70))
  console.log('CREACIÓN DE 5 PRÉSTAMOS DE PRUEBA — PENDIENTE_ACEPTACION')
  console.log('='.repeat(70))

  // Obtener clientes (sin importar si ya tienen préstamos, para que la prueba sea realista)
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  if (clientes.length < 5) {
    console.error(`Solo hay ${clientes.length} clientes activos. Se necesitan al menos 5.`)
    process.exit(1)
  }

  console.log(`\nClientes seleccionados (${clientes.length}):`)
  clientes.forEach((c, i) => console.log(`  ${i + 1}. ${c.nombre} — CC: ${c.cedula} — Tel: ${c.telefono}`))

  const resultados = []

  for (let i = 0; i < PRESTAMOS_TEST.length; i++) {
    const config = PRESTAMOS_TEST[i]
    const cliente = clientes[i]
    const codigo = `TEST-FIRMA-${String(i + 1).padStart(3, '0')}`

    console.log(`\n[${i + 1}/5] Creando préstamo ${codigo} para ${cliente.nombre}...`)

    // Verificar si ya existe
    const existe = await prisma.prestamo.findUnique({ where: { codigo } })
    if (existe) {
      console.log(`  → Ya existe. Saltando creación (se reutilizará).`)
      // Si ya está ACTIVO, no se puede reutilizar para la prueba — crear con código nuevo
      if (existe.estado === 'ACTIVO') {
        const nuevoCodigo = `TEST-FIRMA-${String(i + 1).padStart(3, '0')}-${Date.now().toString().slice(-4)}`
        const nuevo = await crearPrestamo(nuevoCodigo, cliente, config)
        resultados.push(nuevo)
      } else {
        // Crear token de firma si no tiene uno activo
        const token = await crearTokenFirma(existe, cliente)
        resultados.push({ prestamo: existe, cliente, token, codigo: existe.codigo })
      }
      continue
    }

    const resultado = await crearPrestamo(codigo, cliente, config)
    resultados.push(resultado)
  }

  console.log('\n' + '='.repeat(70))
  console.log('RESUMEN — 5 PRÉSTAMOS LISTOS PARA PRUEBA DE FIRMA')
  console.log('='.repeat(70))
  resultados.forEach((r, i) => {
    console.log(`\n  Préstamo ${i + 1}: ${r.codigo}`)
    console.log(`    Cliente:    ${r.cliente.nombre} (CC: ${r.cliente.cedula})`)
    console.log(`    Teléfono:   ${r.cliente.telefono}`)
    console.log(`    Email:      ${r.cliente.email || '(sin email)'}`)
    console.log(`    Monto:      $${r.prestamo.montoPrincipal.toLocaleString('es-CO')}`)
    console.log(`    Cuotas:     ${r.prestamo.numeroCuotas} ${r.prestamo.frecuencia.toLowerCase()}`)
    console.log(`    Estado:     ${r.prestamo.estado}`)
    console.log(`    Link firma: ${r.token.linkFirma}`)
  })

  console.log('\n' + '='.repeat(70))
  console.log('Para probar cada flujo:')
  console.log('  1. Abre el link de firma en el navegador')
  console.log('  2. Paso 1: Foto documento → guardar');
  console.log('  3. Paso 2: Firma manuscrita → guardar');
  console.log('  4. Paso 3: Solicitar OTP (canal AMBOS/WHATSAPP/EMAIL) → validar');
  console.log('  5. Paso 4: Selfie con cédula → finalizar');
  console.log('  6. Verificar que el préstamo quedó ACTIVO');
  console.log('='.repeat(70))

  // Guardar links en archivo para referencia
  const fs = require('fs')
  const outputDir = '/home/z/my-project/download'
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(
    `${outputDir}/prestamos-prueba-firma.json`,
    JSON.stringify(resultados.map(r => ({
      codigo: r.codigo,
      cliente: r.cliente.nombre,
      cedula: r.cliente.cedula,
      telefono: r.cliente.telefono,
      email: r.cliente.email,
      monto: r.prestamo.montoPrincipal,
      cuotas: r.prestamo.numeroCuotas,
      frecuencia: r.prestamo.frecuencia,
      estado: r.prestamo.estado,
      linkFirma: r.token.linkFirma,
      firmaId: r.token.firmaId,
      tokenFirma: r.token.token,
    })), null, 2)
  )
  console.log(`\nLinks guardados en: /home/z/my-project/download/prestamos-prueba-firma.json`)
}

async function crearPrestamo(codigo, cliente, config) {
  const { monto, plazo, frecuencia, cuotas, tasa } = config
  const tasaMensual = tasa / 12
  const totalInteres = monto * (tasa / 100) * (plazo / 12)
  const totalPagar = monto + totalInteres
  const montoCuota = totalPagar / cuotas
  const tasaMoraDiaria = (tasa / 100) / 30 * 1.5 // 1.5x la tasa diaria

  const prestamo = await prisma.prestamo.create({
    data: {
      codigo,
      clienteId: cliente.id,
      montoPrincipal: monto,
      tasaInteresAnual: tasa,
      tasaInteresMensual: tasaMensual,
      tasaMoraDiaria,
      plazoMeses: plazo,
      frecuencia,
      numeroCuotas: cuotas,
      montoCuota,
      totalInteres,
      totalPagar,
      tasaAplicada: tasa,
      saldoCapital: monto,
      saldoInteres: totalInteres,
      saldoTotal: totalPagar,
      estado: 'PENDIENTE_ACEPTACION',
      tycEnviado: true,
      tycAceptado: false,
      fechaSolicitud: new Date(),
      fechaAprobacion: new Date(),
    },
  })
  console.log(`  ✓ Préstamo creado (ID: ${prestamo.id})`)
  console.log(`    Monto: $${monto.toLocaleString('es-CO')} | ${cuotas} cuotas ${frecuencia.toLowerCase()} | Tasa: ${tasa}% anual`)

  const token = await crearTokenFirma(prestamo, cliente)
  return { prestamo, cliente, token, codigo }
}

async function crearTokenFirma(prestamo, cliente) {
  // Verificar si ya existe una firma pendiente
  const firmaExistente = await prisma.firmaElectronica.findFirst({
    where: {
      prestamoId: prestamo.id,
      estadoFirma: { in: ['PENDIENTE', 'FOTOS_SUBIDAS', 'FIRMA_DIBUJADA', 'OTP_ENVIADO'] },
    },
    include: { tokens: { where: { usado: false } } },
  })

  if (firmaExistente && firmaExistente.tokens.length > 0) {
    const t = firmaExistente.tokens[0]
    console.log(`  ✓ Reutilizando firma existente (ID: ${firmaExistente.id})`)
    return {
      firmaId: firmaExistente.id,
      token: t.token,
      linkFirma: `https://jsadr.com.co/firma/${t.token}`,
    }
  }

  // Crear nueva firma
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

  console.log(`  ✓ Firma + token creados (firma ID: ${firma.id})`)

  return {
    firmaId: firma.id,
    token: tokenFirma.token,
    linkFirma: `https://jsadr.com.co/firma/${tokenFirma.token}`,
  }
}

main()
  .catch(err => {
    console.error('ERROR:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
