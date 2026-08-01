import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { obtenerIp, obtenerUserAgent } from '@/lib/otp'

// POST /api/portal/firmar
// Inicia el flujo de firma para un préstamo desde el portal del cliente.
//
// Fixes aplicados:
//  - db.firma → db.firmaElectronica
//  - Eliminado import implícito de tipos inexistentes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prestamoId, token } = body

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    }
    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { firmas: true },
    })
    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }
    if (prestamo.clienteId !== cliente.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (prestamo.tycAceptado) {
      return NextResponse.json({ error: 'Los TyC ya fueron firmados' }, { status: 400 })
    }

    // Buscar o crear firma usando firmaElectronica
    let firma = prestamo.firmas.find((f) => f.tipo === 'TYC')
    if (!firma) {
      // imagenFirma es required en schema — usamos un placeholder vacío
      // que se reemplazará cuando el cliente dibuje su firma
      firma = await db.firmaElectronica.create({
        data: {
          prestamoId,
          clienteId: cliente.id,
          tipo: 'TYC',
          imagenFirma: '',  // se completa al guardar la firma dibujada
          estadoFirma: 'PENDIENTE',
        },
      })
    }

    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: obtenerIp(req),
        userAgent: obtenerUserAgent(req),
        accion: 'FIRMA_INICIADA',
        exito: true,
        detalle: `Inicio firma TyC préstamo ${prestamo.codigo}`,
        prestamoId,
      },
    })

    return NextResponse.json({
      firmaId: firma.id,
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        montoPrincipal: Number(prestamo.montoPrincipal),
        montoCuota: Number(prestamo.montoCuota),
        numeroCuotas: prestamo.numeroCuotas,
        totalPagar: Number(prestamo.totalPagar),
        plazoMeses: prestamo.plazoMeses,
        frecuencia: prestamo.frecuencia,
        tasaInteresMensual: Number(prestamo.tasaInteresMensual),
      },
    })
  } catch (e) {
    console.error('[portal/firmar] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
