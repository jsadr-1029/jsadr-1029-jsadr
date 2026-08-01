// =====================================================
// DETECTAR IP DE SALIDA REAL HACIA BREVO
// =====================================================
// Hace una conexión TCP a smtp-relay.brevo.com:587 y luego consulta
// varios servicios de "cuál es mi IP" para ver cuál es la IP de salida
// real que ve Brevo cuando nos conectamos a su SMTP.
// =====================================================

const net = require('net')
const https = require('https')

async function testTcpConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(10000)
    socket.on('connect', () => {
      const localAddr = socket.localAddress
      const localPort = socket.localPort
      socket.destroy()
      resolve({ ok: true, localAddr, localPort })
    })
    socket.on('error', (err) => {
      resolve({ ok: false, error: err.message })
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
    socket.connect(port, host)
  })
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data.trim()))
    }).on('error', reject)
  })
}

async function main() {
  console.log('=== PROBANDO IP DE SALIDA HACIA BREVO ===\n')

  // 1. Conexión TCP directa al SMTP de Brevo
  console.log('[1] Conexión TCP a smtp-relay.brevo.com:587...')
  const tcp = await testTcpConnection('smtp-relay.brevo.com', 587)
  if (tcp.ok) {
    console.log('  ✓ Conectado. IP local que usó el socket:', tcp.localAddr)
    console.log('  Puerto local:', tcp.localPort)
  } else {
    console.log('  ✗ Falló:', tcp.error)
  }

  // 2. Conexión TCP a smtp-relay.brevo.com:465 (SSL)
  console.log('\n[2] Conexión TCP a smtp-relay.brevo.com:465 (SSL)...')
  const tcp465 = await testTcpConnection('smtp-relay.brevo.com', 465)
  if (tcp465.ok) {
    console.log('  ✓ Conectado. IP local:', tcp465.localAddr)
  } else {
    console.log('  ✗ Falló:', tcp465.error)
  }

  // 3. Consultar varias APIs para ver qué IP ven servicios externos
  console.log('\n[3] Consultando servicios externos de "cuál es mi IP":')
  const servicios = [
    { nombre: 'api.ipify.org',    url: 'https://api.ipify.org' },
    { nombre: 'ifconfig.me',      url: 'https://ifconfig.me' },
    { nombre: 'ipinfo.io/ip',     url: 'https://ipinfo.io/ip' },
    { nombre: 'icanhazip.com',    url: 'https://icanhazip.com' },
    { nombre: 'api.ipify.org (v6)', url: 'https://api64.ipify.org' },
    { nombre: 'checkip.amazonaws', url: 'https://checkip.amazonaws.com/' },
    { nombre: 'wtfismyip.com/text', url: 'https://wtfismyip.com/text' },
  ]
  for (const s of servicios) {
    try {
      const ip = await Promise.race([
        httpsGet(s.url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 5s')), 5000)),
      ])
      console.log(`  ${s.nombre.padEnd(28)} → ${ip}`)
    } catch (e) {
      console.log(`  ${s.nombre.padEnd(28)} → ERROR: ${e.message}`)
    }
  }

  // 4. Resolver DNS de Brevo
  console.log('\n[4] Resolviendo DNS de smtp-relay.brevo.com:')
  const dns = require('dns').promises
  try {
    const addrs = await dns.resolve4('smtp-relay.brevo.com')
    console.log('  Direcciones A:', addrs)
  } catch (e) {
    console.log('  Error DNS A:', e.message)
  }
  try {
    const addrs6 = await dns.resolve6('smtp-relay.brevo.com')
    console.log('  Direcciones AAAA (IPv6):', addrs6)
  } catch (e) {
    console.log('  Sin IPv6:', e.message)
  }

  console.log('\n=== RESUMEN ===')
  console.log('Si la IP local del socket (punto 1) y las IPs de los servicios (punto 3)')
  console.log('son distintas, el servidor sale por múltiples IPs — debes whitelistear TODAS.')
  console.log('\nIPs que vimos en la prueba anterior:')
  console.log('  47.57.232.232')
  console.log('  47.57.242.119')
  console.log('\n→ Ve a Brevo → Settings → SMTP → "IPs autorizadas" y añade AMBAS.')
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
