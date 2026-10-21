// =====================================================
// /api/vehiculos/vehiculos — CRUD de vehículos
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { getVehiculosPermitidos } from '@/lib/permisos'

// GET — listar vehículos (con filtros opcionales)
export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const placa = searchParams.get('placa')

    const where: any = {}
    if (estado) where.estado = estado
    if (placa) where.placa = { contains: placa, mode: 'insensitive' }

    // === FILTRO POR VEHÍCULOS PERMITIDOS POR USUARIO ===
    const vehiculosPermitidos = getVehiculosPermitidos(user.username || user.id)
    if (vehiculosPermitidos !== null) {
      where.placa = { in: vehiculosPermitidos }
    }

    const vehiculos = await db.vehiculo.findMany({
      where,
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          include: { conductor: true },
          take: 1,
        },
        mantenimientos: { orderBy: { fecha: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: vehiculos.map(v => ({
        ...v,
        contratoActivo: v.contratos[0] || null,
        ultimoMantenimiento: v.mantenimientos[0] || null,
        contratos: undefined,
        mantenimientos: undefined,
      })),
    })
  } catch (error: any) {
    console.error('[vehiculos/vehiculos GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — crear vehículo
export async function POST(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const body = await req.json()
    const {
      placa, marca, modelo, anio, color, kilometraje, vin, motor,
      soatVence, tecnomecanicaVence, fechaCompra, valorCompra,
      fotoUrl, notas,
    } = body

    if (!placa || !marca || !modelo) {
      return NextResponse.json(
        { success: false, error: 'placa, marca y modelo son obligatorios' },
        { status: 400 }
      )
    }

    // === VERIFICAR VEHÍCULOS PERMITIDOS POR USUARIO ===
    const vehiculosPermitidos = getVehiculosPermitidos(user.username || user.id)
    if (vehiculosPermitidos !== null && !vehiculosPermitidos.includes(placa.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear vehículos con esta placa' },
        { status: 403 }
      )
    }

    // Verificar que no exista la placa
    const existe = await db.vehiculo.findUnique({ where: { placa: placa.toUpperCase() } })
    if (existe) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un vehículo con esta placa' },
        { status: 409 }
      )
    }

    const vehiculo = await db.vehiculo.create({
      data: {
        placa: placa.toUpperCase(),
        marca,
        modelo,
        anio: anio ? parseInt(anio) : null,
        color,
        kilometraje: kilometraje ? parseInt(kilometraje) : 0,
        vin,
        motor,
        soatVence: soatVence ? new Date(soatVence) : null,
        tecnomecanicaVence: tecnomecanicaVence ? new Date(tecnomecanicaVence) : null,
        fechaCompra: fechaCompra ? new Date(fechaCompra) : null,
        valorCompra: valorCompra ? parseFloat(valorCompra) : null,
        fotoUrl,
        notas,
      },
    })

    // Auditoría
    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'VEHICULO',
        entidadId: vehiculo.id,
        accion: 'CREAR',
        descripcion: `Vehículo ${vehiculo.placa} creado`,
        datosNuevos: JSON.stringify(vehiculo),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: vehiculo })
  } catch (error: any) {
    console.error('[vehiculos/vehiculos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
