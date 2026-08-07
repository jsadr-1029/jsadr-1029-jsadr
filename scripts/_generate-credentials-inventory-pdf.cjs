/**
 * Genera PDF: Inventario completo de credenciales JSADR
 * Salida: /home/z/my-project/download/JSADR-Inventario-Credenciales.pdf
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Cargar .env
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
});
Object.assign(process.env, env);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PDFDocument = require('pdfkit');
const OUT = '/home/z/my-project/download/JSADR-Inventario-Credenciales.pdf';

(async () => {
  console.log('Recopilando datos...');
  const usuarios = await prisma.usuario.findMany({ orderBy: { createdAt: 'asc' }});
  const clientes = await prisma.cliente.findMany({ orderBy: { cedula: 'asc' }});
  const plataformas = await prisma.plataformaSync.findMany();
  const conexiones = await prisma.conexionAPI.findMany();
  const variables = await prisma.variableGlobal.findMany();
  await prisma.$disconnect();

  // Asegurar directorio
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(fs.createWriteStream(OUT));

  const PAGE_W = doc.page.width - 100;
  let y = doc.y;

  function checkPage(needed = 30) {
    if (doc.y + needed > doc.page.height - 60) { doc.addPage(); }
  }

  function sectionTitle(t) {
    checkPage(50);
    doc.fillColor('#0F172A')
       .font('Helvetica-Bold').fontSize(15)
       .text(t, 50, doc.y + 8);
    doc.moveTo(50, doc.y + 4).lineTo(PAGE_W + 50, doc.y + 4).strokeColor('#0EA5E9').lineWidth(1.5).stroke();
    doc.y += 14;
  }

  function subtitle(t) {
    checkPage(25);
    doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(11).text(t, 50, doc.y + 6);
    doc.y += 16;
  }

  function row(label, value, opts = {}) {
    const valStr = String(value ?? '');
    checkPage(20);
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8.5).text(label, 50, doc.y + 2, { width: 180 });
    doc.fillColor(opts.red ? '#B91C1C' : (opts.green ? '#15803D' : '#0F172A'))
       .font(opts.mono ? 'Courier' : 'Helvetica').fontSize(opts.mono ? 8 : 9)
       .text(valStr, 240, doc.y - 9, { width: PAGE_W - 190 });
    doc.y += opts.mono ? 12 : 13;
  }

  function paragraph(t, opts = {}) {
    doc.fillColor(opts.color || '#334155').font('Helvetica').fontSize(9).text(t, 50, doc.y + 4, { width: PAGE_W });
    doc.y += 18;
  }

  function spacer(h = 8) { doc.y += h; }

  // ==================== PORTADA ====================
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(22).text('INVENTARIO DE CREDENCIALES', 50, 80);
  doc.fillColor('#0EA5E9').font('Helvetica-Bold').fontSize(16).text('JSADR — Plataforma de Gestión de Préstamos', 50, 115);
  doc.fillColor('#64748B').font('Helvetica').fontSize(10).text(`Generado: ${new Date().toISOString()}`, 50, 145);
  doc.fillColor('#64748B').font('Helvetica').fontSize(10).text(`Dominio: https://jsadr.com.co`, 50, 162);
  doc.fillColor('#64748B').font('Helvetica').fontSize(10).text(`Repositorio: github.com/jsadr-1029/jsadr-1029-jsadr`, 50, 179);

  // Resumen ejecutivo en portada
  doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(12).text('Resumen ejecutivo', 50, 220);
  doc.fillColor('#334155').font('Helvetica').fontSize(9.5);
  const resumen = [
    `Usuarios internos: ${usuarios.length} (todos con contraseña "Js121473164*")`,
    `Clientes: ${clientes.length} (todos con su cédula como contraseña temporal)`,
    `Plataformas sincronizadas: ${plataformas.length} (GitHub, Vercel, Neon) — tokens huérfanos NO recuperables`,
    `Conexiones API: ${conexiones.length} (Brevo SMTP, Bancolombia) — credenciales huérfanas NO recuperables`,
    `Variables globales: ${variables.length} (parámetros operativos, no credenciales)`,
    `Secretos en .env: 11 llaves de cifrado/sesión (recuperables, ver sección 7)`,
    ``,
    `ADVERTENCIA: Las credenciales marcadas como "HUÉRFANO" fueron cifradas con una API_ENCRYPTION_KEY`,
    `que se sobrescribió el 2026-08-07 01:57:24 UTC durante la consolidación del dominio jsadr.com.co.`,
    `Esas credenciales deben ser reingresadas manualmente desde el panel administrativo.`,
  ];
  resumen.forEach((r, i) => doc.text(r, 50, 250 + i * 14, { width: PAGE_W }));

  // Tabla resumen
  doc.moveTo(50, 250 + resumen.length * 14 + 10).lineTo(PAGE_W + 50, 250 + resumen.length * 14 + 10).strokeColor('#0EA5E9').lineWidth(1).stroke();

  doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(10).text('⚠ DOCUMENTO CONFIDENCIAL — Almacenar en sitio seguro (gestor de contraseñas).', 50, 250 + resumen.length * 14 + 25);

  doc.addPage();

  // ==================== SECCIÓN 1: USUARIOS INTERNOS ====================
  sectionTitle('1. Usuarios internos (tabla Usuario)');
  paragraph(`Total: ${usuarios.length} usuarios. Todos tienen el passwordHash restablecido el 2026-08-07 02:10:08 UTC con la contraseña "Js121473164*" (bcrypt rounds=12). Los usuarios con rol ABOGADO también tienen claveHash (portal jurídico) restablecida con la misma contraseña.`, { color: '#475569' });

  usuarios.forEach((u, i) => {
    subtitle(`[${i+1}] ${u.username}  —  rol: ${u.rol}`);
    row('Nombre completo', `${u.nombre}`);
    row('Email', u.email);
    row('Cédula (jurídico)', u.cedula || '(no aplica)');
    row('Estado', u.activo ? 'ACTIVO' : 'INACTIVO', u.activo ? { green: true } : { red: true });
    row('CONTRASEÑA', 'Js121473164*', { mono: true, green: true });
    if (u.claveHash) row('Clave portal jurídico', 'Js121473164* (mismo que contraseña)', { mono: true, green: true });
    row('Intentos fallidos', u.intentosFallidos);
    row('Bloqueado hasta', u.bloqueadoHasta || 'no');
    row('MFA', u.mfaEnabled ? 'HABILITADO' : 'deshabilitado');
    row('Último acceso', u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-CO') : 'nunca');
    row('Creado', new Date(u.createdAt).toLocaleString('es-CO'));
    spacer(6);
  });

  // ==================== SECCIÓN 2: CLIENTES ====================
  doc.addPage();
  sectionTitle('2. Clientes (tabla Cliente)');
  paragraph(`Total: ${clientes.length} clientes. Todos tienen su claveHash restablecido el 2026-08-07 02:10:08 UTC con su número de cédula como contraseña temporal. Los clientes deben cambiar su contraseña desde el portal al ingresar por primera vez.`, { color: '#475569' });

  clientes.forEach((c, i) => {
    subtitle(`[${i+1}] CC ${c.cedula}  —  ${c.nombre}`);
    row('Email', c.email || '(sin email)');
    row('Teléfono', c.telefono);
    row('Estado', c.activo ? 'ACTIVO' : 'INACTIVO', c.activo ? { green: true } : { red: true });
    row('CONTRASEÑA PORTAL', c.cedula, { mono: true, green: true });
    row('Intentos', c.claveIntentos);
    row('Bloqueado hasta', c.claveBloqueadoHasta || 'no');
    if (c.bancoCliente) row('Banco', `${c.bancoCliente} ${c.tipoCuentaCliente || ''} ${c.numeroCuentaCliente || ''}`);
    row('Último acceso portal', c.ultimoAccesoPortal ? new Date(c.ultimoAccesoPortal).toLocaleString('es-CO') : 'nunca');
    spacer(6);
  });

  // ==================== SECCIÓN 3: PLATAFORMA SYNC ====================
  doc.addPage();
  sectionTitle('3. Plataformas de sincronización (tabla PlataformaSync)');
  paragraph(`Total: ${plataformas.length} plataformas. Los tokens están cifrados con AES-256-CBC en el campo tokenCifrado. La API_ENCRYPTION_KEY original se perdió al regenerar .env el 2026-08-07 01:57:24 UTC, por lo que los tokens son HUÉRFANOS: existen en BD pero NO se pueden descifrar. Deben ser reingresados manualmente desde el panel administrativo.`, { color: '#475569' });

  plataformas.forEach((p, i) => {
    subtitle(`[${i+1}] ${p.plataforma}  —  ${p.nombreMostrar}`);
    row('Descripción', p.descripcion);
    row('Endpoint', p.endpoint);
    row('Proyecto ref', p.proyectoRef);
    row('Región', p.region || 'n/a');
    row('Rama principal', p.ramaPrincipal);
    row('Sincronizado', p.sincronizado ? 'SÍ' : 'NO', p.sincronizado ? { green: true } : { red: true });
    row('Tiempo real (webhooks)', p.tiempoReal ? 'SÍ' : 'NO');
    row('Webhook URL', p.webhookUrl);
    row('Webhook secret', p.webhookSecret || '(vacío en BD, usar el de .env)', { mono: true });
    row('Estado del token', 'HUÉRFANO — no descifrable', { red: true });
    row('Token cifrado (BD)', p.tokenCifrado ? `${p.tokenCifrado.length} chars: ${p.tokenCifrado.substring(0, 60)}...` : '(vacío)', { mono: true });
    row('Último sync', p.ultimoSync ? new Date(p.ultimoSync).toLocaleString('es-CO') : 'nunca');
    row('Último estado', p.ultimoEstado);
    row('Último error', p.ultimoError);
    row('Eventos recibidos', p.eventosRecibidos);
    spacer(6);
  });

  // ==================== SECCIÓN 4: CONEXIONES API ====================
  doc.addPage();
  sectionTitle('4. Conexiones API (tabla ConexionAPI)');
  paragraph(`Total: ${conexiones.length} conexiones. Las credenciales (apiKey, apiSecret, password) están cifradas con la misma API_ENCRYPTION_KEY perdida, por lo que son HUÉRFANAS y NO recuperables desde la BD.`, { color: '#475569' });

  conexiones.forEach((c, i) => {
    subtitle(`[${i+1}] ${c.tipo}  —  ${c.nombre}`);
    row('Descripción', c.descripcion);
    row('URL', c.url || '(no set)');
    row('Usuario', c.usuario || '(vacío)');
    row('Account ID', c.accountId || '(vacío)');
    row('apiKey (cifrado)', c.apiKey ? `${c.apiKey.length} chars — HUÉRFANO` : '(vacío)', c.apiKey ? { red: true } : {});
    row('apiSecret (cifrado)', c.apiSecret ? `${c.apiSecret.substring(0, 30)}... — HUÉRFANO` : '(vacío)', c.apiSecret ? { red: true } : {});
    row('password (cifrado)', c.password ? `${c.password.substring(0, 30)}... — HUÉRFANO` : '(vacío)', c.password ? { red: true } : {});
    row('Config extra', c.configuracionExtra ? c.configuracionExtra.substring(0, 150) : '(vacío)');
    row('Activa', c.activa ? 'SÍ' : 'NO', c.activa ? { green: true } : { red: true });
    row('Probada', c.probada ? 'SÍ' : 'NO');
    row('Fecha última prueba', c.fechaUltimaPrueba ? new Date(c.fechaUltimaPrueba).toLocaleString('es-CO') : 'nunca');
    row('Resultado última prueba', c.resultadoUltimaPrueba || 'n/a');
    spacer(6);
  });

  // ==================== SECCIÓN 5: VARIABLES GLOBALES ====================
  sectionTitle('5. Variables globales (tabla VariableGlobal)');
  paragraph(`Total: ${variables.length} variables. Son parámetros operativos (no credenciales).`, { color: '#475569' });
  variables.forEach((v, i) => {
    const val = typeof v.valor === 'string' ? v.valor : JSON.stringify(v.valor);
    row(v.clave, val);
  });
  spacer(10);

  // ==================== SECCIÓN 6: DATOS PÚBLICOS DE PLATAFORMAS (.env) ====================
  doc.addPage();
  sectionTitle('6. Datos públicos de plataformas (archivo .env)');
  paragraph('Estos son los identificadores públicos (no secretos) de cada plataforma, almacenados en .env:', { color: '#475569' });

  subtitle('6.1 GitHub');
  row('Owner', env.GITHUB_OWNER);
  row('Repo', env.GITHUB_REPO);
  row('Webhook secret', env.GITHUB_WEBHOOK_SECRET, { mono: true });

  subtitle('6.2 Vercel');
  row('Project ID', env.VERCEL_PROJECT_ID, { mono: true });
  row('Team ID', env.VERCEL_TEAM_ID, { mono: true });
  row('Webhook secret', env.VERCEL_WEBHOOK_SECRET, { mono: true });

  subtitle('6.3 Neon');
  row('Project ID', env.NEON_PROJECT_ID, { mono: true });
  row('Branch', env.NEON_BRANCH);
  row('Webhook secret', env.NEON_WEBHOOK_SECRET, { mono: true });

  subtitle('6.4 SMTP (Brevo)');
  row('Host', env.SMTP_HOST);
  row('Port', env.SMTP_PORT);
  row('User', env.SMTP_USER, { mono: true });
  row('From', env.SMTP_FROM);
  row('From name', env.SMTP_FROM_NAME);
  row('Password (SMTP_PASS en .env)', env.SMTP_PASS || '(vacío — reingresar)', env.SMTP_PASS ? { green: true } : { red: true });

  subtitle('6.5 WhatsApp Cloud API');
  row('Token', env.WHATSAPP_TOKEN || '(vacío — pendiente de configurar)', env.WHATSAPP_TOKEN ? { green: true } : { red: true });
  row('Phone number ID', env.WHATSAPP_PHONE_NUMBER_ID || '(vacío)');
  row('Business ID', env.WHATSAPP_BUSINESS_ID || '(vacío)');
  row('Webhook secret', env.WHATSAPP_WEBHOOK_SECRET, { mono: true });

  subtitle('6.6 Bancolombia');
  row('Client ID', env.BANCOLOMBIA_CLIENT_ID || '(vacío — reingresar)', env.BANCOLOMBIA_CLIENT_ID ? { green: true } : { red: true });
  row('Client secret', env.BANCOLOMBIA_CLIENT_SECRET || '(vacío — reingresar)', env.BANCOLOMBIA_CLIENT_SECRET ? { green: true } : { red: true });
  row('Commerce ID', env.BANCOLOMBIA_COMMERCE_ID || '(vacío — reingresar)', env.BANCOLOMBIA_COMMERCE_ID ? { green: true } : { red: true });
  row('Ambiente', env.BANCOLOMBIA_AMBIENTE);

  // ==================== SECCIÓN 7: SECRETOS .ENV ====================
  doc.addPage();
  sectionTitle('7. Secretos de cifrado y autenticación (archivo .env)');
  paragraph('Estos son los 11 secretos críticos del sistema. Están vigentes (regenerados 2026-08-07 01:57:24 UTC). Cualquier cambio en estos valores invalidará todas las sesiones activas y los datos cifrados.', { color: '#475569' });

  subtitle('7.1 Base de datos Neon');
  row('DATABASE_URL', env.DATABASE_URL, { mono: true });

  subtitle('7.2 Cifrado AES-256 (afecta TODOS los datos cifrados)');
  row('API_ENCRYPTION_KEY', env.API_ENCRYPTION_KEY, { mono: true, red: true });
  paragraph('Vigente desde 2026-08-07 01:57:24 UTC. Las credenciales cifradas ANTES de esta fecha son huérfanas.', { color: '#B91C1C' });

  subtitle('7.3 JWT y sesiones');
  row('JWT_SECRET', env.JWT_SECRET, { mono: true });
  row('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, { mono: true });
  row('OTP_CHAT_SECRET', env.OTP_CHAT_SECRET, { mono: true });
  row('PORTAL_SESSION_SECRET', env.PORTAL_SESSION_SECRET, { mono: true });
  row('ADMIN_SESSION_SECRET', env.ADMIN_SESSION_SECRET, { mono: true });
  row('CHAT_DYN_SECRET', env.CHAT_DYN_SECRET, { mono: true });

  // ==================== SECCIÓN 8: URLs y dominios ====================
  sectionTitle('8. URLs, dominios y endpoints');
  row('URL pública', env.NEXT_PUBLIC_APP_URL);
  row('Orígenes permitidos (CORS)', env.ALLOWED_ORIGINS);
  row('Endpoint webhook plataformas', 'https://jsadr.com.co/api/seguridad/plataformas-sync/webhook');
  row('Endpoint webhook Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-webhook');
  row('Endpoint redirect Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-redirect');
  row('Endpoint checkout Bancolombia', 'https://jsadr.com.co/api/pagos/bancolombia-checkout');
  row('Repositorio GitHub', `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`);
  row('Proyecto Vercel', `https://vercel.com/${env.VERCEL_TEAM_ID}/${env.VERCEL_PROJECT_ID}`);
  row('Proyecto Neon', `https://console.neon.tech/app/projects/${env.NEON_PROJECT_ID}`);
  spacer(10);

  // ==================== SECCIÓN 9: Acciones pendientes ====================
  doc.addPage();
  sectionTitle('9. Acciones pendientes (credenciales huérfanas)');
  paragraph('Las siguientes credenciales NO se pueden recuperar de la BD ni de .env. Deben ser reingresadas o recreadas manualmente:', { color: '#475569' });

  subtitle('9.1 Token GitHub PAT');
  paragraph('• Acceder a: https://github.com/settings/tokens');
  paragraph('• Generar nuevo token (classic) con scopes: repo, workflow, admin:repo_hook, read:user');
  paragraph('• O reutilizar token existente si está en gestor de contraseñas');
  paragraph('• Ingresarlo desde: Panel admin → Config. Global → Seguridad → Plataformas → GitHub');

  subtitle('9.2 Token Vercel');
  paragraph('• Acceder a: https://vercel.com/account/tokens');
  paragraph('• Generar nuevo token con scope: Full Account');
  paragraph('• Ingresarlo desde: Panel admin → Config. Global → Seguridad → Plataformas → Vercel');

  subtitle('9.3 API Key Neon');
  paragraph('• Acceder a: https://console.neon.tech/app/settings/api-keys');
  paragraph('• Generar nueva API key');
  paragraph('• Ingresarla desde: Panel admin → Config. Global → Seguridad → Plataformas → Neon');

  subtitle('9.4 Password SMTP Brevo');
  paragraph('• Acceder a: https://app.brevo.com/settings/keys/smtp');
  paragraph('• Copiar el SMTP key actual o generar uno nuevo');
  paragraph('• Ingresarlo desde: Panel admin → Config. Global → Correo → Editar → SMTP Password');

  subtitle('9.5 Credenciales Bancolombia');
  paragraph('• Acceder a: https://www.bancolombia.com/wps/portal/personas/productos-servicios/pagos/boton-pago-bancolombia');
  paragraph('• Ingresar al portal del comercio con usuario/contraseña del comercio');
  paragraph('• Copiar Client ID, Client Secret y Commerce ID');
  paragraph('• Ingresarlos desde: Panel admin → Config. Global → Integraciones → Botón Bancolombia');

  // ==================== SECCIÓN 10: Recomendaciones ====================
  doc.addPage();
  sectionTitle('10. Recomendaciones de seguridad');
  subtitle('10.1 Almacenamiento');
  paragraph('• Guardar este PDF en un gestor de contraseñas (Bitwarden, 1Password, KeePassXC).');
  paragraph('• NO almacenar este PDF en Google Drive, Dropbox o correo sin cifrar.');
  paragraph('• Borrar este PDF después de migrar las credenciales a un gestor seguro.');

  subtitle('10.2 Rotación');
  paragraph('• Rotar API_ENCRYPTION_KEY solo después de reingresar TODAS las credenciales huérfanas.');
  paragraph('• Rotar JWT_SECRET y JWT_REFRESH_SECRET fuerza logout de todas las sesiones activas.');
  paragraph('• Cambiar contraseña "Js121473164*" por una única por usuario en el primer login.');

  subtitle('10.3 Recuperación');
  paragraph('• Hacer backup del archivo .env en sitio seguro (gestor de contraseñas).');
  paragraph('• Hacer backup de la BD Neon semanalmente (pg_dump o backup automático de Neon).');
  paragraph('• Documentar cualquier cambio de credenciales en bitácora de seguridad.');

  subtitle('10.4 MFA');
  paragraph('• Habilitar MFA en GitHub (Settings → Password and authentication).');
  paragraph('• Habilitar MFA en Vercel (Account Settings → Authentication).');
  paragraph('• Habilitar MFA en Neon (Account → Settings → Security).');
  paragraph('• Habilitar MFA en Brevo (Account → Security).');

  doc.end();
  console.log('PDF generado:', OUT);
  setTimeout(() => process.exit(0), 1500);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
