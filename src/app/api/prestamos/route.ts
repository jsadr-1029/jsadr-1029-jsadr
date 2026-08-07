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
        _count: { select: { pagos: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: prestamos })
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
      // === Flexibilidad Financiera ===
      // Beneficio opcional que se ofrece cuando el número de cuotas >= 4.
      // Costo adicional fijo de $10.000 COP. Permite al cliente:
      //   1. Trasladar una cuota al final del crédito
      //   2. Solicitar cambio de fecha de pago (genera documento "Otro Sí")
      flexibilidadFinanciera,
      flexibilidadCosto,
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

    // === Determinar la fecha base para la tabla de amortización ===
    // Si hay periodoCorte activo y fechaPrimerCorte calculada, las cuotas
    // se programan desde fechaPrimerCorte (no desde fechaPrestamo).
    // Esto implementa la regla: "las fechas de pago se iniciaran desde
    // esa fecha corte" (ej: préstamo 2/08 con corte 5-20 → cuotas desde 5/08).
    //
    // NOTA: fechaBasePrestamo se sigue usando para fechaSolicitud, fechaDesembolso
    // y el código del préstamo (representa la fecha real en que se entregó el dinero).
    // Solo la tabla de amortización cambia su fecha base.
    const fechaBaseParaAmortizacion: Date =
      periodoCorte && fechaPrimerCorte ? fechaPrimerCorte : fechaBasePrestamo

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
        fondoGarantia: Math.round(monto * 0.05 * 100) / 100,
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
    } else {
      // Modalidad francés
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

    // Verificar si es primer préstamo del cliente (para fondo de garantía)
    const esPrimerPrestamo = prestamosPreviosCliente === 0
    const fondoGarantiaMonto = esPrimerPrestamo ? calculo.fondoGarantia : 0

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
          moraCompuestaDiaria: true,
          estado: aprobarYEnviarTyC ? 'PENDIENTE_ACEPTACION' : 'SOLICITUD',
          // === Fechas basadas en fechaBasePrestamo (fecha asignada) ===
          // fechaSolicitud reemplaza el @default(now()) de Prisma.
          // fechaDesembolso se setea si el préstamo se aprueba y envía TyC directamente.
          fechaSolicitud: fechaBasePrestamo,
          fechaDesembolso: aprobarYEnviarTyC ? fechaBasePrestamo : null,
          fechaVencimiento: calculo.fechaVencimiento || null,
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
          saldoInteres: calculo.totalInteres,
          saldoTotal: calculo.totalPagar,
          fondoGarantiaCargado: false,
          fondoGarantiaMonto: fondoGarantiaMonto,
          // === Campos del bloque de corte (null si no hay periodo activo) ===
          periodoCorte: periodoCorte || null,
          diasCausadosAntes: diasCausadosAntesNum > 0 ? diasCausadosAntesNum : null,
          valorDiasCausados: valorDiasCausadosNum > 0 ? valorDiasCausadosNum : null,
          fechaPrimerCorte: fechaPrimerCorte || null,
          // === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) ===
          flexibilidadFinanciera: !!flexibilidadFinanciera,
          flexibilidadCosto:
            flexibilidadFinanciera && flexibilidadCosto
              ? parseFloat(flexibilidadCosto)
              : flexibilidadFinanciera
                ? 10000
                : 0,
          flexibilidadActivada: false,
          flexibilidadFechaActivacion: null,
          notas: notas || null,
        },
        include: { cliente: true },
      })

      // === Si es renovación, finalizar el préstamo anterior y registrar en bitácora ===
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

          // Finalizar el préstamo anterior (CANCELADO)
          await tx.prestamo.update({
            where: { id: prestamoARenovarId },
            data: {
              estado: 'CANCELADO',
              saldoCapital: 0,
              saldoInteres: 0,
              saldoTotal: 0,
              notas: `Finalizado por renovación - nuevo préstamo: ${codigo}`,
            },
          })

          // === Bitácora del préstamo ANTERIOR ===
          await tx.bitacoraPrestamo.create({
            data: {
              prestamoId: prestamoARenovarId,
              prestamoCodigo: prestamoAnterior.codigo,
              usuarioNombre: 'Sistema',
              tipo: 'OTRO',
              titulo: `CRÉDITO CERRADO POR RENOVACIÓN`,
              descripcion: `Este crédito fue finalizado (CANCELADO) porque el cliente solicitó una renovación.\n\n` +
                `═══ ORIGEN DEL CIERRE ═══\n` +
                `• Crédito anterior (este): ${prestamoAnterior.codigo}\n` +
                `• Saldo pendiente al cierre: ${formatearMoneda(saldoAnterior)}\n` +
                `• Estado anterior: ${prestamoAnterior.estado}\n` +
                `• Estado actual: CANCELADO\n\n` +
                `═══ NUEVO CRÉDITO ═══\n` +
                `• Nuevo código: ${codigo}\n` +
                `• Capital nuevo: ${formatearMoneda(capitalNuevo)}\n` +
                `• Excedente entregado al cliente: ${formatearMoneda(excedente)}\n` +
                (diferencia > 0
                  ? `• Cliente abonó diferencia: ${formatearMoneda(diferencia)}\n`
                  : '') +
                `\n📅 Fecha de renovación: ${new Date().toLocaleString('es-CO')}`,
              resultado: `Renovado → ${codigo}`,
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
              titulo: `CRÉDITO CREADO POR RENOVACIÓN`,
              descripcion: `Este crédito fue creado como renovación de un crédito anterior.\n\n` +
                `═══ ORIGEN DEL CRÉDITO ═══\n` +
                `• Crédito anterior (renovado): ${prestamoAnterior.codigo}\n` +
                `• Saldo pendiente del crédito anterior: ${formatearMoneda(saldoAnterior)}\n` +
                `• Estado del crédito anterior: CANCELADO\n\n` +
                `═══ DETALLE DE LA RENOVACIÓN ═══\n` +
                `• Capital nuevo solicitado: ${formatearMoneda(capitalNuevo)}\n` +
                `• Saldo trasladado del crédito anterior: ${formatearMoneda(saldoAnterior)}\n` +
                `• Excedente entregado al cliente (efectivo): ${formatearMoneda(excedente)}\n` +
                (diferencia > 0
                  ? `• Cliente abonó la diferencia: ${formatearMoneda(diferencia)}\n`
                  : '') +
                `\n💡 El cliente recibió ${formatearMoneda(excedente)} en efectivo. ` +
                `El crédito anterior ${prestamoAnterior.codigo} quedó CANCELADO.\n\n` +
                `📅 Fecha de renovación: ${new Date().toLocaleString('es-CO')}`,
              resultado: `Renovación de ${prestamoAnterior.codigo}`,
              fechaEvento: new Date(),
            },
          })

          // === Audit log de la renovación ===
          await tx.auditLog.create({
            data: {
              usuarioNombre: 'Sistema',
              accion: 'PRESTAMO_RENOVADO',
              modulo: 'prestamos',
              entidadId: nuevo.id,
              entidadNombre: `${codigo} - ${cliente.nombre}`,
              detalles: JSON.stringify({
                prestamoAnteriorId: prestamoARenovarId,
                prestamoAnteriorCodigo: prestamoAnterior.codigo,
                prestamoNuevoId: nuevo.id,
                prestamoNuevoCodigo: codigo,
                saldoAnterior,
                capitalNuevo,
                excedente,
                diferencia: diferencia > 0 ? diferencia : 0,
              }),
              exito: true,
            },
          })
        }
      }

      return nuevo
    })

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
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const linkAceptacion = `${baseUrl}/?tyc=${tycToken}`
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
