// =====================================================
// /api/vehiculos/vehiculos/[id]/inventario/[itemId]
// PUT (actualizar) / DELETE (eliminar) item de inventario
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id, itemId } = await params
    const body = await req.json()

    const anterior = await db.inventarioVehiculo.findFirst({
      where: { id: itemId, vehiculoId: id },
    })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['nombre', 'descripcion', 'estado', 'fotoUrl', 'notas',
      'entregadoAConductorId', 'estadoDevolucion']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.cantidad !== undefined) data.cantidad = parseInt(body.cantidad)
    if (body.fechaEntrega !== undefined) data.fechaEntrega = body.fechaEntrega ? new Date(body.fechaEntrega) : null
    if (body.fechaDevolucion !== undefined) data.fechaDevolucion = body.fechaDevolucion ? new Date(body.fechaDevolucion) : null

    const actualizado = await db.inventarioVehiculo.update({ where: { id: itemId }, data })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'INVENTARIO',
        entidadId: itemId,
        accion: 'MODIFICAR',
        descripcion: `Item "${anterior.nombre}" actualizado`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/inventario PUT] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id, itemId } = await params
    const anterior = await db.inventarioVehiculo.findFirst({
      where: { id: itemId, vehiculoId: id },
    })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 })
    }

    await db.inventarioVehiculo.delete({ where: { id: itemId } })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'INVENTARIO',
        entidadId: itemId,
        accion: 'ELIMINAR',
        descripcion: `Item "${anterior.nombre}" eliminado del inventario`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[vehiculos/inventario DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
