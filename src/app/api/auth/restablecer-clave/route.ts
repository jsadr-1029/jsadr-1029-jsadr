// =====================================================
// /api/auth/restablecer-clave — Restablecer contraseña con magic link
// -----------------------------------------------------
// POST /api/auth/restablecer-clave
//   { token: string, nuevaClave: string, confirmarClave: string }
//
// Flujo (v4.14 — magic link, sin contraseña temporal por correo):
//   1. Recibe el token que llegó al usuario por correo.
//   2. Busca en Usuario y Cliente por `claveResetToken`.
//   3. Valida: token existe, no expirado, cuenta activa.
//   4. Valida: nuevaClave cumple política (6-64 chars), coincide con confirmar.
//   5. Hashea la nueva clave (bcrypt rounds=12) y la persiste.
//   6. Cancela el token (one-shot) — lo setea a NULL.
//   7. Para CLIENTE: genera sesión completa (token + 8h) para auto-login.
//      Para USUARIO: solo actualiza credenciales, no genera sesión
//      (los admin usan MFA / flows distintos, deben re-login).
//   8. Registra en AuditLog.
//
// Validaciones extra:
//   - La nueva clave no puede ser igual a la actual (si existe hash previo).
//   - No revela si el token existe o no (respuesta genérica 401).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/format'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const MIN_LONGITUD_CLAVE = 6
const MAX_LONGITUD_CLAVE = 64
const SESSION_EXPIRY_HOURS = 8

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, nuevaClave, confirmarClave } = body || {}

    // === Validaciones de entrada ===
    if (!token || typeof token !== 'string' || token.length < 16) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo desde la página de inicio de sesión.',
          codigo: 'TOKEN_INVALIDO',
        },
        { status: 401 }
      )
    }
    if (!nuevaClave || typeof nuevaClave !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debes ingresar una nueva clave', codigo: 'CLAVE_REQUERIDA' },
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

    // === Buscar token en Cliente primero, luego en Usuario ===
    // (los clientes son los usuarios más frecuentes de este flujo)
    const cliente = await db.cliente.findFirst({
      where: { claveResetToken: token },
    })

    const usuario = !cliente
      ? await db.usuario.findFirst({ where: { claveResetToken: token } })
      : null

    // Respuesta genérica si el token no existe — no filtrar "no encontrado" vs "expirado"
    const RESPUESTA_TOKEN_INVALIDO = NextResponse.json(
      {
        success: false,
        error:
          'El enlace de recuperación es inválido, ya fue utilizado o ha expirado. Solicita uno nuevo desde la página de inicio de sesión.',
        codigo: 'TOKEN_INVALIDO',
      },
      { status: 401 }
    )

    if (!cliente && !usuario) {
      return RESPUESTA_TOKEN_INVALIDO
    }

    const clientInfo = getClientInfo(req)

    // === Caso 1: CLIENTE ===
    if (cliente) {
      // Verificar expiración
      if (!cliente.claveResetExpira || new Date(cliente.claveResetExpira) < new Date()) {
        await registrarAuditLog({
          usuarioNombre: cliente.nombre,
          accion: 'RECUPERACION_CLAVE_TOKEN_EXPIRADO',
          modulo: 'auth',
          detalles: JSON.stringify({ tipo: 'CLIENTE', clienteId: cliente.id }),
          exito: false,
          errorMessage: 'Token expirado',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        })
        return RESPUESTA_TOKEN_INVALIDO
      }

      if (!cliente.activo) {
        return NextResponse.json(
          { success: false, error: 'Cuenta inactiva', codigo: 'CUENTA_INACTIVA' },
          { status: 403 }
        )
      }

      // Verificar que la nueva clave no sea igual a la actual
      if (cliente.claveHash && bcrypt.compareSync(nuevaClave, cliente.claveHash)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La nueva clave no puede ser igual a tu clave actual. Elige una clave diferente.',
            codigo: 'CLAVE_IGUAL_ACTUAL',
          },
          { status: 400 }
        )
      }

      // Hashear y persistir
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
          debeCambiarClave: false,
          // Cancelar el token de reset (one-shot)
          claveResetToken: null,
          claveResetExpira: null,
          // Limpiar también cualquier token temporal de primer login residual
          claveTempToken: null,
          claveTempExpira: null,
          // Generar sesión completa (no requiere re-login)
          tokenSesion,
          tokenExpira,
          ultimoAccesoPortal: ahora,
        },
      })

      // Auditoría
      await db.accesoPortal.create({
        data: {
          clienteId: cliente.id,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          accion: 'RECUPERACION_CLAVE_MAGIC_LINK',
          exito: true,
          detalle: 'Clave restablecida vía magic link. Sesión iniciada automáticamente.',
        },
      })

      await registrarAuditLog({
        usuarioNombre: cliente.nombre,
        accion: 'RECUPERACION_CLAVE_COMPLETADA',
        modulo: 'auth',
        detalles: JSON.stringify({ tipo: 'CLIENTE', clienteId: cliente.id, mecanismo: 'MAGIC_LINK' }),
        exito: true,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Tu contraseña se ha actualizado correctamente. Sesión iniciada.',
        tipo: 'CLIENTE',
        token: tokenSesion,
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        nombre: cliente.nombre,
      })
    }

    // === Caso 2: USUARIO (admin/gestor/consultor/abogado) ===
    if (usuario) {
      if (!usuario.claveResetExpira || new Date(usuario.claveResetExpira) < new Date()) {
        await registrarAuditLog({
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          accion: 'RECUPERACION_CLAVE_TOKEN_EXPIRADO',
          modulo: 'auth',
          detalles: JSON.stringify({ tipo: 'USUARIO', rol: usuario.rol }),
          exito: false,
          errorMessage: 'Token expirado',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        })
        return RESPUESTA_TOKEN_INVALIDO
      }

      if (!usuario.activo) {
        return NextResponse.json(
          { success: false, error: 'Cuenta inactiva', codigo: 'CUENTA_INACTIVA' },
          { status: 403 }
        )
      }

      // Verificar que la nueva clave no sea igual a la actual
      if (usuario.passwordHash && bcrypt.compareSync(nuevaClave, usuario.passwordHash)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La nueva clave no puede ser igual a tu clave actual. Elige una clave diferente.',
            codigo: 'CLAVE_IGUAL_ACTUAL',
          },
          { status: 400 }
        )
      }

      const nuevoHash = bcrypt.hashSync(nuevaClave, 12)
      await db.usuario.update({
        where: { id: usuario.id },
        data: {
          passwordHash: nuevoHash,
          mustChangePassword: false,
          intentosFallidos: 0,
          bloqueadoHasta: null,
          claveResetToken: null,
          claveResetExpira: null,
        },
      })

      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'RECUPERACION_CLAVE_COMPLETADA',
        modulo: 'auth',
        detalles: JSON.stringify({ tipo: 'USUARIO', rol: usuario.rol, mecanismo: 'MAGIC_LINK' }),
        exito: true,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje:
          'Tu contraseña se ha actualizado correctamente. Inicia sesión con tu nueva clave para continuar.',
        tipo: 'USUARIO',
        // No se devuelve token — los admin/abogado deben re-login (sus sesiones pueden tener MFA)
      })
    }

    // No debería llegar aquí, pero por seguridad:
    return RESPUESTA_TOKEN_INVALIDO
  } catch (e) {
    console.error('[restablecer-clave] error:', e)
    return NextResponse.json(
      { success: false, error: sanitizeError(e as Error).message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
