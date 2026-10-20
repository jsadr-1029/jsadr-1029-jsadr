// =====================================================
// /api/vehiculos/repuestos — CRUD catálogo de repuestos
// + Endpoint /api/vehiculos/repuestos/[id]/instalar para instalar
// + Endpoint /api/vehiculos/repuestos/[id]/retirar para retirar y calcular vida útil
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const vehiculoId = searchParams.get('vehiculoId')

    let where: any = {}
    if (vehiculoId) {
      const instalaciones = await db.repuestoInstalado.findMany({
        where: { vehiculoId, fechaRetiro: null },
        select: { repuestoId: true },
      })
      where = { id: { in: instalaciones.map(i => i.repuestoId) } }
    }

    const repuestos = await db.repuestoVehiculo.findMany({
      where,
      include: {
        instalaciones: {
          where: { fechaRetiro: null },
          include: { vehiculo: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: repuestos })
  } catch (error: any) {
    console.error('[vehiculos/repuestos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const { nombre, marca, referencia, categoria, descripcion } = body

    if (!nombre) {
      return NextResponse.json({ success: false, error: 'nombre es obligatorio' }, { status: 400 })
    }

    const repuesto = await db.repuestoVehiculo.create({
      data: { nombre, marca, referencia, categoria, descripcion },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'REPUESTO',
        entidadId: repuesto.id,
        accion: 'CREAR',
        descripcion: `Repuesto ${repuesto.nombre} creado en catálogo`,
        datosNuevos: JSON.stringify(repuesto),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: repuesto })
  } catch (error: any) {
    console.error('[vehiculos/repuestos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
