import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

export async function GET() {
  try {
    const categorias = await db.categoriaCliente.findMany({
      include: { cuentaRecaudo: true, _count: { select: { clientes: true } } },
      orderBy: { codigo: 'asc' },
    })
    return NextResponse.json({ success: true, data: categorias })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { codigo, nombre, montoMinimo, montoMaximo, tasaInteresAnual, tasaMoraAnual, descripcion, cuentaRecaudoId } = body

    if (!codigo || !nombre) {
      return NextResponse.json({ success: false, error: 'Código y nombre son obligatorios' }, { status: 400 })
    }

    const categoria = await db.categoriaCliente.create({
      data: {
        codigo,
        nombre,
        montoMinimo: parseFloat(montoMinimo) || 0,
        montoMaximo: parseFloat(montoMaximo) || 0,
        tasaInteresAnual: parseFloat(tasaInteresAnual) || 0,
        tasaMoraAnual: parseFloat(tasaMoraAnual) || 0,
        descripcion: descripcion || null,
        cuentaRecaudoId: cuentaRecaudoId || null,
      },
    })
    return NextResponse.json({ success: true, data: categoria })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...datos } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const actualizado = await db.categoriaCliente.update({
      where: { id },
      data: {
        ...datos,
        montoMinimo: datos.montoMinimo !== undefined ? parseFloat(datos.montoMinimo) : undefined,
        montoMaximo: datos.montoMaximo !== undefined ? parseFloat(datos.montoMaximo) : undefined,
        tasaInteresAnual: datos.tasaInteresAnual !== undefined ? parseFloat(datos.tasaInteresAnual) : undefined,
        tasaMoraAnual: datos.tasaMoraAnual !== undefined ? parseFloat(datos.tasaMoraAnual) : undefined,
      },
    })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
