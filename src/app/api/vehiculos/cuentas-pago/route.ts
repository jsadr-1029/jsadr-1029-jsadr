// =====================================================
// /api/vehiculos/cuentas-pago — CRUD cuentas de pago
// Permite al admin asignar cuentas bancarias/Nequi/Daviplata
// a un contrato específico para que el conductor sepa dónde pagar.
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const contratoId = searchParams.get('contratoId')

    const where: any = {}
    if (contratoId) where.contratoId = contratoId

    const cuentas = await db.cuentaPagoVehiculo.findMany({
      where,
      include: {
        contrato: { include: { conductor: true, vehiculo: true } },
        _count: { select: { codigosQR: true, pagos: true } },
      },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: cuentas })
  } catch (error: any) {
    console.error('[vehiculos/cuentas-pago GET] Error:', error)
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
      contratoId, banco, tipoCuenta, numeroCuenta, titularCuenta,
      tipoIdTitular, numeroIdTitular,
      emailPago, telefonoPago, instrucciones, referenciaSugerida,
      esPrincipal,
    } = body

    if (!contratoId || !banco || !tipoCuenta || !numeroCuenta || !titularCuenta) {
      return NextResponse.json(
        { success: false, error: 'contratoId, banco, tipoCuenta, numeroCuenta, titularCuenta son obligatorios' },
        { status: 400 }
      )
    }

    // Verificar contrato
    const contrato = await db.contratoVehiculo.findUnique({ where: { id: contratoId } })
    if (!contrato) {
      return NextResponse.json({ success: false, error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Si esPrincipal, quitar el flag de las otras cuentas del mismo contrato
    if (esPrincipal) {
      await db.cuentaPagoVehiculo.updateMany({
        where: { contratoId, esPrincipal: true },
        data: { esPrincipal: false },
      })
    }

    const cuenta = await db.cuentaPagoVehiculo.create({
      data: {
        contratoId,
        banco,
        tipoCuenta,
        numeroCuenta,
        titularCuenta,
        tipoIdTitular,
        numeroIdTitular,
        emailPago,
        telefonoPago,
        instrucciones,
        referenciaSugerida,
        esPrincipal: Boolean(esPrincipal),
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CUENTA_PAGO',
        entidadId: cuenta.id,
        accion: 'CREAR',
        descripcion: `Cuenta ${banco} ${tipoCuenta} ${numeroCuenta} (titular: ${titularCuenta}) asignada al contrato ${contrato.numeroContrato}`,
        datosNuevos: JSON.stringify(cuenta),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: cuenta })
  } catch (error: any) {
    console.error('[vehiculos/cuentas-pago POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
