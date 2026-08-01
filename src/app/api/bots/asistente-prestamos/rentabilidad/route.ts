// /api/bots/asistente-prestamos/rentabilidad — Análisis de rentabilidad
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { generarAnalisisRentabilidad } from '@/lib/asistente-prestamos'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const texto = await generarAnalisisRentabilidad()
    return NextResponse.json({ success: true, data: { texto } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
