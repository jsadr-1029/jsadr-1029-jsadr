// =====================================================
// scripts/marcar-cliente-prueba.cjs
// =====================================================
// Añade el campo `esPrueba` al modelo Cliente en la BD Neon
// (mediante ALTER TABLE) y marca al cliente 1214731649 como
// cliente de prueba. No depende de `prisma migrate` para no
// bloquear el entorno en caso de que el esquema de migraciones
// esté desincronizado.
// =====================================================

const { PrismaClient } = require('@prisma/client')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const CEDULA_PRUEBA = '1214731649'

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

  try {
    console.log('=== Verificando existencia del campo esPrueba en tabla Cliente ===')

    // Verificar si las columnas existen ya
    const columnasExistentes = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Cliente'
        AND column_name IN ('esPrueba', 'fechaMarcadoPrueba', 'marcadoPruebaPorId', 'motivoPrueba')
      ORDER BY column_name;
    `)
    const existentes = columnasExistentes.map((r) => r.column_name)
    console.log('Columnas ya presentes:', existentes)

    if (!existentes.includes('esPrueba')) {
      console.log('→ Añadiendo columna esPrueba Boolean NOT NULL DEFAULT false')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "esPrueba" BOOLEAN NOT NULL DEFAULT false;
      `)
      console.log('  ✓ Columna esPrueba añadida')
    }

    if (!existentes.includes('fechaMarcadoPrueba')) {
      console.log('→ Añadiendo columna fechaMarcadoPrueba TIMESTAMP NULL')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "fechaMarcadoPrueba" TIMESTAMP(3);
      `)
      console.log('  ✓ Columna fechaMarcadoPrueba añadida')
    }

    if (!existentes.includes('marcadoPruebaPorId')) {
      console.log('→ Añadiendo columna marcadoPruebaPorId VARCHAR NULL')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "marcadoPruebaPorId" TEXT;
      `)
      console.log('  ✓ Columna marcadoPruebaPorId añadida')
    }

    if (!existentes.includes('motivoPrueba')) {
      console.log('→ Añadiendo columna motivoPrueba VARCHAR NULL')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "motivoPrueba" TEXT;
      `)
      console.log('  ✓ Columna motivoPrueba añadida')
    }

    // === Marcar al cliente 1214731649 como esPrueba=true ===
    console.log(`\n=== Marcando cliente ${CEDULA_PRUEBA} como esPrueba=true ===`)
    const cliente = await prisma.cliente.findFirst({
      where: { cedula: CEDULA_PRUEBA },
      select: { id: true, nombre: true, cedula: true, esPrueba: true },
    })

    if (!cliente) {
      console.log(`  ✗ No se encontró cliente con cédula ${CEDULA_PRUEBA}`)
      return
    }

    console.log(`  Cliente encontrado: ${cliente.nombre} (ID: ${cliente.id})`)
    console.log(`  esPrueba actual: ${cliente.esPrueba}`)

    if (cliente.esPrueba) {
      console.log('  ✓ El cliente ya está marcado como prueba. Nada que hacer.')
    } else {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: {
          esPrueba: true,
          fechaMarcadoPrueba: new Date(),
          motivoPrueba:
            'Cliente canónico de QA. Excluido automáticamente de saldos reales del sistema (dashboard, reportes, cartera, balance, morosidad, mensual-informe).',
        },
      })
      console.log('  ✓ Cliente marcado como esPrueba=true')
    }

    // === Confirmación final ===
    console.log('\n=== Verificación final ===')
    const prestamosCliente = await prisma.prestamo.findMany({
      where: { clienteId: cliente.id },
      select: { id: true, codigo: true, estado: true, saldoTotal: true },
    })
    console.log(`Préstamos del cliente de prueba: ${prestamosCliente.length}`)
    let saldoTotalPrueba = 0
    for (const p of prestamosCliente) {
      if (p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'JURIDICO') {
        saldoTotalPrueba += Number(p.saldoTotal)
      }
    }
    console.log(`Saldo total que será excluido de saldos reales: $${saldoTotalPrueba.toLocaleString('es-CO')}`)

    console.log('\n=== Resumen de clientes marcados como prueba ===')
    const todosPrueba = await prisma.cliente.findMany({
      where: { esPrueba: true },
      select: { id: true, nombre: true, cedula: true, esPrueba: true, fechaMarcadoPrueba: true },
    })
    if (todosPrueba.length === 0) {
      console.log('  (ningún cliente marcado)')
    } else {
      for (const c of todosPrueba) {
        console.log(`  - ${c.cedula} | ${c.nombre} | desde ${c.fechaMarcadoPrueba?.toISOString() || '—'}`)
      }
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
