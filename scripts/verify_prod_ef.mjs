import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// Verify final state
const res = await client.query(`
  SELECT codigo, "fechaInicioAmortizacion", "fechaDesembolso", "periodoCorte", frecuencia
  FROM "Prestamo" WHERE id = 'cmtnf9yph0001l404xpsdc1a9'
`);
const p = res.rows[0];
console.log('=== ESTADO FINAL DEL PRÉSTAMO EF-CC-30000301 ===');
console.log('Código:', p.codigo);
console.log('fechaInicioAmortizacion:', p.fechaInicioAmortizacion);
console.log('fechaDesembolso:', p.fechaDesembolso);
console.log('periodoCorte:', p.periodoCorte);
console.log('frecuencia:', p.frecuencia);
console.log('');

// Simulate the calculation
const fechaInicio = new Date(p.fechaInicioAmortizacion);
console.log('=== FECHAS DE PAGO CALCULADAS ===');
for (let i = 1; i <= p.numeroCuotas || i <= 2; i++) {
  if (p.frecuencia === 'QUINCENAL') {
    const f = new Date(fechaInicio);
    f.setDate(f.getDate() + 15 * i);
    console.log(`Cuota ${i}: ${f.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })}`);
  }
}

await client.end();
