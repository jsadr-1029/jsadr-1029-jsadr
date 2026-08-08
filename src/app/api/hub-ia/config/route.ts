import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { encryptSensitive, decryptSensitive } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { verificarZAI } from '@/lib/hub-ia/providers/zai'
import { verificarOpenAI, estaOpenAIConfigurado, getModelo as getOpenaiModelo } from '@/lib/hub-ia/providers/openai'
import { estaAgentePausado } from '@/lib/hub-ia/security-gateway'

export const runtime = 'nodejs'

// GET — devuelve configuración actual del Hub IA
export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const configs = await db.hubIAConfig.findMany()
    const configMap: Record<string, string> = {}
    for (const c of configs) configMap[c.clave] = c.valor

    // NO devolver API keys en texto plano — solo si están configuradas
    const openaiKeySet = !!configMap['openai_api_key'] || !!process.env.OPENAI_API_KEY
    const zaiOk = await verificarZAI()
    const openaiOk = openaiKeySet ? await verificarOpenAI() : { ok: false, error: 'No configurado' }
    const pausado = await estaAgentePausado()
    const openaiModelo = openaiKeySet ? await getOpenaiModelo() : 'gpt-4o-mini'

    return NextResponse.json({
      success: true,
      data: {
        providers: {
          zai: {
            disponible: zaiOk.ok,
            error: zaiOk.error,
            configured: true, // siempre true (sandbox)
            modeloDefault: 'zai-glm',
          },
          openai: {
            disponible: openaiOk.ok,
            error: openaiOk.error,
            configured: openaiKeySet,
            modeloDefault: openaiModelo,
            apiKeySet: openaiKeySet,
          },
        },
        agentePausado: pausado,
        providerDefault: configMap['provider_default'] || 'auto',
        modoDefault: configMap['modo_default'] || 'supervisado',
        limiteMensualUsd: parseFloat(configMap['limite_mensual_usd'] || '50'),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// PATCH — actualiza configuración del Hub IA
export async function PATCH(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { clave, valor } = body
    if (!clave || typeof clave !== 'string') {
      return NextResponse.json({ success: false, error: 'clave es requerido' }, { status: 400 })
    }

    // Claves permitidas
    const PERMITIDAS = ['openai_api_key', 'openai_modelo', 'provider_default', 'modo_default', 'limite_mensual_usd']
    if (!PERMITIDAS.includes(clave)) {
      return NextResponse.json({ success: false, error: `Clave '${clave}' no es configurable` }, { status: 400 })
    }

    let valorFinal = String(valor)
    // Si es API key, cifrar antes de guardar
    if (clave === 'openai_api_key' && valor) {
      valorFinal = encryptSensitive(String(valor))
    }

    await db.hubIAConfig.upsert({
      where: { clave },
      create: { clave, valor: valorFinal, descripcion: `Config Hub IA: ${clave}`, updatedBy: user.nombre },
      update: { valor: valorFinal, updatedBy: user.nombre },
    })

    return NextResponse.json({ success: true, data: { actualizado: true } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
