// =====================================================
// 🕰️ /api/linea-tiempo/comparar
// =====================================================
// Compara la cartera en dos fechas: A vs B.
// Incluye desglose detallado del origen del cambio:
//   - nuevos desembolsos
//   - pagos recibidos
//   - créditos cancelados (con detalle)
//   - créditos que pasaron a excedidos (con detalle)
//
// Query params:
//   fechaA=YYYY-MM-DD  (obligatorio)
//   fechaB=YYYY-MM-DD  (obligatorio)
//
// Auth: ADMIN | GESTOR | CONSULTOR
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { compararCarteraEntreFechas } from '@/lib/prestamo-historico'
import { inicioDiaColombia } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseFecha(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return inicioDiaColombia(new Date(y, m - 1, d, 12, 0, 0))
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const url = new URL(req.url)
    const fechaAStr = url.searchParams.get('fechaA')
    const fechaBStr = url.searchParams.get('fechaB')

    if (!fechaAStr || !fechaBStr) {
      return NextResponse.json(
        { success: false, error: 'Se requieren fechaA y fechaB (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const fechaA = parseFecha(fechaAStr)
    const fechaB = parseFecha(fechaBStr)

    if (fechaA > fechaB) {
      return NextResponse.json(
        { success: false, error: 'fechaA debe ser anterior a fechaB' },
        { status: 400 }
      )
    }

    const comparacion = await compararCarteraEntreFechas(fechaA, fechaB)

    return NextResponse.json({
      success: true,
      ...comparacion,
    })
  } catch (error: any) {
    console.error('[linea-tiempo/comparar] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}
