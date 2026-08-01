// =====================================================
// /api/chat/clave-dinamica — Clave dinámica interna
// -----------------------------------------------------
// POST /api/chat/clave-dinamica
//   { clienteId?, cedula? }
//
// Genera una clave interna dinámica que permite al cliente
// usar el chat SIN necesidad de OTP por WhatsApp.
//
// La clave se deriva de:
//   - cédula del cliente (identidad)
//   - un secreto del servidor (process.env.CHAT_DYN_SECRET)
//     o un secreto por defecto (no es lo óptimo pero es
//     mejor que nada para entornos sin variable de entorno)
//   - un nonce aleatorio para evitar reutilización
//
// La clave se persiste en cliente.tokenSesion con expiración
// de 24h (más larga que el OTP que es 2h), porque el cliente
// ya está autenticado en el portal.
//
// Flujo:
//   1. Cliente abre tab "Comunicaciones" en su portal
//   2. Frontend llama a este endpoint con su cédula
//   3. Backend valida que el cliente exista y esté activo
//   4. Genera la clave dinámica y la guarda como tokenSesion
//   5. Devuelve la clave al frontend
//   6. Frontend la usa como x-portal-token en llamadas al chat
//
// Reemplaza la necesidad del OTP para clientes autenticados.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// === CONFIGURACIÓN ===
const SESION_HORAS = 24 // 24h de validez para clientes autenticados en el portal

// FIX-SEGURIDAD-CRITICA #2: el secreto del servidor DEBE venir de process.env.CHAT_DYN_SECRET.
// Antes estaba hardcoded como fallback ('jsadr-aurora-bancaria-dynamic-key-secret-2026-v1'),
// lo que permitía a un atacante forjar claves dinámicas si conocía el código fuente.
// La validación se realiza dentro del handler POST para no romper imports del módulo.

// === Generación de clave dinámica ===
// Combina: cédula + secreto + nonce + timestamp → HMAC-SHA256
function generarClaveDinamica(cedula: string, serverSecret: string): { clave: string; nonce: string } {
  const nonce = crypto.randomBytes(8).toString('hex')
  const ts = Date.now().toString(36)
  const payload = `${cedula}:${nonce}:${ts}`
  const hmac = crypto.createHmac('sha256', serverSecret)
  hmac.update(payload)
  const hash = hmac.digest('hex')
  // Clave final: primeros 32 caracteres del hash + nonce (8) + ts (8) = 48 chars
  return {
    clave: `${hash.slice(0, 32)}${nonce}${ts}`,
    nonce,
  }
}

// === POST ===
export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #2: exigir CHAT_DYN_SECRET en el entorno (≥32 chars)
    const CHAT_DYN_SECRET = process.env.CHAT_DYN_SECRET
    if (!CHAT_DYN_SECRET || CHAT_DYN_SECRET.length < 32) {
      return NextResponse.json(
        { success: false, error: 'CHAT_DYN_SECRET no configurado (debe tener ≥32 chars)' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { clienteId, cedula, forzar = false } = body

    if (!clienteId && !cedula) {
      return NextResponse.json(
        {
          success: false,
          error: 'clienteId o cedula son requeridos',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      )
    }

    // Buscar cliente
    const cliente = await db.cliente.findFirst({
      where: clienteId ? { id: clienteId } : { cedula },
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        email: true,
        activo: true,
        tokenSesion: true,
        tokenExpira: true,
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { success: false, error: 'Cliente inactivo', code: 'INACTIVE' },
        { status: 403 }
      )
    }

    // Si ya tiene un token válido y no se fuerza regeneración, devolverlo
    if (
      !forzar &&
      cliente.tokenSesion &&
      cliente.tokenExpira &&
      new Date(cliente.tokenExpira) > new Date()
    ) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: cliente.tokenSesion,
          clienteId: cliente.id,
          tokenExpira: cliente.tokenExpira.toISOString(),
          regenerado: false,
        },
      })
    }

    // Generar nueva clave dinámica
    const { clave } = generarClaveDinamica(cliente.cedula, CHAT_DYN_SECRET)
    const tokenExpira = new Date(Date.now() + SESION_HORAS * 60 * 60 * 1000)

    // Persistir
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion: clave,
        tokenExpira,
      },
    })

    // Registrar acceso (sin revelar la clave)
    try {
      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: req.headers.get('x-forwarded-for') || null,
          userAgent: req.headers.get('user-agent') || null,
          accion: 'CHAT_DYN_KEY',
          exito: true,
          detalle: 'Clave dinámica generada para chat (sin OTP)',
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        sessionId: clave,
        clienteId: cliente.id,
        tokenExpira: tokenExpira.toISOString(),
        regenerado: true,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
