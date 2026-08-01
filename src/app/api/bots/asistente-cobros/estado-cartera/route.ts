// /api/bots/asistente-cobros/estado-cartera — Visión 360° de la cartera
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerEstadoCartera } from '@/lib/asistente-cobros'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const estado = await obtenerEstadoCartera()
    return NextResponse.json({ success: true, data: estado })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
