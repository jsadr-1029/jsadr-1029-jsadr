// Carga las 10 fotos del HVZ157 como items de inventario en Neon
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const fotos = [
  { n: 'Vista frontal del vehículo', foto: '/vehiculos/hvz157/foto-1.jpg', estado: 'BUENO', desc: 'Vista frontal del Ford Fiesta rojo placa HVZ157' },
  { n: 'Vista trasera del vehículo', foto: '/vehiculos/hvz157/foto-2.jpg', estado: 'BUENO', desc: 'Vista trasera con placa HVZ157 Bucaramanga' },
  { n: 'Vista lateral izquierda', foto: '/vehiculos/hvz157/foto-3.jpg', estado: 'BUENO', desc: 'Vista lateral del vehículo estacionado' },
  { n: 'Tablero y kilometraje', foto: '/vehiculos/hvz157/foto-4.jpg', estado: 'BUENO', desc: 'Tablero con 163.358 km, temperatura 28°C' },
  { n: 'Interior - consola central', foto: '/vehiculos/hvz157/foto-5.jpg', estado: 'BUENO', desc: 'Radio, pantalla y controles del aire acondicionado' },
  { n: 'Interior - consola central 2', foto: '/vehiculos/hvz157/foto-6.jpg', estado: 'BUENO', desc: 'Vista de consola con botones RADIO/MEDIA/PHONE' },
  { n: 'Interior - puerta pasajero', foto: '/vehiculos/hvz157/foto-7.jpg', estado: 'BUENO', desc: 'Panel de puerta del lado del pasajero' },
  { n: 'Interior - tablero pasajero', foto: '/vehiculos/hvz157/foto-8.jpg', estado: 'BUENO', desc: 'Guantera y zona del pasajero con airbag' },
  { n: 'Interior - puerta trasera', foto: '/vehiculos/hvz157/foto-9.jpg', estado: 'BUENO', desc: 'Panel de puerta trasera con controles' },
  { n: 'Vista lateral derecha', foto: '/vehiculos/hvz157/foto-10.jpg', estado: 'BUENO', desc: 'Vista lateral derecha del vehículo' },
];

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Buscar el vehículo HVZ157
  const vehRes = await client.query('SELECT id FROM "Vehiculo" WHERE placa = $1', ['HVZ157']);
  if (vehRes.rows.length === 0) {
    console.log('✗ Vehículo HVZ157 no encontrado');
    await client.end();
    return;
  }
  const vehiculoId = vehRes.rows[0].id;
  console.log('✓ Vehículo HVZ157 encontrado, ID:', vehiculoId);

  // Insertar cada foto como item de inventario
  for (const f of fotos) {
    await client.query(`
      INSERT INTO "InventarioVehiculo" (
        id, "vehiculoId", nombre, descripcion, cantidad, estado, "fotoUrl", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 1, $4, $5, NOW(), NOW()
      )
    `, [vehiculoId, f.n, f.desc, f.estado, f.foto]);
    console.log(`  ✓ ${f.n} agregada`);
  }

  // Verificar
  const count = await client.query('SELECT COUNT(*)::int as n FROM "InventarioVehiculo" WHERE "vehiculoId" = $1', [vehiculoId]);
  console.log(`\nTotal items de inventario para HVZ157: ${count.rows[0].n}`);

  await client.end();
  console.log('=== COMPLETADO ===');
}

main().catch(e => { console.error(e); process.exit(1); });
