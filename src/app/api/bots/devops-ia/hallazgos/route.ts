// /api/bots/devops-ia/hallazgos — Hallazgos de configuración
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { auditarSistema } from '@/lib/devops-ia'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const estado = await auditarSistema()
    return NextResponse.json({
      success: true,
      data: {
        marcaTemporal: estado.marcaTemporal,
        resumen: estado.resumen,
        hallazgos: estado.hallazgos,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
