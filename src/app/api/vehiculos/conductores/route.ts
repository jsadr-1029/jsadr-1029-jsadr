// =====================================================
// /api/vehiculos/conductores — CRUD conductores
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const cedula = searchParams.get('cedula')

    const where: any = { activo: true }
    if (cedula) where.cedula = { contains: cedula }

    const conductores = await db.conductorVehiculo.findMany({
      where,
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          include: { vehiculo: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: conductores.map(c => ({
        ...c,
        contratoActivo: c.contratos[0] || null,
        contratos: undefined,
      })),
    })
  } catch (error: any) {
    console.error('[vehiculos/conductores GET] Error:', error)
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
      cedula, nombre, telefono, email, direccion, ciudad,
      licenciaNumero, licenciaCategoria, licenciaVence,
      fotoUrl, documentos, clienteId, notas,
    } = body

    if (!cedula || !nombre || !telefono || !licenciaNumero) {
      return NextResponse.json(
        { success: false, error: 'cedula, nombre, telefono, licenciaNumero son obligatorios' },
        { status: 400 }
      )
    }

    const existe = await db.conductorVehiculo.findUnique({ where: { cedula } })
    if (existe) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un conductor con esta cédula' },
        { status: 409 }
      )
    }

    const conductor = await db.conductorVehiculo.create({
      data: {
        cedula,
        nombre,
        telefono,
        email,
        direccion,
        ciudad,
        licenciaNumero,
        licenciaCategoria,
        licenciaVence: licenciaVence ? new Date(licenciaVence) : null,
        fotoUrl,
        documentos: documentos ? JSON.stringify(documentos) : null,
        clienteId,
        notas,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CONDUCTOR',
        entidadId: conductor.id,
        accion: 'CREAR',
        descripcion: `Conductor ${conductor.nombre} (${conductor.cedula}) creado`,
        datosNuevos: JSON.stringify(conductor),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: conductor })
  } catch (error: any) {
    console.error('[vehiculos/conductores POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
