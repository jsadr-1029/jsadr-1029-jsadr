import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// POST - crear alerta legal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { tipo, descripcion, fechaAlerta } = body

    if (!descripcion || !fechaAlerta) {
      return NextResponse.json(
        { success: false, error: 'descripción y fechaAlerta son obligatorios' },
        { status: 400 }
      )
    }

    const alerta = await db.alertaLegal.create({
      data: {
        casoId: id,
        tipo: tipo || 'SEGUIMIENTO',
        descripcion,
        fechaAlerta: new Date(fechaAlerta),
      },
    })

    return NextResponse.json({ success: true, data: alerta })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH - marcar alerta como atendida
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { alertaId, atendida } = body

    const alerta = await db.alertaLegal.update({
      where: { id: alertaId },
      data: {
        atendida: atendida ?? true,
        fechaAtencion: atendida ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, data: alerta })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
