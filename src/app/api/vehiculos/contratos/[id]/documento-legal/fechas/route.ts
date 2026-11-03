// =====================================================
// /api/vehiculos/contratos/[id]/documento-legal/fechas
// -----------------------------------------------------
// PATCH — corrige las fechas (fechaInicio, fechaFin) del documento legal
// y del contrato relacionado. Útil cuando se detectó que las fechas
// almacenadas son incorrectas (ej: se ingresaron mal al crear el contrato
// y el snapshot del documento legal quedó con datos errados).
//
// Body:
//   {
//     "fechaInicio": "2026-10-31",   // YYYY-MM-DD
//     "fechaFin":    "2027-01-30",   // YYYY-MM-DD o null
//     "regenerarObligaciones": true  // opcional, default false
//   }
//
// Permisos: ADMIN, GESTOR
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  // Aceptar tanto "YYYY-MM-DD" como ISO completo
  // Forzamos a medianoche UTC para evitar desplazamientos por zona horaria
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s + 'T00:00:00.000Z')
  }
  return new Date(s)
}

function fmtFecha(d: Date | string | null | undefined): string {
  if (!d) return 'N/A'
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

function generarFechasVencimientoDiario(fechaInicio: Date, cantidadCuotas: number): Date[] {
  const fechas: Date[] = []
  const cursor = new Date(fechaInicio)
  let generadas = 0
  while (generadas < cantidadCuotas) {
    const dia = cursor.getDay()
    if (dia !== 0) { // no domingos
      fechas.push(new Date(cursor))
      generadas++
    }
    cursor.setDate(cursor.getDate() + 1)
    if (fechas.length > 365) break
  }
  return fechas
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const { fechaInicio, fechaFin, regenerarObligaciones } = body as {
      fechaInicio?: string
      fechaFin?: string | null
      regenerarObligaciones?: boolean
    }

    if (!fechaInicio && fechaFin === undefined) {
      return NextResponse.json(
        { success: false, error: 'Debe enviar al menos fechaInicio o fechaFin' },
        { status: 400 }
      )
    }

    // Validar formato de fechas
    const nuevaFechaInicio = fechaInicio ? parseDate(fechaInicio) : null
    const nuevaFechaFin = fechaFin === null ? null : (fechaFin ? parseDate(fechaFin) : null)

    if (fechaInicio && !nuevaFechaInicio) {
      return NextResponse.json(
        { success: false, error: 'fechaInicio inválida. Use formato YYYY-MM-DD' },
        { status: 400 }
      )
    }
    if (fechaFin && !nuevaFechaFin) {
      return NextResponse.json(
        { success: false, error: 'fechaFin inválida. Use formato YYYY-MM-DD' },
        { status: 400 }
      )
    }
    if (nuevaFechaInicio && nuevaFechaFin && nuevaFechaFin < nuevaFechaInicio) {
      return NextResponse.json(
        { success: false, error: 'fechaFin no puede ser anterior a fechaInicio' },
        { status: 400 }
      )
    }

    // Buscar el ContratoVehiculo
    const contrato = await db.contratoVehiculo.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json(
        { success: false, error: 'Contrato no encontrado' },
        { status: 404 }
      )
    }

    // Buscar el documento legal ACTIVO del contrato (uno solo)
    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: {
        contratoVehiculoId: id,
        estado: { in: ['BORRADOR', 'ENVIADO_CONDUCTOR', 'FIRMADO_CONDUCTOR', 'ENVIADO_PROPIETARIO', 'COMPLETADO'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!documento) {
      return NextResponse.json(
        { success: false, error: 'No hay documento legal para este contrato. Genérelo primero.' },
        { status: 404 }
      )
    }

    // Snapshot ANTERIOR para auditoría
    const snapshotAnterior = {
      documento: {
        id: documento.id,
        numeroContrato: documento.numeroContrato,
        fechaInicio: documento.fechaInicio,
        fechaFin: documento.fechaFin,
      },
      contrato: {
        id: contrato.id,
        numeroContrato: contrato.numeroContrato,
        fechaInicio: contrato.fechaInicio,
        fechaFin: contrato.fechaFin,
      },
    }

    const fechaInicioFinal = nuevaFechaInicio || contrato.fechaInicio
    const fechaFinFinal = nuevaFechaFin !== null ? nuevaFechaFin : contrato.fechaFin

    // 1) Actualizar ContratoDocumentoVehiculo
    await db.contratoDocumentoVehiculo.update({
      where: { id: documento.id },
      data: {
        fechaInicio: fechaInicioFinal,
        fechaFin: fechaFinFinal,
      },
    })

    // 2) Actualizar ContratoVehiculo
    await db.contratoVehiculo.update({
      where: { id },
      data: {
        fechaInicio: fechaInicioFinal,
        fechaFin: fechaFinFinal,
      },
    })

    // 3) Regenerar obligaciones PENDIENTES si se solicitó
    let obligacionesInfo = { regeneradas: 0, conservadas: 0 }
    if (regenerarObligaciones) {
      const obligaciones = await db.obligacionVehiculo.findMany({
        where: { contratoId: id },
        orderBy: { numeroCuota: 'asc' },
      })
      const pendientes = obligaciones.filter(o => o.estado === 'PENDIENTE')
      const otras = obligaciones.filter(o => o.estado !== 'PENDIENTE')
      obligacionesInfo.conservadas = otras.length

      if (pendientes.length > 0) {
        // Eliminar pendientes existentes
        await db.obligacionVehiculo.deleteMany({
          where: { contratoId: id, estado: 'PENDIENTE' },
        })

        const modalidad = contrato.modalidadPago
        let nuevasFechas: Date[] = []
        if (modalidad === 'DIARIO') {
          nuevasFechas = generarFechasVencimientoDiario(fechaInicioFinal, pendientes.length)
        } else if (modalidad === 'SEMANAL') {
          for (let i = 1; i <= pendientes.length; i++) {
            const v = new Date(fechaInicioFinal)
            v.setDate(v.getDate() + (i * 7))
            nuevasFechas.push(v)
          }
        } else if (modalidad === 'QUINCENAL') {
          for (let i = 1; i <= pendientes.length; i++) {
            const v = new Date(fechaInicioFinal)
            v.setDate(v.getDate() + (i * 15))
            nuevasFechas.push(v)
          }
        } else if (modalidad === 'MENSUAL') {
          for (let i = 1; i <= pendientes.length; i++) {
            const v = new Date(fechaInicioFinal)
            v.setMonth(v.getMonth() + i)
            nuevasFechas.push(v)
          }
        } else {
          // PERSONALIZADO: desplazar por delta de días
          const deltaMs = fechaInicioFinal.getTime() - snapshotAnterior.contrato.fechaInicio.getTime()
          const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24))
          nuevasFechas = pendientes.map(o => {
            const oldDate = new Date(o.fechaVencimiento)
            oldDate.setDate(oldDate.getDate() + deltaDays)
            return oldDate
          })
        }

        const maxCuota = otras.reduce((m, o) => Math.max(m, o.numeroCuota || 0), 0)
        for (let i = 0; i < nuevasFechas.length; i++) {
          await db.obligacionVehiculo.create({
            data: {
              contratoId: id,
              vehiculoId: contrato.vehiculoId,
              conductorId: contrato.conductorId,
              numeroCuota: maxCuota + i + 1,
              fechaVencimiento: nuevasFechas[i],
              monto: contrato.tarifa,
              montoPendiente: contrato.tarifa,
              estado: 'PENDIENTE',
            },
          })
        }
        obligacionesInfo.regeneradas = nuevasFechas.length
      }
    }

    // 4) Auditoría
    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO_DOCUMENTO',
        entidadId: documento.id,
        accion: 'MODIFICAR',
        descripcion: `Corrección de fechas del contrato ${documento.numeroContrato}. ` +
          `Inicio: ${fmtFecha(snapshotAnterior.documento.fechaInicio)} → ${fmtFecha(fechaInicioFinal)}. ` +
          `Fin: ${fmtFecha(snapshotAnterior.documento.fechaFin)} → ${fmtFecha(fechaFinFinal)}. ` +
          (regenerarObligaciones
            ? `Obligaciones: ${obligacionesInfo.regeneradas} regeneradas, ${obligacionesInfo.conservadas} conservadas.`
            : 'Obligaciones no regeneradas.'),
        datosAnteriores: JSON.stringify(snapshotAnterior),
        datosNuevos: JSON.stringify({
          documento: { id: documento.id, fechaInicio: fechaInicioFinal, fechaFin: fechaFinFinal },
          contrato: { id, fechaInicio: fechaInicioFinal, fechaFin: fechaFinFinal },
        }),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        numeroContrato: documento.numeroContrato,
        contratoVehiculoId: id,
        documentoId: documento.id,
        fechaInicio: fechaInicioFinal,
        fechaFin: fechaFinFinal,
        obligaciones: obligacionesInfo,
      },
      message: `Fechas actualizadas. Inicio: ${fmtFecha(fechaInicioFinal)}, Fin: ${fmtFecha(fechaFinFinal)}.` +
        (regenerarObligaciones
          ? ` ${obligacionesInfo.regeneradas} obligaciones regeneradas, ${obligacionesInfo.conservadas} conservadas.`
          : ''),
    })
  } catch (error: any) {
    console.error('[documento-legal/fechas PATCH] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET — obtener fechas actuales del documento legal y del contrato
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const contrato = await db.contratoVehiculo.findUnique({ where: { id } })
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    const documento = await db.contratoDocumentoVehiculo.findFirst({
      where: { contratoVehiculoId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        contrato: {
          id: contrato.id,
          numeroContrato: contrato.numeroContrato,
          fechaInicio: contrato.fechaInicio,
          fechaFin: contrato.fechaFin,
        },
        documento: documento ? {
          id: documento.id,
          numeroContrato: documento.numeroContrato,
          fechaInicio: documento.fechaInicio,
          fechaFin: documento.fechaFin,
          estado: documento.estado,
        } : null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
