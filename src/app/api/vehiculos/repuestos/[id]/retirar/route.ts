// =====================================================
// /api/vehiculos/repuestos/[id]/retirar — Retira un repuesto instalado
// Calcula vida útil (días + km recorridos) y marca fecha/km de retiro.
// Recomendación automática de próximo cambio (vida útil promedio)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const { mantenimientoRetiroId, motivoRetiro, fallaReportada, kilometrajeRetiro } = body

    const instalacion = await db.repuestoInstalado.findUnique({
      where: { id },
      include: { repuesto: true, vehiculo: true },
    })

    if (!instalacion) {
      return NextResponse.json({ success: false, error: 'Instalación no encontrada' }, { status: 404 })
    }

    if (instalacion.fechaRetiro) {
      return NextResponse.json({ success: false, error: 'Este repuesto ya fue retirado' }, { status: 400 })
    }

    const fechaRetiro = new Date()
    const kmRetiro = kilometrajeRetiro ? parseInt(kilometrajeRetiro) : (instalacion.vehiculo?.kilometraje || instalacion.kilometrajeInstalacion)

    // Calcular vida útil
    const diffMs = fechaRetiro.getTime() - instalacion.fechaInstalacion.getTime()
    const diasEnUso = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const kmRecorridos = Math.max(0, kmRetiro - instalacion.kilometrajeInstalacion)

    // Recomendación: próximo cambio en misma vida útil si > 0
    let proximoCambioSugeridoKm: number | null = null
    let proximoCambioSugeridoFecha: Date | null = null
    if (kmRecorridos > 0) {
      proximoCambioSugeridoKm = kmRetiro + kmRecorridos
    }
    if (diasEnUso > 0) {
      const futura = new Date(fechaRetiro)
      futura.setDate(futura.getDate() + diasEnUso)
      proximoCambioSugeridoFecha = futura
    }

    const actualizado = await db.repuestoInstalado.update({
      where: { id },
      data: {
        fechaRetiro,
        kilometrajeRetiro: kmRetiro,
        motivoRetiro: motivoRetiro || 'DESGASTE',
        fallaReportada: fallaReportada || null,
        mantenimientoRetiroId: mantenimientoRetiroId || null,
        diasEnUso,
        kmRecorridos,
        proximoCambioRecomendadoKm: proximoCambioSugeridoKm,
        proximoCambioSugeridoFecha: proximoCambioSugeridoFecha,
      },
    })

    // Generar alerta si la vida útil fue muy corta (posible falla prematura)
    if (diasEnUso < 30 && kmRecorridos < 5000) {
      await db.alertaVehiculo.create({
        data: {
          vehiculoId: instalacion.vehiculoId,
          tipo: 'REPUESTO_VIDA_UTIL_FIN',
          severidad: 'WARNING',
          titulo: `Repuesto "${instalacion.repuesto.nombre}" tuvo vida útil corta`,
          descripcion: `Solo duró ${diasEnUso} días / ${kmRecorridos} km. Revisar calidad del repuesto o condiciones de uso.`,
        },
      })
    }

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'REPUESTO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Repuesto "${instalacion.repuesto.nombre}" retirado. Vida útil: ${diasEnUso} días, ${kmRecorridos} km`,
        datosAnteriores: JSON.stringify(instalacion),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({
      success: true,
      data: actualizado,
      vidaUtil: { dias: diasEnUso, km: kmRecorridos, proximoCambioSugeridoKm, proximoCambioSugeridoFecha },
    })
  } catch (error: any) {
    console.error('[vehiculos/repuestos/retirar] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
