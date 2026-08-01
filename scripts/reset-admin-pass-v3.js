// Reset admin credentials: username=adm-jsadr, password=Cothalds11**
// Limpia intentos fallidos, desbloquea, desactiva MFA, limpia sesión
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const NEW_USERNAME = 'adm-jsadr';
const NEW_PASSWORD = 'Cothalds11**';

async function main() {
  const admin = await db.usuario.findFirst({ where: { rol: 'ADMIN' } });
  if (!admin) {
    console.error('No se encontró usuario ADMIN');
    process.exit(1);
  }

  console.log('=== ANTES ===');
  console.log('  username:', admin.username);
  console.log('  intentosFallidos:', admin.intentosFallidos);
  console.log('  bloqueadoHasta:', admin.bloqueadoHasta);
  console.log('  mfaEnabled:', admin.mfaEnabled);
  console.log('  passwordHash (preview):', admin.passwordHash.substring(0, 30) + '...');

  // Generar nuevo hash
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS);
  const verify = await bcrypt.compare(NEW_PASSWORD, passwordHash);
  if (!verify) {
    console.error('Verificación de hash FALLÓ — abortando');
    process.exit(1);
  }
  console.log('\nHash verificado OK');

  // Update completo
  const updated = await db.usuario.update({
    where: { id: admin.id },
    data: {
      username: NEW_USERNAME,
      passwordHash,
      // Desactivar MFA
      mfaEnabled: false,
      mfaSecret: null,
      // Desbloquear y resetear intentos
      intentosFallidos: 0,
      bloqueadoHasta: null,
      // No forzar cambio
      mustChangePassword: false,
      // Limpiar sesión
      sessionToken: null,
      // Asegurar activo
      activo: true,
    },
  });

  console.log('\n=== DESPUÉS ===');
  console.log('  id:', updated.id);
  console.log('  username:', updated.username);
  console.log('  email:', updated.email);
  console.log('  rol:', updated.rol);
  console.log('  activo:', updated.activo);
  console.log('  mfaEnabled:', updated.mfaEnabled);
  console.log('  mustChangePassword:', updated.mustChangePassword);
  console.log('  intentosFallidos:', updated.intentosFallidos);
  console.log('  bloqueadoHasta:', updated.bloqueadoHasta);
  console.log('  passwordHash (preview):', updated.passwordHash.substring(0, 30) + '...');

  // Re-verificar
  const reCheck = await bcrypt.compare(NEW_PASSWORD, updated.passwordHash);
  console.log('\n=== RE-VERIFICACIÓN FINAL ===');
  console.log('  bcrypt.compare("' + NEW_PASSWORD + '", hash):', reCheck ? 'OK' : 'FALLÓ');

  console.log('\n========================================');
  console.log('  LOGIN ADMIN RESTAURADO');
  console.log('========================================');
  console.log('  Usuario:  ' + NEW_USERNAME);
  console.log('  Clave:    ' + NEW_PASSWORD);
  console.log('========================================');
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => db.$disconnect());
