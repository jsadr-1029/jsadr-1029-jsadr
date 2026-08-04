// =====================================================
// Diagnóstico integral de credenciales para todos los portales internos
// - Sistema principal (admin/gestor/consultor/abogado): /api/auth/login
// - Portal administrador: /api/admin/portal/auth (usuario 1214731649)
// - Portal jurídico (abogado): /api/juridico/portal/auth (cédula + clave)
// =====================================================

const fs = require('fs')
const path = require('path')

// Parse .env manually
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

// Credenciales conocidas/configuradas históricamente en el sistema
const CREDENCIALES_PRUEBA = {
  admin: [
    { username: 'adm-jsadr', passwords: ['Js951029*', 'Js951029', 'Jsadr951029*', 'Jsadr2026*', 'admin'] },
  ],
  gestor: [
    { username: 'gestor-jsadr', passwords: ['Js951029*', 'Gestor2026*', 'gestor'] },
    { username: 'gestor', passwords: ['Js951029*', 'gestor'] },
  ],
  consultor: [
    { username: 'consultor-jsadr', passwords: ['Js951029*', 'Consultor2026*', 'consultor'] },
    { username: 'consultor', passwords: ['Js951029*', 'consultor'] },
  ],
  abogado: [
    { username: 'abogado-jsadr', passwords: ['Js951029*', 'Abogado2026*', 'abogado'] },
    { username: 'abogado', passwords: ['Js951029*', 'abogado'] },
  ],
}

// Posibles claves del portal admin y del portal jurídico
const PORTAL_ADMIN_CLAVES = ['731649', 'Js951029*', 'Js951029', '1214731649']
const PORTAL_JURIDICO_CLAVES = ['Js951029*', 'Js951029', '731649', 'Abogado2026*']

async function main() {
  console.log('=====================================================')
  console.log(' DIAGNÓSTICO DE CREDENCIALES — PORTALES JSADR')
  console.log('=====================================================')
  console.log('Fecha:', new Date().toISOString())
  console.log('')

  // 1) Listar todos los usuarios internos
  console.log('▶ 1. Listando usuarios internos en BD Neon...\n')
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: ['ADMIN', 'GESTOR', 'CONSULTOR', 'ABOGADO'] } },
    select: {
      id: true,
      nombre: true,
      email: true,
      username: true,
      cedula: true,
      rol: true,
      activo: true,
      passwordHash: true,
      claveHash: true,
      mfaEnabled: true,
      mfaSecret: true,
      intentosFallidos: true,
      bloqueadoHasta: true,
      ultimoAcceso: true,
      tokenSesion: true,
      tokenExpira: true,
    },
    orderBy: [{ rol: 'asc' }, { username: 'asc' }],
  })

  if (usuarios.length === 0) {
    console.log('⚠️  NO HAY USUARIOS INTERNOS EN LA BD.')
    console.log('   Hay que crear admin/gestor/consultor/abogado.')
    await prisma.$disconnect()
    return
  }

  console.log(`Total usuarios internos: ${usuarios.length}\n`)
  console.log('─'.repeat(120))
  console.log(
    'USERNAME'.padEnd(22) +
    'ROL'.padEnd(12) +
    'ACTIVO'.padEnd(8) +
    'BLOQUEADO'.padEnd(22) +
    'INTENTOS'.padEnd(10) +
    'MFA'.padEnd(6) +
    'CEDULA'.padEnd(14) +
    'CLAVE-HASH'.padEnd(12) +
    'ULTIMO-ACCESO'
  )
  console.log('─'.repeat(120))

  for (const u of usuarios) {
    const bloqueado = u.bloqueadoHasta && u.bloqueadoHasta > new Date() ? u.bloqueadoHasta.toISOString() : '-'
    console.log(
      (u.username || '-').padEnd(22) +
      (u.rol || '-').padEnd(12) +
      (u.activo ? 'SÍ' : 'NO').padEnd(8) +
      String(bloqueado).padEnd(22) +
      String(u.intentosFallidos || 0).padEnd(10) +
      (u.mfaEnabled ? 'SÍ' : 'NO').padEnd(6) +
      (u.cedula || '-').padEnd(14) +
      (u.passwordHash ? 'OK' : 'SIN-HASH').padEnd(12) +
      (u.ultimoAcceso ? u.ultimoAcceso.toISOString() : 'nunca')
    )
  }
  console.log('─'.repeat(120))
  console.log('')

  // 2) Probar credenciales conocidas contra cada usuario
  console.log('▶ 2. Probando credenciales conocidas contra hashes en BD...\n')

  const resultados = []

  for (const u of usuarios) {
    const passwordsAProbar = new Set()

    // Agregar passwords según el rol del usuario
    const rolLower = (u.rol || '').toLowerCase()
    if (CREDENCIALES_PRUEBA[rolLower]) {
      for (const entry of CREDENCIALES_PRUEBA[rolLower]) {
        if (entry.username === u.username) {
          entry.passwords.forEach((p) => passwordsAProbar.add(p))
        }
      }
    }
    // Agregar passwords genéricos para todos los usuarios
    ;['Js951029*', 'Js951029', '731649', 'admin', 'gestor', 'consultor', 'abogado'].forEach((p) =>
      passwordsAProbar.add(p),
    )

    const passwordsValidas = []
    for (const p of passwordsAProbar) {
      if (!u.passwordHash) continue
      try {
        const ok = await bcrypt.compare(p, u.passwordHash)
        if (ok) passwordsValidas.push(p)
      } catch (e) {
        // hash inválido
      }
    }

    // Para portal jurídico (abogado): probar también contra claveHash
    const clavesPortalValidas = []
    if (u.claveHash) {
      for (const p of passwordsAProbar) {
        try {
          const ok = await bcrypt.compare(p, u.claveHash)
          if (ok) clavesPortalValidas.push(p)
        } catch (e) {}
      }
    }

    resultados.push({
      usuario: u,
      passwordsValidas,
      clavesPortalValidas,
    })

    const status = passwordsValidas.length > 0 ? '✅' : '❌'
    console.log(
      `${status} ${u.username} (${u.rol}) — login sistema: ` +
        (passwordsValidas.length > 0 ? passwordsValidas.join(' | ') : 'NINGUNA coincide'),
    )
    if (u.claveHash) {
      const pStatus = clavesPortalValidas.length > 0 ? '✅' : '❌'
      console.log(
        `   ${pStatus} portal jurídico (claveHash): ` +
          (clavesPortalValidas.length > 0 ? clavesPortalValidas.join(' | ') : 'NINGUNA coincide'),
      )
    } else {
      console.log(`   ⚠️  portal jurídico (claveHash): NO CONFIGURADO`)
    }
  }
  console.log('')

  // 3) Verificar portal admin (configuracion.portal_admin_hash)
  console.log('▶ 3. Verificando portal admin (Configuracion.portal_admin_hash)...\n')
  const portalAdminHash = await prisma.configuracion.findUnique({
    where: { clave: 'portal_admin_hash' },
  })

  if (portalAdminHash) {
    console.log(`   Hash encontrado (longitud ${portalAdminHash.valor.length}).`)
    const clavesValidas = []
    for (const c of PORTAL_ADMIN_CLAVES) {
      try {
        const ok = await bcrypt.compare(c, portalAdminHash.valor)
        if (ok) clavesValidas.push(c)
      } catch (e) {}
    }
    if (clavesValidas.length > 0) {
      console.log(`   ✅ Claves que abren portal admin: ${clavesValidas.join(' | ')}`)
      console.log(`   ℹ️  Usuario esperado: 1214731649`)
    } else {
      console.log(`   ❌ Ninguna de las claves de prueba abre el portal admin.`)
      console.log(`   ℹ️  Claves probadas: ${PORTAL_ADMIN_CLAVES.join(', ')}`)
    }
  } else {
    console.log(`   ⚠️  NO existe Configuracion.portal_admin_hash.`)
    console.log(`   ℹ️  Se creará automáticamente en el primer login con clave "731649".`)
  }
  console.log('')

  // 4) Resumen ejecutivo
  console.log('═'.repeat(120))
  console.log(' RESUMEN EJECUTIVO')
  console.log('═'.repeat(120))
  let okCount = 0
  let badCount = 0
  for (const r of resultados) {
    const ok = r.passwordsValidas.length > 0
    if (ok) okCount++
    else badCount++
    const u = r.usuario
    const detalle = []
    if (!u.activo) detalle.push('INACTIVO')
    if (u.bloqueadoHasta && u.bloqueadoHasta > new Date()) detalle.push('BLOQUEADO')
    if (u.intentosFallidos > 0) detalle.push(`intentos=${u.intentosFallidos}`)
    if (!u.passwordHash) detalle.push('SIN passwordHash')
    if (u.mfaEnabled) detalle.push('MFA-ON')
    const estado = detalle.length > 0 ? ` [${detalle.join(', ')}]` : ''
    console.log(
      `  ${ok ? '✅' : '❌'} ${u.username.padEnd(20)} (${u.rol.padEnd(10)}) ` +
        (ok ? `clave: ${r.passwordsValidas[0]}` : 'NO AUTENTICA') +
        estado,
    )
  }
  console.log('')
  console.log(`  Total: ${okCount} OK, ${badCount} NO AUTENTICAN`)
  console.log('═'.repeat(120))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERR:', e)
  process.exit(1)
})
