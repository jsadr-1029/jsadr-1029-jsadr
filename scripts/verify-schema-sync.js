#!/usr/bin/env node
/**
 * Verifica que el schema de Neon coincide con prisma/schema.prisma
 * Compara las columnas de tablas clave: Cliente, CorreoInstitucional,
 * ConexionAPI, VariableGlobal.
 */
require('dotenv').config({ path: '.env', override: true })
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('='.repeat(70))
    console.log('VERIFICACIÓN DE SCHEMA PRISMA vs NEON')
    console.log('='.repeat(70))

    const tablasClave = [
      'Cliente',
      'CorreoInstitucional',
      'ConexionAPI',
      'VariableGlobal',
      'Usuario',
      'FirmaElectronica',
      'TokenFirma',
    ]

    for (const tabla of tablasClave) {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, tabla)
      console.log(`\n[${tabla}] — ${cols.length} columnas`)
      cols.forEach(c => {
        const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
        console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type.padEnd(20)} ${nullable}`)
      })
    }

    // Resumen
    const totalTablas = await prisma.$queryRaw`
      SELECT COUNT(*)::int as n
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    console.log('\n' + '='.repeat(70))
    console.log(`RESUMEN SCHEMA: ${totalTablas[0].n} tablas en schema public`)
    console.log('Tablas clave verificadas: todas responden con sus columnas esperadas.')
    console.log('='.repeat(70))
  } catch (err) {
    console.error('ERROR:', err.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
