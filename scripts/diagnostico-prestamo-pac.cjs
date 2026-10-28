// Diagnóstico: revisar el préstamo PAC-CC-1036671139-20261020-01
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Buscar el préstamo completo
  const res = await client.query(`
    SELECT id, codigo, estado, "montoPrincipal", "tasaInteresAnual",
           "tasaMoraDiaria", "tasaMoraPersonalizada", "plazoMeses",
           "montoCuota", "numeroCuotas", "frecuencia",
           "totalPagar", "totalInteres", "saldoTotal", "saldoCapital",
           "saldoInteres", "montoPagado", "montoMora",
           "cuotasPagadas", "fechaDesembolso", "fechaVencimiento",
           "categoriaId"
    FROM "Prestamo" WHERE codigo = 'PAC-CC-1036671139-20261020-01'
  `);

  if (res.rows.length === 0) {
    console.log('✗ Préstamo no encontrado');
    await client.end();
    return;
  }

  const p = res.rows[0];
  console.log('=== PRÉSTAMO PAC-CC-1036671139-20261020-01 ===\n');
  console.log('Estado:', p.estado);
  console.log('Monto principal:', p.montoPrincipal);
  console.log('Tasa interés anual:', p.tasaInteresAnual, '%');
  console.log('Tasa mora diaria:', p.tasaMoraDiaria, '%');
  console.log('Tasa mora anual:', p.tasaMoraPersonalizada || 'no definida', '%');
  console.log('Plazo meses:', p.plazoMeses);
  console.log('Monto cuota:', p.montoCuota);
  console.log('Número cuotas:', p.numeroCuotas);
  console.log('Frecuencia:', p.frecuencia);
  console.log('Total a pagar:', p.totalPagar);
  console.log('Total interés:', p.totalInteres);
  console.log('Saldo total:', p.saldoTotal);
  console.log('Saldo capital:', p.saldoCapital);
  console.log('Saldo interés:', p.saldoInteres);
  console.log('Monto pagado:', p.montoPagado);
  console.log('Monto mora:', p.montoMora);
  console.log('Cuotas pagadas:', p.cuotasPagadas);
  console.log('Fecha desembolso:', p.fechaDesembolso);
  console.log('Fecha vencimiento:', p.fechaVencimiento);

  // Cálculos esperados:
  // Monto: $300.000
  // Tasa: 20% mensual = 240% anual
  // Plazo: 1 mes
  // Interés: $300.000 * 20% = $60.000
  // Plataforma: $4.900
  // Total a pagar: $300.000 + $60.000 + $4.900 = $364.900
  // Tasa mora: 1% mensual = 12% anual

  console.log('\n=== CÁLCULOS ESPERADOS ===');
  console.log('Monto principal: $300.000');
  console.log('Tasa mensual: 20%');
  console.log('Tasa anual esperada: 240% (20% × 12)');
  console.log('Interés: $300.000 × 20% = $60.000');
  console.log('Plataforma: $4.900');
  console.log('Total a pagar esperado: $300.000 + $60.000 + $4.900 = $364.900');
  console.log('Tasa mora mensual: 1%');
  console.log('Tasa mora anual esperada: 12% (1% × 12)');
  console.log('');
  console.log('Total a pagar en DB:', p.totalPagar);
  console.log('¿Coincide?:', p.totalPagar === 364900 ? '✓ SÍ' : '✗ NO (esperado $364.900)');
  console.log('Tasa anual en DB:', p.tasaInteresAnual, '%');
  console.log('¿Coincide?:', p.tasaInteresAnual === 240 ? '✓ SÍ' : '✗ NO (esperado 240%)');
  console.log('Saldo total en DB:', p.saldoTotal);
  console.log('¿Coincide?:', p.saldoTotal === 364900 ? '✓ SÍ' : '✗ NO (esperado $364.900)');

  // Buscar la categoría
  if (p.categoriaId) {
    const catRes = await client.query(`
      SELECT id, nombre, "tasaInteresAnual", "tasaMoraDiaria", "tasaMoraAnual",
             "plataformaFee", "plataformaTipo"
      FROM "Categoria" WHERE id = $1
    `, [p.categoriaId]);
    if (catRes.rows.length > 0) {
      console.log('\n=== CATEGORÍA ===');
      console.log('Nombre:', catRes.rows[0].nombre);
      console.log('Tasa interés anual:', catRes.rows[0].tasaInteresAnual, '%');
      console.log('Tasa mora diaria:', catRes.rows[0].tasaMoraDiaria, '%');
      console.log('Tasa mora anual:', catRes.rows[0].tasaMoraAnual, '%');
      console.log('Plataforma fee:', catRes.rows[0].plataformaFee);
      console.log('Plataforma tipo:', catRes.rows[0].plataformaTipo);
    }
  }

  // Buscar pagos
  const pagosRes = await client.query(`
    SELECT id, "numeroCuota", "fechaVencimiento", "fechaPago",
           "montoCapital", "montoInteres", "montoMora", "montoTotal",
           "metodoPago", estado
    FROM "Pago" WHERE "prestamoId" = $1
    ORDER BY "numeroCuota" ASC
  `, [p.id]);
  console.log('\n=== PAGOS ===');
  console.log('Total pagos:', pagosRes.rows.length);
  for (const pg of pagosRes.rows) {
    console.log(`  Cuota ${pg.numeroCuota}: vence ${pg.fechaVencimiento?.toISOString().slice(0,10)} | pagado ${pg.fechaPago?.toISOString().slice(0,10) || '—'} | capital ${pg.montoCapital} | interés ${pg.montoInteres} | mora ${pg.montoMora} | total ${pg.montoTotal} | estado ${pg.estado}`);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
