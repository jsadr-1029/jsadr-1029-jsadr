import { NextRequest, NextResponse } from 'next/server'
import { enviarRecordatoriosPago } from '@/lib/recordatorios'
import { sanitizeError } from '@/lib/error-handler'
import { db } from '@/lib/db'

// =====================================================
// /api/recordatorios/cron — Tarea programada diaria (v4.4)
// =====================================================
//
// Este endpoint se invoca automáticamente por Vercel Cron todos los días
// a las 13:00 UTC (08:00 hora de Colombia, America/Bogota).
//
// Envía recordatorios a clientes cuyas cuotas vencen hoy o mañana,
// respetando su preferencia de notificación (WHATSAPP / EMAIL / AMBOS / NINGUNO).
//
// Autenticación: header X-Cron-Secret igual a process.env.CRON_SECRET.
// Si CRON_SECRET no está en .env, lo busca en VariableGlobal.CRON_SECRET,
// y si no existe, lo genera y persiste automáticamente (estable como
// BACKUP_KEY_SEED no depende de regeneraciones de .env).
//
// También puede invocarse manualmente por un ADMIN con header Authorization: Bearer.
// =====================================================

async function obtenerCronSecret(): Promise<string | null> {
  // 1. Intentar desde .env
  let secret = process.env.CRON_SECRET || ''
  if (secret && secret.length >= 16) return secret

  // 2. Buscar en VariableGlobal
  try {
    const v = await db.variableGlobal.findFirst({ where: { clave: 'CRON_SECRET' } })
    if (v && v.valor && v.valor.length >= 16) {
      return v.valor
    }

    // 3. Generar y persistir uno nuevo
    const crypto = await import('crypto')
    const nuevo = crypto.randomBytes(24).toString('hex')
    await db.variableGlobal.upsert({
      where: { clave: 'CRON_SECRET' },
      create: {
        clave: 'CRON_SECRET',
        valor: nuevo,
        descripcion: 'Secreto compartido para autenticar llamadas de Vercel Cron a /api/recordatorios/cron y /api/pagos/cron. Se envía como header X-Cron-Secret.',
      },
      update: {},
    })
    console.log('[cron] CRON_SECRET generado y guardado en VariableGlobal.CRON_SECRET')
    return nuevo
  } catch (e) {
    console.error('[cron] Error obteniendo CRON_SECRET:', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // === Auth: X-Cron-Secret, JWT de admin, o llamada interna de Vercel Cron ===
    const cronSecret = await obtenerCronSecret()
    const headerSecret = req.headers.get('x-cron-secret')
    const authHeader = req.headers.get('authorization')

    const tieneCronSecret = !!(cronSecret && headerSecret === cronSecret)
    const tieneJwtAdmin = !!(authHeader && authHeader.startsWith('Bearer '))

    // Vercel Cron llama desde el mismo deployment: incluye header
    // x-vercel-deployment-url (ej: jsadr-1029-jsadr.vercel.app).
    // Confiamos en este header para identificar la llamada como interna.
    const vercelDeploymentUrl = req.headers.get('x-vercel-deployment-url') || ''
    const vercelCronHeader = req.headers.get('x-vercel-cron') || ''
    const esVercelCronInterno = !!vercelDeploymentUrl && vercelCronHeader === '1'

    // En producción, exigir al menos uno de los 3
    if (process.env.NODE_ENV === 'production') {
      if (!tieneCronSecret && !tieneJwtAdmin && !esVercelCronInterno) {
        return NextResponse.json(
          { success: false, error: 'No autorizado. Se requiere X-Cron-Secret, Authorization, o llamada interna de Vercel Cron.' },
          { status: 401 }
        )
      }
      // Si viene JWT, validar
      if (tieneJwtAdmin && !tieneCronSecret && !esVercelCronInterno) {
        try {
          const jwt = (await import('jsonwebtoken')).default
          jwt.verify(authHeader!.substring(7), process.env.JWT_SECRET!)
        } catch {
          return NextResponse.json(
            { success: false, error: 'Token inválido o expirado' },
            { status: 401 }
          )
        }
      }
    }

    // === Ejecutar envío de recordatorios ===
    const resultado = await enviarRecordatoriosPago()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      resumen: {
        totalCuotasProcesadas: resultado.totalCuotasProcesadas,
        recordatoriosEnviados: resultado.recordatoriosEnviados,
        whatsappGenerados: resultado.whatsappGenerados,
        emailsEnviados: resultado.emailsEnviados,
        omitidosPrefNinguno: resultado.omitidosPrefNinguno,
        omitidosSinPref: resultado.omitidosSinPref,
        errores: resultado.errores.length,
      },
      detalle: resultado.detalle,
      errores: resultado.errores,
    })
  } catch (error: any) {
    console.error('[cron/recordatorios] Error fatal:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// GET alias para invocación simple desde Vercel Cron
export const GET = POST
