import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const p = await client.query(`
  SELECT id, codigo, "montoPrincipal", "tasaInteresMensual", "numeroCuotas", 
         "plazoMeses", "montoCuota", "totalInteres", "totalPagar",
         "saldoTotal", "modalidadAmortizacion", frecuencia, "periodoCorte",
         "diasCausadosAntes", "valorDiasCausados"
  FROM "Prestamo" WHERE codigo = 'EF-CC-30000301-20260904-01'
`);
console.log('=== PRÉSTAMO ===');
console.log(JSON.stringify(p.rows[0], null, 2));

const pagos = await client.query(`
  SELECT "numeroCuota", "fechaVencimiento", "montoCapital", "montoInteres", "montoTotal", estado, notas
  FROM "Pago" WHERE "prestamoId" = $1 ORDER BY "numeroCuota"
`, [p.rows[0].id]);
console.log('\n=== PAGOS ===');
console.log(JSON.stringify(pagos.rows, null, 2));

await client.end();
