// =====================================================
// /api/vehiculos/gastos — CRUD gastos del vehículo
// (Combustible, peajes, lavado, parqueadero, seguros, otros)
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
    const categoria = searchParams.get('categoria')

    const where: any = {}
    if (vehiculoId) where.vehiculoId = vehiculoId
    if (categoria) where.categoria = categoria

    const gastos = await db.gastoVehiculo.findMany({
      where,
      include: { vehiculo: true },
      orderBy: { fecha: 'desc' },
    })

    return NextResponse.json({ success: true, data: gastos })
  } catch (error: any) {
    console.error('[vehiculos/gastos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const { vehiculoId, fecha, concepto, monto, categoria, proveedor, comprobanteUrl } = body

    if (!vehiculoId || !fecha || !concepto || !monto) {
      return NextResponse.json(
        { success: false, error: 'vehiculoId, fecha, concepto, monto son obligatorios' },
        { status: 400 }
      )
    }

    const gasto = await db.gastoVehiculo.create({
      data: {
        vehiculoId,
        fecha: new Date(fecha),
        concepto,
        monto: parseFloat(monto),
        categoria: categoria || 'OTRO',
        proveedor: proveedor || null,
        comprobanteUrl: comprobanteUrl || null,
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'GASTO',
        entidadId: gasto.id,
        accion: 'CREAR',
        descripcion: `Gasto "${concepto}" registrado. Monto: $${parseFloat(monto).toLocaleString('es-CO')}`,
        datosNuevos: JSON.stringify(gasto),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: gasto })
  } catch (error: any) {
    console.error('[vehiculos/gastos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
