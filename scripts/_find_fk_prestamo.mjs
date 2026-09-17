import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar TODAS las tablas que tienen FK hacia Prestamo
const fks = await client.query(`
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'Prestamo'
  ORDER BY tc.table_name
`);
console.log('=== Tablas con FK hacia Prestamo ===');
fks.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} → Prestamo.${r.foreign_column_name}`));

// Verificar registros asociados al préstamo JA-CC-1214731649-20260626-01
const prestamoId = 'cmtnf9yph0001l404xpsdc1a9';
console.log('\n=== Registros asociados al préstamo JA-CC-1214731649-20260626-01 ===');
for (const tabla of ['CompromisoPago', 'OtroSiCambioFecha', 'Devolucion', 'AccesoPortal']) {
  try {
    const count = await client.query(`SELECT COUNT(*) as total FROM "${tabla}" WHERE "prestamoId" = $1`, [prestamoId]);
    if (parseInt(count.rows[0].total) > 0) {
      console.log(`  ⚠️  ${tabla}: ${count.rows[0].total} registro(s)`);
    } else {
      console.log(`  ✓ ${tabla}: 0`);
    }
  } catch (e) {
    // tabla no existe o no tiene columna
  }
}

await client.end();
