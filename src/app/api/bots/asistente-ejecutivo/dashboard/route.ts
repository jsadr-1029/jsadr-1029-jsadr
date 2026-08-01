// /api/bots/asistente-ejecutivo/dashboard — Dashboard consolidado
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerDashboardConsolidado, generarDashboardEjecutivoConsolidado } from '@/lib/asistente-ejecutivo'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato')

    if (formato === 'texto') {
      const texto = await generarDashboardEjecutivoConsolidado()
      return NextResponse.json({ success: true, data: { texto } })
    }

    const data = await obtenerDashboardConsolidado()
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
