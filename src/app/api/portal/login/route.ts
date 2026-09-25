import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/format'
import { getClientInfo } from '@/lib/security'

// =====================================================
// POST /api/portal/login
// Body:
//   { cedula: string }        — login por cédula (único método)
//   { clienteId: string }     — login por clienteId (legacy)
//
// Flujo (v2.0 — 2026-09-18):
//   1. Buscar cliente por cédula (o clienteId si se proporciona).
//   2. Si no existe → 404 (el cliente debe registrarse primero).
//   3. Si existe y está activo → generar token de sesión (2h).
//   4. Persistir tokenSesion en BD.
//   5. Registrar acceso en AccesoPortal.
//
// NOTA DE SEGURIDAD:
//   El login solo con cédula es deliberado. La seguridad del acceso al portal
//   del cliente se basa en el proceso de REGISTRO (que sigue exigiendo fotos
//   de cédula + selfie + verificación OTP por WhatsApp/email). Una vez
//   registrado, el cliente ingresa con solo su cédula. Esto es similar a
//   cómo funcionan apps como Rappi/Uber en Colombia donde el login es por
//   teléfono + OTP, pero aquí asumimos que la verificación ya ocurrió en
//   el registro.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cedula, clienteId } = body

    if (!cedula && !clienteId) {
      return NextResponse.json(
        { success: false, error: 'Cédula es requerida', codigo: 'CEDULA_REQUERIDA' },
        { status: 400 }
      )
    }

    // Buscar cliente por cédula (preferido) o clienteId (legacy)
    const cliente = cedula
      ? await db.cliente.findUnique({ where: { cedula: String(cedula).trim() } })
      : await db.cliente.findUnique({ where: { id: clienteId } })

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu cédula no está registrada. Si eres nuevo, regístrate primero.',
          codigo: 'NO_REGISTRADO',
        },
        { status: 404 }
      )
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva. Contacta al asesor.', codigo: 'CUENTA_INACTIVA' },
        { status: 403 }
      )
    }

    const clientInfo = getClientInfo(req)

    // Generar token de sesión (2h)
    const token = generateToken(32)
    const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000)

    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: token,
        tokenExpira,
        ultimoAccesoPortal: new Date(),
        pinIntentos: 0,
        pinBloqueadoHasta: null,
      },
    })

    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'LOGIN_CEDULA',
        exito: true,
        detalle: 'Sesión iniciada con cédula (sin PIN)',
      },
    })

    return NextResponse.json({
      success: true,
      token,
      clienteId: cliente.id,
      nombre: cliente.nombre,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
