// =====================================================
// /api/vehiculos/portal-conductor/recibos
// Lista los recibos del conductor (solo aprobados)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 })
    }

    const conductor = await db.conductorVehiculo.findFirst({
      where: {
        tokenSesion: token,
        tokenExpira: { gt: new Date() },
        activo: true,
      },
    })

    if (!conductor) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const recibos = await db.reciboPagoVehiculo.findMany({
      where: {
        conductorId: conductor.id,
        anulado: false,
      },
      orderBy: { fechaAprobacion: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: recibos.map(r => ({
        id: r.id,
        numeroRecibo: r.numeroRecibo,
        monto: r.monto,
        fechaPago: r.fechaPago,
        fechaAprobacion: r.fechaAprobacion,
        metodoPago: r.metodoPago,
        bancoOrigen: r.bancoOrigen,
        referencia: r.referencia,
        numeroContrato: r.numeroContrato,
        placaVehiculo: r.placaVehiculo,
        numeroCuota: r.numeroCuota,
        montoCuota: r.montoCuota,
        multaAplicada: r.multaAplicada,
        codigoVerificacion: r.codigoVerificacion,
        pagoId: r.pagoId,
      })),
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/recibos] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
