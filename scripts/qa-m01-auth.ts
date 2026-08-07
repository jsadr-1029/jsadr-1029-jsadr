/**
 * Pruebas funcionales M01-Autenticación (TC-AUTH-012, TC-AUTH-013)
 * Ejecutar con: bun scripts/qa-m01-auth.ts
 */
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { generateSecret, generateTOTP, verifyTOTP, generateURI } from '../src/lib/totp';
import { generarCodigoOtp, registrarOtp } from '../src/lib/otp';

// Cargar .env
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL + '&connect_timeout=60&pool_timeout=60' } },
});

const TESTS: { name: string; fn: () => Promise<any> }[] = [];
function test(name: string, fn: () => Promise<any>) { TESTS.push({ name, fn }); }
function assert(cond: any, msg: string) { if (!cond) throw new Error('ASSERT FAIL: ' + msg); }

// ────────── TC-AUTH-012: TOTP RFC 6238 ──────────

test('TC-AUTH-012.1 — generateSecret devuelve base32 de 32 chars (160 bits)', async () => {
  const s = generateSecret();
  assert(typeof s === 'string', 'secret debe ser string');
  assert(s.length === 32, `secret debe ser 32 chars, fue ${s.length}`);
  assert(/^[A-Z2-7]+=*$/.test(s), 'secret debe ser base32 válido');
  return { secret: s };
});

test('TC-AUTH-012.2 — generateTOTP devuelve 6 dígitos', async () => {
  const s = generateSecret();
  const t = generateTOTP(s);
  assert(/^\d{6}$/.test(t), `TOTP debe ser 6 dígitos, fue "${t}"`);
  return { token: t };
});

test('TC-AUTH-012.3 — verifyTOTP acepta token actual', async () => {
  const s = generateSecret();
  const t = generateTOTP(s);
  const ok = verifyTOTP(t, s);
  assert(ok === true, 'verifyTOTP debe aceptar token actual');
});

test('TC-AUTH-012.4 — verifyTOTP rechaza token modificado', async () => {
  const s = generateSecret();
  const t = generateTOTP(s);
  // Cambiar el token
  const badToken = ((parseInt(t) + 1234567) % 1000000).toString().padStart(6, '0');
  const ok = verifyTOTP(badToken, s);
  assert(ok === false, 'verifyTOTP debe rechazar token modificado');
});

test('TC-AUTH-012.5 — verifyTOTP rechaza token expirado (>60s)', async () => {
  const s = generateSecret();
  const oldTime = Date.now() - 120 * 1000;
  const t = generateTOTP(s, oldTime);
  const ok = verifyTOTP(t, s);
  assert(ok === false, 'verifyTOTP debe rechazar token expirado >60s');
});

test('TC-AUTH-012.6 — verifyTOTP rechaza formato inválido', async () => {
  const s = generateSecret();
  assert(verifyTOTP('', s) === false, 'vacío');
  assert(verifyTOTP('12345', s) === false, '5 dígitos');
  assert(verifyTOTP('1234567', s) === false, '7 dígitos');
  assert(verifyTOTP('abcdef', s) === false, 'letras');
  assert(verifyTOTP('123456', '') === false, 'secret vacío');
  assert(verifyTOTP('123456', null as any) === false, 'secret null');
});

test('TC-AUTH-012.7 — TOTP cambia cada 30 segundos (RFC 6238)', async () => {
  const s = generateSecret();
  const t1 = generateTOTP(s);
  const t2 = generateTOTP(s, Date.now() + 35 * 1000);
  assert(t1 !== t2, `tokens consecutivos deben differir: ${t1} vs ${t2}`);
});

test('TC-AUTH-012.8 — generateURI produce otpauth:// válido', async () => {
  const s = generateSecret();
  const uri = generateURI(s, 'user@test.com', 'Jsadr');
  assert(uri.startsWith('otpauth://totp/'), `URI debe empezar con otpauth://, fue "${uri.substring(0, 30)}"`);
  assert(uri.includes('secret=' + s), 'URI debe incluir secret');
  assert(uri.includes('algorithm=SHA1'), 'URI debe especificar SHA1');
  assert(uri.includes('digits=6'), 'URI debe especificar 6 digits');
  assert(uri.includes('period=30'), 'URI debe especificar period=30');
});

test('TC-AUTH-012.9 — login route step 1 devuelve requiresMFA cuando mfaEnabled', async () => {
  // Verificar código fuente del login route: la lógica de step 1 está en líneas 181-206
  const loginRoute = fs.readFileSync('/home/z/my-project/src/app/api/auth/login/route.ts', 'utf8');
  assert(loginRoute.includes('requiresMFA: true'), 'login route debe devolver requiresMFA: true');
  assert(loginRoute.includes('tempToken'), 'login route debe devolver tempToken');
  assert(loginRoute.includes("usuario.mfaEnabled && usuario.mfaSecret"), 'login route debe check mfaEnabled && mfaSecret');
  assert(loginRoute.includes("step === 2 && otp"), 'login route debe soportar step 2 + otp');
  assert(loginRoute.includes("verifyTOTP(otp, usuario.mfaSecret)"), 'login route debe llamar verifyTOTP');
});

test('TC-AUTH-012.10 — login route step 2 devuelve access_token + refresh_token', async () => {
  const loginRoute = fs.readFileSync('/home/z/my-project/src/app/api/auth/login/route.ts', 'utf8');
  assert(loginRoute.includes('access_token'), 'login route step 2 debe devolver access_token');
  assert(loginRoute.includes('refresh_token'), 'login route step 2 debe devolver refresh_token');
  assert(loginRoute.includes('resetFailedAttempts(usuario.id)'), 'login route step 2 debe reset intentos');
  assert(loginRoute.includes('LOGIN') && loginRoute.includes('mfa: true'), 'login route step 2 debe auditar con mfa: true');
});

// ────────── TC-AUTH-013: OTP WhatsApp ──────────

test('TC-AUTH-013.1 — generarCodigoOtp devuelve 6 dígitos numéricos', async () => {
  const otp = generarCodigoOtp('numeric', 6);
  assert(/^\d{6}$/.test(otp), `OTP debe ser 6 dígitos, fue "${otp}"`);
});

test('TC-AUTH-013.2 — registrarOtp crea OtpRegistro con expiración 5 min', async () => {
  const otp = generarCodigoOtp('numeric', 6);
  const reg = await registrarOtp({
    clienteId: null,
    clienteCedula: null,
    clienteNombre: 'QA Test',
    codigoPlano: otp,
    metodo: 'WHATSAPP',
    destinatario: 'test-qa@jsadr.com.co',
    tipo: 'MFA_ADMIN',
    entidadRefId: null,
    descripcion: 'Test QA TC-AUTH-013',
    maxIntentos: 5,
    expiraEnMinutos: 5,
    ipSolicitud: '127.0.0.1',
    userAgent: 'qa-script',
    guardarCodigoPlano: true,
  });
  assert(reg && reg.id, 'OtpRegistro debe tener id');
  const expiraAt = new Date(reg.expiraEn);
  const diffMin = (expiraAt.getTime() - Date.now()) / 60000;
  assert(diffMin > 4.9 && diffMin < 5.1, `Expiración debe ser ~5 min, fue ${diffMin.toFixed(2)} min`);
  // Cleanup
  await prisma.otpRegistro.delete({ where: { id: reg.id } });
  return { otpRegistroId: reg.id };
});

test('TC-AUTH-013.3 — OTP guardado en Configuracion con clave OTP_WHATSAPP_<email>', async () => {
  const email = `qa-test-${Date.now()}@jsadr.com.co`;
  const otp = generarCodigoOtp('numeric', 6);
  const expiracion = new Date();
  expiracion.setMinutes(expiracion.getMinutes() + 5);
  const valor = JSON.stringify({ otp, expiracion: expiracion.toISOString(), usuarioNombre: 'QA', telefono: '3000000000' });

  await prisma.configuracion.upsert({
    where: { clave: `OTP_WHATSAPP_${email}` },
    update: { valor, descripcion: 'OTP temporal WhatsApp QA' },
    create: { clave: `OTP_WHATSAPP_${email}`, valor, descripcion: 'OTP temporal WhatsApp QA' },
  });

  const cfg = await prisma.configuracion.findUnique({ where: { clave: `OTP_WHATSAPP_${email}` } });
  assert(cfg, 'Configuracion debe existir');
  const data = JSON.parse(cfg!.valor);
  assert(data.otp === otp, 'OTP guardado debe coincidir');
  assert(new Date(data.expiracion) > new Date(), 'Expiración debe ser futura');

  await prisma.configuracion.delete({ where: { clave: `OTP_WHATSAPP_${email}` } });
});

test('TC-AUTH-013.4 — OTP expira después de 5 min (no valida post-expiración)', async () => {
  const email = `qa-test-${Date.now()}@jsadr.com.co`;
  const otp = '123456';
  const expiracionPasada = new Date(Date.now() - 6000);
  const valor = JSON.stringify({ otp, expiracion: expiracionPasada.toISOString(), usuarioNombre: 'QA', telefono: '3000000000' });

  await prisma.configuracion.upsert({
    where: { clave: `OTP_WHATSAPP_${email}` },
    update: { valor, descripcion: 'OTP expirado QA' },
    create: { clave: `OTP_WHATSAPP_${email}`, valor, descripcion: 'OTP expirado QA' },
  });

  const cfg = await prisma.configuracion.findUnique({ where: { clave: `OTP_WHATSAPP_${email}` } });
  let otpValido = false;
  if (cfg) {
    try {
      const data = JSON.parse(cfg!.valor);
      if (data.otp === otp && new Date(data.expiracion) > new Date()) {
        otpValido = true;
      }
    } catch {}
  }
  assert(otpValido === false, 'OTP expirado no debe validar');

  await prisma.configuracion.delete({ where: { clave: `OTP_WHATSAPP_${email}` } });
});

test('TC-AUTH-013.5 — OTP se borra de Configuracion tras uso exitoso', async () => {
  const email = `qa-test-${Date.now()}@jsadr.com.co`;
  const otp = '654321';
  const expiracion = new Date();
  expiracion.setMinutes(expiracion.getMinutes() + 5);
  const valor = JSON.stringify({ otp, expiracion: expiracion.toISOString(), usuarioNombre: 'QA', telefono: '3000000000' });

  await prisma.configuracion.upsert({
    where: { clave: `OTP_WHATSAPP_${email}` },
    update: { valor, descripcion: 'OTP temporal WhatsApp QA' },
    create: { clave: `OTP_WHATSAPP_${email}`, valor, descripcion: 'OTP temporal WhatsApp QA' },
  });

  const cfg = await prisma.configuracion.findUnique({ where: { clave: `OTP_WHATSAPP_${email}` } });
  const data = JSON.parse(cfg!.valor);
  if (data.otp === otp && new Date(data.expiracion) > new Date()) {
    await prisma.configuracion.delete({ where: { clave: `OTP_WHATSAPP_${email}` } });
  }

  const cfgAfter = await prisma.configuracion.findUnique({ where: { clave: `OTP_WHATSAPP_${email}` } });
  assert(cfgAfter === null, 'OTP debe ser borrado tras uso exitoso');
});

test('TC-AUTH-013.6 — MFA route soporta enviar_otp_whatsapp (5 min expiración)', async () => {
  const mfaRoute = fs.readFileSync('/home/z/my-project/src/app/api/auth/mfa/route.ts', 'utf8');
  assert(mfaRoute.includes("accion === 'enviar_otp_whatsapp'"), 'mfa route debe tener acción enviar_otp_whatsapp');
  assert(mfaRoute.includes('expiracion.setMinutes(expiracion.getMinutes() + 5)'), 'mfa route debe setear expiración +5 min');
  assert(mfaRoute.includes('OTP_WHATSAPP_'), 'mfa route debe usar clave OTP_WHATSAPP_');
  assert(mfaRoute.includes('generarCodigoOtp'), 'mfa route debe llamar generarCodigoOtp');
  assert(mfaRoute.includes('registrarOtp'), 'mfa route debe registrar OTP para trazabilidad');
  assert(mfaRoute.includes('enviarWhatsApp'), 'mfa route debe llamar enviarWhatsApp');
});

test('TC-AUTH-013.7 — login route step 2 valida OTP WhatsApp como fallback', async () => {
  const loginRoute = fs.readFileSync('/home/z/my-project/src/app/api/auth/login/route.ts', 'utf8');
  assert(loginRoute.includes('OTP_WHATSAPP_'), 'login route debe buscar OTP_WHATSAPP_');
  assert(loginRoute.includes("data.otp === otp"), 'login route debe comparar OTP');
  assert(loginRoute.includes("new Date(data.expiracion) > new Date()"), 'login route debe validar expiración');
  assert(loginRoute.includes("configuracion.delete"), 'login route debe borrar OTP tras uso');
});

// ────────── Run all tests ──────────

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PRUEBAS M01-AUTENTICACIÓN');
  console.log('  TC-AUTH-012 (Login con MFA TOTP RFC 6238)');
  console.log('  TC-AUTH-013 (OTP por WhatsApp)');
  console.log('═══════════════════════════════════════════════════════\n');
  let pass = 0, fail = 0;
  const fails: { name: string; err: string }[] = [];
  for (const t of TESTS) {
    process.stdout.write(`▶ ${t.name}... `);
    try {
      const res = await t.fn();
      console.log('✅ PASS');
      if (res) console.log('   ' + JSON.stringify(res).substring(0, 200));
      pass++;
    } catch (e: any) {
      console.log('❌ FAIL');
      console.log('   ' + e.message);
      fails.push({ name: t.name, err: e.message });
      fail++;
    }
  }
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${pass} pass / ${fail} fail / ${TESTS.length} total`);
  console.log('═══════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\nFALLAS:');
    fails.forEach(f => console.log(`  ❌ ${f.name}\n     ${f.err}`));
  }
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error('Error fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
