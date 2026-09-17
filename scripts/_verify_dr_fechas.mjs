import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Verificar estado actual de los pagos
const pagos = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoTotal", estado
  FROM "Pago" WHERE "prestamoId" = 'cmtly4ecu0001l404shqnlmes' ORDER BY "numeroCuota"
`);
console.log('=== ESTADO ACTUAL EN BD ===');
pagos.rows.forEach(p => {
  console.log(`Cuota ${p.numeroCuota}: fechaVencimiento=${p.fechaVencimiento} | $${p.montoTotal} | ${p.estado}`);
});

// Verificar el préstamo
const prestamo = await client.query(`
  SELECT codigo, "tasaInteresMensual", "montoCuota", "totalPagar", "saldoTotal", "fechaInicioAmortizacion", "periodoCorte", "fechaVencimiento"
  FROM "Prestamo" WHERE id = 'cmtly4ecu0001l404shqnlmes'
`);
console.log('\n=== PRÉSTAMO ===');
console.log(JSON.stringify(prestamo.rows[0], null, 2));

await client.end();
