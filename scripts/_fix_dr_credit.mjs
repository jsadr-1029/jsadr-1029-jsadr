import pkg from 'pg';
import crypto from 'crypto';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// === Configuración actual ===
// montoPrincipal: $1,800,000, tasa: 15%, 2 cuotas quincenales, corte 15-30
// === Nueva tasa: 13.5% ===

const monto = 1800000;
const tasa = 13.5;
const tasaAnual = tasa * 12; // 162%
const nCuotas = 2;
const mesesDuracion = 1;

const interesTotal = Math.round(monto * (tasa / 100) * mesesDuracion); // $243,000
const totalPagarBase = monto + interesTotal; // $2,043,000
const montoCuota = Math.round(totalPagarBase / nCuotas); // $1,021,500
const capitalPorCuota = Math.round(monto / nCuotas); // $900,000
const interesPorCuota = Math.round(interesTotal / nCuotas); // $121,500
const diasCausados = 15;
const valorDiasCausados = Math.round(monto * (tasa / 100) * (diasCausados / 30)); // $121,500
const totalPagar = totalPagarBase + valorDiasCausados; // $2,164,500

console.log('=== NUEVO CÁLCULO (13.5%) ===');
console.log(`Tasa: ${tasa}% mensual (${tasaAnual}% anual)`);
console.log(`Interés total: $${interesTotal.toLocaleString('es-CO')}`);
console.log(`Cuota: $${montoCuota.toLocaleString('es-CO')}`);
console.log(`Días causados (15d): $${valorDiasCausados.toLocaleString('es-CO')}`);
console.log(`Total a pagar: $${totalPagar.toLocaleString('es-CO')}`);

// Actualizar préstamo
const update = await client.query(`
  UPDATE "Prestamo" SET
    "tasaInteresAnual" = $1,
    "tasaInteresMensual" = $2,
    "montoCuota" = $3,
    "totalInteres" = $4,
    "totalPagar" = $5,
    "saldoCapital" = $6,
    "saldoInteres" = $7,
    "saldoTotal" = $8,
    "valorDiasCausados" = $9,
    "tasaAplicada" = $10,
    "updatedAt" = NOW()
  WHERE codigo = 'DR-CC-1017215496-20260831-01'
  RETURNING id, codigo, "tasaInteresMensual", "montoCuota", "totalInteres", "totalPagar", "saldoTotal"
`, [tasaAnual, tasa, montoCuota, interesTotal, totalPagar, monto, interesTotal, totalPagar, valorDiasCausados, tasa / 100]);

console.log('\n=== PRÉSTAMO ACTUALIZADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

const prestamoId = update.rows[0].id;

// Eliminar pagos existentes (si los hay)
await client.query(`DELETE FROM "Pago" WHERE "prestamoId" = $1`, [prestamoId]);

// Crear pagos con fechas de corte 15-30
const fechas = [
  { n: 1, fecha: '2026-09-30T17:00:00.000Z' },
  { n: 2, fecha: '2026-10-15T17:00:00.000Z' },
];

console.log('\n=== PAGOS CREADOS ===');
for (const c of fechas) {
  const pagoId = 'pago-dr-' + crypto.randomBytes(8).toString('hex');
  await client.query(`
    INSERT INTO "Pago" (id, "prestamoId", "numeroCuota", "fechaVencimiento",
      "montoCapital", "montoInteres", "montoMora", "montoTotal", "metodoPago", estado, "createdAt")
    VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'EFECTIVO', 'PENDIENTE', NOW())
  `, [pagoId, prestamoId, c.n, c.fecha, capitalPorCuota, interesPorCuota, montoCuota]);
  const f = new Date(c.fecha).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`✓ Cuota ${c.n}: ${f} | Cap $${capitalPorCuota} | Int $${interesPorCuota} | Total $${montoCuota}`);
}

await client.end();
