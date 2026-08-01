import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// GET - detalle de un caso jurídico
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const caso = await db.casoJuridico.findUnique({
      where: { id },
      include: {
        prestamo: { include: { cliente: true, pagos: true } },
        cronologias: { orderBy: { fecha: 'desc' } },
        documentos: { orderBy: { fechaSubida: 'desc' } },
        alertas: { orderBy: { fechaAlerta: 'asc' } },
      },
    })

    if (!caso) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: caso })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH - actualizar caso (cambiar estado, asignar abogado, cerrar, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      estado,
      abogadoNombre,
      abogadoTelefono,
      abogadoEmail,
      honorarios,
      juzgado,
      radicado,
      descripcion,
      fechaCierre,
    } = body

    const casoExistente = await db.casoJuridico.findUnique({ where: { id } })
    if (!casoExistente) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    const datosActualizacion: any = {}
    if (estado) datosActualizacion.estado = estado
    if (abogadoNombre !== undefined) datosActualizacion.abogadoNombre = abogadoNombre || null
    if (abogadoTelefono !== undefined) datosActualizacion.abogadoTelefono = abogadoTelefono || null
    if (abogadoEmail !== undefined) datosActualizacion.abogadoEmail = abogadoEmail || null
    if (honorarios !== undefined) datosActualizacion.honorarios = parseFloat(honorarios) || 0
    if (juzgado !== undefined) datosActualizacion.juzgado = juzgado || null
    if (radicado !== undefined) datosActualizacion.radicado = radicado || null
    if (descripcion !== undefined) datosActualizacion.descripcion = descripcion || null
    if (fechaCierre || estado === 'CERRADO') {
      datosActualizacion.fechaCierre = fechaCierre ? new Date(fechaCierre) : new Date()
    }

    const caso = await db.casoJuridico.update({
      where: { id },
      data: datosActualizacion,
      include: { prestamo: { include: { cliente: true } } },
    })

    // Si se cierra el caso, actualizar préstamo
    if (estado === 'CERRADO') {
      await db.prestamo.update({
        where: { id: caso.prestamoId },
        data: { estado: 'CANCELADO' },
      })
    }

    return NextResponse.json({ success: true, data: caso })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
