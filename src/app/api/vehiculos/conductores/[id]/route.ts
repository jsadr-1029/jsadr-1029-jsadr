// =====================================================
// /api/vehiculos/conductores/[id] — PUT/DELETE
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

    const anterior = await db.conductorVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Conductor no encontrado' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['nombre', 'telefono', 'email', 'direccion', 'ciudad',
      'licenciaNumero', 'licenciaCategoria', 'fotoUrl', 'clienteId', 'notas']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.licenciaVence !== undefined) data.licenciaVence = body.licenciaVence ? new Date(body.licenciaVence) : null
    if (body.documentos !== undefined) data.documentos = JSON.stringify(body.documentos)
    if (body.activo !== undefined) data.activo = Boolean(body.activo)

    const actualizado = await db.conductorVehiculo.update({ where: { id }, data })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONDUCTOR',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Conductor ${anterior.nombre} actualizado`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/conductores PUT] Error:', error)
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
    const anterior = await db.conductorVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Conductor no encontrado' }, { status: 404 })
    }

    const actualizado = await db.conductorVehiculo.update({
      where: { id },
      data: { activo: false },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONDUCTOR',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Conductor ${anterior.nombre} desactivado`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/conductores DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
