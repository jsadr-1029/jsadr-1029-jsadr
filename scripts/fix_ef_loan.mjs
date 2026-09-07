import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// Update fechaInicioAmortizacion to Aug 31 (12pm Bogota = 17:00 UTC)
// so calculation gives: cuota 1 = Aug 31 + 15 days = Sept 15, cuota 2 = Aug 31 + 30 days = Sept 30
const update = await client.query(`
  UPDATE "Prestamo"
  SET "fechaInicioAmortizacion" = '2026-08-31T17:00:00.000Z',
      "updatedAt" = NOW()
  WHERE id = 'cmtnf9yph0001l404xpsdc1a9'
  RETURNING id, codigo, "fechaInicioAmortizacion"
`);
console.log('=== UPDATE ===');
console.log(JSON.stringify(update.rows, null, 2));

// Verify
const verify = await client.query(`
  SELECT id, codigo, "fechaInicioAmortizacion", "fechaDesembolso", "periodoCorte", frecuencia, "modalidadAmortizacion"
  FROM "Prestamo" WHERE id = 'cmtnf9yph0001l404xpsdc1a9'
`);
console.log('=== VERIFY ===');
console.log(JSON.stringify(verify.rows[0], null, 2));

await client.end();
