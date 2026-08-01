import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { rateLimit, getClientInfo, hashPassword } from '@/lib/security'
import { requireRole as requireRoleAuth } from '@/lib/auth-guard'
import crypto from 'crypto'

// =====================================================
// GET /api/seguridad/credenciales
// Lista todos los clientes con su estado de credenciales (cédula, nombre,
// estado de la clave, último acceso al portal, intentos, bloqueos).
// NO expone el hash de la clave.
// =====================================================
// Query params:
//  ?q=busqueda   → filtra por nombre, cédula o teléfono
//  ?soloConClave=true → solo clientes que ya tienen claveHash
//  ?soloBloqueados=true → solo clientes con claveBloqueadoHasta > ahora
//  ?otps=true    → retorna también el historial de OTPs por cliente
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`credenciales-list:${clientInfo.ip}`, 30)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const soloConClave = searchParams.get('soloConClave') === 'true'
    const soloBloqueados = searchParams.get('soloBloqueados') === 'true'
    const incluirOtps = searchParams.get('otps') === 'true'

    const where: any = {}
    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { cedula: { contains: q } },
        { telefono: { contains: q } },
        { email: { contains: q } },
      ]
    }
    if (soloConClave) {
      where.claveHash = { not: null }
    }
    if (soloBloqueados) {
      where.claveBloqueadoHasta = { gt: new Date() }
    }

    const clientes = await db.cliente.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 200,
      select: {
        id: true,
        nombre: true,
        cedula: true,
        telefono: true,
        email: true,
        activo: true,
        // Credenciales (no exponemos el hash)
        claveHash: true,
        claveCreatedAt: true,
        claveIntentos: true,
        claveBloqueadoHasta: true,
        // PIN (lo incluimos también para referencia)
        pinHash: true,
        pinCreatedAt: true,
        pinIntentos: true,
        pinBloqueadoHasta: true,
        ultimoAccesoPortal: true,
        createdAt: true,
      },
    })

    // Contar OTPs por cliente (de OtpRegistro + OtpChat + FirmaElectronica)
    let otpsPorCliente: Record<string, any[]> = {}
    if (incluirOtps) {
      const clienteIds = clientes.map((c) => c.id)
      const [otpsRegistro, otpsChat, firmasOtp] = await Promise.all([
        db.otpRegistro.findMany({
          where: { clienteId: { in: clienteIds } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        db.otpChat.findMany({
          where: { clienteId: { in: clienteIds } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        db.firmaElectronica.findMany({
          where: { clienteId: { in: clienteIds }, otpEnviado: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true,
            clienteId: true,
            otpCanal: true,
            otpFechaEnvio: true,
            otpFechaValidacion: true,
            otpValidado: true,
            intentosOTP: true,
            estadoFirma: true,
            tipo: true,
            esFirmaCodeudor: true,
            firmanteRol: true,
            firmanteNombre: true,
            createdAt: true,
          },
        }),
      ])

      // Indexar por clienteId
      clientes.forEach((c) => {
        otpsPorCliente[c.id] = []
      })
      otpsRegistro.forEach((o) => {
        if (otpsPorCliente[o.clienteId || '']) {
          otpsPorCliente[o.clienteId!].push({
            id: o.id,
            tipo: o.tipo,
            fuente: 'OTP_REGISTRO',
            metodo: o.metodo,
            destinatario: o.destinatario,
            descripcion: o.descripcion,
            verificado: o.verificado,
            usado: o.usado,
            bloqueado: o.bloqueado,
            intentos: o.intentos,
            maxIntentos: o.maxIntentos,
            expiraEn: o.expiraEn,
            fechaVerificacion: o.fechaVerificacion,
            createdAt: o.createdAt,
          })
        }
      })
      otpsChat.forEach((o) => {
        if (otpsPorCliente[o.clienteId]) {
          otpsPorCliente[o.clienteId].push({
            id: o.id,
            tipo: 'CHAT',
            fuente: 'OTP_CHAT',
            metodo: o.metodo,
            destinatario: o.destinatario,
            verificado: o.verificado,
            usado: o.usado,
            bloqueado: o.bloqueado,
            intentos: o.intentos,
            maxIntentos: o.maxIntentos,
            expiraEn: o.expiraEn,
            fechaVerificacion: o.fechaVerificacion,
            createdAt: o.createdAt,
          })
        }
      })
      firmasOtp.forEach((f) => {
        if (otpsPorCliente[f.clienteId || '']) {
          otpsPorCliente[f.clienteId!].push({
            id: f.id,
            tipo: 'FIRMA_ELECTRONICA',
            fuente: 'FIRMA_ELECTRONICA',
            metodo: f.otpCanal || 'N/A',
            destinatario: 'N/A',
            verificado: f.otpValidado,
            usado: f.otpValidado,
            bloqueado: false,
            intentos: f.intentosOTP,
            maxIntentos: 5,
            expiraEn: null,
            fechaVerificacion: f.otpFechaValidacion,
            createdAt: f.createdAt,
            descripcion: `Firma ${f.tipo}${f.esFirmaCodeudor ? ' (codeudor)' : ''} - ${f.firmanteNombre || ''} - estado: ${f.estadoFirma}`,
          })
        }
      })
    }

    // Construir respuesta
    const ahora = new Date()
    const data = clientes.map((c) => {
      const tieneClave = !!c.claveHash
      const claveBloqueada = c.claveBloqueadoHasta ? c.claveBloqueadoHasta > ahora : false
      const tienePin = !!c.pinHash
      const pinBloqueado = c.pinBloqueadoHasta ? c.pinBloqueadoHasta > ahora : false
      return {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        telefono: c.telefono,
        email: c.email,
        activo: c.activo,
        // Estado de credenciales
        tieneClave,
        claveCreatedAt: c.claveCreatedAt,
        claveIntentos: c.claveIntentos,
        claveBloqueada,
        claveBloqueadoHasta: c.claveBloqueadoHasta,
        // Estado del PIN
        tienePin,
        pinCreatedAt: c.pinCreatedAt,
        pinIntentos: c.pinIntentos,
        pinBloqueado,
        pinBloqueadoHasta: c.pinBloqueadoHasta,
        ultimoAccesoPortal: c.ultimoAccesoPortal,
        createdAt: c.createdAt,
        // OTPs (si se solicitaron)
        otps: incluirOtps ? (otpsPorCliente[c.id] || []) : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      resumen: {
        total: data.length,
        conClave: data.filter((c) => c.tieneClave).length,
        sinClave: data.filter((c) => !c.tieneClave).length,
        bloqueados: data.filter((c) => c.claveBloqueada).length,
        conPin: data.filter((c) => c.tienePin).length,
      },
    })
  } catch (error: any) {
    console.error('[credenciales GET] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST /api/seguridad/credenciales
// Crea o regenera la clave de un cliente.
// Body: { clienteId, nuevaClave, motivo }
// El motivo queda registrado en audit log.
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRoleAuth(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`credenciales-create:${clientInfo.ip}`, 10)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { clienteId, nuevaClave, motivo } = body || {}

    // === Validaciones ===
    if (!clienteId || typeof clienteId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }
    if (!nuevaClave || typeof nuevaClave !== 'string') {
      return NextResponse.json(
        { success: false, error: 'nuevaClave es requerida' },
        { status: 400 }
      )
    }
    if (nuevaClave.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La clave debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }
    if (nuevaClave.length > 64) {
      return NextResponse.json(
        { success: false, error: 'La clave no puede tener más de 64 caracteres' },
        { status: 400 }
      )
    }
    if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'El motivo debe tener al menos 5 caracteres' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // Hashear la nueva clave con bcrypt rounds=12
    const claveHash = await hashPassword(nuevaClave)
    const ahora = new Date()
    const teniaClave = !!cliente.claveHash

    await db.$transaction([
      db.cliente.update({
        where: { id: clienteId },
        data: {
          claveHash,
          claveCreatedAt: ahora,
          claveIntentos: 0,
          claveBloqueadoHasta: null,
        },
      }),
      db.auditLog.create({
        data: {
          usuarioId: user.id === 'system' ? null : user.id,
          usuarioNombre: user.nombre,
          accion: teniaClave ? 'CLAVE_CLIENTE_RESET' : 'CLAVE_CLIENTE_CREADA',
          modulo: 'seguridad',
          entidadId: clienteId,
          entidadNombre: `${cliente.nombre} - ${cliente.cedula}`,
          detalles: JSON.stringify({
            clienteId,
            clienteCedula: cliente.cedula,
            clienteNombre: cliente.nombre,
            motivo: motivo.trim(),
            teniaClavePrevia: teniaClave,
            // Por seguridad, NO guardamos la clave en claro
            claveLongitud: nuevaClave.length,
          }),
          ipOrigen: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          exito: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      mensaje: teniaClave
        ? `Clave del cliente ${cliente.nombre} regenerada correctamente. El cliente debe usar la nueva clave en su próximo inicio de sesión.`
        : `Clave creada para el cliente ${cliente.nombre}. Ya puede iniciar sesión en el portal con su cédula y esta clave.`,
      data: {
        clienteId,
        clienteNombre: cliente.nombre,
        clienteCedula: cliente.cedula,
        teniaClavePrevia: teniaClave,
        claveCreadaEn: ahora.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[credenciales POST] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// Utilitario: generar una clave aleatoria segura
// (usado por el endpoint [id] si el gestor quiere auto-generar)
// =====================================================
export function generarClaveAleatoria(longitud: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) {
    clave += chars[bytes[i] % chars.length]
  }
  return clave
}
