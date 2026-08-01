import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Verificar cédula y devolver info mínima (si tiene PIN)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula } = body
    if (!cedula) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 })

    const cliente = await db.cliente.findUnique({
      where: { cedula },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        pinHash: true,
        pinBloqueadoHasta: true,
        telefono: true,
        activo: true,
      },
    })

    // Registrar acceso
    await db.accesoPortal.create({
      data: {
        clienteId: cliente?.id || null,
        clienteCedula: cedula,
        clienteNombre: cliente?.nombre || null,
        ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
        accion: 'VERIFICAR_CEDULA',
        exito: !!cliente,
        detalle: cliente ? (cliente.pinHash ? 'Cliente con PIN' : 'Cliente sin PIN') : 'Cliente no encontrado',
      },
    })

    if (!cliente) {
      // Por seguridad, no revelar si la cédula existe
      return NextResponse.json({ error: 'Cédula no encontrada. Verifica e intenta nuevamente.' }, { status: 404 })
    }
    if (!cliente.activo) {
      return NextResponse.json({ error: 'Tu cuenta está inactiva. Contacta al administrador.' }, { status: 403 })
    }
    if (cliente.pinBloqueadoHasta && new Date(cliente.pinBloqueadoHasta) > new Date()) {
      return NextResponse.json({ error: 'Tu cuenta está bloqueada temporalmente. Intenta más tarde.' }, { status: 403 })
    }

    return NextResponse.json({
      clienteId: cliente.id,
      nombre: cliente.nombre,
      tienePin: !!cliente.pinHash,
      telefono: cliente.telefono.slice(0, -4) + '****', // mask
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
