// =====================================================
// /api/seguridad/credenciales-activas
// -----------------------------------------------------
// Lista todos los usuarios internos y clientes del portal
// con su estado (activo/bloqueado) y datos de contacto.
// Permite bloquear o desbloquear cuentas.
//
// Permisos:
//   GET  → solo ADMIN
//   POST → solo ADMIN (acción bloquear/desbloquear)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { logError, errorResponse } from '@/lib/error-handler'

// GET — Listar credenciales activas
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    // Obtener usuarios internos
    const usuarios = await db.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        username: true,
        email: true,
        rol: true,
        activo: true,
        ultimoAcceso: true,
        cedula: true,
      },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    })

    // Obtener clientes del portal
    let clientes: any[] = []
    try {
      clientes = await db.cliente.findMany({
        select: {
          id: true,
          nombre: true,
          cedula: true,
          email: true,
          telefono: true,
          activo: true,
        },
        orderBy: { nombre: 'asc' },
      })
    } catch {
      // La tabla Cliente podría no existir o variar; toleramos el error
    }

    // Mapear a estructura unificada
    const credenciales = [
      ...usuarios.map((u) => ({
        id: u.id,
        tipo: 'USUARIO' as const,
        nombre: u.nombre,
        identificador: u.username,
        email: u.email,
        telefono: null as string | null,
        rol: u.rol,
        activo: u.activo,
        ultimoAcceso: u.ultimoAcceso?.toISOString() || null,
      })),
      ...clientes.map((c) => ({
        id: c.id,
        tipo: 'CLIENTE' as const,
        nombre: c.nombre,
        identificador: c.cedula,
        email: c.email,
        telefono: c.telefono,
        rol: null,
        activo: c.activo,
        ultimoAcceso: null as string | null,
      })),
    ]

    return NextResponse.json({ success: true, data: credenciales })
  } catch (error: any) {
    logError('/api/seguridad/credenciales-activas GET', error)
    return errorResponse('/api/seguridad/credenciales-activas GET', error)
  }
}

// POST — Bloquear o desbloquear
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { accion, tipo, id } = body as { accion: 'bloquear' | 'desbloquear'; tipo: 'USUARIO' | 'CLIENTE'; id: string }

    if (!accion || !tipo || !id) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros: accion, tipo, id' },
        { status: 400 }
      )
    }

    if (!['bloquear', 'desbloquear'].includes(accion)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Debe ser "bloquear" o "desbloquear"' },
        { status: 400 }
      )
    }

    const nuevoEstado = accion === 'bloquear' ? false : true

    if (tipo === 'USUARIO') {
      // Verificar que no se bloquee al último admin
      const usuario = await db.usuario.findUnique({ where: { id } })
      if (!usuario) {
        return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
      }
      if (usuario.rol === 'ADMIN' && accion === 'bloquear') {
        const totalAdmins = await db.usuario.count({ where: { rol: 'ADMIN', activo: true } })
        if (totalAdmins <= 1) {
          return NextResponse.json(
            { success: false, error: 'No se puede bloquear al último administrador activo' },
            { status: 400 }
          )
        }
      }
      await db.usuario.update({
        where: { id },
        data: { activo: nuevoEstado },
      })
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: accion === 'bloquear' ? 'USUARIO_BLOQUEADO' : 'USUARIO_DESBLOQUEADO',
        modulo: 'seguridad',
        detalles: JSON.stringify({ targetId: id, targetNombre: usuario.nombre, targetUsername: usuario.username, targetRol: usuario.rol }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json({
        success: true,
        mensaje: `Usuario ${accion === 'bloquear' ? 'bloqueado' : 'desbloqueado'} correctamente`,
      })
    } else if (tipo === 'CLIENTE') {
      const cliente = await db.cliente.findUnique({ where: { id } })
      if (!cliente) {
        return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
      }
      await db.cliente.update({
        where: { id },
        data: { activo: nuevoEstado },
      })
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: accion === 'bloquear' ? 'CLIENTE_BLOQUEADO' : 'CLIENTE_DESBLOQUEADO',
        modulo: 'seguridad',
        detalles: JSON.stringify({ targetId: id, targetNombre: cliente.nombre, targetCedula: cliente.cedula }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json({
        success: true,
        mensaje: `Cliente ${accion === 'bloquear' ? 'bloqueado' : 'desbloqueado'} correctamente`,
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo inválido. Debe ser "USUARIO" o "CLIENTE"' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    logError('/api/seguridad/credenciales-activas POST', error)
    return errorResponse('/api/seguridad/credenciales-activas POST', error)
  }
}
