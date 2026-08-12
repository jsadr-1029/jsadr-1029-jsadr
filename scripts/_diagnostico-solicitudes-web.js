#!/usr/bin/env node
/**
 * Diagnóstico: lista todas las solicitudes web del cliente
 */
require('dotenv').config({ path: '.env', override: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const cliente = await prisma.cliente.findFirst({ where: { cedula: '71365715' } })
  if (!cliente) { console.log('Cliente no encontrado'); return }

  const solicitudes = await prisma.solicitudWeb.findMany({
    where: { clienteCedula: cliente.cedula },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      estado: true,
      estadoFlujoFirma: true,
      prestamoCreadoId: true,
      valorSolicitado: true,
      createdAt: true,
    },
  })

  console.log(`Solicitudes web del cliente ${cliente.nombre}: ${solicitudes.length}\n`)
  for (const s of solicitudes) {
    console.log(`Solicitud ${s.id}`)
    console.log(`  estado:             ${s.estado}`)
    console.log(`  estadoFlujoFirma:   ${s.estadoFlujoFirma || '(null)'}`)
    console.log(`  prestamoCreadoId:   ${s.prestamoCreadoId || '(null)'}`)
    console.log(`  valorSolicitado:    ${s.valorSolicitado}`)
    console.log(`  createdAt:          ${s.createdAt}`)
    console.log()
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
