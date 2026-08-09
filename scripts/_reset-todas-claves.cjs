// =====================================================
// scripts/_reset-todas-claves.cjs
// -----------------------------------------------------
// Restablece la contraseña de TODOS los usuarios del sistema
// a un valor estándar, hasheado con bcrypt (rounds=12, igual
// que el resto del sistema).
//
// Actualiza:
//   - passwordHash (login admin/gestor/consultor/abogado vía /admin o /login)
//   - claveHash    (login del portal jurídico vía /juridico)
//   - intentosFallidos = 0
//   - bloqueadoHasta = null
//   - mustChangePassword = true  (para forzar cambio en próximo login)
//   - Limpia tokens de sesión activos del portal jurídico
//   - Registra el cambio en AuditLog
//
// USO:
//   DATABASE_URL="postgresql://..." node scripts/_reset-todas-claves.cjs
//
// Después de ejecutar, cada usuario debe:
//   1. Iniciar sesión con la clave temporal "Js951029*"
//   2. El sistema le pedirá cambiar la contraseña (mustChangePassword=true)
// =====================================================

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const NUEVA_CLAVE = 'Js951029*'
const BCRYPT_ROUNDS = 12

async function main() {
  const prisma = new PrismaClient()
  console.log('=== RESTABLECIMIENTO DE CONTRASEÑAS ===\n')
  console.log('Conectando a Neon...')

  // 1. Generar hash bcrypt (uno solo para todos — mismo input, mismo hash)
  const nuevoHash = await bcrypt.hash(NUEVA_CLAVE, BCRYPT_ROUNDS)
  console.log('Hash bcrypt generado (rounds=' + BCRYPT_ROUNDS + '):')
  console.log('  ' + nuevoHash.substring(0, 30) + '...' + nuevoHash.substring(nuevoHash.length - 20))
  console.log('')

  // 2. Listar usuarios antes de actualizar
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      username: true,
      nombre: true,
      rol: true,
      email: true,
      activo: true,
      intentosFallidos: true,
      bloqueadoHasta: true,
      mfaEnabled: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log('Usuarios a actualizar:', usuarios.length)
  console.log('─'.repeat(100))
  console.log('USERNAME'.padEnd(22) + 'ROL'.padEnd(13) + 'ACTIVO'.padEnd(9) + 'INTENTOS'.padEnd(10) + 'BLOQUEADO'.padEnd(12) + 'MFA')
  console.log('─'.repeat(100))
  for (const u of usuarios) {
    console.log(
      (u.username || '—').padEnd(22) +
      (u.rol || '—').padEnd(13) +
      (u.activo ? '✅' : '❌').padEnd(9) +
      String(u.intentosFallidos || 0).padEnd(10) +
      (u.bloqueadoHasta ? 'SÍ' : 'no').padEnd(12) +
      (u.mfaEnabled ? 'SÍ' : 'no')
    )
  }
  console.log('─'.repeat(100))
  console.log('')

  // 3. Actualizar todos los usuarios en una transacción atómica
  console.log('Actualizando contraseñas...')
  const updates = []
  for (const u of usuarios) {
    updates.push(
      prisma.usuario.update({
        where: { id: u.id },
        data: {
          passwordHash: nuevoHash,
          claveHash: nuevoHash, // también el portal jurídico usa la misma clave
          intentosFallidos: 0,
          bloqueadoHasta: null,
          mustChangePassword: true, // forzar cambio en próximo login
          tokenSesion: null, // invalidar sesiones activas del portal jurídico
          tokenExpira: null,
        },
      })
    )
  }
  await prisma.$transaction(updates)

  // 4. Registrar en AuditLog (un registro por usuario)
  console.log('Registrando en audit log...')
  const now = new Date()
  const auditLogs = usuarios.map((u) =>
    prisma.auditLog.create({
      data: {
        usuario: { connect: { id: u.id } },
        usuarioNombre: u.username || u.nombre,
        accion: 'CLAVE_RESTABLECIDA_GLOBAL',
        modulo: 'seguridad',
        entidadId: u.id,
        entidadNombre: u.username || u.nombre,
        detalles: JSON.stringify({
          motivo: 'Restablecimiento masivo solicitado por el administrador',
          mustChangePassword: true,
          fecha: now.toISOString(),
        }),
        ipOrigen: 'script-local',
        userAgent: 'scripts/_reset-todas-claves.cjs',
        exito: true,
      },
    })
  )
  await prisma.$transaction(auditLogs)

  // 5. Reporte final
  console.log('')
  console.log('✅ RESTABLECIMIENTO COMPLETADO')
  console.log('─'.repeat(100))
  console.log('Total de usuarios actualizados:', usuarios.length)
  console.log('Nueva contraseña temporal para TODOS:', NUEVA_CLAVE)
  console.log('Hash bcrypt rounds:', BCRYPT_ROUNDS)
  console.log('mustChangePassword:', true, '(cada usuario debe cambiar su clave en el próximo login)')
  console.log('Sesiones activas del portal jurídico:', 'invalidadas')
  console.log('Intentos fallidos:', 'reseteados a 0')
  console.log('Bloqueos:', 'removidos')
  console.log('')
  console.log('=== ACCESO A CADA PORTAL ===')
  console.log('  Portal Administrativo: https://jsadr.com.co/admin')
  console.log('  Portal Jurídico:       https://jsadr.com.co/juridico')
  console.log('  Login general:         https://jsadr.com.co/login')
  console.log('')
  console.log('Usuarios y sus portales:')
  for (const u of usuarios) {
    const portal =
      u.rol === 'ABOGADO' ? '/juridico' :
      u.rol === 'CLIENTE' ? '/?portal=cliente' :
      u.username === 'P_jsadr' ? '/?view=portal-admin' :
      '/admin'
    console.log('  ' + (u.username || '—').padEnd(22) + '→ ' + portal + '   (clave: ' + NUEVA_CLAVE + ')')
  }
  console.log('')
  console.log('⚠️  IMPORTANTE: Cada usuario debe cambiar su contraseña en el primer login.')
  console.log('   El sistema le pedirá automáticamente una nueva clave.')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ ERROR:', e.message)
  process.exit(1)
})
