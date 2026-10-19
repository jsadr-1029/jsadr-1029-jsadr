// =====================================================
// /api/vehiculos/portal-conductor/codigos-qr
// El conductor obtiene los QR de pago escaneables
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
      include: {
        contratos: {
          where: { estado: 'ACTIVO' },
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

    const codigos = await db.codigoQRVehiculo.findMany({
      where: { contratoId: contrato.id, activo: true },
      include: { cuentaPago: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: codigos.map(qr => ({
        id: qr.id,
        titulo: qr.titulo,
        descripcion: qr.descripcion,
        imagenUrl: qr.imagenUrl,
        montoFijo: qr.montoFijo,
        tipoPago: qr.tipoPago,
        cuenta: qr.cuentaPago ? {
          banco: qr.cuentaPago.banco,
          titular: qr.cuentaPago.titularCuenta,
          numero: qr.cuentaPago.numeroCuenta,
        } : null,
      })),
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/codigos-qr] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
