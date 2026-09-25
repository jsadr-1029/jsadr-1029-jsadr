// /api/bots/asistente-personal/alertas — Detección y listado de alertas
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { detectarAlertas } from '@/lib/asistente-personal'
import { sanitizeError } from '@/lib/error-handler'

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const ambito = (searchParams.get('ambito') || 'AMBOS') as 'NEGOCIO' | 'PERSONAL' | 'AMBOS'
    const detectar = searchParams.get('detectar') === 'true'

    // Si pide detectar, ejecutar detección
    let alertasNuevas: any[] = []
    if (detectar) {
      alertasNuevas = await detectarAlertas(ambito)
    }

    // Listar alertas recientes (últimas 24h)
    const hace24h = new Date()
    hace24h.setHours(hace24h.getHours() - 24)

    const alertas = await db.alertaFinanciera.findMany({
      where: {
        createdAt: { gte: hace24h },
        ...(ambito !== 'AMBOS' && { ambito }),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: alertas,
      nuevas: alertasNuevas.length,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
