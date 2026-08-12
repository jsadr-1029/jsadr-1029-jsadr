#!/usr/bin/env node
/**
 * Diagnóstico: revisa el estado actual del préstamo PRUEBA-FLUJO-205631
 * y de su FirmaElectronica + TokenFirma asociados.
 *
 * Uso: node scripts/_diagnóstico-prueba-flujo.js
 */
require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== DIAGNÓSTICO PRÉSTAMO PRUEBA-FLUJO-205631 ===\n')

  const prestamo = await prisma.prestamo.findFirst({
    where: { codigo: { startsWith: 'PRUEBA-FLUJO-' } },
    orderBy: { createdAt: 'desc' },
    include: {
      cliente: true,
      firmas: {
        include: { tokens: true },
      },
    },
  })

  if (!prestamo) {
    console.log('No se encontró préstamo PRUEBA-FLUJO-*')
    return
  }

  console.log('--- PRÉSTAMO ---')
  console.log('  código:        ', prestamo.codigo)
  console.log('  id:            ', prestamo.id)
  console.log('  estado:        ', prestamo.estado)
  console.log('  tycEnviado:    ', prestamo.tycEnviado)
  console.log('  tycAceptado:   ', prestamo.tycAceptado)
  console.log('  fechaSolicitud:', prestamo.fechaSolicitud)
  console.log('  notas:         ', prestamo.notas)

  console.log('\n--- CLIENTE ---')
  console.log('  nombre:  ', prestamo.cliente?.nombre)
  console.log('  cedula:  ', prestamo.cliente?.cedula)
  console.log('  telefono:', prestamo.cliente?.telefono)
  console.log('  email:   ', prestamo.cliente?.email)

  console.log('\n--- FIRMAS ELECTRÓNICAS ---')
  if (!prestamo.firmas || prestamo.firmas.length === 0) {
    console.log('  (sin firmas)')
  } else {
    for (const f of prestamo.firmas) {
      console.log('\n  Firma ID:', f.id)
      console.log('    tipo:           ', f.tipo)
      console.log('    estadoFirma:    ', f.estadoFirma)
      console.log('    otpEnviado:     ', f.otpEnviado)
      console.log('    otpValidado:    ', f.otpValidado)
      console.log('    otpCanal:       ', f.otpCanal)
      console.log('    otpFechaEnvio:  ', f.otpFechaEnvio)
      console.log('    intentosOTP:    ', f.intentosOTP)
      console.log('    maxIntentos:    ', f.maxIntentos)
      console.log('    esFirmaCodeudor:', f.esFirmaCodeudor)
      console.log('    firmanteRol:    ', f.firmanteRol)
      console.log('    createdAt:      ', f.createdAt)
      console.log('    tokens:')
      if (!f.tokens || f.tokens.length === 0) {
        console.log('      (sin tokens)')
      } else {
        for (const t of f.tokens) {
          console.log('      token:          ', t.token.slice(0, 16) + '...')
          console.log('      usado:          ', t.usado)
          console.log('      fechaExpiracion:', t.fechaExpiracion)
          console.log('      ---')
        }
      }
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
