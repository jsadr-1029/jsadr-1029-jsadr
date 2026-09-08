import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const res = await client.query(`
  SELECT id, codigo, "fechaInicioAmortizacion", "fechaDesembolso", 
         "fechaSolicitud", "periodoCorte", frecuencia, estado
  FROM "Prestamo" 
  WHERE "fechaInicioAmortizacion" IS NOT NULL 
  ORDER BY "createdAt" DESC
`);
console.log('=== PRÉSTAMOS CON fechaInicioAmortizacion ===');
console.log(JSON.stringify(res.rows, null, 2));

await client.end();
