import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, registrarAuditLog, getClientInfo, sanitizeString } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

// Definición de permisos por rol
export const PERMISOS_ROLES = {
  ADMIN: {
    label: 'Administrador',
    descripcion: 'Acceso total al sistema',
    permisos: [
      'dashboard.ver', 'clientes.crear', 'clientes.editar', 'clientes.eliminar',
      'prestamos.crear', 'prestamos.editar', 'prestamos.aprobar', 'prestamos.rechazar',
      'prestamos.cancelar', 'prestamos.enviar_juridico',
      'pagos.crear', 'pagos.reversar',
      'juridico.crear', 'juridico.editar', 'juridico.cerrar',
      'cajas.ver', 'cajas.movimientos',
      'usuarios.crear', 'usuarios.editar', 'usuarios.eliminar',
      'admin.cuentas', 'admin.categorias', 'admin.config',
      'campanas.crear', 'campanas.editar',
      'bitacora.crear', 'bitacora.editar',
      'exportar.bd', 'exportar.pagos', 'exportar.juridico',
      'simulador.usar',
    ],
  },
  GESTOR: {
    label: 'Gestor',
    descripcion: 'Gestión operativa de solicitudes, pagos y casos jurídicos',
    permisos: [
      'dashboard.ver',
      'clientes.crear', 'clientes.editar',
      'prestamos.crear', 'prestamos.editar', 'prestamos.aprobar', 'prestamos.rechazar',
      'prestamos.cancelar', 'prestamos.enviar_juridico',
      'pagos.crear', 'pagos.reversar',
      'juridico.crear', 'juridico.editar', 'juridico.cerrar',
      'cajas.ver', 'cajas.movimientos',
      'campanas.crear', 'campanas.editar',
      'bitacora.crear', 'bitacora.editar',
      'exportar.pagos', 'exportar.juridico',
      'simulador.usar',
    ],
  },
  CONSULTOR: {
    label: 'Consultor',
    descripcion: 'Solo consulta, no puede modificar ni crear',
    permisos: [
      'dashboard.ver',
      'clientes.ver',
      'prestamos.ver',
      'pagos.ver',
      'juridico.ver',
      'cajas.ver',
      'bitacora.ver',
      'exportar.pagos', 'exportar.juridico',
      'simulador.usar',
    ],
  },
}

// Hash con bcrypt (rounds=12) - manejado por lib/security.ts

// GET - listar usuarios (ADMIN, GESTOR, CONSULTOR)
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const rol = searchParams.get('rol')

    const usuarios = await db.usuario.findMany({
      where: rol && rol !== 'all' ? { rol } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        rol: true,
        activo: true,
        ultimoAcceso: true,
        permisos: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: usuarios,
      roles: PERMISOS_ROLES,
    })
  } catch (error: any) {
    logError('/api/usuarios GET', error)
    return errorResponse('/api/usuarios GET', error)
  }
}

// POST - crear usuario (solo ADMIN)
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { nombre, email, username, password, rol, permisosPersonalizados } = body

    if (!nombre || !email || !username || !password || !rol) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos son obligatorios' },
        { status: 400 }
      )
    }

    if (!['ADMIN', 'GESTOR', 'CONSULTOR'].includes(rol)) {
      return NextResponse.json(
        { success: false, error: 'Rol inválido. Debe ser ADMIN, GESTOR o CONSULTOR' },
        { status: 400 }
      )
    }

    // Verificar duplicados
    const existente = await db.usuario.findFirst({
      where: { OR: [{ email }, { username }] },
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con ese email o username' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)
    const permisos = permisosPersonalizados || JSON.stringify(PERMISOS_ROLES[rol as keyof typeof PERMISOS_ROLES].permisos)

    const usuario = await db.usuario.create({
      data: {
        nombre,
        email,
        username,
        passwordHash,
        rol,
        permisos,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        rol: true,
        activo: true,
        permisos: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: usuario })
  } catch (error: any) {
    logError('/api/usuarios POST', error)
    return errorResponse('/api/usuarios POST', error)
  }
}

// PATCH - actualizar usuario (solo ADMIN)
export async function PATCH(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const { id, nombre, email, username, password, rol, activo, permisosPersonalizados } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const datosActualizacion: any = {}
    if (nombre !== undefined) datosActualizacion.nombre = nombre
    if (email !== undefined) datosActualizacion.email = email
    if (username !== undefined) datosActualizacion.username = username
    if (rol !== undefined) {
      if (!['ADMIN', 'GESTOR', 'CONSULTOR'].includes(rol)) {
        return NextResponse.json(
          { success: false, error: 'Rol inválido' },
          { status: 400 }
        )
      }
      datosActualizacion.rol = rol
      // Si se cambia el rol, regenerar permisos (a menos que se especifiquen personalizados)
      if (!permisosPersonalizados) {
        datosActualizacion.permisos = JSON.stringify(PERMISOS_ROLES[rol as keyof typeof PERMISOS_ROLES].permisos)
      }
    }
    if (activo !== undefined) datosActualizacion.activo = activo
    if (permisosPersonalizados !== undefined) {
      datosActualizacion.permisos = permisosPersonalizados
    }
    if (password) {
      datosActualizacion.passwordHash = await hashPassword(password)
    }

    const actualizado = await db.usuario.update({
      where: { id },
      data: datosActualizacion,
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        rol: true,
        activo: true,
        permisos: true,
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error: any) {
    logError('/api/usuarios PATCH', error)
    return errorResponse('/api/usuarios PATCH', error)
  }
}

// DELETE - eliminar usuario (solo ADMIN)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    // Verificar que no sea el último administrador
    const usuario = await db.usuario.findUnique({ where: { id } })
    if (usuario?.rol === 'ADMIN') {
      const totalAdmins = await db.usuario.count({ where: { rol: 'ADMIN', activo: true } })
      if (totalAdmins <= 1) {
        return NextResponse.json(
          { success: false, error: 'No se puede eliminar el último administrador activo' },
          { status: 400 }
        )
      }
    }

    await db.usuario.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError('/api/usuarios DELETE', error)
    return errorResponse('/api/usuarios DELETE', error)
  }
}
