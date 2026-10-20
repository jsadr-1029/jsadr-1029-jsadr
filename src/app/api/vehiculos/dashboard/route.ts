// =====================================================
// /api/vehiculos/dashboard — Resumen administrativo
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const [
      vehiculos,
      conductores,
      contratos,
      obligaciones,
      pagos,
      mantenimientos,
      gastos,
      alertas,
    ] = await Promise.all([
      db.vehiculo.findMany({ where: { activo: true } }),
      db.conductorVehiculo.findMany({ where: { activo: true } }),
      db.contratoVehiculo.findMany({
        where: { estado: 'ACTIVO' },
        include: { vehiculo: true, conductor: true },
      }),
      db.obligacionVehiculo.findMany({
        where: { estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] } },
      }),
      db.pagoVehiculo.findMany(),
      db.mantenimientoVehiculo.findMany(),
      db.gastoVehiculo.findMany(),
      db.alertaVehiculo.findMany({ where: { atendida: false } }),
    ])

    const ingresosFacturados = obligaciones.reduce((s, o) => s + (o.monto || 0), 0)
    const multasFacturadas = obligaciones.reduce((s, o) => s + (o.multa || 0), 0)
    const carteraPendiente = obligaciones.reduce((s, o) => s + (o.montoPendiente || 0), 0)

    const pagosAprobados = pagos.filter(p => p.estado === 'APROBADO')
    const dineroRecibido = pagosAprobados.reduce((s, p) => s + (p.monto || 0), 0)
    const pagosPendientesVerificacion = pagos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'EN_REVISION')
    const montoPendienteVerificar = pagosPendientesVerificacion.reduce((s, p) => s + (p.monto || 0), 0)

    const ahora = new Date()
    const carteraVencida = obligaciones.filter(o => o.fechaVencimiento < ahora && o.estado !== 'PAGADA')
    const montoCarteraVencida = carteraVencida.reduce((s, o) => s + (o.montoPendiente || 0), 0)

    const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)
    const totalMantenimientos = mantenimientos.reduce((s, m) => s + (m.costo || 0), 0)

    const rentabilidadPorVehiculo = vehiculos.map(v => {
      const obligsVeh = obligaciones.filter(o => o.vehiculoId === v.id)
      const obligIds = new Set(obligsVeh.map(o => o.id))
      const pagosVeh = pagosAprobados.filter(p => p.obligacionId && obligIds.has(p.obligacionId))
      const gastosVeh = gastos.filter(g => g.vehiculoId === v.id)
      const mantsVeh = mantenimientos.filter(m => m.vehiculoId === v.id)
      const facturado = obligsVeh.reduce((s, o) => s + (o.monto || 0), 0)
      const recibido = pagosVeh.reduce((s, p) => s + (p.monto || 0), 0)
      const gastado = gastosVeh.reduce((s, g) => s + (g.monto || 0), 0) + mantsVeh.reduce((s, m) => s + (m.costo || 0), 0)
      return {
        vehiculoId: v.id,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        facturado,
        recibido,
        gastado,
        rentabilidad: recibido - gastado,
      }
    })

    const contratosActivos = contratos.map(c => ({
      id: c.id,
      numero: c.numeroContrato,
      conductor: c.conductor.nombre,
      cedula: c.conductor.cedula,
      vehiculo: `${c.vehiculo.marca} ${c.vehiculo.modelo} - ${c.vehiculo.placa}`,
      fechaInicio: c.fechaInicio,
      tarifa: c.tarifa,
      modalidad: c.modalidadPago,
      estado: c.estado,
    }))

    const alertasCriticas = alertas.filter(a => a.severidad === 'CRITICAL').slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalVehiculos: vehiculos.length,
          vehiculosDisponibles: vehiculos.filter(v => v.estado === 'DISPONIBLE').length,
          vehiculosAsignados: vehiculos.filter(v => v.estado === 'ASIGNADO').length,
          vehiculosMantenimiento: vehiculos.filter(v => v.estado === 'MANTENIMIENTO').length,
          totalConductores: conductores.length,
          contratosActivos: contratos.length,
          ingresosFacturados,
          multasFacturadas,
          carteraPendiente,
          montoCarteraVencida,
          carteraVencidaCount: carteraVencida.length,
          dineroRecibido,
          pagosPendientesVerificar: pagosPendientesVerificacion.length,
          montoPendienteVerificar,
          totalGastos,
          totalMantenimientos,
          rentabilidadNeta: dineroRecibido - totalGastos - totalMantenimientos,
        },
        rentabilidadPorVehiculo,
        contratosActivos,
        alertasCriticas: alertasCriticas.map(a => ({
          id: a.id,
          titulo: a.titulo,
          descripcion: a.descripcion,
          severidad: a.severidad,
          vehiculoId: a.vehiculoId,
        })),
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/dashboard] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard', detalle: error.message },
      { status: 500 }
    )
  }
}
