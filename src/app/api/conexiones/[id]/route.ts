import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, decryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { probarSmtp, enviarEmail } from '@/lib/email'
import { sanitizeError } from '@/lib/error-handler'
import { assertEmailConfigNotLocked, EmailConfigLockError } from '@/lib/email-config-lock'

// FIX-SEGURIDAD-CRITICA #5: redacta campos sensibles de una conexión antes de enviarla al cliente.
// - password y apiSecret nunca se devuelven (ni siquiera a ADMIN).
// - apiKey se devuelve enmascarada (primeros 4 + últimos 4 caracteres) para identificación.
// - configuracionExtra: si es JSON, se redactan claves conocidas como sensibles.
function redactConexion(conexion: any) {
  let configuracionExtraRedacted = conexion.configuracionExtra
  if (typeof conexion.configuracionExtra === 'string' && conexion.configuracionExtra) {
    try {
      const parsed = JSON.parse(conexion.configuracionExtra)
      const SENSITIVE_KEYS = ['password', 'pwd', 'pass', 'secret', 'apiSecret', 'apiKey', 'token', 'accessToken', 'refreshToken']
      for (const k of Object.keys(parsed)) {
        if (SENSITIVE_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()))) {
          parsed[k] = '••••••••'
        }
      }
      configuracionExtraRedacted = JSON.stringify(parsed)
    } catch {
      // no es JSON — dejar como está
    }
  }
  let apiKeyMasked: string | null = null
  if (conexion.apiKey) {
    // Desencriptar para poder enmascarar (sabemos que existe un valor)
    try {
      const plain = decryptSensitive(conexion.apiKey)
      if (plain.length > 8) {
        apiKeyMasked = `${plain.slice(0, 4)}••••${plain.slice(-4)}`
      } else {
        apiKeyMasked = '••••'
      }
    } catch {
      apiKeyMasked = '••••'
    }
  }
  return {
    ...conexion,
    apiKey: apiKeyMasked,
    apiSecret: null, // nunca exponer (FIX-SEGURIDAD-CRITICA #5)
    password: null,  // nunca exponer (FIX-SEGURIDAD-CRITICA #5)
    configuracionExtra: configuracionExtraRedacted,
  }
}

// GET - obtener una conexión por id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede consultar detalle de conexión
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
    // FIX-SEGURIDAD-CRITICA #5: nunca devolver password ni apiSecret; apiKey enmascarada
    return NextResponse.json({
      success: true,
      data: redactConexion(conexion),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PUT - actualizar conexión
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede actualizar conexiones
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params
    const body = await req.json()
    const clientInfo = getClientInfo(req)

    const conexionExistente = await db.conexionAPI.findUnique({ where: { id } })
    if (!conexionExistente) {
      return NextResponse.json(
        { success: false, error: 'Conexión no encontrada' },
        { status: 404 }
      )
    }

    // BLOQUEO DE PROTECCIÓN DE CORREO: si la conexión es EMAIL_SMTP y el lock está activo,
    // rechazar la modificación con HTTP 423 Locked.
    const tipoTarget = (body.tipo || conexionExistente.tipo) as string
    if (tipoTarget === 'EMAIL_SMTP') {
      try {
        await assertEmailConfigNotLocked('modificar conexión EMAIL_SMTP')
      } catch (e: any) {
        if (e instanceof EmailConfigLockError) {
          return NextResponse.json(
            { success: false, error: e.message, code: e.code },
            { status: e.statusCode },
          )
        }
        throw e
      }
    }

    const {
      nombre,
      tipo,
      descripcion,
      url,
      apiKey,
      apiSecret,
      usuario,
      password,
      accountId,
      telefonoOrigen,
      configuracionExtra,
      activa,
    } = body

    // Si se está activando y era de otro tipo o no estaba activa, desactivar otras del mismo tipo
    if (activa && !conexionExistente.activa) {
      await db.conexionAPI.updateMany({
        where: { tipo: tipo || conexionExistente.tipo, NOT: { id } },
        data: { activa: false },
      })
    }

    // Solo encriptar y actualizar password/apiKey si vienen valores nuevos (no '••••••••')
    const dataUpdate: any = {
      ...(nombre !== undefined && { nombre }),
      ...(tipo !== undefined && { tipo }),
      ...(descripcion !== undefined && { descripcion: descripcion || null }),
      ...(url !== undefined && { url: url || null }),
      ...(usuario !== undefined && { usuario: usuario || null }),
      ...(accountId !== undefined && { accountId: accountId || null }),
      ...(telefonoOrigen !== undefined && { telefonoOrigen: telefonoOrigen || null }),
      ...(configuracionExtra !== undefined && {
        configuracionExtra: configuracionExtra || null,
      }),
      ...(activa !== undefined && { activa: !!activa }),
    }

    // Solo actualizar secrets si vienen valores reales (no placeholders)
    if (apiKey && apiKey !== '••••••••') {
      dataUpdate.apiKey = encryptSensitive(apiKey)
    }
    if (apiSecret && apiSecret !== '••••••••') {
      dataUpdate.apiSecret = encryptSensitive(apiSecret)
    }
    if (password && password !== '••••••••') {
      dataUpdate.password = encryptSensitive(password)
    }

    const conexion = await db.conexionAPI.update({
      where: { id },
      data: dataUpdate,
    })

    await registrarAuditLog({
      usuarioNombre: 'Admin',
      accion: 'CONEXION_API_ACTUALIZADA',
      modulo: 'conexiones',
      entidadId: id,
      entidadNombre: conexion.nombre,
      detalles: JSON.stringify({ tipo: conexion.tipo, activa: conexion.activa }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // FIX-SEGURIDAD-CRITICA #5: redactar secrets antes de devolver la conexión actualizada
    return NextResponse.json({ success: true, data: redactConexion(conexion) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// DELETE - eliminar conexión
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede eliminar conexiones
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params
    const clientInfo = getClientInfo(req)

    const conexion = await db.conexionAPI.findUnique({ where: { id } })
    if (!conexion) {
      return NextResponse.json(
        { success: false, error: 'Conexión no encontrada' },
        { status: 404 }
      )
    }

    // BLOQUEO DE PROTECCIÓN DE CORREO: si la conexión es EMAIL_SMTP y el lock está activo,
    // rechazar la eliminación con HTTP 423 Locked.
    if (conexion.tipo === 'EMAIL_SMTP') {
      try {
        await assertEmailConfigNotLocked('eliminar conexión EMAIL_SMTP')
      } catch (e: any) {
        if (e instanceof EmailConfigLockError) {
          return NextResponse.json(
            { success: false, error: e.message, code: e.code },
            { status: e.statusCode },
          )
        }
        throw e
      }
    }

    await db.conexionAPI.delete({ where: { id } })

    await registrarAuditLog({
      usuarioNombre: 'Admin',
      accion: 'CONEXION_API_ELIMINADA',
      modulo: 'conexiones',
      entidadId: id,
      entidadNombre: conexion.nombre,
      detalles: JSON.stringify({ tipo: conexion.tipo }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH - acciones especiales (probar, toggle activo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede ejecutar acciones sobre conexiones
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params
    const body = await req.json()
    const { accion, to } = body

    const conexion = await db.conexionAPI.findUnique({ where: { id } })
    if (!conexion) {
      return NextResponse.json(
        { success: false, error: 'Conexión no encontrada' },
        { status: 404 }
      )
    }

    if (accion === 'toggle') {
      // BLOQUEO DE PROTECCIÓN DE CORREO: no permitir toggle (activar/desactivar)
      // de conexiones EMAIL_SMTP cuando el lock está activo.
      if (conexion.tipo === 'EMAIL_SMTP') {
        try {
          await assertEmailConfigNotLocked('cambiar estado (toggle) de conexión EMAIL_SMTP')
        } catch (e: any) {
          if (e instanceof EmailConfigLockError) {
            return NextResponse.json(
              { success: false, error: e.message, code: e.code },
              { status: e.statusCode },
            )
          }
          throw e
        }
      }
      const nuevaActiva = !conexion.activa
      // Si se está activando, desactivar otras del mismo tipo
      if (nuevaActiva) {
        await db.conexionAPI.updateMany({
          where: { tipo: conexion.tipo, NOT: { id } },
          data: { activa: false },
        })
      }
      const actualizada = await db.conexionAPI.update({
        where: { id },
        data: { activa: nuevaActiva },
      })
      // FIX-SEGURIDAD-CRITICA #5: redactar secrets en respuesta
      return NextResponse.json({ success: true, data: redactConexion(actualizada) })
    }

    if (accion === 'probar') {
      // === Probar conexión según el tipo ===
      // EMAIL_SMTP: probar SMTP + enviar correo de prueba
      // WHATSAPP_BUSINESS: validar token contra Graph API (GET /v21.0/<phone_number_id>)
      // N8N_WEBHOOK: POST al webhook con payload de prueba
      // GOOGLE_AI_STUDIO: GET a list models con API key
      const tipo = conexion.tipo

      let resultado: { success: boolean; message: string; details?: any } = {
        success: false,
        message: 'Tipo de conexión no soportado para prueba',
      }

      try {
        if (tipo === 'EMAIL_SMTP') {
          // BLOQUEO DE PROTECCIÓN DE CORREO: si la conexión NO está activa y el
          // lock está activo, no se puede "probar" porque probar implica activarla
          // temporalmente (lo que desactivaría la conexión activa actual).
          // Si YA está activa, la prueba es safe (no modifica estado) → permitir.
          if (!conexion.activa) {
            try {
              await assertEmailConfigNotLocked('probar (activar temporalmente) conexión EMAIL_SMTP no activa')
            } catch (e: any) {
              if (e instanceof EmailConfigLockError) {
                return NextResponse.json(
                  {
                    success: false,
                    error:
                      e.message +
                      ' Sugerencia: prueba la conexión actualmente ACTIVA en su lugar, ' +
                      'o desactiva el bloqueo primero.',
                    code: e.code,
                  },
                  { status: e.statusCode },
                )
              }
              throw e
            }
          }
          // Si esta conexión no está activa, activarla temporalmente para la prueba
          if (!conexion.activa) {
            await db.conexionAPI.updateMany({
              where: { tipo: 'EMAIL_SMTP', activa: true },
              data: { activa: false },
            })
            await db.conexionAPI.update({
              where: { id },
              data: { activa: true },
            })
          }
          const smtpResult = await probarSmtp()
          let envioPrueba: { success: boolean; error?: string; isEthereal: boolean; messageId?: string; previewUrl?: string } | null = null
          if (smtpResult.success && to) {
            envioPrueba = await enviarEmail({
              to,
              subject: 'Prueba de SMTP - Sistema de Solicitudes',
              text: 'Si recibiste este correo, la configuración SMTP funciona correctamente.',
              html: '<h2>Prueba de SMTP ✅</h2><p>Si recibiste este correo, la configuración SMTP funciona correctamente.</p>',
            })
          }
          resultado = {
            success: smtpResult.success,
            message: smtpResult.message + (envioPrueba ? ` | Envío: ${envioPrueba.success ? 'OK' : envioPrueba.error}` : ''),
            details: { config: smtpResult.config, envioPrueba },
          }
        } else if (tipo === 'WHATSAPP_BUSINESS') {
          // Validar credenciales de WhatsApp Cloud API contra Graph API
          const accessToken = conexion.apiSecret ? decryptSensitive(conexion.apiSecret) : ''
          const phoneNumberId = conexion.accountId || ''
          const apiVersion = 'v21.0'
          if (!accessToken || !phoneNumberId) {
            resultado = {
              success: false,
              message: 'Faltan credenciales: se requiere Access Token (apiSecret) y Phone Number ID (accountId)',
            }
          } else {
            const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified,name,quality_rating`
            const resp = await fetch(url, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await resp.json()
            if (resp.ok && data.display_phone_number) {
              resultado = {
                success: true,
                message: `WhatsApp conectado: ${data.display_phone_number} (${data.verified ? 'verificado' : 'no verificado'}, calidad: ${data.quality_rating || 'N/A'})`,
                details: data,
              }
            } else {
              resultado = {
                success: false,
                message: `Error WhatsApp: ${data.error?.message || resp.statusText}`,
                details: data,
              }
            }
          }
        } else if (tipo === 'N8N_WEBHOOK') {
          // Disparar el webhook de n8n con un payload de prueba
          const webhookUrl = conexion.url || ''
          if (!webhookUrl) {
            resultado = { success: false, message: 'Falta la URL del webhook de n8n' }
          } else {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (conexion.apiKey) {
              headers['X-N8N-API-KEY'] = decryptSensitive(conexion.apiKey)
            }
            const resp = await fetch(webhookUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                source: 'jsadr-automatizacion',
                event: 'test_connection',
                timestamp: new Date().toISOString(),
                payload: { mensaje: 'Prueba de conexión desde Jsadr Jo*** Se*** Al*** D** R**' },
              }),
            })
            const text = await resp.text()
            if (resp.ok) {
              resultado = {
                success: true,
                message: `Webhook n8n respondió OK (${resp.status})`,
                details: { status: resp.status, body: text.slice(0, 500) },
              }
            } else {
              resultado = {
                success: false,
                message: `Webhook n8n falló: HTTP ${resp.status}`,
                details: { status: resp.status, body: text.slice(0, 500) },
              }
            }
          }
        } else if (tipo === 'GOOGLE_AI_STUDIO') {
          // Probar API key de Google AI Studio listando modelos Gemini
          const apiKey = conexion.apiKey ? decryptSensitive(conexion.apiKey) : ''
          if (!apiKey) {
            resultado = { success: false, message: 'Falta la API Key de Google AI Studio' }
          } else {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            )
            const data = await resp.json()
            if (resp.ok && Array.isArray(data.models)) {
              const geminiModels = data.models.filter((m: any) =>
                m.name?.toLowerCase().includes('gemini')
              )
              resultado = {
                success: true,
                message: `Google AI Studio OK: ${geminiModels.length} modelo(s) Gemini disponibles`,
                details: {
                  total: data.models.length,
                  gemini: geminiModels.slice(0, 5).map((m: any) => m.name),
                },
              }
            } else {
              resultado = {
                success: false,
                message: `Error Google AI: ${data.error?.message || resp.statusText}`,
                details: data,
              }
            }
          }
        }
      } catch (err: any) {
        resultado = {
          success: false,
          message: `Error en prueba: ${err.message || 'desconocido'}`,
        }
      }

      // Registrar resultado de la prueba
      await db.conexionAPI.update({
        where: { id },
        data: {
          probada: resultado.success,
          fechaUltimaPrueba: new Date(),
          resultadoUltimaPrueba: resultado.message,
        },
      })

      return NextResponse.json({
        success: resultado.success,
        message: resultado.message,
        details: resultado.details,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Usa "toggle" o "probar".' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
