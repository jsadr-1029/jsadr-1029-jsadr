// =====================================================
// Gestión de plantillas de WhatsApp Cloud API
// -----------------------------------------------------
// Comandos:
//   npx tsx scripts/manage-whatsapp-template.ts list
//   npx tsx scripts/manage-whatsapp-template.ts create
//   npx tsx scripts/manage-whatsapp-template.ts status <template_id>
//   npx tsx scripts/manage-whatsapp-template.ts delete <template_name>
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA_ID = process.env.WHATSAPP_BUSINESS_ID
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

const PLANTILLA_NOMBRE = process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE || 'codigo_otp_jsadr'
const PLANTILLA_IDIOMA = process.env.WHATSAPP_PLANTILLA_OTP_IDIOMA || 'es'

const cmd = process.argv[2] || 'list'

async function listar() {
  console.log(`=== PLANTILLAS EN WABA ${WABA_ID} ===\n`)
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates?limit=100`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log(`Total: ${data?.data?.length || 0} plantilla(s)\n`)
  for (const t of data?.data || []) {
    console.log(`- ${t.name} [${t.language}]`)
    console.log(`  ID: ${t.id}`)
    console.log(`  Categoria: ${t.category}`)
    console.log(`  Estado: ${t.status}`)
    console.log(`  Creada: ${t.created_time}`)
    console.log('')
  }
}

async function crear() {
  console.log(`=== CREAR PLANTILLA ${PLANTILLA_NOMBRE} ===\n`)
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates`

  // Estructura oficial para plantillas AUTHENTICATION:
  // Meta genera el BODY automáticamente según el idioma (no se permite campo `text`).
  // add_security_recommendation añade la frase de seguridad recomendada.
  // Buttons: OTP con COPY_CODE (funciona en iOS y Android).
  const body = {
    name: PLANTILLA_NOMBRE,
    language: PLANTILLA_IDIOMA,
    category: 'AUTHENTICATION',
    components: [
      {
        type: 'BODY',
        add_security_recommendation: true,
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'OTP',
            otp_type: 'COPY_CODE',
            text: 'Copiar código',
          },
        ],
      },
    ],
  }

  console.log('POST', url)
  console.log('Body:', JSON.stringify(body, null, 2))
  console.log('')

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    console.error('  → Error:', data?.error?.message)
    process.exit(1)
  }
  console.log('✅ Plantilla creada')
  console.log(JSON.stringify(data, null, 2))
  console.log('')
  console.log(`ID: ${data?.id}`)
  console.log(`Estado: ${data?.status}`)
  console.log(`Categoria: ${data?.category}`)
}

async function estado(templateId: string) {
  console.log(`=== ESTADO DE PLANTILLA ${templateId} ===\n`)
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${templateId}`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify(data, null, 2))
}

async function eliminar(name: string) {
  console.log(`=== ELIMINAR PLANTILLA ${name} ===\n`)
  // Buscar el ID primero
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates?name=${name}`
  const respList = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const dataList = await respList.json()
  if (!dataList?.data?.length) {
    console.error('❌ No se encontró la plantilla con nombre:', name)
    process.exit(1)
  }
  const t = dataList.data[0]
  console.log(`Eliminando: ${t.name} [${t.language}] ID: ${t.id}`)
  const urlDel = `https://graph.facebook.com/${GRAPH_VERSION}/${t.id}`
  const resp = await fetch(urlDel, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log('✅ Eliminada:', JSON.stringify(data, null, 2))
}

async function main() {
  if (!TOKEN || !WABA_ID) {
    console.error('Faltan WHATSAPP_TOKEN o WHATSAPP_BUSINESS_ID en el entorno')
    process.exit(1)
  }
  switch (cmd) {
    case 'list': await listar(); break
    case 'create': await crear(); break
    case 'status': await estado(process.argv[3]); break
    case 'delete': await eliminar(process.argv[3]); break
    default:
      console.error('Comando inválido. Usa: list | create | status <id> | delete <name>')
      process.exit(1)
  }
}

main()
