import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar ambos préstamos
const prestamos = await client.query(`
  SELECT id, codigo, "clienteId", "montoPrincipal", "montoPagado", "saldoTotal",
         estado, "renovacionAnticipada", "renovacionAnticipadaCosto",
         "renovacionPrestamoAnteriorId", "renovacionPendienteTyc",
         "renovacionFechaCancelacionAnterior",
         "fechaDesembolso", "fechaCancelacion", "createdAt"
  FROM "Prestamo" 
  WHERE codigo IN ('VPS-CC-1038627025-20260915-02', 'VPS-CC-1038627025-20260822-01')
  ORDER BY "createdAt"
`);
console.log('=== PRÉSTAMOS VPS ===');
prestamos.rows.forEach(p => {
  console.log(`\nCódigo: ${p.codigo}`);
  console.log(`  ID: ${p.id}`);
  console.log(`  Estado: ${p.estado}`);
  console.log(`  Saldo total: $${p.saldoTotal}`);
  console.log(`  Monto pagado: $${p.montoPagado}`);
  console.log(`  Renovación anticipada: ${p.renovacionAnticipada}`);
  console.log(`  Renovación costo: $${p.renovacionAnticipadaCosto}`);
  console.log(`  Renovación préstamo anterior ID: ${p.renovacionPrestamoAnteriorId}`);
  console.log(`  Renovación pendiente TyC: ${p.renovacionPendienteTyc}`);
  console.log(`  Renovación fecha cancelación anterior: ${p.renovacionFechaCancelacionAnterior}`);
  console.log(`  Fecha desembolso: ${p.fechaDesembolso}`);
  console.log(`  Fecha cancelación: ${p.fechaCancelacion}`);
  console.log(`  Created: ${p.createdAt}`);
});

await client.end();
