import nodemailer from 'nodemailer'
import { db } from './db'
import { decryptSensitive } from './security'

// === TRANSPORTES EN MEMORIA (cache) ===
// Para no recrear el transporter en cada envío
let cachedTransporter: nodemailer.Transporter | null = null
let cachedConfigHash: string = ''

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromEmail: string
}

/**
 * Obtiene la configuración SMTP activa desde la tabla ConexionAPI.
 * Si no hay ninguna configurada, retorna null (se usará Ethereal como fallback).
 */
async function obtenerConfigSmtp(): Promise<SmtpConfig | null> {
  try {
    const conexion = await db.conexionAPI.findFirst({
      where: {
        tipo: 'EMAIL_SMTP',
        activa: true,
      },
    })

    if (!conexion) {
      // Fallback: intentar con CorreoInstitucional (panel Configuración Global)
      return await obtenerConfigSmtpFromCorreoInstitucional()
    }

    // Campos según schema ConexionAPI:
    // - url (host:port o solo host) o configuracionExtra JSON con host/port/secure
    // - usuario (SMTP user)
    // - password (SMTP pass, encriptado)
    // - apiKey (fromEmail) o configuracionExtra.fromEmail
    // - configuracionExtra: JSON con host, port, secure, fromName, fromEmail

    let host = ''
    let port = 587
    let secure = false
    let fromName = 'Sistema de Préstamos'
    let fromEmail = ''

    // Parsear configuracionExtra si existe
    if (conexion.configuracionExtra) {
      try {
        const extra = JSON.parse(conexion.configuracionExtra)
        if (extra.host) host = extra.host
        if (extra.port) port = parseInt(extra.port)
        if (extra.secure !== undefined) secure = !!extra.secure
        if (extra.fromName) fromName = extra.fromName
        if (extra.fromEmail) fromEmail = extra.fromEmail
      } catch {
        // Ignorar errores de parseo
      }
    }

    // Si url está en formato "host:port", separarlo
    if (!host && conexion.url) {
      const urlParts = conexion.url.split(':')
      host = urlParts[0]
      if (urlParts[1]) port = parseInt(urlParts[1])
    }

    // Si aún no hay host, no se puede usar
    if (!host) return null

    // Usuario y password (desencriptar password)
    const user = conexion.usuario || ''
    let pass = ''
    if (conexion.password) {
      try {
        pass = decryptSensitive(conexion.password)
      } catch {
        pass = conexion.password // quizás no está encriptado
      }
    }

    // fromEmail: usar conexion.apiKey si existe, o configuracionExtra.fromEmail
    if (!fromEmail) fromEmail = conexion.apiKey || user

    if (!user || !pass || !fromEmail) return null

    return { host, port, secure, user, pass, fromName, fromEmail }
  } catch (error) {
    console.error('[email] Error obteniendo config SMTP:', error)
    return null
  }
}

/**
 * Fallback alternativo: configuración SMTP desde la tabla CorreoInstitucional
 * (la configurada vía el panel de Configuración Global → Correos).
 * Se invoca si ConexionAPI no tiene ninguna fila EMAIL_SMTP activa.
 */
async function obtenerConfigSmtpFromCorreoInstitucional(): Promise<SmtpConfig | null> {
  try {
    const correo = await db.correoInstitucional.findFirst({
      where: { estado: 'activo', esPrincipal: true },
    })
    if (!correo) return null
    if (!correo.smtpHost || !correo.smtpPort || !correo.smtpUser || !correo.email) return null
    let pass = ''
    if (correo.smtpPass) {
      try { pass = decryptSensitive(correo.smtpPass) } catch { pass = correo.smtpPass }
    }
    if (!pass) return null
    return {
      host: correo.smtpHost,
      port: correo.smtpPort,
      secure: correo.smtpPort === 465,
      user: correo.smtpUser,
      pass,
      fromName: correo.nombreRemitente || correo.aliasRemitente || correo.nombre || 'Sistema de Préstamos',
      fromEmail: correo.email,
    }
  } catch (error) {
    console.error('[email] Error en CorreoInstitucional fallback:', error)
    return null
  }
}

/**
 * Crea o reutiliza un transporter de Nodemailer según la configuración SMTP activa.
 */
async function obtenerTransporter(): Promise<{
  transporter: nodemailer.Transporter
  config: SmtpConfig | null
  isEthereal: boolean
  etherealUrl?: string
}> {
  const config = await obtenerConfigSmtp()

  if (config) {
    // Crear hash de configuración para detectar cambios — INCLUYE pass
    // (anteriormente solo host:port:user, lo que impedía rotar la clave SMTP
    // sin reiniciar el proceso — las instancias warm de Vercel seguían usando
    // la clave anterior ya revocada por Brevo).
    const hash = `${config.host}:${config.port}:${config.user}:${config.pass.slice(-6)}`
    if (cachedTransporter && cachedConfigHash === hash) {
      return { transporter: cachedTransporter, config, isEthereal: false }
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })
    cachedTransporter = transporter
    cachedConfigHash = hash
    return { transporter, config, isEthereal: false }
  }

  // FALLBACK: En desarrollo usar Ethereal (captura correos de prueba).
  // En producción NO usar Ethereal — devolver error explícito para que el
  // llamador (recuperar-clave, chat OTP, etc.) pueda reportar el fallo.
  if (process.env.NODE_ENV === 'production') {
    // Producción: exigir SMTP configurado en ConexionAPI o CorreoInstitucional
    const correoCfg = await obtenerConfigSmtpFromCorreoInstitucional()
    if (correoCfg) {
      const transporter = nodemailer.createTransport({
        host: correoCfg.host,
        port: correoCfg.port,
        secure: correoCfg.secure,
        auth: { user: correoCfg.user, pass: correoCfg.pass },
      })
      cachedTransporter = transporter
      cachedConfigHash = `${correoCfg.host}:${correoCfg.port}:${correoCfg.user}`
      return { transporter, config: correoCfg, isEthereal: false }
    }
    // Sin SMTP configurado: devolver transporter dummy que fallará al enviar
    // con un mensaje claro, en vez de mandar correos a Ethereal silenciosamente.
    throw new Error(
      'SMTP no configurado en producción. Configura ConexionAPI.EMAIL_SMTP activa o CorreoInstitucional principal activa.'
    )
  }
  // Modo desarrollo: usar Ethereal para no depender de SMTP real
  const testAccount = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  })
  cachedTransporter = transporter
  cachedConfigHash = 'ethereal:' + testAccount.user
  return { transporter, config: null, isEthereal: true }
}

export interface ResultadoEnvioEmail {
  success: boolean
  messageId?: string
  previewUrl?: string // solo en Ethereal
  isEthereal: boolean
  configUsada: boolean // true si se usó SMTP real, false si Ethereal
  error?: string
  fromEmail?: string
}

/**
 * Envía un correo electrónico.
 * - Si hay SMTP configurado en ConexionAPI, lo usa.
 * - Si no, usa Ethereal Email (captura correos de prueba) y devuelve previewUrl.
 */
export async function enviarEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text?: string
  html?: string
}): Promise<ResultadoEnvioEmail> {
  try {
    const { transporter, config, isEthereal } = await obtenerTransporter()

    const fromName = config?.fromName || 'Sistema de Préstamos'
    const fromEmail = config?.fromEmail || 'jsa@jsadr.com.co'

    // Reforzado: sanitizar headers contra CRLF injection
    // Cualquier \r o \n permite inyectar headers adicionales (Bcc, CC, etc.)
    const sanitizeHeader = (value: string): string => value.replace(/[\r\n]/g, '').trim()
    const safeTo = sanitizeHeader(to)
    const safeSubject = sanitizeHeader(subject)
    const safeFromName = sanitizeHeader(fromName)
    const safeFromEmail = sanitizeHeader(fromEmail)

    // Reforzado: validar formato de email del destinatario
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(safeTo)) {
      return {
        success: false,
        error: 'Email del destinatario inválido',
        isEthereal: false,
        configUsada: false,
      }
    }

    const info = await transporter.sendMail({
      from: `"${safeFromName}" <${safeFromEmail}>`,
      to: safeTo,
      subject: safeSubject,
      text: text || '',
      html: html || text || '',
    })

    // Registrar en EnvioCorreo para auditoría
    try {
      const correoInstitucionalId = await db.correoInstitucional.findFirst({
        where: { email: fromEmail, estado: 'activo' },
        select: { id: true },
      })
      await db.envioCorreo.create({
        data: {
          correoInstitucionalId: correoInstitucionalId?.id || null,
          remitenteEmail: fromEmail,
          destinatario: safeTo,
          asunto: safeSubject,
          cuerpo: (text || html || '').slice(0, 5000),
          formato: html ? 'html' : 'texto',
          estado: 'ENVIADO',
          fechaEnvio: new Date(),
          enviadoPorNombre: 'Sistema',
          metadata: JSON.stringify({ messageId: info.messageId }),
        },
      })
    } catch (e) {
      // No fallar el envío si la auditoría falla
      console.error('[email] No se pudo registrar EnvioCorreo:', e)
    }

    if (isEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined
      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
        isEthereal: true,
        configUsada: false,
        fromEmail,
      }
    }

    return {
      success: true,
      messageId: info.messageId,
      isEthereal: false,
      configUsada: true,
      fromEmail,
    }
  } catch (error: any) {
    console.error('[email] Error enviando email:', error)
    // Registrar fallo en EnvioCorreo también
    try {
      await db.envioCorreo.create({
        data: {
          remitenteEmail: 'sistema@no-configurado',
          destinatario: to,
          asunto: subject,
          cuerpo: (text || html || '').slice(0, 5000),
          estado: 'FALLIDO',
          fechaEnvio: new Date(),
          enviadoPorNombre: 'Sistema',
          mensajeError: error.message?.slice(0, 500),
        },
      })
    } catch {}
    return {
      success: false,
      isEthereal: false,
      configUsada: false,
      error: error.message,
    }
  }
}

/**
 * Verifica si hay SMTP configurado y activo.
 */
export async function haySmtpConfigurado(): Promise<boolean> {
  const config = await obtenerConfigSmtp()
  if (config) return true
  // Verificar también CorreoInstitucional como fallback
  const correo = await obtenerConfigSmtpFromCorreoInstitucional()
  return correo !== null
}

/**
 * Prueba la conexión SMTP.
 */
export async function probarSmtp(): Promise<{
  success: boolean
  message: string
  config?: SmtpConfig
}> {
  try {
    const { transporter, config, isEthereal } = await obtenerTransporter()
    if (isEthereal) {
      return {
        success: false,
        message:
          'No hay SMTP configurado. Se está usando Ethereal Email (modo de prueba). Configura una conexión EMAIL_SMTP en Conexiones API.',
      }
    }
    await transporter.verify()
    return {
      success: true,
      message: `Conexión SMTP verificada correctamente con ${config!.host}:${config!.port}`,
      config: {
        ...config!,
        pass: '***', // no exponer password
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Error de conexión SMTP: ${error.message}`,
    }
  }
}
