// =====================================================
// 🕰️ /api/linea-tiempo/fotografias
// =====================================================
// Guarda y lista fotografías históricas inmutables de la cartera.
//
// POST  { fechaCorte, nombre, descripcion? }  → genera snapshot y lo persiste
// GET                                            → lista todos los snapshots
//
// Auth: ADMIN
// =====================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { reconstruirCarteraHastaFecha } from '@/lib/prestamo-historico'
import { inicioDiaColombia } from '@/lib/timezone'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

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
    const fotos = await db.fotografiaCartera.findMany({
      orderBy: { fechaCorte: 'desc' },
      take: 100,
    })
    return NextResponse.json({ success: true, fotografias: fotos })
  } catch (error: any) {
    console.error('[fotografias GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { fecha, nombre, descripcion } = body as { fecha: string; nombre: string; descripcion?: string }

    if (!fecha || !nombre) {
      return NextResponse.json(
        { success: false, error: 'Se requieren fecha y nombre' },
        { status: 400 }
      )
    }

    const fechaCorte = parseFecha(fecha)
    const cartera = await reconstruirCarteraHastaFecha(fechaCorte)

    // Detalle compacto en JSON (sin notas ni metadatos pesados)
    const detalleCompacto = cartera.prestamos.map(p => ({
      id: p.id,
      codigo: p.codigo,
      cliente: p.clienteNombre,
      estado: p.estadoHistorico,
      saldo: p.saldoTotalHistorico,
      pagado: p.montoPagadoHistorico,
      dias: p.diasTranscurridos,
      plazo: p.plazoTotalDias,
      estadoPlazo: p.estadoPlazo,
    }))

    const foto = await db.fotografiaCartera.create({
      data: {
        fechaCorte,
        nombre,
        descripcion: descripcion || null,
        usuarioId: (auth as any).userId || null,
        usuarioNombre: (auth as any).nombre || (auth as any).username || null,
        totalPrestamos: cartera.totalPrestamosExistentes,
        creditosActivos: cartera.creditosActivos,
        creditosDentroPlazo: cartera.creditosDentroPlazo,
        creditosPlazoCumplido: cartera.creditosPlazoCumplido,
        creditosExcedidos: cartera.creditosExcedidos,
        creditosCancelados: cartera.creditosCancelados,
        creditosEnMora: cartera.creditosEnMora,
        creditosJuridico: cartera.creditosJuridico,
        carteraPendiente: cartera.carteraPendiente,
        carteraActiva: cartera.carteraActiva,
        carteraMora: cartera.carteraMora,
        capitalPrestado: cartera.capitalPrestado,
        dineroRecuperado: cartera.dineroRecuperado,
        detalleJSON: JSON.stringify(detalleCompacto),
      },
    })

    return NextResponse.json({
      success: true,
      fotografia: foto,
      resumen: {
        totalPrestamos: foto.totalPrestamos,
        creditosActivos: foto.creditosActivos,
        carteraPendiente: foto.carteraPendiente,
      },
    })
  } catch (error: any) {
    console.error('[fotografias POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    )
  }
}
