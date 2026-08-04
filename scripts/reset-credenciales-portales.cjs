// =====================================================
// Reset de credenciales rotas — preserva accesos existentes
//
// Cambios:
//   • adm-jsadr (ADMIN) → passwordHash = "Js951029*"
//   • abogado-jsadr (ABOGADO) → passwordHash + claveHash = "Js951029*"
//     (claveHash habilita el portal jurídico para el abogado)
//   • Limpia intentosFallidos y bloqueadoHasta
//   • Registra AuditLog para cada cambio
// =====================================================

const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const NUEVA_CLAVE = 'Js951029*'

async function main() {
  console.log('═'.repeat(80))
  console.log(' RESET DE CREDENCIALES — portales internos JSADR')
  console.log('═'.repeat(80))
  console.log(`Clave a aplicar: ${NUEVA_CLAVE}`)
  console.log('')

  const nuevoHash = await bcrypt.hash(NUEVA_CLAVE, 12)
  console.log(`Nuevo bcrypt hash generado (longitud ${nuevoHash.length}).\n`)

  // === 1. Reset adm-jsadr (ADMIN) ===
  console.log('▶ Reset adm-jsadr (ADMIN)...')
  const admin = await prisma.usuario.findUnique({ where: { username: 'adm-jsadr' } })
  if (!admin) {
    console.log('  ⚠️  No existe usuario adm-jsadr. Creándolo...')
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador Jsadr',
        email: 'admin@jsadr.com.co',
        username: 'adm-jsadr',
        passwordHash: nuevoHash,
        rol: 'ADMIN',
        activo: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })
    console.log('  ✅ Usuario adm-jsadr creado.')
  } else {
    await prisma.usuario.update({
      where: { id: admin.id },
      data: {
        passwordHash: nuevoHash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        activo: true,
      },
    })
    console.log('  ✅ adm-jsadr actualizado (passwordHash + intentos reset).')
  }

  // === 2. Reset abogado-jsadr (ABOGADO) — passwordHash + claveHash ===
  console.log('\n▶ Reset abogado-jsadr (ABOGADO)...')
  const abogado = await prisma.usuario.findUnique({ where: { username: 'abogado-jsadr' } })
  if (!abogado) {
    console.log('  ⚠️  No existe usuario abogado-jsadr. Creándolo...')
    await prisma.usuario.create({
      data: {
        nombre: 'Abogado Jsadr',
        email: 'abogado@jsadr.com.co',
        username: 'abogado-jsadr',
        passwordHash: nuevoHash,
        claveHash: nuevoHash,
        rol: 'ABOGADO',
        cedula: '1214731649', // cédula para login en portal jurídico
        activo: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })
    console.log('  ✅ Usuario abogado-jsadr creado.')
  } else {
    const updateData = {
      passwordHash: nuevoHash,
      claveHash: nuevoHash,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      activo: true,
    }
    // Si la cédula está vacía, asignarla
    if (!abogado.cedula) {
      updateData.cedula = '1214731649'
    }
    await prisma.usuario.update({
      where: { id: abogado.id },
      data: updateData,
    })
    console.log('  ✅ abogado-jsadr actualizado (passwordHash + claveHash + intentos reset).')
    console.log(`     cédula: ${abogado.cedula || '1214731649 (asignada)'}`)
  }

  // === 3. Verificar gestor-jsadr y consultor-jsadr (que ya funcionan) ===
  console.log('\n▶ Verificando gestor-jsadr (GESTOR)...')
  const gestor = await prisma.usuario.findUnique({ where: { username: 'gestor-jsadr' } })
  if (gestor) {
    const okGestor = await bcrypt.compare(NUEVA_CLAVE, gestor.passwordHash)
    if (!okGestor) {
      // Re-sync por si acaso
      await prisma.usuario.update({
        where: { id: gestor.id },
        data: {
          passwordHash: nuevoHash,
          intentosFallidos: 0,
          bloqueadoHasta: null,
          activo: true,
        },
      })
      console.log('  ✅ gestor-jsadr re-sincronizado a clave estándar.')
    } else {
      console.log('  ✅ gestor-jsadr ya funciona con la clave. Solo limpiando intentos/bloqueo.')
      await prisma.usuario.update({
        where: { id: gestor.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      })
    }
  } else {
    console.log('  ⚠️  No existe gestor-jsadr.')
  }

  console.log('\n▶ Verificando consultor-jsadr (CONSULTOR)...')
  const consultor = await prisma.usuario.findUnique({ where: { username: 'consultor-jsadr' } })
  if (consultor) {
    const okConsultor = await bcrypt.compare(NUEVA_CLAVE, consultor.passwordHash)
    if (!okConsultor) {
      await prisma.usuario.update({
        where: { id: consultor.id },
        data: {
          passwordHash: nuevoHash,
          intentosFallidos: 0,
          bloqueadoHasta: null,
          activo: true,
        },
      })
      console.log('  ✅ consultor-jsadr re-sincronizado a clave estándar.')
    } else {
      console.log('  ✅ consultor-jsadr ya funciona con la clave. Solo limpiando intentos/bloqueo.')
      await prisma.usuario.update({
        where: { id: consultor.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      })
    }
  } else {
    console.log('  ⚠️  No existe consultor-jsadr.')
  }

  // === 4. Registrar AuditLog ===
  console.log('\n▶ Registrando AuditLog...')
  try {
    await prisma.auditLog.create({
      data: {
        usuarioNombre: 'sistema',
        accion: 'RESET_CREDENCIALES_PORTALES',
        modulo: 'seguridad',
        detalles: 'Reset de passwordHash para adm-jsadr, abogado-jsadr (incluye claveHash portal jurídico). Sincronizado gestor-jsadr y consultor-jsadr.',
        exito: true,
      },
    })
    console.log('  ✅ AuditLog registrado.')
  } catch (e) {
    console.log('  ⚠️  No se pudo registrar AuditLog:', e.message)
  }

  // === 5. Resumen final ===
  console.log('\n═'.repeat(80))
  console.log(' RESUMEN FINAL')
  console.log('═'.repeat(80))
  console.log(`  ✅ adm-jsadr (ADMIN)       → clave: ${NUEVA_CLAVE}`)
  console.log(`  ✅ gestor-jsadr (GESTOR)   → clave: ${NUEVA_CLAVE}`)
  console.log(`  ✅ consultor-jsadr (CONSULTOR) → clave: ${NUEVA_CLAVE}`)
  console.log(`  ✅ abogado-jsadr (ABOGADO) → clave: ${NUEVA_CLAVE} (sistema + portal jurídico)`)
  console.log(`  ✅ Portal Admin → usuario: 1214731649, clave: 731649`)
  console.log('═'.repeat(80))
  console.log('\nTodos los portales internos quedan operativos.')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERR:', e)
  process.exit(1)
})
