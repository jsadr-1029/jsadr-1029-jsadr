// =====================================================
// /api/vehiculos/vehiculos/[id] — PUT/DELETE vehículo
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

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

    const anterior = await db.vehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['marca', 'modelo', 'color', 'vin', 'motor', 'fotoUrl', 'notas', 'estado']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.anio !== undefined) data.anio = parseInt(body.anio)
    if (body.kilometraje !== undefined) data.kilometraje = parseInt(body.kilometraje)
    if (body.soatVence !== undefined) data.soatVence = body.soatVence ? new Date(body.soatVence) : null
    if (body.tecnomecanicaVence !== undefined) data.tecnomecanicaVence = body.tecnomecanicaVence ? new Date(body.tecnomecanicaVence) : null
    if (body.fechaCompra !== undefined) data.fechaCompra = body.fechaCompra ? new Date(body.fechaCompra) : null
    if (body.valorCompra !== undefined) data.valorCompra = body.valorCompra ? parseFloat(body.valorCompra) : null
    if (body.activo !== undefined) data.activo = Boolean(body.activo)

    const actualizado = await db.vehiculo.update({ where: { id }, data })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'VEHICULO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Vehículo ${anterior.placa} actualizado`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/vehiculos PUT] Error:', error)
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
    const anterior = await db.vehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Soft delete: marcar como inactivo
    const actualizado = await db.vehiculo.update({
      where: { id },
      data: { activo: false, estado: 'INACTIVO' },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'VEHICULO',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Vehículo ${anterior.placa} desactivado`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/vehiculos DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
