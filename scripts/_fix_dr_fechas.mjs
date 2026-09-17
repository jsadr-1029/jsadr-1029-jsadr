import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Actualizar las fechas de los pagos del crédito DR
// Cuota 1: 15/09/2026 (era 30/09/2026)
// Cuota 2: 30/09/2026 (era 15/10/2026)

const prestamoId = 'cmtly4ecu0001l404shqnlmes';

// Actualizar cuota 1
await client.query(`
  UPDATE "Pago" 
  SET "fechaVencimiento" = '2026-09-15T17:00:00.000Z'
  WHERE "prestamoId" = $1 AND "numeroCuota" = 1
`, [prestamoId]);

// Actualizar cuota 2
await client.query(`
  UPDATE "Pago" 
  SET "fechaVencimiento" = '2026-09-30T17:00:00.000Z'
  WHERE "prestamoId" = $1 AND "numeroCuota" = 2
`, [prestamoId]);

// Verificar
const pagos = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoTotal"
  FROM "Pago" WHERE "prestamoId" = $1 ORDER BY "numeroCuota"
`, [prestamoId]);

console.log('=== FECHAS ACTUALIZADAS ===');
pagos.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f} | $${p.montoTotal}`);
});

await client.end();
