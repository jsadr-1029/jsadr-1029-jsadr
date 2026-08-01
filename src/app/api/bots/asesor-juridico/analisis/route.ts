// /api/bots/asesor-juridico/analisis — Análisis jurídico de un caso
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { generarAnalisisCaso } from '@/lib/asesor-juridico'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const casoId = searchParams.get('casoId')

    if (!casoId) {
      return NextResponse.json(
        { success: false, error: 'casoId es obligatorio' },
        { status: 400 }
      )
    }

    const texto = await generarAnalisisCaso(casoId)
    if (!texto) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: { texto } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
