import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { setEstadoAgente, obtenerEstadoAgente, setAgentePausado, type EstadoAgente } from '@/lib/hub-ia/security-gateway'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

export const runtime = 'nodejs'

// POST — cambia el estado del agente IA (3 estados) o usa la API binaria legacy
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const clientInfo = getClientInfo(req)

    // Soporte para 3 estados: operativo | solo_consulta | bloqueado
    if (body.estado && ['operativo', 'solo_consulta', 'bloqueado'].includes(body.estado)) {
      const estado = body.estado as EstadoAgente
      await setEstadoAgente(estado, user.nombre)
      await registrarAuditLog({
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        accion: `IA_AGENTE_${estado.toUpperCase()}`,
        modulo: 'hub-ia',
        entidadNombre: `Agente IA en estado: ${estado}`,
        detalles: JSON.stringify({ estado, motivo: body.motivo || '' }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      const estadoActual = await obtenerEstadoAgente()
      return NextResponse.json({ success: true, data: { estado: estadoActual } })
    }

    // Legacy: API binaria (pausar: true/false) → mapear a 3 estados
    const pausar = !!body.pausar
    await setAgentePausado(pausar, user.nombre)
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: pausar ? 'IA_AGENTE_PAUSADO' : 'IA_AGENTE_REANUDADO',
      modulo: 'hub-ia',
      entidadNombre: pausar ? 'Agente IA pausado (solo consulta)' : 'Agente IA reanudado (operativo)',
      detalles: JSON.stringify({ pausar }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })
    const estado = await obtenerEstadoAgente()
    return NextResponse.json({ success: true, data: { estado, pausado: estado !== 'operativo' } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// GET — devuelve el estado actual del agente IA
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const estado = await obtenerEstadoAgente()
    return NextResponse.json({ success: true, data: { estado } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
