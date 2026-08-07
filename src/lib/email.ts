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

// === Cache de "API key inválida" (evita reintentos inútiles) ===
// Si Brevo API devuelve 401/403, marcamos la key como inválida por 5 min
// para no golpear la API en cada envío (el OTP se va por SMTP fallback).
let brevoApiKeyInvalidUntil: number = 0
let brevoApiKeyInvalidHash: string = ''
const BREVO_API_INVALID_TTL_MS = 5 * 60 * 1000 // 5 minutos

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
      if (esCifradoAES(conexion.password)) {
        const decrypted = decryptSensitive(conexion.password)
        if (decrypted === conexion.password) {
          // desencripción falló — la llave de .env no coincide
          console.error(
            '[email][SMTP] password cifrado en ConexionAPI pero API_ENCRYPTION_KEY de .env no coincide. ' +
              'Ejecuta: BREVO_API_KEY=xkeysib-... BREVO_SMTP_KEY=xsmtpsib-... node scripts/save-brevo-creds.js'
          )
          return null
        }
        pass = decrypted
      } else {
        // texto plano (compatibilidad)
        pass = conexion.password
      }
    }

    // fromEmail: usar conexion.apiKey si existe, o configuracionExtra.fromEmail
    // Nota: apiKey puede ser la API key de Brevo (xkeysib-...) que NO es un email.
    // Solo usar como fromEmail si parece un email.
    if (!fromEmail) {
      const maybeEmail = conexion.apiKey || user
      if (maybeEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(maybeEmail)) {
        fromEmail = maybeEmail
      }
    }

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
      if (esCifradoAES(correo.smtpPass)) {
        const decrypted = decryptSensitive(correo.smtpPass)
        if (decrypted === correo.smtpPass) {
          console.error(
            '[email][SMTP-CorreoInstitucional] smtpPass cifrado pero API_ENCRYPTION_KEY de .env no coincide. ' +
              'Ejecuta: BREVO_API_KEY=xkeysib-... BREVO_SMTP_KEY=xsmtpsib-... node scripts/save-brevo-creds.js'
          )
          return null
        }
        pass = decrypted
      } else {
        pass = correo.smtpPass
      }
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
 * Verifica si una cadena tiene formato iv:encrypted_hex (cifrado AES-256-CBC).
 */
function esCifradoAES(s: string | null | undefined): boolean {
  if (!s) return false
  const parts = s.split(':')
  return parts.length === 2 && /^[0-9a-fA-F]+$/.test(parts[0]) && /^[0-9a-fA-F]+$/.test(parts[1])
}

/**
 * Obtiene la API key de Brevo desde:
 *   1. process.env.BREVO_API_KEY (Vercel env var)
 *   2. ConexionAPI.EMAIL_SMTP.apiKey (BD, cifrada)
 *
 * Retorna null si no hay API key configurada.
 *
 * Si la clave en BD está cifrada pero API_ENCRYPTION_KEY no coincide
 * (p. ej. .env fue regenerado), se detecta el fallo de desencripción
 * y se emite un warning claro en logs para que el admin pueda correr
 * `node scripts/save-brevo-creds.js` y re-cifrar con la llave actual.
 */
async function obtenerBrevoApiKey(): Promise<string | null> {
  // 1. Intentar desde env var (más rápido, evita query a BD)
  if (process.env.BREVO_API_KEY) {
    // Saltar inmediatamente si no tiene prefijo xkeysib- (SMTP key mal puesta en env)
    if (!process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
      console.warn(
        '[email][BREVO] BREVO_API_KEY de .env no empieza con "xkeysib-" ' +
          '(primeros 10 chars: "' + process.env.BREVO_API_KEY.slice(0, 10) + '"). ' +
          'Saltando HTTPS API — usando SMTP fallback.'
      )
      return null
    }
    if (cachedBrevoApiKey !== process.env.BREVO_API_KEY) {
      cachedBrevoApiKey = process.env.BREVO_API_KEY
      cachedBrevoApiKeyHash = process.env.BREVO_API_KEY.slice(-6)
    }
    // Si la key está marcada como inválida, no usarla
    if (Date.now() < brevoApiKeyInvalidUntil && brevoApiKeyInvalidHash === cachedBrevoApiKeyHash) {
      return null
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
    if (esCifradoAES(conexion.apiKey)) {
      // Cifrado AES-256-CBC — desencriptar
      const decrypted = decryptSensitive(conexion.apiKey)
      // Verificar que la desencripción realmente funcionó.
      // decryptSensitive devuelve el texto original si falla — detectar eso.
      if (decrypted === conexion.apiKey) {
        console.error(
          '[email][BREVO] apiKey cifrada en BD pero API_ENCRYPTION_KEY de .env no coincide. ' +
            'Ejecuta: BREVO_API_KEY=xkeysib-... BREVO_SMTP_KEY=xsmtpsib-... node scripts/save-brevo-creds.js'
        )
        return null
      }
      // Validar que tenga el prefijo correcto de Brevo HTTPS API (xkeysib-).
      // Si tiene prefijo xsmtpsib- es una SMTP key mal colocada en el campo apiKey
      // → saltar HTTPS API y usar SMTP fallback directamente (evita 12s de timeout).
      if (!decrypted.startsWith('xkeysib-')) {
        console.warn(
          '[email][BREVO] apiKey desencriptada no empieza con "xkeysib-" ' +
            '(primeros 12 chars: "' + decrypted.slice(0, 12) + '"). ' +
            'Asumimos es una SMTP key mal puesta — saltando HTTPS API, usando SMTP fallback.'
        )
        return null
      }
      const hash = decrypted.slice(-6)
      // Si la key está marcada como inválida para este hash, no usarla
      if (Date.now() < brevoApiKeyInvalidUntil && brevoApiKeyInvalidHash === hash) {
        return null
      }
      if (cachedBrevoApiKeyHash !== hash) {
        cachedBrevoApiKey = decrypted
        cachedBrevoApiKeyHash = hash
      }
      return cachedBrevoApiKey
    }
    // Texto plano — validar prefijo
    if (!conexion.apiKey.startsWith('xkeysib-')) {
      console.warn(
        '[email][BREVO] apiKey en texto plano no empieza con "xkeysib-" ' +
          '(primeros 12 chars: "' + conexion.apiKey.slice(0, 12) + '"). ' +
          'Saltando HTTPS API, usando SMTP fallback.'
      )
      return null
    }
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
}): Promise<{ success: boolean; messageId?: string; error?: string; httpStatus?: number }> {
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

    // Timeout de 12s — Vercel serverless tiene 10-60s según plan
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      const errBody = await res.text()
      // Si la API key es inválida (401/403), marcarla como inválida por 5 min
      // para evitar reintentos inútiles en cada envío (el OTP se va por SMTP).
      if (res.status === 401 || res.status === 403) {
        const keyHash = apiKey.slice(-6)
        brevoApiKeyInvalidUntil = Date.now() + BREVO_API_INVALID_TTL_MS
        brevoApiKeyInvalidHash = keyHash
        console.warn(
          `[email][BREVO] API key inválida (HTTP ${res.status}). Marcando como inválida por ${BREVO_API_INVALID_TTL_MS / 60000} min. ` +
            `Usar SMTP fallback. Hash key: ...${keyHash}`
        )
      }
      return {
        success: false,
        httpStatus: res.status,
        error: `Brevo API HTTP ${res.status}: ${errBody.slice(0, 300)}`,
      }
    }

    const data = await res.json()
    return {
      success: true,
      messageId: data.messageId,
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Brevo API timeout (12s)' }
    }
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
      // Timeouts para evitar que instancias warm de Vercel se queden colgadas
      connectionTimeout: 10000,  // 10s para conectar
      greetingTimeout: 10000,    // 10s para recibir greeting del server
      socketTimeout: 20000,      // 20s para operaciones de socket
      pool: true,                // connection pooling (reutiliza conexiones)
      maxConnections: 3,
      maxMessages: 100,
      rateLimit: false,
    } as nodemailer.TransportOptions)
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
    // Si el error es de autenticación SMTP (535, 525, 5.7.1, etc.), resetear el
    // transporter cacheado para que el próximo envío cree uno nuevo con credenciales frescas.
    const errMsg = (error.message || '').toLowerCase()
    if (
      errMsg.includes('invalid login') ||
      errMsg.includes('5.7.1') ||
      errMsg.includes('5.7.8') ||
      errMsg.includes('unauthorized') ||
      errMsg.includes('authentication failed') ||
      errMsg.includes('535') ||
      errMsg.includes('525')
    ) {
      console.warn('[email][SMTP] Error de autenticación detectado. Reseteando transporter cacheado.')
      if (cachedTransporter) {
        try { cachedTransporter.close() } catch {}
      }
      cachedTransporter = null
      cachedConfigHash = ''
    }
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
 * v4.8 (QA M05 TC-MAIL-015): el error devuelto al cliente está sanitizado.
 * Antes: `message: \`Error de conexión SMTP: ${error.message}\`` exponía
 * detalles internos (host, puerto, credenciales parciales) al cliente.
 * Ahora: clasifica el tipo de error y devuelve un mensaje genérico + codigo.
 * Los detalles del error quedan solo en logs del server (console.error).
 */
export async function probarSmtp(): Promise<{
  success: boolean
  message: string
  codigo?: string
  config?: SmtpConfig
}> {
  try {
    const { transporter, config, isEthereal } = await obtenerTransporter()
    if (isEthereal) {
      return {
        success: false,
        message:
          'No hay SMTP configurado. Se está usando Ethereal Email (modo de prueba). Configura una conexión EMAIL_SMTP en Conexiones API.',
        codigo: 'SMTP_NO_CONFIGURADO',
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
    // Log completo del error para diagnóstico interno (no se envía al cliente)
    console.error('[email][probarSmtp] Error completo:', error)

    // === v4.8 (QA M05 TC-MAIL-015): clasificar y sanitizar el error ===
    const errMsg = (error.message || '').toLowerCase()
    let codigo = 'SMTP_ERROR'
    let mensajeSanitizado = 'Error al conectar con el servidor SMTP.'

    // Error de autenticación (535, 525, 5.7.1, 5.7.8, invalid login, unauthorized)
    if (
      errMsg.includes('535') ||
      errMsg.includes('525') ||
      errMsg.includes('5.7.1') ||
      errMsg.includes('5.7.8') ||
      errMsg.includes('invalid login') ||
      errMsg.includes('unauthorized') ||
      errMsg.includes('authentication failed')
    ) {
      codigo = 'SMTP_AUTH_FAILED'
      mensajeSanitizado = 'Error de autenticación SMTP. Verifica que las credenciales (user/password o API key) sean correctas y estén activas en el panel de Brevo.'
    }
    // Error de conexión (timeout, ECONNREFUSED, ENOTFOUND)
    else if (
      errMsg.includes('econnrefused') ||
      errMsg.includes('enotfound') ||
      errMsg.includes('timeout') ||
      errMsg.includes('etimedout')
    ) {
      codigo = 'SMTP_CONN_ERROR'
      mensajeSanitizado = 'No se pudo conectar al servidor SMTP. Verifica host y puerto, y que no haya firewall bloqueando la conexión.'
    }
    // Error de SSL/TLS
    else if (
      errMsg.includes('ssl') ||
      errMsg.includes('tls') ||
      errMsg.includes('certificate') ||
      errMsg.includes('self-signed')
    ) {
      codigo = 'SMTP_TLS_ERROR'
      mensajeSanitizado = 'Error de SSL/TLS al conectar al servidor SMTP. Verifica el certificado y el puerto (465=SSL, 587=STARTTLS).'
    }

    return {
      success: false,
      message: mensajeSanitizado,
      codigo,
    }
  }
}
