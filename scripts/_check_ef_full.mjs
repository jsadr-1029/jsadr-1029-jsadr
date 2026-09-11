import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Prestamo full
const p = await client.query(`
  SELECT id, codigo, "montoPrincipal", "tasaInteresAnual", "tasaInteresMensual", 
         "tasaMoraDiaria", "plazoMeses", "numeroCuotas", "montoCuota",
         "totalInteres", "totalPagar", "tasaAplicada",
         "modalidadAmortizacion", frecuencia, estado,
         "fechaDesembolso", "fechaInicioAmortizacion", "periodoCorte", "fechaPrimerCorte",
         "diasCausadosAntes", "valorDiasCausados",
         "saldoCapital", "saldoInteres", "saldoTotal",
         "cobroPagareCarta", "valorPagareCarta",
         "cobroTarifaPlataforma", "tarifaPlataformaCargada", "valorTarifaPlataforma",
         "fondoGarantiaCargado", "fondoGarantiaMonto"
  FROM "Prestamo" WHERE codigo = 'EF-CC-30000301-20260904-01'
`);
console.log('=== PRÉSTAMO ===');
console.log(JSON.stringify(p.rows[0], null, 2));

await client.end();
