import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// === Configuración final ===
// 4 cuotas quincenales de $80.000 cada una
// + Nota: $20.000 por concepto de cambio de fecha de cuotas (5 días causados)
// 
// Cálculo:
// - monto: $200,000, tasa mensual: 25%, 4 cuotas quincenales
// - Interés total: 200,000 × 25% × 2 meses = $100,000
// - Total base: 200,000 + 100,000 = $300,000
// - Cuota base + $5,000 extra: $80,000 × 4 = $320,000
// - $20,000 adicionales por cambio de fecha: agregados como ajuste total
// - Total a pagar: $340,000 (200k capital + 100k interés + 20k cambio fecha + 20k extra)
//
// Las 4 cuotas son de $80,000 (incluye $5,000 cargo adicional por cuota)
// El $20,000 del cambio de fecha es un cargo adicional que se distribuye
// en el total pero NO se suma a cada cuota individual (todas son $80,000)
//
// Interpretación más simple:
// - 4 cuotas × $80,000 = $320,000
// - + $20,000 por cambio de fecha (cargo único)
// - Total a pagar: $340,000
//
// El $20,000 del cambio de fecha NO se suma a la cuota 1, sino que es un
// cargo aparte que se documenta en notas pero las cuotas individuales
// quedan todas iguales a $80,000.

const update = await client.query(`
  UPDATE "Prestamo" SET
    "montoCuota" = 80000,
    "totalInteres" = 120000,
    "totalPagar" = 340000,
    "saldoInteres" = 120000,
    "saldoTotal" = 340000,
    "diasCausadosAntes" = 5,
    "valorDiasCausados" = 20000,
    "updatedAt" = NOW()
  WHERE codigo = 'EF-CC-30000301-20260904-01'
  RETURNING id, codigo, "montoCuota", "totalInteres", "totalPagar", "saldoTotal",
            "diasCausadosAntes", "valorDiasCausados"
`);
console.log('=== PRÉSTAMO ACTUALIZADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

// === Actualizar las 4 cuotas a $80.000 cada una ===
// Notas:
// - Todas las cuotas: $80.000 (capital $50.000 + interés $25.000 + $5.000 cargo adicional)
// - El $20.000 por cambio de fecha se documenta en la nota pero no se suma a las cuotas
const pagosUpdate = await client.query(`
  UPDATE "Pago" 
  SET "montoTotal" = 80000,
      "montoCapital" = 50000,
      "montoInteres" = 25000,
      "notas" = CASE 
        WHEN "numeroCuota" = 1 THEN 'Cuota \$80.000 (capital \$50.000 + interés \$25.000 + \$5.000 cargo adicional). Se cobran \$20.000 adicionales por concepto de cambio de fecha de cuotas dejando 5 días causados (cargo único, no incluido en esta cuota).'
        ELSE 'Cuota \$80.000 (capital \$50.000 + interés \$25.000 + \$5.000 cargo adicional). Se cobran \$20.000 adicionales por concepto de cambio de fecha de cuotas dejando 5 días causados (cargo único, no incluido en esta cuota).'
      END
  WHERE "prestamoId" = $1
  RETURNING "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", "notas"
`, [update.rows[0].id]);
console.log('\n=== PAGOS ACTUALIZADOS (4 cuotas iguales a $80.000) ===');
pagosUpdate.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f}`);
  console.log(`  Capital: $${p.montoCapital} | Interés: $${p.montoInteres} | Total: $${p.montoTotal}`);
  console.log(`  Nota: ${p.notas}`);
  console.log('');
});

// === Resumen final ===
console.log('=== RESUMEN FINAL ===');
console.log(`Monto cuota: $${update.rows[0].montoCuota} (todas las cuotas iguales)`);
console.log(`Total interés: $${update.rows[0].totalInteres}`);
console.log(`  (Incluye $100.000 interés + $20.000 extras de 4 cuotas × $5.000)`);
console.log(`Total a pagar: $${update.rows[0].totalPagar}`);
console.log(`  (Incluye $200.000 capital + $100.000 interés + $20.000 cambio fecha + $20.000 extras)`);
console.log(`Días causados: ${update.rows[0].diasCausadosAntes} días`);
console.log(`Valor días causados: $${update.rows[0].valorDiasCausados} (cargo por cambio de fecha)`);

await client.end();
