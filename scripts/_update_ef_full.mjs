import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// === Cálculo financiero ===
// monto: 200,000, tasa mensual: 25%, 4 cuotas quincenales, modalidad TASA_FIJA
// - mesesDuracion = ceil(4/2) = 2 meses (2 quincenas = 1 mes)
// - interesTotal = 200,000 × 25% × 2 = 100,000
// - totalPagar = 200,000 + 100,000 = 300,000
// - montoCuota = 300,000 / 4 = 75,000
// - capitalPorCuota = 200,000 / 4 = 50,000
// - interesPorCuota = 100,000 / 4 = 25,000
// - 5 días causados: $20,000 (se suman al totalPagar, no a cada cuota)

// El sistema suma valorDiasCausados al totalPagar (calculo.totalPagar += valorDiasCausados)
// Pero el usuario pidió "sumarle 20.000 a la primer cuota"
// Interpretación: el monto de la PRIMERA cuota debe ser 75,000 + 20,000 = 95,000
// y el saldoTotal debe reflejarlo (300,000 + 20,000 = 320,000)

// === Actualizar préstamo ===
// numeroCuotas: 4 (era 2)
// plazoMeses: 2 (era 1, porque 4 quincenales = 2 meses)
// montoCuota: 75,000 (era 125,000)
// totalInteres: 100,000 (era 50,000)
// totalPagar: 300,000 + 20,000 = 320,000 (era 250,000)
// saldoTotal: 320,000 (refleja el monto a pagar con días causados)
// periodoCorte: '15-30' (era null)
// diasCausadosAntes: 5 (era 11)
// valorDiasCausados: 20,000 (era null)
// fechaPrimerCorte: 2026-09-15 (la fecha del primer corte de pago)

const update = await client.query(`
  UPDATE "Prestamo" SET
    "numeroCuotas" = 4,
    "plazoMeses" = 2,
    "montoCuota" = 75000,
    "totalInteres" = 100000,
    "totalPagar" = 320000,
    "saldoCapital" = 200000,
    "saldoInteres" = 100000,
    "saldoTotal" = 320000,
    "periodoCorte" = '15-30',
    "fechaPrimerCorte" = '2026-09-15T17:00:00.000Z',
    "diasCausadosAntes" = 5,
    "valorDiasCausados" = 20000,
    "fechaVencimiento" = '2026-10-30T17:00:00.000Z',
    "updatedAt" = NOW()
  WHERE codigo = 'EF-CC-30000301-20260904-01'
  RETURNING id, codigo, "numeroCuotas", "plazoMeses", "montoCuota", 
            "totalInteres", "totalPagar", "saldoTotal", "periodoCorte",
            "fechaPrimerCorte", "diasCausadosAntes", "valorDiasCausados",
            "fechaInicioAmortizacion"
`);
console.log('=== PRÉSTAMO ACTUALIZADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

// === Eliminar los pagos programados anteriores (de 2 cuotas) ===
const deletePagos = await client.query(`
  DELETE FROM "Pago" 
  WHERE "prestamoId" = $1
  RETURNING id, "numeroCuota"
`, [update.rows[0].id]);
console.log('\n=== PAGOS ANTERIORES ELIMINADOS ===');
console.log(`Total: ${deletePagos.rows.length}`);
deletePagos.rows.forEach(r => console.log(`  Cuota ${r.numeroCuota}`));

// === Crear los nuevos pagos programados (4 cuotas) ===
// Fechas: Sept 15, Sept 30, Oct 15, Oct 30
const fechaInicioAmort = new Date(update.rows[0].fechaInicioAmortizacion);
console.log('\n=== CREANDO NUEVOS PAGOS ===');

const fechas = [
  { n: 1, fecha: new Date('2026-09-15T17:00:00.000Z') }, // Sept 15 Bogota
  { n: 2, fecha: new Date('2026-09-30T17:00:00.000Z') }, // Sept 30 Bogota
  { n: 3, fecha: new Date('2026-10-15T17:00:00.000Z') }, // Oct 15 Bogota
  { n: 4, fecha: new Date('2026-10-30T17:00:00.000Z') }, // Oct 30 Bogota
];

for (const c of fechas) {
  // Primera cuota incluye los $20,000 de días causados
  const montoTotal = c.n === 1 ? 95000 : 75000; // 75,000 + 20,000
  const montoCapital = 50000;
  const montoInteres = 25000;
  const notas = c.n === 1 ? 'Incluye $20.000 por concepto de 5 días causados' : null;
  
  const pagoId = 'pago-ef-' + Math.random().toString(36).substring(2, 14);
  await client.query(`
    INSERT INTO "Pago" (
      id, "prestamoId", "numeroCuota", "fechaVencimiento",
      "montoCapital", "montoInteres", "montoMora", "montoTotal",
      "metodoPago", estado, "createdAt", "notas"
    ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'EFECTIVO', 'PENDIENTE', NOW(), $8)
  `, [
    pagoId,
    update.rows[0].id,
    c.n,
    c.fecha,
    montoCapital,
    montoInteres,
    montoTotal,
    notas,
  ]);
  console.log(`✓ Cuota ${c.n}: ${c.fecha.toISOString().slice(0,10)} | Total: $${montoTotal.toLocaleString('es-CO')}${notas ? ' (' + notas + ')' : ''}`);
}

// === Verificar estado final ===
const final = await client.query(`
  SELECT p."numeroCuota", p."fechaVencimiento", p."montoCapital", p."montoInteres", 
         p."montoTotal", p.estado, p.notas
  FROM "Pago" p 
  WHERE p."prestamoId" = $1 
  ORDER BY p."numeroCuota"
`, [update.rows[0].id]);
console.log('\n=== ESTADO FINAL ===');
console.log(JSON.stringify(final.rows, null, 2));

await client.end();
