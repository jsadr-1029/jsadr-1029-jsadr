import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const prestamoId = 'cmtnf9yph0001l404xpsdc1a9';
console.log('=== Estado del préstamo JA-CC-1214731649-20260626-01 ===');

// Revisar todas las tablas que pueden tener FK
const tablas = [
  'Pago', 'TokenFirma', 'FirmaElectronica', 'NotificacionLog',
  'DocumentoGestor', 'BitacoraPrestamo', 'CasoJuridico',
  'Refinanciacion', 'PagoProgramado', 'MovimientoCaja',
  'CodigoConfirmacion', 'CompromisoPago', 'OtroSiCambioFecha',
  'PasaporteAuditoria'
];

for (const t of tablas) {
  try {
    const count = await client.query(`SELECT COUNT(*) as total FROM "${t}" WHERE "prestamoId" = $1`, [prestamoId]);
    const total = parseInt(count.rows[0].total);
    if (total > 0) {
      console.log(`  ⚠️  ${t}: ${total} registro(s)`);
    } else {
      console.log(`  ✓ ${t}: 0`);
    }
  } catch (e) {
    console.log(`  - ${t}: ${e.message.substring(0, 60)}`);
  }
}

await client.end();
