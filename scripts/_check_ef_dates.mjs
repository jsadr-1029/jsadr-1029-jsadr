import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const pagos = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoTotal", estado
  FROM "Pago" 
  WHERE "prestamoId" = 'cmtnf9yph0001l404xpsdc1a9' 
  ORDER BY "numeroCuota"
`);
console.log('=== PAGOS ACTUALES (zona Bogota) ===');
pagos.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f} | $${p.montoTotal} | ${p.estado}`);
});

await client.end();
