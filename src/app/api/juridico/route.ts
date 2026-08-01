import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enviarWhatsApp, mensajeAvisoLegal, guardarNotificacion } from '@/lib/whatsapp'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar casos jurídicos
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')

    const casos = await db.casoJuridico.findMany({
      where: estado && estado !== 'all' ? { estado } : {},
      include: {
        prestamo: { include: { cliente: true } },
        cronologias: { orderBy: { fecha: 'desc' }, take: 5 },
        documentos: { orderBy: { fechaSubida: 'desc' } },
        alertas: { orderBy: { fechaAlerta: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: casos })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// POST - crear caso jurídico (o derivar préstamo a jurídico)
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const {
      prestamoId,
      abogadoNombre,
      abogadoTelefono,
      abogadoEmail,
      honorarios,
      juzgado,
      radicado,
      descripcion,
      estado = 'PRE_JUDICIAL',
      enviarNotificacion = true,
    } = body

    if (!prestamoId) {
      return NextResponse.json(
        { success: false, error: 'prestamoId es obligatorio' },
        { status: 400 }
      )
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true, casoJuridico: true },
    })

    if (!prestamo) {
      return NextResponse.json(
        { success: false, error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    if (prestamo.casoJuridico) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un caso jurídico para este préstamo' },
        { status: 400 }
      )
    }

    const caso = await db.casoJuridico.create({
      data: {
        prestamoId,
        estado,
        abogadoNombre: abogadoNombre || null,
        abogadoTelefono: abogadoTelefono || null,
        abogadoEmail: abogadoEmail || null,
        honorarios: honorarios ? parseFloat(honorarios) : 0,
        juzgado: juzgado || null,
        radicado: radicado || null,
        descripcion: descripcion || null,
      },
      include: {
        prestamo: { include: { cliente: true } },
      },
    })

    // Actualizar estado del préstamo
    await db.prestamo.update({
      where: { id: prestamoId },
      data: { estado: 'JURIDICO' },
    })

    // Crear cronología inicial
    await db.cronologiaCaso.create({
      data: {
        casoId: caso.id,
        tipoEvento: 'NOTIFICACION',
        titulo: 'Apertura de caso jurídico',
        descripcion: descripcion || 'Caso derivado a cobro jurídico por incumplimiento de pago.',
        resultado: 'Caso abierto',
      },
    })

    // Enviar WhatsApp de aviso legal al cliente
    let whatsappResult: Awaited<ReturnType<typeof enviarWhatsApp>> | null = null
    if (enviarNotificacion && prestamo.cliente.telefono) {
      const mensaje = mensajeAvisoLegal({
        nombreCliente: prestamo.cliente.nombre,
        codigoPrestamo: prestamo.codigo,
        abogado: abogadoNombre || 'Por asignar',
        telefonoAbogado: abogadoTelefono || '—',
        saldoTotal: prestamo.saldoTotal,
      })
      whatsappResult = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)

      await guardarNotificacion({
        db,
        prestamoId,
        telefono: prestamo.cliente.telefono,
        tipo: 'LEGAL',
        mensaje,
        envio: whatsappResult,
      })
    }

    return NextResponse.json({
      success: true,
      data: caso,
      whatsapp: whatsappResult,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
