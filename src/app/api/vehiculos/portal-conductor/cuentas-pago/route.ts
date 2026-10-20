// =====================================================
// /api/vehiculos/portal-conductor/cuentas-pago
// El conductor consulta las cuentas donde debe pagar
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

    const cuentas = await db.cuentaPagoVehiculo.findMany({
      where: { contratoId: contrato.id, activa: true },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: {
        contrato: { numero: contrato.numeroContrato },
        cuentas: cuentas.map(c => ({
          id: c.id,
          banco: c.banco,
          tipoCuenta: c.tipoCuenta,
          numeroCuenta: c.numeroCuenta,
          titularCuenta: c.titularCuenta,
          tipoIdTitular: c.tipoIdTitular,
          numeroIdTitular: c.numeroIdTitular,
          emailPago: c.emailPago,
          telefonoPago: c.telefonoPago,
          instrucciones: c.instrucciones,
          referenciaSugerida: c.referenciaSugerida,
          esPrincipal: c.esPrincipal,
        })),
      },
    })
  } catch (error: any) {
    console.error('[vehiculos/portal-conductor/cuentas-pago] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
