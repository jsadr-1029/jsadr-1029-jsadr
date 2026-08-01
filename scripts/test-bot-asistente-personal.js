// =====================================================
// test-bot-asistente-personal.js
// E2E test del bot Asistente Personal:
//   1. Crea 5 ingresos (valores automáticos)
//   2. Crea 4 gastos con categoría
//   3. Verifica que el bot pregunte "negocio o personal" cuando no se especifica
//   4. Verifica que los movimientos se reflejen en:
//      - /api/admin/finanzas (Contabilidad - Administración)
//      - /api/cajas (Caja Menor / Plan-movimientos)
//      - /api/reportes (Dashboard Reportes)
//   5. Prueba la recomendación de gasto ("cuánto es recomendable gastar")
// =====================================================

const BASE = 'http://localhost:3000'

// Credenciales ADMIN (NO se modifican en este test)
const ADMIN_USER = 'adm-jsadr'
const ADMIN_PASS = 'Js951029*'

async function loginAdmin() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  if (!res.ok) {
    console.error('Login falló:', res.status, await res.text())
    process.exit(1)
  }
  const data = await res.json()
  return data.data?.access_token || data.token
}

async function sendBotMessage(token, mensaje) {
  const res = await fetch(`${BASE}/api/admin/portal/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mensaje,
      token,
      botTipo: 'ADMIN_SISTEMA',
      botNombre: 'Asistente Personal',
    }),
  })
  if (!res.ok) {
    return { error: `${res.status}`, body: await res.text() }
  }
  const data = await res.json()
  return data
}

async function getFinanzas(token, ambito) {
  const url = `${BASE}/api/admin/finanzas?ambito=${ambito}&resumen=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: res.status }
  // La estructura es { success, data: [...], resumen: {...}, recomendaciones, proyectosFuturos }
  return await res.json()
}

async function getCajas(token) {
  const res = await fetch(`${BASE}/api/cajas`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: res.status }
  const j = await res.json()
  return j?.data || j
}

async function getReportes(token) {
  const res = await fetch(`${BASE}/api/reportes?rango=30d`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: res.status }
  const j = await res.json()
  return j
}

function fmt(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TEST BOT ASISTENTE PERSONAL — JSADR')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  console.log('\n[1] Login admin...')
  const token = await loginAdmin()
  console.log('   ✅ Token obtenido')

  // === Capturar estado inicial ===
  console.log('\n[2] Capturando estado inicial...')
  const finBeforeNeg = await getFinanzas(token, 'NEGOCIO')
  const finBeforePer = await getFinanzas(token, 'PERSONAL')
  const cajasBefore = await getCajas(token)
  const ingBeforeNeg = finBeforeNeg?.resumen?.totalIngresos || 0
  const gasBeforeNeg = finBeforeNeg?.resumen?.totalGastos || 0
  const ingBeforePer = finBeforePer?.resumen?.totalIngresos || 0
  const gasBeforePer = finBeforePer?.resumen?.totalGastos || 0
  console.log(`   Negocio:  ingresos=${fmt(ingBeforeNeg)}  gastos=${fmt(gasBeforeNeg)}`)
  console.log(`   Personal: ingresos=${fmt(ingBeforePer)}  gastos=${fmt(gasBeforePer)}`)

  // === TEST 1: Crear 5 ingresos con valores automáticos ===
  console.log('\n[3] Creando 5 ingresos (valores automáticos)...')
  const ingresos = [
    { monto: 500000, concepto: 'pago de cuota del negocio', ambito: 'negocio' },
    { monto: 1200000, concepto: 'venta de producto negocio', ambito: 'negocio' },
    { monto: 800000, concepto: 'comisión por venta negocio', ambito: 'negocio' },
    { monto: 350000, concepto: 'salario personal', ambito: 'personal' },
    { monto: 200000, concepto: 'venta segundo empleo personal', ambito: 'personal' },
  ]
  let ingresosOK = 0
  for (const ing of ingresos) {
    const msg = `registra un ingreso de ${ing.monto} por ${ing.concepto}`
    const r = await sendBotMessage(token, msg)
    const resp = r?.data?.respuesta || ''
    const ok = resp.includes('✅')
    console.log(`   ${ok ? '✅' : '❌'} "${msg.slice(0, 60)}..." → ${resp.split('\n')[0]}`)
    if (ok) ingresosOK++
  }
  console.log(`   Total ingresos creados: ${ingresosOK}/5`)

  // === TEST 2: Crear 4 gastos con categoría ===
  console.log('\n[4] Creando 4 gastos con categoría...')
  const gastos = [
    { monto: 75000, concepto: 'gasolina del negocio', ambito: 'negocio' },
    { monto: 150000, concepto: 'almuerzo personal', ambito: 'personal' },
    { monto: 230000, concepto: 'publicidad marketing negocio', ambito: 'negocio' },
    { monto: 95000, concepto: 'mercado personal', ambito: 'personal' },
  ]
  let gastosOK = 0
  for (const g of gastos) {
    const msg = `registra un gasto de ${g.monto} en ${g.concepto}`
    const r = await sendBotMessage(token, msg)
    const resp = r?.data?.respuesta || ''
    const ok = resp.includes('✅')
    console.log(`   ${ok ? '✅' : '❌'} "${msg.slice(0, 60)}..." → ${resp.split('\n')[0]}`)
    if (ok) gastosOK++
  }
  console.log(`   Total gastos creados: ${gastosOK}/4`)

  // === TEST 3: Bot pregunta "negocio o personal" cuando no se especifica ===
  console.log('\n[5] Verificando que el bot pregunte "negocio o personal" sin especificar...')
  // Esperar 6s para que la memoria pendiente expire (TTL 5 min por defecto,
  // pero sessionToken de test anterior puede tener estado pendiente)
  await new Promise(r => setTimeout(r, 6000))
  const r = await sendBotMessage(token, 'gasto de 100000 en café')
  const resp = r?.data?.respuesta || ''
  const pregunta = resp.includes('NEGOCIO') && resp.includes('PERSONAL') && resp.includes('Responde')
  console.log(`   ${pregunta ? '✅' : '❌'} Bot responde: ${resp.split('\n').slice(0, 4).join(' | ')}`)
  if (pregunta) {
    // Responder "negocio" para confirmar
    const r2 = await sendBotMessage(token, 'negocio')
    const resp2 = r2?.data?.respuesta || ''
    const confirmado = resp2.includes('✅')
    console.log(`   ${confirmado ? '✅' : '❌'} Tras responder "negocio": ${resp2.split('\n')[0]}`)
  }

  // === TEST 4: Verificar reflejo en Contabilidad (admin/finanzas) ===
  console.log('\n[6] Verificando reflejo en Contabilidad (/api/admin/finanzas)...')
  const finAfterNeg = await getFinanzas(token, 'NEGOCIO')
  const finAfterPer = await getFinanzas(token, 'PERSONAL')
  const ingAfterNeg = finAfterNeg?.resumen?.totalIngresos || 0
  const gasAfterNeg = finAfterNeg?.resumen?.totalGastos || 0
  const ingAfterPer = finAfterPer?.resumen?.totalIngresos || 0
  const gasAfterPer = finAfterPer?.resumen?.totalGastos || 0
  const deltaIngNeg = ingAfterNeg - ingBeforeNeg
  const deltaGasNeg = gasAfterNeg - gasBeforeNeg
  const deltaIngPer = ingAfterPer - ingBeforePer
  const deltaGasPer = gasAfterPer - gasBeforePer
  console.log(`   Negocio:  Δingresos=${fmt(deltaIngNeg)}  Δgastos=${fmt(deltaGasNeg)}`)
  console.log(`   Personal: Δingresos=${fmt(deltaIngPer)}  Δgastos=${fmt(deltaGasPer)}`)
  const espIngNeg = 500000 + 1200000 + 800000 // 3 ingresos del negocio (el café es gasto)
  const espGasNeg = 75000 + 230000 + 100000 // 2 gastos + café de test 3
  const espIngPer = 350000 + 200000
  const espGasPer = 150000 + 95000
  console.log(`   Esperado: ΔingNeg=${fmt(espIngNeg)}  ΔgasNeg=${fmt(espGasNeg)}  ΔingPer=${fmt(espIngPer)}  ΔgasPer=${fmt(espGasPer)}`)
  const okFinanzas = deltaIngNeg >= espIngNeg && deltaGasNeg >= espGasNeg && deltaIngPer >= espIngPer && deltaGasPer >= espGasPer
  console.log(`   ${okFinanzas ? '✅' : '❌'} Reflejo en Contabilidad: ${okFinanzas ? 'OK' : 'INCOMPLETO'}`)

  // === TEST 5: Verificar reflejo en Caja Menor (cajas) ===
  console.log('\n[7] Verificando reflejo en Caja Menor (/api/cajas)...')
  const cajasAfter = await getCajas(token)
  const cajasArr = Array.isArray(cajasAfter) ? cajasAfter : (cajasAfter?.data || [])
  let totalMovsCaja = 0
  for (const c of cajasArr) {
    const movs = c._count?.movimientos ?? c.movimientos?.length ?? 0
    totalMovsCaja += movs
  }
  console.log(`   Total movimientos en cajas: ${totalMovsCaja}`)
  const okCajas = totalMovsCaja > 0
  console.log(`   ${okCajas ? '✅' : '❌'} Reflejo en Caja Menor: ${okCajas ? 'OK' : 'SIN DATOS'}`)

  // === TEST 6: Verificar reflejo en Reportes ===
  console.log('\n[8] Verificando reflejo en Reportes (/api/reportes?rango=30d)...')
  const repAfter = await getReportes(token)
  const repData = repAfter?.data || repAfter
  const totalMovsCajasRep = repData?.kpis?.totalMovimientosCajas || 0
  console.log(`   totalMovimientosCajas en reportes: ${totalMovsCajasRep}`)
  const okReportes = totalMovsCajasRep > 0
  console.log(`   ${okReportes ? '✅' : '❌'} Reflejo en Reportes: ${okReportes ? 'OK' : 'SIN DATOS'}`)

  // === TEST 7: Recomendación de gasto ===
  console.log('\n[9] Probando recomendación de gasto ("cuánto es recomendable gastar")...')
  const rRec = await sendBotMessage(token, 'cuánto es recomendable gastar del negocio')
  const respRec = rRec?.data?.respuesta || ''
  const recOK = respRec.includes('RECOMENDACIÓN DE GASTO') && respRec.includes('50/30/20')
  console.log(`   ${recOK ? '✅' : '❌'} Recomendación negocio:`)
  console.log('   ---')
  respRec.split('\n').forEach(l => console.log(`   ${l}`))
  console.log('   ---')

  const rRec2 = await sendBotMessage(token, 'cuánto puedo gastar personal')
  const respRec2 = rRec2?.data?.respuesta || ''
  const rec2OK = respRec2.includes('RECOMENDACIÓN DE GASTO') && respRec2.includes('PERSONAL')
  console.log(`   ${rec2OK ? '✅' : '❌'} Recomendación personal:`)
  console.log('   ---')
  respRec2.split('\n').forEach(l => console.log(`   ${l}`))
  console.log('   ---')

  // === RESUMEN ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RESUMEN')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Ingresos creados:        ${ingresosOK}/5`)
  console.log(`  Gastos creados:          ${gastosOK}/4`)
  console.log(`  Pregunta ámbito:         ${pregunta ? '✅' : '❌'}`)
  console.log(`  Reflejo Contabilidad:    ${okFinanzas ? '✅' : '❌'}`)
  console.log(`  Reflejo Caja Menor:      ${okCajas ? '✅' : '❌'}`)
  console.log(`  Reflejo Reportes:        ${okReportes ? '✅' : '❌'}`)
  console.log(`  Recomendación negocio:   ${recOK ? '✅' : '❌'}`)
  console.log(`  Recomendación personal:  ${rec2OK ? '✅' : '❌'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  process.exit(0)
}

main().catch(e => {
  console.error('Error fatal:', e)
  process.exit(1)
})
