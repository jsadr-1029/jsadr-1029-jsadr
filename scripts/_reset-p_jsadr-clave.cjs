/**
 * Resetea ESPECÍFICAMENTE la contraseña del usuario P_jsadr (Portal Admin Companion)
 * a "Js951029*" usando bcrypt con rounds=12.
 *
 * - Actualiza passwordHash y claveHash
 * - Resetea intentosFallidos=0, bloqueadoHasta=null
 * - NO modifica mustChangePassword (lo dejamos false para no forzar cambio)
 * - Invalida sesiones activas (tokenSesion=null, tokenExpira=null)
 * - Crea entrada en AuditLog
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const TARGET_USERNAME = 'P_jsadr'
const NEW_PASSWORD = 'Js951029*'
const BCRYPT_ROUNDS = 12

async function main() {
  console.log('=== RESET CONTRASEÑA P_jsadr (Portal Admin Companion) ===\n')

  // 1. Buscar usuario P_jsadr (case-insensitive)
  const usuario = await prisma.usuario.findFirst({
    where: {
      OR: [
        { username: TARGET_USERNAME },
        { username: { equals: TARGET_USERNAME, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      nombre: true,
      username: true,
      email: true,
      rol: true,
      activo: true,
      mfaEnabled: true,
      passwordHash: true,
      claveHash: true,
      intentosFallidos: true,
      bloqueadoHasta: true,
      mustChangePassword: true,
    },
  })

  if (!usuario) {
    console.error(`❌ No se encontró el usuario "${TARGET_USERNAME}"`)
    process.exit(1)
  }

  console.log('Usuario encontrado:')
  console.log('  ID                :', usuario.id)
  console.log('  Username          :', usuario.username)
  console.log('  Nombre            :', usuario.nombre)
  console.log('  Email             :', usuario.email)
  console.log('  Rol               :', usuario.rol)
  console.log('  Activo            :', usuario.activo ? '✅' : '❌')
  console.log('  MFA Enabled       :', usuario.mfaEnabled ? '✅' : '❌')
  console.log('  Intentos fallidos :', usuario.intentosFallidos)
  console.log('  Bloqueado hasta   :', usuario.bloqueadoHasta || '—')
  console.log('  mustChangePassword:', usuario.mustChangePassword)
  console.log('')

  // 2. Generar nuevo hash
  console.log(`Generando hash bcrypt (rounds=${BCRYPT_ROUNDS})...`)
  const newHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS)
  console.log('Hash generado:', newHash.substring(0, 30) + '...')
  console.log('')

  // 3. Actualizar en transacción atómica
  console.log('Actualizando en base de datos...')
  const actualizado = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: newHash,
        claveHash: newHash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        mustChangePassword: false, // No forzar cambio; el usuario ya define su clave
        tokenSesion: null,
        tokenExpira: null,
      },
    })

    // Audit log
    await tx.auditLog.create({
      data: {
        accion: 'CLAVE_RESTABLECIDA_P_JSADR',
        modulo: 'usuarios',
        usuarioId: u.id,
        usuarioNombre: u.username,
        entidadId: u.id,
        entidadNombre: u.username,
        detalles: JSON.stringify({
          tipo: 'RESET_P_JSADR',
          username: u.username,
          timestamp: new Date().toISOString(),
          descripcion: `Reset específico de contraseña para Portal Admin Companion (${TARGET_USERNAME})`,
        }),
        ipOrigen: 'script-server',
        userAgent: 'scripts/_reset-p_jsadr-clave.cjs',
        exito: true,
      },
    })

    return u
  })

  console.log('✅ Actualización exitosa:')
  console.log('  - passwordHash: actualizado')
  console.log('  - claveHash   : actualizado')
  console.log('  - intentosFallidos: 0')
  console.log('  - bloqueadoHasta: null')
  console.log('  - mustChangePassword: false')
  console.log('  - tokenSesion: null (sesiones previas invalidadas)')
  console.log('  - AuditLog: CLAVE_RESTABLECIDA_P_JSADR creada')
  console.log('')

  // 4. Verificación: comparar con la nueva clave
  console.log('Verificando hash...')
  const verifyPassword = await bcrypt.compare(NEW_PASSWORD, actualizado.passwordHash)
  const verifyClave = await bcrypt.compare(NEW_PASSWORD, actualizado.claveHash)
  console.log('  passwordHash coincide con "Js951029*":', verifyPassword ? '✅' : '❌')
  console.log('  claveHash    coincide con "Js951029*":', verifyClave ? '✅' : '❌')

  if (!verifyPassword || !verifyClave) {
    console.error('❌ La verificación falló')
    process.exit(1)
  }

  console.log('\n=== RESUMEN FINAL ===')
  console.log('Usuario      :', actualizado.username)
  console.log('Contraseña   : Js951029*')
  console.log('Rol          :', actualizado.rol)
  console.log('Estado       :', actualizado.activo ? 'ACTIVO' : 'INACTIVO')
  console.log('MFA          :', actualizado.mfaEnabled ? 'HABILITADO (requiere TOTP)' : 'DESHABILITADO')
  console.log('')
  console.log('Enlace acceso Portal Admin Companion:')
  console.log('  https://jsadr.com.co/admin  →  (después de login P_jsadr redirige a /?view=portal-admin)')
}

main()
  .catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => { await prisma.$disconnect() })
