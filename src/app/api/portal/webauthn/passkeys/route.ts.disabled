import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listarPasskeys, eliminarPasskey, renombrarPasskey, tienePasskeys } from '@/lib/webauthn'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal/webauthn/passkeys
// Lista las passkeys del cliente autenticado
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    const passkeys = await listarPasskeys(cliente.id)
    const hasPasskeys = passkeys.length > 0

    return NextResponse.json({ success: true, data: passkeys, hasPasskeys })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// DELETE /api/portal/webauthn/passkeys?id=<passkeyId>
// Desactiva una passkey
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const passkeyId = searchParams.get('id')

    if (!passkeyId) {
      return NextResponse.json(
        { success: false, error: 'ID de passkey requerido' },
        { status: 400 }
      )
    }

    // Verificar que no sea la última passkey activa
    const hasOtherPasskeys = await tienePasskeys(cliente.id)
    if (!hasOtherPasskeys) {
      return NextResponse.json(
        { success: false, error: 'No puedes eliminar tu única passkey. Necesitas al menos un método de acceso.' },
        { status: 400 }
      )
    }

    await eliminarPasskey(cliente.id, passkeyId)

    return NextResponse.json({
      success: true,
      mensaje: 'Passkey eliminada correctamente',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH /api/portal/webauthn/passkeys
// Renombra una passkey
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { passkeyId, nickname } = body

    if (!passkeyId || !nickname) {
      return NextResponse.json(
        { success: false, error: 'passkeyId y nickname requeridos' },
        { status: 400 }
      )
    }

    await renombrarPasskey(cliente.id, passkeyId, nickname)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
