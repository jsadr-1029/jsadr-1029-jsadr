// /api/bots/asistente-personal/dashboard — KPIs del Personal CFO
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { obtenerDashboard } from '@/lib/asistente-personal'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const ambito = (searchParams.get('ambito') || 'AMBOS') as 'NEGOCIO' | 'PERSONAL' | 'AMBOS'
    const dias = parseInt(searchParams.get('dias') || '30', 10)

    const dashboard = await obtenerDashboard(ambito, dias)
    return NextResponse.json({ success: true, data: dashboard })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
