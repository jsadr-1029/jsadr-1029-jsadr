import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  checkAccountLockout,
  registerFailedAttempt,
  resetFailedAttempts,
  rateLimit,
  registrarAuditLog,
  getClientInfo,
  SECURITY_CONFIG,
} from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - estado de seguridad del sistema (Reforzado: requiere CONSULTOR+)
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')

    // === ESTADÍSTICAS DE SEGURIDAD ===
    if (tipo === 'stats') {
      const [totalUsuarios, usuariosActivos, usuariosBloqueados, totalAuditLogs, loginsHoy] = await Promise.all([
        db.usuario.count(),
        db.usuario.count({ where: { activo: true } }),
        db.usuario.count({ where: { bloqueadoHasta: { gt: new Date() } } }),
        db.auditLog.count(),
        db.auditLog.count({
          where: {
            accion: 'LOGIN',
            fecha: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          totalUsuarios,
          usuariosActivos,
          usuariosBloqueados,
          totalAuditLogs,
          loginsHoy,
          config: SECURITY_CONFIG,
        },
      })
    }

    // === LISTAR MÓDULOS PROTEGIDOS ===
    const config = await db.configuracion.findUnique({ where: { clave: 'CLAVE_MAESTRA_SEGURIDAD' } })

    const modulosSistema = [
      { key: 'dashboard', nombre: 'Reportes' },
      { key: 'clientes', nombre: 'Clientes' },
      { key: 'prestamos', nombre: 'Préstamos' },
      { key: 'pagos', nombre: 'Pagos' },
      { key: 'juridico', nombre: 'Jurídico' },
      { key: 'cajas', nombre: 'Cajas Menores' },
      { key: 'usuarios', nombre: 'Usuarios' },
      { key: 'conexiones', nombre: 'Conexiones API' },
      { key: 'admin', nombre: 'Administración' },
      { key: 'exportar', nombre: 'Exportar BD' },
    ]

    // Asegurar que existan en BD
    for (const mod of modulosSistema) {
      const existente = await db.seguridadModulo.findUnique({ where: { moduloKey: mod.key } })
      if (!existente) {
        await db.seguridadModulo.create({
          data: { moduloKey: mod.key, moduloNombre: mod.nombre, protegido: false },
        })
      }
    }

    const modulos = await db.seguridadModulo.findMany({ orderBy: { moduloNombre: 'asc' } })
    const modulosSeguros = modulos.map((m) => ({
      ...m,
      claveHash: m.claveHash ? '••••••••' : null,
      tieneClave: !!m.claveHash,
    }))

    return NextResponse.json({
      success: true,
      data: modulosSeguros,
      tieneClaveMaestra: !!config,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - operaciones de seguridad
export async function POST(req: NextRequest) {
  try {
    // Reforzado: requiere GESTOR+ para acciones de seguridad
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    // Rate limiting
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`seguridad:${clientInfo.ip}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { accion } = body

    // === VERIFICAR CLAVE MAESTRA ===
    if (accion === 'verificar_maestra') {
      const { clave } = body
      const config = await db.configuracion.findUnique({ where: { clave: 'CLAVE_MAESTRA_SEGURIDAD' } })

      if (!config) {
        if (!clave) {
          return NextResponse.json({
            success: false,
            error: 'PRIMERA_VEZ',
            mensaje: 'No hay clave maestra configurada. Debes crear una.',
          })
        }
        const hash = await hashPassword(clave)
        await db.configuracion.create({
          data: {
            clave: 'CLAVE_MAESTRA_SEGURIDAD',
            valor: hash,
            descripcion: 'Clave maestra del módulo de Seguridad (bcrypt)',
          },
        })
        return NextResponse.json({ success: true, data: { primeraVez: true } })
      }

      const valida = await verifyPassword(clave, config.valor)
      if (!valida) {
        return NextResponse.json({ success: false, error: 'Clave maestra incorrecta' }, { status: 401 })
      }

      return NextResponse.json({ success: true })
    }

    // === VERIFICAR CLAVE DE MÓDULO ===
    if (accion === 'verificar_modulo') {
      const { moduloKey, clave } = body
      const modulo = await db.seguridadModulo.findUnique({ where: { moduloKey } })

      if (!modulo || !modulo.protegido || !modulo.claveHash) {
        return NextResponse.json({ success: true, data: { desbloqueado: true } })
      }

      const valida = await verifyPassword(clave, modulo.claveHash)
      if (!valida) {
        return NextResponse.json({ success: false, error: 'Clave incorrecta' }, { status: 401 })
      }

      return NextResponse.json({ success: true, data: { desbloqueado: true } })
    }

    // === PROTEGER MÓDULO ===
    if (accion === 'proteger') {
      const { moduloKey, clave } = body
      if (!clave || clave.length < 4) {
        return NextResponse.json({ success: false, error: 'La clave debe tener al menos 4 caracteres' }, { status: 400 })
      }
      const hash = await hashPassword(clave)
      await db.seguridadModulo.update({
        where: { moduloKey },
        data: { protegido: true, claveHash: hash },
      })
      return NextResponse.json({ success: true, mensaje: `Módulo ${moduloKey} protegido` })
    }

    // === DESPROTEGER MÓDULO ===
    if (accion === 'desproteger') {
      const { moduloKey } = body
      await db.seguridadModulo.update({
        where: { moduloKey },
        data: { protegido: false, claveHash: null },
      })
      return NextResponse.json({ success: true, mensaje: `Módulo ${moduloKey} desprotegido` })
    }

    // === CAMBIAR CLAVE DE MÓDULO ===
    if (accion === 'cambiar_clave') {
      const { moduloKey, claveNueva } = body
      if (!claveNueva || claveNueva.length < 4) {
        return NextResponse.json({ success: false, error: 'La clave debe tener al menos 4 caracteres' }, { status: 400 })
      }
      const hash = await hashPassword(claveNueva)
      await db.seguridadModulo.update({
        where: { moduloKey },
        data: { claveHash: hash },
      })
      return NextResponse.json({ success: true, mensaje: 'Clave actualizada' })
    }

    // === CAMBIAR CLAVE MAESTRA ===
    if (accion === 'cambiar_maestra') {
      const { claveActual, claveNueva } = body
      const config = await db.configuracion.findUnique({ where: { clave: 'CLAVE_MAESTRA_SEGURIDAD' } })

      if (!config) {
        return NextResponse.json({ success: false, error: 'No hay clave maestra configurada' }, { status: 400 })
      }

      const valida = await verifyPassword(claveActual, config.valor)
      if (!valida) {
        return NextResponse.json({ success: false, error: 'Clave maestra actual incorrecta' }, { status: 401 })
      }

      if (!claveNueva || claveNueva.length < 6) {
        return NextResponse.json({ success: false, error: 'La nueva clave debe tener al menos 6 caracteres' }, { status: 400 })
      }

      const hash = await hashPassword(claveNueva)
      await db.configuracion.update({
        where: { clave: 'CLAVE_MAESTRA_SEGURIDAD' },
        data: { valor: hash },
      })

      await registrarAuditLog({
        usuarioNombre: 'Sistema',
        accion: 'CAMBIAR_CLAVE_MAESTRA',
        modulo: 'seguridad',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({ success: true, mensaje: 'Clave maestra actualizada' })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
