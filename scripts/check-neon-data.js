const { Client } = require('pg');

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await neonClient.connect();
    console.log('✓ Conectado a Neon PostgreSQL\n');

    const tablas = [
      'DocumentoGestor', 'SolicitudWeb', 'SolicitudNuevoCliente',
      'ConversacionChat', 'MensajeChat', 'CasoJuridico',
      'Integracion', 'BitacoraPrestamo', 'CodigoConfirmacion',
      'FirmaElectronica', 'SnapshotProyecto',
      'Cliente', 'Prestamo', 'Pago', 'Usuario',
      'VariableGlobal', 'ConexionAPI', 'CorreoInstitucional',
      'CuentaRecaudo', 'CategoriaCliente', 'AccesoPortal',
      'EnvioCorreo', 'AuditLog', 'AuditoriaConfiguracion'
    ];

    console.log('=== CONTEO DE REGISTROS EN NEON POR TABLA ===\n');
    for (const tabla of tablas) {
      try {
        const r = await neonClient.query(`SELECT COUNT(*)::int AS n FROM "${tabla}"`);
        const n = r.rows[0].n;
        const flag = n > 0 ? '✅' : '⚠️ ';
        console.log(`${flag} ${tabla.padEnd(28)} = ${n}`);
      } catch (e) {
        console.log(`❌ ${tabla.padEnd(28)} -> ${e.message.split('\n')[0]}`);
      }
    }

    // Si hay documentos, mostrar muestra
    console.log('\n=== MUESTRA: DocumentoGestor ===');
    try {
      const r = await neonClient.query(`SELECT id, "prestamoId", tipo, nombreArchivo, "createdAt" FROM "DocumentoGestor" ORDER BY "createdAt" DESC LIMIT 20`);
      console.log(`Total muestra: ${r.rows.length}`);
      r.rows.forEach(d => console.log(`  • ${d.id} | prest=${d.prestamoId} | ${d.tipo} | ${d.nombreArchivo} | ${d.createdAt}`));
    } catch (e) { console.log('  Error:', e.message); }

    // Si hay solicitudes web
    console.log('\n=== MUESTRA: SolicitudWeb ===');
    try {
      const r = await neonClient.query(`SELECT id, nombre, email, telefono, estado, "createdAt" FROM "SolicitudWeb" ORDER BY "createdAt" DESC LIMIT 20`);
      console.log(`Total muestra: ${r.rows.length}`);
      r.rows.forEach(d => console.log(`  • ${d.id} | ${d.nombre} | ${d.email} | ${d.telefono} | ${d.estado} | ${d.createdAt}`));
    } catch (e) { console.log('  Error:', e.message); }

    // Si hay chats
    console.log('\n=== MUESTRA: ConversacionChat ===');
    try {
      const r = await neonClient.query(`SELECT id, "clienteId", asunto, estado, "createdAt" FROM "ConversacionChat" ORDER BY "createdAt" DESC LIMIT 20`);
      console.log(`Total muestra: ${r.rows.length}`);
      r.rows.forEach(d => console.log(`  • ${d.id} | cliente=${d.clienteId} | ${d.asunto} | ${d.estado} | ${d.createdAt}`));
    } catch (e) { console.log('  Error:', e.message); }

    // MensajeChat
    console.log('\n=== MUESTRA: MensajeChat ===');
    try {
      const r = await neonClient.query(`SELECT id, "conversacionId", remitente, contenido, "createdAt" FROM "MensajeChat" ORDER BY "createdAt" DESC LIMIT 10`);
      console.log(`Total muestra: ${r.rows.length}`);
      r.rows.forEach(d => console.log(`  • ${d.id} | conv=${d.conversacionId} | ${d.remitente} | ${(d.contenido||'').slice(0,60)} | ${d.createdAt}`));
    } catch (e) { console.log('  Error:', e.message); }

    // Integracion (Brevo API key)
    console.log('\n=== MUESTRA: Integracion ===');
    try {
      const r = await neonClient.query(`SELECT id, nombre, tipo, "createdAt" FROM "Integracion" ORDER BY "createdAt" DESC LIMIT 10`);
      console.log(`Total muestra: ${r.rows.length}`);
      r.rows.forEach(d => console.log(`  • ${d.id} | ${d.nombre} | ${d.tipo} | ${d.createdAt}`));
    } catch (e) { console.log('  Error:', e.message); }

    await neonClient.end();
    console.log('\n✓ Desconectado');
  } catch (e) {
    console.error('ERROR FATAL:', e.message);
    process.exit(1);
  }
})();
