import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar campañas activas
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const soloActivas = searchParams.get('activas') !== 'false'
    // === Incluir clientes seleccionados (para mostrar en la UI del admin) ===
    const incluirClientes = searchParams.get('conClientes') === 'true'

    const campanas = await db.campaña.findMany({
      where: soloActivas ? { activa: true } : {},
      include: {
        _count: { select: { vistas: true } },
        ...(incluirClientes ? {
          clientesSeleccionados: {
            include: {
              cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true } }
            }
          }
        } : {})
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: campanas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - crear campaña
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { titulo, descripcion, contenido, imagenUrl, tipo, fechaInicio, fechaFin, destinatarios, enviarWhatsapp, clienteIds } = body

    if (!titulo || !descripcion) {
      return NextResponse.json({ success: false, error: 'Título y descripción son obligatorios' }, { status: 400 })
    }

    // === Validar clienteIds si destinatarios = 'SELECCIONADOS' ===
    const esSeleccionados = (destinatarios || 'TODOS') === 'SELECCIONADOS'
    if (esSeleccionados && (!clienteIds || !Array.isArray(clienteIds) || clienteIds.length === 0)) {
      return NextResponse.json({
        success: false,
        error: 'Cuando destinatarios = "SELECCIONADOS", debes indicar al menos un cliente.',
      }, { status: 400 })
    }

    // === Crear campaña + asignaciones a clientes en una transacción atómica ===
    const campana = await db.$transaction(async (tx) => {
      const nueva = await tx.campaña.create({
        data: {
          titulo,
          descripcion,
          contenido: contenido || null,
          imagenUrl: imagenUrl || null,
          tipo: tipo || 'INFORMATIVO',
          fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
          fechaFin: fechaFin ? new Date(fechaFin) : null,
          destinatarios: destinatarios || 'TODOS',
        },
      })
      // === Si destinatarios = SELECCIONADOS, crear las asignaciones a clientes ===
      if (esSeleccionados && clienteIds && clienteIds.length > 0) {
        await tx.campañaCliente.createMany({
          data: clienteIds.map((clienteId: string) => ({
            campañaId: nueva.id,
            clienteId,
          })),
          skipDuplicates: true,
        })
      }
      return nueva
    })

    // Si se solicita enviar por WhatsApp — solo a los clientes destinatarios
    if (enviarWhatsapp) {
      const { enviarWhatsApp, mensajeCampaña, guardarNotificacion } = await import('@/lib/whatsapp')
      // Determinar a qué clientes enviar:
      // - Si destinatarios = 'TODOS': a todos los clientes.
      // - Si destinatarios = 'SELECCIONADOS': solo a los clienteIds.
      let clientesDestinatarios: any[] = []
      if (esSeleccionados && clienteIds && clienteIds.length > 0) {
        clientesDestinatarios = await db.cliente.findMany({
          where: { id: { in: clienteIds } },
        })
      } else {
        clientesDestinatarios = await db.cliente.findMany()
      }
      let enviadas = 0
      for (const cliente of clientesDestinatarios) {
        const mensaje = mensajeCampaña({
          titulo,
          descripcion,
          contenido: contenido?.slice(0, 200),
        })
        const envio = await enviarWhatsApp(cliente.telefono, mensaje)
        await guardarNotificacion({
          db,
          telefono: cliente.telefono,
          tipo: 'CAMPANA',
          mensaje,
          envio,
        })
        if (envio.exito) enviadas++
      }
      return NextResponse.json({
        success: true,
        data: campana,
        whatsappEnviados: enviadas,
        totalClientes: clientesDestinatarios.length,
      })
    }

    return NextResponse.json({ success: true, data: campana })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// PATCH - actualizar / desactivar campaña
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { id, activa, clienteIds, ...datos } = body
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    // === Actualizar campaña y, si vienen clienteIds, reemplazar las asignaciones ===
    const actualizado = await db.$transaction(async (tx) => {
      const camp = await tx.campaña.update({
        where: { id },
        data: { ...datos, activa: activa !== undefined ? activa : undefined },
      })
      // === Si vienen clienteIds, reemplazar las asignaciones de clientes ===
      if (clienteIds !== undefined && Array.isArray(clienteIds)) {
        // Eliminar las asignaciones previas
        await tx.campañaCliente.deleteMany({ where: { campañaId: id } })
        // Crear las nuevas asignaciones
        if (clienteIds.length > 0) {
          await tx.campañaCliente.createMany({
            data: clienteIds.map((clienteId: string) => ({
              campañaId: id,
              clienteId,
            })),
            skipDuplicates: true,
          })
        }
      }
      return camp
    })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// DELETE - eliminar campaña
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    await db.campaña.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
