import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Cancelar el crédito anterior VPS-CC-1038627025-20260822-01
// ya que el nuevo VPS-CC-1038627025-20260915-02 ya está ACTIVO
const anteriorId = 'cmt59ogx40001kw044z8m8l0v';
const nuevoId = 'cmu4m44v40003jq04z405frl5';
const nuevoCodigo = 'VPS-CC-1038627025-20260915-02';

// 1. Cancelar el crédito anterior
const update = await client.query(`
  UPDATE "Prestamo"
  SET estado = 'CANCELADO',
      "saldoCapital" = 0,
      "saldoInteres" = 0,
      "saldoTotal" = 0,
      "fechaCancelacion" = NOW(),
      notas = COALESCE(notas, '') || '\\n\\nFinalizado por renovación - nuevo solicitud: ${nuevoCodigo} (cancelación automática)',
      "updatedAt" = NOW()
  WHERE id = $1
  RETURNING codigo, estado, "saldoTotal"
`, [anteriorId]);
console.log('=== CRÉDITO ANTERIOR CANCELADO ===');
console.log(JSON.stringify(update.rows[0], null, 2));

// 2. Marcar el nuevo como ya no pendiente de TyC para renovación
const updateNuevo = await client.query(`
  UPDATE "Prestamo"
  SET "renovacionPendienteTyc" = false,
      "renovacionFechaCancelacionAnterior" = NOW(),
      "updatedAt" = NOW()
  WHERE id = $1
  RETURNING codigo, "renovacionPendienteTyc", "renovacionFechaCancelacionAnterior"
`, [nuevoId]);
console.log('\n=== CRÉDITO NUEVO ACTUALIZADO ===');
console.log(JSON.stringify(updateNuevo.rows[0], null, 2));

// 3. Crear bitácora del crédito anterior
await client.query(`
  INSERT INTO "BitacoraPrestamo" (
    id, "prestamoId", "prestamoCodigo", "usuarioNombre", tipo, titulo,
    descripcion, resultado, "fechaEvento", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, $1, 'VPS-CC-1038627025-20260822-01', 'Sistema', 'OTRO',
    'CRÉDITO CANCELADO POR RENOVACIÓN',
    'Este crédito fue finalizado (CANCELADO) porque se activó la renovación VPS-CC-1038627025-20260915-02.\\n\\n• Saldo cancelado: $345.000\\n• Estado: CANCELADO\\n• Fecha: ' || NOW()::text,
    'Cancelado → renovación VPS-CC-1038627025-20260915-02',
    NOW(), NOW()
  )
`, [anteriorId]);
console.log('\n✓ Bitácora del anterior creada');

// 4. Crear bitácora del crédito nuevo
await client.query(`
  INSERT INTO "BitacoraPrestamo" (
    id, "prestamoId", "prestamoCodigo", "usuarioNombre", tipo, titulo,
    descripcion, resultado, "fechaEvento", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, $1, 'VPS-CC-1038627025-20260915-02', 'Sistema', 'OTRO',
    'CRÉDITO ANTERIOR CANCELADO POR RENOVACIÓN',
    'El crédito anterior VPS-CC-1038627025-20260822-01 fue CANCELADO automáticamente al activarse esta renovación.\\n\\n• Saldo pendiente cancelado: $345.000\\n• Fecha: ' || NOW()::text,
    'Crédito anterior cancelado',
    NOW(), NOW()
  )
`, [nuevoId]);
console.log('✓ Bitácora del nuevo creada');

await client.end();
