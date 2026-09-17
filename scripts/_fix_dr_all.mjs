import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const prestamoId = 'cmtly4ecu0001l404shqnlmes';

// === 1. Actualizar fechaInicioAmortizacion para que las fechas calculadas coincidan ===
// Si fechaInicioAmortizacion = Aug 31, el cálculo aritmético da:
//   Cuota 1: Aug 31 + 15 = Sept 15 ✓
//   Cuota 2: Aug 31 + 30 = Sept 30 ✓
await client.query(`
  UPDATE "Prestamo" 
  SET "fechaInicioAmortizacion" = '2026-08-31T17:00:00.000Z',
      "fechaVencimiento" = '2026-09-30T17:00:00.000Z',
      "updatedAt" = NOW()
  WHERE id = $1
`, [prestamoId]);

// === 2. Asegurar que las fechas de los pagos sean correctas ===
await client.query(`
  UPDATE "Pago" 
  SET "fechaVencimiento" = '2026-09-15T17:00:00.000Z'
  WHERE "prestamoId" = $1 AND "numeroCuota" = 1
`, [prestamoId]);

await client.query(`
  UPDATE "Pago" 
  SET "fechaVencimiento" = '2026-09-30T17:00:00.000Z'
  WHERE "prestamoId" = $1 AND "numeroCuota" = 2
`, [prestamoId]);

// === 3. Verificar estado final ===
const pagos = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", estado
  FROM "Pago" WHERE "prestamoId" = $1 ORDER BY "numeroCuota"
`, [prestamoId]);

const prestamo = await client.query(`
  SELECT codigo, "tasaInteresMensual", "montoCuota", "totalPagar", "saldoTotal",
         "fechaInicioAmortizacion", "periodoCorte", "fechaVencimiento"
  FROM "Prestamo" WHERE id = $1
`, [prestamoId]);

console.log('=== PRÉSTAMO ===');
console.log(JSON.stringify(prestamo.rows[0], null, 2));

console.log('\n=== PAGOS ===');
pagos.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f} | Cap $${p.montoCapital} | Int $${p.montoInteres} | Total $${p.montoTotal} | ${p.estado}`);
});

await client.end();
