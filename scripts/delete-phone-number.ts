// =====================================================
// Elimina un número de teléfono del WABA
// Uso: npx tsx scripts/delete-phone-number.ts <phone_number_id>
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function main() {
  const id = process.argv[2]
  if (!id) {
    console.error('Uso: npx tsx scripts/delete-phone-number.ts <phone_number_id>')
    process.exit(1)
  }
  console.log(`=== ELIMINAR NÚMERO ${id} ===\n`)
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}`
  console.log('DELETE', url)
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    console.error('  → Error:', data?.error?.message)
    process.exit(1)
  }
  console.log('✅ Número eliminado')
  console.log(JSON.stringify(data, null, 2))
}

main()
