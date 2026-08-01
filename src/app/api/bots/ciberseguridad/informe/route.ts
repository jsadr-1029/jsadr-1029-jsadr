// /api/bots/ciberseguridad/informe — Informe completo de seguridad
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { generarInformeSeguridad } from '@/lib/ciberseguridad'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const texto = await generarInformeSeguridad()
    return NextResponse.json({ success: true, data: { texto } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
