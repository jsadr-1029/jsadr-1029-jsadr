import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Buscar al cliente
console.log('=== CLIENTE cédula 1100012073 ===');
const cli = await client.query(`
  SELECT id, nombre, cedula, telefono, email, activo, 
         "claveHash", "claveResetToken", "claveResetExpira", "debeCambiarClave",
         "claveIntentos", "claveBloqueadoHasta", "pinBloqueadoHasta", "pinIntentos"
  FROM "Cliente" WHERE cedula = '1100012073'
`);
console.log(JSON.stringify(cli.rows, null, 2));

// 2. Verificar si hay solicitudes recientes en Configuracion (bitácora)
if (cli.rows.length > 0) {
  const clienteId = cli.rows[0].id;
  console.log('\n=== SOLICITUDES DE RECUPERACIÓN RECIENTES ===');
  const solicitudes = await client.query(`
    SELECT clave, valor, "createdAt"
    FROM "Configuracion" 
    WHERE clave LIKE 'RECUPERACION_CLIENTE_${clienteId}_%'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log('Total solicitudes:', solicitudes.rows.length);
  solicitudes.rows.forEach((s, i) => {
    const data = JSON.parse(s.valor);
    console.log(`\n#${i+1} - ${s.createdAt}`);
    console.log(`  exito: ${data.exito}`);
    console.log(`  error: ${data.error || 'ninguno'}`);
    console.log(`  ip: ${data.ip}`);
    console.log(`  emailDestino: ${data.emailDestino}`);
  });
}

await client.end();
