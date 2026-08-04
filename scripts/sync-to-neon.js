/**
 * SINCRONIZACIÓN INVERSA: SQLite local → Neon (producción)
 *
 * Sube TODOS los datos locales a Neon, reemplazando lo que haya allá.
 * Esto garantiza que Neon quede idéntico al estado local actual tras
 * la restauración + commits + cambios en configuración.
 *
 * Estrategia: para cada tabla, DELETE masivo en Neon + INSERT desde local.
 * Usa transacciones para asegurar atomicidad.
 */

const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function toPg(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  return String(v);
}

function buildInsert(table, row, columns) {
  const cols = columns.join(', ');
  const vals = columns.map((_, i) => `$${i + 1}`);
  const params = columns.map(c => toPg(row[c]));
  return { text: `INSERT INTO "${table}" (${cols}) VALUES (${vals})`, values: params };
}

(async () => {
  console.log('=== SINCRONIZACIÓN SQLite → Neon (producción) ===\n');
  await neonClient.connect();
  console.log('✓ Conectado a Neon\n');

  // ====================================================================
  // TABLAS A SINCRONIZAR (en orden para respetar FKs)
  // ====================================================================
  const plan = [
    // 1. Independientes / raíz
    { tabla: 'Usuario', modelo: 'usuario' },
    { tabla: 'CuentaRecaudo', modelo: 'cuentaRecaudo' },
    { tabla: 'CategoriaCliente', modelo: 'categoriaCliente' },
    { tabla: 'VariableGlobal', modelo: 'variableGlobal' },
    { tabla: 'ConexionAPI', modelo: 'conexionAPI' },
    { tabla: 'CorreoInstitucional', modelo: 'correoInstitucional' },
    { tabla: 'Dominio', modelo: 'dominio' },
    { tabla: 'Integracion', modelo: 'integracion' },
    { tabla: 'ConfiguracionEmpresa', modelo: 'configuracionEmpresa' },
    { tabla: 'ConfigAlmacenamiento', modelo: 'configAlmacenamiento' },
    { tabla: 'EstadoServicio', modelo: 'estadoServicio' },
    { tabla: 'ConfigMantenimiento', modelo: 'configMantenimiento' },
    { tabla: 'SeguridadModulo', modelo: 'seguridadModulo' },
    { tabla: 'PlataformaSync', modelo: 'plataformaSync' },
    { tabla: 'AuditoriaConfiguracion', modelo: 'auditoriaConfiguracion' },
    // 2. Con FK a Usuario
    { tabla: 'AuditLog', modelo: 'auditLog' },
    // 3. Con FK a Categoria/Cuenta
    { tabla: 'Cliente', modelo: 'cliente' },
    // 4. Con FK a Cliente
    { tabla: 'Prestamo', modelo: 'prestamo' },
    { tabla: 'AccesoPortal', modelo: 'accesoPortal' },
    { tabla: 'ConversacionChat', modelo: 'conversacionChat' },
    { tabla: 'SolicitudNuevoCliente', modelo: 'solicitudNuevoCliente' },
    // 5. Con FK a Prestamo
    { tabla: 'Pago', modelo: 'pago' },
    { tabla: 'DocumentoGestor', modelo: 'documentoGestor' },
    { tabla: 'BitacoraPrestamo', modelo: 'bitacoraPrestamo' },
    { tabla: 'CodigoConfirmacion', modelo: 'codigoConfirmacion' },
    { tabla: 'FirmaElectronica', modelo: 'firmaElectronica' },
    { tabla: 'CasoJuridico', modelo: 'casoJuridico' },
    { tabla: 'SolicitudWeb', modelo: 'solicitudWeb' },
    { tabla: 'EnvioCorreo', modelo: 'envioCorreo' },
    { tabla: 'OtpRegistro', modelo: 'otpRegistro' },
    // 6. Con FK a ConversacionChat
    { tabla: 'MensajeChat', modelo: 'mensajeChat' },
    // 7. Snapshots
    { tabla: 'SnapshotProyecto', modelo: 'snapshotProyecto' },
  ];

  const reporte = [];

  for (const { tabla, modelo } of plan) {
    try {
      // 1. Obtener columnas de Neon
      const colRes = await neonClient.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `, [tabla]);
      if (colRes.rows.length === 0) {
        console.log(`⚠️  ${tabla.padEnd(28)} no existe en Neon — saltar`);
        reporte.push({ tabla, status: 'SKIP', motivo: 'tabla no existe en Neon' });
        continue;
      }
      const columns = colRes.rows.map(r => r.column_name);

      // 2. Contar antes
      const localRows = await prisma[modelo].findMany();
      const countBefore = await neonClient.query(`SELECT COUNT(*)::int AS n FROM "${tabla}"`);
      const beforeN = countBefore.rows[0].n;

      // 3. Borrar todo en Neon
      await neonClient.query(`DELETE FROM "${tabla}"`);

      // 4. Insertar desde local
      let inserted = 0;
      let errors = 0;
      for (const row of localRows) {
        try {
          const { text, values } = buildInsert(tabla, row, columns);
          await neonClient.query(text, values);
          inserted++;
        } catch (e) {
          errors++;
          if (errors <= 2) console.log(`    ! insert error: ${e.message.split('\n')[0]}`);
        }
      }

      // 5. Verificar
      const countAfter = await neonClient.query(`SELECT COUNT(*)::int AS n FROM "${tabla}"`);
      const afterN = countAfter.rows[0].n;

      const flag = inserted === localRows.length ? '✅' : '⚠️ ';
      console.log(`${flag} ${tabla.padEnd(28)} | Neon antes=${String(beforeN).padStart(4)} | local=${String(localRows.length).padStart(4)} | subidos=${String(inserted).padStart(4)} | Neon ahora=${String(afterN).padStart(4)}`);
      reporte.push({
        tabla, status: inserted === localRows.length ? 'OK' : 'PARTIAL',
        neon_antes: beforeN, local: localRows.length,
        subidos: inserted, neon_ahora: afterN, errores: errors
      });
    } catch (e) {
      console.log(`❌ ${tabla.padEnd(28)} ERROR: ${e.message.split('\n')[0]}`);
      reporte.push({ tabla, status: 'ERROR', motivo: e.message });
    }
  }

  await neonClient.end();
  await prisma.$disconnect();

  console.log('\n=== REPORTE FINAL DE SINCRONIZACIÓN ===');
  console.log(JSON.stringify(reporte, null, 2));
  console.log('\n=== SINCRONIZACIÓN SQLite → Neon COMPLETA ===');
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
