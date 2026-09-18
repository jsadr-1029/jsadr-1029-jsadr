import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verificarRegistro } from '@/lib/webauthn'
import { sanitizeError } from '@/lib/error-handler'

// POST /api/portal/webauthn/register/finish
// Completa el registro de una passkey verificando la respuesta del autenticador
// Requiere sesión activa del portal
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido', code: 'TOKEN_REQUERIDO' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
      select: { id: true, tokenExpira: true, nombre: true },
    })

    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', code: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { response } = body

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Respuesta del autenticador requerida' },
        { status: 400 }
      )
    }

    const userAgent = req.headers.get('user-agent')
    const resultado = await verificarRegistro(cliente.id, response, userAgent)

    return NextResponse.json({
      success: true,
      data: resultado,
      mensaje: '¡Acceso biométrico activado correctamente! Ya puedes iniciar sesión con tu huella o Face ID.',
    })
  } catch (error: any) {
    console.error('[webauthn/register/finish] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
