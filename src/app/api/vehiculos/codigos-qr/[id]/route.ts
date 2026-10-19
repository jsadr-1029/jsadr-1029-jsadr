// =====================================================
// /api/vehiculos/codigos-qr/[id] — DELETE (desactivar QR)
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  try {
    const { id } = await params
    const anterior = await db.codigoQRVehiculo.findUnique({ where: { id } })
    if (!anterior) {
      return NextResponse.json({ success: false, error: 'QR no encontrado' }, { status: 404 })
    }

    const actualizado = await db.codigoQRVehiculo.update({
      where: { id },
      data: { activo: false },
    })

    await db.auditoriaVehiculo.create({
      data: {
        entidad: 'CODIGO_QR',
        entidadId: id,
        accion: 'ELIMINAR',
        descripcion: `Código QR "${anterior.titulo}" desactivado`,
        datosAnteriores: JSON.stringify(anterior),
        usuarioId: user.id,
        usuarioNombre: user.nombre,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    console.error('[vehiculos/codigos-qr DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
