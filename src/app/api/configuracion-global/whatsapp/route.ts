// =====================================================
// /api/configuracion-global/whatsapp
// -----------------------------------------------------
// Gestiona las credenciales de WhatsApp Cloud API (Meta Business).
// Internamente usa el modelo ConexionAPI con tipo='WHATSAPP_BUSINESS'.
//
// GET  -> retorna la configuración actual (sin exponer el token).
// POST -> upsert (crea o actualiza) la configuración.
//         Body:
//           { token, phoneNumberId, businessId, graphVersion,
//             plantillaOtpNombre, plantillaOtpIdioma,
//             telefonoOrigen, activa }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { invalidarCacheCredencialesWhatsApp } from '@/lib/whatsapp-cloud-config'

const TIPO_WHATSAPP = 'WHATSAPP_BUSINESS'

// =====================================================
// GET — Configuración actual (sin exponer el token)
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const conexion = await db.conexionAPI.findFirst({
      where: { tipo: TIPO_WHATSAPP },
      orderBy: { updatedAt: 'desc' },
    })

    if (!conexion) {
      return NextResponse.json({
        success: true,
        data: { configurada: false },
      })
    }

    let extra: any = {}
    try { extra = JSON.parse(conexion.configuracionExtra || '{}') } catch {}

    return NextResponse.json({
      success: true,
      data: {
        configurada: true,
        id: conexion.id,
        token: conexion.apiKey ? '••••••••' : null,
        phoneNumberId: conexion.accountId || '',
        businessId: extra.businessId || '',
        graphVersion: extra.graphVersion || 'v20.0',
        plantillaOtpNombre: extra.plantillaOtpNombre || 'codigo_otp_jsadr',
        plantillaOtpIdioma: extra.plantillaOtpIdioma || 'es',
        telefonoOrigen: conexion.telefonoOrigen || '',
        ambiente: extra.ambiente || 'produccion',
        activa: conexion.activa,
        probada: conexion.probada,
        fechaUltimaPrueba: conexion.fechaUltimaPrueba,
        resultadoUltimaPrueba: conexion.resultadoUltimaPrueba,
        updatedAt: conexion.updatedAt,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Upsert (crear o actualizar)
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const clientInfo = getClientInfo(req)
    const {
      token,
      phoneNumberId,
      businessId,
      graphVersion,
      plantillaOtpNombre,
      plantillaOtpIdioma,
      telefonoOrigen,
      activa = true,
    } = body

    // Validaciones básicas
    if (!phoneNumberId || typeof phoneNumberId !== 'string' || phoneNumberId.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Phone Number ID es obligatorio' },
        { status: 400 }
      )
    }
    if (token && !token.startsWith('••••') && token.length < 20) {
      return NextResponse.json(
        { success: false, error: 'Token de acceso parece inválido (muy corto)' },
        { status: 400 }
      )
    }

    const extra = JSON.stringify({
      businessId: businessId || '',
      graphVersion: graphVersion || 'v20.0',
      plantillaOtpNombre: plantillaOtpNombre || 'codigo_otp_jsadr',
      plantillaOtpIdioma: plantillaOtpIdioma || 'es',
      ambiente: 'produccion',
    })

    const existente = await db.conexionAPI.findFirst({
      where: { tipo: TIPO_WHATSAPP },
      orderBy: { updatedAt: 'desc' },
    })

    if (activa) {
      await db.conexionAPI.updateMany({
        where: { tipo: TIPO_WHATSAPP, ...(existente ? { NOT: { id: existente.id } } : {}) },
        data: { activa: false },
      })
    }

    let tokenFinal: string | null = null
    if (token && !token.startsWith('••••')) {
      tokenFinal = encryptSensitive(token)
    } else if (existente?.apiKey) {
      tokenFinal = existente.apiKey
    }

    const data = {
      nombre: 'WhatsApp Cloud API (Meta)',
      tipo: TIPO_WHATSAPP,
      descripcion: 'WhatsApp Business Cloud API de Meta para envío de OTP y notificaciones automáticas',
      apiKey: tokenFinal,
      apiSecret: null,
      accountId: phoneNumberId || null,
      telefonoOrigen: telefonoOrigen || null,
      configuracionExtra: extra,
      activa: !!activa,
      probada: false,
      fechaUltimaPrueba: null,
      resultadoUltimaPrueba: null,
    }

    let conexion
    if (existente) {
      conexion = await db.conexionAPI.update({
        where: { id: existente.id },
        data,
      })
    } else {
      conexion = await db.conexionAPI.create({ data })
    }

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: existente ? 'WHATSAPP_CONFIG_ACTUALIZADA' : 'WHATSAPP_CONFIG_CREADA',
      modulo: 'configuracion-global',
      entidadId: conexion.id,
      entidadNombre: 'WhatsApp Cloud API',
      detalles: JSON.stringify({
        phoneNumberId,
        businessId: businessId || '',
        plantillaOtpNombre: plantillaOtpNombre || 'codigo_otp_jsadr',
        activa,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    // Invalidar caché de credenciales para que los próximos envíos usen las nuevas
    invalidarCacheCredencialesWhatsApp()

    return NextResponse.json({
      success: true,
      data: {
        id: conexion.id,
        configurada: true,
        phoneNumberId,
        activa: conexion.activa,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
