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

    const campanas = await db.campaña.findMany({
      where: soloActivas ? { activa: true } : {},
      include: { _count: { select: { vistas: true } } },
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
    const { titulo, descripcion, contenido, imagenUrl, tipo, fechaInicio, fechaFin, destinatarios, enviarWhatsapp } = body

    if (!titulo || !descripcion) {
      return NextResponse.json({ success: false, error: 'Título y descripción son obligatorios' }, { status: 400 })
    }

    const campana = await db.campaña.create({
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

    // Si se solicita enviar por WhatsApp a todos los clientes
    if (enviarWhatsapp) {
      const { enviarWhatsApp, mensajeCampaña, guardarNotificacion } = await import('@/lib/whatsapp')
      const clientes = await db.cliente.findMany()
      let enviadas = 0
      for (const cliente of clientes) {
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
        totalClientes: clientes.length,
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
    const { id, activa, ...datos } = body
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    const actualizado = await db.campaña.update({
      where: { id },
      data: { ...datos, activa: activa !== undefined ? activa : undefined },
    })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// DELETE - eliminar campaña
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
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
