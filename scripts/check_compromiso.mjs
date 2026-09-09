import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Verificar compromisos creados
console.log('=== COMPROMISOS DE PAGO ===');
const compromisos = await client.query(`
  SELECT id, "clienteId", "prestamoId", razon, "razonOtroTexto", 
         "fechaComprometida", "valorComprometido", estado,
         "observacionCliente", actualizaciones,
         "createdAt"
  FROM "CompromisoPago" 
  ORDER BY "createdAt" DESC LIMIT 5
`);
console.log(JSON.stringify(compromisos.rows, null, 2));

// 2. Revisar estructura tabla OtroSi
console.log('\n=== TABLA OtroSi ===');
const tables = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND (table_name ILIKE '%otro%' OR table_name ILIKE '%si%')
`);
console.log(tables.rows.map(r => r.table_name).join(', '));

// 3. Revisar estructura tabla Solicitud (para BuzonSolicitudesView)
console.log('\n=== TABLA SolicitudWeb ===');
const solicitudes = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND (table_name ILIKE '%solicitud%' OR table_name ILIKE '%buzon%')
`);
console.log(solicitudes.rows.map(r => r.table_name).join(', '));

await client.end();
