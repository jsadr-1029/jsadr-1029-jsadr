// =====================================================
// /api/vehiculos/reservas — CRUD de reservas (admin)
// Crea/lista reservas. Calcula automáticamente la distribución.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

// === Helper: calcular distribución de montos ===
function calcularDistribucion(
  valorTotal: number,
  porcentajeConductor: number,
  porcentajeAdministrador: number,
  porcentajeMantenimiento: number,
  cantidadPeajes: number,
  valorTotalPeajes: number,
  peajesDescontadosDelTotal: boolean
) {
  // Base = valorTotal - peajes si peajesDescontadosDelTotal=true
  const base = peajesDescontadosDelTotal
    ? Math.max(0, valorTotal - valorTotalPeajes)
    : valorTotal

  return {
    montoConductor: Math.round((base * porcentajeConductor) / 100),
    montoAdministrador: Math.round((base * porcentajeAdministrador) / 100),
    montoMantenimiento: Math.round((base * porcentajeMantenimiento) / 100),
    montoPeajes: valorTotalPeajes,
    baseDistribucion: base,
  }
}

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const conductorId = searchParams.get('conductorId')
    const vehiculoId = searchParams.get('vehiculoId')

    const where: any = {}
    if (estado) where.estado = estado
    if (conductorId) where.conductorId = conductorId
    if (vehiculoId) where.vehiculoId = vehiculoId

    const reservas = await db.reservaVehiculo.findMany({
      where,
      include: {
        conductor: true,
        vehiculo: true,
        contrato: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: reservas })
  } catch (error: any) {
    console.error('[vehiculos/reservas GET] Error:', error)
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
      contratoId, vehiculoId, conductorId,
      origen, destino, fechaInicio, fechaFin, descripcion,
      valorTotal,
      porcentajeConductor, porcentajeAdministrador, porcentajeMantenimiento,
      cantidadPeajes, valorTotalPeajes, peajesDescontadosDelTotal,
      clienteNombre, clienteTelefono, clienteDocumento,
    } = body

    if (!contratoId || !vehiculoId || !conductorId || !origen || !destino || !fechaInicio || !valorTotal) {
      return NextResponse.json(
        { success: false, error: 'contratoId, vehiculoId, conductorId, origen, destino, fechaInicio, valorTotal son obligatorios' },
        { status: 400 }
      )
    }

    // Validar que los porcentajes sumen 100
    const pCond = parseFloat(porcentajeConductor) || 60
    const pAdmin = parseFloat(porcentajeAdministrador) || 25
    const pMant = parseFloat(porcentajeMantenimiento) || 15
    const suma = pCond + pAdmin + pMant
    if (Math.abs(suma - 100) > 0.1) {
      return NextResponse.json(
        { success: false, error: `Los porcentajes deben sumar 100%. Actual: ${suma}% (Conductor: ${pCond}%, Admin: ${pAdmin}%, Mant: ${pMant}%)` },
        { status: 400 }
      )
    }

    const vTotal = parseFloat(valorTotal)
    const cPeajes = parseInt(cantidadPeajes) || 0
    const vPeajes = parseFloat(valorTotalPeajes) || 0
    const pDesc = peajesDescontadosDelTotal !== false

    const dist = calcularDistribucion(vTotal, pCond, pAdmin, pMant, cPeajes, vPeajes, pDesc)

    // Generar número de reserva
    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const reservasHoy = await db.reservaVehiculo.count({
      where: { numeroReserva: { startsWith: `RES-${fechaStr}` } },
    })
    const numeroReserva = `RES-${fechaStr}-${String(reservasHoy + 1).padStart(6, '0')}`

    const reserva = await db.reservaVehiculo.create({
      data: {
        numeroReserva,
        contratoId,
        vehiculoId,
        conductorId,
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
        peajesDescontadosDelTotal: pDesc,
        montoConductor: dist.montoConductor,
        montoAdministrador: dist.montoAdministrador,
        montoMantenimiento: dist.montoMantenimiento,
        montoPeajes: dist.montoPeajes,
        clienteNombre,
        clienteTelefono,
        clienteDocumento,
        estado: 'PENDIENTE_APROBACION',
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'RESERVA',
        entidadId: reserva.id,
        accion: 'CREAR',
        descripcion: `Reserva ${numeroReserva} creada: ${origen} → ${destino}. Total: $${vTotal.toLocaleString('es-CO')}. Distribución: Conductor ${pCond}% ($${dist.montoConductor.toLocaleString('es-CO')}), Admin ${pAdmin}% ($${dist.montoAdministrador.toLocaleString('es-CO')}), Mant ${pMant}% ($${dist.montoMantenimiento.toLocaleString('es-CO')}), Peajes $${dist.montoPeajes.toLocaleString('es-CO')} (${cPeajes} peajes)`,
        datosNuevos: JSON.stringify(reserva),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: reserva })
  } catch (error: any) {
    console.error('[vehiculos/reservas POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
