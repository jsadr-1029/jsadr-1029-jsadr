// =====================================================
// 🕰️ /api/linea-tiempo/cartera
// =====================================================
// Reconstruye el estado de TODA la cartera "as of fecha T".
//
// Query params:
//   fecha=YYYY-MM-DD  → fecha histórica (default: hoy)
//
// Auth: ADMIN | GESTOR | CONSULTOR
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { reconstruirCarteraHastaFecha } from '@/lib/prestamo-historico'
import { inicioDiaColombia } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const url = new URL(req.url)
    const fechaParam = url.searchParams.get('fecha')

    let fechaCorte: Date
    if (fechaParam) {
      // YYYY-MM-DD → inicio de día Colombia
      const [y, m, d] = fechaParam.split('-').map(Number)
      fechaCorte = inicioDiaColombia(new Date(y, m - 1, d, 12, 0, 0))
    } else {
      fechaCorte = new Date()
    }

    const cartera = await reconstruirCarteraHastaFecha(fechaCorte)

    return NextResponse.json({
      success: true,
      modo: cartera.fechaCorte.toDateString() === new Date().toDateString() ? 'PRESENTE' : 'HISTORICO',
      ...cartera,
    })
  } catch (error: any) {
    console.error('[linea-tiempo/cartera] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}
