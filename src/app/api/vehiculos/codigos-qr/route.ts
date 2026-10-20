// =====================================================
// /api/vehiculos/codigos-qr — CRUD códigos QR de pago
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

    const where: any = { activo: true }
    if (contratoId) where.contratoId = contratoId

    const codigos = await db.codigoQRVehiculo.findMany({
      where,
      include: {
        contrato: { include: { conductor: true, vehiculo: true } },
        cuentaPago: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: codigos })
  } catch (error: any) {
    console.error('[vehiculos/codigos-qr GET] Error:', error)
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
      contratoId, cuentaPagoId, titulo, descripcion,
      imagenUrl, montoFijo, tipoPago,
    } = body

    if (!contratoId || !titulo || !imagenUrl) {
      return NextResponse.json(
        { success: false, error: 'contratoId, titulo, imagenUrl son obligatorios' },
        { status: 400 }
      )
    }

    const codigo = await db.codigoQRVehiculo.create({
      data: {
        contratoId,
        cuentaPagoId: cuentaPagoId || null,
        titulo,
        descripcion,
        imagenUrl,
        montoFijo: montoFijo ? parseFloat(montoFijo) : null,
        tipoPago: tipoPago || 'OTRO',
        creadoPor: user.id,
      },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CODIGO_QR',
        entidadId: codigo.id,
        accion: 'CREAR',
        descripcion: `Código QR "${titulo}" agregado al contrato`,
        datosNuevos: JSON.stringify(codigo),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: codigo })
  } catch (error: any) {
    console.error('[vehiculos/codigos-qr POST] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
