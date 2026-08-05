// =====================================================
// setup-credenciales-portales.js
// Configura los usuarios para los 3 perfiles de acceso:
//   1. Admin principal del sistema:    Adm-Jsadr  / Js951029*
//   2. Portal admin companion (P_jsadr): P_jsadr   / 731649
//   3. Portal abogado (Jd_jsadr):       Jd_jsadr  / 731649
//
// Uso: node scripts/setup-credenciales-portales.js
// =====================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Configuración de credenciales portales ===\n')

  // 1. Admin principal del sistema (tabla Usuario, rol ADMIN)
  //    Usuario: Adm-Jsadr / Clave: Js951029*
  const adminHash = bcrypt.hashSync('Js951029*', 12)
  const adminUser = await prisma.usuario.upsert({
    where: { username: 'Adm-Jsadr' },
    update: { passwordHash: adminHash, rol: 'ADMIN', activo: true },
    create: {
      username: 'Adm-Jsadr',
      passwordHash: adminHash,
      email: 'admin@jsadr.co',
      nombre: 'Administrador Principal Jsadr',
      rol: 'ADMIN',
      activo: true,
      permisos: '*',
    },
  })
  console.log('✓ Admin principal del sistema:')
  console.log('  usuario:', adminUser.username)
  console.log('  email:', adminUser.email)
  console.log('  rol:', adminUser.rol)
  console.log('  verificación clave "Js951029*":', bcrypt.compareSync('Js951029*', adminUser.passwordHash))

  // Limpiar versiones previas del usuario admin si existen
  for (const oldUser of ['Jsadr', 'adm-jsadr', 'jsadr']) {
    if (oldUser !== adminUser.username) {
      try {
        const existing = await prisma.usuario.findUnique({ where: { username: oldUser } })
        if (existing && existing.id !== adminUser.id) {
          await prisma.usuario.delete({ where: { id: existing.id } })
          console.log(`  ✓ Eliminado usuario obsoleto: ${oldUser}`)
        }
      } catch (e) { /* ignore */ }
    }
  }

  // 2. Portal admin companion (tabla Usuario, rol GESTOR_ACOMPAÑANTE o similar)
  //    Usuario: P_jsadr / Clave: 731649
  //    Este usuario puede loguearse al sistema y ver módulos de acompañamiento
  const portalAdminHash = bcrypt.hashSync('731649', 12)
  const portalAdmin = await prisma.usuario.upsert({
    where: { username: 'P_jsadr' },
    update: { passwordHash: portalAdminHash, rol: 'GESTOR', activo: true },
    create: {
      username: 'P_jsadr',
      passwordHash: portalAdminHash,
      email: 'portal-admin@jsadr.co',
      nombre: 'Acompañante Administrativo',
      rol: 'GESTOR',
      activo: true,
    },
  })
  console.log('\n✓ Portal admin companion:')
  console.log('  usuario:', portalAdmin.username)
  console.log('  email:', portalAdmin.email)
  console.log('  rol:', portalAdmin.rol)
  console.log('  verificación clave "731649":', bcrypt.compareSync('731649', portalAdmin.passwordHash))

  // 3. Portal abogado (tabla Usuario, rol ABOGADO)
  //    Usuario: Jd_jsadr / Clave: 731649
  //    Nota: el portal jurídico usa claveHash (no passwordHash) para login.
  //    Seteamos ambos para que funcione también desde /login unificado si se requiere.
  const abogadoHash = bcrypt.hashSync('731649', 12)
  const abogado = await prisma.usuario.upsert({
    where: { username: 'Jd_jsadr' },
    update: {
      passwordHash: abogadoHash,
      claveHash: abogadoHash,
      rol: 'ABOGADO',
      activo: true,
    },
    create: {
      username: 'Jd_jsadr',
      passwordHash: abogadoHash,
      claveHash: abogadoHash,
      email: 'abogado@jsadr.co',
      nombre: 'Abogado Jsadr',
      rol: 'ABOGADO',
      activo: true,
    },
  })
  console.log('\n✓ Portal abogado:')
  console.log('  usuario:', abogado.username)
  console.log('  email:', abogado.email)
  console.log('  rol:', abogado.rol)
  console.log('  verificación passwordHash "731649":', bcrypt.compareSync('731649', abogado.passwordHash))
  console.log('  verificación claveHash "731649":', bcrypt.compareSync('731649', abogado.claveHash || ''))

  // Limpiar versiones previas del abogado
  for (const oldUser of ['JD_jsadr', 'jd_jsadr', 'abogado-jsadr']) {
    if (oldUser !== abogado.username) {
      try {
        const existing = await prisma.usuario.findUnique({ where: { username: oldUser } })
        if (existing && existing.id !== abogado.id) {
          // Migrar referencias antes de eliminar (si hay préstamos/casos apuntando a este usuario)
          await prisma.prestamo.updateMany({ where: { gestorId: existing.id }, data: { gestorId: abogado.id } })
          await prisma.casoJuridico.updateMany({ where: { abogadoAsignadoId: existing.id }, data: { abogadoAsignadoId: abogado.id } })
          await prisma.usuario.delete({ where: { id: existing.id } })
          console.log(`  ✓ Eliminado usuario obsoleto: ${oldUser}`)
        }
      } catch (e) { /* ignore */ }
    }
  }

  // 4. Asegurar que el hash del portal_admin_hash en Configuracion sea para la clave 731649
  const configHash = bcrypt.hashSync('731649', 12)
  const config = await prisma.configuracion.upsert({
    where: { clave: 'portal_admin_hash' },
    update: { valor: configHash, descripcion: 'Hash bcrypt del portal admin companion (usuario P_jsadr)' },
    create: {
      clave: 'portal_admin_hash',
      valor: configHash,
      descripcion: 'Hash bcrypt del portal admin companion (usuario P_jsadr)',
    },
  })
  console.log('\n✓ Configuracion.portal_admin_hash actualizado para clave "731649"')
  console.log('  verificación:', bcrypt.compareSync('731649', config.valor))

  console.log('\n=== FIN ===')
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
