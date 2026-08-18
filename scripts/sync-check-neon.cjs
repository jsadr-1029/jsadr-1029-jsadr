const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
})

async function main() {
  console.log('═══ NEON SYNC CHECK ═══')
  // 1. Categorías de cliente (deben tener los 4 tope actualizados)
  const cats = await prisma.categoriaCliente.findMany({ orderBy: { id: 'asc' } })
  console.log(`\n📋 Categorías (${cats.length}):`)
  for (const c of cats) {
    const max = c.montoMaximo && c.montoMaximo > 0 ? `$${c.montoMaximo.toLocaleString('es-CO')}` : 'Sin límite'
    console.log(`  - ${c.nombre}: min=$${c.montoMinimo.toLocaleString('es-CO')} max=${max} tasa=${c.tasaAnual}% mora=${c.tasaMora}%`)
  }
  // 2. Conexiones críticas
  const conexiones = await prisma.conexionAPI.findMany({ select: { tipo: true, activa: true, nombre: true, url: true, usuario: true } })
  console.log(`\n🔌 Conexiones (${conexiones.length}):`)
  for (const c of conexiones) {
    console.log(`  - [${c.activa ? '✓' : '✗'}] ${c.tipo} | ${c.nombre} | ${c.url || ''} | user=${c.usuario || 'N/A'}`)
  }
  // 3. Cliente Johan (prueba)
  const johan = await prisma.cliente.findFirst({ where: { cedula: '1214731649' }, select: { id: true, nombre: true, esPrueba: true, createdAt: true } })
  console.log(`\n👤 Cliente prueba: ${johan ? `✓ ${johan.nombre} (esPrueba=${johan.esPrueba})` : '✗ no encontrado'}`)
  // 4. Total clientes (excluyendo prueba)
  const totalClientes = await prisma.cliente.count({ where: { esPrueba: false } })
  console.log(`👥 Total clientes (no-prueba): ${totalClientes}`)
  // 5. Solicitudes web pendientes
  const solicitudes = await prisma.solicitudWeb.groupBy({
    by: ['estado'],
    _count: true,
  })
  console.log(`\n📨 Solicitudes web:`)
  for (const s of solicitudes) {
    console.log(`  - ${s.estado}: ${s._count}`)
  }
  console.log('\n═══ FIN NEON CHECK ═══')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
