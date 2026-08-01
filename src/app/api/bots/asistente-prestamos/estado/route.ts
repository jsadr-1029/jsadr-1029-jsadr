// /api/bots/asistente-prestamos/estado — Estado completo del módulo
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerEstadoModuloPrestamos, generarDashboardEjecutivo } from '@/lib/asistente-prestamos'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato') // 'json' (default) | 'texto'

    if (formato === 'texto') {
      const texto = await generarDashboardEjecutivo()
      return NextResponse.json({ success: true, data: { texto } })
    }

    const estado = await obtenerEstadoModuloPrestamos()
    return NextResponse.json({ success: true, data: estado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
