import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isEmailConfigLocked, autoVerifyAndRestoreIfNeeded, getEmailLockStatus } from '@/lib/email-config-lock'
import { verificarCuentaBrevo } from '@/lib/email'

// GET /api/email-lock/health
// Endpoint público (sin auth) para monitoreo uptime.
// Retorna estado del bloqueo + conectividad con Brevo + config SMTP activa.
// NO expone credenciales.
export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean; message: string; latencyMs?: number }> = {}

  // 1. Verificar que la BD responde
  try {
    const t0 = Date.now()
    await db.variableGlobal.count({ where: { categoria: 'email_lock' } })
    checks.db = { ok: true, message: 'BD responde', latencyMs: Date.now() - t0 }
  } catch (err: any) {
    checks.db = { ok: false, message: `BD no responde: ${err.message}` }
  }

  // 2. Verificar estado del bloqueo
  try {
    const locked = await isEmailConfigLocked()
    checks.lock = {
      ok: true,
      message: locked ? 'Bloqueo ACTIVO (configuración protegida)' : 'Bloqueo inactivo',
    }
  } catch (err: any) {
    checks.lock = { ok: false, message: `Error consultando bloqueo: ${err.message}` }
  }

  // 3. Verificar que hay una conexión EMAIL_SMTP activa en BD
  try {
    const conexion = await db.conexionAPI.findFirst({
      where: { tipo: 'EMAIL_SMTP', activa: true },
      select: { id: true, nombre: true, updatedAt: true },
    })
    checks.smtpConfig = {
      ok: !!conexion,
      message: conexion
        ? `SMTP activo: ${conexion.nombre} (actualizado ${conexion.updatedAt.toISOString()})`
        : 'NO hay conexión EMAIL_SMTP activa',
    }
  } catch (err: any) {
    checks.smtpConfig = { ok: false, message: `Error consultando SMTP: ${err.message}` }
  }

  // 4. Verificar conectividad con Brevo (solo si el lock está activo, para no consumir API quota)
  let locked = false
  try {
    locked = await isEmailConfigLocked()
  } catch {}
  if (locked) {
    try {
      const t0 = Date.now()
      const brevo = await verificarCuentaBrevo()
      checks.brevo = {
        ok: brevo.success,
        message: brevo.success
          ? `Brevo OK (${brevo.cuenta?.email || 'sin email'}, plan=${brevo.cuenta?.plan || '?'})`
          : `Brevo falló: ${brevo.message}`,
        latencyMs: Date.now() - t0,
      }
    } catch (err: any) {
      checks.brevo = { ok: false, message: `Error verificando Brevo: ${err.message}` }
    }
  } else {
    checks.brevo = { ok: true, message: 'Skipped (lock inactivo, no se gasta quota Brevo)' }
  }

  // 5. Auto-verificar integridad y restaurar si hay drift (solo si lock activo)
  if (locked) {
    try {
      const auto = await autoVerifyAndRestoreIfNeeded()
      checks.integrity = {
        ok: !auto.driftDetails?.length,
        message: auto.restored
          ? `Drift detectado y AUTO-RESTAURADO`
          : auto.driftDetails?.length
            ? `Drift detectado pero NO se pudo restaurar: ${auto.driftDetails.length} diferencia(s)`
            : 'Integridad OK (sin drift)',
      }
    } catch (err: any) {
      checks.integrity = { ok: false, message: `Error en auto-verify: ${err.message}` }
    }
  } else {
    checks.integrity = { ok: true, message: 'Skipped (lock inactivo)' }
  }

  // Resultado agregado
  const allOk = Object.values(checks).every((c) => c.ok)
  const status = allOk ? 'ok' : 'degraded'
  const httpStatus = allOk ? 200 : 503

  // Información adicional del bloqueo (sin credenciales)
  let lockStatus: any = null
  try {
    lockStatus = await getEmailLockStatus()
  } catch {}

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks,
      lock: lockStatus
        ? {
            enabled: lockStatus.enabled,
            snapshotAt: lockStatus.snapshotAt,
            lastVerify: lockStatus.lastVerify,
            lastDrift: lockStatus.lastDrift,
          }
        : null,
    },
    { status: httpStatus },
  )
}
