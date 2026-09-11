import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Préstamo + pagos
const p = await client.query(`
  SELECT p.id, p.codigo, p."montoPrincipal", p."tasaInteresMensual", p."numeroCuotas", 
         p."montoCuota", p."totalInteres", p."totalPagar", p."saldoTotal",
         p."diasCausadosAntes", p."valorDiasCausados", p."periodoCorte",
         p."fechaInicioAmortizacion",
         json_agg(
           json_build_object(
             'numero', pg."numeroCuota",
             'fecha', pg."fechaVencimiento",
             'capital', pg."montoCapital",
             'interes', pg."montoInteres",
             'mora', pg."montoMora",
             'total', pg."montoTotal",
             'estado', pg.estado,
             'notas', pg.notas
           ) ORDER BY pg."numeroCuota"
         ) as pagos
  FROM "Prestamo" p
  LEFT JOIN "Pago" pg ON pg."prestamoId" = p.id
  WHERE p.codigo = 'EF-CC-30000301-20260904-01'
  GROUP BY p.id
`);
console.log('=== ESTADO ACTUAL ===');
const prestamo = p.rows[0];
console.log(`Monto cuota: $${prestamo.montoCuota}`);
console.log(`Total a pagar: $${prestamo.totalPagar}`);
console.log(`Saldo total: $${prestamo.saldoTotal}`);
console.log(`Días causados: ${prestamo.diasCausadosAntes} (valor: $${prestamo.valorDiasCausados})`);
console.log(`Periodo corte: ${prestamo.periodoCorte}`);
console.log('');
console.log('=== PAGOS ===');
prestamo.pagos.forEach(pg => {
  const f = new Date(pg.fecha).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${pg.numero}: ${f} | Cap $${pg.capital} | Int $${pg.interes} | Mora $${pg.mora} | TOTAL $${pg.total} | ${pg.estado}`);
});

await client.end();
