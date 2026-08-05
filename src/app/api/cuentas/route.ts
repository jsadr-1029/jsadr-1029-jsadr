import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

export async function GET() {
  try {
    const cuentas = await db.cuentaRecaudo.findMany({
      include: { _count: { select: { categorias: true, pagos: true } } },
      orderBy: { codigo: 'asc' },
    })
    return NextResponse.json({ success: true, data: cuentas })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { codigo, nombre, banco, tipoCuenta, numeroCuenta, titular, qrImagen } = body

    if (!codigo || !nombre) {
      return NextResponse.json({ success: false, error: 'Código y nombre son obligatorios' }, { status: 400 })
    }

    // === Validar tamaño del QR (máximo 5MB en base64) ===
    // El QR se almacena como data URL (data:image/png;base64,...).
    // 5MB en base64 ≈ 6.7M caracteres. Limitamos para no saturar la BD.
    if (qrImagen && typeof qrImagen === 'string' && qrImagen.length > 7_000_000) {
      return NextResponse.json(
        { success: false, error: 'La imagen QR es demasiado grande (máximo 5MB). Usa una imagen más pequeña.' },
        { status: 400 }
      )
    }

    const cuenta = await db.cuentaRecaudo.create({
      data: {
        codigo,
        nombre,
        banco,
        tipoCuenta,
        numeroCuenta,
        titular,
        // Guardar el QR solo si es un data URL válido
        qrImagen: (qrImagen && typeof qrImagen === 'string' && qrImagen.startsWith('data:image/'))
          ? qrImagen
          : null,
      },
    })
    return NextResponse.json({ success: true, data: cuenta })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...datos } = body
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    // === Validar tamaño del QR si viene en la actualización ===
    if (datos.qrImagen && typeof datos.qrImagen === 'string' && datos.qrImagen.length > 7_000_000) {
      return NextResponse.json(
        { success: false, error: 'La imagen QR es demasiado grande (máximo 5MB). Usa una imagen más pequeña.' },
        { status: 400 }
      )
    }

    // Si qrImagen es string vacío o null, lo guardamos como null (limpiar QR)
    if ('qrImagen' in datos) {
      if (datos.qrImagen === '' || datos.qrImagen === null) {
        datos.qrImagen = null
      } else if (typeof datos.qrImagen === 'string' && !datos.qrImagen.startsWith('data:image/')) {
        // No es un data URL válido → no actualizar
        delete datos.qrImagen
      }
    }

    const actualizado = await db.cuentaRecaudo.update({ where: { id }, data: datos })
    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
