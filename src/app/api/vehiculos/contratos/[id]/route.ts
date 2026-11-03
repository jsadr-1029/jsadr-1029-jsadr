// =====================================================
// /api/vehiculos/contratos/[id] — GET, PUT, DELETE
// + Endpoints anidados para gestión de obligaciones y pagos del contrato
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { getVehiculosPermitidos } from '@/lib/permisos'

// GET — detalle completo del contrato (con obligaciones y pagos)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const contrato = await db.contratoVehiculo.findUnique({
      where: { id },
      include: {
        vehiculo: true,
        conductor: true,
        obligaciones: {
          orderBy: { numeroCuota: 'asc' },
          include: {
            pagos: { orderBy: { createdAt: 'desc' } },
          },
        },
        pagos: {
          orderBy: { createdAt: 'desc' },
          include: { comprobantes: true },
        },
        mantenimientos: {
          orderBy: { fecha: 'desc' },
          include: { repuestos: { include: { repuesto: true } } },
        },
      },
    })

    if (!contrato) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Calcular totales
    const totales = {
      obligacionesTotal: contrato.obligaciones.length,
      obligacionesPagadas: contrato.obligaciones.filter(o => o.estado === 'PAGADA').length,
      obligacionesPendientes: contrato.obligaciones.filter(o => o.estado === 'PENDIENTE' || o.estado === 'PARCIAL').length,
      obligacionesVencidas: contrato.obligaciones.filter(o => o.estado === 'VENCIDA').length,
      montoFacturado: contrato.obligaciones.reduce((s, o) => s + (o.monto || 0), 0),
      montoPagado: contrato.obligaciones.reduce((s, o) => s + (o.montoPagado || 0), 0),
      montoPendiente: contrato.obligaciones.reduce((s, o) => s + (o.montoPendiente || 0), 0),
      multas: contrato.obligaciones.reduce((s, o) => s + (o.multa || 0), 0),
    }

    return NextResponse.json({ success: true, data: { ...contrato, totales } })
  } catch (error: any) {
    console.error('[vehiculos/contratos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT — actualizar contrato (no regenera obligaciones existentes)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()

    const anterior = await db.contratoVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['estado', 'modalidadPago', 'contratoPdfUrl', 'motivoCancelacion']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.tarifa !== undefined) data.tarifa = parseFloat(body.tarifa)
    if (body.diasGracia !== undefined) data.diasGracia = parseInt(body.diasGracia)
    if (body.multaDiaria !== undefined) data.multaDiaria = parseFloat(body.multaDiaria)
    if (body.deposito !== undefined) data.deposito = parseFloat(body.deposito)
    if (body.fechaFin !== undefined) data.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null
    if (body.fechaInicio !== undefined) data.fechaInicio = new Date(body.fechaInicio)
    if (body.fechaCancelacion !== undefined) data.fechaCancelacion = new Date(body.fechaCancelacion)
    // === Renovación anticipada (campos opcionales editables desde UI) ===
    if (body.renovacionAnticipada !== undefined) data.renovacionAnticipada = Boolean(body.renovacionAnticipada)
    if (body.valorRenovacionAnticipada !== undefined) {
      const v = parseFloat(body.valorRenovacionAnticipada)
      data.valorRenovacionAnticipada = isNaN(v) ? null : v
    }

    // === Cambio de vehículo/conductor (con validación de permisos) ===
    let cambioVehiculo = false
    let cambioConductor = false
    if (body.vehiculoId !== undefined && body.vehiculoId !== anterior.vehiculoId) {
      // Validar que el vehículo exista y no esté asignado a otro contrato activo
      const nuevoVeh = await db.vehiculo.findUnique({ where: { id: body.vehiculoId } })
      if (!nuevoVeh) {
        return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
      }
      if (nuevoVeh.estado === 'ASIGNADO') {
        return NextResponse.json({
          success: false,
          error: `El vehículo ${nuevoVeh.placa} ya está asignado a otro contrato. Cancela el contrato anterior primero.`,
        }, { status: 400 })
      }
      // Verificar permisos sobre el nuevo vehículo
      const vehPermitidosEdit = getVehiculosPermitidos(user.username || user.id)
      if (vehPermitidosEdit !== null && !vehPermitidosEdit.includes(nuevoVeh.placa.toUpperCase())) {
        return NextResponse.json({ success: false, error: 'No tienes permiso para asignar este vehículo' }, { status: 403 })
      }
      data.vehiculoId = body.vehiculoId
      cambioVehiculo = true
    }
    if (body.conductorId !== undefined && body.conductorId !== anterior.conductorId) {
      const nuevoCon = await db.conductorVehiculo.findUnique({ where: { id: body.conductorId } })
      if (!nuevoCon) {
        return NextResponse.json({ success: false, error: 'Conductor no encontrado' }, { status: 404 })
      }
      data.conductorId = body.conductorId
      cambioConductor = true
    }

    data.modificadoPor = user.id

    // Motivo de edición (notas internas del admin) — solo se registra en auditoría,
    // NO se persiste como campo del contrato para no requerir migración de schema.
    const motivoEdicion = (typeof body.motivoEdicion === 'string' && body.motivoEdicion.trim())
      ? body.motivoEdicion.trim()
      : null

    const actualizado = await db.contratoVehiculo.update({ where: { id }, data })

    // === Si cambia el vehículo, ajustar estados: liberar anterior, asignar nuevo ===
    if (cambioVehiculo) {
      // Liberar vehículo anterior (si el contrato sigue ACTIVO)
      if (anterior.estado === 'ACTIVO' && data.estado !== 'CANCELADO' && data.estado !== 'FINALIZADO') {
        await db.vehiculo.update({
          where: { id: anterior.vehiculoId },
          data: { estado: 'DISPONIBLE' },
        })
        // Marcar nuevo vehículo como ASIGNADO
        await db.vehiculo.update({
          where: { id: body.vehiculoId },
          data: { estado: 'ASIGNADO' },
        })
      }
    }

    // Si el contrato cambia a CANCELADO o FINALIZADO, liberar vehículo (nuevo o actual)
    if (body.estado && ['CANCELADO', 'FINALIZADO'].includes(body.estado)) {
      const vehiculoALiberar = cambioVehiculo ? body.vehiculoId : anterior.vehiculoId
      await db.vehiculo.update({
        where: { id: vehiculoALiberar },
        data: { estado: 'DISPONIBLE' },
      })
    }

    // === Construir descripción de auditoría detallada con motivo ===
    const cambiosRealizados: string[] = []
    if (cambioVehiculo) cambiosRealizados.push(`vehículo: ${anterior.vehiculoId} → ${body.vehiculoId}`)
    if (cambioConductor) cambiosRealizados.push(`conductor: ${anterior.conductorId} → ${body.conductorId}`)
    if (body.estado !== undefined && body.estado !== anterior.estado) cambiosRealizados.push(`estado: ${anterior.estado} → ${body.estado}`)
    if (body.modalidadPago !== undefined && body.modalidadPago !== anterior.modalidadPago) cambiosRealizados.push(`modalidad: ${anterior.modalidadPago} → ${body.modalidadPago}`)
    if (body.tarifa !== undefined) cambiosRealizados.push(`tarifa: ${anterior.tarifa} → ${body.tarifa}`)
    if (body.fechaInicio !== undefined) cambiosRealizados.push(`fechaInicio: ${anterior.fechaInicio.toISOString()} → ${data.fechaInicio.toISOString()}`)
    if (body.fechaFin !== undefined) cambiosRealizados.push(`fechaFin: ${anterior.fechaFin?.toISOString() || 'null'} → ${data.fechaFin?.toISOString() || 'null'}`)
    if (body.diasGracia !== undefined) cambiosRealizados.push(`diasGracia: ${anterior.diasGracia} → ${body.diasGracia}`)
    if (body.multaDiaria !== undefined) cambiosRealizados.push(`multaDiaria: ${anterior.multaDiaria} → ${body.multaDiaria}`)
    if (body.deposito !== undefined) cambiosRealizados.push(`deposito: ${anterior.deposito} → ${body.deposito}`)
    if (body.renovacionAnticipada !== undefined) cambiosRealizados.push(`renovacionAnticipada: ${anterior.renovacionAnticipada} → ${body.renovacionAnticipada}`)
    if (cambosRenovValor(body, anterior)) cambiosRealizados.push(`valorRenovacionAnticipada: ${anterior.valorRenovacionAnticipada} → ${body.valorRenovacionAnticipada}`)

    const descAuditoria = `Contrato ${anterior.numeroContrato} actualizado.` +
      (cambiosRealizados.length > 0 ? ` Cambios: ${cambiosRealizados.join('; ')}.` : '') +
      (motivoEdicion ? ` Motivo de edición: "${motivoEdicion}".` : '') +
      (cambioVehiculo ? ' Vehículo anterior liberado y nuevo vehículo asignado.' : '')

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: descAuditoria,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: `Contrato actualizado. ${cambiosRealizados.length} campo(s) modificado(s).` +
        (motivoEdicion ? ' Motivo registrado en auditoría.' : ''),
    })
  } catch (error: any) {
    console.error('[vehiculos/contratos PUT] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Helper para detectar cambio de valorRenovacionAnticipada
function cambosRenovValor(body: any, anterior: any): boolean {
  if (body.valorRenovacionAnticipada === undefined) return false
  const newVal = parseFloat(body.valorRenovacionAnticipada)
  if (isNaN(newVal)) return anterior.valorRenovacionAnticipada !== null
  return newVal !== anterior.valorRenovacionAnticipada
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const anterior = await db.contratoVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Solo permitir cancelar contratos en BORRADOR; los ACTIVOS deben cancelarse vía PUT
    if (anterior.estado === 'ACTIVO') {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar un contrato ACTIVO. Use cancelar (PUT con estado=CANCELADO).' },
        { status: 400 }
      )
    }

    // Eliminar obligaciones no pagadas
    await db.obligacionVehiculo.deleteMany({
      where: { contratoId: id, estado: 'PENDIENTE' },
    })

    await db.contratoVehiculo.delete({ where: { id } })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Contrato ${anterior.numeroContrato} eliminado`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[vehiculos/contratos DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
