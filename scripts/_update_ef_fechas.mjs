import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// === Nuevas fechas solicitadas ===
// Cuota 1: 20/09/2026
// Cuota 2: 05/10/2026
// Cuota 3: 20/10/2026
// Cuota 4: 05/11/2026 (el user escribió 5/05/2026 pero es typo, debe seguir el patrón 20-5)
//
// Periodo de corte: '5-20' (días 5 y 20 de cada mes)
// fechaInicioAmortizacion: 5/09/2026 (1 periodo antes del primer pago 20/09)
//   - Cálculo aritmético: Sept 5 + 15 días = Sept 20 ✓
//   - Sept 5 + 30 días = Oct 5 ✓ (corrección confirma: diaMenor=5 → diaMayor=20 mismo mes, pero como Sept 5 + 30 = Oct 5, ya está en día 5)
//   - Con corregirFechasPorCorte('5-20'):
//     * Cuota 1 (Sept 20 = diaMayor) → Cuota 2: diaMenor (5) del MES SIGUIENTE (Oct 5) ✓
//     * Cuota 2 (Oct 5 = diaMenor) → Cuota 3: diaMayor (20) del MISMO MES (Oct 20) ✓
//     * Cuota 3 (Oct 20 = diaMayor) → Cuota 4: diaMenor (5) del MES SIGUIENTE (Nov 5) ✓

// === Actualizar préstamo ===
const update = await client.query(`
  UPDATE "Prestamo" SET
    "periodoCorte" = '5-20',
    "fechaPrimerCorte" = '2026-09-20T17:00:00.000Z',
    "fechaInicioAmortizacion" = '2026-09-05T17:00:00.000Z',
    "fechaVencimiento" = '2026-11-05T17:00:00.000Z',
    "updatedAt" = NOW()
  WHERE codigo = 'EF-CC-30000301-20260904-01'
  RETURNING id, codigo, "periodoCorte", "fechaPrimerCorte", "fechaInicioAmortizacion", "fechaVencimiento"
`);
console.log('=== PRÉSTAMO ACTUALIZADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

// === Actualizar las 4 fechas de pago ===
const nuevasFechas = [
  { numero: 1, fecha: '2026-09-20T17:00:00.000Z' },  // 20/09/2026
  { numero: 2, fecha: '2026-10-05T17:00:00.000Z' },  // 05/10/2026
  { numero: 3, fecha: '2026-10-20T17:00:00.000Z' },  // 20/10/2026
  { numero: 4, fecha: '2026-11-05T17:00:00.000Z' },  // 05/11/2026
];

console.log('\n=== PAGOS ACTUALIZADOS ===');
for (const f of nuevasFechas) {
  await client.query(`
    UPDATE "Pago" 
    SET "fechaVencimiento" = $1
    WHERE "prestamoId" = $2 AND "numeroCuota" = $3
  `, [f.fecha, update.rows[0].id, f.numero]);
  
  const fCol = new Date(f.fecha).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${f.numero}: ${fCol}`);
}

// === Verificar estado final ===
const final = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", "notas"
  FROM "Pago" WHERE "prestamoId" = $1 ORDER BY "numeroCuota"
`, [update.rows[0].id]);
console.log('\n=== ESTADO FINAL ===');
final.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f} | Cap $${p.montoCapital} | Int $${p.montoInteres} | Total $${p.montoTotal}`);
});

await client.end();
