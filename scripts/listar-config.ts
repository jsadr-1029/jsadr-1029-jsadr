// Listar cuentas de recaudo, categorías, y configuración para saber qué asignar a Johan
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== CUENTAS DE RECAUDO ===')
  const cuentas = await prisma.cuentaRecaudo.findMany({ take: 10 })
  for (const c of cuentas) {
    console.log(`  ${c.id} | ${c.banco} | ${c.numeroCuenta} | ${c.tipoCuenta} | titular=${c.titular} | qr=${c.qrImagen ? 'SÍ' : 'NO'}`)
  }

  console.log('\n=== CATEGORÍAS CLIENTE ===')
  const cats = await (prisma as any).categoriaCliente.findMany({ take: 10 })
  for (const c of cats) {
    console.log(`  ${c.id} | ${c.nombre} | tasa=${c.tasaInteresMensual ?? 'N/A'}%`)
  }

  console.log('\n=== CONFIGURACIÓN ===')
  const config = await (prisma as any).configuracion.findFirst()
  if (config) {
    console.log(`  flexibilidadCostoBasica: ${config.flexibilidadCostoBasica ?? 'N/A'}`)
    console.log(`  flexibilidadCostoPremium: ${config.flexibilidadCostoPremium ?? 'N/A'}`)
    console.log(`  costoPagareCarta: ${config.costoPagareCarta ?? 'N/A'}`)
  } else {
    console.log('  (sin configuración global)')
  }

  console.log('\n=== CLIENTE JOHAN ALVAREZ - detalle completo ===')
  const cliente = await prisma.cliente.findFirst({
    where: { cedula: '1214731649' },
    include: { categoria: true, cuentaRecaudo: true },
  })
  if (cliente) {
    console.log('  Cliente:', JSON.stringify({
      id: cliente.id,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      pin: cliente.pin,
      clavePortal: cliente.clavePortal,
      primerLogin: cliente.primerLogin,
      estado: (cliente as any).estado,
      categoriaId: cliente.categoriaId,
      cuentaRecaudoId: cliente.cuentaRecaudoId,
      categoriaNombre: cliente.categoria?.nombre,
      cuentaRecaudoBanco: cliente.cuentaRecaudo?.banco,
    }, null, 2))
  }

  // Verificar si existe el modelo ClienteCampoAdicional
  console.log('\n=== CAMPOS DE CLIENTE (todas las columnas) ===')
  const anyCliente = await prisma.cliente.findFirst({ where: { cedula: '1214731649' } })
  if (anyCliente) {
    console.log('  Campos:', Object.keys(anyCliente).join(', '))
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
