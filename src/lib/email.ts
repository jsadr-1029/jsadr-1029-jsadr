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

    if (!conexion) return null

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
    // Crear hash de configuración para detectar cambios
    const hash = `${config.host}:${config.port}:${config.user}`
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

  // FALLBACK: Crear cuenta de Ethereal Email (servicio de prueba que captura correos)
  // Solo para que el sistema funcione en desarrollo sin SMTP configurado
  const testAccount = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
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
  return config !== null
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
