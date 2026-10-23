// =====================================================
// Agrega la columna archivosExtra a DocumentoVehiculo en Neon
// y ejecuta el seed de tecnomecánica para DLW357.
// =====================================================
const { Client } = require('pg');
require('dotenv').config({ path: '/home/z/my-project/.env' });

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado a Neon\n');

  // 1. Verificar si la columna archivosExtra existe
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'DocumentoVehiculo' AND column_name = 'archivosExtra'
  `);
  if (colCheck.rows.length > 0) {
    console.log('✓ Columna archivosExtra ya existe en DocumentoVehiculo');
  } else {
    console.log('→ Agregando columna archivosExtra...');
    await client.query(`ALTER TABLE "DocumentoVehiculo" ADD COLUMN "archivosExtra" TEXT;`);
    console.log('✓ Columna archivosExtra agregada');
  }

  // 2. Buscar el vehículo DLW357
  const vehQ = await client.query(`SELECT id, placa, marca, modelo, motor, vin, color FROM "Vehiculo" WHERE placa = 'DLW357' LIMIT 1`);
  if (vehQ.rows.length === 0) {
    console.log('✗ Vehículo DLW357 no encontrado en Neon');
    await client.end();
    return;
  }
  const vehiculo = vehQ.rows[0];
  console.log('✓ Vehículo DLW357 encontrado:', vehiculo);

  // 3. Ver si ya existe el documento de tecnomecánica con este número
  const num = '186227880';
  const docQ = await client.query(`
    SELECT id FROM "DocumentoVehiculo"
    WHERE "vehiculoId" = $1 AND tipo = 'TECNOMECANICA' AND numero = $2
    LIMIT 1
  `, [vehiculo.id, num]);

  const archivoUrl = '/vehiculos/documentos/tecnomecanica-dlw357-frente.jpg';
  const archivosExtra = JSON.stringify(['/vehiculos/documentos/tecnomecanica-dlw357-reverso.jpg']);
  const notas = `CERTIFICADO DE REVISIÓN TÉCNICO-MECÁNICA Y DE EMISIONES CONTAMINANTES
Entidad expedidora: C.D.A. Ciudad Bonita S.A.S.
NIT: 900198494
Número de acreditación: 10-OIN-078-001
Autoridad nacional: Ministerio de Transporte de la República de Colombia
Certificado emitido bajo el sistema RUNT

DATOS DEL VEHÍCULO SEGÚN CERTIFICADO:
- Placa: DLW357
- Marca: Ford
- Línea: Fiesta
- Clase: Automóvil
- Modelo: 2012
- Servicio: Particular
- Color: Blanco Oxford
- Cilindraje: 1.597 c.c.
- Combustible: Gasolina
- Motor: CM133391
- Chasis: CM133391
- VIN: 3FADP4BJ0CM133391
- Propietario registrado: Humberto J. Guerrero G.`;

  const fechaEmision = '2025-12-19T00:00:00-05:00';
  const fechaVenc = '2026-12-19T00:00:00-05:00';

  if (docQ.rows.length > 0) {
    const docId = docQ.rows[0].id;
    console.log(`→ Actualizando documento existente id=${docId}...`);
    await client.query(`
      UPDATE "DocumentoVehiculo"
      SET numero = $1, "fechaEmision" = $2, "fechaVencimiento" = $3,
          "entidadEmisora" = $4, "archivoUrl" = $5, "archivosExtra" = $6,
          estado = 'VIGENTE', notas = $7, "updatedAt" = NOW()
      WHERE id = $8
    `, [num, fechaEmision, fechaVenc, 'C.D.A. Ciudad Bonita S.A.S.', archivoUrl, archivosExtra, notas, docId]);
    console.log('✓ Documento actualizado');
  } else {
    console.log('→ Creando nuevo documento de tecnomecánica...');
    const insertRes = await client.query(`
      INSERT INTO "DocumentoVehiculo" (
        id, "vehiculoId", tipo, numero, "fechaEmision", "fechaVencimiento",
        "entidadEmisora", "archivoUrl", "archivosExtra", estado, notas,
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, 'TECNOMECANICA', $2, $3, $4,
        $5, $6, $7, 'VIGENTE', $8, NOW(), NOW()
      ) RETURNING id
    `, [vehiculo.id, num, fechaEmision, fechaVenc, 'C.D.A. Ciudad Bonita S.A.S.', archivoUrl, archivosExtra, notas]);
    console.log('✓ Documento creado, id=', insertRes.rows[0].id);
  }

  // 4. Actualizar ficha técnica del vehículo (motor, VIN, color)
  const updates = [];
  if (vehiculo.motor !== 'CM133391') updates.push(['motor', 'CM133391']);
  if (vehiculo.vin !== '3FADP4BJ0CM133391') updates.push(['vin', '3FADP4BJ0CM133391']);
  if (vehiculo.color !== 'Blanco Oxford') updates.push(['color', 'Blanco Oxford']);
  if (updates.length > 0) {
    console.log(`→ Actualizando vehículo con ${updates.length} campos:`, updates.map(u => u[0]));
    const setClause = updates.map((u, i) => `"${u[0]}" = $${i + 1}`).join(', ');
    await client.query(`UPDATE "Vehiculo" SET ${setClause}, "updatedAt" = NOW() WHERE id = $${updates.length + 1}`, [...updates.map(u => u[1]), vehiculo.id]);
    console.log('✓ Vehículo actualizado');
  } else {
    console.log('✓ Vehículo ya tiene los datos correctos');
  }

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
