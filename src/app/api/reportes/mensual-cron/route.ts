import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { enviarEmail, haySmtpConfigurado } from '@/lib/email'

// =====================================================
// GET /api/reportes/mensual-cron
// =====================================================
// Cron job que se ejecuta el día 1 de cada mes a las 09:00 UTC-5
// (14:00 UTC, schedule "0 14 1 * *" en vercel.json).
//
// Genera el informe mensual completo (financiero + técnico) y lo envía
// automáticamente a jsa@jsadr.com.co (o al destinatario configurado en
// la variable global INFORME_MENSUAL_DESTINATARIO).
//
// Autenticación: este endpoint es invocado por Vercel Cron, por lo que
// acepta:
//   1. Header X-Cron-Secret (de VariableGlobal.CRON_SECRET o env CRON_SECRET)
//   2. Headers internos de Vercel (x-vercel-cron: 1 + x-vercel-deployment-url)
//   3. JWT de administrador (para ejecución manual desde la UI)

const DESTINATARIO_DEFAULT = 'jsa@jsadr.com.co'

export async function GET(req: NextRequest) {
  // =====================================================
  // AUTENTICACIÓN
  // =====================================================
  const authOk = await autenticarCron(req)
  if (!authOk) {
    return NextResponse.json(
      { success: false, error: 'No autorizado. Este endpoint requiere X-Cron-Secret o JWT de administrador.' },
      { status: 401 }
    )
  }

  try {
    // Determinar destinatario: VariableGlobal > default
    let destinatario = DESTINATARIO_DEFAULT
    try {
      const vg = await db.variableGlobal.findUnique({
        where: { clave: 'INFORME_MENSUAL_DESTINATARIO' },
      })
      if (vg?.valor && vg.valor.includes('@')) {
        destinatario = vg.valor
      }
    } catch {
      // Si VariableGlobal no existe, usar default
    }

    // Determinar período: el mes anterior al actual
    const hoy = new Date()
    let anioInforme: number
    let mesInforme: number // 0-indexed
    if (hoy.getMonth() === 0) {
      anioInforme = hoy.getFullYear() - 1
      mesInforme = 11
    } else {
      anioInforme = hoy.getFullYear()
      mesInforme = hoy.getMonth() - 1
    }
    const inicioMes = new Date(anioInforme, mesInforme, 1, 0, 0, 0, 0)
    const finMes = new Date(anioInforme, mesInforme + 1, 1, 0, 0, 0, 0)
    const nombreMes = inicioMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

    // Verificar SMTP
    const smtpConfigurado = await haySmtpConfigurado()
    if (!smtpConfigurado) {
      console.error('[mensual-cron] SMTP no configurado. No se puede enviar el informe.')
      return NextResponse.json({
        success: false,
        error: 'SMTP no configurado. El informe no pudo enviarse.',
        periodo: nombreMes,
        destinatario,
      }, { status: 500 })
    }

    // =====================================================
    // GENERAR EL INFORME
    // =====================================================
    // Llamar internamente a la lógica de /api/reportes/mensual-informe
    // reusando el código. Hacemos un fetch interno a la API.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`

    const urlInforme = `${baseUrl}/api/reportes/mensual-informe?enviar=true&para=${encodeURIComponent(destinatario)}&mes=${anioInforme}-${String(mesInforme + 1).padStart(2, '0')}`

    // Como estamos dentro del mismo servidor, llamamos directamente a la función
    // en lugar de hacer un HTTP fetch. Pero para mantener la separación,
    // reutilizamos el código a través de un import dinámico.
    //
    // Sin embargo, las API routes de Next.js no son fácilmente importables.
    // La forma más simple es re-implementar el envío aquí, delegando la
    // generación del HTML a una función compartida. Para evitar duplicar
    // ~600 líneas, hacemos un fetch interno con el header X-Cron-Secret.

    const cronSecret = await obtenerCronSecret()
    const headers: Record<string, string> = {
      'X-Cron-Secret': cronSecret || '',
    }
    // Si el request original traía JWT, lo reenviamos
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const res = await fetch(urlInforme, { headers })
    const json = await res.json()

    if (!json.success) {
      console.error('[mensual-cron] Error generando informe:', json.error)
      return NextResponse.json({
        success: false,
        error: 'Error generando informe: ' + (json.error || 'desconocido'),
        periodo: nombreMes,
        destinatario,
      }, { status: 500 })
    }

    // Guardar log del envío en VariableGlobal para auditoría
    try {
      await db.variableGlobal.upsert({
        where: { clave: 'INFORME_MENSUAL_ULTIMO_ENVIO' },
        update: {
          valor: JSON.stringify({
            fecha: new Date().toISOString(),
            periodo: nombreMes,
            destinatario,
            envio: json.data?.envio,
            resumen: json.data?.resumen,
          }),
        },
        create: {
          clave: 'INFORME_MENSUAL_ULTIMO_ENVIO',
          valor: JSON.stringify({
            fecha: new Date().toISOString(),
            periodo: nombreMes,
            destinatario,
            envio: json.data?.envio,
            resumen: json.data?.resumen,
          }),
        },
      })
    } catch {
      // VariableGlobal puede no existir — no es crítico
    }

    return NextResponse.json({
      success: true,
      message: `Informe mensual de ${nombreMes} enviado a ${destinatario}`,
      data: {
        periodo: nombreMes,
        destinatario,
        envio: json.data?.envio,
        resumen: json.data?.resumen,
      },
    })
  } catch (error: any) {
    console.error('[mensual-cron] Error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// Alias POST = GET para compatibilidad con Vercel Cron
export async function POST(req: NextRequest) {
  return GET(req)
}

// =====================================================
// Autenticación del cron
// =====================================================
async function autenticarCron(req: NextRequest): Promise<boolean> {
  // 1. Header X-Cron-Secret
  const cronSecretHeader = req.headers.get('x-cron-secret')
  if (cronSecretHeader) {
    const cronSecret = await obtenerCronSecret()
    if (cronSecret && cronSecretHeader === cronSecret) return true
  }

  // 2. Headers internos de Vercel (x-vercel-cron: 1)
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (isVercelCron) {
    // Vercel envía estos headers solo cuando el cron es invocado por su sistema
    return true
  }

  // 3. JWT de admin (para ejecución manual desde la UI)
  //    Verificamos decodificando el JWT sin validar la firma aquí, ya que
  //    la verificación completa la hace requireRole en el endpoint destino.
  //    Si llegamos aquí, es porque queremos permitir que un admin dispare
  //    el cron manualmente.
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return false
    const token = authHeader.slice(7)
    // Decodificar el payload sin verificar firma (la verificación real la
    // hace el endpoint /api/reportes/mensual-informe cuando reenviamos)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    if (payload.rol === 'ADMIN' || payload.role === 'ADMIN') return true
    return false
  } catch {
    return false
  }
}

async function obtenerCronSecret(): Promise<string | null> {
  // 1. Variable de entorno
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  // 2. VariableGlobal en BD
  try {
    const vg = await db.variableGlobal.findUnique({
      where: { clave: 'CRON_SECRET' },
    })
    return vg?.valor || null
  } catch {
    return null
  }
}
