// =====================================================
// /api/seguridad/recuperacion-claves — Panel de control
// -----------------------------------------------------
// Permite al admin gestionar el proceso de recuperación de
// claves desde el Módulo de Seguridad:
//
//   GET  /api/seguridad/recuperacion-claves
//        → lista el historial de recuperaciones (usuarios y clientes)
//
//   POST /api/seguridad/recuperacion-claves
//        { accion: 'reset_usuario' | 'reset_cliente' | 'config_destinatarios' }
//        → reset manual de credenciales, guarda en bitácora
//
// Solo ADMIN puede usar este endpoint.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { hashPassword, registrarAuditLog, getClientInfo } from '@/lib/security'
import { enviarEmail } from '@/lib/email'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'

// === Configuración de destinatarios por defecto ===
// Se pueden sobreescribir con una fila en Configuracion (clave DESTINATARIOS_RECUPERACION)
const DESTINATARIOS_DEFECTO = [
  { tipo: 'EMAIL', destino: 'jsa@jsadr.com.co', nombre: 'Correo principal' },
  { tipo: 'EMAIL', destino: 'jsadr23@outlook.com', nombre: 'Correo secundario' },
  { tipo: 'WHATSAPP', destino: '3235949510', nombre: 'WhatsApp admin' },
]

// === Generador de contraseña temporal ===
function generarPasswordTemporal(): string {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const minus = 'abcdefghijkmnpqrstuvwxyz'
  const nums = '23456789'
  const simb = '!@#$%&*-_=+?'
  const bytes = crypto.randomBytes(12)
  const partes = [
    mayus[bytes[0] % mayus.length],
    mayus[bytes[1] % mayus.length],
    mayus[bytes[2] % mayus.length],
    mayus[bytes[3] % mayus.length],
    minus[bytes[4] % minus.length],
    minus[bytes[5] % minus.length],
    minus[bytes[6] % minus.length],
    minus[bytes[7] % minus.length],
    nums[bytes[8] % nums.length],
    nums[bytes[9] % nums.length],
    nums[bytes[10] % nums.length],
    simb[bytes[11] % simb.length],
  ]
  for (let i = partes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[partes[i], partes[j]] = [partes[j], partes[i]]
  }
  return partes.join('')
}

// === Leer destinatarios configurados ===
async function leerDestinatarios() {
  const config = await db.configuracion.findUnique({
    where: { clave: 'DESTINATARIOS_RECUPERACION' },
  })
  if (config) {
    try {
      const parsed = JSON.parse(config.valor)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }
  return DESTINATARIOS_DEFECTO
}

// === Enviar credenciales (mismo flujo que /api/auth/recuperar-clave) ===
async function enviarCredenciales(
  destinatarios: any[],
  infoUsuario: { nombre: string; username: string; tipo: string },
  passwordTemporal: string
): Promise<{ exito: boolean; destinatarioUsado: string; metodo: string; detalles: string[] }> {
  const detalles: string[] = []
  const asunto = `Recuperación de credenciales — ${infoUsuario.nombre}`.slice(0, 90)

  const cuerpoHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Jsadr · Aurora Bancaria</h1>
        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Recuperación de credenciales (${infoUsuario.tipo})</p>
      </div>
      <div style="background: #1a1530; padding: 24px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
        <p style="margin: 0 0 16px 0; font-size: 14px;">Hola,</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
          El administrador ha restablecido las credenciales de <strong style="color: #a855f7;">${infoUsuario.nombre}</strong>.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Usuario</p>
          <p style="margin: 0 0 12px 0; font-size: 16px; font-family: monospace; color: #e2e8f0;">${infoUsuario.username}</p>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Contraseña temporal</p>
          <p style="margin: 0; font-size: 16px; font-family: monospace; color: #a855f7; font-weight: 600;">${passwordTemporal}</p>
        </div>
        <p style="margin: 16px 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
          Esta contraseña es <strong>temporal y válida por 24 horas</strong>. Al iniciar sesión, el sistema pedirá cambiarla.
        </p>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
          Mensaje automático generado el ${new Date().toLocaleString('es-CO')}.
        </p>
      </div>
    </div>
  `

  const cuerpoTexto = `
Jsadr · Aurora Bancaria — Recuperación de credenciales (${infoUsuario.tipo})

El administrador ha restablecido las credenciales de ${infoUsuario.nombre}.

Usuario: ${infoUsuario.username}
Contraseña temporal: ${passwordTemporal}

Esta contraseña es temporal y válida por 24 horas.

Mensaje automático generado el ${new Date().toLocaleString('es-CO')}.
  `.trim()

  const mensajeWhats = `*Jsadr · Aurora Bancaria*\n\nRecuperación de credenciales (${infoUsuario.tipo})\n\nUsuario: \`${infoUsuario.username}\`\nContraseña temporal: \`${passwordTemporal}\`\n\nVálida por 24 horas. Cámbiala al iniciar sesión.`

  for (const dest of destinatarios) {
    try {
      if (dest.tipo === 'EMAIL') {
        const resultado = await enviarEmail({
          to: dest.destino,
          subject: asunto,
          text: cuerpoTexto,
          html: cuerpoHtml,
        })
        if (resultado.success) {
          detalles.push(`Enviado a ${dest.destino} (correo)`)
          return { exito: true, destinatarioUsado: dest.destino, metodo: 'EMAIL', detalles }
        } else {
          detalles.push(`Fallo ${dest.destino} (correo): ${resultado.error || 'error'}`)
        }
      } else if (dest.tipo === 'WHATSAPP') {
        const resultado = await enviarWhatsApp(dest.destino, mensajeWhats)
        if (resultado.linkWaMe) {
          detalles.push(`Link WhatsApp generado para ${dest.destino}`)
          return { exito: true, destinatarioUsado: dest.destino, metodo: 'WHATSAPP', detalles }
        } else {
          detalles.push(`Fallo WhatsApp ${dest.destino}: ${resultado.error || 'error'}`)
        }
      }
    } catch (err: any) {
      detalles.push(`Excepción en ${dest.destino}: ${err.message}`)
    }
  }
  return { exito: false, destinatarioUsado: '', metodo: '', detalles }
}

// === GET — Listar historial de recuperaciones ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    // Buscar bitácora en Configuracion (claves RECUPERACION_*)
    const registros = await db.configuracion.findMany({
      where: {
        clave: { startsWith: 'RECUPERACION_' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    // Buscar también audit logs de recuperación
    const auditLogs = await db.auditLog.findMany({
      where: {
        accion: {
          in: [
            'RECUPERACION_CLAVE_SOLICITADA',
            'RECUPERACION_CLAVE_NO_ENCONTRADO',
            'RECUPERACION_CLAVE_ADMIN_RESET',
            'RECUPERACION_CLAVE_CLIENTE_RESET',
          ],
        },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    })

    // Combinar y formatear
    const historial = [
      ...registros.map((r) => {
        try {
          const data = JSON.parse(r.valor)
          return {
            id: r.id,
            fecha: r.updatedAt,
            tipo: data.username?.includes('@') ? 'CLIENTE' : 'USUARIO',
            usuarioNombre: data.usuarioNombre,
            username: data.username,
            metodo: data.metodoEnvio,
            destinatario: data.destinatario,
            exito: data.exito,
            ip: data.ip,
            detalles: data.detalles,
            origen: 'AUTO',
          }
        } catch {
          return null
        }
      }),
      ...auditLogs.map((a) => {
        let data: any = {}
        try {
          data = a.detalles ? JSON.parse(a.detalles) : {}
        } catch {}
        return {
          id: a.id,
          fecha: a.fecha,
          tipo: a.accion.includes('CLIENTE') ? 'CLIENTE' : 'USUARIO',
          usuarioNombre: a.usuarioNombre || '',
          username: data.identificador || data.username || '',
          metodo: data.metodoEnvio || '',
          destinatario: data.destinatario || '',
          exito: a.exito,
          ip: a.ipOrigen || '',
          detalles: [],
          origen: a.accion.includes('ADMIN') ? 'ADMIN_RESET' : 'AUTO',
        }
      }),
    ]
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 100)

    // Estadísticas
    const stats = {
      totalSolicitudes: historial.length,
      exitosas: historial.filter((h: any) => h.exito).length,
      fallidas: historial.filter((h: any) => !h.exito).length,
      porMetodo: {
        EMAIL: historial.filter((h: any) => h.metodo === 'EMAIL').length,
        WHATSAPP: historial.filter((h: any) => h.metodo === 'WHATSAPP').length,
      },
    }

    // Destinatarios configurados
    const destinatarios = await leerDestinatarios()

    return NextResponse.json({
      success: true,
      data: {
        historial,
        stats,
        destinatarios,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// === POST — Acciones manuales del admin ===
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { accion } = body

    // ============================================================
    // ACCIÓN: Resetear credenciales de un USUARIO (admin/gestor/consultor)
    // ============================================================
    if (accion === 'reset_usuario') {
      const { usuarioId, enviarNotificacion = true } = body
      if (!usuarioId) {
        return NextResponse.json(
          { success: false, error: 'usuarioId es obligatorio' },
          { status: 400 }
        )
      }

      const usuario = await db.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nombre: true, username: true, email: true, rol: true, activo: true },
      })

      if (!usuario) {
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado' },
          { status: 404 }
        )
      }

      const passwordTemporal = generarPasswordTemporal()
      const passwordHash = await hashPassword(passwordTemporal)

      await db.usuario.update({
        where: { id: usuario.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      })

      let envioResultado: any = null
      if (enviarNotificacion) {
        const destinatarios = await leerDestinatarios()
        envioResultado = await enviarCredenciales(
          destinatarios,
          { nombre: usuario.nombre, username: usuario.username, tipo: 'Usuario del sistema' },
          passwordTemporal
        )
      }

      // Bitácora en Configuracion
      try {
        await db.configuracion.create({
          data: {
            clave: `RECUPERACION_${usuario.id}_${Date.now()}`,
            valor: JSON.stringify({
              usuarioId: usuario.id,
              usuarioNombre: usuario.nombre,
              username: usuario.username,
              fechaSolicitud: new Date().toISOString(),
              ip: clientInfo.ip,
              userAgent: clientInfo.userAgent,
              metodoEnvio: envioResultado?.metodo || '',
              destinatario: envioResultado?.destinatarioUsado || '',
              exito: envioResultado?.exito ?? false,
              detalles: envioResultado?.detalles || ['Reset manual sin envío'],
              origen: 'ADMIN_RESET',
              adminId: auth.id,
              adminNombre: auth.nombre,
            }),
            descripcion: `Reset admin — ${usuario.nombre} (por ${auth.nombre})`,
          },
        })
      } catch {}

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'RECUPERACION_CLAVE_ADMIN_RESET',
        modulo: 'seguridad',
        entidadId: usuario.id,
        entidadNombre: usuario.username,
        detalles: JSON.stringify({
          usuarioResetado: usuario.username,
          metodoEnvio: envioResultado?.metodo || 'NONE',
          destinatario: envioResultado?.destinatarioUsado || '',
          exito: envioResultado?.exito ?? false,
        }),
        exito: true,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: `Credenciales de ${usuario.nombre} restablecidas`,
        data: {
          usuario: { id: usuario.id, nombre: usuario.nombre, username: usuario.username },
          passwordTemporal: enviarNotificacion ? undefined : passwordTemporal, // solo si no se envió
          envio: envioResultado,
        },
      })
    }

    // ============================================================
    // ACCIÓN: Resetear credenciales de un CLIENTE (clave del portal)
    // ============================================================
    if (accion === 'reset_cliente') {
      const { clienteId, enviarNotificacion = true } = body
      if (!clienteId) {
        return NextResponse.json(
          { success: false, error: 'clienteId es obligatorio' },
          { status: 400 }
        )
      }

      const cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          email: true,
        },
      })

      if (!cliente) {
        return NextResponse.json(
          { success: false, error: 'Cliente no encontrado' },
          { status: 404 }
        )
      }

      // Generar nueva clave de portal alfanumérica
      const nuevaClave = generarPasswordTemporal().slice(0, 10) // 10 caracteres para cliente
      const claveHash = await hashPassword(nuevaClave)

      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          claveHash,
          claveCreatedAt: new Date(),
          claveIntentos: 0,
          claveBloqueadoHasta: null,
          claveResetToken: null,
          claveResetExpira: null,
        },
      })

      // Enviar la nueva clave al cliente directamente por WhatsApp
      let envioResultado: any = null
      if (enviarNotificacion && cliente.telefono) {
        const mensajeCliente = `*Jsadr · Aurora Bancaria*\n\nHola ${cliente.nombre}, el administrador ha restablecido tu clave del portal del cliente.\n\nNueva clave: \`${nuevaClave}\`\n\nInicia sesión en el portal con tu cédula (${cliente.cedula}) y esta clave. Cámbiala cuando ingreses.\n\nSi no solicitaste este cambio, contáctanos.`

        const resultado = await enviarWhatsApp(cliente.telefono, mensajeCliente)
        envioResultado = {
          exito: !!resultado.linkWaMe,
          destinatarioUsado: cliente.telefono,
          metodo: 'WHATSAPP',
          linkWaMe: resultado.linkWaMe,
          detalles: [resultado.linkWaMe ? 'Link generado' : `Fallo: ${resultado.error}`],
        }
      }

      // Bitácora en Configuracion
      try {
        await db.configuracion.create({
          data: {
            clave: `RECUPERACION_CLIENTE_${cliente.id}_${Date.now()}`,
            valor: JSON.stringify({
              usuarioId: cliente.id,
              usuarioNombre: cliente.nombre,
              username: cliente.cedula,
              fechaSolicitud: new Date().toISOString(),
              ip: clientInfo.ip,
              userAgent: clientInfo.userAgent,
              metodoEnvio: envioResultado?.metodo || '',
              destinatario: envioResultado?.destinatarioUsado || '',
              exito: envioResultado?.exito ?? false,
              detalles: envioResultado?.detalles || ['Reset manual sin envío'],
              origen: 'ADMIN_RESET_CLIENTE',
              adminId: auth.id,
              adminNombre: auth.nombre,
            }),
            descripcion: `Reset admin (cliente) — ${cliente.nombre} (por ${auth.nombre})`,
          },
        })
      } catch {}

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'RECUPERACION_CLAVE_CLIENTE_RESET',
        modulo: 'seguridad',
        entidadId: cliente.id,
        entidadNombre: cliente.cedula,
        detalles: JSON.stringify({
          clienteResetado: cliente.nombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          metodoEnvio: envioResultado?.metodo || 'NONE',
          exito: envioResultado?.exito ?? false,
        }),
        exito: true,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: `Clave de ${cliente.nombre} restablecida`,
        data: {
          cliente: { id: cliente.id, nombre: cliente.nombre, cedula: cliente.cedula },
          nuevaClave: enviarNotificacion ? undefined : nuevaClave,
          envio: envioResultado,
        },
      })
    }

    // ============================================================
    // ACCIÓN: Configurar destinatarios de recuperación
    // ============================================================
    if (accion === 'config_destinatarios') {
      const { destinatarios } = body
      if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
        return NextResponse.json(
          { success: false, error: 'destinatarios debe ser un arreglo no vacío' },
          { status: 400 }
        )
      }

      // Validar formato
      for (const d of destinatarios) {
        if (!d.tipo || !d.destino) {
          return NextResponse.json(
            { success: false, error: 'Cada destinatario debe tener tipo y destino' },
            { status: 400 }
          )
        }
        if (!['EMAIL', 'WHATSAPP'].includes(d.tipo)) {
          return NextResponse.json(
            { success: false, error: 'tipo debe ser EMAIL o WHATSAPP' },
            { status: 400 }
          )
        }
      }

      await db.configuracion.upsert({
        where: { clave: 'DESTINATARIOS_RECUPERACION' },
        update: {
          valor: JSON.stringify(destinatarios),
          descripcion: 'Destinatarios para recuperación de claves',
        },
        create: {
          clave: 'DESTINATARIOS_RECUPERACION',
          valor: JSON.stringify(destinatarios),
          descripcion: 'Destinatarios para recuperación de claves',
        },
      })

      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        accion: 'RECUPERACION_CONFIG_DESTINATARIOS',
        modulo: 'seguridad',
        detalles: JSON.stringify({ destinatarios }),
        exito: true,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        mensaje: 'Destinatarios actualizados',
        data: { destinatarios },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Use: reset_usuario | reset_cliente | config_destinatarios' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}
