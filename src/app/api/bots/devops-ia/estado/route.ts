// /api/bots/devops-ia/estado — Estado completo del sistema en tiempo real
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { auditarSistema, generarEstadoSistema } from '@/lib/devops-ia'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato')

    if (formato === 'texto') {
      const texto = await generarEstadoSistema()
      return NextResponse.json({ success: true, data: { texto } })
    }

    const estado = await auditarSistema()
    return NextResponse.json({ success: true, data: estado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
