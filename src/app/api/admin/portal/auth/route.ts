// =====================================================
// /api/admin/portal/auth — Portal Administrador Companion (Módulo 5)
// Login con usuario "P_jsadr" y clave 731649 (bcrypt)
//
//   POST → { usuario, clave } → genera token de sesión admin portal
//   GET  → verificar sesión (token en query)
//
// IMPORTANTE: Este portal es para el ACOMPAÑANTE del administrador,
// NO es el admin principal. El admin principal usa el login del sistema
// con usuario "Js1214731649" / "Js951029*" (tabla Usuario, rol ADMIN).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getClientInfo, rateLimit, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const SESSION_EXPIRY_HOURS = 8

interface SesionAdminPortal {
  usuario: string
  nombre: string
  token: string
  expira: Date
}

const sesionesAdminPortal = new Map<string, SesionAdminPortal>()

// Limpieza periódica
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = new Date()
    for (const [key, sesion] of sesionesAdminPortal.entries()) {
      if (sesion.expira < now) sesionesAdminPortal.delete(key)
    }
  }, 10 * 60 * 1000)
}

function generarToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// =====================================================
// GET — Verificar sesión (?token=xxx)
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

    const sesion = sesionesAdminPortal.get(token)
    if (!sesion || sesion.expira < new Date()) {
      if (sesion) sesionesAdminPortal.delete(token)
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        usuario: sesion.usuario,
        nombre: sesion.nombre,
        expira: sesion.expira.toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Login del portal admin
// Body: { usuario, clave }
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`admin-portal:${clientInfo.ip}`, 15)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { usuario, clave } = body

    if (!usuario || !clave) {
      return NextResponse.json(
        { success: false, error: 'Usuario y clave son requeridos' },
        { status: 400 }
      )
    }

    // Credenciales del portal admin companion
    // Usuario: "P_jsadr"  ·  Clave: "731649"
    // (clave persistida como hash bcrypt en Configuracion.portal_admin_hash)
    const USUARIO_PORTAL_ADMIN = 'P_jsadr'
    // Hash bcrypt precomputado para la clave "731649" (se persiste en Configuracion)
    // Si no existe en la BD, lo creamos en caliente la primera vez.

    let config = await db.configuracion.findUnique({
      where: { clave: 'portal_admin_hash' },
    })

    if (!config) {
      const hash = await bcrypt.hash('731649', 12)
      config = await db.configuracion.create({
        data: {
          clave: 'portal_admin_hash',
          valor: hash,
          descripcion: 'Hash bcrypt del portal admin companion (usuario P_jsadr)',
        },
      })
    }

    // Comparación case-insensitive para evitar fricción al usuario
    if (usuario.trim().toLowerCase() !== USUARIO_PORTAL_ADMIN.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Usuario o clave incorrectos' },
        { status: 401 }
      )
    }

    const claveValida = await bcrypt.compare(clave, config.valor)
    if (!claveValida) {
      try {
        await registrarAuditLog({
          usuarioId: null,
          usuarioNombre: `PortalAdmin: ${usuario}`,
          accion: 'LOGIN_FALLIDO_PORTAL_ADMIN',
          modulo: 'admin',
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: false,
          errorMessage: 'Clave incorrecta',
        })
      } catch (e) {
        // no bloquear
      }
      return NextResponse.json(
        { success: false, error: 'Usuario o clave incorrectos' },
        { status: 401 }
      )
    }

    const token = generarToken()
    const expira = new Date()
    expira.setHours(expira.getHours() + SESSION_EXPIRY_HOURS)

    const sesion: SesionAdminPortal = {
      usuario: USUARIO_PORTAL_ADMIN,
      nombre: 'Acompañante Administrativo',
      token,
      expira,
    }
    sesionesAdminPortal.set(token, sesion)

    try {
      await registrarAuditLog({
        usuarioId: null,
        usuarioNombre: `PortalAdmin: ${usuario}`,
        accion: 'LOGIN_PORTAL_ADMIN',
        modulo: 'admin',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch (e) {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: {
        token,
        expira: expira.toISOString(),
        usuario: sesion.usuario,
        nombre: sesion.nombre,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// Exportar verificador para uso en otras rutas
export function getSesionAdminPortal(token: string): SesionAdminPortal | null {
  const sesion = sesionesAdminPortal.get(token)
  if (!sesion || sesion.expira < new Date()) {
    if (sesion) sesionesAdminPortal.delete(token)
    return null
  }
  return sesion
}
