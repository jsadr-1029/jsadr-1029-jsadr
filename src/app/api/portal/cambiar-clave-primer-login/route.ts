import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/format'
import { getClientInfo } from '@/lib/security'

// =====================================================
// POST /api/portal/cambiar-clave-primer-login
// v4.13 — Cambio de clave obligatorio en el primer ingreso.
//
// Body:
//   { claveTempToken: string, nuevaClave: string, confirmarClave: string }
//
// Flujo:
//   1. Buscar al cliente por `claveTempToken`. Debe existir y no haber expirado.
//   2. Validar que `debeCambiarClave=true` (si no, se rechaza — este endpoint
//      no es para cambios voluntarios posteriores).
//   3. Validar que `nuevaClave` cumpla la política mínima (≥6 caracteres).
//   4. Hashear la nueva clave con bcrypt, persistirla en `claveHash`.
//   5. Apagar `debeCambiarClave=false` y limpiar `claveTempToken`.
//   6. Generar sesión completa (token + tokenExpira 8h) y devolverla para
//      que el frontend acceda directamente al portal sin re-login.
//   7. Registrar en AccesoPortal con accion='CAMBIO_CLAVE_PRIMER_LOGIN'.
// =====================================================

const MIN_LONGITUD_CLAVE = 6
const MAX_LONGITUD_CLAVE = 64
const SESSION_EXPIRY_HOURS = 8

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { claveTempToken, nuevaClave, confirmarClave } = body || {}

    // === Validaciones de entrada ===
    if (!claveTempToken || typeof claveTempToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token temporal requerido', codigo: 'TOKEN_REQUERIDO' },
        { status: 400 }
      )
    }
    if (!nuevaClave || typeof nuevaClave !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nueva clave requerida', codigo: 'CLAVE_REQUERIDA' },
        { status: 400 }
      )
    }
    if (nuevaClave.length < MIN_LONGITUD_CLAVE) {
      return NextResponse.json(
        {
          success: false,
          error: `La clave debe tener al menos ${MIN_LONGITUD_CLAVE} caracteres`,
          codigo: 'CLAVE_CORTA',
        },
        { status: 400 }
      )
    }
    if (nuevaClave.length > MAX_LONGITUD_CLAVE) {
      return NextResponse.json(
        {
          success: false,
          error: `La clave no puede tener más de ${MAX_LONGITUD_CLAVE} caracteres`,
          codigo: 'CLAVE_LARGA',
        },
        { status: 400 }
      )
    }
    if (nuevaClave !== confirmarClave) {
      return NextResponse.json(
        { success: false, error: 'Las claves no coinciden', codigo: 'CLAVE_NO_COINCIDE' },
        { status: 400 }
      )
    }

    // === Buscar cliente por claveTempToken ===
    const cliente = await db.cliente.findFirst({
      where: { claveTempToken },
    })

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token inválido o ya utilizado. Cierra sesión e inicia nuevamente.',
          codigo: 'TOKEN_INVALIDO',
        },
        { status: 401 }
      )
    }

    // Verificar expiración del token temporal
    if (!cliente.claveTempExpira || new Date(cliente.claveTempExpira) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'El token temporal ha expirado. Solicita un nuevo enlace de recuperación.',
          codigo: 'TOKEN_EXPIRADO',
        },
        { status: 401 }
      )
    }

    // Verificar que efectivamente debe cambiar la clave
    if (!cliente.debeCambiarClave) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu cuenta no requiere cambio de clave. Inicia sesión normalmente.',
          codigo: 'NO_REQUIERE_CAMBIO',
        },
        { status: 400 }
      )
    }

    // Verificar que la cuenta esté activa
    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva', codigo: 'CUENTA_INACTIVA' },
        { status: 403 }
      )
    }

    // === Verificar que la nueva clave no sea igual a la temporal actual ===
    // (el cliente no puede "cambiarla" por la misma clave temporal que ya tiene)
    if (cliente.claveHash && bcrypt.compareSync(nuevaClave, cliente.claveHash)) {
      return NextResponse.json(
        {
          success: false,
          error: 'La nueva clave no puede ser igual a la clave temporal. Elige una clave diferente.',
          codigo: 'CLAVE_IGUAL_TEMPORAL',
        },
        { status: 400 }
      )
    }

    const clientInfo = getClientInfo(req)

    // === Hashear y persistir la nueva clave ===
    const nuevoClaveHash = bcrypt.hashSync(nuevaClave, 12)
    const ahora = new Date()
    const tokenSesion = generateToken(32)
    const tokenExpira = new Date(ahora.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000)

    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        claveHash: nuevoClaveHash,
        claveCreatedAt: ahora,
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        // Apagar el flag y limpiar el token temporal
        debeCambiarClave: false,
        claveTempToken: null,
        claveTempExpira: null,
        // Crear sesión completa (no requiere re-login)
        tokenSesion,
        tokenExpira,
        ultimoAccesoPortal: ahora,
      },
    })

    // === Auditoría ===
    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        accion: 'CAMBIO_CLAVE_PRIMER_LOGIN',
        exito: true,
        detalle: 'Clave cambiada exitosamente en el primer ingreso. Sesión iniciada.',
      },
    })

    return NextResponse.json({
      success: true,
      mensaje: 'Clave actualizada correctamente. Sesión iniciada.',
      token: tokenSesion,
      clienteId: cliente.id,
      nombre: cliente.nombre,
    })
  } catch (e) {
    console.error('[cambiar-clave-primer-login] error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
