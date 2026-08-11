// =====================================================
// RESET MASIVO DE CLAVES — Política de seguridad
// =====================================================
// Restablece TODAS las claves (clientes + usuarios/admin) a "Js951029*"
// y desbloquea cuentas bloqueadas por intentos fallidos.
//
// Ejecutar con:
//   cd /home/z/my-project && unset DATABASE_URL && npx tsx scripts/reset-todas-claves.ts
// =====================================================
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const CLAVE_UNIVERSAL = 'Js951029*'
const BCRYPT_ROUNDS = 12

const db = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('RESET MASIVO DE CLAVES — Política de seguridad')
  console.log('='.repeat(60))
  console.log(`Clave universal: ${CLAVE_UNIVERSAL}`)
  console.log(`BCrypt rounds: ${BCRYPT_ROUNDS}`)
  console.log('')

  // Hashear la clave una sola vez para reutilizarla en updates masivos
  const hashClave = await bcrypt.hash(CLAVE_UNIVERSAL, BCRYPT_ROUNDS)
  const ahora = new Date()

  // =====================================================
  // 1. CLIENTES (modelo Cliente)
  // =====================================================
  console.log('--- [1/2] RESETEANDO CLIENTES ---')
  const clientes = await db.cliente.findMany({
    select: { id: true, cedula: true, nombre: true, claveHash: true, pinHash: true }
  })
  console.log(`Total clientes: ${clientes.length}`)

  for (const c of clientes) {
    await db.cliente.update({
      where: { id: c.id },
      data: {
        // Resetear clave alfanumérica
        claveHash: hashClave,
        claveCreatedAt: ahora,
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        claveResetToken: null,
        claveResetExpira: null,
        claveTempToken: null,
        claveTempExpira: null,
        // Apagar el flag "debe cambiar clave" — la clave universal ya es robusta
        debeCambiarClave: false,
        // Resetear PIN (mismo hash, así el cliente puede entrar con cédula+clave o cédula+PIN)
        pinHash: hashClave,
        pinCreatedAt: ahora,
        pinIntentos: 0,
        pinBloqueadoHasta: null,
        // Limpiar sesiones activas para forzar re-login con la nueva clave
        tokenSesion: null,
        tokenExpira: null,
        // Asegurar que el cliente siga activo
        activo: true,
      },
    })
    console.log(`  ✓ Cliente ${c.cedula} ${c.nombre} — clave + PIN reseteados`)
  }

  // =====================================================
  // 2. USUARIOS / ADMINS (modelo Usuario)
  // =====================================================
  console.log('')
  console.log('--- [2/2] RESETEANDO USUARIOS/ADMINS ---')
  const usuarios = await db.usuario.findMany({
    select: { id: true, username: true, nombre: true, rol: true, passwordHash: true, claveHash: true }
  })
  console.log(`Total usuarios: ${usuarios.length}`)

  for (const u of usuarios) {
    await db.usuario.update({
      where: { id: u.id },
      data: {
        // passwordHash (login admin principal)
        passwordHash: hashClave,
        // claveHash (login portal jurídico, si aplica)
        claveHash: hashClave,
        // Desbloquear y resetear intentos
        intentosFallidos: 0,
        bloqueadoHasta: null,
        // Apagar el flag de cambio obligatorio
        mustChangePassword: false,
        // Limpiar tokens de recuperación
        claveResetToken: null,
        claveResetExpira: null,
        // Limpiar sesión del portal jurídico
        tokenSesion: null,
        tokenExpira: null,
        // Limpiar JWT refresh token hash
        sessionToken: null,
        // Asegurar que siga activo
        activo: true,
      },
    })
    console.log(`  ✓ Usuario ${u.username} (${u.nombre}, rol=${u.rol}) — passwordHash + claveHash reseteados`)
  }

  // =====================================================
  // 3. CONFIGURACIÓN: limpiar PINs legacy en tabla Configuracion
  // =====================================================
  console.log('')
  console.log('--- [3/3] LIMPIANDO PINs LEGACY EN CONFIGURACIÓN ---')
  const pinConfigs = await db.configuracion.findMany({
    where: { clave: { startsWith: 'PORTAL_PIN_' } },
    select: { id: true, clave: true }
  })
  console.log(`PINs legacy encontrados: ${pinConfigs.length}`)

  for (const pc of pinConfigs) {
    const cedula = pc.clave.replace('PORTAL_PIN_', '')
    const nuevoValor = JSON.stringify({
      pinHash: hashClave,
      clienteId: null, // se resolverá en runtime
      intentosFallidos: 0,
      bloqueadoHasta: null,
      createdAt: ahora.toISOString(),
      pinUpdatedAt: ahora.toISOString(),
    })
    await db.configuracion.update({
      where: { id: pc.id },
      data: { valor: nuevoValor },
    })
    console.log(`  ✓ PIN legacy para cédula ${cedula} — reseteado`)
  }

  // =====================================================
  // Resumen final
  // =====================================================
  console.log('')
  console.log('='.repeat(60))
  console.log('RESET MASIVO COMPLETADO')
  console.log('='.repeat(60))
  console.log(`✓ Clientes reseteados: ${clientes.length}`)
  console.log(`✓ Usuarios/admins reseteados: ${usuarios.length}`)
  console.log(`✓ PINs legacy reseteados: ${pinConfigs.length}`)
  console.log('')
  console.log(`CLAVE UNIVERSAL: ${CLAVE_UNIVERSAL}`)
  console.log('Todos los usuarios pueden iniciar sesión con esta clave.')
  console.log('Las cuentas bloqueadas han sido desbloqueadas.')
  console.log('Las sesiones activas han sido cerradas (forzar re-login).')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
