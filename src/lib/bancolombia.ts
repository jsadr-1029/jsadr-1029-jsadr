// =====================================================
// lib/bancolombia.ts — Integración Botón Bancolombia (Persona Natural)
// -----------------------------------------------------
// Documentación oficial:
//   https://developer.bancolombia.com/api/products/boton-bancolombia
//
// Flujo:
//   1. OAuth2 client_credentials → access_token
//   2. Crear payment-intent con firma HMAC-SHA256
//   3. Bancolombia devuelve URL de redirección
//   4. Cliente es redirigido a Bancolombia para autorizar
//   5. Bancolombia llama al webhook con el resultado
//
// Credenciales (gestionadas vía ConexionAPI):
//   - apiKey     = Client ID  (BANCOLOMBIA_CLIENT_ID)
//   - apiSecret  = Client Secret (BANCOLOMBIA_CLIENT_SECRET)
//   - accountId  = Commerce ID (identificador del comercio en Bancolombia)
//   - configuracionExtra (JSON) = { ambiente, redirectUrl, webhookUrl }
// =====================================================

import crypto from 'crypto'

// === Endpoints por ambiente ===
const ENDPOINTS = {
  sandbox: {
    oauth: 'https://sandbox.api.apps.bancolombia.com/security/v1/oauth2/token',
    payment: 'https://sandbox.api.apps.bancolombia.com/payment-intent/v1/payment-intent',
  },
  produccion: {
    oauth: 'https://api.apps.bancolombia.com/security/v1/oauth2/token',
    payment: 'https://api.apps.bancolombia.com/payment-intent/v1/payment-intent',
  },
} as const

export type AmbienteBancolombia = 'sandbox' | 'produccion'

export interface CredencialesBancolombia {
  clientId: string
  clientSecret: string
  commerceId: string
  ambiente: AmbienteBancolombia
  redirectUrl: string
  webhookUrl: string
}

export interface PaymentIntentRequest {
  referencia: string
  monto: number
  moneda: 'COP' | 'USD'
  descripcion: string
  emailCliente: string
  telefonoCliente?: string
  redirectUrl: string
  webhookUrl: string
  commerceId: string
}

export interface PaymentIntentResponse {
  success: boolean
  checkoutId?: string
  redirectUrl?: string
  transactionId?: string
  estado?: string
  error?: string
  raw?: unknown
}

// =====================================================
// generarFirmaHmac — HMAC-SHA256 del payload con shared secret
// =====================================================
// Bancolombia exige un header X-Signature con formato:
//   "t=<timestamp>,v1=<hmac-sha256-hex>"
// donde el HMAC se calcula sobre: `${timestamp}.${bodyJson}`
export function generarFirmaHmac(
  body: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Date.now()
  const payload = `${ts}.${body}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `t=${ts},v1=${hmac}`
}

// =====================================================
// obtenerAccessToken — OAuth2 client_credentials
// =====================================================
export async function obtenerAccessToken(
  credenciales: CredencialesBancolombia
): Promise<{ success: boolean; accessToken?: string; error?: string; raw?: unknown }> {
  const endpoint = ENDPOINTS[credenciales.ambiente].oauth
  const basicAuth = Buffer.from(
    `${credenciales.clientId}:${credenciales.clientSecret}`
  ).toString('base64')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    })

    const data: any = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        success: false,
        error: `OAuth2 ${res.status}: ${data?.error_description || data?.error || res.statusText}`,
        raw: data,
      }
    }

    if (!data.access_token) {
      return {
        success: false,
        error: 'OAuth2: respuesta sin access_token',
        raw: data,
      }
    }

    return { success: true, accessToken: data.access_token, raw: data }
  } catch (e: any) {
    return { success: false, error: `OAuth2 fetch: ${e.message}` }
  }
}

// =====================================================
// crearPaymentIntent — Crea intención de pago en Bancolombia
// =====================================================
export async function crearPaymentIntent(
  credenciales: CredencialesBancolombia,
  req: PaymentIntentRequest
): Promise<PaymentIntentResponse> {
  // 1) Obtener access token
  const tokenRes = await obtenerAccessToken(credenciales)
  if (!tokenRes.success || !tokenRes.accessToken) {
    return { success: false, error: tokenRes.error || 'No access token' }
  }

  // 2) Construir payload según docs de Bancolombia
  const body = {
    data: {
      type: 'PaymentIntent',
      attributes: {
        reference: req.referencia,
        description: req.descripcion,
        amount: {
          totalCurrency: req.moneda,
          totalAmount: Number(req.monto.toFixed(2)),
        },
        checkout: {
          type: 'redirection',
          redirectionUrls: {
            success: req.redirectUrl,
            pending: req.redirectUrl,
            failure: req.redirectUrl,
          },
        },
        customer: {
          email: req.emailCliente,
          ...(req.telefonoCliente ? { phone: req.telefonoCliente } : {}),
        },
        commerceData: {
          commerceId: req.commerceId || credenciales.commerceId,
        },
        notificationUrl: req.webhookUrl,
      },
    },
  }

  const bodyJson = JSON.stringify(body)
  const endpoint = ENDPOINTS[credenciales.ambiente].payment

  // 3) Generar firma HMAC con el Client Secret como shared secret
  const signature = generarFirmaHmac(bodyJson, credenciales.clientSecret)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Signature': signature,
      },
      body: bodyJson,
      cache: 'no-store',
    })

    const data: any = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        success: false,
        error: `PaymentIntent ${res.status}: ${data?.error?.detail || data?.error?.title || data?.message || res.statusText}`,
        raw: data,
      }
    }

    // Bancolombia devuelve { data: { id, attributes: { checkoutUrl, status, ... } } }
    const checkoutUrl = data?.data?.attributes?.checkoutUrl
      || data?.data?.attributes?.redirectUrl
      || data?.checkoutUrl
      || data?.redirectUrl

    const transactionId = data?.data?.id || data?.id || data?.data?.attributes?.id
    const estado = data?.data?.attributes?.status || data?.status || 'PENDING'

    if (!checkoutUrl) {
      return {
        success: false,
        error: 'PaymentIntent: respuesta sin checkoutUrl',
        raw: data,
      }
    }

    return {
      success: true,
      checkoutId: String(transactionId || ''),
      redirectUrl: checkoutUrl,
      transactionId: String(transactionId || ''),
      estado,
      raw: data,
    }
  } catch (e: any) {
    return { success: false, error: `PaymentIntent fetch: ${e.message}` }
  }
}

// =====================================================
// probarCredenciales — Test rápido de conexión OAuth2
// =====================================================
export async function probarCredenciales(
  credenciales: CredencialesBancolombia
): Promise<{ ok: boolean; mensaje: string; detalle?: unknown }> {
  const r = await obtenerAccessToken(credenciales)
  if (r.success) {
    return {
      ok: true,
      mensaje: `Conexión exitosa a Bancolombia (${credenciales.ambiente}). Access token obtenido correctamente.`,
      detalle: { ambiente: credenciales.ambiente, tokenPreview: r.accessToken!.slice(0, 12) + '...' },
    }
  }
  return {
    ok: false,
    mensaje: `Error de conexión: ${r.error}`,
    detalle: r.raw,
  }
}

// =====================================================
// Helper: construir credenciales desde ConexionAPI (Prisma)
// =====================================================
export function credencialesDesdeConexion(conexion: {
  apiKey: string | null
  apiSecret: string | null
  accountId: string | null
  configuracionExtra: string | null
}): CredencialesBancolombia | null {
  if (!conexion.apiKey || !conexion.apiSecret) return null

  let extra: any = {}
  try {
    extra = JSON.parse(conexion.configuracionExtra || '{}')
  } catch {}

  return {
    clientId: conexion.apiKey,
    clientSecret: conexion.apiSecret,
    commerceId: conexion.accountId || '',
    ambiente: extra.ambiente === 'produccion' ? 'produccion' : 'sandbox',
    redirectUrl: extra.redirectUrl || '',
    webhookUrl: extra.webhookUrl || '',
  }
}
