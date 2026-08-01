// /api/bots/asesor-juridico/estado — Estado completo del módulo jurídico
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerEstadoModuloJuridico, generarResumenJuridico } from '@/lib/asesor-juridico'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato')

    if (formato === 'texto') {
      const texto = await generarResumenJuridico()
      return NextResponse.json({ success: true, data: { texto } })
    }

    const estado = await obtenerEstadoModuloJuridico()
    return NextResponse.json({ success: true, data: estado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
