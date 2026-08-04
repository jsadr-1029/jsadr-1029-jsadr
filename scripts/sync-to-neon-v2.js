/**
 * SINCRONIZACIÓN INVERSA v2: SQLite local → Neon (producción)
 * Corrige:
 *   - Columnas quoted para preservar camelCase
 *   - TRUNCATE ... CASCADE para evitar errores de FK RESTRICT
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
  // Quote column names to preserve camelCase
  const cols = columns.map(c => `"${c}"`).join(', ');
  const vals = columns.map((_, i) => `$${i + 1}`);
  const params = columns.map(c => toPg(row[c]));
  return { text: `INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`, values: params };
}

(async () => {
  console.log('=== SINCRONIZACIÓN v2 SQLite → Neon ===\n');
  await neonClient.connect();
  console.log('✓ Conectado a Neon\n');

  const plan = [
    'Usuario', 'CuentaRecaudo', 'CategoriaCliente', 'VariableGlobal',
    'ConexionAPI', 'CorreoInstitucional', 'Dominio', 'Integracion',
    'ConfiguracionEmpresa', 'ConfigAlmacenamiento', 'EstadoServicio',
    'ConfigMantenimiento', 'SeguridadModulo', 'PlataformaSync',
    'AuditoriaConfiguracion', 'AuditLog',
    'Cliente', 'Prestamo', 'AccesoPortal', 'ConversacionChat',
    'SolicitudNuevoCliente',
    'Pago', 'DocumentoGestor', 'BitacoraPrestamo', 'CodigoConfirmacion',
    'FirmaElectronica', 'CasoJuridico', 'SolicitudWeb',
    'EnvioCorreo', 'OtpRegistro', 'MensajeChat', 'SnapshotProyecto',
  ];

  const modelMap = {
    Usuario: 'usuario', CuentaRecaudo: 'cuentaRecaudo', CategoriaCliente: 'categoriaCliente',
    VariableGlobal: 'variableGlobal', ConexionAPI: 'conexionAPI',
    CorreoInstitucional: 'correoInstitucional', Dominio: 'dominio', Integracion: 'integracion',
    ConfiguracionEmpresa: 'configuracionEmpresa', ConfigAlmacenamiento: 'configAlmacenamiento',
    EstadoServicio: 'estadoServicio', ConfigMantenimiento: 'configMantenimiento',
    SeguridadModulo: 'seguridadModulo', PlataformaSync: 'plataformaSync',
    AuditoriaConfiguracion: 'auditoriaConfiguracion', AuditLog: 'auditLog',
    Cliente: 'cliente', Prestamo: 'prestamo', AccesoPortal: 'accesoPortal',
    ConversacionChat: 'conversacionChat', SolicitudNuevoCliente: 'solicitudNuevoCliente',
    Pago: 'pago', DocumentoGestor: 'documentoGestor', BitacoraPrestamo: 'bitacoraPrestamo',
    CodigoConfirmacion: 'codigoConfirmacion', FirmaElectronica: 'firmaElectronica',
    CasoJuridico: 'casoJuridico', SolicitudWeb: 'solicitudWeb',
    EnvioCorreo: 'envioCorreo', OtpRegistro: 'otpRegistro',
    MensajeChat: 'mensajeChat', SnapshotProyecto: 'snapshotProyecto',
  };

  const reporte = [];

  for (const tabla of plan) {
    try {
      const modelo = modelMap[tabla];
      const colRes = await neonClient.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `, [tabla]);
      if (colRes.rows.length === 0) {
        console.log(`⚠️  ${tabla.padEnd(28)} no existe en Neon`);
        reporte.push({ tabla, status: 'SKIP_NO_TABLE' });
        continue;
      }
      const columns = colRes.rows.map(r => r.column_name);

      const localRows = await prisma[modelo].findMany();
      const countBefore = await neonClient.query(`SELECT COUNT(*)::int AS n FROM "${tabla}"`);
      const beforeN = countBefore.rows[0].n;

      // TRUNCATE con CASCADE para evitar FK RESTRICT
      await neonClient.query(`TRUNCATE TABLE "${tabla}" CASCADE`);

      let inserted = 0;
      let errors = 0;
      const errorSamples = [];
      for (const row of localRows) {
        try {
          const { text, values } = buildInsert(tabla, row, columns);
          await neonClient.query(text, values);
          inserted++;
        } catch (e) {
          errors++;
          if (errorSamples.length < 2) errorSamples.push(e.message.split('\n')[0]);
        }
      }

      const countAfter = await neonClient.query(`SELECT COUNT(*)::int AS n FROM "${tabla}"`);
      const afterN = countAfter.rows[0].n;

      const flag = inserted === localRows.length ? '✅' : '⚠️ ';
      console.log(`${flag} ${tabla.padEnd(28)} | antes=${String(beforeN).padStart(4)} | local=${String(localRows.length).padStart(4)} | subidos=${String(inserted).padStart(4)} | ahora=${String(afterN).padStart(4)}${errors ? ` | err=${errors}` : ''}`);
      if (errorSamples.length) errorSamples.forEach(s => console.log(`    ! ${s}`));

      reporte.push({
        tabla, status: inserted === localRows.length ? 'OK' : 'PARTIAL',
        neon_antes: beforeN, local: localRows.length,
        subidos: inserted, neon_ahora: afterN, errores: errors,
        error_muestras: errorSamples
      });
    } catch (e) {
      console.log(`❌ ${tabla.padEnd(28)} ERROR: ${e.message.split('\n')[0]}`);
      reporte.push({ tabla, status: 'ERROR', motivo: e.message });
    }
  }

  await neonClient.end();
  await prisma.$disconnect();

  // Guardar reporte
  const fs = require('fs');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = `/home/z/my-project/download/reporte-sync-neon-${ts}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    fecha: new Date().toISOString(),
    direccion: 'SQLite local → Neon produccion',
    detalle: reporte
  }, null, 2));
  console.log(`\n📄 Reporte guardado: ${reportPath}`);
  console.log('\n=== SINCRONIZACIÓN COMPLETA ===');
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
