import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  calcularMoraCompuesta,
  calcularDiasMora,
  generarTokenTyC,
  formatearMoneda,
} from '@/lib/finanzas'
import { prestamoSchema, validateInput } from '@/lib/validators'
import { enviarWhatsApp, mensajeSolicitudCreada, mensajeAprobacionTyC, guardarNotificacion } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { buildAbsoluteUrl } from '@/lib/url'

// GET - listar préstamos
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    const estado = searchParams.get('estado')

    const prestamos = await db.prestamo.findMany({
      where: {
        ...(clienteId && clienteId !== 'all' ? { clienteId } : {}),
        ...(estado && estado !== 'all' ? { estado } : {}),
      },
      include: {
        cliente: true,
        categoria: true,
        // Incluir la firma COMPLETADA más reciente para habilitar el botón
        // de descarga del certificado de firma electrónica en cualquier momento.
        firmas: {
          where: { estadoFirma: 'COMPLETADA' },
          orderBy: { fechaFirmaCompleta: 'desc' },
          take: 1,
          select: { id: true, fechaFirmaCompleta: true, tipo: true, firmanteRol: true },
        },
        _count: { select: { pagos: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Aplanar: agregar campo `firmaId` derivado de la firma completada más reciente,
    // para compatibilidad con el frontend que espera p.firmaId directo.
    const prestamosConFirmaId = prestamos.map((p: any) => ({
      ...p,
      firmaId: p.firmas?.[0]?.id || p.firmaId || null,
      firmaFechaCompleta: p.firmas?.[0]?.fechaFirmaCompleta || null,
      firmaTipo: p.firmas?.[0]?.tipo || null,
      firmaRol: p.firmas?.[0]?.firmanteRol || null,
    }))

    return NextResponse.json({ success: true, data: prestamosConFirmaId })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - crear solicitud de préstamo
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()

    // Validación manual (el schema Zod no coincide con los campos reales)
    if (!body.clienteId) {
      return NextResponse.json(
        { success: false, error: 'Cliente requerido' },
        { status: 400 }
      )
    }

    const {
      clienteId,
      montoPrincipal,
      tasaInteresAnual,
      tasaMoraAnual,
      plazoMeses,
      frecuencia,
      requiereDocumentos,
      generarPagare,
      generarCarta,
      docsDatosAdicionales,
      categoriaId,
      notas,
      aprobarYEnviarTyC,
      // Campos de renovación
      esRenovacion,
      prestamoARenovarId,
      saldoPendienteRenovacion,
      // Campos de cuota personalizada
      modalidad,
      tasaMensualPersonalizada,
      montoCuotaPersonalizada,
      numeroCuotasPersonalizada,
      // Campos de tasa fija mensual
      tasaMensualFija,
      numeroCuotasFija,
      // === Modalidad INTERES_FIJO_SIN_CAPITAL ===
      // Caso especial: el cliente paga SOLO intereses fijos mensuales mientras
      // mantiene la deuda de capital. El capital se paga aparte en abonos
      // extraordinarios acordados con el gestor.
      interesFijoMensual,
      // Codeudor
      tieneCodeudor,
      codeudorId,
      codeudorNombre,
      codeudorCedula,
      codeudorTelefono,
      codeudorEmail,
      codeudorDireccion,
      // === Fecha del préstamo (fecha asignada) ===
      // Permite registrar el préstamo con una fecha distinta a la actual del sistema.
      // Todos los documentos generados (pagaré, carta, tabla de amortización) y el
      // código del préstamo usarán esta fecha como base.
      fechaPrestamo,
      // === Periodo de corte + días causados antes del corte ===
      // Caso de uso: cliente solicita crédito ANTES de la fecha de corte.
      // Ej: préstamo 2/08/2026, periodo "5-20" → corte = 5/08/2026.
      // El sistema cobra 3 días de interés anticipado (valorDiasCausados) y
      // las cuotas se programan desde el 5/08/2026 (fechaPrimerCorte).
      periodoCorte,
      fechaPrimerCorte: fechaPrimerCorteRaw,
      diasCausadosAntes,
      valorDiasCausados,
      // === Fecha de la PRIMERA CUOTA (opcional) ===
      // Permite que el asesor defina cuándo vence la cuota #1.
      // El cliente puede pedir una fecha específica en el simulador del portal
      // (campo `primerPagoFecha` de SolicitudWeb); esa fecha llega al asesor
      // al convertir la solicitud y él la confirma o modifica antes de crear.
      // El backend calcula `fechaInicio = fechaPrimerCuota - 1 periodo` (según
      // frecuencia) y lo usa como fecha base para la tabla de amortización.
      // Se ignora cuando hay `periodoCorte` activo.
      fechaPrimerCuota,
      // === Flexibilidad Financiera ===
      // Beneficio opcional que se ofrece cuando el número de cuotas >= 4.
      // DOS tarifas:
      //   - BASICA:  $15.000 COP — 1 uso durante la vigencia
      //   - PREMIUM: $34.900 COP — 2 usos durante la vigencia
      // El cobro se hace UNA sola vez al inicio del crédito, cargado en la primera cuota.
      flexibilidadFinanciera,
      flexibilidadModalidad,
      flexibilidadCosto,
      // === Fondo de Garantía (opcional, tasa configurable) ===
      // El gestor decide si el crédito lleva o no fondo de garantía.
      // Si lleva, se especifica la tasa como decimal (0.05 = 5%).
      // Ya NO se activa automáticamente en el primer préstamo.
      incluirFondoGarantia,
      tasaFondoGarantia,
      // === Cobro de Pagaré + Carta de Instrucciones ===
      // Cargo editable (por defecto $19.900 COP) cobrado UNA sola vez al cliente
      // cuando el préstamo incluye generar pagare + carta de instrucciones.
      cobroPagareCarta,
      valorPagareCarta,
      // === Tarifa de Uso de Plataforma (Tarea U) ===
      // Cargo editable (por defecto $4.900 COP) cobrado UNA sola vez al cliente
      // por el uso de la plataforma tecnológica asociada al crédito.
      cobroTarifaPlataforma,
      valorTarifaPlataforma,
      // === Renovación Anticipada (beneficio opcional del simulador del portal) ===
      // Cobro único de $9.900 COP cuando el cliente activa este beneficio en el
      // simulador. Se cobra UNA sola vez al inicio del crédito y se registra
      // automáticamente en la caja CAJA-RENOVACIONES al activarse tras T&C.
      renovacionAnticipada,
      renovacionAnticipadaCosto,
      // === ID de la solicitud web origen (para auto-marcarla como CONVERTIDA) ===
      solicitudWebOrigenId,
    } = body

    // === Resolver la fecha del préstamo ===
    // Si no se proporciona fechaPrestamo, se usa la fecha actual del sistema (default).
    // Si se proporciona, se parsea como fecha local (sin zona horaria) y se usa para:
    //   - fechaSolicitud (reemplaza el @default(now()) de Prisma)
    //   - fechaDesembolso
    //   - fechaStr del código del préstamo
    //   - fechaVencimiento de cada cuota en la tabla de amortización
    let fechaBasePrestamo: Date = new Date()
    if (fechaPrestamo) {
      // fechaPrestamo viene en formato YYYY-MM-DD desde el input type="date".
      // Lo parseamos como mediodía UTC para evitar que cambie de día por zona horaria.
      const [yyyy, mm, dd] = fechaPrestamo.split('-').map(Number)
      if (yyyy && mm && dd) {
        fechaBasePrestamo = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0))
      }
    }

    // === Resolver fechaPrimerCorte (si viene del frontend, la parseamos) ===
    // El frontend la envía como ISO string (Date.toISOString()).
    // Si no se proporciona, queda null y no se aplica el bloque de corte.
    let fechaPrimerCorte: Date | null = null
    if (fechaPrimerCorteRaw && typeof fechaPrimerCorteRaw === 'string') {
      const parsed = new Date(fechaPrimerCorteRaw)
      if (!isNaN(parsed.getTime())) {
        fechaPrimerCorte = parsed
      }
    }

    // === Resolver fechaPrimerCuota (si viene del frontend, la parseamos) ===
    // El frontend la envía como YYYY-MM-DD (input type="date").
    // Si no se proporciona, queda null y no se aplica el override de primera cuota.
    let fechaPrimerCuotaParsed: Date | null = null
    if (fechaPrimerCuota && typeof fechaPrimerCuota === 'string') {
      const [yyyy, mm, dd] = fechaPrimerCuota.split('-').map(Number)
      if (yyyy && mm && dd) {
        fechaPrimerCuotaParsed = new Date(yyyy, mm - 1, dd, 12, 0, 0)
      } else {
        const parsed = new Date(fechaPrimerCuota)
        if (!isNaN(parsed.getTime())) fechaPrimerCuotaParsed = parsed
      }
    }

    // === Determinar la fecha base para la tabla de amortización ===
    // Prioridad (de mayor a menor):
    //   1. periodoCorte + fechaPrimerCorte → cuotas desde la fecha de corte
    //   2. fechaPrimerCuota → cuota #1 vence en fechaPrimerCuota
    //      Calculamos `fechaInicio = fechaPrimerCuota - 1 periodo` (según
    //      frecuencia: MENSUAL=1 mes, QUINCENAL=15 días, SEMANAL=7 días, DIARIO=1 día)
    //      para que la cuota #1 caiga EXACTAMENTE en fechaPrimerCuota.
    //   3. fechaBasePrestamo → comportamiento por defecto (cuotas desde la fecha del préstamo)
    //
    // NOTA: fechaBasePrestamo se sigue usando para fechaSolicitud, fechaDesembolso
    // y el código del préstamo (representa la fecha real en que se entregó el dinero).
    // Solo la tabla de amortización cambia su fecha base.
    let fechaBaseParaAmortizacion: Date = fechaBasePrestamo
    if (periodoCorte && fechaPrimerCorte) {
      fechaBaseParaAmortizacion = fechaPrimerCorte
    } else if (fechaPrimerCuotaParsed) {
      const fechaInicio = new Date(fechaPrimerCuotaParsed)
      if (frecuencia === 'MENSUAL') fechaInicio.setMonth(fechaInicio.getMonth() - 1)
      else if (frecuencia === 'QUINCENAL') fechaInicio.setDate(fechaInicio.getDate() - 15)
      else if (frecuencia === 'SEMANAL') fechaInicio.setDate(fechaInicio.getDate() - 7)
      else if (frecuencia === 'DIARIO') fechaInicio.setDate(fechaInicio.getDate() - 1)
      fechaBaseParaAmortizacion = fechaInicio
    }

    // === Validar coherencia del bloque de corte ===
    // Si viene periodoCorte pero no fechaPrimerCorte, o diasCausadosAntes sin
    // valorDiasCausados (o viceversa), se rechaza la solicitud.
    if (periodoCorte && !fechaPrimerCorte) {
      return NextResponse.json(
        { success: false, error: 'periodoCorte está activo pero falta fechaPrimerCorte' },
        { status: 400 }
      )
    }
    const valorDiasCausadosNum =
      typeof valorDiasCausados === 'number' ? valorDiasCausados :
      typeof valorDiasCausados === 'string' ? parseFloat(valorDiasCausados) || 0 : 0
    const diasCausadosAntesNum =
      typeof diasCausadosAntes === 'number' ? diasCausadosAntes :
      typeof diasCausadosAntes === 'string' ? parseInt(diasCausadosAntes) || 0 : 0

    const esCuotaPersonalizada = modalidad === 'CUOTA_PERSONALIZADA'
    const esTasaFija = modalidad === 'TASA_FIJA'
    const esInteresFijoSinCapital = modalidad === 'INTERES_FIJO_SIN_CAPITAL'

    // Validaciones según modalidad
    if (esCuotaPersonalizada) {
      if (!clienteId || !montoPrincipal || !tasaMensualPersonalizada || !montoCuotaPersonalizada || !numeroCuotasPersonalizada || !frecuencia) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios para cuota personalizada' },
          { status: 400 }
        )
      }
    } else if (esTasaFija) {
      if (!clienteId || !montoPrincipal || !tasaMensualFija || !numeroCuotasFija || !frecuencia) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios para tasa fija mensual' },
          { status: 400 }
        )
      }
    } else if (esInteresFijoSinCapital) {
      // === Validaciones para INTERES_FIJO_SIN_CAPITAL ===
      // Requiere: cliente, monto (capital), e interesFijoMensual (la cuota mensual)
      if (!clienteId || !montoPrincipal) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios: clienteId y montoPrincipal' },
          { status: 400 }
        )
      }
      const interesFijoNum = parseFloat(interesFijoMensual)
      if (!interesFijoMensual || isNaN(interesFijoNum) || interesFijoNum <= 0) {
        return NextResponse.json(
          { success: false, error: 'El valor del interés fijo mensual es obligatorio para esta modalidad' },
          { status: 400 }
        )
      }
      if (frecuencia !== 'MENSUAL') {
        return NextResponse.json(
          { success: false, error: 'La modalidad INTERES_FIJO_SIN_CAPITAL solo soporta frecuencia MENSUAL' },
          { status: 400 }
        )
      }
    } else {
      if (!clienteId || !montoPrincipal || !tasaInteresAnual || !plazoMeses || !frecuencia) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios' },
          { status: 400 }
        )
      }
    }

    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      include: { categoria: true },
    })
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    // === BLOQUEO DE NUEVOS PRÉSTAMOS PARA CLIENTES CON MORA ACTIVA ===
    // Si el cliente tiene al menos un préstamo en estado EN_MORA o JURIDICO,
    // NO se permite crear un nuevo préstamo. El gestor debe primero resolver
    // la mora (renegociar, pagar, etc.) antes de otorgar nuevo crédito.
    //
    // Excepción: si `forzarBloqueoMora === true` en el body, se omite el bloqueo.
    // Esto permite al ADMIN crear el préstamo con confirmación explícita del riesgo.
    const forzarBloqueoMora = body.forzarBloqueoMora === true
    const prestamosEnMora = await db.prestamo.findMany({
      where: {
        clienteId,
        estado: { in: ['EN_MORA', 'JURIDICO'] },
      },
      select: {
        id: true,
        codigo: true,
        estado: true,
        diasMora: true,
        saldoTotal: true,
        montoMora: true,
      },
    })
    if (prestamosEnMora.length > 0 && !forzarBloqueoMora) {
      const detalle = prestamosEnMora
        .map((p) => `${p.codigo} (${p.estado}, ${p.diasMora} días mora, saldo ${p.saldoTotal.toLocaleString('es-CO')} COP)`)
        .join('; ')
      return NextResponse.json(
        {
          success: false,
          error: `Cliente bloqueado para nuevos préstamos: tiene ${prestamosEnMora.length} crédito(s) en mora o jurídico. Debe resolver la mora antes de crear un nuevo préstamo. Detalle: ${detalle}`,
          codigo: 'CLIENTE_EN_MORA_BLOQUEADO',
          prestamosEnMora,
        },
        { status: 400 }
      )
    }

    // === v4.6 (QA M03 TC-PRE-003): validacion global de monto minimo ===
    // Minimo absoluto del sistema: 50,000 COP. Aplica siempre, incluso si el cliente
    // no tiene categoria asignada. Previere prestamos administrativamente inviables.
    const MONTO_MINIMO_GLOBAL = 50000
    const montoNumGlobal = parseFloat(montoPrincipal)
    if (isNaN(montoNumGlobal) || montoNumGlobal < MONTO_MINIMO_GLOBAL) {
      return NextResponse.json(
        {
          success: false,
          error: `Monto debe ser >= ${MONTO_MINIMO_GLOBAL.toLocaleString('es-CO')} COP. Monto recibido: ${montoPrincipal}`,
          codigo: 'MONTO_INFERIOR_MINIMO',
        },
        { status: 400 }
      )
    }

    // === v4.6 (QA M03 TC-PRE-004): validacion de plazo minimo ===
    // plazoMeses debe ser entero >= 1. Previene division por cero en calculos
    // y prestamos sin cuotas programadas.
    // Aplica cuando el prestamo NO es cuota personalizada ni tasa fija (esas modalidades
    // validan numeroCuotas directamente).
    // Nota: las constantes esCuotaPersonalizada y esTasaFija se declaran más abajo,
    // aquí usamos nombres locales para evitar redeclaración.
    const _esCuotaPersonalizadaPreCheck = modalidad === 'CUOTA_PERSONALIZADA'
    const _esTasaFijaPreCheck = modalidad === 'TASA_FIJA_MENSUAL'
    if (!_esCuotaPersonalizadaPreCheck && !_esTasaFijaPreCheck && plazoMeses !== undefined) {
      const plazoNum = parseInt(plazoMeses)
      if (isNaN(plazoNum) || plazoNum < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Plazo debe ser >= 1 mes.',
            codigo: 'PLAZO_INVALIDO',
          },
          { status: 400 }
        )
      }
    }

    // === Validación de monto por categoría ===
    // Resuelve la categoría: la pasada en el body, o la del cliente, o la del préstamo anterior
    let categoriaValidar: Awaited<ReturnType<typeof db.categoriaCliente.findUnique>> = null
    if (categoriaId) {
      categoriaValidar = await db.categoriaCliente.findUnique({ where: { id: categoriaId } })
    } else if (cliente.categoriaId && cliente.categoria) {
      categoriaValidar = cliente.categoria
    }
    if (categoriaValidar) {
      const montoNumValidar = parseFloat(montoPrincipal)
      const montoMaxCat = Number(categoriaValidar.montoMaximo)
      const montoMinCat = Number(categoriaValidar.montoMinimo)
      if (montoMaxCat > 0 && montoNumValidar > montoMaxCat) {
        return NextResponse.json(
          {
            success: false,
            error: `El monto del préstamo (${montoNumValidar.toLocaleString('es-CO')}) supera el máximo permitido para la categoría "${categoriaValidar.nombre}" (${montoMaxCat.toLocaleString('es-CO')}). Para prestar un monto mayor, asigne al cliente una categoría superior.`,
            codigo: 'MONTO_EXCEDE_CATEGORIA',
          },
          { status: 400 }
        )
      }
      if (montoMinCat > 0 && montoNumValidar < montoMinCat) {
        return NextResponse.json(
          {
            success: false,
            error: `El monto del préstamo (${montoNumValidar.toLocaleString('es-CO')}) es inferior al mínimo permitido para la categoría "${categoriaValidar.nombre}" (${montoMinCat.toLocaleString('es-CO')}).`,
            codigo: 'MONTO_INFERIOR_CATEGORIA',
          },
          { status: 400 }
        )
      }
    }

    // === Cálculo según modalidad ===
    let calculo: any
    let tasaAnualFinal: number
    let tasaMoraFinal: number
    let plazoFinal: number
    let cuotaFinal: number
    let nCuotasFinal: number

    if (esCuotaPersonalizada) {
      const monto = parseFloat(montoPrincipal)
      const tasaMen = parseFloat(tasaMensualPersonalizada)
      const nCuotas = parseInt(numeroCuotasPersonalizada)
      const cuota = parseFloat(montoCuotaPersonalizada)
      tasaAnualFinal = tasaMen * 12
      // Default unificado: si no se especifica mora, usar la tasa de interés anual del préstamo
      tasaMoraFinal = parseFloat(tasaMoraAnual || tasaAnualFinal.toString())
      plazoFinal = frecuencia === 'MENSUAL' ? nCuotas : Math.ceil(nCuotas / (frecuencia === 'QUINCENAL' ? 2 : 4))
      cuotaFinal = cuota
      nCuotasFinal = nCuotas

      // Cálculo local de cuota personalizada
      let cuotasPorMes = 1
      if (frecuencia === 'MENSUAL') cuotasPorMes = 1
      else if (frecuencia === 'QUINCENAL') cuotasPorMes = 2
      else if (frecuencia === 'SEMANAL') cuotasPorMes = 4

      const interesPorCuota = (monto * tasaMen / 100) / cuotasPorMes
      const totalInteresBase = Math.round(interesPorCuota * nCuotas * 100) / 100
      // === Sumar valorDiasCausados al total a pagar si hay bloque de corte activo ===
      const totalPagarBase = Math.round((cuota * nCuotas) * 100) / 100
      const totalPagarConCorte = valorDiasCausadosNum > 0
        ? Math.round((totalPagarBase + valorDiasCausadosNum) * 100) / 100
        : totalPagarBase

      const tabla: any[] = []
      let saldoCapital = monto
      for (let i = 1; i <= nCuotas; i++) {
        const interes = Math.round(interesPorCuota * 100) / 100
        let capital = Math.round((cuota - interes) * 100) / 100
        if (i === nCuotas) capital = Math.round(saldoCapital * 100) / 100
        saldoCapital = Math.round((saldoCapital - capital) * 100) / 100
        if (saldoCapital < 0) saldoCapital = 0

        // === Usar fechaBaseParaAmortizacion como fecha inicial de la cuota ===
        // Si hay periodoCorte activo, fechaBaseParaAmortizacion = fechaPrimerCorte.
        // Si no, fechaBaseParaAmortizacion = fechaBasePrestamo.
        const fechaVenc = new Date(fechaBaseParaAmortizacion.getTime())
        if (frecuencia === 'MENSUAL') fechaVenc.setMonth(fechaVenc.getMonth() + i)
        else if (frecuencia === 'QUINCENAL') fechaVenc.setDate(fechaVenc.getDate() + 15 * i)
        else if (frecuencia === 'SEMANAL') fechaVenc.setDate(fechaVenc.getDate() + 7 * i)

        tabla.push({ numero: i, fechaVencimiento: fechaVenc, montoCuota: i === nCuotas ? Math.round((capital + interes) * 100) / 100 : cuota, capital, interes, saldoCapital })
      }

      calculo = {
        numeroCuotas: nCuotas,
        montoCuota: cuota,
        totalInteres: totalInteresBase,
        totalPagar: totalPagarConCorte,
        tasaAplicada: tasaMen / 100 / cuotasPorMes,
        tablaAmortizacion: tabla,
        fechaVencimiento: tabla[tabla.length - 1]?.fechaVencimiento,
        fondoGarantia: incluirFondoGarantia
          ? Math.round(monto * (Number(tasaFondoGarantia) || 0) * 100) / 100
          : 0,
        // === Campos del bloque de corte (solo si hay valorDiasCausados) ===
        ...(valorDiasCausadosNum > 0 ? {
          valorDiasCausados: valorDiasCausadosNum,
          diasCausadosAntes: diasCausadosAntesNum,
          fechaPrimerCorte,
        } : {}),
      }
    } else if (esTasaFija) {
      // === Modalidad TASA_FIJA (Tasa Fija Mensual sobre capital inicial) ===
      const monto = parseFloat(montoPrincipal)
      const tasaMen = parseFloat(tasaMensualFija)
      const nCuotas = parseInt(numeroCuotasFija)

      tasaAnualFinal = tasaMen * 12
      // Default unificado: si no se especifica mora, usar la tasa de interés anual del préstamo
      tasaMoraFinal = parseFloat(tasaMoraAnual || tasaAnualFinal.toString())
      // Calcular plazo en meses según la frecuencia
      if (frecuencia === 'MENSUAL') plazoFinal = nCuotas
      else if (frecuencia === 'QUINCENAL') plazoFinal = Math.max(1, Math.ceil(nCuotas / 2))
      else if (frecuencia === 'SEMANAL') plazoFinal = Math.max(1, Math.ceil(nCuotas / 4))
      else plazoFinal = nCuotas

      calculo = calcularPrestamoTasaFijaMensual({
        montoPrincipal: monto,
        tasaMensualFija: tasaMen,
        numeroCuotas: nCuotas,
        frecuencia,
        // === Usar fechaBaseParaAmortizacion (corte si hay, si no fechaPrestamo) ===
        fechaDesembolso: fechaBaseParaAmortizacion,
      })
      // === Sumar valorDiasCausados al total a pagar si hay bloque de corte activo ===
      if (valorDiasCausadosNum > 0) {
        calculo = {
          ...calculo,
          totalPagar: Math.round((calculo.totalPagar + valorDiasCausadosNum) * 100) / 100,
          valorDiasCausados: valorDiasCausadosNum,
          diasCausadosAntes: diasCausadosAntesNum,
          fechaPrimerCorte,
        }
      }
      cuotaFinal = calculo.montoCuota
      nCuotasFinal = calculo.numeroCuotas
    } else if (esInteresFijoSinCapital) {
      // === Modalidad INTERES_FIJO_SIN_CAPITAL ===
      // El cliente paga SOLO intereses fijos mensuales mientras mantiene la
      // deuda de capital. El capital se paga aparte en abonos extraordinarios.
      //
      // Para esta modalidad NO hay tabla de amortización tradicional ni
      // plazo definido (el crédito se mantiene activo hasta que se pague
      // todo el capital). El "saldo real" = montoPrincipal - capitalPagadoExtra.
      //
      // Para integrarlo con el modelo existente:
      //   - numeroCuotas = 0 (no hay cuotas programadas; el cliente paga
      //     mensualmente mientras tenga saldo, sin un número fijo)
      //   - montoCuota = interesFijoMensual (la cuota mensual fija de interés)
      //   - totalInteres = 0 (no se conoce el total porque depende de cuántos
      //     meses tome pagar el capital)
      //   - totalPagar = montoPrincipal (solo el capital; los intereses se
      //     cobran mes a mes aparte)
      //   - saldoCapital = montoPrincipal (se reduce con capitalPagadoExtra)
      //   - saldoInteres = 0 (los intereses se generan mes a mes)
      //   - saldoTotal = montoPrincipal - capitalPagadoExtra (saldo real)
      //   - proximaCuotaInteresFecha = fechaBasePrestamo + 1 mes
      //
      // La tasa de interés anual se calcula como:
      //   tasaAnual = (interesFijoMensual / montoPrincipal) * 12 * 100
      // (es informativa — para reportes y estadísticas)
      const monto = parseFloat(montoPrincipal)
      const interesFijo = parseFloat(interesFijoMensual)
      const tasaAnualCalculada = monto > 0 ? (interesFijo / monto) * 12 * 100 : 0

      tasaAnualFinal = Math.round(tasaAnualCalculada * 100) / 100
      tasaMoraFinal = parseFloat(tasaMoraAnual || tasaAnualFinal.toString())
      plazoFinal = 0  // Sin plazo definido
      cuotaFinal = interesFijo
      nCuotasFinal = 0  // Sin cuotas programadas

      // Fecha de la próxima cuota de interés (un mes después del préstamo)
      const proximaCuota = new Date(fechaBaseParaAmortizacion.getTime())
      proximaCuota.setMonth(proximaCuota.getMonth() + 1)

      // Tabla vacía (no aplica amortización tradicional)
      const tablaVacia: any[] = []

      calculo = {
        numeroCuotas: 0,
        montoCuota: interesFijo,
        totalInteres: 0,  // No se conoce — se paga mes a mes
        totalPagar: monto,  // Solo capital; los intereses se cobran aparte
        tasaAplicada: tasaAnualCalculada / 100 / 12,
        tablaAmortizacion: tablaVacia,
        fechaVencimiento: null,  // Sin vencimiento definido
        fondoGarantia: 0,  // No aplica para esta modalidad
        esInteresFijoSinCapital: true,
        interesFijoMensual: interesFijo,
        proximaCuotaInteresFecha: proximaCuota,
        // Info adicional para mostrar en la UI
        tasaAnualCalculada: Math.round(tasaAnualCalculada * 100) / 100,
        tasaMensualCalculada: Math.round((tasaAnualCalculada / 12) * 100) / 100,
      }
    } else {
      tasaAnualFinal = parseFloat(tasaInteresAnual)
      tasaMoraFinal = parseFloat(tasaMoraAnual || tasaInteresAnual)
      plazoFinal = parseInt(plazoMeses)
      calculo = calcularPrestamo({
        montoPrincipal: parseFloat(montoPrincipal),
        tasaInteresAnual: tasaAnualFinal,
        tasaMoraAnual: tasaMoraFinal,
        plazoMeses: plazoFinal,
        frecuencia,
        // === Usar fechaBaseParaAmortizacion (corte si hay, si no fechaPrestamo) ===
        fechaDesembolso: fechaBaseParaAmortizacion,
      })
      // === Sumar valorDiasCausados al total a pagar si hay bloque de corte activo ===
      if (valorDiasCausadosNum > 0) {
        calculo = {
          ...calculo,
          totalPagar: Math.round((calculo.totalPagar + valorDiasCausadosNum) * 100) / 100,
          valorDiasCausados: valorDiasCausadosNum,
          diasCausadosAntes: diasCausadosAntesNum,
          fechaPrimerCorte,
        }
      }
      cuotaFinal = calculo.montoCuota
      nCuotasFinal = calculo.numeroCuotas
    }

    // === Generar código del préstamo con estructura completa ===
    // Formato: INICIALES-CC-CEDULA-FECHA-NUMPRESTAMO
    // Ej: JG-CC-1020509876-20260725-01 (Carlos Gómez, primer préstamo del día)
    // Ej: JG-CC-1020509876-20260725-02 (Carlos Gómez, segundo préstamo del día)
    //
    // Esto permite identificar rápidamente:
    //   - INICIALES: nombre y apellido del cliente
    //   - CC: tipo de documento (cédula de ciudadanía)
    //   - CEDULA: número de cédula
    //   - FECHA: fecha de creación (YYYYMMDD)
    //   - NUMPRESTAMO: número del préstamo activo del cliente (01, 02, 03, etc.)
    // ============================================================================

    // === Generar código del préstamo con estructura completa ===
    // Formato: INICIALES-CC-CEDULA-FECHA-NUMPRESTAMO
    // Ej: JG-CC-1020509876-20260725-01 (Carlos Gómez, primer préstamo del día)
    // Ej: JG-CC-1020509876-20260725-02 (Carlos Gómez, segundo préstamo del día)
    //
    // Esto permite identificar rápidamente:
    //   - INICIALES: nombre y apellido del cliente
    //   - CC: tipo de documento (cédula de ciudadanía)
    //   - CEDULA: número de cédula
    //   - FECHA: fecha de creación (YYYYMMDD) — usa fechaBasePrestamo si se proporciona
    //   - NUMPRESTAMO: número del préstamo activo del cliente (01, 02, 03, etc.)
    // ============================================================================

    // Usar la fecha del préstamo (asignada) si se proporciona, si no, la fecha actual.
    const fechaCodigo = fechaBasePrestamo
    const fechaStr = `${fechaCodigo.getFullYear()}${(fechaCodigo.getMonth() + 1).toString().padStart(2, '0')}${fechaCodigo.getDate().toString().padStart(2, '0')}`

    // Generar iniciales del nombre (primeras letras de cada palabra, máximo 3)
    const nombreCompleto = cliente.nombre.trim().toUpperCase()
    const palabrasNombre = nombreCompleto.split(/\s+/).filter((p) => p.length > 0)
    const iniciales = palabrasNombre
      .slice(0, 3) // máximo 3 palabras (ej: "MARIA FERNANDA LOPEZ" -> "MFL")
      .map((p) => p.charAt(0))
      .join('')

    // Cédula sin caracteres no numéricos
    const cedulaCliente = cliente.cedula.replace(/\D/g, '')

    // Calcular el número del préstamo para este cliente (basado en préstamos previos + 1)
    const prestamosPreviosCliente = await db.prestamo.count({ where: { clienteId } })
    const numPrestamo = (prestamosPreviosCliente + 1).toString().padStart(2, '0')

    // Construir código base
    const codigoBase = `${iniciales}-CC-${cedulaCliente}-${fechaStr}-${numPrestamo}`

    // Verificar si ya existe un préstamo con ese código (caso edge: mismo cliente, mismo día)
    let codigo = codigoBase
    const existeCodigo = await db.prestamo.findUnique({ where: { codigo } })
    if (existeCodigo) {
      // Buscar el siguiente sufijo disponible
      let sufijo = parseInt(numPrestamo) + 1
      let codigoAlt = `${iniciales}-CC-${cedulaCliente}-${fechaStr}-${sufijo.toString().padStart(2, '0')}`
      while (await db.prestamo.findUnique({ where: { codigo: codigoAlt } })) {
        sufijo++
        codigoAlt = `${iniciales}-CC-${cedulaCliente}-${fechaStr}-${sufijo.toString().padStart(2, '0')}`
      }
      codigo = codigoAlt
    }
    const tycToken = aprobarYEnviarTyC ? generarTokenTyC() : null

    // === Fondo de Garantía (opcional, tasa configurable) ===
    // El gestor decide si el crédito lleva fondo. Ya NO se activa automáticamente.
    // Si el gestor lo activó, se usa el monto calculado con la tasa elegida.
    // Si no, se omite (monto = 0).
    const esPrimerPrestamo = prestamosPreviosCliente === 0 // se mantiene para fines informativos
    const fondoGarantiaTasaDecimal = incluirFondoGarantia ? (Number(tasaFondoGarantia) || 0) : 0
    const fondoGarantiaMonto = incluirFondoGarantia
      ? Math.round(parseFloat(montoPrincipal) * fondoGarantiaTasaDecimal * 100) / 100
      : 0

    // === Crear préstamo + (si aplica) cerrar préstamo anterior en $transaction ===
    // Si la renovación falla, NO se crea el préstamo nuevo (rollback atómico).
    const prestamo = await db.$transaction(async (tx) => {
      const nuevo = await tx.prestamo.create({
        data: {
          codigo,
          clienteId,
          categoriaId: categoriaId || null,
          montoPrincipal: parseFloat(montoPrincipal),
          tasaInteresAnual: tasaAnualFinal,
          tasaInteresMensual: tasaAnualFinal / 12,
          tasaMoraDiaria: tasaMoraFinal,
          plazoMeses: plazoFinal,
          frecuencia,
          numeroCuotas: calculo.numeroCuotas,
          montoCuota: calculo.montoCuota,
          totalInteres: calculo.totalInteres,
          totalPagar: calculo.totalPagar,
          tasaAplicada: calculo.tasaAplicada,
          // === Guardar la modalidad de amortización para que las renovaciones
          // puedan detectar si el crédito original era FRANCES / TASA_FIJA /
          // CUOTA_PERSONALIZADA y auto-rellenar el formulario correctamente.
          modalidadAmortizacion: (modalidad || 'FRANCES').toUpperCase(),
          moraCompuestaDiaria: true,
          estado: aprobarYEnviarTyC ? 'PENDIENTE_ACEPTACION' : 'SOLICITUD',
          // === Fechas basadas en fechaBasePrestamo (fecha asignada) ===
          // fechaSolicitud reemplaza el @default(now()) de Prisma.
          // fechaDesembolso se setea si el préstamo se aprueba y envía TyC directamente.
          fechaSolicitud: fechaBasePrestamo,
          fechaDesembolso: aprobarYEnviarTyC ? fechaBasePrestamo : null,
          fechaVencimiento: calculo.fechaVencimiento || null,
          // === Guardar fechaInicioAmortizacion para que los endpoints de pagos
          // usen la fecha correcta al recalcular la tabla de amortización.
          // Si fechaPrimerCuota fue seteada, fechaBaseParaAmortizacion !=
          // fechaBasePrestamo (es fechaPrimerCuota - 1 periodo).
          fechaInicioAmortizacion: fechaBaseParaAmortizacion,
          tycEnviado: !!aprobarYEnviarTyC,
          tycToken,
          requiereDocumentos: requiereDocumentos ?? true,
          generarPagare: generarPagare ?? true,
          generarCarta: generarCarta ?? true,
          docsDatosAdicionales: docsDatosAdicionales ? JSON.stringify(docsDatosAdicionales) : null,
          // Codeudor
          tieneCodeudor: tieneCodeudor || false,
          codeudorId: codeudorId || null,
          codeudorNombre: codeudorNombre || null,
          codeudorCedula: codeudorCedula || null,
          codeudorTelefono: codeudorTelefono || null,
          codeudorEmail: codeudorEmail || null,
          codeudorDireccion: codeudorDireccion || null,
          saldoCapital: parseFloat(montoPrincipal),
          saldoInteres: esInteresFijoSinCapital ? 0 : calculo.totalInteres,
          saldoTotal: esInteresFijoSinCapital ? parseFloat(montoPrincipal) : calculo.totalPagar,
          // === Campos específicos de la modalidad INTERES_FIJO_SIN_CAPITAL ===
          // El cliente paga SOLO intereses fijos mensuales mientras mantiene
          // la deuda de capital. El capital se abona aparte.
          interesFijoMensual: esInteresFijoSinCapital ? parseFloat(interesFijoMensual) : 0,
          capitalPagadoExtra: 0,
          interesPagadoAcumulado: 0,
          proximaCuotaInteresFecha: esInteresFijoSinCapital
            ? (calculo?.proximaCuotaInteresFecha || (() => {
                const d = new Date(fechaBaseParaAmortizacion.getTime())
                d.setMonth(d.getMonth() + 1)
                return d
              })())
            : null,
          // === Fondo de Garantía (condicional) ===
          // Solo se marca como CARGADO si el gestor lo activó explícitamente.
          // Si incluirFondoGarantia=false, el préstamo NO lleva fondo de garantía
          // y no se muestra ni se cobra en ningún flujo (estado de cuenta, pagos, caja).
          // Si incluirFondoGarantia=true, se marca cargado desde el inicio para que:
          //   - Aparezca como concepto en el estado de cuenta
          //   - Se cargue automáticamente a CAJA-GARANTIA al activar el préstamo
          //   - Se refleje en el saldo total
          fondoGarantiaCargado: !!incluirFondoGarantia && fondoGarantiaMonto > 0,
          fondoGarantiaMonto: fondoGarantiaMonto,
          fondoGarantiaTasa: fondoGarantiaTasaDecimal,
          // === Campos del bloque de corte (null si no hay periodo activo) ===
          periodoCorte: periodoCorte || null,
          diasCausadosAntes: diasCausadosAntesNum > 0 ? diasCausadosAntesNum : null,
          valorDiasCausados: valorDiasCausadosNum > 0 ? valorDiasCausadosNum : null,
          fechaPrimerCorte: fechaPrimerCorte || null,
          // === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) ===
          // DOS tarifas: BASICA $15.000 (1 uso) | PREMIUM $34.900 (2 usos)
          // El cobro se hace UNA sola vez al inicio del crédito (cargado en la primera cuota).
          flexibilidadFinanciera: !!flexibilidadFinanciera,
          flexibilidadCosto: (() => {
            if (!flexibilidadFinanciera) return 0
            const modalidad = (flexibilidadModalidad || 'BASICA').toUpperCase()
            if (flexibilidadCosto && parseFloat(flexibilidadCosto) > 0) return parseFloat(flexibilidadCosto)
            return modalidad === 'PREMIUM' ? 34900 : 15000
          })(),
          flexibilidadModalidad: flexibilidadFinanciera
            ? ((flexibilidadModalidad || 'BASICA').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'BASICA')
            : null,
          flexibilidadUsosDisponibles: flexibilidadFinanciera
            ? ((flexibilidadModalidad || 'BASICA').toUpperCase() === 'PREMIUM' ? 2 : 1)
            : 0,
          flexibilidadUsosEjercidos: 0,
          flexibilidadActivada: !!flexibilidadFinanciera,  // se cobra al inicio, queda activo
          flexibilidadFechaActivacion: flexibilidadFinanciera ? new Date() : null,
          flexibilidadCobroAplicado: false,  // se marca true cuando se cargue en la primera cuota
          // === Cobro de Pagaré + Carta de Instrucciones ===
          cobroPagareCarta: !!cobroPagareCarta,
          valorPagareCarta: cobroPagareCarta
            ? (Number(valorPagareCarta) > 0 ? Number(valorPagareCarta) : 19900)
            : 0,
          // === Tarifa de Uso de Plataforma (Tarea U) ===
          cobroTarifaPlataforma: !!cobroTarifaPlataforma,
          valorTarifaPlataforma: cobroTarifaPlataforma
            ? (Number(valorTarifaPlataforma) > 0 ? Number(valorTarifaPlataforma) : 4900)
            : 0,
          tarifaPlataformaCargada: false,  // se marca true cuando se registre el ingreso en caja
          // === Renovación Anticipada (beneficio opcional del simulador del portal) ===
          // Cobro único de $9.900 COP cuando el cliente activa este beneficio.
          // El cobro se registra automáticamente en CAJA-RENOVACIONES al activarse
          // el préstamo tras la aceptación de T&C.
          renovacionAnticipada: !!renovacionAnticipada,
          renovacionAnticipadaCosto: renovacionAnticipada
            ? (Number(renovacionAnticipadaCosto) > 0 ? Number(renovacionAnticipadaCosto) : 9900)
            : 0,
          // === RENOVACIÓN DIFERIDA (Tarea T) ===
          // Si es renovación, marcamos el nuevo préstamo como pendiente de T&C y
          // guardamos la referencia al crédito anterior. El crédito anterior NO se
          // cancela aquí — se cancela cuando el cliente acepta los T&C del nuevo
          // (ver /api/prestamos/[id]/aceptar-tyc-otp -> confirmarConFoto y
          //  confirmarActivacion).
          renovacionPendienteTyc: !!(esRenovacion && prestamoARenovarId),
          renovacionPrestamoAnteriorId: (esRenovacion && prestamoARenovarId) ? prestamoARenovarId : null,
          notas: notas || null,
        },
        include: { cliente: true },
      })

      // === Si es renovación, registrar trazabilidad SIN cancelar el anterior ===
      // (Tarea T) El crédito anterior se mantiene ACTIVO hasta que el cliente acepte
      // los T&C del nuevo préstamo. Solo se registran bitácoras y el RenovacionPrestamo.
      // La cancelación real ocurre en /api/prestamos/[id]/aceptar-tyc-otp cuando
      // el cliente completa el flujo de firma (OTP + fotos + firma manuscrita).
      if (esRenovacion && prestamoARenovarId) {
        const prestamoAnterior = await tx.prestamo.findUnique({
          where: { id: prestamoARenovarId },
          include: { cliente: true },
        })

        if (prestamoAnterior) {
          const saldoAnterior = saldoPendienteRenovacion || prestamoAnterior.saldoTotal || 0
          const capitalNuevo = parseFloat(montoPrincipal)
          const excedente = Math.max(0, capitalNuevo - saldoAnterior)
          const diferencia = saldoAnterior - capitalNuevo

          // === NOTA IMPORTANTE ===
          // NO se modifica el estado del préstamo anterior aquí.
          // Queda en su estado actual (ACTIVO/EN_MORA/JURIDICO) hasta que el cliente
          // acepte los T&C del nuevo préstamo.
          // La cancelación se ejecuta en aceptar-tyc-otp -> cancelarPrestamoAnteriorSiRenovacion().

          // === Bitácora del préstamo ANTERIOR (aviso de renovación en trámite) ===
          await tx.bitacoraPrestamo.create({
            data: {
              prestamoId: prestamoARenovarId,
              prestamoCodigo: prestamoAnterior.codigo,
              usuarioNombre: 'Sistema',
              tipo: 'OTRO',
              titulo: `RENOVACIÓN EN TRÁMITE (PENDIENTE ACEPTACIÓN T&C)`,
              descripcion: `Se creó un nuevo préstamo ${codigo} como renovación de este crédito.\n\n` +
                `═══ ESTADO ACTUAL ═══\n` +
                `• Este crédito sigue ACTIVO hasta que el cliente acepte los T&C del nuevo.\n` +
                `• Saldo pendiente: ${formatearMoneda(saldoAnterior)}\n` +
                `• Estado: ${prestamoAnterior.estado} (sin cambios)\n\n` +
                `═══ NUEVO CRÉDITO ═══\n` +
                `• Nuevo código: ${codigo}\n` +
                `• Capital nuevo: ${formatearMoneda(capitalNuevo)}\n` +
                `• Excedente a entregar al cliente: ${formatearMoneda(excedente)}\n` +
                (diferencia > 0
                  ? `• Cliente abonará diferencia: ${formatearMoneda(diferencia)}\n`
                  : '') +
                `\n📅 Fecha de inicio del trámite: ${new Date().toLocaleString('es-CO')}\n` +
                `⏳ Pendiente: cliente debe aceptar T&C del nuevo crédito para que este se CANCELE.`,
              resultado: `Renovación en trámite → ${codigo}`,
              fechaEvento: new Date(),
            },
          })

          // === Bitácora del NUEVO préstamo ===
          await tx.bitacoraPrestamo.create({
            data: {
              prestamoId: nuevo.id,
              prestamoCodigo: codigo,
              usuarioNombre: 'Sistema',
              tipo: 'OTRO',
              titulo: `CRÉDITO CREADO POR RENOVACIÓN (PENDIENTE ACEPTACIÓN T&C)`,
              descripcion: `Este crédito fue creado como renovación de un crédito anterior.\n\n` +
                `═══ ORIGEN DEL CRÉDITO ═══\n` +
                `• Crédito anterior (en trámite de renovación): ${prestamoAnterior.codigo}\n` +
                `• Saldo pendiente del crédito anterior: ${formatearMoneda(saldoAnterior)}\n` +
                `• Estado del crédito anterior: ${prestamoAnterior.estado} (sigue activo)\n\n` +
                `═══ DETALLE DE LA RENOVACIÓN ═══\n` +
                `• Capital nuevo solicitado: ${formatearMoneda(capitalNuevo)}\n` +
                `• Saldo trasladado del crédito anterior: ${formatearMoneda(saldoAnterior)}\n` +
                `• Excedente a entregar al cliente (efectivo): ${formatearMoneda(excedente)}\n` +
                (diferencia > 0
                  ? `• Cliente abonará la diferencia: ${formatearMoneda(diferencia)}\n`
                  : '') +
                `\n⏳ El crédito anterior ${prestamoAnterior.codigo} se cancelará automáticamente ` +
                `cuando el cliente acepte los T&C de este nuevo préstamo.\n\n` +
                `📅 Fecha de creación: ${new Date().toLocaleString('es-CO')}`,
              resultado: `Renovación de ${prestamoAnterior.codigo} (pendiente T&C)`,
              fechaEvento: new Date(),
            },
          })

          // === Audit log de la renovación (pendiente T&C) ===
          await tx.auditLog.create({
            data: {
              usuarioNombre: 'Sistema',
              accion: 'PRESTAMO_RENOVADO_PENDIENTE_TYC',
              modulo: 'prestamos',
              entidadId: nuevo.id,
              entidadNombre: `${codigo} - ${cliente.nombre}`,
              detalles: JSON.stringify({
                prestamoAnteriorId: prestamoARenovarId,
                prestamoAnteriorCodigo: prestamoAnterior.codigo,
                prestamoAnteriorEstadoAlCrear: prestamoAnterior.estado,
                prestamoNuevoId: nuevo.id,
                prestamoNuevoCodigo: codigo,
                saldoAnterior,
                capitalNuevo,
                excedente,
                diferencia: diferencia > 0 ? diferencia : 0,
                nota: 'El crédito anterior NO se canceló. Pendiente aceptación T&C del nuevo.',
              }),
              exito: true,
            },
          })

          // === Registro formal de la renovación (RenovacionPrestamo) ===
          // Crea un registro auditable que vincula el crédito anterior con el
          // nuevo, almacenando TODAS las nuevas condiciones para trazabilidad.
          // Esto complementa los bitácoras y audit logs con un modelo estructurado.
          const fechaInicioPago = calculo.fechaVencimiento
            ? new Date(calculo.fechaVencimiento)
            : new Date(fechaBasePrestamo)

          await tx.renovacionPrestamo.create({
            data: {
              prestamoOriginalId: prestamoARenovarId,
              prestamoNuevoId: nuevo.id,
              saldoAnterior,
              nuevoMontoPrestado: capitalNuevo,
              nuevaTasaInteresAnual: tasaAnualFinal,
              nuevoPlazoMeses: plazoFinal,
              nuevaFrecuencia: frecuencia,
              nuevoNumeroCuotas: calculo.numeroCuotas,
              nuevaMontoCuota: calculo.montoCuota,
              nuevoTotalInteres: calculo.totalInteres,
              nuevoTotalPagar: calculo.totalPagar,
              fechaInicioPago,
              motivoRenovacion: notas
                ? `Renovación automática desde solicitud. Notas: ${notas}`
                : 'Renovación automática desde solicitud de préstamo',
              usuarioNombre: 'Sistema',
            },
          })
        }
      }

      return nuevo
    })

    // === Auto-marcar la solicitud web origen como CONVERTIDA ===
    // Si el préstamo se creó a partir de una solicitud web del portal del cliente,
    // marcamos la solicitud como CONVERTIDA y activamos el flujo de firma del lado del cliente.
    // El cliente verá en su portal el flujo: cargue de fotos + firma manuscrita + OTP.
    if (solicitudWebOrigenId) {
      try {
        const now = new Date()
        const solicitudActual = await db.solicitudWeb.findUnique({
          where: { id: solicitudWebOrigenId },
          select: { estado: true, historialEstados: true },
        })
        if (solicitudActual && solicitudActual.estado !== 'CONVERTIDA') {
          let historial: any[] = []
          try {
            historial = solicitudActual.historialEstados ? JSON.parse(solicitudActual.historialEstados) : []
          } catch {
            historial = []
          }
          historial.push({
            estado: 'CONVERTIDA',
            fecha: now.toISOString(),
            usuario: 'Sistema (auto)',
            observacion: `Convertida automáticamente al crear préstamo ${codigo}. Flujo de firma activado para el cliente.`,
          })
          await db.solicitudWeb.update({
            where: { id: solicitudWebOrigenId },
            data: {
              estado: 'CONVERTIDA',
              prestamoCreadoId: prestamo.id,
              fechaConversion: now,
              estadoFlujoFirma: 'EN_FIRMA_CLIENTE',
              fechaRevision: now,
              historialEstados: JSON.stringify(historial),
            },
          })
        }
      } catch (e) {
        // No bloquear la creación del préstamo si falla la actualización de la solicitud
        console.error('[prestamos POST] Error auto-marcando solicitud web como CONVERTIDA:', e)
      }
    }

    // WhatsApp inicial (solicitud creada)
    const primerCuota = calculo.tablaAmortizacion[0]
    const mensaje = mensajeSolicitudCreada({
      nombreCliente: cliente.nombre,
      codigoPrestamo: codigo,
      monto: parseFloat(montoPrincipal),
      cuota: calculo.montoCuota,
      numeroCuotas: calculo.numeroCuotas,
      fechaPrimerPago: primerCuota?.fechaVencimiento.toLocaleDateString('es-CO') || '—',
    })

    const resultadoEnvio = await enviarWhatsApp(cliente.telefono, mensaje)

    await guardarNotificacion({
      db,
      prestamoId: prestamo.id,
      telefono: cliente.telefono,
      tipo: 'SOLICITUD',
      mensaje,
      envio: resultadoEnvio,
    })

    // Si se aprueba y envía T&C, enviar mensaje de aprobación con link
    if (aprobarYEnviarTyC) {
      const linkAceptacion = buildAbsoluteUrl(`/?tyc=${tycToken}`)
      const mensajeTyC = mensajeAprobacionTyC({
        nombreCliente: cliente.nombre,
        codigoPrestamo: codigo,
        monto: parseFloat(montoPrincipal),
        cuota: calculo.montoCuota,
        numeroCuotas: calculo.numeroCuotas,
        tasaAnual: parseFloat(tasaInteresAnual),
        totalPagar: calculo.totalPagar,
        linkAceptacion,
      })
      const envioTyC = await enviarWhatsApp(cliente.telefono, mensajeTyC)
      await guardarNotificacion({
        db,
        prestamoId: prestamo.id,
        telefono: cliente.telefono,
        tipo: 'TYC',
        mensaje: mensajeTyC,
        envio: envioTyC,
      })

      return NextResponse.json({
        success: true,
        data: prestamo,
        calculo,
        whatsapp: resultadoEnvio,
        whatsappTyc: envioTyC,
        linkTycWaMe: envioTyC.linkWaMe,
        esPrimerPrestamo,
        fondoGarantia: fondoGarantiaMonto,
      })
    }

    return NextResponse.json({
      success: true,
      data: prestamo,
      calculo,
      whatsapp: resultadoEnvio,
      linkSolicitudWaMe: resultadoEnvio.linkWaMe,
      esPrimerPrestamo,
      fondoGarantia: fondoGarantiaMonto,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
