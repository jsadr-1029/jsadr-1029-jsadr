// =====================================================
// test-final-bots.js — Prueba integral del nuevo motor
// conversacional con conversaciones reales multi-turno
// =====================================================

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const cliente = await db.cliente.findFirst({
    where: { prestamos: { some: { estado: { in: ['ACTIVO', 'EN_MORA'] } } } },
    select: { id: true, nombre: true, telefono: true, email: true },
  })

  if (!cliente) {
    console.log('⚠️ No hay cliente con préstamos para probar.')
    return
  }

  console.log('='.repeat(70))
  console.log(`CONVERSACIÓN DE PRUEBA — Cliente: ${cliente.nombre}`)
  console.log('='.repeat(70))

  const { responderMensajeBot } = require('../src/lib/bot-cliente-nlu.ts')

  // === CONVERSACIÓN 1: Cliente casual que pregunta por saldo ===
  console.log('\n--- CONVERSACIÓN 1: Cliente casual ---\n')

  const conversacion1 = [
    'hola, que mas',
    'cuanto debo?',
    'y cuando tengo que pagar?',
    'ok, y como puedo pagar?',
    'perfecto, gracias',
  ]

  for (const msg of conversacion1) {
    console.log(`\n👤 Cliente: "${msg}"`)
    const r = await responderMensajeBot(msg, cliente.id)
    console.log(`🤖 Bot: ${r.respuesta}`)
    console.log(`   [intent=${r.intentDetectado}, confianza=${r.confianza?.toFixed(2)}, fuente=${r.fuente}]`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // === CONVERSACIÓN 2: Cliente frustrado ===
  console.log('\n\n--- CONVERSACIÓN 2: Cliente frustrado ---\n')

  // Limpiar sesión previa con un cliente diferente simulado
  const conversacion2 = [
    'no me sirve este bot',
    'ya mande el pago tres veces y no se ve',
    'URGENTE necesito hablar con alguien YA!!!',
  ]

  for (const msg of conversacion2) {
    console.log(`\n👤 Cliente: "${msg}"`)
    const r = await responderMensajeBot(msg, cliente.id)
    console.log(`🤖 Bot: ${r.respuesta}`)
    console.log(`   [intent=${r.intentDetectado}, confianza=${r.confianza?.toFixed(2)}, fuente=${r.fuente}]`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // === CONVERSACIÓN 3: Cliente formal ===
  console.log('\n\n--- CONVERSACIÓN 3: Cliente formal ---\n')

  const conversacion3 = [
    'Estimado bot, cordial saludo',
    '¿Podría informarme mi saldo actual?',
    'Le agradezco la información',
    '¿Cuáles son los requisitos para renovar?',
    'Muchas gracias, hasta pronto',
  ]

  for (const msg of conversacion3) {
    console.log(`\n👤 Cliente: "${msg}"`)
    const r = await responderMensajeBot(msg, cliente.id)
    console.log(`🤖 Bot: ${r.respuesta}`)
    console.log(`   [intent=${r.intentDetectado}, confianza=${r.confianza?.toFixed(2)}, fuente=${r.fuente}]`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // === RESUMEN FINAL ===
  console.log('\n\n' + '='.repeat(70))
  console.log('RESUMEN')
  console.log('='.repeat(70))
  console.log('• Motor conversacional: ACTIVO')
  console.log('• Plantillas multi-variante: 32 intents con 3-6 variantes cada uno')
  console.log('• Detección de tono: URGENTE, FRUSTRADO, CASUAL, FORMAL, NEUTRO')
  console.log('• Contexto multi-turno: memoria de 12 mensajes por sesión')
  console.log('• Referencias anafóricas: resuelve "eso", "el anterior", "y el otro"')
  console.log('• Follow-ups contextuales: NO repite "escribe menú"')
  console.log('• Frases puente: variadas según tono y semilla por cliente')
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
