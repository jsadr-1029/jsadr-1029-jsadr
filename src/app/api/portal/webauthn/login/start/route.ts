import { NextRequest, NextResponse } from 'next/server'
import { generarOpcionesAutenticacion } from '@/lib/webauthn'
import { sanitizeError } from '@/lib/error-handler'

// POST /api/portal/webauthn/login/start
// Inicia el flujo de autenticación biométrica
// Opcionalmente recibe cedula para identificar al cliente y filtrar passkeys
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { cedula } = body

    let clienteId: string | undefined

    if (cedula) {
      // Buscar cliente por cédula y obtener sus passkeys
      const { db } = await import('@/lib/db')
      const cliente = await db.cliente.findFirst({
        where: { cedula: cedula.trim(), activo: true },
        select: { id: true },
      })
      if (cliente) {
        clienteId = cliente.id
      }
    }

    const options = await generarOpcionesAutenticacion(clienteId)

    return NextResponse.json({ success: true, options, clienteId })
  } catch (error: any) {
    console.error('[webauthn/login/start] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
