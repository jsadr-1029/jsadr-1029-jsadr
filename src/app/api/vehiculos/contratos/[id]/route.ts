// =====================================================
// /api/vehiculos/contratos/[id] — GET, PUT, DELETE
// + Endpoints anidados para gestión de obligaciones y pagos del contrato
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

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
    data.modificadoPor = user.id

    const actualizado = await db.contratoVehiculo.update({ where: { id }, data })

    // Si el contrato cambia a CANCELADO o FINALIZADO, liberar vehículo
    if (body.estado && ['CANCELADO', 'FINALIZADO'].includes(body.estado)) {
      await db.vehiculo.update({
        where: { id: anterior.vehiculoId },
        data: { estado: 'DISPONIBLE' },
      })
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Contrato ${anterior.numeroContrato} actualizado`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/contratos PUT] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
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
