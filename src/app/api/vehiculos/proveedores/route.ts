// =====================================================
// /api/vehiculos/proveedores — CRUD agenda de proveedores
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')
    const busqueda = searchParams.get('q')

    const where: any = { activo: true }
    if (tipo) where.tipo = tipo
    if (busqueda) {
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { contacto: { contains: busqueda, mode: 'insensitive' } },
        { telefono: { contains: busqueda } },
        { documento: { contains: busqueda } },
      ]
    }

    const proveedores = await db.proveedorVehiculo.findMany({
      where,
      include: {
        _count: {
          select: {
            mantenimientos: true,
            repuestosInstalados: true,
            gastos: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({ success: true, data: proveedores })
  } catch (error: any) {
    console.error('[vehiculos/proveedores GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const {
      nombre, tipo, documento, contacto,
      telefono, telefono2, email, direccion, ciudad, barrio, notas,
    } = body

    if (!nombre) {
      return NextResponse.json({ success: false, error: 'nombre es obligatorio' }, { status: 400 })
    }

    const proveedor = await db.proveedorVehiculo.create({
      data: {
        nombre,
        tipo: tipo || 'TALLER',
        documento,
        contacto,
        telefono,
        telefono2,
        email,
        direccion,
        ciudad,
        barrio,
        notas,
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'PROVEEDOR',
        entidadId: proveedor.id,
        accion: 'CREAR',
        descripcion: `Proveedor "${proveedor.nombre}" creado`,
        datosNuevos: JSON.stringify(proveedor),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: proveedor })
  } catch (error: any) {
    console.error('[vehiculos/proveedores POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
