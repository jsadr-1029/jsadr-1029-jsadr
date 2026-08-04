async function main() {
  console.log('=== Test /api/auth/recuperar-clave en Vercel production ===')
  const res = await fetch('https://jsadr-1029-jsadr.vercel.app/api/auth/recuperar-clave', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://jsadr-1029-jsadr.vercel.app',
      Referer: 'https://jsadr-1029-jsadr.vercel.app/',
      'User-Agent': 'Mozilla/5.0 (test)',
    },
    body: JSON.stringify({ identificador: 'adm-jsadr' }),
  })
  console.log(`HTTP ${res.status}`)
  const text = await res.text()
  console.log(`Body: ${text.slice(0, 400)}`)
}
main().catch(e => console.error('ERR:', e))
