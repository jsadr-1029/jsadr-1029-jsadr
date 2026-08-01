/**
 * Test the bot NLU with a battery of realistic client queries.
 * Measures: % of queries that get a confident match (not fallback).
 * Run with: npx tsx scripts/test-bot-nlu.ts
 */
const { responderMensajeBot, detectarIntentBot, INTENTS_BOT_CLIENTE } = require('../src/lib/bot-cliente-nlu')

// === Batería de pruebas: 80 mensajes realistas del portal ===
// Cubriendo: saludos, saldo, pagos, préstamos, jurídico, portal, info, asesor, FAQ
// Incluye: variantes con/sin acentos, typos, abreviaciones, lenguaje coloquial
const TESTS = [
  // === SALUDOS (8) ===
  { msg: 'hola', expected: 'SALUDO' },
  { msg: 'buenos dias', expected: 'SALUDO' },
  { msg: 'buenas tardes', expected: 'SALUDO' },
  { msg: 'holi', expected: 'SALUDO' },
  { msg: 'hey', expected: 'SALUDO' },
  { msg: 'saludos', expected: 'SALUDO' },
  { msg: 'que tal', expected: 'SALUDO_PERSONAL' },
  { msg: 'como estas', expected: 'SALUDO_PERSONAL' },

  // === MENÚ (6) ===
  { msg: 'menu', expected: 'MENU' },
  { msg: 'ayuda', expected: 'MENU' },
  { msg: 'help', expected: 'MENU' },
  { msg: 'opciones', expected: 'MENU' },
  { msg: 'que puedes hacer', expected: 'MENU' },
  { msg: 'que haces', expected: 'MENU' },

  // === SALDO (10) ===
  { msg: 'saldo', expected: 'SALDO' },
  { msg: 'cuanto debo', expected: 'SALDO' },
  { msg: 'cuanto pago', expected: 'SALDO' },
  { msg: 'mi prestamo', expected: 'SALDO' },
  { msg: 'lo que debo', expected: 'SALDO' },
  { msg: 'mi obligacion', expected: 'SALDO' },
  { msg: 'cuanto me queda', expected: 'SALDO' },
  { msg: 'saldo pendiente', expected: 'SALDO' },
  { msg: 'cuanto llevo pagado', expected: 'SALDO' },
  { msg: 'cual es mi deuda', expected: 'SALDO' },

  // === FECHA PAGO (8) ===
  { msg: 'fecha de pago', expected: 'FECHA_PAGO' },
  { msg: 'cuando pago', expected: 'FECHA_PAGO' },
  { msg: 'cuando vence', expected: 'FECHA_PAGO' },
  { msg: 'proximo pago', expected: 'FECHA_PAGO' },
  { msg: 'cuando es mi pago', expected: 'FECHA_PAGO' },
  { msg: 'fecha de vencimiento', expected: 'FECHA_PAGO' },
  { msg: 'cuando tengo que pagar', expected: 'FECHA_PAGO' },
  { msg: 'mi proxima cuota', expected: 'FECHA_PAGO' },

  // === CUOTAS PAGADAS (7) ===
  { msg: 'cuotas pagadas', expected: 'CUOTAS_PAGADAS' },
  { msg: 'historial', expected: 'CUOTAS_PAGADAS' },
  { msg: 'progreso', expected: 'CUOTAS_PAGADAS' },
  { msg: 'cuanto he pagado', expected: 'CUOTAS_PAGADAS' },
  { msg: 'avance', expected: 'CUOTAS_PAGADAS' },
  { msg: 'mis pagos', expected: 'CUOTAS_PAGADAS' },
  { msg: 'pagos realizados', expected: 'CUOTAS_PAGADAS' },

  // === MÉTODOS PAGO (8) ===
  { msg: 'como pago', expected: 'METODOS_PAGO' },
  { msg: 'pagar', expected: 'METODOS_PAGO' },
  { msg: 'abonar', expected: 'METODOS_PAGO' },
  { msg: 'bancolombia', expected: 'METODOS_PAGO' },
  { msg: 'pse', expected: 'METODOS_PAGO' },
  { msg: 'efectivo', expected: 'METODOS_PAGO' },
  { msg: 'nequi', expected: 'METODOS_PAGO' },
  { msg: 'metodos de pago', expected: 'METODOS_PAGO' },

  // === RENOVACIÓN (6) ===
  { msg: 'renovacion', expected: 'RENOVACION' },
  { msg: 'renovar', expected: 'RENOVACION' },
  { msg: 'refinanciar', expected: 'RENOVACION' },
  { msg: 'ampliar', expected: 'RENOVACION' },
  { msg: 'renovar prestamo', expected: 'RENOVACION' },
  { msg: 'cuando puedo renovar', expected: 'RENOVACION' },

  // === REQUISITOS (7) ===
  { msg: 'requisitos', expected: 'REQUISITOS' },
  { msg: 'documentos', expected: 'REQUISITOS' },
  { msg: 'como solicito', expected: 'REQUISITOS' },
  { msg: 'credito nuevo', expected: 'REQUISITOS' },
  { msg: 'nuevo credito', expected: 'REQUISITOS' },
  { msg: 'que necesito para un credito', expected: 'REQUISITOS' },
  { msg: 'documentacion', expected: 'REQUISITOS' },

  // === SIMULADOR (5) ===
  { msg: 'simular', expected: 'SIMULADOR' },
  { msg: 'simulador', expected: 'SIMULADOR' },
  { msg: 'calcular cuota', expected: 'SIMULADOR' },
  { msg: 'cuanto seria la cuota', expected: 'SIMULADOR' },
  { msg: 'cuanto pagaria', expected: 'SIMULADOR' },

  // === TASA (5) ===
  { msg: 'tasa', expected: 'TASA_INTERES' },
  { msg: 'interes', expected: 'TASA_INTERES' },
  { msg: 'tasa de interes', expected: 'TASA_INTERES' },
  { msg: 'interes moratorio', expected: 'TASA_INTERES' },
  { msg: 'cuanto es el interes', expected: 'TASA_INTERES' },

  // === MONTO (5) ===
  { msg: 'monto', expected: 'MONTO_PRESTAMO' },
  { msg: 'cuanto prestan', expected: 'MONTO_PRESTAMO' },
  { msg: 'cuanto me prestan', expected: 'MONTO_PRESTAMO' },
  { msg: 'monto maximo', expected: 'MONTO_PRESTAMO' },
  { msg: 'cuanto puedo pedir', expected: 'MONTO_PRESTAMO' },

  // === PLAZO (4) ===
  { msg: 'plazo', expected: 'PLAZO' },
  { msg: 'cuantos meses', expected: 'PLAZO' },
  { msg: 'duracion del prestamo', expected: 'PLAZO' },
  { msg: 'frecuencia de pago', expected: 'PLAZO' },

  // === FONDO GARANTÍA (3) ===
  { msg: 'fondo de garantia', expected: 'FONDO_GARANTIA' },
  { msg: 'garantia', expected: 'FONDO_GARANTIA' },
  { msg: '5 por ciento', expected: 'FONDO_GARANTIA' },

  // === MORA (5) ===
  { msg: 'mora', expected: 'MORA' },
  { msg: 'atraso', expected: 'MORA' },
  { msg: 'retraso', expected: 'MORA' },
  { msg: 'no pude pagar', expected: 'RENEGOCIACION' },
  { msg: 'que pasa si no pago', expected: 'MORA' },

  // === PIN (8) ===
  { msg: 'cambiar pin', expected: 'PIN_CAMBIAR' },
  { msg: 'nuevo pin', expected: 'PIN_CAMBIAR' },
  { msg: 'cambiar clave', expected: 'PIN_CAMBIAR' },
  { msg: 'olvide mi pin', expected: 'PIN_OLVIDO' },
  { msg: 'no me acuerdo del pin', expected: 'PIN_OLVIDO' },
  { msg: 'recuperar pin', expected: 'PIN_OLVIDO' },
  { msg: 'olvide contrasena', expected: 'PIN_OLVIDO' },
  { msg: 'resetear pin', expected: 'PIN_OLVIDO' },

  // === PORTAL (5) ===
  { msg: 'como entro', expected: 'ACCESO_PORTAL' },
  { msg: 'como accedo', expected: 'ACCESO_PORTAL' },
  { msg: 'no puedo entrar', expected: 'ACCESO_PORTAL' },
  { msg: 'cuenta bloqueada', expected: 'PORTAL_BLOQUEO' },
  { msg: 'intentos fallidos', expected: 'PORTAL_BLOQUEO' },

  // === ASESOR (8) ===
  { msg: 'asesor', expected: 'ASESOR_HUMANO' },
  { msg: 'humano', expected: 'ASESOR_HUMANO' },
  { msg: 'hablar con alguien', expected: 'ASESOR_HUMANO' },
  { msg: 'operador', expected: 'ASESOR_HUMANO' },
  { msg: 'agente', expected: 'ASESOR_HUMANO' },
  { msg: 'llamenme', expected: 'ASESOR_HUMANO' },
  { msg: 'necesito una persona', expected: 'ASESOR_HUMANO' },
  { msg: 'quiero hablar', expected: 'ASESOR_HUMANO' },

  // === QUEJAS (4) ===
  { msg: 'queja', expected: 'QUEJA_RECLAMO' },
  { msg: 'reclamo', expected: 'QUEJA_RECLAMO' },
  { msg: 'pqrs', expected: 'QUEJA_RECLAMO' },
  { msg: 'no estoy de acuerdo', expected: 'QUEJA_RECLAMO' },

  // === INFO (6) ===
  { msg: 'horario', expected: 'HORARIOS' },
  { msg: 'a que hora', expected: 'HORARIOS' },
  { msg: 'telefono', expected: 'CONTACTO' },
  { msg: 'whatsapp', expected: 'CONTACTO' },
  { msg: 'correo', expected: 'CONTACTO' },
  { msg: 'donde quedan', expected: 'UBICACION' },

  // === FAQ (8) ===
  { msg: 'codeudor', expected: 'CODEUDOR' },
  { msg: 'fiador', expected: 'CODEUDOR' },
  { msg: 'cuando me depositan', expected: 'DESEMBOLSO' },
  { msg: 'desembolso', expected: 'DESEMBOLSO' },
  { msg: 'cancelar prestamo', expected: 'CANCELAR_PRESTAMO' },
  { msg: 'pago anticipado', expected: 'PAGO_ANTICIPADO' },
  { msg: 'saldar', expected: 'PAGO_ANTICIPADO' },
  { msg: 'paz y salvo', expected: 'DESEMPENO_3' },

  // === DESPEDIDA (5) ===
  { msg: 'gracias', expected: 'DESPEDIDA' },
  { msg: 'muchas gracias', expected: 'DESPEDIDA' },
  { msg: 'chao', expected: 'DESPEDIDA' },
  { msg: 'perfecto', expected: 'DESPEDIDA' },
  { msg: 'listo', expected: 'DESPEDIDA' },

  // === CON TEXTO EXTRA / CONTEXTO (5) ===
  { msg: 'hola quiero saber mi saldo', expected: 'SALDO' },
  { msg: 'buenas, cuanto debo actualmente', expected: 'SALDO' },
  { msg: 'por favor dime cuando es mi proximo pago', expected: 'FECHA_PAGO' },
  { msg: 'necesito hablar con un asesor urgente', expected: 'ASESOR_HUMANO' },
  { msg: 'olvide mi pin ayuda', expected: 'PIN_OLVIDO' },

  // === TYPOS / FRASES INCOMPLETAS (5) ===
  { msg: 'k debo', expected: 'SALDO' },  // puede fallar
  { msg: 'mnsaje', expected: null },     // espero fallback
  { msg: 'quiero ren', expected: 'RENOVACION' },
  { msg: 'pago?', expected: 'METODOS_PAGO' },
  { msg: 'sald', expected: 'SALDO' },
]

async function main() {
  console.log(`\n🧪 Probando ${TESTS.length} mensajes contra el NLU del bot...\n`)

  let aciertos = 0
  let fallbacks = 0
  let errores = 0
  const detalles = []

  for (const test of TESTS) {
    const deteccion = detectarIntentBot(test.msg)
    const intentId = deteccion.intent?.id || null
    const confianza = deteccion.confianza

    let status = '❌'
    if (intentId === test.expected) {
      status = '✅'
      aciertos++
    } else if (intentId === null) {
      status = '⚠️'
      fallbacks++
      if (test.expected === null) {
        status = '✅'
        aciertos++
      }
    } else {
      errores++
    }

    detalles.push({
      msg: test.msg,
      esperado: test.expected,
      detectado: intentId,
      confianza: confianza.toFixed(2),
      metodo: deteccion.metodo,
      status,
    })
  }

  // === IMPRIMIR RESULTADOS ===
  const total = TESTS.length
  const pctAciertos = (aciertos / total * 100).toFixed(1)
  const pctFallback = (fallbacks / total * 100).toFixed(1)
  const pctErrores = (errores / total * 100).toFixed(1)

  console.log('=== RESUMEN ===')
  console.log(`Total mensajes:        ${total}`)
  console.log(`✅ Aciertos:            ${aciertos} (${pctAciertos}%)`)
  console.log(`⚠️  Fallbacks a LLM:    ${fallbacks} (${pctFallback}%)`)
  console.log(`❌ Errores (otro intent): ${errores} (${pctErrores}%)`)
  console.log(`\n📈 TASA DE ATENCIÓN: ${pctAciertos}% + ${pctFallback}% (LLM) = ${(parseFloat(pctAciertos) + parseFloat(pctFallback)).toFixed(1)}%`)
  console.log(`   (objetivo: >=95%)\n`)

  // === DETALLES DE FALLOS ===
  console.log('=== FALLOS DETALLADOS ===')
  for (const d of detalles) {
    if (d.status !== '✅') {
      console.log(`  ${d.status} "${d.msg}"`)
      console.log(`     esperado: ${d.esperado} | detectado: ${d.detectado} | confianza: ${d.confianza} | metodo: ${d.metodo}`)
    }
  }

  // === ESTADÍSTICAS POR INTENT ===
  console.log('\n=== ESTADÍSTICAS POR INTENT ===')
  const byIntent = {}
  for (const d of detalles) {
    const key = d.esperado || 'FALLBACK_ESPERADO'
    byIntent[key] = byIntent[key] || { total: 0, aciertos: 0 }
    byIntent[key].total++
    if (d.status === '✅') byIntent[key].aciertos++
  }
  for (const [intent, stats] of Object.entries(byIntent)) {
    const pct = (stats.aciertos / stats.total * 100).toFixed(0)
    const flag = pct === '100' ? '✅' : pct >= '50' ? '⚠️' : '❌'
    console.log(`  ${flag} ${intent.padEnd(20)} ${stats.aciertos}/${stats.total} (${pct}%)`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
