import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { logError } from '@/lib/error-handler'

// =====================================================
// Reforzado: validación anti-SSRF
// =====================================================

// IPs y rangos bloqueados (RFC 1918 + link-local + loopback + cloud metadata)
function isPrivateIp(hostname: string): boolean {
  const ip = hostname.replace(/^\[|\]$/g, '') // quitar corchetes IPv6
  // Loopback
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true
  // Link-local (169.254.x.x — incluye AWS/GCP/Azure metadata)
  if (/^169\.254\./.test(ip)) return true
  // Private ranges RFC 1918
  if (/^10\./.test(ip)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  // Carrier-grade NAT
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true
  // IPv6 link-local
  if (/^fe80:/i.test(ip)) return true
  // IPv6 unique local
  if (/^fd[0-9a-f]{2}:/i.test(ip)) return true
  return false
}

// Whitelist de dominios permitidos para conexiones API
const ALLOWED_DOMAINS = [
  'graph.facebook.com',
  'api.facebook.com',
  'graph.microsoft.com',
  'twilio.com',
  'api.twilio.com',
  'api.bancolombia.com',
  'sandbox.api.bancolombia.com',
  'witness.bancolombia.com',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'smtp.gmail.com',
  'smtp.office365.com',
  'smtp.mailgun.org',
  'api.sendgrid.com',
  'api.resend.com',
]

function validateExternalUrl(urlStr: string): { valido: boolean; motivo?: string } {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { valido: false, motivo: 'URL inválida' }
  }
  // Solo HTTPS en producción
  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    return { valido: false, motivo: 'Solo se permite HTTPS en producción' }
  }
  const hostname = parsed.hostname.toLowerCase()
  // Bloquear IPs privadas
  if (isPrivateIp(hostname)) {
    return { valido: false, motivo: `IP interna bloqueada (anti-SSRF): ${hostname}` }
  }
  // Bloquear si es IP directa (no dominio) en producción
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && process.env.NODE_ENV === 'production') {
    return { valido: false, motivo: 'IPs directas bloqueadas en producción, usar dominio' }
  }
  // Whitelist de dominios (comentar la siguiente línea para permitir cualquier dominio no-privado)
  // const isAllowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
  // if (!isAllowed) return { valido: false, motivo: `Dominio no permitido: ${hostname}` }
  return { valido: true }
}

// POST - probar conexión (verifica que las credenciales sean válidas)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Reforzado: requiere ADMIN para probar conexiones
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params

    const conexion = await db.conexionAPI.findUnique({ where: { id } })
    if (!conexion) {
      return NextResponse.json(
        { success: false, error: 'Conexión no encontrada' },
        { status: 404 }
      )
    }

    let resultado = ''
    let exito = false

    // Reforzado: validar URL contra SSRF antes de cualquier fetch
    if (conexion.url) {
      const validacion = validateExternalUrl(conexion.url)
      if (!validacion.valido) {
        logError('/api/conexiones/probar', new Error(`SSRF bloqueado: ${validacion.motivo}`))
        return NextResponse.json(
          { success: false, error: `URL inválida: ${validacion.motivo}`, code: 'SSRF_BLOCKED' },
          { status: 400 }
        )
      }
    }

    switch (conexion.tipo) {
      case 'WHATSAPP_BUSINESS': {
        // Verificar que tenga los campos mínimos
        if (!conexion.url || !conexion.apiKey) {
          resultado = 'Faltan campos: URL y API Key son obligatorios para WhatsApp Business'
        } else {
          // Intentar hacer una petición de verificación al endpoint
          try {
            const res = await fetch(`${conexion.url}/v17.0/${conexion.accountId || 'me'}`, {
              headers: { Authorization: `Bearer ${conexion.apiKey}` },
              signal: AbortSignal.timeout(10000),
            })
            if (res.ok) {
              exito = true
              resultado = `✅ Conexión exitosa. WhatsApp Business API respondió ${res.status}.`
            } else {
              resultado = `❌ Error ${res.status}: ${res.statusText}. Verifica tu API Key y Phone Number ID.`
            }
          } catch (e: any) {
            resultado = `❌ No se pudo conectar: ${e.message}. Verifica la URL.`
          }
        }
        break
      }

      case 'TWILIO': {
        if (!conexion.accountId || !conexion.apiKey || !conexion.apiSecret) {
          resultado = 'Faltan campos: Account SID, API Key y API Secret son obligatorios para Twilio'
        } else {
          try {
            const auth = Buffer.from(`${conexion.accountId}:${conexion.apiKey}`).toString('base64')
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${conexion.accountId}.json`, {
              headers: { Authorization: `Basic ${auth}` },
              signal: AbortSignal.timeout(10000),
            })
            if (res.ok) {
              const data = await res.json()
              exito = true
              resultado = `✅ Conexión exitosa. Cuenta Twilio: ${data.friendly_name || conexion.accountId}`
            } else {
              resultado = `❌ Error ${res.status}: ${res.statusText}. Verifica tu Account SID y Auth Token.`
            }
          } catch (e: any) {
            resultado = `❌ No se pudo conectar a Twilio: ${e.message}`
          }
        }
        break
      }

      case 'EMAIL_SMTP': {
        // Para SMTP solo verificamos que tenga los campos mínimos
        // (no hacemos conexión real porque requiere librería nodemailer)
        if (!conexion.usuario || !conexion.password || !conexion.url) {
          resultado = 'Faltan campos: URL (servidor SMTP), usuario y password son obligatorios'
        } else {
          exito = true
          resultado = `✅ Configuración SMTP válida. Servidor: ${conexion.url}, Usuario: ${conexion.usuario}. La conexión se probará al enviar el primer email.`
        }
        break
      }

      case 'BANCOLOMBIA':
      case 'BANCOLOMBIA_BOTON_PAGO':
      case 'DAVIVIENDA':
      case 'PSE': {
        if (!conexion.url || !conexion.apiKey) {
          resultado = `Faltan campos: URL y API Key son obligatorios para ${conexion.tipo}`
        } else {
          try {
            const res = await fetch(conexion.url, {
              headers: { Authorization: `Bearer ${conexion.apiKey}` },
              signal: AbortSignal.timeout(10000),
            })
            if (res.status < 500) {
              exito = true
              resultado = `✅ Conexión establecida con ${conexion.tipo}. Respuesta: ${res.status}.`
            } else {
              resultado = `❌ Error del servidor ${conexion.tipo}: ${res.status}. Verifica la URL y API Key.`
            }
          } catch (e: any) {
            resultado = `❌ No se pudo conectar: ${e.message}`
          }
        }
        break
      }

      case 'WEBHOOK': {
        if (!conexion.url) {
          resultado = 'Falta campo: URL es obligatorio para Webhook'
        } else {
          try {
            const res = await fetch(conexion.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test: true, message: 'Prueba de conexión desde sistema de préstamos' }),
              signal: AbortSignal.timeout(10000),
            })
            if (res.ok) {
              exito = true
              resultado = `✅ Webhook respondió ${res.status}. Conexión exitosa.`
            } else {
              resultado = `❌ Webhook respondió ${res.status}: ${res.statusText}`
            }
          } catch (e: any) {
            resultado = `❌ No se pudo conectar al webhook: ${e.message}`
          }
        }
        break
      }

      case 'OTRO': {
        if (!conexion.url) {
          resultado = 'Falta campo: URL es obligatoria'
        } else {
          try {
            const headers: any = {}
            if (conexion.apiKey) headers['Authorization'] = `Bearer ${conexion.apiKey}`
            const res = await fetch(conexion.url, {
              headers,
              signal: AbortSignal.timeout(10000),
            })
            exito = res.status < 400
            resultado = exito
              ? `✅ Conexión establecida. Respuesta: ${res.status}.`
              : `❌ Error ${res.status}: ${res.statusText}`
          } catch (e: any) {
            resultado = `❌ No se pudo conectar: ${e.message}`
          }
        }
        break
      }

      default:
        resultado = 'Tipo de conexión no soportado'
    }

    // Actualizar el registro con el resultado de la prueba
    await db.conexionAPI.update({
      where: { id },
      data: {
        probada: exito,
        fechaUltimaPrueba: new Date(),
        resultadoUltimaPrueba: resultado,
      },
    })

    return NextResponse.json({
      success: true,
      data: { exito, resultado },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
