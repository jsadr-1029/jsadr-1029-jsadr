// Endpoint temporal de diagnóstico — llama a Brevo HTTPS API desde Vercel
// para ver qué error específico se obtiene.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decryptSensitive } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const log: string[] = []

    // 1. Verificar env var BREVO_API_KEY
    const envApiKey = process.env.BREVO_API_KEY
    log.push(`[1] env.BREVO_API_KEY: ${envApiKey ? `${envApiKey.slice(0, 25)}...${envApiKey.slice(-6)} (len=${envApiKey.length})` : 'NO DEFINIDA'}`)

    // 2. Leer ConexionAPI.EMAIL_SMTP.apiKey
    const smtp = await db.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
    let bdApiKey: string | null = null
    if (smtp?.apiKey) {
      try {
        bdApiKey = decryptSensitive(smtp.apiKey)
        log.push(`[2] BD ConexionAPI.apiKey (descifrada): ${bdApiKey.slice(0, 25)}...${bdApiKey.slice(-6)} (len=${bdApiKey.length})`)
      } catch (e: any) {
        log.push(`[2] BD ConexionAPI.apiKey NO se pudo descifrar: ${e.message}`)
      }
    } else {
      log.push(`[2] BD ConexionAPI.apiKey: NO configurada`)
    }

    // 3. Comparar
    if (envApiKey && bdApiKey) {
      log.push(`[3] ¿Coinciden env y BD?: ${envApiKey === bdApiKey ? 'SÍ' : 'NO (diferentes)'}`)
    }

    // 4. Probar API key con GET /v3/account
    const apiKeyToTest = envApiKey || bdApiKey
    if (!apiKeyToTest) {
      log.push(`[4] No hay API key para probar`)
      return NextResponse.json({ log })
    }
    log.push(`[4] Probando API key con GET https://api.brevo.com/v3/account ...`)
    try {
      const r = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': apiKeyToTest, accept: 'application/json' },
      })
      log.push(`    HTTP ${r.status}`)
      const body = await r.text()
      log.push(`    Body: ${body.slice(0, 400)}`)
    } catch (e: any) {
      log.push(`    EXCEPCIÓN: ${e.message}`)
    }

    // 5. Probar POST /v3/smtp/email
    log.push(`[5] Probando POST https://api.brevo.com/v3/smtp/email ...`)
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKeyToTest,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'JSADR Diagnóstico', email: 'jsa@jsadr.com.co' },
          to: [{ email: 'jsa@jsadr.com.co' }],
          subject: `TEST diagnóstico Vercel ${new Date().toISOString()}`,
          htmlContent: '<p>Test diagnóstico desde Vercel</p>',
        }),
      })
      log.push(`    HTTP ${r.status}`)
      const body = await r.text()
      log.push(`    Body: ${body.slice(0, 400)}`)
    } catch (e: any) {
      log.push(`    EXCEPCIÓN: ${e.message}`)
    }

    return NextResponse.json({ log })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
