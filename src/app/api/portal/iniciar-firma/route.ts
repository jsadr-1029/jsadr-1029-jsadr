import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

/**
 * POST /api/portal/iniciar-firma
 *
 * Genera un TokenFirma para que el cliente pueda firmar electrónicamente
 * un solicitud PENDIENTE_ACEPTACION desde el portal.
 *
 * Body: { prestamoId: string }
 * Header: x-portal-token: <token de sesión del cliente>
 *
 * Returns: { success: true, data: { token, linkFirma, firmaId } }
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token de sesión requerido' }, { status: 401 })
    }

    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json({ success: false, error: 'Sesión expirada' }, { status: 401 })
    }

    const body = await req.json()
    const { prestamoId } = body
    if (!prestamoId) {
      return NextResponse.json({ success: false, error: 'prestamoId requerido' }, { status: 400 })
    }

    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    })
    if (!prestamo) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrado' }, { status: 404 })
    }
    if (prestamo.clienteId !== cliente.id) {
      return NextResponse.json({ success: false, error: 'El solicitud no pertenece a este cliente' }, { status: 403 })
    }
    if (prestamo.estado !== 'PENDIENTE_ACEPTACION') {
      // FIX 2026-08-12: Verificar si hay una firma en progreso.
      // Si la hay, permitir continuar con el flujo (por ejemplo, si el solicitud
      // cambió de estado mientras la firma estaba en curso, o si el cliente
      // necesita reanudar una firma interrumpida).
      const firmaEnProgreso = await db.firmaElectronica.findFirst({
        where: {
          prestamoId: prestamo.id,
          estadoFirma: { in: ['PENDIENTE', 'FOTOS_SUBIDAS', 'FIRMA_DIBUJADA', 'OTP_ENVIADO'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!firmaEnProgreso) {
        return NextResponse.json({
          success: false,
          error: `El solicitud no está pendiente de aceptación (estado actual: ${prestamo.estado}). Solo se puede iniciar firma en solicitudes PENDIENTE_ACEPTACION, o que tengan una firma electrónica en progreso.`,
        }, { status: 400 })
      }
      // Hay firma en progreso — permitir continuar
    }

    // Si ya existe una firma PENDIENTE para este solicitud, reutilizarla
    const firmaExistente = await db.firmaElectronica.findFirst({
      where: {
        prestamoId: prestamo.id,
        estadoFirma: { in: ['PENDIENTE', 'FOTOS_SUBIDAS', 'FIRMA_DIBUJADA', 'OTP_ENVIADO'] },
      },
      include: { tokens: { where: { usado: false } } },
    })

    let firma: any
    let tokenFirma: any

    if (firmaExistente && firmaExistente.tokens.length > 0) {
      // Reutilizar firma existente y su token
      firma = firmaExistente
      tokenFirma = firmaExistente.tokens[0]
    } else {
      // Crear nueva firma + token
      firma = await db.firmaElectronica.create({
        data: {
          prestamoId: prestamo.id,
          clienteId: cliente.id,
          tipo: 'PAGARE',
          imagenFirma: '',
          otpCanal: 'AMBOS',
          estadoFirma: 'PENDIENTE',
          esFirmaCodeudor: false,
          firmanteRol: 'DEUDOR',
          firmanteNombre: cliente.nombre,
          firmanteCedula: cliente.cedula,
        },
      })

      const tokenCreado = crypto.randomBytes(32).toString('hex')
      const fechaExp = new Date()
      fechaExp.setDate(fechaExp.getDate() + 7)

      tokenFirma = await db.tokenFirma.create({
        data: {
          token: tokenCreado,
          firmaId: firma.id,
          prestamoId: prestamo.id,
          clienteId: cliente.id,
          fechaExpiracion: fechaExp,
        },
      })
    }

    // Construir URL absoluta
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co'
    const linkFirma = `${origin}/firma/${tokenFirma.token}`

    return NextResponse.json({
      success: true,
      data: {
        token: tokenFirma.token,
        firmaId: firma.id,
        linkFirma,
        expiracion: tokenFirma.fechaExpiracion,
      },
      mensaje: 'Token de firma generado. Redirigiendo al flujo de firma electrónica.',
    })
  } catch (error: any) {
    console.error('[portal/iniciar-firma] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al generar token de firma' },
      { status: 500 }
    )
  }
}
