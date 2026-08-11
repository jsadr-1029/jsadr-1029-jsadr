/**
 * Actualiza el hash bcrypt del Portal Admin Companion
 * (Configuracion.portal_admin_hash) a "Js951029*".
 *
 * Esto unifica la contraseña de P_jsadr:
 *   - Usuario.passwordHash  → Js951029* (login en /admin → JWT)
 *   - Configuracion.portal_admin_hash → Js951029* (login en PortalAdminView chat)
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const NEW_PASSWORD = 'Js951029*'
const BCRYPT_ROUNDS = 12

async function main() {
  console.log('=== Actualizar hash Portal Admin Companion a "Js951029*" ===\n')

  // Generar nuevo hash
  console.log(`Generando hash bcrypt (rounds=${BCRYPT_ROUNDS})...`)
  const newHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS)
  console.log('Hash:', newHash.substring(0, 30) + '...')

  // Upsert en Configuracion
  const config = await prisma.configuracion.upsert({
    where: { clave: 'portal_admin_hash' },
    update: {
      valor: newHash,
      descripcion: 'Hash bcrypt del portal admin companion (usuario P_jsadr) — actualizado a Js951029*',
    },
    create: {
      clave: 'portal_admin_hash',
      valor: newHash,
      descripcion: 'Hash bcrypt del portal admin companion (usuario P_jsadr)',
    },
  })

  console.log('\n✅ Configuracion.portal_admin_hash actualizado:')
  console.log('  clave:', config.clave)
  console.log('  valor:', config.valor.substring(0, 30) + '...')
  console.log('  descripcion:', config.descripcion)

  // Verificación
  const verify = await bcrypt.compare(NEW_PASSWORD, config.valor)
  console.log('\nVerificación: bcrypt.compare("Js951029*", hash) =', verify ? '✅ OK' : '❌ FAIL')

  // Crear AuditLog
  await prisma.auditLog.create({
    data: {
      accion: 'PORTAL_ADMIN_HASH_UPDATE',
      modulo: 'usuarios',
      usuarioNombre: 'script-server',
      detalles: JSON.stringify({
        tipo: 'UPDATE_PORTAL_ADMIN_HASH',
        timestamp: new Date().toISOString(),
        descripcion: 'Hash bcrypt de Portal Admin Companion actualizado a Js951029*',
      }),
      ipOrigen: 'script-server',
      userAgent: 'scripts/_update-portal-admin-hash.cjs',
      exito: true,
    },
  })
  console.log('AuditLog: PORTAL_ADMIN_HASH_UPDATE creado ✅')

  console.log('\n=== RESUMEN FINAL ===')
  console.log('Portal Admin Companion password: Js951029*')
  console.log('Usuario: P_jsadr')
  console.log('Acceso: https://jsadr.com.co/admin → login → redirige a /?view=portal-admin')
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
