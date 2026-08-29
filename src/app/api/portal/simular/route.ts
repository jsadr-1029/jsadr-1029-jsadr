import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, generarCronograma } from '@/lib/finance'
import {
  calcularFechaPrimerCorte,
  calcularDiasCausadosAntes,
  calcularValorDiasCausados,
} from '@/lib/corte-fechas'

// Simula un solicitud basado en una categoría
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { monto, categoriaId, plazoMeses, frecuencia, token, flexibilidadFinanciera, flexibilidadModalidad, periodoCorte, fechaSolicitud } = body

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
    }

    // === Flexibilidad Financiera ===
    const FLEXIBILIDAD_COSTO_BASICA = 15000
    const FLEXIBILIDAD_COSTO_PREMIUM = 34900

    // === Tarifa de Plataforma (OBLIGATORIA cuando tasa ≥ 15%) ===
    // $4.900 COP — cobro único al inicio del crédito (cargado en la primera cuota).
    // Cubre uso de firma electrónica, generación de pagaré digital,
    // almacenamiento seguro del expediente y trazabilidad del AuditLog.
    // FIX (2026-08-21): la tarifa SOLO se cobra cuando la tasa mensual es ≥ 15%.
    // Para tasas menores (ej: tasa preferencial del 5%), no se cobra.
    const TARIFA_PLATAFORMA = 4900
    const TASA_MIN_PARA_TARIFA = 15  // % mensual mínimo para cobrar tarifa

    const plazoNumFlex = Number(plazoMeses) || 1
    const frecFlex = frecuencia || 'MENSUAL'
    let cuotasSimuladas = plazoNumFlex
    if (frecFlex === 'QUINCENAL') cuotasSimuladas = plazoNumFlex * 2
    else if (frecFlex === 'SEMANAL') cuotasSimuladas = plazoNumFlex * 4
    const flexElegible = cuotasSimuladas >= 4
    const modalidadElegida = (flexibilidadModalidad || 'BASICA').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'BASICA'
    const flexActivada = !!flexibilidadFinanciera && flexElegible
    const flexCostoCalculado = flexElegible
      ? (modalidadElegida === 'PREMIUM' ? FLEXIBILIDAD_COSTO_PREMIUM : FLEXIBILIDAD_COSTO_BASICA)
      : 0
    const flexUsosDisponibles = flexActivada ? (modalidadElegida === 'PREMIUM' ? 2 : 1) : 0

    // === Determinar tasa mensual para validar si aplica tarifa de plataforma ===
    let tasaMensualSimulacion = 20  // default
    let categoria: Awaited<ReturnType<typeof db.categoriaCliente.findUnique>> = null
    if (categoriaId) {
      categoria = await db.categoriaCliente.findUnique({ where: { id: categoriaId } })
    }
    if (categoria) {
      tasaMensualSimulacion = Number(categoria.tasaInteresAnual) / 12
    }
    // === FIX (2026-08-21): la tarifa de plataforma SOLO se cobra cuando tasa ≥ 15% ===
    const tarifaPlataformaAplica = tasaMensualSimulacion >= TASA_MIN_PARA_TARIFA
    const tarifaPlataformaMonto = tarifaPlataformaAplica ? TARIFA_PLATAFORMA : 0

    // === Calcular periodo de corte y días causados (2026-08-21) ===
    // Si el cliente seleccionó un periodo de corte (5-20, 15-30, o una fecha
    // sugerida personalizada), calcular:
    //   - fechaPrimerCorte: la fecha del corte más cercano a la fecha de solicitud.
    //   - diasCausadosAntes: días entre la fecha de solicitud y el corte.
    //   - valorDiasCausados: monto COP a cobrar por esos días (interés anticipado).
    let infoCorte: any = null
    if (periodoCorte && periodoCorte !== 'NINGUNO') {
      const fechaSolicitudDate = fechaSolicitud ? new Date(fechaSolicitud) : new Date()
      try {
        const fechaPrimerCorteCalc = calcularFechaPrimerCorte(fechaSolicitudDate, periodoCorte as any)
        if (fechaPrimerCorteCalc) {
          const diasCausadosAntes = calcularDiasCausadosAntes(fechaSolicitudDate, fechaPrimerCorteCalc)
          const montoNum = Number(monto)
          const tasaMensual = tasaMensualSimulacion
          const valorDiasCausados = diasCausadosAntes > 0
            ? calcularValorDiasCausados(montoNum, diasCausadosAntes, tasaMensual, 'MENSUAL')
            : 0
          infoCorte = {
            periodoCorte,
            fechaPrimerCorte: fechaPrimerCorteCalc.toISOString(),
            diasCausadosAntes,
            valorDiasCausados,
            mensaje: diasCausadosAntes > 0
              ? `Tu solicitud es del ${fechaSolicitudDate.toLocaleDateString('es-CO')}. El próximo corte es el ${fechaPrimerCorteCalc.toLocaleDateString('es-CO')}. Se cobrarán ${diasCausadosAntes} días de interés anticipado por valor de $${valorDiasCausados.toLocaleString('es-CO')}. Este valor se suma al total a pagar.`
              : `Tu solicitud cae justo en un día de corte (${fechaPrimerCorteCalc.toLocaleDateString('es-CO')}). No hay días causados adicionales.`,
          }
        }
      } catch (e) {
        // Si falla el cálculo de corte, continuar sin corte
      }
    }

    if (!categoria) {
      // Si no hay categoría, usar valores por defecto
      const calcDefault = calcularPrestamo({
        monto: Number(monto),
        tasaMensual: 20,
        plazoMeses: Number(plazoMeses) || 1,
        frecuencia: frecuencia || 'MENSUAL',
      })
      const totalCargos = tarifaPlataformaMonto + flexCostoCalculado + (infoCorte?.valorDiasCausados || 0)
      const totalConCargosDefault = calcDefault.totalPagar + totalCargos
      return NextResponse.json({
        simulacion: {
          monto: Number(monto),
          tasaMensual: 20,
          tasaAnual: 240,
          plazoMeses: Number(plazoMeses) || 1,
          frecuencia: frecuencia || 'MENSUAL',
          ...calcDefault,
          // === Tarifa Plataforma (obligatoria cuando tasa ≥ 15%) ===
          tarifaPlataforma: tarifaPlataformaMonto,
          tarifaPlataformaObligatoria: tarifaPlataformaAplica,
          tarifaPlataformaRazon: tarifaPlataformaAplica
            ? `Cobro obligatorio porque la tasa mensual (${tasaMensualSimulacion.toFixed(2)}%) es ≥ ${TASA_MIN_PARA_TARIFA}%. Se cobra una sola vez durante la vigencia del solicitud, cargado en la primera cuota.`
            : `No se cobra porque la tasa mensual (${tasaMensualSimulacion.toFixed(2)}%) es < ${TASA_MIN_PARA_TARIFA}%.`,
          // === Flexibilidad Financiera ===
          flexibilidadFinanciera: flexActivada,
          flexibilidadElegible: flexElegible,
          flexibilidadModalidad: flexActivada ? modalidadElegida : null,
          flexibilidadCosto: flexCostoCalculado,
          flexibilidadCuotasRequeridas: 4,
          flexibilidadUsosDisponibles: flexUsosDisponibles,
          // === Información de corte ===
          ...(infoCorte ? { corte: infoCorte } : {}),
          // === Totales con cargos ===
          totalCargosIniciales: totalCargos,
          totalPagarConCargos: totalConCargosDefault,
          primeraCuotaConCargos: calcDefault.montoCuota + totalCargos,
          cargosIniciales: [
            ...(tarifaPlataformaAplica
              ? [{
                  concepto: 'TARIFA_PLATAFORMA',
                  descripcion: 'Tarifa de Uso de Plataforma (cobro único)',
                  monto: TARIFA_PLATAFORMA,
                  obligatorio: true,
                  explicacion: 'Se cobra una sola vez durante la vigencia del solicitud. Se carga en la primera cuota.',
                }]
              : []),
            ...(flexActivada
              ? [{
                  concepto: 'FLEXIBILIDAD',
                  descripcion: `Flexibilidad Financiera ${modalidadElegida}`,
                  monto: flexCostoCalculado,
                  obligatorio: false,
                  modalidad: modalidadElegida,
                  usosDisponibles: flexUsosDisponibles,
                }]
              : []),
            ...(infoCorte && infoCorte.valorDiasCausados > 0
              ? [{
                  concepto: 'DIAS_CAUSADOS',
                  descripcion: `${infoCorte.diasCausadosAntes} días de interés anticipado`,
                  monto: infoCorte.valorDiasCausados,
                  obligatorio: true,
                  explicacion: infoCorte.mensaje,
                }]
              : []),
          ],
        },
        cronograma: generarCronograma({
          monto: Number(monto),
          tasaMensual: 20,
          plazoMeses: Number(plazoMeses) || 1,
          frecuencia: frecuencia || 'MENSUAL',
        }),
      })
    }

    const montoNum = Number(monto)
    const plazoNum = Number(plazoMeses)
    const frec = frecuencia || 'MENSUAL'

    // === Validar monto dentro del rango permitido por la categoría ===
    const montoMin = Number(categoria.montoMinimo)
    const montoMax = Number(categoria.montoMaximo)
    if (montoMax > 0 && montoNum > montoMax) {
      return NextResponse.json(
        { error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) supera el máximo permitido para la categoría "${categoria.nombre}": ${montoMax.toLocaleString('es-CO')}.` },
        { status: 400 }
      )
    }
    if (montoMin > 0 && montoNum < montoMin) {
      return NextResponse.json(
        { error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) es inferior al mínimo permitido para la categoría "${categoria.nombre}": ${montoMin.toLocaleString('es-CO')}.` },
        { status: 400 }
      )
    }

    // Calcular tasa mensual desde la anual de la categoría
    const tasaMensual = Number(categoria.tasaInteresAnual) / 12

    const calc = calcularPrestamo({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })

    const cronograma = generarCronograma({
      monto: montoNum,
      tasaMensual,
      plazoMeses: plazoNum,
      frecuencia: frec,
    })

    const totalCargos = tarifaPlataformaMonto + flexCostoCalculado + (infoCorte?.valorDiasCausados || 0)
    const totalConCargos = calc.totalPagar + totalCargos
    const primeraCuotaConCargos = calc.montoCuota + totalCargos

    return NextResponse.json({
      simulacion: {
        monto: montoNum,
        tasaMensual,
        tasaAnual: Number(categoria.tasaInteresAnual),
        tasaMoraAnual: Number(categoria.tasaMoraAnual),
        plazoMeses: plazoNum,
        frecuencia: frec,
        categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        ...calc,
        // === Tarifa Plataforma (obligatoria cuando tasa ≥ 15%) ===
        tarifaPlataforma: tarifaPlataformaMonto,
        tarifaPlataformaObligatoria: tarifaPlataformaAplica,
        tarifaPlataformaRazon: tarifaPlataformaAplica
          ? `Cobro obligatorio porque la tasa mensual (${tasaMensual.toFixed(2)}%) es ≥ ${TASA_MIN_PARA_TARIFA}%. Se cobra una sola vez durante la vigencia del solicitud, cargado en la primera cuota.`
          : `No se cobra porque la tasa mensual (${tasaMensual.toFixed(2)}%) es < ${TASA_MIN_PARA_TARIFA}%.`,
        // === Flexibilidad Financiera ===
        flexibilidadFinanciera: flexActivada,
        flexibilidadElegible: flexElegible,
        flexibilidadModalidad: flexActivada ? modalidadElegida : null,
        flexibilidadCosto: flexCostoCalculado,
        flexibilidadCuotasRequeridas: 4,
        flexibilidadUsosDisponibles: flexUsosDisponibles,
        // === Información de corte ===
        ...(infoCorte ? { corte: infoCorte } : {}),
        // === Totales con cargos iniciales incluidos ===
        totalCargosIniciales: totalCargos,
        totalPagarConCargos: totalConCargos,
        primeraCuotaConCargos: primeraCuotaConCargos,
        cargosIniciales: [
          ...(tarifaPlataformaAplica
            ? [{
                concepto: 'TARIFA_PLATAFORMA',
                descripcion: 'Tarifa de Uso de Plataforma (cobro único)',
                monto: TARIFA_PLATAFORMA,
                obligatorio: true,
                explicacion: 'Se cobra una sola vez durante la vigencia del solicitud. Se carga en la primera cuota.',
              }]
            : []),
          ...(flexActivada
            ? [{
                concepto: 'FLEXIBILIDAD',
                descripcion: `Flexibilidad Financiera ${modalidadElegida}`,
                monto: flexCostoCalculado,
                obligatorio: false,
                modalidad: modalidadElegida,
                usosDisponibles: flexUsosDisponibles,
              }]
            : []),
          ...(infoCorte && infoCorte.valorDiasCausados > 0
            ? [{
                concepto: 'DIAS_CAUSADOS',
                descripcion: `${infoCorte.diasCausadosAntes} días de interés anticipado`,
                monto: infoCorte.valorDiasCausados,
                obligatorio: true,
                explicacion: infoCorte.mensaje,
              }]
            : []),
        ],
        flexibilidadTarifas: flexElegible
          ? [
              { modalidad: 'BASICA', costo: FLEXIBILIDAD_COSTO_BASICA, usosDisponibles: 1, descripcion: '1 uso durante la vigencia del crédito' },
              { modalidad: 'PREMIUM', costo: FLEXIBILIDAD_COSTO_PREMIUM, usosDisponibles: 2, descripcion: '2 usos durante la vigencia del crédito' },
            ]
          : [],
      },
      cronograma,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
