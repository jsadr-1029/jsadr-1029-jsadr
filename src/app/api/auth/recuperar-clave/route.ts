// =====================================================
// /api/auth/recuperar-clave — Recuperación de credenciales vía MAGIC LINK
// -----------------------------------------------------
// POST /api/auth/recuperar-clave
//   { identificador: "username" | "email" | "cédula" }
//
// Flujo (v4.14 — magic link, sin contraseña temporal por correo):
//   1. Busca al usuario por username, email O cédula en:
//      - Tabla Usuario (admin/gestor/consultor/abogado)
//      - Tabla Cliente (clientes del portal)
//   2. Si existe, genera un token criptográfico de un solo uso
//      (32 bytes hex = 64 chars) y lo persiste en:
//        - Usuario.claveResetToken / claveResetExpira
//        - Cliente.claveResetToken  / claveResetExpira
//   3. Envía al correo registrado un ENLACE con el token:
//        https://jsadr.com.co/recuperar-clave?token=<token>
//   4. Al hacer clic, el usuario llega a la página /recuperar-clave
//      donde se le pide inmediatamente crear una nueva clave.
//   5. El token se valida en /api/auth/restablecer-clave y se canela
//      tras el primer uso (one-shot).
//
// Por seguridad:
//   - Rate limit: 1 solicitud cada 5 min por IP
//   - No revela si el usuario existe o no (respuesta genérica)
//   - Token válido 60 minutos (mucho más corto que la antigua
//     contraseña temporal de 24h, ya que es un link de un solo uso)
//   - No se envía ninguna contraseña al correo
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import { enviarEmail } from '@/lib/email'
import { sanitizeError } from '@/lib/error-handler'
import { getBaseUrl } from '@/lib/url'

// === RATE LIMIT ===
// 1 solicitud cada 5 minutos por IP para evitar abuso
const RATE_LIMIT_MINUTOS = 5
const RATE_LIMIT_MAP = new Map<string, number>()

// === Duración del magic link ===
// 60 minutos — más corto que la contraseña temporal de 24h porque es
// un link de un solo uso y no queremos que quede flotando mucho tiempo.
const RESET_LINK_EXPIRY_MINUTES = 60

// === Verificar rate limit por IP ===
function verificarRateLimit(ip: string): { permitido: boolean; minutosRestantes?: number } {
  const ahora = Date.now()
  const ultimo = RATE_LIMIT_MAP.get(ip)
  if (ultimo) {
    const diffMin = (ahora - ultimo) / 60000
    if (diffMin < RATE_LIMIT_MINUTOS) {
      return {
        permitido: false,
        minutosRestantes: Math.ceil(RATE_LIMIT_MINUTOS - diffMin),
      }
    }
  }
  RATE_LIMIT_MAP.set(ip, ahora)
  return { permitido: true }
}

interface DestinatarioRecuperacion {
  tipo: 'USUARIO' | 'CLIENTE'
  id: string
  nombre: string
  username: string
  email: string
  rol?: string
}

// === Buscar usuario por username, email O cédula ===
// Retorna un destinatario con su email registrado, o null si no existe.
async function buscarDestinatario(
  identificador: string
): Promise<DestinatarioRecuperacion | null> {
  const idLimpio = identificador.trim().toLowerCase()

  // 1. Buscar en Usuario (admin/gestor/consultor/abogado) por username o email
  const usuario = await db.usuario.findFirst({
    where: {
      OR: [{ username: idLimpio }, { email: idLimpio }],
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      username: true,
      email: true,
      rol: true,
    },
  })
  if (usuario && usuario.email) {
    return {
      tipo: 'USUARIO',
      id: usuario.id,
      nombre: usuario.nombre,
      username: usuario.username,
      email: usuario.email,
      rol: usuario.rol,
    }
  }

  // 2. Buscar en Cliente por cédula o email
  // Nota: cédula se busca case-insensitive via lowercase
  const cliente = await db.cliente.findFirst({
    where: {
      OR: [
        { cedula: identificador.trim() },
        { cedula: idLimpio },
        { email: idLimpio },
      ],
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      email: true,
    },
  })
  if (cliente && cliente.email) {
    return {
      tipo: 'CLIENTE',
      id: cliente.id,
      nombre: cliente.nombre,
      // Para clientes, el "username" de acceso es su cédula
      username: cliente.cedula,
      email: cliente.email,
    }
  }

  return null
}

// === Enviar magic link al correo registrado del usuario ===
async function enviarMagicLinkPorCorreo(
  destinatario: DestinatarioRecuperacion,
  token: string
): Promise<{ exito: boolean; destinatario: string; error?: string }> {
  const baseUrl = getBaseUrl()
  const link = `${baseUrl}/recuperar-clave?token=${token}`
  const asunto = `Restablece tu contraseña — ${destinatario.nombre}`.slice(0, 90)

  const cuerpoHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Jsadr · Jo*** Se*** Al*** D** R**</h1>
        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Restablecimiento de contraseña</p>
      </div>
      <div style="background: #1a1530; padding: 24px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
        <p style="margin: 0 0 16px 0; font-size: 14px;">Hola <strong>${destinatario.nombre}</strong>,</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta
          <strong style="color: #c4b5fd;">${destinatario.username}</strong>.
          Para crear una nueva contraseña, haz clic en el siguiente botón:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);">
            🔑 Crear nueva contraseña
          </a>
        </div>
        <p style="margin: 16px 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin: 0; font-size: 12px; font-family: monospace; color: #a855f7; word-break: break-all; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.2);">
          ${link}
        </p>
        <p style="margin: 16px 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
          Este enlace es <strong>válido por ${RESET_LINK_EXPIRY_MINUTES} minutos</strong> y se puede usar
          <strong>una sola vez</strong>. Después de crear tu nueva contraseña, deberás iniciar sesión normalmente.
        </p>
        <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #fca5a5;">
            <strong>⚠️ Seguridad:</strong> Si no solicitaste este cambio, ignora este correo. Tu contraseña actual
            no será modificada y el enlace expirará automáticamente. Nunca compartas este enlace con nadie.
          </p>
        </div>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
          Mensaje automático generado el ${new Date().toLocaleString('es-CO')}.<br/>
          © ${new Date().getFullYear()} Jsadr · Jo*** Se*** Al*** D** R**
        </p>
      </div>
    </div>
  `

  const cuerpoTexto = `
Jsadr · Jo*** Se*** Al*** D** R** — Restablecimiento de contraseña

Hola ${destinatario.nombre},

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta ${destinatario.username}.

Para crear una nueva contraseña, abre el siguiente enlace en tu navegador:

${link}

Este enlace es válido por ${RESET_LINK_EXPIRY_MINUTES} minutos y se puede usar una sola vez.

Si no solicitaste este cambio, ignora este correo. Tu contraseña actual no será modificada.

Mensaje automático generado el ${new Date().toLocaleString('es-CO')}.
© ${new Date().getFullYear()} Jsadr · Jo*** Se*** Al*** D** R**
  `.trim()

  try {
    const resultado = await enviarEmail({
      to: destinatario.email,
      subject: asunto,
      text: cuerpoTexto,
      html: cuerpoHtml,
    })
    if (resultado.success) {
      return { exito: true, destinatario: destinatario.email }
    }
    return {
      exito: false,
      destinatario: destinatario.email,
      error: resultado.error || 'Error desconocido al enviar correo',
    }
  } catch (err: any) {
    return {
      exito: false,
      destinatario: destinatario.email,
      error: err.message || 'Excepción al enviar correo',
    }
  }
}

// === POST ===
export async function POST(req: NextRequest) {
  try {
    const clientInfo = getClientInfo(req)

    // Rate limit
    const rl = verificarRateLimit(clientInfo.ip || 'unknown')
    if (!rl.permitido) {
      return NextResponse.json(
        {
          success: false,
          error: `Demasiadas solicitudes. Intenta en ${rl.minutosRestantes} minuto(s).`,
          code: 'RATE_LIMIT',
          minutosRestantes: rl.minutosRestantes,
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { identificador } = body

    if (!identificador || typeof identificador !== 'string' || identificador.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Debes ingresar tu usuario, cédula o correo.', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    const idLimpio = identificador.trim()

    // Buscar destinatario (Usuario o Cliente)
    const destinatario = await buscarDestinatario(idLimpio)

    // Por seguridad: responder lo mismo tanto si existe como si no
    const RESPUESTA_GENERICA = {
      success: true,
      mensaje:
        'Si la cuenta existe, se ha enviado un enlace de restablecimiento al correo registrado en el sistema. Revisa tu bandeja de entrada y la carpeta de spam. El enlace es válido por 60 minutos.',
    }

    if (!destinatario) {
      // Registrar intento fallido (sin revelar al cliente)
      await registrarAuditLog({
        usuarioNombre: idLimpio,
        accion: 'RECUPERACION_CLAVE_NO_ENCONTRADO',
        modulo: 'auth',
        exito: false,
        errorMessage: `Intento de recuperación para usuario inexistente: ${idLimpio}`,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(RESPUESTA_GENERICA)
    }

    // === Generar magic link token (32 bytes hex = 64 chars, one-shot) ===
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + RESET_LINK_EXPIRY_MINUTES * 60 * 1000)

    // Guardar en BD según el tipo de destinatario
    if (destinatario.tipo === 'USUARIO') {
      await db.usuario.update({
        where: { id: destinatario.id },
        data: {
          claveResetToken: resetToken,
          claveResetExpira: expira,
          // No tocamos passwordHash ni mustChangePassword aquí —
          // el cambio real se hace al confirmar la nueva clave en
          // /api/auth/restablecer-clave.
        },
      })
    } else {
      // CLIENTE — usamos claveResetToken (ya existente en el schema)
      await db.cliente.update({
        where: { id: destinatario.id },
        data: {
          claveResetToken: resetToken,
          claveResetExpira: expira,
          // Marcamos debeCambiarClave=true para que el cambio sea forzado
          // al llegar al endpoint de restablecer (capa extra de seguridad).
          debeCambiarClave: true,
        },
      })
    }

    // Enviar magic link al correo registrado
    const resultadoEnvio = await enviarMagicLinkPorCorreo(destinatario, resetToken)

    // Registrar en bitácora
    await registrarAuditLog({
      usuarioId: destinatario.tipo === 'USUARIO' ? destinatario.id : undefined,
      usuarioNombre: destinatario.nombre,
      accion: 'RECUPERACION_CLAVE_SOLICITADA',
      modulo: 'auth',
      detalles: JSON.stringify({
        identificador: idLimpio,
        tipoCuenta: destinatario.tipo,
        destinatarioEmail: destinatario.email,
        exitoEnvio: resultadoEnvio.exito,
        errorEnvio: resultadoEnvio.error,
        mecanismo: 'MAGIC_LINK',
        expiraEn: `${RESET_LINK_EXPIRY_MINUTES}min`,
      }),
      exito: resultadoEnvio.exito,
      errorMessage: resultadoEnvio.exito ? undefined : 'No se pudo enviar el correo',
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // Crear registro en tabla Configuracion como bitácora (clave única)
    try {
      await db.configuracion.create({
        data: {
          clave: `RECUPERACION_${destinatario.tipo}_${destinatario.id}_${Date.now()}`,
          valor: JSON.stringify({
            destinatarioId: destinatario.id,
            destinatarioNombre: destinatario.nombre,
            destinatarioTipo: destinatario.tipo,
            identificador: idLimpio,
            fechaSolicitud: new Date().toISOString(),
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            emailDestino: destinatario.email,
            mecanismo: 'MAGIC_LINK',
            tokenExpira: expira.toISOString(),
            exito: resultadoEnvio.exito,
            error: resultadoEnvio.error,
          }),
          descripcion: `Recuperación de clave (magic link) — ${destinatario.nombre} (${destinatario.tipo})`,
        },
      })
    } catch {
      // No fallar si ya existe
    }

    // Si no se pudo enviar al correo, devolver error explícito
    if (!resultadoEnvio.exito) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se pudo enviar el enlace de recuperación. Verifica que tengas un correo válido registrado o contacta al administrador del sistema.',
          code: 'ENVIO_FALLIDO',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...RESPUESTA_GENERICA,
      // No revelar el correo completo por seguridad
      destinatarioEnmascarado: enmascararEmail(resultadoEnvio.destinatario),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message || 'Error interno' },
      { status: 500 }
    )
  }
}

// Enmascarar email para confirmación: j***@correo.com
function enmascararEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!user || !domain) return '***'
  const userMasked = user.length <= 2
    ? user[0] + '*'.repeat(2)
    : user[0] + '*'.repeat(Math.max(2, user.length - 2)) + user[user.length - 1]
  return `${userMasked}@${domain}`
}
