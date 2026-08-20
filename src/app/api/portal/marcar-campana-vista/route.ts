import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// POST /api/portal/marcar-campana-vista
// Body: { cedula: string, campañaId: string }
// Marca una campaña como vista por el cliente (para que el badge de
// notificación desaparezca y no se vuelva a notificar).
//
// Si la campaña es destinatarios='SELECCIONADOS', actualiza
// CampañaCliente.vistaEnPortal=true.
// Si la campaña es destinatarios='TODOS', crea un registro en
// CampañaVista (tabla existente) para que el conteo de "no vistas"
// la excluya.
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

    // === Marcar como vista según destinatarios ===
    if (campaña.destinatarios === 'SELECCIONADOS') {
      // Actualizar CampañaCliente.vistaEnPortal=true
      await db.campañaCliente.updateMany({
        where: { campañaId, clienteId: cliente.id },
        data: { vistaEnPortal: true, fechaVistaPortal: new Date() },
      })
    } else {
      // Para destinatarios='TODOS' u otros, crear registro en CampañaVista
      // (si no existe ya — idempotente).
      const existente = await db.campañaVista.findFirst({
        where: { campañaId, clienteId: cliente.id }
      })
      if (!existente) {
        await db.campañaVista.create({
          data: { campañaId, clienteId: cliente.id }
        })
      }
    }

    return NextResponse.json({ success: true, mensaje: 'Campaña marcada como vista' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
