// Test convertir solicitud → cliente
const BASE = 'http://localhost:3001'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchRetry(url, opts, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, opts)
    } catch (e) {
      console.log(`  retry ${i+1}/${tries}...`)
      await sleep(2000)
    }
  }
  throw new Error('fetch failed after retries')
}

async function main() {
  console.log('=== 1. Listar solicitudes PENDIENTE ===')
  const listRes = await fetchRetry(`${BASE}/api/solicitudes-nuevos-clientes?estado=PENDIENTE`)
  const listed = await listRes.json()
  if (!listed.success || !listed.data.length) {
    console.log('No hay solicitudes pendientes. Crea una con test-register-flow.cjs primero.')
    return
  }
  const sol = listed.data[0]
  console.log('Solicitud:', sol.codigo, '|', sol.nombre, sol.apellido, '| CC', sol.cedula)

  console.log('\n=== 2. PATCH convertir ===')
  const patchRes = await fetchRetry(`${BASE}/api/solicitudes-nuevos-clientes/${sol.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'convertir', observaciones: 'Conversión de prueba' }),
  })
  const patched = await patchRes.json()
  console.log('Status:', patchRes.status)
  console.log('Success:', patched.success)
  console.log('Mensaje:', patched.mensaje)
  console.log('clienteCreado:', patched.clienteCreado)

  if (patched.clienteCreado) {
    console.log('\n=== 3. Verificar cliente en /api/clientes ===')
    await sleep(500)
    const cliRes = await fetchRetry(`${BASE}/api/clientes`)
    const cliJson = await cliRes.json()
    const encontrado = cliJson.data?.find(c => c.cedula === patched.clienteCreado.cedula)
    console.log('Cliente encontrado en lista general:', encontrado ? 'SÍ ✓' : 'NO ✗')
    if (encontrado) {
      console.log('  nombre      :', encontrado.nombre)
      console.log('  telefono    :', encontrado.telefono)
      console.log('  email       :', encontrado.email)
      console.log('  ciudad      :', encontrado.ciudad)
      console.log('  activo      :', encontrado.activo)
      console.log('  tiene PIN   :', !!encontrado.pinHash)
    }

    console.log('\n=== 4. Probar login portal con PIN generado ===')
    await sleep(500)
    const loginRes = await fetchRetry(`${BASE}/api/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: patched.clienteCreado.cedula, pin: patched.clienteCreado.pin }),
    })
    const loginJson = await loginRes.json()
    console.log('Login status:', loginRes.status)
    console.log('Login success:', loginJson.success || loginJson.error)
    if (loginJson.success) {
      console.log('  cliente nombre:', loginJson.data?.cliente?.nombre || loginJson.cliente?.nombre)
      console.log('  token generado:', !!loginJson.token || !!loginJson.data?.token)
    }
  }
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
