import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// POST - agregar evento a cronología del caso
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { tipoEvento, titulo, descripcion, resultado, fecha } = body

    if (!titulo || !tipoEvento) {
      return NextResponse.json(
        { success: false, error: 'título y tipoEvento son obligatorios' },
        { status: 400 }
      )
    }

    const evento = await db.cronologiaCaso.create({
      data: {
        casoId: id,
        tipoEvento,
        titulo,
        descripcion: descripcion || null,
        resultado: resultado || null,
        fecha: fecha ? new Date(fecha) : new Date(),
      },
    })

    return NextResponse.json({ success: true, data: evento })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
