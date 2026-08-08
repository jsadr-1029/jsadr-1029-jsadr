import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { setAgentePausado, estaAgentePausado } from '@/lib/hub-ia/security-gateway'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'

// POST — pausa o reanuda el agente IA
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const pausar = !!body.pausar
    await setAgentePausado(pausar, user.nombre)

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: pausar ? 'IA_AGENTE_PAUSADO' : 'IA_AGENTE_REANUDADO',
      modulo: 'hub-ia',
      entidadNombre: pausar ? 'Agente IA pausado' : 'Agente IA reanudado',
      detalles: JSON.stringify({ pausar }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    const pausado = await estaAgentePausado()
    return NextResponse.json({ success: true, data: { pausado } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
