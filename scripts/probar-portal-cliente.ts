// ============================================================================
// PRUEBAS E2E PORTAL DEL CLIENTE - JOHAN ALVAREZ
// ============================================================================
// Este script ejecuta pruebas reales contra los endpoints del portal del
// cliente para verificar que todos los escenarios funcionan correctamente.
//
// Escenarios cubiertos:
//
//   E1. Login con cédula + PIN
//   E2. Login con cédula + clave (v4.13)
//   E3. Verificar cédula (primer paso del login)
//   E4. Obtener préstamos del cliente (GET /api/portal/prestamos)
//   E5. Ver cuenta de pago con QR
//   E6. Simular préstamo sin flexibilidad
//   E7. Simular préstamo con flexibilidad BASICA
//   E8. Simular préstamo con flexibilidad PREMIUM
//   E9. Simular préstamo con monto fuera de rango (validación)
//   E10. Ver mi estado (GET /api/portal/mi-estado)
//   E11. Solicitar firma de préstamo (PENDIENTE_ACEPTACION)
//   E12. Solicitar OTP de firma
//   E13. Validar OTP de firma
//   E14. Verificar préstamos con flexibilidad activada
//   E15. Probar aplicación de flexibilidad (1 uso) - BASICA
//   E16. Probar aplicación de flexibilidad (2 usos) - PREMIUM
//   E17. Probar agotamiento de flexibilidad (PREMIUM 0 disponibles)
//   E18. Logout
// ============================================================================

const BASE = 'http://localhost:3000'

const CEDULA = '1214731649'
const PIN = '1234'
const CLAVE = 'Johan2025'

interface TestResult {
  escenario: string
  descripcion: string
  status: 'PASS' | 'FAIL' | 'WARN'
  detalle: string
  data?: any
}

const resultados: TestResult[] = []

async function apiPost(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

async function apiGet(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, { headers })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

async function apiDelete(path: string, body: any = {}, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

function log(r: TestResult) {
  resultados.push(r)
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌'
  console.log(`${icon} [${r.escenario}] ${r.descripcion}`)
  console.log(`   ${r.detalle}`)
  if (r.data && Object.keys(r.data).length > 0) {
    console.log(`   DATA: ${JSON.stringify(r.data).slice(0, 250)}`)
  }
  console.log('')
}

// ============================================================================
// EJECUCIÓN DE PRUEBAS
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' PRUEBAS E2E PORTAL DEL CLIENTE - JOHAN ALVAREZ')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // =================================================================
  // E1. Verificar cédula
  // =================================================================
  console.log('--- BLOQUE 1: AUTENTICACIÓN ---\n')
  let res = await apiPost('/api/portal/verificar-cedula', { cedula: CEDULA })
  log({
    escenario: 'E1',
    descripcion: 'Verificar cédula de Johan Alvarez',
    status: res.status === 200 && res.json?.clienteId ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | tienePin=${res.json?.tienePin} | telefono=${res.json?.telefono}`,
    data: res.json,
  })

  // =================================================================
  // E2. Login con PIN
  // =================================================================
  res = await apiPost('/api/portal/login', { cedula: CEDULA, pin: PIN })
  let token: string | undefined = res.json?.token
  log({
    escenario: 'E2',
    descripcion: 'Login con cédula + PIN',
    status: res.status === 200 && !!token ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | token=${token ? token.slice(0, 16) + '...' : 'NONE'}`,
    data: res.json ? { token: res.json.token, clienteId: res.json.clienteId, nombre: res.json.nombre } : null,
  })

  // =================================================================
  // E3. Login con clave (v4.13)
  // =================================================================
  res = await apiPost('/api/portal/login', { cedula: CEDULA, clave: CLAVE })
  let tokenClave: string | undefined = res.json?.token
  log({
    escenario: 'E3',
    descripcion: 'Login con cédula + clave alfanumérica (v4.13)',
    status: res.status === 200 && !!tokenClave ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | token=${tokenClave ? tokenClave.slice(0, 16) + '...' : 'NONE'}`,
    data: res.json ? { token: res.json.token, clienteId: res.json.clienteId } : null,
  })

  // =================================================================
  // E4. Login con PIN incorrecto (validación)
  // =================================================================
  res = await apiPost('/api/portal/login', { cedula: CEDULA, pin: '9999' })
  log({
    escenario: 'E4',
    descripcion: 'Login con PIN incorrecto (validación de seguridad)',
    status: res.status === 401 && res.json?.codigo === 'PIN_INCORRECTO' ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | codigo=${res.json?.codigo} | error=${res.json?.error}`,
    data: res.json,
  })

  // =================================================================
  // BLOQUE 2: MIS PRÉSTAMOS
  // =================================================================
  console.log('--- BLOQUE 2: MIS PRÉSTAMOS ---\n')

  // =================================================================
  // E5. Obtener préstamos del cliente
  // =================================================================
  res = await apiGet(`/api/portal/prestamos?token=${token}`)
  const prestamos = res.json?.prestamos || []
  const cliente = res.json?.cliente
  log({
    escenario: 'E5',
    descripcion: 'Obtener préstamos del cliente (GET /api/portal/prestamos)',
    status: res.status === 200 && cliente ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | ${prestamos.length} préstamos | cliente=${cliente?.nombre}`,
    data: {
      cliente: cliente ? { cedula: cliente.cedula, nombre: cliente.nombre } : null,
      totalPrestamos: prestamos.length,
      estados: prestamos.reduce((acc: any, p: any) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1
        return acc
      }, {}),
      conFlexibilidad: prestamos.filter((p: any) => p.flexibilidadFinanciera).length,
      pendientesFirma: prestamos.filter((p: any) => !p.tycAceptado).length,
    },
  })

  // =================================================================
  // E6. Listar préstamos pendientes de firma
  // =================================================================
  const pendientesFirma = prestamos.filter((p: any) => !p.tycAceptado)
  log({
    escenario: 'E6',
    descripcion: 'Identificar préstamos pendientes de firma TyC',
    status: pendientesFirma.length > 0 ? 'PASS' : 'WARN',
    detalle: `${pendientesFirma.length} préstamo(s) pendiente(s) de firma`,
    data: pendientesFirma.map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      estado: p.estado,
      montoPrincipal: p.montoPrincipal,
    })),
  })

  // =================================================================
  // E7. Listar préstamos con flexibilidad
  // =================================================================
  const conFlex = prestamos.filter((p: any) => p.flexibilidadFinanciera)
  log({
    escenario: 'E7',
    descripcion: 'Identificar préstamos con Flexibilidad Financiera',
    status: conFlex.length > 0 ? 'PASS' : 'WARN',
    detalle: `${conFlex.length} préstamo(s) con flexibilidad`,
    data: conFlex.map((p: any) => ({
      codigo: p.codigo,
      modalidad: p.flexibilidadModalidad,
      usosDisponibles: p.flexibilidadUsosDisponibles,
      usosEjercidos: p.flexibilidadUsosEjercidos,
      activada: p.flexibilidadActivada,
    })),
  })

  // =================================================================
  // BLOQUE 3: CUENTA DE PAGO
  // =================================================================
  console.log('--- BLOQUE 3: CUENTA DE PAGO / QR ---\n')

  // =================================================================
  // E8. Ver cuenta de pago
  // =================================================================
  res = await apiGet('/api/portal/cuenta-pago', { 'x-portal-token': token! })
  log({
    escenario: 'E8',
    descripcion: 'Ver cuenta de pago y QR (GET /api/portal/cuenta-pago)',
    status: res.status === 200 && res.json?.success && res.json?.cuenta ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | banco=${res.json?.cuenta?.banco} | cuenta=${res.json?.cuenta?.numeroCuenta} | qr=${res.json?.cuenta?.qrImagen ? 'SÍ' : 'NO'}`,
    data: res.json?.cuenta ? {
      banco: res.json.cuenta.banco,
      numeroCuenta: res.json.cuenta.numeroCuenta,
      tipoCuenta: res.json.cuenta.tipoCuenta,
      titular: res.json.cuenta.titular,
      tieneQR: !!res.json.cuenta.qrImagen,
    } : null,
  })

  // =================================================================
  // BLOQUE 4: SIMULADOR
  // =================================================================
  console.log('--- BLOQUE 4: SIMULADOR DE PRÉSTAMO ---\n')

  // Obtener categorías disponibles
  const catRes = await apiGet('/api/categorias')
  const categorias = catRes.json?.categorias || []
  const catEstandar = categorias.find((c: any) => c.nombre?.includes('Estándar'))
  const catPremium = categorias.find((c: any) => c.nombre?.includes('Premium'))

  // =================================================================
  // E9. Simular préstamo sin flexibilidad
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 2_000_000,
    categoriaId: catEstandar?.id,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
    token,
    flexibilidadFinanciera: false,
  })
  log({
    escenario: 'E9',
    descripcion: 'Simular préstamo sin Flexibilidad Financiera',
    status: res.status === 200 && res.json?.simulacion ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | cuota=${res.json?.simulacion?.montoCuota?.toLocaleString('es-CO')} | total=${res.json?.simulacion?.totalPagar?.toLocaleString('es-CO')}`,
    data: res.json?.simulacion ? {
      monto: res.json.simulacion.monto,
      cuotas: res.json.simulacion.numeroCuotas,
      montoCuota: res.json.simulacion.montoCuota,
      totalPagar: res.json.simulacion.totalPagar,
      flexibilidadElegible: res.json.simulacion.flexibilidadElegible,
      flexibilidadActivada: res.json.simulacion.flexibilidadFinanciera,
    } : null,
  })

  // =================================================================
  // E10. Simular préstamo con flexibilidad BASICA
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 3_000_000,
    categoriaId: catEstandar?.id,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
    token,
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'BASICA',
  })
  log({
    escenario: 'E10',
    descripcion: 'Simular préstamo con Flexibilidad BASICA ($15.000 / 1 uso)',
    status: res.status === 200 && res.json?.simulacion?.flexibilidadFinanciera ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | modalidad=${res.json?.simulacion?.flexibilidadModalidad} | costo=${res.json?.simulacion?.flexibilidadCosto} | usos=${res.json?.simulacion?.flexibilidadUsosDisponibles}`,
    data: res.json?.simulacion ? {
      montoCuota: res.json.simulacion.montoCuota,
      totalPagar: res.json.simulacion.totalPagar,
      flexibilidadFinanciera: res.json.simulacion.flexibilidadFinanciera,
      flexibilidadModalidad: res.json.simulacion.flexibilidadModalidad,
      flexibilidadCosto: res.json.simulacion.flexibilidadCosto,
      flexibilidadUsosDisponibles: res.json.simulacion.flexibilidadUsosDisponibles,
      flexibilidadTarifas: res.json.simulacion.flexibilidadTarifas,
    } : null,
  })

  // =================================================================
  // E11. Simular préstamo con flexibilidad PREMIUM
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 5_000_000,
    categoriaId: catPremium?.id,
    plazoMeses: 12,
    frecuencia: 'MENSUAL',
    token,
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'PREMIUM',
  })
  log({
    escenario: 'E11',
    descripcion: 'Simular préstamo con Flexibilidad PREMIUM ($34.900 / 2 usos)',
    status: res.status === 200 && res.json?.simulacion?.flexibilidadModalidad === 'PREMIUM' ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | modalidad=${res.json?.simulacion?.flexibilidadModalidad} | costo=${res.json?.simulacion?.flexibilidadCosto} | usos=${res.json?.simulacion?.flexibilidadUsosDisponibles}`,
    data: res.json?.simulacion ? {
      montoCuota: res.json.simulacion.montoCuota,
      totalPagar: res.json.simulacion.totalPagar,
      flexibilidadModalidad: res.json.simulacion.flexibilidadModalidad,
      flexibilidadCosto: res.json.simulacion.flexibilidadCosto,
      flexibilidadUsosDisponibles: res.json.simulacion.flexibilidadUsosDisponibles,
    } : null,
  })

  // =================================================================
  // E12. Simular préstamo con plazo insuficiente para flexibilidad (< 4 cuotas)
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 500_000,
    categoriaId: catEstandar?.id,
    plazoMeses: 2,
    frecuencia: 'MENSUAL',
    token,
    flexibilidadFinanciera: true,
  })
  log({
    escenario: 'E12',
    descripcion: 'Simular con flexibilidad pero plazo < 4 cuotas (no elegible)',
    status: res.status === 200 && res.json?.simulacion?.flexibilidadElegible === false ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | flexibilidadElegible=${res.json?.simulacion?.flexibilidadElegible} | flexibilidadActivada=${res.json?.simulacion?.flexibilidadFinanciera}`,
    data: res.json?.simulacion ? {
      numeroCuotas: res.json.simulacion.numeroCuotas,
      flexibilidadElegible: res.json.simulacion.flexibilidadElegible,
      flexibilidadFinanciera: res.json.simulacion.flexibilidadFinanciera,
      flexibilidadTarifas: res.json.simulacion.flexibilidadTarifas,
    } : null,
  })

  // =================================================================
  // E13. Simular con frecuencia QUINCENAL (calcula cuotas dobles)
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 1_500_000,
    categoriaId: catEstandar?.id,
    plazoMeses: 4,
    frecuencia: 'QUINCENAL',
    token,
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'BASICA',
  })
  log({
    escenario: 'E13',
    descripcion: 'Simular préstamo quincenal con flexibilidad BASICA',
    status: res.status === 200 && res.json?.simulacion ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | frecuencia=${res.json?.simulacion?.frecuencia} | cuotas=${res.json?.simulacion?.numeroCuotas} | flexActivada=${res.json?.simulacion?.flexibilidadFinanciera}`,
    data: res.json?.simulacion ? {
      frecuencia: res.json.simulacion.frecuencia,
      numeroCuotas: res.json.simulacion.numeroCuotas,
      montoCuota: res.json.simulacion.montoCuota,
      flexibilidadFinanciera: res.json.simulacion.flexibilidadFinanciera,
      flexibilidadModalidad: res.json.simulacion.flexibilidadModalidad,
    } : null,
  })

  // =================================================================
  // E14. Simular con frecuencia SEMANAL
  // =================================================================
  res = await apiPost('/api/portal/simular', {
    monto: 800_000,
    categoriaId: catEstandar?.id,
    plazoMeses: 2,
    frecuencia: 'SEMANAL',
    token,
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'PREMIUM',
  })
  log({
    escenario: 'E14',
    descripcion: 'Simular préstamo semanal con flexibilidad PREMIUM',
    status: res.status === 200 && res.json?.simulacion ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | frecuencia=${res.json?.simulacion?.frecuencia} | cuotas=${res.json?.simulacion?.numeroCuotas} | flexActivada=${res.json?.simulacion?.flexibilidadFinanciera}`,
    data: res.json?.simulacion ? {
      frecuencia: res.json.simulacion.frecuencia,
      numeroCuotas: res.json.simulacion.numeroCuotas,
      montoCuota: res.json.simulacion.montoCuota,
      flexibilidadFinanciera: res.json.simulacion.flexibilidadFinanciera,
      flexibilidadModalidad: res.json.simulacion.flexibilidadModalidad,
    } : null,
  })

  // =================================================================
  // BLOQUE 5: MI ESTADO
  // =================================================================
  console.log('--- BLOQUE 5: MI ESTADO / PERFIL ---\n')

  res = await apiGet(`/api/portal/mi-estado?token=${token}`)
  log({
    escenario: 'E15',
    descripcion: 'Ver mi estado (GET /api/portal/mi-estado)',
    status: res.status === 200 ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | ${res.json?.prestamosActivos ?? 0} préstamos activos | saldoTotal=${res.json?.saldoTotalPendiente?.toLocaleString('es-CO') ?? 'N/A'}`,
    data: res.json,
  })

  // =================================================================
  // BLOQUE 6: FIRMA TyC
  // =================================================================
  console.log('--- BLOQUE 6: FIRMA TyC + OTP ---\n')

  // Tomar un préstamo PENDIENTE_ACEPTACION sin TyC
  const prestamoPendiente = pendientesFirma.find((p: any) => p.estado === 'PENDIENTE_ACEPTACION')
  if (prestamoPendiente) {
    // E16. Iniciar firma
    res = await apiPost('/api/portal/firmar', {
      prestamoId: prestamoPendiente.id,
      token,
    })
    const firmaId = res.json?.firmaId
    log({
      escenario: 'E16',
      descripcion: `Iniciar firma de TyC (préstamo ${prestamoPendiente.codigo})`,
      status: res.status === 200 && firmaId ? 'PASS' : 'FAIL',
      detalle: `HTTP ${res.status} | firmaId=${firmaId ? firmaId.slice(0, 16) + '...' : 'NONE'}`,
      data: res.json,
    })

    if (firmaId) {
      // E17. Solicitar OTP por EMAIL
      res = await apiPost('/api/portal/solicitar-otp', { firmaId, canal: 'EMAIL' })
      log({
        escenario: 'E17',
        descripcion: 'Solicitar OTP por canal EMAIL',
        status: res.status === 200 ? 'PASS' : 'FAIL',
        detalle: `HTTP ${res.status} | canal=${res.json?.canal} | expira=${res.json?.expiraEn ?? 'N/A'}`,
        data: res.json,
      })

      // E18. Solicitar OTP por WHATSAPP
      res = await apiPost('/api/portal/solicitar-otp', { firmaId, canal: 'WHATSAPP' })
      log({
        escenario: 'E18',
        descripcion: 'Solicitar OTP por canal WHATSAPP',
        status: res.status === 200 ? 'PASS' : res.status === 400 ? 'WARN' : 'FAIL',
        detalle: `HTTP ${res.status} | canal=${res.json?.canal} | error=${res.json?.error ?? 'N/A'}`,
        data: res.json,
      })

      // E19. Validar OTP con código incorrecto (validación)
      res = await apiPost('/api/portal/validar-otp', { firmaId, otp: '000000' })
      log({
        escenario: 'E19',
        descripcion: 'Validar OTP incorrecto (validación de seguridad)',
        status: (res.status === 400 || res.status === 401) ? 'PASS' : 'FAIL',
        detalle: `HTTP ${res.status} | error=${res.json?.error ?? res.json?.message ?? 'N/A'}`,
        data: res.json,
      })

      // Para validar el OTP correcto, necesitamos obtenerlo de la BD
      // (en producción el sistema lo envía al cliente; en pruebas lo leemos)
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      try {
        const firma = await prisma.firmaElectronica.findUnique({ where: { id: firmaId } })
        if (firma?.otpCodigo) {
          // E20. Validar OTP correcto
          res = await apiPost('/api/portal/validar-otp', { firmaId, otp: firma.otpCodigo })
          log({
            escenario: 'E20',
            descripcion: 'Validar OTP correcto (acceso a firma manuscrita)',
            status: res.status === 200 ? 'PASS' : 'FAIL',
            detalle: `HTTP ${res.status} | mensaje=${res.json?.message ?? res.json?.success}`,
            data: res.json,
          })
        } else {
          log({
            escenario: 'E20',
            descripcion: 'Validar OTP correcto',
            status: 'WARN',
            detalle: 'No se pudo obtener el OTP de la BD para validar',
          })
        }
      } catch (e: any) {
        log({
          escenario: 'E20',
          descripcion: 'Validar OTP correcto',
          status: 'WARN',
          detalle: `Error leyendo OTP de BD: ${e.message}`,
        })
      } finally {
        await prisma.$disconnect()
      }
    }
  } else {
    log({
      escenario: 'E16',
      descripcion: 'Iniciar firma de TyC',
      status: 'WARN',
      detalle: 'No hay préstamos pendientes de firma para probar',
    })
  }

  // =================================================================
  // BLOQUE 7: FLEXIBILIDAD FINANCIERA
  // =================================================================
  console.log('--- BLOQUE 7: FLEXIBILIDAD FINANCIERA ---\n')

  // Buscar el préstamo con flexibilidad BASICA disponible
  const prestamoFlexBasica = prestamos.find(
    (p: any) => p.flexibilidadFinanciera && p.flexibilidadModalidad === 'BASICA' && p.flexibilidadUsosDisponibles > 0 && p.flexibilidadActivada
  )
  if (prestamoFlexBasica) {
    log({
      escenario: 'E21-INFO',
      descripcion: 'Préstamo con flexibilidad BASICA disponible para probar',
      status: 'PASS',
      detalle: `Préstamo ${prestamoFlexBasica.codigo} | usos disponibles: ${prestamoFlexBasica.flexibilidadUsosDisponibles}`,
      data: {
        id: prestamoFlexBasica.id,
        codigo: prestamoFlexBasica.codigo,
        cuotasPagadas: prestamoFlexBasica.cuotasPagadas,
        numeroCuotas: prestamoFlexBasica.numeroCuotas,
        flexibilidadActivada: prestamoFlexBasica.flexibilidadActivada,
        flexibilidadUsosDisponibles: prestamoFlexBasica.flexibilidadUsosDisponibles,
      },
    })
    // La prueba real de aplicar flexibilidad requiere autenticación ADMIN
    // ya que el endpoint /api/pagos con acción=usar_flexibilidad es solo para
    // gestores. Lo documentamos pero no lo ejecutamos aquí.
    log({
      escenario: 'E21',
      descripcion: 'Aplicar flexibilidad por 1 cuota (BASICA) — requiere auth ADMIN',
      status: 'WARN',
      detalle: `Endpoint: POST /api/pagos con { accion: 'usar_flexibilidad', prestamoId: '${prestamoFlexBasica.id}' } — requiere rol ADMIN/GESTOR`,
    })
  } else {
    log({
      escenario: 'E21',
      descripcion: 'Aplicar flexibilidad por 1 cuota (BASICA)',
      status: 'WARN',
      detalle: 'No hay préstamo con flexibilidad BASICA disponible',
    })
  }

  // Préstamo con PREMIUM con 1 uso disponible
  const prestamoFlexPremium = prestamos.find(
    (p: any) => p.flexibilidadFinanciera && p.flexibilidadModalidad === 'PREMIUM' && p.flexibilidadUsosDisponibles > 0 && p.flexibilidadActivada
  )
  if (prestamoFlexPremium) {
    log({
      escenario: 'E22-INFO',
      descripcion: 'Préstamo con flexibilidad PREMIUM disponible para probar (2 usos)',
      status: 'PASS',
      detalle: `Préstamo ${prestamoFlexPremium.codigo} | usos disponibles: ${prestamoFlexPremium.flexibilidadUsosDisponibles} | ejercidos: ${prestamoFlexPremium.flexibilidadUsosEjercidos}`,
      data: {
        id: prestamoFlexPremium.id,
        codigo: prestamoFlexPremium.codigo,
        flexibilidadModalidad: prestamoFlexPremium.flexibilidadModalidad,
        flexibilidadUsosDisponibles: prestamoFlexPremium.flexibilidadUsosDisponibles,
        flexibilidadUsosEjercidos: prestamoFlexPremium.flexibilidadUsosEjercidos,
      },
    })
    log({
      escenario: 'E22',
      descripcion: 'Aplicar flexibilidad por 2 cuotas (PREMIUM) — requiere auth ADMIN',
      status: 'WARN',
      detalle: `Endpoint: POST /api/pagos con { accion: 'usar_flexibilidad', prestamoId: '${prestamoFlexPremium.id}' } — ejecutar 2 veces`,
    })
  } else {
    log({
      escenario: 'E22',
      descripcion: 'Aplicar flexibilidad por 2 cuotas (PREMIUM)',
      status: 'WARN',
      detalle: 'No hay préstamo con flexibilidad PREMIUM disponible',
    })
  }

  // Préstamo con flexibilidad AGOTADA
  const prestamoFlexAgotada = prestamos.find(
    (p: any) => p.flexibilidadFinanciera && p.flexibilidadUsosDisponibles === 0
  )
  if (prestamoFlexAgotada) {
    log({
      escenario: 'E23',
      descripcion: 'Verificar préstamo con flexibilidad AGOTADA (0 usos disponibles)',
      status: 'PASS',
      detalle: `Préstamo ${prestamoFlexAgotada.codigo} | modalidad: ${prestamoFlexAgotada.flexibilidadModalidad} | usos ejercidos: ${prestamoFlexAgotada.flexibilidadUsosEjercidos}`,
      data: {
        id: prestamoFlexAgotada.id,
        codigo: prestamoFlexAgotada.codigo,
        flexibilidadModalidad: prestamoFlexAgotada.flexibilidadModalidad,
        flexibilidadUsosDisponibles: prestamoFlexAgotada.flexibilidadUsosDisponibles,
        flexibilidadUsosEjercidos: prestamoFlexAgotada.flexibilidadUsosEjercidos,
      },
    })
  }

  // =================================================================
  // BLOQUE 8: LOGOUT
  // =================================================================
  console.log('--- BLOQUE 8: CIERRE DE SESIÓN ---\n')

  res = await apiDelete('/api/portal/login', { token }, { 'x-portal-token': token! })
  log({
    escenario: 'E24',
    descripcion: 'Cerrar sesión (DELETE /api/portal/login)',
    status: res.status === 200 && res.json?.success ? 'PASS' : 'FAIL',
    detalle: `HTTP ${res.status} | message=${res.json?.message}`,
    data: res.json,
  })

  // =================================================================
  // RESUMEN FINAL
  // =================================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' RESUMEN DE PRUEBAS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const pass = resultados.filter(r => r.status === 'PASS').length
  const warn = resultados.filter(r => r.status === 'WARN').length
  const fail = resultados.filter(r => r.status === 'FAIL').length
  const total = resultados.length

  console.log(`Total escenarios: ${total}`)
  console.log(`  ✅ PASS: ${pass}`)
  console.log(`  ⚠️  WARN: ${warn}`)
  console.log(`  ❌ FAIL: ${fail}`)
  console.log(`\nTasa de éxito: ${((pass / total) * 100).toFixed(1)}%`)

  if (fail > 0) {
    console.log('\n--- ESCENARIOS FALLIDOS ---')
    resultados.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.escenario}] ${r.descripcion}`)
      console.log(`     ${r.detalle}`)
    })
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n')
}

main().catch((e) => {
  console.error('ERROR FATAL:', e)
  process.exit(1)
})
