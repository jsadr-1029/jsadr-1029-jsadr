const { Client } = require('pg');
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await neonClient.connect();
  for (const t of ['Integracion', 'CasoJuridico', 'SolicitudNuevoCliente']) {
    console.log(`\n=== ${t} ===`);
    try {
      const r = await neonClient.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
      r.rows.forEach(c => console.log(`  ${c.column_name.padEnd(28)} | ${c.data_type}`));
    } catch (e) { console.log('  ERROR:', e.message); }
  }
  await neonClient.end();
})();
