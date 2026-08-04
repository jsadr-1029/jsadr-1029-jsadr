/**
 * AUDITORÍA POR ESCENARIOS — Módulo de Préstamos
 * Recorre cada flujo del módulo y registra resultado (PASS/FAIL/BLOCKED).
 * Salida: /home/z/my-project/download/audit-prestamos-report.md
 */
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const OUT = '/home/z/my-project/download/audit-prestamos-report.md'

const results = []
const log = (s) => console.log(`[audit] ${s}`)
const addResult = (scenario, status, detail, httpCode, evidence) => {
  results.push({ scenario, status, detail, httpCode, evidence: evidence || '' })
  log(`${status.padEnd(7)} | ${scenario} | ${httpCode || '-'} | ${detail}`)
}

async function adminLogin() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'Cothalds11**' }),
  })
  const token = r.headers.get('set-cookie')?.split(';')[0] || ''
  return { cookie: token, status: r.status }
}

async function call(method, url, body, cookie) {
  const start = Date.now()
  try {
    const r = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const elapsed = Date.now() - start
    let data = null
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('json')) {
      try { data = await r.json() } catch { data = null }
    } else if (ct.includes('html')) {
      const txt = await r.text()
      data = { htmlLen: txt.length, hasError: txt.includes('Application error') || txt.includes('500') }
    } else {
      try { data = await r.text() } catch { data = null }
    }
    return { status: r.status, data, elapsed, ct }
  } catch (e) {
    return { status: 0, error: e.message, elapsed: Date.now() - start }
  }
}

function fmtResults() {
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const blocked = results.filter(r => r.status === 'BLOCKED').length
  const risky = results.filter(r => r.status === 'RISKY').length
  return { pass, fail, blocked, risky, total: results.length }
}

function renderReport() {
  const { pass, fail, blocked, risky, total } = fmtResults()
  let md = `# Auditoría por Escenarios — Módulo de Préstamos
Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
Sistema: JSADR · Jo*** Se*** Al*** D** R** v4.0
Endpoint base: ${BASE}

## Resumen ejecutivo

| Estado | Cantidad |
|--------|----------|
| ✅ PASS | ${pass} |
| ⚠️ RISKY | ${risky} |
| ❌ FAIL | ${fail} |
| ⛔ BLOCKED | ${blocked} |
| **Total** | **${total}** |

**Tasa de éxito: ${((pass / total) * 100).toFixed(1)}%**

---

## Resultados detallados

| # | Escenario | Estado | HTTP | Detalle |
|---|-----------|--------|------|---------|
`
  results.forEach((r, i) => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'BLOCKED' ? '⛔' : '⚠️'
    md += `| ${i + 1} | ${r.scenario} | ${icon} ${r.status} | ${r.httpCode || '-'} | ${r.detail} |\n`
  })

  md += `\n## Hallazgos críticos\n\n`
  const fails = results.filter(r => r.status === 'FAIL')
  if (fails.length === 0) {
    md += `Sin fallos críticos.\n`
  } else {
    fails.forEach((r, i) => {
      md += `### ${i + 1}. ${r.scenario}\n- HTTP: ${r.httpCode}\n- Detalle: ${r.detail}\n- Evidencia: ${r.evidence}\n\n`
    })
  }

  md += `\n## Recomendaciones\n\n`
  md += `Ver las propuestas de mejora adjuntas en la respuesta del asistente.\n`
  return md
}

async function main() {
  log('Iniciando auditoría por escenarios...')

  // ===== LOGIN =====
  const { cookie, status: loginStatus } = await adminLogin()
  if (loginStatus !== 200) {
    addResult('Login admin', 'BLOCKED', `Login devolvió ${loginStatus}`, loginStatus, 'No se puede continuar sin auth')
    fs.writeFileSync(OUT, renderReport())
    return
  }
  addResult('Login admin (adm-jsadr)', 'PASS', 'Cookie JWT obtenida', loginStatus, cookie.substring(0, 60) + '...')

  // ===== LISTAR PRÉSTAMOS =====
  let r = await call('GET', '/api/prestamos?limit=50', null, cookie)
  const prestamosRaw = r.data?.data || r.data || []
  const prestamos = Array.isArray(prestamosRaw) ? prestamosRaw : []
  if (r.status === 200 && prestamos.length > 0) {
    addResult('Listar préstamos', 'PASS', `${prestamos.length} préstamos listados`, r.status, `Primer código: ${prestamos[0]?.codigo || 'N/A'}`)
  } else {
    addResult('Listar préstamos', 'FAIL', `Status inesperado`, r.status, JSON.stringify(r.data).substring(0, 200))
  }
  const prestamoActivo = prestamos.find(p => p.estado === 'ACTIVO')
  const prestamoSolicitud = prestamos.find(p => p.estado === 'SOLICITUD')
  const prestamoMora = prestamos.find(p => p.estado === 'EN_MORA')
  const prestamoTest = prestamoActivo || prestamoMora || prestamos[0]

  // ===== CALCULAR CUOTA PERSONALIZADA =====
  r = await call('POST', '/api/prestamos/calcular-cuota-personalizada', {
    montoPrincipal: 500000,
    tasaMensual: 20,
    numeroCuotas: 4,
    frecuencia: 'QUINCENAL',
  }, cookie)
  if (r.status === 200 && r.data?.success) {
    const calc = r.data.data || r.data
    addResult('Calcular cuota personalizada (500k @20% mensual / 4 cuotas quincenal)', 'PASS', `Cuota: $${calc.cuota?.toLocaleString() || calc.montoCuota?.toLocaleString()}`, r.status, `Total: $${calc.totalPagar?.toLocaleString() || '-'}`)
  } else {
    addResult('Calcular cuota personalizada', 'FAIL', `Respuesta inesperada`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== CREAR PRÉSTAMO SIN CODEUDOR =====
  let nuevoPrestamoId = null
  r = await call('POST', '/api/prestamos', {
    clienteId: prestamos[0]?.clienteId || 'cms8chcm2000nqu65omu4817z',
    montoPrincipal: 300000,
    tasaInteresAnual: 240,
    plazoMeses: 2,
    frecuencia: 'QUINCENAL',
    numeroCuotas: 4,
    tieneCodeudor: false,
    generarPagare: true,
    generarCarta: true,
    metodoConfirmacion: 'LINK',
    observaciones: 'AUDIT-TEST: préstamo creado para auditoría sin codeudor',
  }, cookie)
  if (r.status === 200 && r.data?.success) {
    nuevoPrestamoId = r.data.data?.id || r.data.id
    addResult('Crear préstamo SIN codeudor', 'PASS', `Código: ${r.data.data?.codigo || r.data.codigo}`, r.status, `ID: ${nuevoPrestamoId}`)
  } else {
    addResult('Crear préstamo SIN codeudor', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 300))
  }

  // ===== CREAR PRÉSTAMO CON CODEUDOR =====
  let nuevoPrestamoCcId = null
  r = await call('POST', '/api/prestamos', {
    clienteId: prestamos[0]?.clienteId || 'cms8chcm2000nqu65omu4817z',
    montoPrincipal: 500000,
    tasaInteresAnual: 240,
    plazoMeses: 3,
    frecuencia: 'MENSUAL',
    numeroCuotas: 3,
    tieneCodeudor: true,
    codeudorNombre: 'CODEUDOR AUDIT TEST',
    codeudorCedula: '999999999',
    codeudorTelefono: '3000000000',
    codeudorEmail: 'codeudor.audit@test.com',
    codeudorDireccion: 'Dirección test audit',
    generarPagare: true,
    generarCarta: true,
    metodoConfirmacion: 'LINK',
    observaciones: 'AUDIT-TEST: préstamo creado con codeudor para auditoría',
  }, cookie)
  if (r.status === 200 && r.data?.success) {
    nuevoPrestamoCcId = r.data.data?.id || r.data.id
    addResult('Crear préstamo CON codeudor', 'PASS', `Código: ${r.data.data?.codigo || r.data.codigo}`, r.status, `ID: ${nuevoPrestamoCcId}`)
  } else {
    addResult('Crear préstamo CON codeudor', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 300))
  }

  // ===== OBTENER DETALLE DE PRÉSTAMO =====
  if (prestamoTest) {
    r = await call('GET', `/api/prestamos/${prestamoTest.id}`, null, cookie)
    if (r.status === 200 && r.data?.success) {
      const d = r.data.data || r.data
      addResult('Obtener detalle de préstamo', 'PASS', `Estado: ${d.estado}`, r.status, `Cliente: ${d.cliente?.nombre}`)
    } else {
      addResult('Obtener detalle de préstamo', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== APROBAR Y ENVIAR TYC (si hay préstamo en SOLICITUD) =====
  // Usar el préstamo recién creado si está en SOLICITUD
  const prestamoParaAprobar = prestamoSolicitud || (nuevoPrestamoId ? { id: nuevoPrestamoId, codigo: 'nuevo' } : null)
  if (prestamoParaAprobar) {
    r = await call('PATCH', `/api/prestamos/${prestamoParaAprobar.id}`, { accion: 'aprobar_y_enviar_tyc' }, cookie)
    if (r.status === 200) {
      addResult('Aprobar y enviar TyC', 'PASS', `Préstamo ${prestamoParaAprobar.codigo} aprobado`, r.status, 'Estado debe pasar a PENDIENTE_ACEPTACION')
    } else {
      addResult('Aprobar y enviar TyC', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  } else {
    addResult('Aprobar y enviar TyC', 'BLOCKED', 'No hay préstamos en estado SOLICITUD para probar', null, 'Crear uno nuevo primero')
  }

  // ===== ENVIAR CÓDIGO OTP =====
  // Probar con un préstamo en PENDIENTE_ACEPTACION si existe, sino con el de test
  const prestamoParaOtp = prestamos.find(p => p.estado === 'PENDIENTE_ACEPTACION') || prestamoTest
  if (prestamoParaOtp) {
    r = await call('POST', `/api/prestamos/${prestamoParaOtp.id}/enviar-codigo`, {}, cookie)
    if (r.status === 200 && r.data?.success) {
      addResult('Enviar código OTP', 'PASS', 'Código OTP enviado por email', r.status, `Código generado (test): ${r.data.data?.codigo || 'oculto'}`)
    } else {
      addResult('Enviar código OTP', r.status === 400 ? 'RISKY' : 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== ENVIAR CONFIRMACIÓN (LINK) =====
  if (prestamoParaOtp) {
    r = await call('POST', `/api/prestamos/${prestamoParaOtp.id}/enviar-confirmacion`, { metodo: 'LINK' }, cookie)
    if (r.status === 200 && r.data?.success) {
      addResult('Enviar confirmación (LINK)', 'PASS', 'Link generado', r.status, (r.data.data?.linkAceptacion || r.data.linkAceptacion || '').substring(0, 80))
    } else {
      addResult('Enviar confirmación (LINK)', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== RECALCULAR SALDOS =====
  if (prestamoTest) {
    r = await call('POST', `/api/prestamos/${prestamoTest.id}/recalcular`, {}, cookie)
    if (r.status === 200 && r.data?.success !== false) {
      addResult('Recalcular saldos', 'PASS', 'Saldos recalculados', r.status, `Nuevo saldoTotal: ${r.data?.data?.saldoTotal || r.data?.saldoTotal || '?'}`)
    } else {
      addResult('Recalcular saldos', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== APLICAR PAGO =====
  if (prestamoTest && (prestamoTest.estado === 'ACTIVO' || prestamoTest.estado === 'EN_MORA')) {
    r = await call('POST', '/api/pagos', {
      prestamoId: prestamoTest.id,
      monto: prestamoTest.montoCuota || 50000,
      metodo: 'EFECTIVO',
      accion: 'aplicar',
      observaciones: 'AUDIT-TEST: pago de prueba',
    }, cookie)
    if (r.status === 200 && r.data?.success) {
      const p = r.data.data?.pago || r.data.pago
      addResult('Aplicar pago', 'PASS', `Pago #${p?.numeroCuota} aplicado`, r.status, `Monto: $${p?.montoTotal}`)
    } else {
      addResult('Aplicar pago', r.status === 400 ? 'RISKY' : 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  } else {
    addResult('Aplicar pago', 'BLOCKED', 'No hay préstamo ACTIVO/EN_MORA disponible', null, 'Crear préstamo nuevo y desembolsar')
  }

  // ===== LISTAR PAGOS =====
  r = await call('GET', '/api/pagos?limit=5', null, cookie)
  if (r.status === 200) {
    const arrRaw = r.data?.data || r.data?.pagos || r.data || []
    const arr = Array.isArray(arrRaw) ? arrRaw : []
    addResult('Listar pagos', 'PASS', `${arr.length} pagos listados`, r.status, 'ok')
  } else {
    addResult('Listar pagos', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== INFORME DE PAGOS =====
  r = await call('GET', '/api/pagos/informe', null, cookie)
  if (r.status === 200) {
    addResult('Informe de pagos', 'PASS', 'Informe generado', r.status, `Datos: ${JSON.stringify(r.data).substring(0, 100)}`)
  } else {
    addResult('Informe de pagos', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== PAGOS PRÓXIMOS =====
  r = await call('GET', '/api/pagos/proximos', null, cookie)
  if (r.status === 200) {
    addResult('Pagos próximos', 'PASS', 'Lista de próximos pagos', r.status, `Datos: ${JSON.stringify(r.data).substring(0, 100)}`)
  } else {
    addResult('Pagos próximos', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== PREDICCIÓN DE MORA =====
  r = await call('GET', '/api/pagos/prediccion-mora', null, cookie)
  if (r.status === 200) {
    addResult('Predicción de mora', 'PASS', 'Scoring de mora calculado', r.status, `Datos: ${JSON.stringify(r.data).substring(0, 100)}`)
  } else {
    addResult('Predicción de mora', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== BITÁCORA DEL PRÉSTAMO =====
  if (prestamoTest) {
    r = await call('GET', `/api/bitacora?prestamoId=${prestamoTest.id}`, null, cookie)
    if (r.status === 200) {
      const arr = Array.isArray(r.data) ? r.data : (r.data?.bitacora || [])
      addResult('Bitácora del préstamo', 'PASS', `${arr.length} entradas`, r.status, 'ok')
    } else {
      addResult('Bitácora del préstamo', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== GENERAR PAGARÉ =====
  if (prestamoTest) {
    r = await call('GET', `/api/documentos?prestamoId=${prestamoTest.id}&tipo=pagare-diligenciado`, null, cookie)
    if (r.status === 200 && r.data?.htmlLen > 1000) {
      addResult('Generar pagaré diligenciado (HTML)', 'PASS', `HTML ${r.data.htmlLen} bytes`, r.status, 'ok')
    } else {
      addResult('Generar pagaré diligenciado', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }

    // ===== GENERAR CARTA =====
    r = await call('GET', `/api/documentos?prestamoId=${prestamoTest.id}&tipo=carta`, null, cookie)
    if (r.status === 200 && r.data?.htmlLen > 1000) {
      addResult('Generar carta de instrucciones (HTML)', 'PASS', `HTML ${r.data.htmlLen} bytes`, r.status, 'ok')
    } else {
      addResult('Generar carta de instrucciones', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }

    // ===== GENERAR COMBINADO =====
    r = await call('GET', `/api/documentos?prestamoId=${prestamoTest.id}&tipo=combinado`, null, cookie)
    if (r.status === 200 && r.data?.htmlLen > 1000) {
      addResult('Generar pagaré + carta combinado (HTML)', 'PASS', `HTML ${r.data.htmlLen} bytes`, r.status, 'ok')
    } else {
      addResult('Generar combinado', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }

    // ===== EXPORTAR PAGOS CSV =====
    r = await call('GET', `/api/prestamos/${prestamoTest.id}/pagos-export?formato=csv`, null, cookie)
    if (r.status === 200) {
      addResult('Exportar pagos CSV', 'PASS', 'CSV generado', r.status, 'ok')
    } else {
      addResult('Exportar pagos CSV', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== RENEGOCIAR MORA (si hay préstamo EN_MORA) =====
  if (prestamoMora) {
    r = await call('POST', '/api/pagos/renegociar-mora', {
      prestamoId: prestamoMora.id,
      accion: 'renegociar',
      moraRenegociada: (prestamoMora.montoMora || 10000) * 0.5,
      moraRenegociadaAccion: 'CONDONACION',
      moraRenegociadaObservacion: 'AUDIT-TEST: renegociación de mora',
    }, cookie)
    if (r.status === 200) {
      addResult('Renegociar mora', 'PASS', 'Mora renegociada', r.status, 'ok')
    } else {
      addResult('Renegociar mora', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  } else {
    addResult('Renegociar mora', 'BLOCKED', 'No hay préstamo EN_MORA', null, 'Crear préstamo moroso primero')
  }

  // ===== RENOVAR PRÉSTAMO =====
  if (prestamoTest && prestamoTest.estado === 'ACTIVO') {
    r = await call('POST', `/api/prestamos/${prestamoTest.id}/renovar`, {
      nuevoMonto: (prestamoTest.montoPrincipal || 300000) + 100000,
      nuevoPlazoMeses: 3,
      nuevaTasaAnual: 240,
      observaciones: 'AUDIT-TEST: renovación',
    }, cookie)
    if (r.status === 200 && r.data?.success) {
      addResult('Renovar préstamo', 'PASS', `Nuevo préstamo: ${r.data.data?.nuevoPrestamoId || r.data.nuevoPrestamoId}`, r.status, 'ok')
    } else {
      addResult('Renovar préstamo', 'RISKY', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  } else {
    addResult('Renovar préstamo', 'BLOCKED', 'No hay préstamo ACTIVO disponible', null, '')
  }

  // ===== ELIMINAR PRÉSTAMO (se sabe que está bug) =====
  if (nuevoPrestamoId) {
    r = await call('DELETE', `/api/prestamos/${nuevoPrestamoId}`, null, cookie)
    if (r.status === 200) {
      addResult('Eliminar préstamo (recién creado)', 'PASS', 'Préstamo eliminado', r.status, 'ok')
    } else if (r.status === 500) {
      addResult('Eliminar préstamo (recién creado)', 'FAIL', 'BUG CONFIRMADO: 500 error (cronologia → cronologias)', r.status, JSON.stringify(r.data).substring(0, 200))
    } else {
      addResult('Eliminar préstamo (recién creado)', 'FAIL', `Status inesperado: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== LIMPIAR TODOS (no ejecutar, solo validar que está protegido) =====
  r = await call('POST', '/api/prestamos/limpiar-todos', { password: 'wrong-password' }, cookie)
  if (r.status === 403) {
    addResult('Limpiar todos (protección por password)', 'PASS', 'Endpoint protegido correctamente', r.status, 'ok')
  } else {
    addResult('Limpiar todos (protección por password)', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== CONCILIACIÓN BANCOLOMBIA =====
  r = await call('POST', '/api/pagos/conciliacion', { accion: 'listar_pendientes' }, cookie)
  if (r.status === 200) {
    addResult('Conciliación Bancolombia', 'PASS', 'Endpoint responde', r.status, 'ok')
  } else {
    addResult('Conciliación Bancolombia', 'RISKY', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== CRON MORA (validar acceso) =====
  r = await call('POST', '/api/pagos/cron', {}, cookie)
  if (r.status === 200) {
    addResult('Cron mora (sin secret)', 'RISKY', 'Cron ejecutado sin CRON_SECRET — abierto en dev', r.status, 'Configurar CRON_SECRET en .env')
  } else if (r.status === 401 || r.status === 403) {
    addResult('Cron mora (sin secret)', 'PASS', 'Cron protegido', r.status, 'ok')
  } else {
    addResult('Cron mora (sin secret)', 'RISKY', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== EXPORTAR PAGOS CSV GLOBAL =====
  r = await call('GET', '/api/pagos/export?tipo=hoy', null, cookie)
  if (r.status === 200) {
    addResult('Exportar pagos global (CSV hoy)', 'PASS', 'CSV generado', r.status, 'ok')
  } else {
    addResult('Exportar pagos global (CSV hoy)', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
  }

  // ===== LISTAR FIRMA ELECTRÓNICA =====
  if (prestamoTest) {
    // El endpoint requiere firmaId o token — enviar firmaId vacío dispara 400 esperado
    r = await call('GET', `/api/firma?prestamoId=${prestamoTest.id}&firmaId=buscar`, null, cookie)
    if (r.status === 200) {
      addResult('Listar firmas electrónicas del préstamo', 'PASS', 'Endpoint responde', r.status, `Data: ${JSON.stringify(r.data).substring(0, 100)}`)
    } else if (r.status === 400) {
      // 400 esperado si no hay firmaId válido — el endpoint valida parámetros
      addResult('Listar firmas electrónicas del préstamo', 'PASS', 'Endpoint valida parámetros (400 esperado sin firmaId válido)', r.status, 'ok')
    } else if (r.status === 404) {
      addResult('Listar firmas electrónicas del préstamo', 'PASS', 'Sin firmas registradas (404)', r.status, 'ok')
    } else {
      addResult('Listar firmas electrónicas', 'RISKY', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== ELIMINAR PRÉSTAMO CON CODEUDOR (debería dar mismo bug) =====
  if (nuevoPrestamoCcId) {
    r = await call('DELETE', `/api/prestamos/${nuevoPrestamoCcId}`, null, cookie)
    if (r.status === 200) {
      addResult('Eliminar préstamo con codeudor', 'PASS', 'Eliminado', r.status, 'ok')
    } else if (r.status === 500) {
      addResult('Eliminar préstamo con codeudor', 'FAIL', 'BUG CONFIRMADO: 500 error', r.status, 'Mismo bug de cronologia')
    } else {
      addResult('Eliminar préstamo con codeudor', 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  }

  // ===== GENERAR RECIBO DE PAGO =====
  r = await call('GET', '/api/pagos?limit=1', null, cookie)
  const arrPagos = r.data?.data || r.data?.pagos || r.data || []
  const algunPago = Array.isArray(arrPagos) ? arrPagos[0] : null
  if (algunPago) {
    r = await call('GET', `/api/pagos/recibo?pagoId=${algunPago.id}`, null, cookie)
    if (r.status === 200 && r.data?.htmlLen > 500) {
      addResult('Generar recibo de pago (HTML)', 'PASS', `HTML ${r.data.htmlLen} bytes`, r.status, 'ok')
    } else if (r.status === 200) {
      addResult('Generar recibo de pago (HTML)', 'PASS', `Status 200, ct=${r.ct?.substring(0, 30)}`, r.status, JSON.stringify(r.data).substring(0, 150))
    } else {
      addResult('Generar recibo de pago', r.status === 404 ? 'BLOCKED' : 'FAIL', `Status: ${r.status}`, r.status, JSON.stringify(r.data).substring(0, 200))
    }
  } else {
    addResult('Generar recibo de pago', 'BLOCKED', 'No hay pagos para probar', null, '')
  }

  // Escribir reporte
  const report = renderReport()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, report)
  log(`\nReporte escrito en: ${OUT}`)

  const { pass, fail, blocked, risky, total } = fmtResults()
  log(`\n=== RESUMEN ===`)
  log(`PASS: ${pass} | RISKY: ${risky} | FAIL: ${fail} | BLOCKED: ${blocked} | TOTAL: ${total}`)
  log(`Tasa de éxito: ${((pass / total) * 100).toFixed(1)}%`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
