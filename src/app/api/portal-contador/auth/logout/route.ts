import { NextRequest, NextResponse } from 'next/server'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireContador } from '@/lib/contador-auth'

// POST /api/portal-contador/auth/logout
// Registro de cierre de sesión (el token se descarta del cliente).
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: 'CONTADOR_LOGOUT',
      modulo: 'portal-contador',
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({ success: true, message: 'Sesión cerrada.' })
  } catch {
    return NextResponse.json({ success: true, message: 'Sesión cerrada.' })
  }
}
