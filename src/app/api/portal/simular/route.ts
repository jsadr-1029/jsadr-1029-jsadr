import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcularPrestamo, generarCronograma } from '@/lib/finance'

// Simula un préstamo basado en una categoría
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { monto, categoriaId, plazoMeses, frecuencia, token, flexibilidadFinanciera, flexibilidadModalidad } = body

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
    }

    // === Flexibilidad Financiera ===
    // DOS tarifas:
    //   - BASICA:  $15.000 COP — 1 uso durante la vigencia
    //   - PREMIUM: $34.900 COP — 2 usos durante la vigencia
    // El cobro se hace UNA sola vez al inicio del crédito (cargado en la primera cuota).
    const FLEXIBILIDAD_COSTO_BASICA = 15000
    const FLEXIBILIDAD_COSTO_PREMIUM = 34900

    // === Tarifa de Plataforma (OBLIGATORIA para toda simulación) ===
    // $4.900 COP — cobro único al inicio del crédito (cargado en la primera cuota).
    // Cubre uso de firma electrónica, generación de pagaré digital,
    // almacenamiento seguro del expediente y trazabilidad del AuditLog.
    const TARIFA_PLATAFORMA = 4900

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

    let categoria: Awaited<ReturnType<typeof db.categoriaCliente.findUnique>> = null
    if (categoriaId) {
      categoria = await db.categoriaCliente.findUnique({ where: { id: categoriaId } })
    }
    if (!categoria) {
      // Si no hay categoría, usar valores por defecto
      const calcDefault = calcularPrestamo({
        monto: Number(monto),
        tasaMensual: 20,
        plazoMeses: Number(plazoMeses) || 1,
        frecuencia: frecuencia || 'MENSUAL',
      })
      const totalConCargosDefault = calcDefault.totalPagar + TARIFA_PLATAFORMA + flexCostoCalculado
      return NextResponse.json({
        simulacion: {
          monto: Number(monto),
          tasaMensual: 20,
          tasaAnual: 240,
          plazoMeses: Number(plazoMeses) || 1,
          frecuencia: frecuencia || 'MENSUAL',
          ...calcDefault,
          // === Tarifa Plataforma (obligatoria) ===
          tarifaPlataforma: TARIFA_PLATAFORMA,
          tarifaPlataformaObligatoria: true,
          // === Flexibilidad Financiera (solo si cuotas >= 4) ===
          flexibilidadFinanciera: flexActivada,
          flexibilidadElegible: flexElegible,
          flexibilidadModalidad: flexActivada ? modalidadElegida : null,
          flexibilidadCosto: flexCostoCalculado,
          flexibilidadCuotasRequeridas: 4,
          flexibilidadUsosDisponibles: flexUsosDisponibles,
          // === Totales con cargos ===
          totalCargosIniciales: TARIFA_PLATAFORMA + flexCostoCalculado,
          totalPagarConCargos: totalConCargosDefault,
          primeraCuotaConCargos: calcDefault.montoCuota + TARIFA_PLATAFORMA + flexCostoCalculado,
          cargosIniciales: [
            {
              concepto: 'TARIFA_PLATAFORMA',
              descripcion: 'Tarifa de Uso de Plataforma',
              monto: TARIFA_PLATAFORMA,
              obligatorio: true,
            },
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
        {
          error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) supera el máximo permitido para la categoría "${categoria.nombre}": ${montoMax.toLocaleString('es-CO')}.`,
          codigo: 'MONTO_EXCEDE_CATEGORIA',
          montoSolicitado: montoNum,
          montoMaximo: montoMax,
          categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        },
        { status: 400 }
      )
    }
    if (montoMin > 0 && montoNum < montoMin) {
      return NextResponse.json(
        {
          error: `El monto solicitado (${montoNum.toLocaleString('es-CO')}) es inferior al mínimo permitido para la categoría "${categoria.nombre}": ${montoMin.toLocaleString('es-CO')}.`,
          codigo: 'MONTO_INFERIOR_CATEGORIA',
          montoSolicitado: montoNum,
          montoMinimo: montoMin,
          categoria: { id: categoria.id, nombre: categoria.nombre, codigo: categoria.codigo },
        },
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

    const totalConCargos = calc.totalPagar + TARIFA_PLATAFORMA + flexCostoCalculado
    const primeraCuotaConCargos = calc.montoCuota + TARIFA_PLATAFORMA + flexCostoCalculado

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
        // === Tarifa Plataforma (OBLIGATORIA para toda simulación) ===
        // $4.900 COP — cobro único al inicio del crédito (cargado en la primera cuota).
        tarifaPlataforma: TARIFA_PLATAFORMA,
        tarifaPlataformaObligatoria: true,
        // === Flexibilidad Financiera (solo si cuotas >= 4) ===
        // DOS tarifas: BASICA $15.000 (1 uso) | PREMIUM $34.900 (2 usos)
        flexibilidadFinanciera: flexActivada,
        flexibilidadElegible: flexElegible,
        flexibilidadModalidad: flexActivada ? modalidadElegida : null,
        flexibilidadCosto: flexCostoCalculado,
        flexibilidadCuotasRequeridas: 4,
        flexibilidadUsosDisponibles: flexUsosDisponibles,
        // === Totales con cargos iniciales incluidos ===
        totalCargosIniciales: TARIFA_PLATAFORMA + flexCostoCalculado,
        totalPagarConCargos: totalConCargos,
        primeraCuotaConCargos: primeraCuotaConCargos,
        cargosIniciales: [
          {
            concepto: 'TARIFA_PLATAFORMA',
            descripcion: 'Tarifa de Uso de Plataforma',
            monto: TARIFA_PLATAFORMA,
            obligatorio: true,
          },
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
        ],
        flexibilidadTarifas: flexElegible
          ? [
              {
                modalidad: 'BASICA',
                costo: FLEXIBILIDAD_COSTO_BASICA,
                usosDisponibles: 1,
                descripcion: '1 uso durante la vigencia del crédito',
              },
              {
                modalidad: 'PREMIUM',
                costo: FLEXIBILIDAD_COSTO_PREMIUM,
                usosDisponibles: 2,
                descripcion: '2 usos durante la vigencia del crédito (para las dos cuotas del mes)',
              },
            ]
          : [],
      },
      cronograma,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
