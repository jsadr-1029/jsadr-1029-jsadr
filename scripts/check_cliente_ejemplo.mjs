import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar cliente
const cli = await client.query(`
  SELECT id, nombre, cedula, telefono, "tokenSesion", "tokenExpira", activo
  FROM "Cliente" WHERE cedula = '1214731649'
`);
console.log('=== CLIENTE ===');
console.log(JSON.stringify(cli.rows, null, 2));

if (cli.rows.length > 0) {
  const clienteId = cli.rows[0].id;
  
  // Buscar préstamos
  const prestamos = await client.query(`
    SELECT id, codigo, "montoPrincipal", "tasaInteresMensual", "tasaMoraDiaria",
           "numeroCuotas", "plazoMeses", frecuencia, estado, "modalidadAmortizacion",
           "fechaDesembolso", "fechaInicioAmortizacion", "periodoCorte",
           "saldoCapital", "saldoTotal", "cuotasPagadas", "montoPagado"
    FROM "Prestamo" WHERE "clienteId" = $1
    ORDER BY "createdAt" DESC
  `, [clienteId]);
  console.log('\n=== PRÉSTAMOS ===');
  console.log(JSON.stringify(prestamos.rows, null, 2));
  
  // Para cada préstamo, ver los pagos
  for (const p of prestamos.rows) {
    const pagos = await client.query(`
      SELECT id, "numeroCuota", "fechaPago", "fechaVencimiento", "montoCapital", 
             "montoInteres", "montoTotal", estado, "metodoPago"
      FROM "Pago" WHERE "prestamoId" = $1
      ORDER BY "numeroCuota"
    `, [p.id]);
    console.log(`\n=== PAGOS de ${p.codigo} ===`);
    console.log(JSON.stringify(pagos.rows, null, 2));
  }
}

await client.end();
