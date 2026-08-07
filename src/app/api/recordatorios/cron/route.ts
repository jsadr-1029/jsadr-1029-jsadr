import { NextRequest, NextResponse } from 'next/server'
import { enviarRecordatoriosPago } from '@/lib/recordatorios'
import { sanitizeError } from '@/lib/error-handler'

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
// En desarrollo (NODE_ENV !== 'production'), se permite sin secret para pruebas.
//
// También puede invocarse manualmente por un ADMIN con header Authorization: Bearer.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // === Auth: X-Cron-Secret o JWT de admin ===
    const cronSecret = process.env.CRON_SECRET
    const headerSecret = req.headers.get('x-cron-secret')
    const authHeader = req.headers.get('authorization')

    const tieneCronSecret = cronSecret && headerSecret === cronSecret
    const tieneJwtAdmin = authHeader && authHeader.startsWith('Bearer ')

    // En producción, exigir al menos uno
    if (process.env.NODE_ENV === 'production') {
      if (!tieneCronSecret && !tieneJwtAdmin) {
        return NextResponse.json(
          { success: false, error: 'No autorizado. Se requiere X-Cron-Secret o Authorization.' },
          { status: 401 }
        )
      }
      // Si viene JWT, validar (verificación básica de firma)
      if (tieneJwtAdmin && !tieneCronSecret) {
        try {
          // Verificación lazy — si es inválido, jwt.verify lanzará error
          const jwt = (await import('jsonwebtoken')).default
          jwt.verify(authHeader!.substring(7), process.env.JWT_SECRET!)
        } catch {
          return NextResponse.json(
            { success: false, error: 'Token inválido o expirado' },
            { status: 401 }
          )
        }
      }
      if (!cronSecret && !tieneJwtAdmin) {
        return NextResponse.json(
          { success: false, error: 'CRON_SECRET no configurado' },
          { status: 500 }
        )
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
