// =====================================================
// /api/vehiculos/cuentas-pago/[id] — PUT/DELETE
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const body = await req.json()

    const anterior = await db.cuentaPagoVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Cuenta no encontrada' }, { status: 404 })
    }

    const data: any = {}
    const campos = ['banco', 'tipoCuenta', 'numeroCuenta', 'titularCuenta',
      'tipoIdTitular', 'numeroIdTitular', 'emailPago', 'telefonoPago',
      'instrucciones', 'referenciaSugerida']
    for (const c of campos) {
      if (body[c] !== undefined) data[c] = body[c]
    }
    if (body.esPrincipal !== undefined) {
      // Si esPrincipal, quitar el flag de las otras cuentas del mismo contrato
      if (body.esPrincipal) {
        await db.cuentaPagoVehiculo.updateMany({
          where: { contratoId: anterior.contratoId, esPrincipal: true, id: { not: id } },
          data: { esPrincipal: false },
        })
      }
      data.esPrincipal = Boolean(body.esPrincipal)
    }
    if (body.activa !== undefined) data.activa = Boolean(body.activa)

    const actualizado = await db.cuentaPagoVehiculo.update({ where: { id }, data })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CUENTA_PAGO',
        entidadId: id,
        accion: 'MODIFICAR',
        descripcion: `Cuenta ${anterior.banco} ${anterior.numeroCuenta} actualizada`,
        datosAnteriores: JSON.stringify(anterior),
        datosNuevos: JSON.stringify(actualizado),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/cuentas-pago PUT] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const anterior = await db.cuentaPagoVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'Cuenta no encontrada' }, { status: 404 })
    }

    // Soft delete: marcar como inactiva
    const actualizado = await db.cuentaPagoVehiculo.update({
      where: { id },
      data: { activa: false, esPrincipal: false },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CUENTA_PAGO',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Cuenta ${anterior.banco} ${anterior.numeroCuenta} desactivada`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/cuentas-pago DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
