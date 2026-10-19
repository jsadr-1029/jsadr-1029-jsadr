// =====================================================
// /api/vehiculos/proveedores/[id] — PUT/DELETE
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

    const anterior = await db.proveedorVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['nombre', 'tipo', 'documento', 'contacto', 'telefono', 'telefono2',
      'email', 'direccion', 'ciudad', 'barrio', 'notas']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.activo !== undefined) data.activo = Boolean(body.activo)

    const actualizado = await db.proveedorVehiculo.update({ where: { id }, data })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PROVEEDOR',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Proveedor "${anterior.nombre}" actualizado`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/proveedores PUT] Error:', error)
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
    const anterior = await db.proveedorVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const actualizado = await db.proveedorVehiculo.update({
      where: { id },
      data: { activo: false },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PROVEEDOR',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Proveedor "${anterior.nombre}" desactivado`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/proveedores DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
