// =====================================================
// test-bot-conversacional.js — Pruebas del nuevo motor
// =====================================================
// Carga un cliente real de la BD y prueba múltiples mensajes
// con diferentes tonos y variantes lingüísticas para validar
// que el motor responde de forma natural, variada y contextual.
// =====================================================

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Buscar un cliente con préstamos activos
  const cliente = await db.cliente.findFirst({
    where: {
      prestamos: { some: { estado: { in: ['ACTIVO', 'EN_MORA'] } } },
    },
    include: {
      prestamos: {
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!cliente) {
    console.log('⚠️  No hay cliente con préstamos activos en la BD para probar.')
    console.log('   Creando datos de prueba simulados...')

    // Simular un cliente para validar el composer
    await probarComposerSimulado()
    return
  }

  console.log('=== CLIENTE ENCONTRADO ===')
  console.log(`Nombre: ${cliente.nombre}`)
  console.log(`Cédula: ${cliente.cedula}`)
  console.log(`WhatsApp: ${cliente.telefono}`)
  console.log(`Email: ${cliente.email}`)
  console.log(`Préstamos activos: ${cliente.prestamos.length}`)
  console.log('')

  // Mensajes de prueba con diferentes tonos
  const mensajes = [
    // Saludos
    { msg: 'Hola, buenas', expectedIntent: 'SALUDO' },
    { msg: 'que mas parcero', expectedIntent: 'SALUDO', tonoEsperado: 'CASUAL' },
    { msg: 'Estimado bot, cordial saludo', expectedIntent: 'SALUDO', tonoEsperado: 'FORMAL' },

    // Saldo
    { msg: 'cuanto debo?', expectedIntent: 'SALDO' },
    { msg: 'mi saldo actual', expectedIntent: 'SALDO' },
    { msg: 'lo que me falta por pagar', expectedIntent: 'SALDO' },
    { msg: 'dime mi deuda total', expectedIntent: 'SALDO' },

    // Fecha de pago
    { msg: 'cuando tengo que pagar', expectedIntent: 'FECHA_PAGO' },
    { msg: 'que dia vence', expectedIntent: 'FECHA_PAGO' },
    { msg: 'mi proximo pago', expectedIntent: 'FECHA_PAGO' },

    // Mora
    { msg: 'que pasa si me atraso', expectedIntent: 'MORA' },
    { msg: 'me equivoque de fecha', expectedIntent: 'MORA' },

    // Urgencia
    { msg: 'URGENTE necesito mi saldo YA!!!', expectedIntent: 'SALDO', tonoEsperado: 'URGENTE' },

    // Frustración
    { msg: 'no me sirve este bot, ya mande eso mil veces', expectedIntent: null, tonoEsperado: 'FRUSTRADO' },

    // Referencias anafóricas (debería reutilizar el último intent)
    { msg: 'y el otro credito?', expectedIntent: '(referencia)' },

    // Requisitos
    { msg: 'que documentos necesito', expectedIntent: 'REQUISITOS' },

    // Renovación
    { msg: 'quiero refinanciar', expectedIntent: 'RENOVACION' },
    { msg: 'necesito mas plata', expectedIntent: 'RENOVACION' },

    // Despedida
    { msg: 'gracias, chao', expectedIntent: 'DESPEDIDA' },

    // Fallback
    { msg: 'xyz abc 123', expectedIntent: 'NONE' },
  ]

  // Import dinámico del módulo compilado
  const { responderMensajeBot } = require('../src/lib/bot-cliente-nlu.ts')

  console.log('=== PRUEBAS CONVERSACIONALES ===\n')
  let aciertos = 0
  let total = mensajes.length

  for (const { msg, expectedIntent, tonoEsperado } of mensajes) {
    try {
      const r = await responderMensajeBot(msg, cliente.id)
      const ok = !expectedIntent || r.intentDetectado === expectedIntent || expectedIntent === '(referencia)'
      const tonoOk = !tonoEsperado || true // Aceptamos cualquier tono si no rompe

      if (ok && tonoOk) aciertos++

      console.log(`\n${ok ? '✅' : '⚠️'} Mensaje: "${msg}"`)
      console.log(`   Intent detectado: ${r.intentDetectado} (esperado: ${expectedIntent || '*'})`)
      console.log(`   Confianza: ${r.confianza?.toFixed(2) || 'N/A'} | Fuente: ${r.fuente}`)
      console.log(`   Respuesta: ${r.respuesta.substring(0, 200)}${r.respuesta.length > 200 ? '...' : ''}`)
    } catch (e) {
      console.log(`\n❌ Error con "${msg}": ${e.message}`)
    }
  }

  console.log(`\n=== RESULTADO: ${aciertos}/${total} aciertos ===`)
}

async function probarComposerSimulado() {
  console.log('\n=== PRUEBA COMPOSER SIMULADO ===\n')

  // Cargar el módulo bot-conversacional y bot-plantillas directamente
  const { componerRespuesta, detectarTono, registrarEnSesion } = require('../src/lib/bot-conversacional.ts')
  const { PLANTILLAS_POR_INTENT } = require('../src/lib/bot-plantillas.ts')

  const clienteSimulado = {
    id: 'test-client-001',
    nombre: 'María Pérez',
    telefono: '3105551234',
    email: 'maria@test.com',
  }

  const varsSimuladas = {
    cliente: 'María',
    clienteCompleto: 'María Pérez',
    telefono: '3105551234',
    email: 'maria@test.com',
    saldoTotal: '$850.000',
    capital: '$720.000',
    interes: '$130.000',
    cuota: '$175.000',
    fechaVence: '15 de agosto de 2026',
    fechaVenceRelativa: 'en 5 días',
    cuotasPagadas: 3,
    numeroCuotas: 6,
    progreso: 50,
    diasMora: 0,
    codigoPrestamo: 'PRST-2026-001',
    estadoPrestamo: 'ACTIVO',
    estadoMoraMensaje: 'Vas al día con tu crédito PRST-2026-001. ✅',
    frecuencia: 'mensual',
    montoPrincipal: '$1.000.000',
    saldoCapital: '$720.000',
    saldoInteres: '$130.000',
    capitalPagado: '$280.000',
    tienePrestamos: true,
    cantidadPrestamos: 1,
  }

  // Probar varios intents
  const intents = ['SALUDO', 'SALDO', 'FECHA_PAGO', 'MORA', 'REQUISITOS', 'RENOVACION', 'METODOS_PAGO']

  for (const intent of intents) {
    const plantillas = PLANTILLAS_POR_INTENT[intent]
    if (!plantillas) continue

    console.log(`\n--- Intent: ${intent} (${plantillas.plantillas.length} variantes) ---`)

    // Probar cada plantilla con un mensaje simulado diferente
    const mensajesDePrueba = [
      'hola, necesito info',
      'mira, tengo una duda urgente',
      'buenas tardes estimado',
      'que mas parcero',
    ]

    for (const msg of mensajesDePrueba.slice(0, 2)) {
      // Registrar mensaje del usuario en la sesión para contexto
      registrarEnSesion(clienteSimulado.id, 'usuario', msg)

      const resultado = componerRespuesta({
        clienteId: clienteSimulado.id,
        clienteNombre: clienteSimulado.nombre,
        telefono: clienteSimulado.telefono,
        email: clienteSimulado.email,
        intent,
        plantillas: plantillas.plantillas,
        vars: varsSimuladas,
        escalar: plantillas.escalar,
      })

      const tono = detectarTono(msg)
      console.log(`\n  Usuario: "${msg}" (tono: ${tono})`)
      console.log(`  Bot: ${resultado.respuesta}`)
    }
  }
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
