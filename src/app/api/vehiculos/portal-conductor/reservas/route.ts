// =====================================================
// /api/vehiculos/portal-conductor/reservas
// GET: lista reservas del conductor autenticado
// POST: el conductor solicita una nueva reserva (queda PENDIENTE_APROBACION)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function calcularDistribucion(
  valorTotal: number,
  pCond: number, pAdmin: number, pMant: number,
  vPeajes: number, peajesDescontados: boolean
) {
  const base = peajesDescontados ? Math.max(0, valorTotal - vPeajes) : valorTotal
  return {
    montoConductor: Math.round((base * pCond) / 100),
    montoAdministrador: Math.round((base * pAdmin) / 100),
    montoMantenimiento: Math.round((base * pMant) / 100),
    montoPeajes: vPeajes,
    baseDistribucion: base,
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }
    const conductor = await db.conductorVehiculo.findFirst({
      where: { tokenSesion: token, tokenExpira: { gt: new Date() }, activo: true },
    })
    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }
    const reservas = await db.reservaVehiculo.findMany({
      where: { conductorId: conductor.id },
      include: { vehiculo: true, contrato: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: reservas })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/reservas GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }
    const conductor = await db.conductorVehiculo.findFirst({
      where: { tokenSesion: token, tokenExpira: { gt: new Date() }, activo: true },
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
          include: { vehiculo: true },
          take: 1,
        },
      },
    })
    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }
    const contrato = conductor.contratos[0]
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'No tienes contrato activo' }, { status: 400 })
    }

    const body = await req.json()
    const {
      origen, destino, fechaInicio, fechaFin, descripcion,
      valorTotal,
      cantidadPeajes, valorTotalPeajes,
      clienteNombre, clienteTelefono, clienteDocumento,
    } = body

    if (!origen || !destino || !fechaInicio || !valorTotal) {
      return NextResponse.json(
        { success: false, error: 'origen, destino, fechaInicio y valorTotal son obligatorios' },
        { status: 400 }
      )
    }

    // Porcentajes por defecto (60/25/15) - el admin puede ajustar al aprobar
    const pCond = 60, pAdmin = 25, pMant = 15
    const cPeajes = parseInt(cantidadPeajes) || 0
    const vPeajes = parseFloat(valorTotalPeajes) || 0
    const vTotal = parseFloat(valorTotal)
    const dist = calcularDistribucion(vTotal, pCond, pAdmin, pMant, vPeajes, true)

    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const reservasHoy = await db.reservaVehiculo.count({
      where: { numeroReserva: { startsWith: `RES-${fechaStr}` } },
    })
    const numeroReserva = `RES-${fechaStr}-${String(reservasHoy + 1).padStart(6, '0')}`

    const reserva = await db.reservaVehiculo.create({
      data: {
        numeroReserva,
        contratoId: contrato.id,
        vehiculoId: contrato.vehiculoId,
        conductorId: conductor.id,
        origen,
        destino,
        fechaInicio: new Date(fechaInicio),
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        descripcion,
        valorTotal: vTotal,
        porcentajeConductor: pCond,
        porcentajeAdministrador: pAdmin,
        porcentajeMantenimiento: pMant,
        cantidadPeajes: cPeajes,
        valorTotalPeajes: vPeajes,
        peajesDescontadosDelTotal: true,
        montoConductor: dist.montoConductor,
        montoAdministrador: dist.montoAdministrador,
        montoMantenimiento: dist.montoMantenimiento,
        montoPeajes: dist.montoPeajes,
        clienteNombre,
        clienteTelefono,
        clienteDocumento,
        estado: 'PENDIENTE_APROBACION',
        creadoPor: 'CONDUCTOR',
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'RESERVA',
        entidadId: reserva.id,
        accion: 'CREAR',
        descripcion: `Conductor ${conductor.nombre} (${conductor.cedula}) solicitó reserva ${numeroReserva}: ${origen} → ${destino}. Total: $${vTotal.toLocaleString('es-CO')}. Peajes: ${cPeajes} ($${vPeajes.toLocaleString('es-CO')}).`,
        usuarioId: conductor.id,
        usuarioNombre: `${conductor.nombre} (CONDUCTOR)`,
      },
    })

    return NextResponse.json({
      success: true,
      data: reserva,
      message: 'Reserva solicitada. Pendiente de aprobación por el administrador.',
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/reservas POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
