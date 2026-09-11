import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// === Configuración actual ===
// monto: $200,000, tasa mensual: 25%, 4 cuotas QUINCENALES, corte '15-30'
// fechaInicio: 2026-08-31 (1 periodo antes del primer pago 15/09)
//
// === Nueva configuración con $5.000 adicionales por cuota ===
//
// Cálculo financiero TASA_FIJA (frecuencia QUINCENAL):
//   - 4 cuotas quincenales = 2 meses de duración
//   - Interés total = 200,000 × 25% × 2 meses = $100,000
//   - Total base = 200,000 + 100,000 = $300,000
//   - Cuota base = 300,000 / 4 = $75,000
//   - Capital por cuota = 200,000 / 4 = $50,000
//   - Interés por cuota = 100,000 / 4 = $25,000 (interes QUINCENAL = mitad del mensual)
//
// Con $5,000 adicionales por cuota:
//   - Cuota 1: $75,000 + $5,000 = $80,000 (sin días causados, ya que el user no los mencionó)
//   - Pero también conservamos los $20,000 de días causados en la cuota 1
//   - Cuota 1 total: $75,000 + $5,000 + $20,000 = $100,000
//   - Cuota 2: $75,000 + $5,000 = $80,000
//   - Cuota 3: $75,000 + $5,000 = $80,000
//   - Cuota 4: $75,000 + $5,000 = $80,000
//   - Total: $100,000 + $80,000 × 3 = $340,000
//
// Actualizamos:
//   - montoCuota: $75,000 → $80,000 (incluye el +$5,000)
//   - totalPagar: $320,000 → $340,000 (300k + 20k días causados + 4×5k)
//   - saldoTotal: $320,000 → $340,000
//   - totalInteres: $100,000 → $120,000 (interes $100k + 4×$5k cargos adicionales)
//
// Mantenemos:
//   - frecuencia: QUINCENAL
//   - numeroCuotas: 4
//   - plazoMeses: 2
//   - periodoCorte: '15-30'
//   - diasCausadosAntes: 5
//   - valorDiasCausados: $20,000
//   - fechaInicioAmortizacion: 2026-08-31

const update = await client.query(`
  UPDATE "Prestamo" SET
    "montoCuota" = 80000,
    "totalInteres" = 120000,
    "totalPagar" = 340000,
    "saldoInteres" = 120000,
    "saldoTotal" = 340000,
    "updatedAt" = NOW()
  WHERE codigo = 'EF-CC-30000301-20260904-01'
  RETURNING id, codigo, "montoCuota", "totalInteres", "totalPagar", "saldoTotal",
            "numeroCuotas", "plazoMeses", frecuencia, "periodoCorte"
`);
console.log('=== PRÉSTAMO ACTUALIZADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

// === Actualizar los 4 pagos con +$5,000 cada uno ===
const pagosUpdate = await client.query(`
  UPDATE "Pago" 
  SET "montoTotal" = CASE 
    WHEN "numeroCuota" = 1 THEN 100000  -- 75k + 5k + 20k días causados
    ELSE 80000                            -- 75k + 5k
  END,
  "notas" = CASE 
    WHEN "numeroCuota" = 1 THEN 'Incluye $5.000 cargo adicional + $20.000 por concepto de 5 días causados'
    ELSE 'Incluye $5.000 cargo adicional'
  END
  WHERE "prestamoId" = $1
  RETURNING "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", "notas"
`, [update.rows[0].id]);
console.log('\n=== PAGOS ACTUALIZADOS ===');
pagosUpdate.rows.forEach(p => {
  const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${p.numeroCuota}: ${f} | Capital: $${p.montoCapital} | Interés: $${p.montoInteres} | Total: $${p.montoTotal} | ${p.notas}`);
});

await client.end();
