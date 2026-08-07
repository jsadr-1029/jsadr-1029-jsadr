/**
 * Verificación de sincronización Neon DB
 * Solo lectura — no modifica nada
 */
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔌 Conectando a Neon DB...');
  await neonClient.connect();
  console.log('✅ Conexión a Neon OK\n');

  // Tablas a verificar
  const tablas = [
    'users', 'clientes', 'prestamos', 'pagos', 'cajas',
    'conexiones', 'cuentas', 'credenciales', 'notificaciones',
    'plantillas_bot', 'auditoria_seguridad', 'bitacora',
    'planes_financieros', 'planes_clientes', 'automatizaciones',
    'solicitudes_nuevos_clientes', 'solicitudes_web', 'snapshots',
    'configuracion_global', 'categorias', 'campanas'
  ];

  console.log('📊 COMPARACIÓN DE DATOS (Local SQLite vs Neon PostgreSQL)\n');
  console.log('Tabla'.padEnd(40) + 'Local'.padStart(10) + 'Neon'.padStart(10) + 'Diff'.padStart(10));
  console.log('-'.repeat(70));

  let totalLocal = 0;
  let totalNeon = 0;
  let tablasDiff = 0;

  for (const tabla of tablas) {
    let localCount = 0;
    let neonCount = 0;
    let error = '';

    // Contar en local (SQLite)
    try {
      // Verificar si la tabla existe en Prisma
      if (prisma[Object.keys(prisma).find(k => k.toLowerCase() === tabla.toLowerCase())]) {
        const modelo = Object.keys(prisma).find(k => k.toLowerCase() === tabla.toLowerCase());
        localCount = await prisma[modelo].count();
        totalLocal += localCount;
      }
    } catch (e) {
      error = 'local:' + e.message.substring(0, 20);
    }

    // Contar en Neon
    try {
      const res = await neonClient.query(`SELECT COUNT(*)::int as count FROM "${tabla}"`);
      neonCount = res.rows[0].count;
      totalNeon += neonCount;
    } catch (e) {
      error = 'neon:' + e.message.substring(0, 20);
    }

    const diff = neonCount - localCount;
    const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : `${diff}`);
    if (diff !== 0) tablasDiff++;
    
    const marca = error ? '⚠️ ' + error : (diff === 0 ? '✅' : '⚠️');
    console.log(
      tabla.padEnd(40) + 
      String(localCount).padStart(10) + 
      String(neonCount).padStart(10) + 
      String(diffStr).padStart(10) + 
      '  ' + marca
    );
  }

  console.log('-'.repeat(70));
  console.log(
    'TOTAL'.padEnd(40) + 
    String(totalLocal).padStart(10) + 
    String(totalNeon).padStart(10) + 
    String(totalNeon - totalLocal).padStart(10)
  );

  console.log(`\n📈 Resumen:`);
  console.log(`  - Total registros local: ${totalLocal}`);
  console.log(`  - Total registros Neon:  ${totalNeon}`);
  console.log(`  - Tablas con diferencia: ${tablasDiff} de ${tablas.length}`);

  if (tablasDiff > 0) {
    console.log(`\n⚠️  Hay ${tablasDiff} tablas con diferencias. Necesita sincronización.`);
  } else {
    console.log(`\n✅ Todo sincronizado.`);
  }

  await neonClient.end();
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
