import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Buscar el crédito DR
console.log('=== CRÉDITO DR-CC-1017215496-20260831-01 ===');
const dr = await client.query(`
  SELECT id, codigo, "montoPrincipal", "tasaInteresAnual", "tasaInteresMensual",
         "tasaMoraDiaria", "numeroCuotas", "plazoMeses", "montoCuota",
         "totalInteres", "totalPagar", "saldoCapital", "saldoInteres", "saldoTotal",
         "modalidadAmortizacion", frecuencia, estado, "fechaDesembolso",
         "fechaInicioAmortizacion", "periodoCorte", "fechaPrimerCorte",
         "diasCausadosAntes", "valorDiasCausados",
         "cobroPagareCarta", "valorPagareCarta",
         "cobroTarifaPlataforma", "valorTarifaPlataforma",
         "fondoGarantiaCargado", "fondoGarantiaMonto"
  FROM "Prestamo" WHERE codigo = 'DR-CC-1017215496-20260831-01'
`);
if (dr.rows.length > 0) {
  console.log(JSON.stringify(dr.rows[0], null, 2));
} else {
  console.log('NO ENCONTRADO');
}

// 2. Verificar pagos del DR
if (dr.rows.length > 0) {
  const pagos = await client.query(`
    SELECT "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", estado
    FROM "Pago" WHERE "prestamoId" = $1 ORDER BY "numeroCuota"
  `, [dr.rows[0].id]);
  console.log('\n=== PAGOS ===');
  pagos.rows.forEach(p => {
    const f = new Date(p.fechaVencimiento).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    console.log(`Cuota ${p.numeroCuota}: ${f} | Cap $${p.montoCapital} | Int $${p.montoInteres} | Total $${p.montoTotal} | ${p.estado}`);
  });
}

await client.end();
