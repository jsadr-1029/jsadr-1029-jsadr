// =====================================================
// Crea el registro de SOAT para el vehículo DLW357
// con todos los datos del certificado expedido por
// AXA Colpatria Seguros S.A.
// Vigencia: 5 enero 2026 - 4 enero 2027
// =====================================================
const { Client } = require('pg');
require('dotenv').config({ path: '/home/z/my-project/.env' });

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado a Neon\n');

  // 1. Buscar el vehículo DLW357
  const vehQ = await client.query(`SELECT id, placa FROM "Vehiculo" WHERE placa = 'DLW357' LIMIT 1`);
  if (vehQ.rows.length === 0) {
    console.log('✗ Vehículo DLW357 no encontrado');
    await client.end();
    return;
  }
  const vehiculo = vehQ.rows[0];
  console.log('✓ Vehículo DLW357 encontrado:', vehiculo.id);

  // 2. Datos del SOAT
  const NUM_POLIZA = '3495589400';
  const ENTIDAD_EMISORA = 'AXA Colpatria Seguros S.A.';
  const FECHA_EMISION = '2025-12-30T00:00:00-05:00';
  const FECHA_INICIO = '2026-01-05T00:00:00-05:00';
  const FECHA_VENCIMIENTO = '2027-01-04T00:00:00-05:00';

  // 3. Verificar si ya existe un SOAT con este número
  const docQ = await client.query(`
    SELECT id FROM "DocumentoVehiculo"
    WHERE "vehiculoId" = $1 AND tipo = 'SOAT' AND numero = $2
    LIMIT 1
  `, [vehiculo.id, NUM_POLIZA]);

  const archivoUrl = '/vehiculos/documentos/soat-dlw357.jpg';
  const archivosExtra = JSON.stringify([]); // Solo una foto por ahora

  const notas = `SEGURO OBLIGATORIO DE ACCIDENTES DE TRÁNSITO (SOAT)

ASEGURADORA Y PÓLIZA:
- Aseguradora: AXA Colpatria Seguros S.A.
- Número de póliza: 3495589400
- Número de formulario: 3495589400
- Código de la aseguradora: 1306
- Código de sucursal expedidora: 26
- Clave del productor: 57790405
- Tarifa: 552

VIGENCIA:
- Fecha de expedición: 30 de diciembre de 2025
- Fecha de inicio de vigencia: 5 de enero de 2026
- Fecha de vencimiento: 4 de enero de 2027

DATOS DEL VEHÍCULO ASEGURADO:
- Placa: DLW357
- Marca: Ford
- Línea: Fiesta
- Clase de vehículo: Automóvil
- Tipo de vehículo: Autos familiares
- Modelo: 2012
- Servicio: Particular
- Cilindraje: 1.597 c.c.
- Capacidad: 5 pasajeros
- Número de motor: CM133391
- Número de chasis: CM133391
- VIN indicado en SOAT: CM133391000000000

DATOS DEL TOMADOR DEL SEGURO:
- Apellidos y nombres: Guerrero Guerrero, Humberto José
- Tipo de documento: Cédula de ciudadanía (CC)
- Número de documento: 1037673099
- Teléfono: 3162289526
- Ciudad de residencia: Guarne

INFORMACIÓN ECONÓMICA:
- Prima SOAT: $442.500
- Contribución FOSYGA: $230.100
- Tasa RUNT: $2.400
- Total pagado: $675.000

COBERTURAS DEL SOAT:
1. Gastos médicos, quirúrgicos, farmacéuticos y hospitalarios
2. Gastos de transporte y movilización de las víctimas (hasta 8,77 UVT)
3. Indemnización por incapacidad permanente (hasta 180 SMLDV)
4. Indemnización por muerte de la víctima
5. Gastos funerarios

LÍMITES DE COBERTURA (según certificado):
- Gastos médicos: 263,13 UVT y 701,68 UVT (según tarifa aplicable)
- Transporte y movilización: hasta 8,77 UVT
- Incapacidad permanente: hasta 750 SMLDV
- Muerte y gastos funerarios: hasta 750 SMLDV

PROCEDIMIENTO EN CASO DE ACCIDENTE:
1. Atender la emergencia (prioridad: vida)
2. Identificar vehículo y póliza (DLW357 - AXA Colpatria - Póliza 3495589400)
3. Recopilar documentos del accidente
4. Gestionar atención médica
5. Determinar indemnización adicional si aplica
6. Presentar reclamación ante AXA Colpatria
7. Hacer seguimiento

EXCLUSIONES (no cubre el SOAT):
- Reparación de daños del propio vehículo
- Daños materiales a otros automóviles
- Daños a viviendas, locales, postes, muros
- Pérdida de ingresos durante recuperación
- Perjuicios que excedan límites legales

NOTA: La persona que figura como tomadora del SOAT (Humberto José Guerrero) no necesariamente coincide con el propietario registrado en la licencia de tránsito.`;

  if (docQ.rows.length > 0) {
    const docId = docQ.rows[0].id;
    console.log(`→ Actualizando SOAT existente id=${docId}...`);
    await client.query(`
      UPDATE "DocumentoVehiculo"
      SET numero = $1, "fechaEmision" = $2, "fechaVencimiento" = $3,
          "entidadEmisora" = $4, "archivoUrl" = $5, "archivosExtra" = $6,
          estado = 'VIGENTE', notas = $7, "updatedAt" = NOW()
      WHERE id = $8
    `, [NUM_POLIZA, FECHA_EMISION, FECHA_VENCIMIENTO, ENTIDAD_EMISORA, archivoUrl, archivosExtra, notas, docId]);
    console.log('✓ SOAT actualizado');
  } else {
    console.log('→ Creando nuevo documento SOAT...');
    const insertRes = await client.query(`
      INSERT INTO "DocumentoVehiculo" (
        id, "vehiculoId", tipo, numero, "fechaEmision", "fechaVencimiento",
        "entidadEmisora", "archivoUrl", "archivosExtra", estado, notas,
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, 'SOAT', $2, $3, $4,
        $5, $6, $7, 'VIGENTE', $8, NOW(), NOW()
      ) RETURNING id
    `, [vehiculo.id, NUM_POLIZA, FECHA_EMISION, FECHA_VENCIMIENTO, ENTIDAD_EMISORA, archivoUrl, archivosExtra, notas]);
    console.log('✓ SOAT creado, id=', insertRes.rows[0].id);
  }

  // 4. Verificar
  const verif = await client.query(`
    SELECT id, tipo, numero, "entidadEmisora", "fechaVencimiento", "archivoUrl", "archivosExtra"
    FROM "DocumentoVehiculo"
    WHERE "vehiculoId" = $1
    ORDER BY "createdAt" DESC
  `, [vehiculo.id]);
  console.log('\nDocumentos del vehículo DLW357:');
  for (const r of verif.rows) {
    console.log(`  - ${r.tipo} | N° ${r.numero} | ${r.entidadEmisora} | vence: ${r.fechaVencimiento}`);
    if (r.archivoUrl) console.log(`    archivoUrl: ${r.archivoUrl}`);
    if (r.archivosExtra) console.log(`    archivosExtra: ${r.archivosExtra}`);
  }

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
