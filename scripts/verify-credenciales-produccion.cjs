#!/usr/bin/env node
// Verifica end-to-end que las credenciales de los portales internos
// funcionan en Vercel producción:
//   1. /api/auth/login con adm-jsadr / gestor-jsadr / consultor-jsadr / abogado-jsadr
//   2. /api/admin/portal/auth con 1214731649 / 731649
//   3. /api/juridico/portal/auth con cedula + clave del abogado

const BASE = 'https://jsadr-1029-jsadr.vercel.app'

async function post(path, body) {
  const start = Date.now()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      Referer: `${BASE}/login`,
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) JSADR-Verify/1.0',
    },
    body: JSON.stringify(body),
  })
  const elapsed = Date.now() - start
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, elapsed, json }
}

async function main() {
  console.log('═'.repeat(90))
  console.log(' VERIFICACIÓN END-TO-END — Credenciales portales JSADR (Vercel producción)')
  console.log('═'.repeat(90))
  console.log(`Base URL: ${BASE}`)
  console.log('')

  // === 1. Login sistema principal ===
  console.log('▶ 1. Sistema principal /api/auth/login\n')
  const usuarios = [
    { username: 'adm-jsadr', rol: 'ADMIN', expect: 'success' },
    { username: 'gestor-jsadr', rol: 'GESTOR', expect: 'success' },
    { username: 'consultor-jsadr', rol: 'CONSULTOR', expect: 'success' },
    { username: 'abogado-jsadr', rol: 'ABOGADO', expect: 'success' },
  ]
  const password = 'Js951029*'

  for (const u of usuarios) {
    const r = await post('/api/auth/login', { username: u.username, password })
    const ok = r.status === 200 && r.json.success === true
    const detalle = ok
      ? `usuario_id=${r.json.data?.usuario?.id?.slice(-8)}`
      : `error=${r.json.error || 'unknown'}`
    console.log(
      `  ${ok ? '✅' : '❌'} ${u.username.padEnd(20)} (${u.rol.padEnd(10)}) ` +
        `HTTP ${r.status} | ${r.elapsed}ms | ${detalle}`,
    )
  }

  // === 2. Portal Admin ===
  console.log('\n▶ 2. Portal Admin /api/admin/portal/auth\n')
  const r2 = await post('/api/admin/portal/auth', { usuario: '1214731649', clave: '731649' })
  const ok2 = r2.status === 200 && r2.json.success === true
  console.log(
    `  ${ok2 ? '✅' : '❌'} usuario=1214731649 (PORTAL_ADMIN) ` +
      `HTTP ${r2.status} | ${r2.elapsed}ms | ${ok2 ? 'token=' + r2.json.data?.token?.slice(0, 8) + '...' : r2.json.error}`,
  )

  // === 3. Portal Jurídico (abogado) ===
  console.log('\n▶ 3. Portal Jurídico /api/juridico/portal/auth\n')
  // El abogado-jsadr tiene cédula 1234567890 según el diagnóstico
  const r3 = await post('/api/juridico/portal/auth', { cedula: '1234567890', clave: password })
  const ok3 = r3.status === 200 && r3.json.success === true
  console.log(
    `  ${ok3 ? '✅' : '❌'} cedula=1234567890 (PORTAL_JURIDICO) ` +
      `HTTP ${r3.status} | ${r3.elapsed}ms | ${ok3 ? 'token=' + r3.json.data?.token?.slice(0, 8) + '...' : r3.json.error}`,
  )

  console.log('\n═'.repeat(90))
  console.log(' Resumen:')
  console.log('  • Sistema:    adm-jsadr / Js951029*')
  console.log('  • Sistema:    gestor-jsadr / Js951029*')
  console.log('  • Sistema:    consultor-jsadr / Js951029*')
  console.log('  • Sistema:    abogado-jsadr / Js951029*')
  console.log('  • Portal Adm: 1214731649 / 731649')
  console.log('  • Portal Jur: 1234567890 / Js951029*')
  console.log('═'.repeat(90))
}

main().catch((e) => {
  console.error('ERR:', e)
  process.exit(1)
})
