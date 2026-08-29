import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { registrarAuditLog, getClientInfo, rateLimit } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// POST - recalcular saldos del solicitud
// Se puede llamar manualmente para corregir inconsistencias históricas
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Reforzado: auth + rate limit específico
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`recalcular:${clientInfo.ip}`, 10)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { id } = await params

    const prestamo = await db.prestamo.findUnique({ where: { id } })
    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrado' },
        { status: 404 }
      )
    }

    const { estadisticas } = await recalcularSaldosPrestamo(id)

    await registrarAuditLog({
      usuarioNombre: 'Admin',
      accion: 'PRESTAMO_RECALCULADO',
      modulo: 'prestamos',
      entidadId: id,
      entidadNombre: prestamo.codigo,
      detalles: JSON.stringify(estadisticas),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      mensaje: `Solicitud ${prestamo.codigo} recalculado correctamente`,
      data: estadisticas,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
