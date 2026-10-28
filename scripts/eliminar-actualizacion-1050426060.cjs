// Elimina la solicitud de actualización de datos para el cliente 1050426060
// (Luz enith Ortega) marcando datosActualizadosOct2026 = true
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cedula = '1050426060';

  // Estado antes
  const antes = await client.query(`
    SELECT nombre, cedula, "datosActualizadosOct2026", "fechaActualizacionDatos"
    FROM "Cliente" WHERE cedula = $1
  `, [cedula]);
  console.log('=== ANTES ===');
  console.log('  Nombre:', antes.rows[0].nombre);
  console.log('  Cédula:', antes.rows[0].cedula);
  console.log('  datosActualizadosOct2026:', antes.rows[0].datosActualizadosOct2026);
  console.log('  fechaActualizacionDatos:', antes.rows[0].fechaActualizacionDatos);

  // Actualizar: marcar como datos actualizados
  await client.query(`
    UPDATE "Cliente"
    SET "datosActualizadosOct2026" = true,
        "fechaActualizacionDatos" = NOW(),
        "updatedAt" = NOW()
    WHERE cedula = $1
  `, [cedula]);

  console.log('\n✓ Actualización marcada como completada para el cliente.');

  // Estado después
  const despues = await client.query(`
    SELECT nombre, cedula, "datosActualizadosOct2026", "fechaActualizacionDatos"
    FROM "Cliente" WHERE cedula = $1
  `, [cedula]);
  console.log('\n=== DESPUÉS ===');
  console.log('  Nombre:', despues.rows[0].nombre);
  console.log('  Cédula:', despues.rows[0].cedula);
  console.log('  datosActualizadosOct2026:', despues.rows[0].datosActualizadosOct2026);
  console.log('  fechaActualizacionDatos:', despues.rows[0].fechaActualizacionDatos);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
