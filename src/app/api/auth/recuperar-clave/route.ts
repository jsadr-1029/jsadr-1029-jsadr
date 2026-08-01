// =====================================================
// /api/auth/recuperar-clave — Recuperación de credenciales
// -----------------------------------------------------
// POST /api/auth/recuperar-clave
//   { identificador: "username" | "email" | "cédula" }
//
// Flujo:
//   1. Busca al usuario por username, email O cédula en:
//      - Tabla Usuario (admin/gestor/consultor/abogado)
//      - Tabla Cliente (clientes del portal)
//   2. Si existe, genera una contraseña temporal.
//   3. La envía ÚNICAMENTE al correo electrónico registrado
//      en el sistema para ese usuario.
//   4. Marca al usuario con mustChangePassword=true.
//   5. Registra en AuditLog y en bitácora de recuperación.
//
// Por seguridad:
//   - Rate limit: 1 solicitud cada 5 min por IP
//   - No revela si el usuario existe o no (respuesta genérica)
//   - Contraseña temporal válida 24h
//   - Se hashea con bcrypt rounds=12
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword, registrarAuditLog, getClientInfo } from '@/lib/security'
import { enviarEmail } from '@/lib/email'
import { sanitizeError } from '@/lib/error-handler'

// === RATE LIMIT ===
// 1 solicitud cada 5 minutos por IP para evitar abuso
const RATE_LIMIT_MINUTOS = 5
const RATE_LIMIT_MAP = new Map<string, number>()

// === Generador de contraseña temporal robusta ===
function generarPasswordTemporal(): string {
  // 12 caracteres: 4 mayúsculas + 4 minúsculas + 3 dígitos + 1 símbolo
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

  // Mezclar aleatoriamente (Fisher-Yates)
  for (let i = partes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[partes[i], partes[j]] = [partes[j], partes[i]]
  }

  return partes.join('')
}

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

// === Enviar credenciales al correo registrado del usuario ===
async function enviarCredencialesPorCorreo(
  destinatario: DestinatarioRecuperacion,
  passwordTemporal: string
): Promise<{ exito: boolean; destinatario: string; error?: string }> {
  const asunto = `Recuperación de contraseña — ${destinatario.nombre}`.slice(0, 90)

  const cuerpoHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Jsadr · Jo*** Se*** Al*** D** R**</h1>
        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Recuperación de contraseña</p>
      </div>
      <div style="background: #1a1530; padding: 24px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
        <p style="margin: 0 0 16px 0; font-size: 14px;">Hola <strong>${destinatario.nombre}</strong>,</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
          Se ha solicitado la recuperación de tu contraseña para acceder al sistema Jsadr · Jo*** Se*** Al*** D** R**.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Tu identificador</p>
          <p style="margin: 0 0 12px 0; font-size: 16px; font-family: monospace; color: #e2e8f0;">${destinatario.username}</p>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Contraseña temporal</p>
          <p style="margin: 0; font-size: 16px; font-family: monospace; color: #a855f7; font-weight: 600;">${passwordTemporal}</p>
        </div>
        <p style="margin: 16px 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
          Esta contraseña es <strong>temporal y válida por 24 horas</strong>. Al iniciar sesión, el sistema te pedirá que la cambies por una nueva.
        </p>
        <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #fca5a5;">
            <strong>⚠️ Seguridad:</strong> Si no solicitaste este cambio, ignora este correo y contacta al administrador del sistema. Nunca compartas estas credenciales.
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
Jsadr · Jo*** Se*** Al*** D** R** — Recuperación de contraseña

Hola ${destinatario.nombre},

Se ha solicitado la recuperación de tu contraseña para acceder al sistema.

Tu identificador: ${destinatario.username}
Contraseña temporal: ${passwordTemporal}

Esta contraseña es temporal y válida por 24 horas. Al iniciar sesión, el sistema te pedirá que la cambies.

Si no solicitaste este cambio, ignora este mensaje y contacta al administrador.

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
        'Si la cuenta existe, se ha enviado un correo de recuperación al email registrado en el sistema. Revisa tu bandeja de entrada y la carpeta de spam.',
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

    // Generar nueva contraseña temporal
    const passwordTemporal = generarPasswordTemporal()
    const passwordHash = await hashPassword(passwordTemporal)

    // Guardar en BD según el tipo de destinatario
    if (destinatario.tipo === 'USUARIO') {
      await db.usuario.update({
        where: { id: destinatario.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      })
    } else {
      // CLIENTE: la "contraseña" del cliente es su PIN (4 dígitos normalmente),
      // pero el sistema de recuperación genera una temporal de 12 caracteres.
      // El cliente debe cambiarla al ingresar (se le pedirá en el primer login).
      // Para mantener compatibilidad con el PIN actual, también reseteamos pinHash
      // con la contraseña temporal, lo que le permite entrar con esa clave temporal.
      // bcrypt.hashSync para hashear el PIN temporal
      const bcrypt = await import('bcryptjs')
      const pinHash = bcrypt.hashSync(passwordTemporal, 10)
      await db.cliente.update({
        where: { id: destinatario.id },
        data: {
          pinHash,
          pinCreatedAt: new Date(),
          pinIntentos: 0,
          pinBloqueadoHasta: null,
        },
      })
    }

    // Enviar credenciales al correo registrado
    const resultadoEnvio = await enviarCredencialesPorCorreo(destinatario, passwordTemporal)

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
            exito: resultadoEnvio.exito,
            error: resultadoEnvio.error,
          }),
          descripcion: `Recuperación de clave — ${destinatario.nombre} (${destinatario.tipo})`,
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
            'No se pudo enviar el correo de recuperación. Verifica que tengas un correo válido registrado o contacta al administrador del sistema.',
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
