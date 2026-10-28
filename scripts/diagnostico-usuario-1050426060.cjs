// Diagnóstico: inspecciona el usuario con cédula 1050426060
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Buscar en tabla Usuario (sistema principal)
  console.log('=== BÚSQUEDA EN TABLA Usuario ===');
  const usuarioRes = await client.query(`
    SELECT *
    FROM "Usuario"
    WHERE cedula = $1 OR username = $1
    LIMIT 5
  `, ['1050426060']);

  if (usuarioRes.rows.length === 0) {
    console.log('  No se encontró en tabla Usuario');
  } else {
    for (const u of usuarioRes.rows) {
      console.log('  ID:', u.id);
      console.log('  Nombre:', u.nombre);
      console.log('  Cédula:', u.cedula);
      console.log('  Username:', u.username);
      console.log('  Email:', u.email);
      console.log('  Teléfono:', u.telefono);
      console.log('  Rol:', u.rol);
      console.log('  Activo:', u.activo);
      console.log('  debeCambiarClave:', u.debeCambiarClave);
      console.log('  claveTemporal:', u.claveTemporal);
      console.log('  fechaUltimoLogin:', u.fechaUltimoLogin);
      console.log('  fechaCreacion:', u.fechaCreacion);
    }
  }

  // Buscar en tabla Cliente
  console.log('\n=== BÚSQUEDA EN TABLA Cliente ===');
  const clienteRes = await client.query(`
    SELECT *
    FROM "Cliente"
    WHERE cedula = $1
    LIMIT 5
  `, ['1050426060']);

  if (clienteRes.rows.length === 0) {
    console.log('  No se encontró en tabla Cliente');
  } else {
    for (const c of clienteRes.rows) {
      console.log('  ID:', c.id);
      console.log('  Nombre:', c.nombre);
      console.log('  Cédula:', c.cedula);
      console.log('  Email:', c.email);
      console.log('  Teléfono:', c.telefono);
      console.log('  Activo:', c.activo);
      console.log('  debeCambiarClave:', c.debeCambiarClave);
      console.log('  claveTemporal:', c.claveTemporal);
      console.log('  fechaUltimoLogin:', c.fechaUltimoLogin);
      console.log('  fechaRegistro:', c.fechaRegistro);
    }
  }

  // Buscar en SolicitudNuevosClientes (registro pendiente)
  console.log('\n=== BÚSQUEDA EN SolicitudNuevosClientes ===');
  const solicitudRes = await client.query(`
    SELECT id, codigo, nombre, cedula, email, telefono, estado,
           "fechaSolicitud", "fechaActualizacion"
    FROM "SolicitudNuevosClientes"
    WHERE cedula = $1
    ORDER BY "fechaSolicitud" DESC
    LIMIT 5
  `, ['1050426060']);

  if (solicitudRes.rows.length === 0) {
    console.log('  No se encontró en SolicitudNuevosClientes');
  } else {
    for (const s of solicitudRes.rows) {
      console.log('  ID:', s.id);
      console.log('  Código:', s.codigo);
      console.log('  Nombre:', s.nombre);
      console.log('  Cédula:', s.cedula);
      console.log('  Email:', s.email);
      console.log('  Estado:', s.estado);
      console.log('  fechaSolicitud:', s.fechaSolicitud);
    }
  }

  await client.end();
  console.log('\n=== DIAGNÓSTICO COMPLETADO ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
