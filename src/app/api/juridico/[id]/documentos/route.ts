import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// POST - agregar documento al caso
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { tipo, nombre, descripcion, contenido } = body

    if (!nombre || !tipo) {
      return NextResponse.json(
        { success: false, error: 'nombre y tipo son obligatorios' },
        { status: 400 }
      )
    }

    const documento = await db.documentoLegal.create({
      data: {
        casoId: id,
        tipo,
        nombre,
        descripcion: descripcion || null,
        contenido: contenido || null,
      },
    })

    return NextResponse.json({ success: true, data: documento })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
