// Corrige el préstamo PAC-CC-1036671139-20261020-01 en Neon
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const codigo = 'PAC-CC-1036671139-20261020-01';

  // Estado antes
  const antes = await client.query(`
    SELECT "montoPrincipal", "tasaInteresAnual", "tasaMoraDiaria",
           "totalPagar", "totalInteres", "saldoTotal", "saldoCapital",
           "saldoInteres", "montoCuota"
    FROM "Prestamo" WHERE codigo = $1
  `, [codigo]);
  console.log('=== ANTES ===');
  console.log('  Monto:', antes.rows[0].montoPrincipal);
  console.log('  Tasa anual:', antes.rows[0].tasaInteresAnual, '% (debería ser 240%)');
  console.log('  Tasa mora:', antes.rows[0].tasaMoraDiaria, '% mensual');
  console.log('  Total pagar:', antes.rows[0].totalPagar, '(debería ser 364900)');
  console.log('  Total interés:', antes.rows[0].totalInteres, '(debería ser 60000)');
  console.log('  Saldo total:', antes.rows[0].saldoTotal, '(debería ser 364900)');
  console.log('  Saldo capital:', antes.rows[0].saldoCapital, '(debería ser 300000)');
  console.log('  Saldo interés:', antes.rows[0].saldoInteres, '(debería ser 60000)');
  console.log('  Monto cuota:', antes.rows[0].montoCuota, '(debería ser 364900)');

  // Corregir:
  // - Tasa anual: 20 → 240 (20% mensual × 12)
  // - Total a pagar: 360000 → 364900 ($300.000 + $60.000 + $4.900 plataforma)
  // - Total interés: 60000 (correcto, pero verificar)
  // - Saldo total: 372000 → 364900
  // - Saldo capital: 310000 → 300000
  // - Saldo interés: 62000 → 60000
  // - Monto cuota: 360000 → 364900 (1 sola cuota mensual)
  await client.query(`
    UPDATE "Prestamo"
    SET "tasaInteresAnual" = 240,
        "totalPagar" = 364900,
        "totalInteres" = 60000,
        "saldoTotal" = 364900,
        "saldoCapital" = 300000,
        "saldoInteres" = 60000,
        "montoCuota" = 364900,
        "updatedAt" = NOW()
    WHERE codigo = $1
  `, [codigo]);

  // Estado después
  const despues = await client.query(`
    SELECT "montoPrincipal", "tasaInteresAnual", "tasaMoraDiaria",
           "totalPagar", "totalInteres", "saldoTotal", "saldoCapital",
           "saldoInteres", "montoCuota"
    FROM "Prestamo" WHERE codigo = $1
  `, [codigo]);
  console.log('\n=== DESPUÉS ===');
  console.log('  Monto:', despues.rows[0].montoPrincipal);
  console.log('  Tasa anual:', despues.rows[0].tasaInteresAnual, '% ✓');
  console.log('  Tasa mora:', despues.rows[0].tasaMoraDiaria, '% mensual ✓');
  console.log('  Total pagar:', despues.rows[0].totalPagar, '✓');
  console.log('  Total interés:', despues.rows[0].totalInteres, '✓');
  console.log('  Saldo total:', despues.rows[0].saldoTotal, '✓');
  console.log('  Saldo capital:', despues.rows[0].saldoCapital, '✓');
  console.log('  Saldo interés:', despues.rows[0].saldoInteres, '✓');
  console.log('  Monto cuota:', despues.rows[0].montoCuota, '✓');

  // Actualizar también el pago (cuota) con los valores correctos
  await client.query(`
    UPDATE "Pago"
    SET "montoCapital" = 300000,
        "montoInteres" = 60000,
        "montoTotal" = 364900
    WHERE "prestamoId" = (SELECT id FROM "Prestamo" WHERE codigo = $1)
      AND estado = 'PENDIENTE'
  `, [codigo]);
  console.log('\n✓ Cuota pendiente actualizada');

  await client.end();
  console.log('\n=== CORRECCIÓN COMPLETADA ===');
}

main().catch(e => { console.error(e); process.exit(1); });
