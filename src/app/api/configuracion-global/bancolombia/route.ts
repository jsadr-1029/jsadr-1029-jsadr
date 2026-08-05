// =====================================================
// /api/configuracion-global/bancolombia
// -----------------------------------------------------
// Gestiona las credenciales del Botón Bancolombia (Persona Natural).
// Internamente usa el modelo ConexionAPI con tipo='BANCOLOMBIA_BOTON_PAGO'.
//
// GET  -> retorna la configuración actual (sin exponer el apiSecret).
// POST -> upsert (crea o actualiza) la configuración.
//         Body:
//           { clientId, clientSecret, commerceId, ambiente, redirectUrl, webhookUrl, activa }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

const TIPO_BANCOLOMBIA = 'BANCOLOMBIA_BOTON_PAGO'

// =====================================================
// GET — Configuración actual
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR'])
    if (auth instanceof NextResponse) return auth

    const conexion = await db.conexionAPI.findFirst({
      where: { tipo: TIPO_BANCOLOMBIA },
      orderBy: { updatedAt: 'desc' },
    })

    if (!conexion) {
      return NextResponse.json({
        success: true,
        data: { configurada: false },
      })
    }

    // Reconstruir configuracionExtra
    let extra: any = {}
    try { extra = JSON.parse(conexion.configuracionExtra || '{}') } catch {}

    return NextResponse.json({
      success: true,
      data: {
        configurada: true,
        id: conexion.id,
        clientId: conexion.apiKey ? '••••••••' : null, // mascara
        commerceId: conexion.accountId || '',
        ambiente: extra.ambiente || 'sandbox',
        redirectUrl: extra.redirectUrl || '',
        webhookUrl: extra.webhookUrl || '',
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
      clientId,
      clientSecret,
      commerceId,
      ambiente,
      redirectUrl,
      webhookUrl,
      activa = true,
    } = body

    // Validaciones básicas
    if (!clientId || typeof clientId !== 'string' || clientId.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Client ID es obligatorio (mínimo 5 caracteres)' },
        { status: 400 }
      )
    }
    // Si NO viene con la máscara "••••••••", exigir longitud mínima
    if (clientSecret && !clientSecret.startsWith('••••') && clientSecret.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Client Secret debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }
    if (ambiente && !['sandbox', 'produccion'].includes(ambiente)) {
      return NextResponse.json(
        { success: false, error: 'Ambiente debe ser "sandbox" o "produccion"' },
        { status: 400 }
      )
    }

    // Construir configuracionExtra
    const extra = JSON.stringify({
      ambiente: ambiente || 'sandbox',
      redirectUrl: redirectUrl || '',
      webhookUrl: webhookUrl || '',
    })

    // Buscar conexión existente
    const existente = await db.conexionAPI.findFirst({
      where: { tipo: TIPO_BANCOLOMBIA },
      orderBy: { updatedAt: 'desc' },
    })

    // Si se está activando, desactivar otras del mismo tipo
    if (activa) {
      await db.conexionAPI.updateMany({
        where: { tipo: TIPO_BANCOLOMBIA, ...(existente ? { NOT: { id: existente.id } } : {}) },
        data: { activa: false },
      })
    }

    // Encriptar credenciales
    // Si el clientSecret viene como máscara "••••••••", mantener el anterior
    let apiSecretFinal: string | null = null
    if (clientSecret && !clientSecret.startsWith('••••')) {
      apiSecretFinal = encryptSensitive(clientSecret)
    } else if (existente?.apiSecret) {
      apiSecretFinal = existente.apiSecret
    }

    const data = {
      nombre: 'Botón Bancolombia',
      tipo: TIPO_BANCOLOMBIA,
      descripcion: 'Pasarela de pago Bancolombia — Botón de Pago (Persona Natural)',
      apiKey: encryptSensitive(clientId),
      apiSecret: apiSecretFinal,
      accountId: commerceId || null,
      configuracionExtra: extra,
      activa: !!activa,
      // Reset test status cuando se actualizan credenciales
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
      accion: existente ? 'BANCOLOMBIA_CONFIG_ACTUALIZADA' : 'BANCOLOMBIA_CONFIG_CREADA',
      modulo: 'configuracion-global',
      entidadId: conexion.id,
      entidadNombre: 'Botón Bancolombia',
      detalles: JSON.stringify({ ambiente: ambiente || 'sandbox', commerceId, activa }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: conexion.id,
        configurada: true,
        ambiente: ambiente || 'sandbox',
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
