// =====================================================
// test-variabilidad.js — Verifica que las respuestas
// del bot varíen entre llamadas sucesivas con el mismo
// intent (no se repita la misma plantilla dos veces seguidas)
// =====================================================

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const cliente = await db.cliente.findFirst({
    where: { prestamos: { some: { estado: { in: ['ACTIVO', 'EN_MORA'] } } } },
    select: { id: true, nombre: true, telefono: true, email: true },
  })

  if (!cliente) {
    console.log('⚠️ No hay cliente con préstamos. Abortando.')
    return
  }

  console.log(`=== TEST DE VARIABILIDAD ===`)
  console.log(`Cliente: ${cliente.nombre}\n`)

  const { responderMensajeBot } = require('../src/lib/bot-cliente-nlu.ts')

  // Hacer 5 consultas de saldo idénticas
  const consultas = [
    'cuanto debo',
    'mi saldo',
    'cuanto debo',
    'saldo',
    'cuanto debo',
  ]

  console.log('--- 5 consultas de SALDO (deben variar) ---\n')
  const respuestas = new Set()
  for (const q of consultas) {
    const r = await responderMensajeBot(q, cliente.id)
    console.log(`👤 "${q}" →`)
    console.log(`🤖 ${r.respuesta}\n`)
    respuestas.add(r.respuesta)
  }

  console.log(`\n=== ANÁLISIS ===`)
  console.log(`Consultas: ${consultas.length}`)
  console.log(`Respuestas únicas: ${respuestas.size}`)
  if (respuestas.size >= 3) {
    console.log('✅ El bot está variando las respuestas correctamente.')
  } else if (respuestas.size >= 2) {
    console.log('⚠️ Variabilidad moderada — debería ser mayor.')
  } else {
    console.log('❌ El bot NO está variando — siempre da la misma respuesta.')
  }

  // Probar diferentes tonos
  console.log('\n--- Test de tonos ---\n')

  const tonos = [
    { msg: 'hola necesito saber mi saldo', desc: 'NEUTRO' },
    { msg: 'URGENTE MI SALDO YA!!!', desc: 'URGENTE' },
    { msg: 'por favor necesito saber mi saldo', desc: 'FORMAL' },
    { msg: 'dame el saldo parcero', desc: 'CASUAL' },
    { msg: 'otra vez lo mismo, no me sirve este bot, mi saldo', desc: 'FRUSTRADO' },
  ]

  for (const { msg, desc } of tonos) {
    const r = await responderMensajeBot(msg, cliente.id)
    console.log(`👤 [${desc}] "${msg}"`)
    console.log(`🤖 ${r.respuesta}\n`)
  }
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
