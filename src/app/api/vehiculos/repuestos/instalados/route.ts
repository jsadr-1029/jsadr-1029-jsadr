// =====================================================
// /api/vehiculos/repuestos/instalados — Traza de instalaciones
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
    const soloActivos = searchParams.get('activos') === 'true'

    const where: any = {}
    if (vehiculoId) where.vehiculoId = vehiculoId
    if (soloActivos) where.fechaRetiro = null

    const instalaciones = await db.repuestoInstalado.findMany({
      where,
      include: {
        repuesto: true,
        vehiculo: true,
        mantenimientoInstalacion: true,
      },
      orderBy: { fechaInstalacion: 'desc' },
    })

    const data = instalaciones.map(inst => {
      let diasEnUso = inst.diasEnUso
      let kmRecorridos = inst.kmRecorridos

      if (!inst.fechaRetiro) {
        const ahora = new Date()
        const diffMs = ahora.getTime() - inst.fechaInstalacion.getTime()
        diasEnUso = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (inst.vehiculo && inst.vehiculo.kilometraje) {
          kmRecorridos = Math.max(0, inst.vehiculo.kilometraje - inst.kilometrajeInstalacion)
        }
      }

      return {
        ...inst,
        diasEnUso,
        kmRecorridos,
        vidaUtilCalculada: inst.fechaRetiro !== null && diasEnUso !== null,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[vehiculos/repuestos/instalados GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
