import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  corregirFechasPorCorte,
  calcularMoraCompuesta,
  calcularDiasMora,
  getTasaMoraDiaria,
  calcularCargosInicialesPendientes,
} from '@/lib/finanzas'

// =====================================================
// /api/portal/[cedula]/regularizar
// -----------------------------------------------------
// Módulo: Regularización Inteligente de Cuotas Vencidas
//
// GET: Retorna las cuotas vencidas del cliente y calcula el
//      escenario de regularización para la fecha propuesta.
//
// POST: Calcula escenario para fecha específica o guarda el
//       compromiso de pago / acuerdo de regularización.
//
// Autenticación: token del portal cliente (header x-portal-token
// o query ?token=). El token debe pertenecer al cliente de la cédula.
// =====================================================

interface CuotaVencida {
  numero: number
  fechaVencimiento: string  // ISO
  capital: number
  interes: number
  montoCuota: number
  diasMora: number
  moraActual: number
  moraDiariaPesos: number
  pagadoCuota: number
  pendienteCuota: number
}

interface Escenario {
  fecha: string  // ISO o 'hoy'
  diasDesdeHoy: number
  capitalPendiente: number
  interesAcumulado: number
  moraAcumulada: number
  otrosCargos: number
  total: number
  diferenciaFrenteHoy: number
}

interface PrestamoVencido {
  prestamoId: string
  codigo: string
  modalidad: string
  montoPrincipal: number
  tasaMoraDiaria: number
  cuotasVencidas: CuotaVencida[]
  totalPendienteHoy: number
  totalCapital: number
  totalInteres: number
  totalMora: number
  cargosIniciales: number
}

function calcularTabla(p: any) {
  const fechaBase = p.fechaInicioAmortizacion || p.fechaDesembolso || p.fechaSolicitud
  let calculo: any
  if (p.modalidadAmortizacion === 'TASA_FIJA') {
    calculo = calcularPrestamoTasaFijaMensual({
      montoPrincipal: p.montoPrincipal,
      tasaMensualFija: p.tasaInteresMensual || p.tasaInteresAnual / 12,
      numeroCuotas: p.numeroCuotas,
      frecuencia: p.frecuencia as any,
      fechaDesembolso: fechaBase,
    })
    // === FIX: Respetar montoCuota guardado en BD si difiere del calculado ===
    // El admin puede ajustar montoCuota en BD (ej: +$5.000 por cargo adicional).
    //
    // IMPORTANTE: valorDiasCausados NO se suma a ninguna cuota individual.
    // Es un cargo único que se documenta en notas pero las cuotas quedan
    // todas iguales al montoCuota guardado en BD.
    if (p.montoCuota && p.montoCuota !== calculo.montoCuota) {
      calculo.tablaAmortizacion = calculo.tablaAmortizacion.map((c: any) => ({
        ...c,
        montoCuota: p.montoCuota,  // Todas las cuotas al valor guardado
      }))
      calculo.montoCuota = p.montoCuota
    }
  } else if (p.modalidadAmortizacion === 'INTERES_FIJO_SIN_CAPITAL') {
    const fechaVenc = new Date(fechaBase)
    fechaVenc.setMonth(fechaVenc.getMonth() + 1)
    calculo = {
      numeroCuotas: 0,
      montoCuota: p.interesFijoMensual || 0,
      tablaAmortizacion: [{
        numero: 1,
        fechaVencimiento: fechaVenc,
        montoCuota: p.interesFijoMensual || 0,
        capital: 0,
        interes: p.interesFijoMensual || 0,
        saldoCapital: p.montoPrincipal - (p.capitalPagadoExtra || 0),
        acumuladoInteres: 0,
        acumuladoCapital: 0,
      }],
      fechaVencimiento: fechaVenc,
    }
  } else {
    calculo = calcularPrestamo({
      montoPrincipal: p.montoPrincipal,
      tasaInteresAnual: p.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraDiaria(p),
      plazoMeses: p.plazoMeses,
      frecuencia: p.frecuencia as any,
      fechaDesembolso: fechaBase,
    })
  }
  calculo.tablaAmortizacion = corregirFechasPorCorte(calculo.tablaAmortizacion, p.periodoCorte)
  return calculo
}

function obtenerCuotasVencidas(p: any): CuotaVencida[] {
  const calculo = calcularTabla(p)
  const hoy = new Date()
  const vencidas: CuotaVencida[] = []

  for (const cuota of calculo.tablaAmortizacion) {
    const fechaVenc = new Date(cuota.fechaVencimiento)
    if (fechaVenc > hoy) continue  // Solo vencidas (pasadas)

    // Verificar si la cuota ya está completamente pagada
    const pagosCuota = p.pagos.filter((pg: any) => pg.numeroCuota === cuota.numero && pg.estado === 'APLICADO')
    const totalPagado = pagosCuota.reduce((s: number, pg: any) => s + pg.montoTotal, 0)

    // Si la cuota está 100% pagada, saltarla
    if (totalPagado >= cuota.montoCuota * 0.99) continue

    const diasMora = calcularDiasMora(fechaVenc)
    const moraActual = diasMora > 0
      ? calcularMoraCompuesta(p.montoPrincipal, p.tasaMoraDiaria, diasMora)
      : 0
    const moraPagadaCuota = pagosCuota.reduce((s: number, pg: any) => s + pg.montoMora, 0)
    const moraPendiente = Math.max(0, moraActual - moraPagadaCuota)

    // Mora diaria futura (cuánto crece por día adicional)
    const moraDiariaPesos = (p.montoPrincipal * p.tasaMoraDiaria) / 100

    const capitalPagado = pagosCuota.reduce((s: number, pg: any) => s + pg.montoCapital, 0)
    const interesPagado = pagosCuota.reduce((s: number, pg: any) => s + pg.montoInteres, 0)

    const capitalPendiente = Math.max(0, cuota.capital - capitalPagado)
    const interesPendiente = Math.max(0, cuota.interes - interesPagado)
    const montoPendiente = capitalPendiente + interesPendiente + moraPendiente

    vencidas.push({
      numero: cuota.numero,
      fechaVencimiento: fechaVenc.toISOString(),
      capital: capitalPendiente,
      interes: interesPendiente,
      montoCuota: cuota.montoCuota,
      diasMora,
      moraActual: moraPendiente,
      moraDiariaPesos,
      pagadoCuota: totalPagado,
      pendienteCuota: montoPendiente,
    })
  }

  return vencidas
}

function calcularEscenario(
  vencidas: CuotaVencida[],
  prestamo: any,
  fechaObjetivo: Date
): Escenario {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaObj = new Date(fechaObjetivo)
  fechaObj.setHours(0, 0, 0, 0)

  const diasDesdeHoy = Math.max(
    0,
    Math.floor((fechaObj.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  )

  let capitalPendiente = 0
  let interesAcumulado = 0
  let moraAcumulada = 0
  let otrosCargos = 0

  for (const c of vencidas) {
    capitalPendiente += c.capital
    interesAcumulado += c.interes

    // Mora proyectada a la fecha objetivo
    // = mora actual + mora diaria × días adicionales
    const fechaVencCuota = new Date(c.fechaVencimiento)
    const diasMoraProyectada = Math.max(
      c.diasMora,
      Math.floor((fechaObj.getTime() - fechaVencCuota.getTime()) / (1000 * 60 * 60 * 24))
    )
    if (diasMoraProyectada > 0) {
      const moraProyectada = calcularMoraCompuesta(
        prestamo.montoPrincipal,
        prestamo.tasaMoraDiaria,
        diasMoraProyectada
      )
      // Restar la mora ya pagada de esta cuota
      const moraPagadaCuota = prestamo.pagos
        .filter((pg: any) => pg.numeroCuota === c.numero && pg.estado === 'APLICADO')
        .reduce((s: number, pg: any) => s + pg.montoMora, 0)
      moraAcumulada += Math.max(0, moraProyectada - moraPagadaCuota)
    }
  }

  // Cargos iniciales pendientes (pagaré, tarifa plataforma, etc.)
  const cargosInfo = calcularCargosInicialesPendientes(prestamo)
  const cuota1Aplicada = prestamo.pagos.some((pg: any) => pg.numeroCuota === 1 && pg.estado === 'APLICADO')
  const cargosIniciales = cargosInfo.cargos
    .filter(c => {
      if (c.yaCobrado) return false
      if ((c.concepto === 'PAGARE_CARTA' || c.concepto === 'FONDO_GARANTIA') && cuota1Aplicada) return false
      return true
    })
    .reduce((s, c) => s + c.monto, 0)
  otrosCargos = cargosIniciales

  const total = capitalPendiente + interesAcumulado + moraAcumulada + otrosCargos

  // Diferencia frente a pagar hoy
  const totalHoy = vencidas.reduce((s, c) => s + c.pendienteCuota, 0) + otrosCargos
  const diferenciaFrenteHoy = total - totalHoy

  return {
    fecha: diasDesdeHoy === 0 ? 'hoy' : fechaObj.toISOString(),
    diasDesdeHoy,
    capitalPendiente,
    interesAcumulado,
    moraAcumulada,
    otrosCargos,
    total,
    diferenciaFrenteHoy,
  }
}

// === GET ===
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cedula: string }> }
) {
  try {
    const { cedula } = await params

    // === Validar token de sesión del portal ===
    const token =
      req.headers.get('x-portal-token') ||
      new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido', codigo: 'TOKEN_REQUERIDO' },
        { status: 401 }
      )
    }

    // Buscar al cliente autenticado por tokenSesion
    const clienteAutenticado = await db.cliente.findFirst({
      where: { tokenSesion: token as string },
      select: { id: true, cedula: true, nombre: true, tokenExpira: true },
    })

    if (
      !clienteAutenticado ||
      !clienteAutenticado.tokenExpira ||
      new Date(clienteAutenticado.tokenExpira) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', codigo: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Validación cross-cliente ===
    if (clienteAutenticado.cedula !== cedula) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para ver datos de otro cliente.', codigo: 'CROSS_CLIENTE_BLOQUEADO' },
        { status: 403 }
      )
    }

    // Buscar cliente por cédula (con datos completos)
    const cliente = await db.cliente.findUnique({
      where: { cedula },
      include: {
        prestamos: {
          where: {
            estado: { in: ['ACTIVO', 'EN_MORA'] },
          },
          include: {
            pagos: {
              orderBy: { numeroCuota: 'asc' },
            },
            categoria: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Buscar solicitudes con cuotas vencidas
    const prestamosVencidos: PrestamoVencido[] = []
    for (const p of cliente.prestamos) {
      const vencidas = obtenerCuotasVencidas(p)
      if (vencidas.length === 0) continue

      const totalPendienteHoy = vencidas.reduce((s, c) => s + c.pendienteCuota, 0)
      const totalCapital = vencidas.reduce((s, c) => s + c.capital, 0)
      const totalInteres = vencidas.reduce((s, c) => s + c.interes, 0)
      const totalMora = vencidas.reduce((s, c) => s + c.moraActual, 0)

      const cargosInfo = calcularCargosInicialesPendientes(p)
      const cuota1Aplicada = p.pagos.some((pg: any) => pg.numeroCuota === 1 && pg.estado === 'APLICADO')
      const cargosIniciales = cargosInfo.cargos
        .filter(c => {
          if (c.yaCobrado) return false
          if ((c.concepto === 'PAGARE_CARTA' || c.concepto === 'FONDO_GARANTIA') && cuota1Aplicada) return false
          return true
        })
        .reduce((s, c) => s + c.monto, 0)

      prestamosVencidos.push({
        prestamoId: p.id,
        codigo: p.codigo,
        modalidad: p.modalidadAmortizacion || 'FRANCES',
        montoPrincipal: p.montoPrincipal,
        tasaMoraDiaria: p.tasaMoraDiaria,
        cuotasVencidas: vencidas,
        totalPendienteHoy: totalPendienteHoy + cargosIniciales,
        totalCapital,
        totalInteres,
        totalMora,
        cargosIniciales,
      })
    }

    // Escenario "hoy" (referencia)
    const hoy = new Date()
    const escenariosHoy = prestamosVencidos.map(p => {
      const prestamo = cliente.prestamos.find(pp => pp.id === p.prestamoId)!
      return calcularEscenario(p.cuotasVencidas, prestamo, hoy)
    })

    // Generar escenarios comparativos (15, 30, 45 días)
    const escenariosComparativos: Record<string, Escenario[]> = {}
    for (const p of prestamosVencidos) {
      const prestamo = cliente.prestamos.find(pp => pp.id === p.prestamoId)!
      const lista: Escenario[] = [calcularEscenario(p.cuotasVencidas, prestamo, hoy)]
      for (const dias of [15, 30, 45]) {
        const fecha = new Date(hoy)
        fecha.setDate(fecha.getDate() + dias)
        lista.push(calcularEscenario(p.cuotasVencidas, prestamo, fecha))
      }
      escenariosComparativos[p.prestamoId] = lista
    }

    // Totales consolidados
    const totalVencidas = prestamosVencidos.reduce((s, p) => s + p.cuotasVencidas.length, 0)
    const totalPendienteHoyGlobal = prestamosVencidos.reduce((s, p) => s + p.totalPendienteHoy, 0)
    const totalMoraGlobal = prestamosVencidos.reduce((s, p) => s + p.totalMora, 0)
    const totalCapitalGlobal = prestamosVencidos.reduce((s, p) => s + p.totalCapital, 0)
    const totalInteresGlobal = prestamosVencidos.reduce((s, p) => s + p.totalInteres, 0)
    const cargosInicialesGlobal = prestamosVencidos.reduce((s, p) => s + p.cargosIniciales, 0)

    return NextResponse.json({
      success: true,
      data: {
        cliente: {
          nombre: cliente.nombre,
          cedula: cliente.cedula,
        },
        tieneVencidas: prestamosVencidos.length > 0,
        totalCuotasVencidas: totalVencidas,
        totalPendienteHoy: totalPendienteHoyGlobal,
        totalMora: totalMoraGlobal,
        totalCapital: totalCapitalGlobal,
        totalInteres: totalInteresGlobal,
        cargosIniciales: cargosInicialesGlobal,
        prestamos: prestamosVencidos,
        escenariosComparativos,
        escenariosHoy,
      },
    })
  } catch (error: any) {
    console.error('[portal/regularizar GET] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// === POST: Calcular escenario para fecha específica o guardar compromiso ===
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cedula: string }> }
) {
  try {
    const { cedula } = await params

    // === Validar token de sesión del portal ===
    const token =
      req.headers.get('x-portal-token') ||
      new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido', codigo: 'TOKEN_REQUERIDO' },
        { status: 401 }
      )
    }

    // Buscar al cliente autenticado por tokenSesion
    const clienteAutenticado = await db.cliente.findFirst({
      where: { tokenSesion: token as string },
      select: { id: true, cedula: true, nombre: true, tokenExpira: true },
    })

    if (
      !clienteAutenticado ||
      !clienteAutenticado.tokenExpira ||
      new Date(clienteAutenticado.tokenExpira) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', codigo: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Validación cross-cliente ===
    if (clienteAutenticado.cedula !== cedula) {
      return NextResponse.json(
        { success: false, error: 'No autorizado.', codigo: 'CROSS_CLIENTE_BLOQUEADO' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { accion } = body

    const cliente = await db.cliente.findUnique({
      where: { cedula },
      include: {
        prestamos: {
          where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
          include: { pagos: { orderBy: { numeroCuota: 'asc' } } },
        },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // === Acción 1: Calcular escenario para fecha específica ===
    if (accion === 'calcular_escenario') {
      const { prestamoId, fecha } = body
      const prestamo = cliente.prestamos.find(p => p.id === prestamoId)
      if (!prestamo) {
        return NextResponse.json(
          { success: false, error: 'Solicitud no encontrado' },
          { status: 404 }
        )
      }
      const vencidas = obtenerCuotasVencidas(prestamo)
      const fechaObj = new Date(fecha)
      const escenario = calcularEscenario(vencidas, prestamo, fechaObj)

      // Calcular escenarios alternativos (15, 30, 45 días desde hoy)
      const hoy = new Date()
      const comparativa: Escenario[] = [calcularEscenario(vencidas, prestamo, hoy)]
      for (const dias of [15, 30, 45]) {
        const f = new Date(hoy)
        f.setDate(f.getDate() + dias)
        comparativa.push(calcularEscenario(vencidas, prestamo, f))
      }

      return NextResponse.json({
        success: true,
        data: {
          escenario,
          comparativa,
          vencidas,
          mensajeAdvertencia: 'Pagar más adelante puede aumentar el valor total debido a los intereses y cargos moratorios aplicables.',
        },
      })
    }

    // === Acción 2: Guardar compromiso de pago / acuerdo ===
    if (accion === 'guardar_compromiso') {
      const {
        prestamoId,
        tipoAcuerdo, // 'PAGO_COMPLETO' | 'PAGO_PARCIAL' | 'ACUERDO_REGULARIZACION' | 'PROMESA_PAGO'
        fechaPago,
        montoPropuesto,
        montoTotalAcordado,
        cuotasVencidasIncluidas,
        saldoRestante,
        fechasPagosPosteriores,
      } = body

      const prestamo = cliente.prestamos.find(p => p.id === prestamoId)
      if (!prestamo) {
        return NextResponse.json(
          { success: false, error: 'Solicitud no encontrado' },
          { status: 404 }
        )
      }

      // Mapear tipo de acuerdo a la razón del modelo CompromisoPago
      // (el modelo usa valores predefinidos; usamos OTRO con texto explicativo
      //  cuando no encaja directamente)
      const razonMap: Record<string, string> = {
        PAGO_COMPLETO: 'OTRO',
        PAGO_PARCIAL: 'OTRO',
        ACUERDO_REGULARIZACION: 'OTRO',
        PROMESA_PAGO: 'OTRO',
      }
      const razon = razonMap[tipoAcuerdo] || 'OTRO'
      const razonOtroTexto = `Acuerdo de regularización: ${tipoAcuerdo}. Total acordado: $${montoTotalAcordado}. Saldo restante: $${saldoRestante}.`

      // Crear registro de compromiso de pago
      const compromiso = await db.compromisoPago.create({
        data: {
          prestamoId,
          clienteId: cliente.id,
          razon,
          razonOtroTexto,
          observacionCliente: `Acuerdo generado desde portal por ${cliente.nombre} (cédula ${cliente.cedula}). Tipo: ${tipoAcuerdo}. Cuotas vencidas incluidas: ${JSON.stringify(cuotasVencidasIncluidas || [])}. Fechas posteriores: ${JSON.stringify(fechasPagosPosteriores || [])}`,
          fechaComprometida: new Date(fechaPago),
          valorComprometido: parseFloat(montoPropuesto) || 0,
          estado: 'REGISTRADO',
          actualizaciones: JSON.stringify([{
            fecha: new Date().toISOString(),
            tipo: 'CREACION_ACUERDO_PORTAL',
            tipoAcuerdo,
            montoPropuesto,
            montoTotalAcordado,
            saldoRestante,
            cuotasVencidasIncluidas: cuotasVencidasIncluidas || [],
            fechasPagosPosteriores: fechasPagosPosteriores || [],
          }]),
          ultimaActualizacion: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          compromisoId: compromiso.id,
          mensaje: 'Tu acuerdo de regularización ha sido registrado. Un asesor lo revisará y se confirmará en las próximas 24 horas.',
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[portal/regularizar POST] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
