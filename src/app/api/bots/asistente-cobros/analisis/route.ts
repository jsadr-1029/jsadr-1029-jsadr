// /api/bots/asistente-cobros/analisis — Análisis estratégico en texto
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { generarResumenEjecutivo, generarAnalisisEstrategico } from '@/lib/asistente-cobros'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || 'resumen' // resumen | analisis

    const texto = tipo === 'analisis'
      ? await generarAnalisisEstrategico()
      : await generarResumenEjecutivo()

    return NextResponse.json({ success: true, data: { texto } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
