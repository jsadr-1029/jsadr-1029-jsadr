// =====================================================
// /api/vehiculos/mantenimientos — CRUD mantenimientos
// Al registrar mantenimiento: actualiza kilometraje del vehículo
// y genera alerta de próxima revisión si aplica
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
    const contratoId = searchParams.get('contratoId')

    const where: any = {}
    if (vehiculoId) where.vehiculoId = vehiculoId
    if (contratoId) where.contratoId = contratoId

    const mantenimientos = await db.mantenimientoVehiculo.findMany({
      where,
      include: {
        vehiculo: true,
        contrato: true,
        repuestos: { include: { repuesto: true } },
      },
      orderBy: { fecha: 'desc' },
    })

    return NextResponse.json({ success: true, data: mantenimientos })
  } catch (error: any) {
    console.error('[vehiculos/mantenimientos GET] Error:', error)
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
      vehiculoId, contratoId,
      fecha, kilometraje, tipo, trabajoRealizado,
      taller, proveedor, costo,
      proximaRevisionKm, proximaRevisionFecha,
      fotosUrl, notas,
      repuestos, // array de { repuestoId, proveedor, costo, garantiaVence }
    } = body

    if (!vehiculoId || !fecha || !kilometraje || !trabajoRealizado) {
      return NextResponse.json(
        { success: false, error: 'vehiculoId, fecha, kilometraje, trabajoRealizado son obligatorios' },
        { status: 400 }
      )
    }

    const mantenimiento = await db.mantenimientoVehiculo.create({
      data: {
        vehiculoId,
        contratoId: contratoId || null,
        fecha: new Date(fecha),
        kilometraje: parseInt(kilometraje),
        tipo: tipo || 'CORRECTIVO',
        trabajoRealizado,
        taller,
        proveedor,
        costo: costo ? parseFloat(costo) : 0,
        proximaRevisionKm: proximaRevisionKm ? parseInt(proximaRevisionKm) : null,
        proximaRevisionFecha: proximaRevisionFecha ? new Date(proximaRevisionFecha) : null,
        fotosUrl: fotosUrl ? JSON.stringify(fotosUrl) : null,
        notas,
        creadoPor: user.id,
      },
    })

    // Actualizar kilometraje del vehículo
    await db.vehiculo.update({
      where: { id: vehiculoId },
      data: { kilometraje: parseInt(kilometraje) },
    })

    // Registrar repuestos instalados
    if (repuestos && Array.isArray(repuestos)) {
      for (const r of repuestos) {
        await db.repuestoInstalado.create({
          data: {
            repuestoId: r.repuestoId,
            vehiculoId,
            mantenimientoInstalacionId: mantenimiento.id,
            fechaInstalacion: new Date(fecha),
            kilometrajeInstalacion: parseInt(kilometraje),
            proveedor: r.proveedor || null,
            costo: r.costo ? parseFloat(r.costo) : 0,
            garantiaVence: r.garantiaVence ? new Date(r.garantiaVence) : null,
          },
        })
      }
    }

    // Generar alerta de próxima revisión si aplica
    if (proximaRevisionFecha || proximaRevisionKm) {
      await db.alertaVehiculo.create({
        data: {
          vehiculoId,
          tipo: 'MANTENIMIENTO_PROXIMO',
          severidad: 'INFO',
          titulo: 'Próxima revisión programada',
          descripcion: `Vehículo tiene revisión programada${proximaRevisionKm ? ` a los ${proximaRevisionKm} km` : ''}${proximaRevisionFecha ? ` el ${new Date(proximaRevisionFecha).toLocaleDateString('es-CO')}` : ''}`,
        },
      })
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'MANTENIMIENTO',
        entidadId: mantenimiento.id,
        accion: 'CREAR',
        descripcion: `Mantenimiento ${tipo} registrado para vehículo. Costo: $${(costo || 0).toLocaleString('es-CO')}`,
        datosNuevos: JSON.stringify(mantenimiento),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: mantenimiento })
  } catch (error: any) {
    console.error('[vehiculos/mantenimientos POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
