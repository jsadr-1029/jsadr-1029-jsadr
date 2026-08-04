import nodemailer from 'nodemailer'
import { db } from './db'
import { decryptSensitive } from './security'

// === TRANSPORTES EN MEMORIA (cache) ===
// Para no recrear el transporter en cada envío
let cachedTransporter: nodemailer.Transporter | null = null
let cachedConfigHash: string = ''

// === Caché de API key Brevo (HTTPS API) ===
// Para no leer la BD en cada envío
let cachedBrevoApiKey: string | null = null
let cachedBrevoApiKeyHash: string = ''

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

// =====================================================
// === BREVO HTTPS API (camino principal) ===
// =====================================================
// Brevo expone una API HTTPS en https://api.brevo.com/v3/smtp/email
// que NO tiene restricción de IP (a diferencia de SMTP).
// Usamos la API key (xkeysib-...) guardada en ConexionAPI.EMAIL_SMTP.apiKey
// como camino principal, con SMTP (xsmtpsib-...) como fallback.
// =====================================================

/**
 * Obtiene la API key de Brevo desde:
 *   1. process.env.BREVO_API_KEY (Vercel env var)
 *   2. ConexionAPI.EMAIL_SMTP.apiKey (BD, cifrada)
 *
 * Retorna null si no hay API key configurada.
 */
async function obtenerBrevoApiKey(): Promise<string | null> {
  // 1. Intentar desde env var (más rápido, evita query a BD)
  if (process.env.BREVO_API_KEY) {
    if (cachedBrevoApiKey !== process.env.BREVO_API_KEY) {
      cachedBrevoApiKey = process.env.BREVO_API_KEY
      cachedBrevoApiKeyHash = process.env.BREVO_API_KEY.slice(-6)
    }
    return cachedBrevoApiKey
  }

  // 2. Fallback: leer desde ConexionAPI.EMAIL_SMTP.apiKey (cifrado)
  try {
    const conexion = await db.conexionAPI.findFirst({
      where: { tipo: 'EMAIL_SMTP', activa: true },
      select: { apiKey: true },
    })
    if (!conexion?.apiKey) return null

    // Verificar si es un valor cifrado (formato iv:encrypted) o texto plano
    const parts = conexion.apiKey.split(':')
    if (parts.length === 2 && /^[0-9a-fA-F]+$/.test(parts[0]) && /^[0-9a-fA-F]+$/.test(parts[1])) {
      // Cifrado AES-256-CBC — desencriptar
      const decrypted = decryptSensitive(conexion.apiKey)
      const hash = decrypted.slice(-6)
      if (cachedBrevoApiKeyHash !== hash) {
        cachedBrevoApiKey = decrypted
        cachedBrevoApiKeyHash = hash
      }
      return cachedBrevoApiKey
    }
    // Texto plano (no debería pasar, pero por compatibilidad)
    return conexion.apiKey
  } catch (error) {
    console.error('[email] Error obteniendo Brevo API key:', error)
    return null
  }
}

/**
 * Envía un correo vía Brevo HTTPS API (POST /v3/smtp/email).
 * Retorna el messageId si fue exitoso, o null si falló.
 */
async function enviarPorBrevoApi(params: {
  apiKey: string
  to: string
  subject: string
  text?: string
  html?: string
  fromName: string
  fromEmail: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { apiKey, to, subject, text, html, fromName, fromEmail } = params

  try {
    // Sanitizar headers (defensa contra CRLF injection)
    const sanitize = (v: string) => v.replace(/[\r\n]/g, '').trim()
    const safeTo = sanitize(to)
    const safeSubject = sanitize(subject)
    const safeFromName = sanitize(fromName)
    const safeFromEmail = sanitize(fromEmail)

    // Validar email del destinatario
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(safeTo)) {
      return { success: false, error: 'Email del destinatario inválido' }
    }

    const body: any = {
      sender: { name: safeFromName, email: safeFromEmail },
      to: [{ email: safeTo }],
      subject: safeSubject,
    }
    if (html) body.htmlContent = html
    if (text) body.textContent = text

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return {
        success: false,
        error: `Brevo API HTTP ${res.status}: ${errBody.slice(0, 300)}`,
      }
    }

    const data = await res.json()
    return {
      success: true,
      messageId: data.messageId,
    }
  } catch (error: any) {
    return { success: false, error: `Brevo API exception: ${error.message}` }
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
 *
 * Estrategia de defensa en profundidad:
 *   1. BREVO HTTPS API (api.brevo.com/v3/smtp/email) — camino principal
 *      → No tiene restricción de IP, funciona en Vercel serverless sin config extra.
 *      → Usa la API key (xkeysib-...) de ConexionAPI.EMAIL_SMTP.apiKey (cifrada).
 *
 *   2. SMTP (smtp-relay.brevo.com:587) — fallback
 *      → Si la API HTTPS falla (caída del servicio, red, etc.) intenta SMTP.
 *      → Usa la SMTP key (xsmtpsib-...) de ConexionAPI.EMAIL_SMTP.password (cifrada).
 *      → En Vercel puede fallar con "525 5.7.1 Unauthorized IP" si IP restriction
 *        está activa en panel Brevo → por eso la API HTTPS es el camino principal.
 *
 *   3. Ethereal Email — solo en desarrollo (NODE_ENV !== 'production')
 *      → Captura correos de prueba sin enviar realmente.
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
  // Sanitizar headers (defensa contra CRLF injection)
  const sanitizeHeader = (value: string): string => value.replace(/[\r\n]/g, '').trim()
  const safeTo = sanitizeHeader(to)
  const safeSubject = sanitizeHeader(subject)

  // Validar email del destinatario
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(safeTo)) {
    return {
      success: false,
      error: 'Email del destinatario inválido',
      isEthereal: false,
      configUsada: false,
    }
  }

  // === Leer configuración SMTP (para fromName/fromEmail y como fallback) ===
  const config = await obtenerConfigSmtp()
  const correoCfg = config ?? (await obtenerConfigSmtpFromCorreoInstitucional())
  const fromName = correoCfg?.fromName || 'Sistema de Préstamos'
  const fromEmail = correoCfg?.fromEmail || 'jsa@jsadr.com.co'
  const safeFromName = sanitizeHeader(fromName)
  const safeFromEmail = sanitizeHeader(fromEmail)

  // === 1) INTENTAR BREVO HTTPS API (camino principal) ===
  const brevoApiKey = await obtenerBrevoApiKey()
  if (brevoApiKey) {
    const result = await enviarPorBrevoApi({
      apiKey: brevoApiKey,
      to: safeTo,
      subject: safeSubject,
      text,
      html,
      fromName: safeFromName,
      fromEmail: safeFromEmail,
    })

    if (result.success) {
      // Registrar envío exitoso en EnvioCorreo
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
            enviadoPorNombre: 'Sistema (Brevo API)',
            metadata: JSON.stringify({
              messageId: result.messageId,
              via: 'BREVO_HTTPS_API',
            }),
          },
        })
      } catch (e) {
        console.error('[email] No se pudo registrar EnvioCorreo (API success):', e)
      }

      return {
        success: true,
        messageId: result.messageId,
        isEthereal: false,
        configUsada: true,
        fromEmail,
      }
    }

    // Si la API falló, log y continuar al fallback SMTP
    console.warn('[email] Brevo HTTPS API falló, intentando SMTP fallback:', result.error)
  }

  // === 2) FALLBACK SMTP (camino secundario) ===
  try {
    const { transporter, config: smtpConfig, isEthereal } = await obtenerTransporter()

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
          enviadoPorNombre: 'Sistema (SMTP fallback)',
          metadata: JSON.stringify({
            messageId: info.messageId,
            via: 'SMTP_FALLBACK',
            apiFailedReason: brevoApiKey ? 'API intentada pero falló' : 'API key no configurada',
          }),
        },
      })
    } catch (e) {
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
    console.error('[email] Error enviando email (SMTP fallback también falló):', error)
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
