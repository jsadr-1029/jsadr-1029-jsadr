import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// =====================================================
// /api/regularizacion
// -----------------------------------------------------
// Gestión de acuerdos de regularización creados desde el
// portal del cliente. Permite al admin/gestor:
//
// GET: listar acuerdos pendientes de revisión
// POST (accion=aprobar): aceptar acuerdo + generar Otro Sí
// POST (accion=contraoferta): enviar contraoferta al cliente
// POST (accion=negociar_mora): negociar intereses moratorios
// POST (accion=rechazar): rechazar acuerdo con motivo
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado') || 'REGISTRADO'
    const prestamoId = searchParams.get('prestamoId')

    const where: any = {}
    if (estado !== 'TODOS') where.estado = estado
    if (prestamoId) where.prestamoId = prestamoId

    const compromisos = await db.compromisoPago.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            email: true,
          },
        },
        prestamo: {
          select: {
            id: true,
            codigo: true,
            montoPrincipal: true,
            estado: true,
            diasMora: true,
            montoMora: true,
            saldoTotal: true,
            tasaMoraDiaria: true,
            moraRenegociada: true,
            moraRenegociadaAccion: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parsear el JSON de actualizaciones para obtener los datos del acuerdo
    const compromisosConAcuerdo = compromisos.map((c) => {
      let acuerdoOriginal: any = null
      try {
        const actualizaciones = JSON.parse(c.actualizaciones || '[]')
        acuerdoOriginal = actualizaciones.find((a: any) => a.tipo === 'CREACION_ACUERDO_PORTAL') || null
      } catch {}

      return {
        id: c.id,
        clienteId: c.clienteId,
        prestamoId: c.prestamoId,
        cliente: c.cliente,
        prestamo: c.prestamo,
        razon: c.razon,
        razonOtroTexto: c.razonOtroTexto,
        observacionCliente: c.observacionCliente,
        fechaComprometida: c.fechaComprometida,
        valorComprometido: c.valorComprometido,
        estado: c.estado,
        createdAt: c.createdAt,
        // Datos del acuerdo original (parseados)
        tipoAcuerdo: acuerdoOriginal?.tipoAcuerdo || 'DESCONOCIDO',
        montoPropuesto: acuerdoOriginal?.montoPropuesto || 0,
        montoTotalAcordado: acuerdoOriginal?.montoTotalAcordado || 0,
        saldoRestante: acuerdoOriginal?.saldoRestante || 0,
        cuotasVencidasIncluidas: acuerdoOriginal?.cuotasVencidasIncluidas || [],
        fechasPagosPosteriores: acuerdoOriginal?.fechasPagosPosteriores || [],
        // Mora actual del préstamo
        moraActualPrestamo: c.prestamo.montoMora || 0,
        diasMoraPrestamo: c.prestamo.diasMora || 0,
        moraRenegociada: c.prestamo.moraRenegociada,
        moraRenegociadaAccion: c.prestamo.moraRenegociadaAccion,
      }
    })

    return NextResponse.json({
      success: true,
      data: compromisosConAcuerdo,
      total: compromisosConAcuerdo.length,
    })
  } catch (error: any) {
    console.error('[regularizacion GET] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST: acciones sobre el acuerdo
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { accion } = body

    // ==========================================
    // ACCIÓN 1: APROBAR acuerdo
    // ==========================================
    if (accion === 'aprobar') {
      const {
        compromisoId,
        observaciones,
        montoAjustado,
        fechaAjustada,
        moraNegociadaValor,
        moraNegociadaAccion, // 'ANULAR' | 'NEGOCIAR' | 'MANTENER'
      } = body

      const compromiso = await db.compromisoPago.findUnique({
        where: { id: compromisoId },
        include: {
          cliente: true,
          prestamo: true,
        },
      })

      if (!compromiso) {
        return NextResponse.json(
          { success: false, error: 'Acuerdo no encontrado' },
          { status: 404 }
        )
      }

      // Parsear acuerdo original
      let acuerdoOriginal: any = null
      try {
        const actualizaciones = JSON.parse(compromiso.actualizaciones || '[]')
        acuerdoOriginal = actualizaciones.find((a: any) => a.tipo === 'CREACION_ACUERDO_PORTAL')
      } catch {}

      const montoFinal = montoAjustado || compromiso.valorComprometido
      const fechaFinal = fechaAjustada ? new Date(fechaAjustada) : compromiso.fechaComprometida

      // === Aplicar negociación de mora si se solicitó ===
      if (moraNegociadaAccion && moraNegociadaAccion !== 'MANTENER') {
        const moraValor = moraNegociadaAccion === 'ANULAR' ? 0 : parseFloat(moraNegociadaValor || '0')
        await db.prestamo.update({
          where: { id: compromiso.prestamoId },
          data: {
            moraRenegociada: moraValor,
            moraRenegociadaAccion: moraNegociadaAccion,
            moraRenegociadaFecha: new Date(),
            moraRenegociadaPorNombre: 'Asesor (vía regularización)',
            moraRenegociadaObservacion: `Mora ${moraNegociadaAccion.toLowerCase()} en aprobación de acuerdo de regularización ${compromiso.id.slice(-8).toUpperCase()}`,
            moraRenegociadaMoraOriginal: compromiso.prestamo.montoMora,
          },
        })
      }

      // === Generar OTRO SÍ como acuerdo de partes ===
      const ultimoOtroSi = await db.otroSiCambioFecha.findFirst({
        where: { prestamoId: compromiso.prestamoId },
        orderBy: { createdAt: 'desc' },
      })
      let consecutivo = 1
      if (ultimoOtroSi?.codigo) {
        const match = ultimoOtroSi.codigo.match(/OS-(\d+)/)
        if (match) consecutivo = parseInt(match[1], 10) + 1
      }
      const codigoOtroSi = `OS-${String(consecutivo).padStart(3, '0')}`

      const descripcion = `ACUERDO DE REGULARIZACIÓN DE CUOTAS VENCIDAS

Cliente: ${compromiso.cliente.nombre} (CC ${compromiso.cliente.cedula})
Crédito: ${compromiso.prestamo.codigo}
Tipo de acuerdo: ${acuerdoOriginal?.tipoAcuerdo || 'ACUERDO_REGULARIZACION'}

Términos:
- Fecha del primer pago: ${fechaFinal.toLocaleDateString('es-CO')}
- Monto del primer pago: $${montoFinal.toLocaleString('es-CO')}
- Total acordado: $${(acuerdoOriginal?.montoTotalAcordado || 0).toLocaleString('es-CO')}
- Saldo restante: $${(acuerdoOriginal?.saldoRestante || 0).toLocaleString('es-CO')}
- Cuotas vencidas incluidas: ${(acuerdoOriginal?.cuotasVencidasIncluidas || []).join(', ')}
${(acuerdoOriginal?.fechasPagosPosteriores || []).length > 0 ? `- Fechas de pagos posteriores: ${(acuerdoOriginal?.fechasPagosPosteriores || []).join(', ')}` : ''}

${moraNegociadaAccion === 'ANULAR' ? 'Mora moratoria: ANULADA como parte del acuerdo' : ''}
${moraNegociadaAccion === 'NEGOCIAR' ? `Mora moratoria: NEGOCIADA en $${parseFloat(moraNegociadaValor || '0').toLocaleString('es-CO')}` : ''}

Observaciones del asesor: ${observaciones || 'Ninguna'}

Este Otro Sí constituye un acuerdo de partes entre la entidad financiera y el cliente, y modifica las condiciones de pago del crédito original exclusivamente en lo referente a la regularización de las cuotas vencidas indicadas. Las demás condiciones del crédito original se mantienen sin cambios.`

      const fechasJson = JSON.stringify(
        (acuerdoOriginal?.fechasPagosPosteriores || []).map((f: string, i: number) => ({
          cuota: acuerdoOriginal?.cuotasVencidasIncluidas?.[i] || (i + 1),
          fechaAnterior: '',
          fechaNueva: f,
        }))
      )

      const otroSi = await db.otroSiCambioFecha.create({
        data: {
          prestamoId: compromiso.prestamoId,
          codigo: codigoOtroSi,
          tipoModificacion: 'ACUERDO_REGULARIZACION',
          fechasAnteriores: fechasJson,
          fechasNuevas: fechasJson,
          descripcion,
          estado: 'PENDIENTE_FIRMA',
          solicitadoPor: 'Asesor (vía regularización)',
          fechaSolicitud: new Date(),
        },
      })

      // === Actualizar compromiso a APROBADO ===
      const actualizaciones = JSON.parse(compromiso.actualizaciones || '[]')
      actualizaciones.push({
        fecha: new Date().toISOString(),
        tipo: 'APROBACION_ASESOR',
        observaciones,
        montoAjustado: montoFinal,
        fechaAjustada: fechaFinal.toISOString(),
        moraNegociadaAccion,
        moraNegociadaValor,
        otroSiId: otroSi.id,
        otroSiCodigo: codigoOtroSi,
      })

      await db.compromisoPago.update({
        where: { id: compromisoId },
        data: {
          estado: 'APROBADO',
          actualizaciones: JSON.stringify(actualizaciones),
          ultimaActualizacion: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          compromisoId,
          estado: 'APROBADO',
          otroSiId: otroSi.id,
          otroSiCodigo: codigoOtroSi,
          mensaje: `Acuerdo aprobado. Se generó el Otro Sí ${codigoOtroSi} como acuerdo de partes. Pendiente de firma del cliente.`,
        },
      })
    }

    // ==========================================
    // ACCIÓN 2: CONTRAOFERTA
    // ==========================================
    if (accion === 'contraoferta') {
      const {
        compromisoId,
        montoContraoferta,
        fechaContraoferta,
        observaciones,
      } = body

      const compromiso = await db.compromisoPago.findUnique({
        where: { id: compromisoId },
        include: { cliente: true },
      })

      if (!compromiso) {
        return NextResponse.json(
          { success: false, error: 'Acuerdo no encontrado' },
          { status: 404 }
        )
      }

      const actualizaciones = JSON.parse(compromiso.actualizaciones || '[]')
      actualizaciones.push({
        fecha: new Date().toISOString(),
        tipo: 'CONTRAOFERTA_ASESOR',
        montoContraoferta: parseFloat(montoContraoferta),
        fechaContraoferta,
        observaciones,
      })

      await db.compromisoPago.update({
        where: { id: compromisoId },
        data: {
          estado: 'CONTRAOFERTA',
          valorComprometido: parseFloat(montoContraoferta),
          fechaComprometida: new Date(fechaContraoferta),
          actualizaciones: JSON.stringify(actualizaciones),
          ultimaActualizacion: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          compromisoId,
          estado: 'CONTRAOFERTA',
          mensaje: `Contraoferta enviada al cliente por $${parseFloat(montoContraoferta).toLocaleString('es-CO')} para el ${new Date(fechaContraoferta).toLocaleDateString('es-CO')}.`,
        },
      })
    }

    // ==========================================
    // ACCIÓN 3: NEGOCIAR MORA
    // ==========================================
    if (accion === 'negociar_mora') {
      const {
        compromisoId,
        moraAccion, // 'ANULAR' | 'NEGOCIAR'
        moraValor, // si es NEGOCIAR, el valor acordado
        observaciones,
      } = body

      const compromiso = await db.compromisoPago.findUnique({
        where: { id: compromisoId },
        include: { prestamo: true },
      })

      if (!compromiso) {
        return NextResponse.json(
          { success: false, error: 'Acuerdo no encontrado' },
          { status: 404 }
        )
      }

      const moraFinal = moraAccion === 'ANULAR' ? 0 : parseFloat(moraValor || '0')
      const moraOriginal = compromiso.prestamo.montoMora

      await db.prestamo.update({
        where: { id: compromiso.prestamoId },
        data: {
          moraRenegociada: moraFinal,
          moraRenegociadaAccion: moraAccion,
          moraRenegociadaFecha: new Date(),
          moraRenegociadaPorNombre: 'Asesor (vía regularización)',
          moraRenegociadaObservacion: observaciones || `Mora ${moraAccion.toLowerCase()} por asesor`,
          moraRenegociadaMoraOriginal: moraOriginal,
        },
      })

      const actualizaciones = JSON.parse(compromiso.actualizaciones || '[]')
      actualizaciones.push({
        fecha: new Date().toISOString(),
        tipo: 'NEGOCIACION_MORA',
        moraAccion,
        moraValor: moraFinal,
        moraOriginal,
        observaciones,
      })

      await db.compromisoPago.update({
        where: { id: compromisoId },
        data: {
          actualizaciones: JSON.stringify(actualizaciones),
          ultimaActualizacion: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          compromisoId,
          moraAccion,
          moraFinal,
          mensaje: moraAccion === 'ANULAR'
            ? `Mora de $${moraOriginal.toLocaleString('es-CO')} ANULADA. El cliente ya no debe este monto.`
            : `Mora negociada a $${moraFinal.toLocaleString('es-CO')} (original: $${moraOriginal.toLocaleString('es-CO')}).`,
        },
      })
    }

    // ==========================================
    // ACCIÓN 4: RECHAZAR
    // ==========================================
    if (accion === 'rechazar') {
      const { compromisoId, motivo } = body

      const compromiso = await db.compromisoPago.findUnique({
        where: { id: compromisoId },
      })

      if (!compromiso) {
        return NextResponse.json(
          { success: false, error: 'Acuerdo no encontrado' },
          { status: 404 }
        )
      }

      const actualizaciones = JSON.parse(compromiso.actualizaciones || '[]')
      actualizaciones.push({
        fecha: new Date().toISOString(),
        tipo: 'RECHAZO_ASESOR',
        motivo,
      })

      await db.compromisoPago.update({
        where: { id: compromisoId },
        data: {
          estado: 'RECHAZADO',
          actualizaciones: JSON.stringify(actualizaciones),
          ultimaActualizacion: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          compromisoId,
          estado: 'RECHAZADO',
          mensaje: 'Acuerdo rechazado. El cliente será notificado.',
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[regularizacion POST] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
