// =====================================================
// 🕰️ /api/linea-tiempo/cliente/[id]
// =====================================================
// Hoja de vida histórica del cliente: solicitudes, pagos,
// comportamiento, todos reconstruidos "as of fecha T".
//
// Query params:
//   fecha=YYYY-MM-DD  → fecha histórica (default: hoy)
//
// Auth: ADMIN | GESTOR | CONSULTOR
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { reconstruirPrestamoHastaFecha, obtenerEventosPrestamo } from '@/lib/prestamo-historico'
import { inicioDiaColombia } from '@/lib/timezone'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

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

    const cliente = await db.cliente.findUnique({
      where: { id },
      select: {
        id: true, nombre: true, cedula: true, telefono: true, email: true,
        departamento: true, municipio: true, ciudad: true, barrio: true,
        direccion: true, salario: true, fechaIngreso: true, notas: true,
        activo: true, createdAt: true,
        cuentaRecaudo: { select: { id: true, codigo: true, nombre: true, banco: true, tipoCuenta: true, numeroCuenta: true } },
        categoria: true,
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Cargar solicitudes del cliente
    const prestamos = await db.prestamo.findMany({
      where: { clienteId: id },
      orderBy: { fechaSolicitud: 'desc' },
      select: { id: true },
    })

    // Reconstruir cada solicitud "as of T"
    const prestamosHistoricos: any[] = []
    const eventosTodos: any[] = []

    for (const p of prestamos) {
      const [ph, eventos] = await Promise.all([
        reconstruirPrestamoHastaFecha(p.id, fechaCorte),
        obtenerEventosPrestamo(p.id, fechaCorte),
      ])
      if (ph && ph.existiaEnT) {
        prestamosHistoricos.push(ph)
        eventosTodos.push(...eventos)
      }
    }

    // Ordenar eventos globalmente por fecha desc
    eventosTodos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())

    // Estadísticas históricas
    let totalPrestadoHistorico = 0
    let totalPagadoHistorico = 0
    let saldoActualHistorico = 0
    let prestamosActivos = 0
    let prestamosCanceladosHistorico = 0
    let prestamosEnMora = 0
    let prestamosJuridico = 0

    for (const p of prestamosHistoricos) {
      totalPrestadoHistorico += p.montoPrincipal
      totalPagadoHistorico += p.montoPagadoHistorico
      saldoActualHistorico += p.saldoTotalHistorico

      if (p.estadoHistorico === 'CANCELADO') prestamosCanceladosHistorico++
      else if (p.estadoHistorico === 'EN_MORA') { prestamosEnMora++; prestamosActivos++ }
      else if (p.estadoHistorico === 'JURIDICO') { prestamosJuridico++; prestamosActivos++ }
      else if (['ACTIVO'].includes(p.estadoHistorico)) prestamosActivos++
    }

    // Comportamiento: pagos puntuales vs atrasados
    const pagosAplicados = eventosTodos.filter(e => e.tipo === 'PAGO')
    let puntuales = 0
    let atrasados = 0
    let totalDiasAtraso = 0
    for (const p of pagosAplicados) {
      const atraso = p.metadata?.atrasoDias || 0
      if (atraso === 0) puntuales++
      else { atrasados++; totalDiasAtraso += atraso }
    }
    const puntualidad = pagosAplicados.length > 0
      ? Math.round((puntuales / pagosAplicados.length) * 100)
      : 100
    const promedioDiasAtraso = atrasados > 0 ? Math.round(totalDiasAtraso / atrasados) : 0

    return NextResponse.json({
      success: true,
      fechaCorte,
      modo: fechaCorte.toDateString() === new Date().toDateString() ? 'PRESENTE' : 'HISTORICO',
      cliente,
      prestamos: prestamosHistoricos,
      eventos: eventosTodos.slice(0, 100),
      estadisticas: {
        totalPrestamos: prestamosHistoricos.length,
        totalPrestadoHistorico,
        totalPagadoHistorico,
        saldoActualHistorico,
        prestamosActivos,
        prestamosCanceladosHistorico,
        prestamosEnMora,
        prestamosJuridico,
        puntualidad,
        puntuales,
        atrasados,
        promedioDiasAtraso,
        tieneMoraActiva: prestamosEnMora > 0 || prestamosJuridico > 0,
      },
      comportamiento: {
        puntualidad,
        promedioDiasAtraso,
        nivelRiesgo: prestamosEnMora > 0 || prestamosJuridico > 0 ? 'ALTO' : puntualidad < 50 ? 'MEDIO' : 'BAJO',
      },
    })
  } catch (error: any) {
    console.error('[linea-tiempo/cliente] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}
