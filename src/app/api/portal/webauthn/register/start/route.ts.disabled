import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generarOpcionesRegistro } from '@/lib/webauthn'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal/webauthn/register/start
// Inicia el registro de una nueva passkey
// Requiere sesión activa del portal (token en x-portal-token)
export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get('x-portal-token') ||
      new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido', code: 'TOKEN_REQUERIDO' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token as string },
      select: { id: true, tokenExpira: true, nombre: true, cedula: true, email: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', code: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    const options = await generarOpcionesRegistro(cliente.id)

    return NextResponse.json({ success: true, options })
  } catch (error: any) {
    console.error('[webauthn/register/start] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
