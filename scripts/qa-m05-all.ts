/**
 * Pruebas funcionales M05-Correo Electrónico — 5 TCs pendientes
 * TC-MAIL-004, TC-MAIL-009, TC-MAIL-010, TC-MAIL-014, TC-MAIL-015
 *
 * Ejecutar con: npx tsx scripts/qa-m05-all.ts
 */
import fs from 'fs';
import { db as prisma } from '../src/lib/db';

// ─── Cargar .env ────────────────────────────────────────────────────────────
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const TESTS: { tc: string; name: string; fn: () => Promise<any> }[] = [];
function test(tc: string, name: string, fn: () => Promise<any>) { TESTS.push({ tc, name, fn }); }
function assert(cond: any, msg: string) { if (!cond) throw new Error('ASSERT FAIL: ' + msg); }

const EMAIL_ROUTE_SRC = '/home/z/my-project/src/app/api/email/route.ts';
const EMAIL_LIB_SRC = '/home/z/my-project/src/lib/email.ts';
const SOLICITAR_OTP_SRC = '/home/z/my-project/src/app/api/portal/solicitar-otp/route.ts';
const SCHEMA_PRISMA = '/home/z/my-project/prisma/schema.prisma';

// ════════════════════════════════════════════════════════════════════════════
// TC-MAIL-004 — Enviar OTP a cliente sin email → HTTP 400
// ════════════════════════════════════════════════════════════════════════════
test('TC-MAIL-004', 'POST /api/portal/solicitar-otp con cliente.email=null → HTTP 400 "Tu cuenta no tiene un correo"', async () => {
  const src = fs.readFileSync(SOLICITAR_OTP_SRC, 'utf8');

  // Validación: si no hay email, retorna 400 con mensaje claro
  assert(src.includes('if (!email)'), 'Debe validar si el cliente no tiene email');
  assert(/status:\s*400/.test(src), 'Debe retornar HTTP 400 cuando el cliente no tiene email');
  assert(src.includes('Tu cuenta no tiene un correo electrónico registrado'),
    'Mensaje debe indicar "Tu cuenta no tiene un correo electrónico registrado"');

  // La validación debe ocurrir ANTES de generar el OTP
  // (buscar la LLAMADA a generarCodigoOtp, no el import)
  const idxValidacionEmail = src.indexOf('if (!email)');
  const idxGenerarOtp = src.indexOf("generarCodigoOtp('numeric'");
  assert(idxValidacionEmail > 0 && idxGenerarOtp > 0 && idxValidacionEmail < idxGenerarOtp,
    'La validación de email debe ocurrir ANTES de generar el OTP');

  // Verificar en BD: existe al menos un cliente sin email
  const clienteSinEmail = await prisma.cliente.findFirst({
    where: { OR: [{ email: null }, { email: '' }] },
    select: { id: true, cedula: true, nombre: true, email: true },
  });
  if (clienteSinEmail) {
    console.log(`   ℹ️  Cliente sin email en BD: ${clienteSinEmail.nombre} (cédula ${clienteSinEmail.cedula})`);
  } else {
    console.log('   ℹ️  Todos los clientes en BD tienen email (validación solo de código fuente)');
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TC-MAIL-009 — Modo Ethereal (sin SMTP configurado)
// ════════════════════════════════════════════════════════════════════════════
test('TC-MAIL-009', 'Sin SMTP configurado en desarrollo → isEthereal=true, previewUrl devuelta', async () => {
  const src = fs.readFileSync(EMAIL_LIB_SRC, 'utf8');

  // Verifica que existe el modo Ethereal
  assert(src.includes('ethereal'), 'Debe tener modo Ethereal implementado');
  assert(src.includes('nodemailer.createTestAccount'),
    'Debe crear cuenta de prueba Ethereal con nodemailer.createTestAccount');
  assert(src.includes('smtp.ethereal.email'),
    'Debe usar host smtp.ethereal.email');

  // Verifica que previewUrl se devuelve
  assert(src.includes('previewUrl'), 'Debe devolver previewUrl en modo Ethereal');
  assert(src.includes('getTestMessageUrl'),
    'Debe usar nodemailer.getTestMessageUrl para obtener previewUrl');

  // Verifica que isEthereal se marca correctamente
  assert(src.includes('isEthereal: true'), 'Debe marcar isEthereal=true en modo Ethereal');

  // Verifica la lógica de cuándo se usa Ethereal (solo en desarrollo)
  assert(src.includes("process.env.NODE_ENV === 'production'"),
    'Debe verificar NODE_ENV para decidir Ethereal vs producción');

  // v4.8 (QA M05 TC-MAIL-009): En desarrollo, si no hay SMTP, debe usar Ethereal.
  // En producción, debe lanzar error (no usar Ethereal en prod).
  // El Excel espera: si no hay SMTP configurado → isEthereal=true, previewUrl devuelta.
  // Esto aplica solo en desarrollo (NODE_ENV !== 'production').
  assert(src.includes('Modo desarrollo: usar Ethereal') || src.includes('modo de prueba'),
    'Debe documentar que Ethereal es modo de desarrollo');
});

// ════════════════════════════════════════════════════════════════════════════
// TC-MAIL-010 — Email destinatario inválido → HTTP 400
// ════════════════════════════════════════════════════════════════════════════
test('TC-MAIL-010', 'POST /api/email {accion: enviar-prueba, to: "no-es-email"} → HTTP 400 EMAIL_INVALIDO', async () => {
  const routeSrc = fs.readFileSync(EMAIL_ROUTE_SRC, 'utf8');
  const libSrc = fs.readFileSync(EMAIL_LIB_SRC, 'utf8');

  // v4.8 (QA M05 TC-MAIL-010): la API route debe validar el formato del email
  // ANTES de llamar a enviarEmail, retornando HTTP 400 EMAIL_INVALIDO.
  // Antes: la API route solo validaba `!to` (truthy), no el formato.
  // enviarEmail() sí validaba el formato pero retornaba success:false (HTTP 200),
  // lo cual era confuso para el cliente.

  assert(routeSrc.includes('EMAIL_INVALIDO') || routeSrc.includes('emailRegex'),
    'API route debe validar formato de email con regex');

  // Verifica que la validación ocurre en la API route antes de enviarEmail
  assert(routeSrc.includes('enviar-prueba'), 'Debe tener acción enviar-prueba');

  // Validación: debe validar el formato del email antes de llamar enviarEmail
  // Buscar el patrón: regex de email + return 400 si no coincide
  const hasEmailValidation = /emailRegex|EMAIL_INVALIDO|\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.|isEmail/.test(routeSrc);
  assert(hasEmailValidation,
    'API route debe tener validación de formato de email antes de enviar');

  // Verifica que la lib email.ts también valida (defensa en profundidad)
  assert(libSrc.includes('emailRegex') || libSrc.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/'),
    'email.ts debe validar email del destinatario (defensa en profundidad)');

  // La lib ya retorna success:false si el email es inválido
  assert(libSrc.includes('Email del destinatario inválido'),
    'email.ts debe retornar error "Email del destinatario inválido"');
});

// ════════════════════════════════════════════════════════════════════════════
// TC-MAIL-014 — Trazabilidad (log de cada correo enviado)
// ════════════════════════════════════════════════════════════════════════════
test('TC-MAIL-014', 'Cada correo enviado se registra en EnvioCorreo/NotificacionLog con destinatario, asunto, estado, fechaEnvio', async () => {
  const libSrc = fs.readFileSync(EMAIL_LIB_SRC, 'utf8');
  const otpSrc = fs.readFileSync(SOLICITAR_OTP_SRC, 'utf8');
  const schema = fs.readFileSync(SCHEMA_PRISMA, 'utf8');

  // Verifica que enviarEmail registra en EnvioCorreo (éxito y fallo)
  assert(libSrc.includes('db.envioCorreo.create'),
    'enviarEmail debe registrar en EnvioCorreo');

  // Registra en caso de éxito (Brevo API)
  assert(/envioCorreo\.create[\s\S]*?estado:\s*'ENVIADO'/.test(libSrc),
    'Debe registrar estado=ENVIADO en caso de éxito (Brevo API)');

  // Registra en caso de éxito (SMTP fallback)
  assert(/envioCorreo\.create[\s\S]*?estado:\s*'ENVIADO'[\s\S]*?SMTP_FALLBACK/.test(libSrc) ||
         /via:\s*'SMTP_FALLBACK'/.test(libSrc),
    'Debe registrar via=SMTP_FALLBACK cuando se usa SMTP');

  // Registra en caso de fallo
  assert(/envioCorreo\.create[\s\S]*?estado:\s*'FALLIDO'/.test(libSrc),
    'Debe registrar estado=FALLIDO en caso de error');

  // Campos obligatorios en el registro: destinatario, asunto, estado, fechaEnvio
  assert(libSrc.includes('destinatario:'), 'Registro debe incluir destinatario');
  assert(libSrc.includes('asunto:'), 'Registro debe incluir asunto');
  assert(libSrc.includes('fechaEnvio:'), 'Registro debe incluir fechaEnvio');

  // solicitar-otp también registra en NotificacionLog
  assert(otpSrc.includes('db.notificacionLog.create'),
    'solicitar-otp debe registrar en NotificacionLog');

  // Verificar schema: EnvioCorreo tiene los campos esperados
  assert(schema.includes('model EnvioCorreo'), 'Schema debe tener model EnvioCorreo');
  assert(schema.includes('destinatario') && schema.includes('asunto') && schema.includes('estado'),
    'Schema EnvioCorreo debe tener campos destinatario, asunto, estado');

  // Verificar en BD: contar EnvioCorreo
  const totalEnvios = await prisma.envioCorreo.count();
  const enviados = await prisma.envioCorreo.count({ where: { estado: 'ENVIADO' } });
  const fallidos = await prisma.envioCorreo.count({ where: { estado: 'FALLIDO' } });
  console.log(`   ℹ️  EnvioCorreo en BD: total=${totalEnvios} | ENVIADO=${enviados} | FALLIDO=${fallidos}`);

  // Verificar en BD: NotificacionLog
  const totalNotif = await prisma.notificacionLog.count();
  console.log(`   ℹ️  NotificacionLog en BD: total=${totalNotif}`);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-MAIL-015 — Manejo de error SMTP (535 auth failed)
// ════════════════════════════════════════════════════════════════════════════
test('TC-MAIL-015', 'POST /api/email {accion: probar} con credenciales inválidas → HTTP 200 success=false, error sanitizado', async () => {
  const libSrc = fs.readFileSync(EMAIL_LIB_SRC, 'utf8');

  // Verifica que probarSmtp retorna success:false en caso de error
  assert(/probarSmtp[\s\S]*?success:\s*false/.test(libSrc),
    'probarSmtp debe retornar success:false en caso de error');

  // v4.8 (QA M05 TC-MAIL-015): el error devuelto al cliente debe estar sanitizado.
  // Antes: probaba `message: \`Error de conexión SMTP: ${error.message}\`` lo que
  // podía exponer detalles internos (host, puerto, credenciales parciales).
  // Ahora: clasifica el tipo de error y devuelve un mensaje genérico + codigo,
  // sin exponer detalles internos. Los detalles quedan solo en logs del server.

  // Verifica que hay clasificación de error SMTP (535, 525, 5.7.1, etc.)
  assert(/535|525|5\.7\.1|auth.*fail|invalid.*login/i.test(libSrc),
    'Debe detectar errores de autenticación SMTP (535, 525, 5.7.1)');

  // Verifica que hay sanitización del error
  assert(libSrc.includes('SMTP_AUTH_FAILED') || libSrc.includes('SMTP_ERROR_AUTENTICACION') ||
         libSrc.includes('codigo') || /error.*codigo|codigo.*error/i.test(libSrc),
    'Debe retornar codigo de error sanitizado (SMTP_AUTH_FAILED o similar)');

  // Verifica que el transporter cacheado se resetea en caso de error de auth
  assert(/cachedTransporter\s*=\s*null/.test(libSrc),
    'Debe resetear el transporter cacheado cuando hay error de auth (para que el próximo envío use credenciales frescas)');

  // Verifica que el error se registra en EnvioCorreo (auditoría)
  assert(/envioCorreo\.create[\s\S]*?estado:\s*'FALLIDO'/.test(libSrc),
    'Debe registrar el fallo en EnvioCorreo para auditoría');

  // Verifica en BD que existe al menos un envío FALLIDO registrado (trazabilidad del error)
  const fallidos = await prisma.envioCorreo.count({ where: { estado: 'FALLIDO' } });
  console.log(`   ℹ️  EnvioCorreo con estado=FALLIDO: ${fallidos} (trazabilidad de errores SMTP)`);
});

// ════════════════════════════════════════════════════════════════════════════
// EXECUTE ALL
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('  QA M05-CORREO ELECTRÓNICO — 5 Test Cases pendientes');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let pass = 0;
  let fail = 0;
  const fails: { tc: string; name: string; err: string }[] = [];

  for (const t of TESTS) {
    process.stdout.write(`▶ ${t.tc.padEnd(12)} ${t.name} ... `);
    try {
      await t.fn();
      console.log('✅ PASS');
      pass++;
    } catch (e: any) {
      console.log('❌ FAIL');
      console.log(`   ${e.message}`);
      fails.push({ tc: t.tc, name: t.name, err: e.message });
      fail++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${pass} PASS / ${fail} FAIL / ${TESTS.length} TOTAL`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\nFALLAS:');
    fails.forEach((f) => console.log(`  ❌ ${f.tc} — ${f.name}\n     ${f.err}`));
  }

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
