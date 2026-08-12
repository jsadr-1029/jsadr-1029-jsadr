#!/usr/bin/env node
/**
 * Diagnóstico: lista todos los préstamos del cliente JUAN CAMILO GONZALEZ OCAMPO
 * y sus firmas, para entender qué pudo quedar en un estado raro.
 *
 * Uso: node scripts/_diagnostico-todos-prestamos.js
 */
require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== TODOS LOS PRÉSTAMOS DEL CLIENTE ===\n')

  const cliente = await prisma.cliente.findFirst({
    where: { cedula: '71365715' },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
  })

  if (!cliente) {
    console.log('Cliente no encontrado')
    return
  }

  console.log('Cliente:', cliente.nombre, '(CC:', cliente.cedula + ')')
  console.log('ID:', cliente.id)
  console.log()

  const prestamos = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      codigo: true,
      estado: true,
      tycEnviado: true,
      tycAceptado: true,
      fechaSolicitud: true,
      createdAt: true,
      notas: true,
      _count: { select: { firmas: true } },
    },
  })

  console.log(`Total préstamos: ${prestamos.length}\n`)
  console.log('—'.repeat(100))

  for (const p of prestamos) {
    console.log(`\nCódigo:    ${p.codigo}`)
    console.log(`  estado:        ${p.estado}`)
    console.log(`  tycEnviado:    ${p.tycEnviado}`)
    console.log(`  tycAceptado:   ${p.tycAceptado}`)
    console.log(`  createdAt:     ${p.createdAt}`)
    console.log(`  #firmas:       ${p._count.firmas}`)
    console.log(`  notas:         ${(p.notas || '').slice(0, 80)}`)
  }

  console.log('\n\n=== FIRMAS DETALLADAS ===\n')

  const firmas = await prisma.firmaElectronica.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tipo: true,
      estadoFirma: true,
      otpEnviado: true,
      otpValidado: true,
      otpCanal: true,
      otpFechaEnvio: true,
      otpFechaValidacion: true,
      intentosOTP: true,
      maxIntentos: true,
      imagenFirma: true,
      fotoDocumento: true,
      fotoSelfie: true,
      createdAt: true,
      prestamo: { select: { codigo: true, estado: true } },
      tokens: { select: { token: true, usado: true, fechaExpiracion: true } },
    },
    take: 10,
  })

  console.log(`Total firmas (últimas 10): ${firmas.length}\n`)
  console.log('—'.repeat(100))

  for (const f of firmas) {
    console.log(`\nFirma ID: ${f.id}`)
    console.log(`  préstamo:        ${f.prestamo?.codigo} (estado: ${f.prestamo?.estado})`)
    console.log(`  tipo:            ${f.tipo}`)
    console.log(`  estadoFirma:     ${f.estadoFirma}`)
    console.log(`  otpEnviado:      ${f.otpEnviado}`)
    console.log(`  otpValidado:     ${f.otpValidado}`)
    console.log(`  otpCanal:        ${f.otpCanal}`)
    console.log(`  otpFechaEnvio:   ${f.otpFechaEnvio}`)
    console.log(`  otpFechaValidac: ${f.otpFechaValidacion}`)
    console.log(`  intentosOTP:     ${f.intentosOTP}/${f.maxIntentos}`)
    console.log(`  tieneImagenFirma: ${!!f.imagenFirma}`)
    console.log(`  tieneFotoDoc:    ${!!f.fotoDocumento}`)
    console.log(`  tieneFotoSelfie: ${!!f.fotoSelfie}`)
    console.log(`  createdAt:       ${f.createdAt}`)
    console.log(`  tokens:`)
    if (f.tokens.length === 0) {
      console.log(`    (sin tokens)`)
    } else {
      for (const t of f.tokens) {
        console.log(`    - token: ${t.token.slice(0, 16)}... | usado: ${t.usado} | exp: ${t.fechaExpiracion}`)
      }
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
