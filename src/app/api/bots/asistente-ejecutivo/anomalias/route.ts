// /api/bots/asistente-ejecutivo/anomalias — Anomalías y oportunidades
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { obtenerDashboardConsolidado } from '@/lib/asistente-ejecutivo'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const data = await obtenerDashboardConsolidado()
    return NextResponse.json({
      success: true,
      data: {
        anomalias: data.anomalias,
        oportunidades: data.oportunidades,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
