// =====================================================
// /api/juridico/portal/auth — Portal Jurídico (Jsadr)
//   POST  → login con cedula O username + clave (bcrypt, verifyPassword)
//   GET   → verifica la sesión activa (token en query)
//   DELETE → logout (cierra la sesión del portal)
//
// El identificador enviado en `cedula` puede ser:
//   - la cédula numérica del abogado (ej: 1234567890)
//   - el username interno (ej: "JD_jsadr")
// El backend busca en ambos campos y devuelve el usuario con
// rol ABOGADO o GESTOR. Anti-enumeración: misma respuesta
// uniforme sin importar si el usuario no existe o la clave
// es incorrecta.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import {
  verifyPassword,
  getClientInfo,
  registrarAuditLog,
  rateLimit,
} from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const SESSION_EXPIRY_HOURS = 8

// =====================================================
// POST — Login del abogado/gestor del portal jurídico
// Body: { cedula, clave }  (cedula puede ser cedula o username)
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`juridico-portal:${clientInfo.ip}`, 20)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { cedula, clave } = body

    if (!cedula || !clave) {
      return NextResponse.json(
        { success: false, error: 'Usuario y clave son requeridos' },
        { status: 400 }
      )
    }

    // Buscar usuario por cedula O username (case-insensitive) con rol ABOGADO o GESTOR
    const identificador = String(cedula).trim()
    const identificadorLower = identificador.toLowerCase()
    const usuario = await db.usuario.findFirst({
      where: {
        AND: [
          { rol: { in: ['ABOGADO', 'GESTOR'] } },
          {
            OR: [
              { cedula: identificador },
              { cedula: identificadorLower },
              { username: identificador },
              { username: identificadorLower },
            ],
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        username: true,
        email: true,
        rol: true,
        cedula: true,
        claveHash: true,
        activo: true,
        bloqueadoHasta: true,
      },
    })

    // Anti-enumeración: respuesta uniforme
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario o clave incorrecta' },
        { status: 401 }
      )
    }

    if (!usuario.activo) {
      return NextResponse.json(
        { success: false, error: 'Cuenta inactiva. Contacta al administrador.' },
        { status: 403 }
      )
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cuenta bloqueada temporalmente. Intenta más tarde.',
        },
        { status: 403 }
      )
    }

    // Verificar la clave (campo claveHash del portal jurídico)
    if (!usuario.claveHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'La cuenta no tiene clave de portal configurada. Contacta al administrador.',
        },
        { status: 403 }
      )
    }

    const claveValida = await verifyPassword(String(clave), usuario.claveHash)
    if (!claveValida) {
      return NextResponse.json(
        { success: false, error: 'Usuario o clave incorrecta' },
        { status: 401 }
      )
    }

    // Generar token de sesión (randomBytes) y guardarlo en el usuario
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date()
    expira.setHours(expira.getHours() + SESSION_EXPIRY_HOURS)

    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenSesion: token,
        tokenExpira: expira,
        ultimoAcceso: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })

    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'LOGIN_PORTAL_JURIDICO',
        modulo: 'juridico',
        entidadNombre: usuario.cedula || '',
        detalles: `Login exitoso en el portal jurídico (${usuario.rol})`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: {
        token,
        expira: expira.toISOString(),
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          username: usuario.username,
          rol: usuario.rol,
          cedula: usuario.cedula,
        },
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// =====================================================
// GET — Verificar sesión activa
// ?token=xxx
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      )
    }

    const usuario = await db.usuario.findFirst({
      where: { tokenSesion: token },
      select: {
        id: true,
        nombre: true,
        username: true,
        rol: true,
        cedula: true,
        tokenExpira: true,
        activo: true,
      },
    })

    if (!usuario || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida' },
        { status: 401 }
      )
    }

    if (!usuario.tokenExpira || usuario.tokenExpira < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          username: usuario.username,
          rol: usuario.rol,
          cedula: usuario.cedula,
        },
        expira: usuario.tokenExpira.toISOString(),
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// =====================================================
// DELETE — Logout
// ?token=xxx o body { token }
// v4.11 (QA M08 TC-JUR-015): registra LOGOUT en AuditLog
// =====================================================
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (token) {
      // Buscar usuario antes de limpiar para auditoría
      const usuario = await db.usuario.findFirst({
        where: { tokenSesion: token },
        select: { id: true, nombre: true, rol: true, cedula: true },
      })

      await db.usuario.updateMany({
        where: { tokenSesion: token },
        data: { tokenSesion: null, tokenExpira: null },
      })

      // v4.11: registrar LOGOUT en AuditLog
      if (usuario) {
        const clientInfo = getClientInfo(req)
        try {
          await registrarAuditLog({
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre,
            accion: 'LOGOUT_PORTAL_JURIDICO',
            modulo: 'juridico',
            entidadNombre: usuario.cedula || '',
            detalles: `Logout del portal jurídico (${usuario.rol})`,
            ipOrigen: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            exito: true,
          })
        } catch {
          // no bloquear
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// =====================================================
// Helper compartido — verifica el token y devuelve el usuario
// =====================================================
export async function verificarTokenPortal(token: string): Promise<{
  id: string
  nombre: string
  username: string
  rol: string
  cedula: string | null
} | null> {
  if (!token) return null
  const usuario = await db.usuario.findFirst({
    where: { tokenSesion: token },
    select: {
      id: true,
      nombre: true,
      username: true,
      rol: true,
      cedula: true,
      tokenExpira: true,
      activo: true,
    },
  })

  if (!usuario || !usuario.activo) return null
  if (!usuario.tokenExpira || usuario.tokenExpira < new Date()) return null
  if (usuario.rol !== 'ABOGADO' && usuario.rol !== 'GESTOR') return null

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    rol: usuario.rol,
    cedula: usuario.cedula,
  }
}
