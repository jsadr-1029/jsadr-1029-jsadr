import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Verificar estado actual
const antes = await client.query(`
  SELECT "numeroCuota", "montoTotal", "notas"
  FROM "Pago" 
  WHERE "prestamoId" = 'cmtnf9yph0001l404xpsdc1a9' 
  ORDER BY "numeroCuota"
`);
console.log('=== ANTES ===');
antes.rows.forEach(p => console.log(`Cuota ${p.numeroCuota}: $${p.montoTotal}`));

// Actualizar todas las 4 cuotas a $80,000
await client.query(`
  UPDATE "Pago" 
  SET "montoTotal" = 80000,
      "notas" = 'Cuota $80.000 (capital $50.000 + interés $25.000 + $5.000 cargo adicional). Se cobran $20.000 adicionales por concepto de cambio de fecha de cuotas dejando 5 días causados (cargo único, no incluido en esta cuota).'
  WHERE "prestamoId" = 'cmtnf9yph0001l404xpsdc1a9'
`);

// Verificar después
const despues = await client.query(`
  SELECT "numeroCuota", "montoTotal", "notas"
  FROM "Pago" 
  WHERE "prestamoId" = 'cmtnf9yph0001l404xpsdc1a9' 
  ORDER BY "numeroCuota"
`);
console.log('\n=== DESPUÉS ===');
despues.rows.forEach(p => console.log(`Cuota ${p.numeroCuota}: $${p.montoTotal}`));

await client.end();
