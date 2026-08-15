// =====================================================
// 🕰️ /api/linea-tiempo/prestamo/[id]
// =====================================================
// Reconstruye la vida de un crédito "as of fecha T":
//   - estado histórico, saldos, días transcurridos
//   - línea de tiempo de eventos (pagos, gestiones, etc.)
//
// Query params:
//   fecha=YYYY-MM-DD  → fecha histórica (default: hoy)
//
// Auth: ADMIN | GESTOR | CONSULTOR
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import {
  reconstruirPrestamoHastaFecha,
  obtenerEventosPrestamo,
  encontrarPrimerCambio,
} from '@/lib/prestamo-historico'
import { inicioDiaColombia } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const url = new URL(req.url)
    const fechaParam = url.searchParams.get('fecha')

    let fechaCorte: Date
    if (fechaParam) {
      const [y, m, d] = fechaParam.split('-').map(Number)
      fechaCorte = inicioDiaColombia(new Date(y, m - 1, d, 12, 0, 0))
    } else {
      fechaCorte = new Date()
    }

    const [prestamoHistorico, eventos, primerCambio] = await Promise.all([
      reconstruirPrestamoHastaFecha(id, fechaCorte),
      obtenerEventosPrestamo(id, fechaCorte),
      encontrarPrimerCambio(id),
    ])

    if (!prestamoHistorico) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      fechaCorte,
      modo: fechaCorte.toDateString() === new Date().toDateString() ? 'PRESENTE' : 'HISTORICO',
      prestamo: prestamoHistorico,
      eventos,
      primerCambio,
    })
  } catch (error: any) {
    console.error('[linea-tiempo/prestamo] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}
