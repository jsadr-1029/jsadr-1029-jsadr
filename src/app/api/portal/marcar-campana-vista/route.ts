import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// POST /api/portal/marcar-campana-vista
// Body: { cedula: string, campañaId: string }
// Marca una campaña como vista por el cliente.
//
// Simplificado: solo usa CampañaVista (modelo que SÍ existe en schema).
// La rama con CampañaCliente fue removida porque ese modelo no existe.
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, campañaId } = body

    if (!cedula || !campañaId) {
      return NextResponse.json(
        { success: false, error: 'cedula y campañaId son obligatorios' },
        { status: 400 }
      )
    }

    // Buscar cliente por cédula
    const cliente = await db.cliente.findUnique({ where: { cedula: String(cedula).trim() } })
    if (!cliente) {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Buscar la campaña
    const campaña = await db.campaña.findUnique({ where: { id: campañaId } })
    if (!campaña) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    // Crear registro en CampañaVista si no existe (idempotente)
    const existente = await db.campañaVista.findFirst({
      where: { campañaId, clienteId: cliente.id }
    })
    if (!existente) {
      await db.campañaVista.create({
        data: { campañaId, clienteId: cliente.id }
      })
    }

    return NextResponse.json({ success: true, mensaje: 'Campaña marcada como vista' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
