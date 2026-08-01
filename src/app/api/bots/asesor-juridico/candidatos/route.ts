// /api/bots/asesor-juridico/candidatos — Candidatos a cobro jurídico
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerEstadoModuloJuridico } from '@/lib/asesor-juridico'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const estado = await obtenerEstadoModuloJuridico()
    return NextResponse.json({ success: true, data: estado.candidatosJuridico })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
