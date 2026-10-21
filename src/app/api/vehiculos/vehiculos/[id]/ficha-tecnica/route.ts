// =====================================================
// /api/vehiculos/vehiculos/[id]/ficha-tecnica
// Devuelve TODA la información consolidada del vehículo:
//  - Datos del vehículo
//  - Documentos (SOAT, tecno, etc.)
//  - Inventario completo
//  - Contratos (activo + históricos)
//  - Mantenimientos completos (con repuestos instalados/retirados)
//  - Repuestos activos (con vida útil en curso)
//  - Gastos resumidos
//  - Alertas activas
//  - KPIs del vehículo (rentabilidad, km recorridos, etc.)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { getVehiculosPermitidos } from '@/lib/permisos'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params

    const vehiculo = await db.vehiculo.findUnique({
      where: { id },
      include: {
        documentos: { orderBy: { createdAt: 'desc' } },
        inventario: { orderBy: { createdAt: 'desc' } },
        contratos: {
          include: { conductor: true },
          orderBy: { createdAt: 'desc' },
        },
        mantenimientos: {
          include: {
            repuestos: { include: { repuesto: true } },
            repuestosRetirados: { include: { repuesto: true } },
            proveedorRef: true,
          },
          orderBy: { fecha: 'desc' },
        },
        alertas: { where: { atendida: false }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!vehiculo) {
      return NextResponse.json({ success: false, error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // === VERIFICAR VEHÍCULOS PERMITIDOS POR USUARIO ===
    const vehiculosPermitidos = getVehiculosPermitidos(user.username || user.id)
    if (vehiculosPermitidos !== null && !vehiculosPermitidos.includes(vehiculo.placa.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este vehículo' },
        { status: 403 }
      )
    }

    // Repuestos activos (instalados, no retirados)
    const repuestosActivos = await db.repuestoInstalado.findMany({
      where: { vehiculoId: id, fechaRetiro: null },
      include: {
        repuesto: true,
        mantenimientoInstalacion: true,
        proveedorRef: true,
      },
      orderBy: { fechaInstalacion: 'desc' },
    })

    // Repuestos retirados (histórico de vida útil)
    const repuestosRetirados = await db.repuestoInstalado.findMany({
      where: { vehiculoId: id, fechaRetiro: { not: null } },
      include: {
        repuesto: true,
        mantenimientoInstalacion: true,
        mantenimientoRetiro: true,
        proveedorRef: true,
      },
      orderBy: { fechaRetiro: 'desc' },
    })

    // Gastos resumidos
    const gastos = await db.gastoVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { fecha: 'desc' },
    })
    const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)
    const gastosPorCategoria = gastos.reduce((acc: any, g) => {
      const k = g.categoria || 'OTRO'
      if (!acc[k]) acc[k] = 0
      acc[k] += g.monto
      return acc
    }, {})

    // Total invertido en mantenimientos
    const totalMantenimientos = vehiculo.mantenimientos.reduce((s, m) => s + (m.costo || 0), 0)

    // Obligaciones del vehículo
    const obligaciones = await db.obligacionVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { fechaVencimiento: 'asc' },
    })

    // Pagos aprobados (ingresos)
    const pagosAprobados = await db.pagoVehiculo.findMany({
      where: {
        estado: 'APROBADO',
        contrato: { vehiculoId: id },
      },
    })
    const totalIngresos = pagosAprobados.reduce((s, p) => s + (p.monto || 0), 0)

    // Contrato activo
    const contratoActivo = vehiculo.contratos.find(c => c.estado === 'ACTIVO') || null

    // Documentos con estado dinámico
    const ahora = new Date()
    const documentos = vehiculo.documentos.map(d => {
      let estadoCalculado = d.estado
      if (d.fechaVencimiento) {
        const dias = Math.ceil((d.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
        if (dias < 0) estadoCalculado = 'VENCIDO'
        else if (dias < 15) estadoCalculado = 'POR_VENCER'
        else estadoCalculado = 'VIGENTE'
      }
      return {
        ...d,
        estado: estadoCalculado,
        diasParaVencer: d.fechaVencimiento
          ? Math.ceil((d.fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }
    })

    // KPIs
    const kilometrajeActual = vehiculo.kilometraje || 0
    const kmRecorridosUltimoMantenimiento = vehiculo.mantenimientos[0]
      ? Math.max(0, kilometrajeActual - vehiculo.mantenimientos[0].kilometraje)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        vehiculo,
        documentos,
        inventario: vehiculo.inventario,
        contratoActivo,
        contratos: vehiculo.contratos,
        mantenimientos: vehiculo.mantenimientos,
        repuestosActivos,
        repuestosRetirados,
        alertas: vehiculo.alertas,
        obligaciones,
        kpis: {
          totalIngresos,
          totalGastos,
          totalMantenimientos,
          rentabilidadNeta: totalIngresos - totalGastos - totalMantenimientos,
          kilometrajeActual,
          kmDesdeUltimoMantenimiento: kmRecorridosUltimoMantenimiento,
          cantidadMantenimientos: vehiculo.mantenimientos.length,
          cantidadDocumentos: documentos.length,
          cantidadItemsInventario: vehiculo.inventario.length,
        },
        gastosResumen: {
          total: totalGastos,
          porCategoria: gastosPorCategoria,
        },
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/ficha-tecnica] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
