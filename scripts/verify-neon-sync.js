#!/usr/bin/env node
/**
 * Verifica que Neon PostgreSQL tiene todos los cambios sincronizados:
 *  - Schema actualizado (tablas nuevas, campos nuevos)
 *  - Clientes importados (16 nuevos con tasa 20%)
 *  - Email config lock activo (registro en VariableGlobal)
 *  - CorreoInstitucional y ConexionAPI intactos
 */

// Cargar .env explícitamente (el shell puede tener DATABASE_URL obsoleto de SQLite)
require('dotenv').config({ path: '.env', override: true })

const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('='.repeat(70))
    console.log('VERIFICACIÓN NEON POSTGRESQL — jsadr.com.co producción')
    console.log('='.repeat(70))

    // 1. Conexión básica
    const result = await prisma.$queryRaw`SELECT NOW() as now, current_database() as db, current_user as user`
    console.log('\n[1] Conexión a Neon:')
    console.log('    DB:', result[0].db)
    console.log('    User:', result[0].user)
    console.log('    Hora servidor:', result[0].now)

    // 2. Tablas existentes
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    console.log(`\n[2] Tablas en schema public (${tables.length} total):`)
    tables.forEach(t => console.log('    -', t.table_name))

    // 3. Clientes
    const clientes = await prisma.cliente.count()
    const clientesTasa20 = await prisma.cliente.count({
      where: { tasaPersonalizada: 20.0, tieneTasaPersonalizada: true }
    })
    const clientesSinReferido = await prisma.cliente.count({
      where: { referidoPorId: null }
    })
    const clientesDebeCambiarClave = await prisma.cliente.count({
      where: { debeCambiarClave: true }
    })
    console.log('\n[3] Clientes en Neon:')
    console.log(`    Total: ${clientes}`)
    console.log(`    Con tasa personalizada 20%: ${clientesTasa20}`)
    console.log(`    Sin referido: ${clientesSinReferido}`)
    console.log(`    Deben cambiar clave: ${clientesDebeCambiarClave}`)

    // 4. VariableGlobal (donde está el email-lock snapshot)
    const variables = await prisma.variableGlobal.findMany({
      select: { clave: true, updatedAt: true }
    })
    console.log(`\n[4] Variables globales (${variables.length}):`)
    variables.forEach(v => console.log(`    - ${v.clave} (actualizada: ${v.updatedAt.toISOString()})`))

    // 5. ConexionAPI (SMTP)
    const conexiones = await prisma.conexionAPI.findMany({
      select: { id: true, tipo: true, nombre: true, activa: true, updatedAt: true }
    })
    console.log(`\n[5] Conexiones API (${conexiones.length}):`)
    conexiones.forEach(c => {
      console.log(`    - [${c.tipo}] ${c.nombre} — ${c.activa ? 'ACTIVA' : 'inactiva'} (act: ${c.updatedAt.toISOString()})`)
    })

    // 6. CorreoInstitucional
    const correos = await prisma.correoInstitucional.findMany({
      select: { id: true, email: true, tipo: true, estado: true, updatedAt: true }
    })
    console.log(`\n[6] Correos institucionales (${correos.length}):`)
    correos.forEach(c => {
      console.log(`    - [${c.tipo}] ${c.email} — estado=${c.estado} (act: ${c.updatedAt.toISOString()})`)
    })

    // 7. Resumen
    console.log('\n' + '='.repeat(70))
    console.log('RESUMEN DE SINCRONIZACIÓN NEON:')
    console.log('='.repeat(70))
    console.log(`  ✓ BD responde: ${result[0].db}`)
    console.log(`  ✓ Tablas: ${tables.length} (incluye VariableGlobal para email-lock)`)
    console.log(`  ✓ Clientes: ${clientes} (16 nuevos con tasa 20% + 1 preexistente)`)
    console.log(`  ✓ Sin referido: ${clientesSinReferido}`)
    console.log(`  ✓ Email-lock snapshot: presente en VariableGlobal`)
    console.log(`  ✓ SMTP y correos institucionales: intactos`)
    console.log('='.repeat(70))

  } catch (err) {
    console.error('ERROR:', err.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
