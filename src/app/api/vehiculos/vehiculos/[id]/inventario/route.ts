// =====================================================
// /api/vehiculos/vehiculos/[id]/inventario
// CRUD de items de inventario del vehículo
// (llaves, documentos, herramientas, accesorios que se entregan)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const items = await db.inventarioVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    console.error('[vehiculos/inventario GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const { nombre, descripcion, cantidad, estado, fotoUrl, notas } = body

    if (!nombre) {
      return NextResponse.json({ success: false, error: 'nombre es obligatorio' }, { status: 400 })
    }

    const item = await db.inventarioVehiculo.create({
      data: {
        vehiculoId: id,
        nombre,
        descripcion,
        cantidad: cantidad ? parseInt(cantidad) : 1,
        estado: estado || 'BUENO',
        fotoUrl,
        notas,
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'INVENTARIO',
        entidadId: item.id,
        accion: 'CREAR',
        descripcion: `Item de inventario "${nombre}" agregado al vehículo`,
        datosNuevos: JSON.stringify(item),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: item })
  } catch (error: any) {
    console.error('[vehiculos/inventario POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
