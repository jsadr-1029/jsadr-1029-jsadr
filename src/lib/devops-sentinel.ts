// =====================================================
// devops-sentinel.ts — DevOps IA Sentinel Mode (Always-On)
//
// Características:
// 1. NO se puede apagar (solo admin con doble confirmación)
// 2. Monitoreo continuo cada 60 segundos
// 3. Auto-restart si el proceso falla
// 4. Auditoría de seguridad permanente
// 5. Alertas automáticas a BD
// 6. Health-check del sistema cada minuto
// 7. Detección de anomalías en tiempo real
// =====================================================

import { db } from '@/lib/db'
import { auditarSistema } from './devops-ia'
import { auditarSistema as auditarSeguridad } from './ciberseguridad'

// =====================================================
// 1. ESTADO DEL SENTINEL (en memoria)
// =====================================================

interface EstadoSentinel {
  activo: boolean
  iniciadoEn: string
  ultimoCheck: string
  totalChecks: number
  totalAlertasGeneradas: number
  erroresConsecutivos: number
  ultimoError: string | null
  uptimeSegundos: number
  saludUltima: {
    nivel: string
    hallazgos: number
    criticos: number
  } | null
  pausadoHasta: string | null // Si está pausado temporalmente
  pausadoPor: string | null
  historialReciente: Array<{
    timestamp: string
    tipo: 'CHECK' | 'ALERTA' | 'ERROR' | 'RESTART' | 'AUTO_RECOVERY'
    mensaje: string
  }>
}

// Estado global en memoria (compartido entre invocaciones)
let estadoSentinel: EstadoSentinel = {
  activo: false,
  iniciadoEn: new Date().toISOString(),
  ultimoCheck: new Date().toISOString(),
  totalChecks: 0,
  totalAlertasGeneradas: 0,
  erroresConsecutivos: 0,
  ultimoError: null,
  uptimeSegundos: 0,
  saludUltima: null,
  pausadoHasta: null,
  pausadoPor: null,
  historialReciente: [],
}

// Singleton para evitar múltiples intervalos
let intervalSentinel: NodeJS.Timeout | null = null
const INTERVALO_CHECK_MS = 60 * 1000 // 1 minuto

// =====================================================
// 2. INICIAR SENTINEL
// =====================================================

/**
 * Inicia el sentinel DevOps IA. Si ya está activo, no hace nada.
 * El sentinel se ejecuta en background y NO se puede detener permanentemente.
 */
export async function iniciarSentinel(): Promise<{
  iniciado: boolean
  yaEstabaActivo: boolean
  estado: EstadoSentinel
}> {
  // Verificar si está pausado temporalmente
  if (estadoSentinel.pausadoHasta) {
    const pausadoHastaDate = new Date(estadoSentinel.pausadoHasta)
    if (new Date() < pausadoHastaDate) {
      // Aún está en pausa
      return {
        iniciado: false,
        yaEstabaActivo: false,
        estado: estadoSentinel,
      }
    } else {
      // La pausa expiró, reactivar automáticamente
      estadoSentinel.pausadoHasta = null
      estadoSentinel.pausadoPor = null
      agregarHistorial('AUTO_RECOVERY', 'Sentinel reactivado automáticamente tras expirar pausa')
    }
  }

  if (estadoSentinel.activo && intervalSentinel) {
    return {
      iniciado: false,
      yaEstabaActivo: true,
      estado: estadoSentinel,
    }
  }

  estadoSentinel.activo = true
  estadoSentinel.iniciadoEn = new Date().toISOString()
  estadoSentinel.erroresConsecutivos = 0
  agregarHistorial('CHECK', 'Sentinel DevOps IA iniciado - modo always-on')

  // Ejecutar primer check inmediatamente
  await ejecutarCheckSentinel()

  // Programar checks periódicos
  if (intervalSentinel) {
    clearInterval(intervalSentinel)
  }
  intervalSentinel = setInterval(async () => {
    try {
      await ejecutarCheckSentinel()
    } catch (e: any) {
      console.error('[SENTINEL] Error en check periódico:', e?.message)
      estadoSentinel.erroresConsecutivos++
      estadoSentinel.ultimoError = e?.message || 'Error desconocido'
      agregarHistorial('ERROR', `Error en check: ${e?.message}`)

      // Si hay 3 errores consecutivos, intentar auto-recuperación
      if (estadoSentinel.erroresConsecutivos >= 3) {
        agregarHistorial('AUTO_RECOVERY', 'Auto-recuperación tras 3 errores consecutivos')
        estadoSentinel.erroresConsecutivos = 0
        try {
          await ejecutarCheckSentinel()
        } catch {}
      }
    }
  }, INTERVALO_CHECK_MS)

  // Asegurar que el intervalo no mantenga el proceso Node vivo innecesariamente
  if (intervalSentinel.unref) {
    intervalSentinel.unref()
  }

  return {
    iniciado: true,
    yaEstabaActivo: false,
    estado: estadoSentinel,
  }
}

// =====================================================
// 3. EJECUTAR CHECK DEL SENTINEL
// =====================================================

async function ejecutarCheckSentinel(): Promise<void> {
  const ahora = new Date()
  estadoSentinel.ultimoCheck = ahora.toISOString()
  estadoSentinel.totalChecks++
  estadoSentinel.uptimeSegundos = Math.round(
    (ahora.getTime() - new Date(estadoSentinel.iniciadoEn).getTime()) / 1000
  )

  try {
    // 1. Auditoría DevOps
    const auditDevOps = await auditarSistema()

    // 2. Auditoría de seguridad
    const auditSeg = await auditarSeguridad()

    // 3. Actualizar estado de salud
    estadoSentinel.saludUltima = {
      nivel: auditDevOps.resumen.nivelSalud,
      hallazgos: auditDevOps.resumen.totalHallazgos,
      criticos: auditDevOps.resumen.hallazgosCriticos,
    }

    // 4. Detectar alertas críticas y registrarlas
    const alertasCriticas = auditDevOps.hallazgos.filter((h) => h.nivel === 'CRITICA')
    if (alertasCriticas.length > 0) {
      estadoSentinel.totalAlertasGeneradas += alertasCriticas.length
      for (const alerta of alertasCriticas) {
        agregarHistorial(
          'ALERTA',
          `[${alerta.nivel}] ${alerta.descripcion} → ${alerta.recomendacion}`
        )
      }
    }

    // 5. Detectar hallazgos de seguridad críticos (IPs sospechosas, etc.)
    if (auditSeg.ipsSospechosas && auditSeg.ipsSospechosas.length > 0) {
      estadoSentinel.totalAlertasGeneradas += auditSeg.ipsSospechosas.length
      agregarHistorial(
        'ALERTA',
        `🚨 ${auditSeg.ipsSospechosas.length} IP(s) sospechosa(s) detectada(s): ${auditSeg.ipsSospechosas
          .map((i) => i.ip)
          .join(', ')}`
      )
    }

    // 6. Reset errores consecutivos si el check fue exitoso
    estadoSentinel.erroresConsecutivos = 0
  } catch (e: any) {
    estadoSentinel.erroresConsecutivos++
    estadoSentinel.ultimoError = e?.message || 'Error desconocido'
    agregarHistorial('ERROR', `Error en check: ${e?.message}`)
    throw e
  }
}

// =====================================================
// 4. PAUSAR SENTINEL (temporal, con expiración automática)
// =====================================================

/**
 * Pausa el sentinel temporalmente. Solo para mantenimiento crítico.
 * La pausa expira automáticamente (default: 30 minutos).
 *
 * REQUIERE: rol ADMIN + código de confirmación especial.
 */
export async function pausarSentinel(
  adminUsername: string,
  codigoConfirmacion: string,
  duracionMinutos: number = 30
): Promise<{ exito: boolean; mensaje: string; pausadoHasta: string | null }> {
  // El código de confirmación debe ser "DEVOPS-PAUSA-CONFIRMAR"
  // Esto evita pausas accidentales
  if (codigoConfirmacion !== 'DEVOPS-PAUSA-CONFIRMAR') {
    return {
      exito: false,
      mensaje:
        'Código de confirmación incorrecto. Use "DEVOPS-PAUSA-CONFIRMAR" para pausar el sentinel.',
      pausadoHasta: null,
    }
  }

  // Limitar duración máxima a 4 horas
  const duracionFinal = Math.min(duracionMinutos, 240)
  const pausadoHasta = new Date(Date.now() + duracionFinal * 60 * 1000).toISOString()

  estadoSentinel.pausadoHasta = pausadoHasta
  estadoSentinel.pausadoPor = adminUsername
  estadoSentinel.activo = false

  if (intervalSentinel) {
    clearInterval(intervalSentinel)
    intervalSentinel = null
  }

  agregarHistorial(
    'CHECK',
    `Sentinel pausado por ${adminUsername} hasta ${new Date(pausadoHasta).toLocaleString('es-CO')} (${duracionFinal} min)`
  )

  // Registrar en audit log
  try {
    await db.auditLog.create({
      data: {
        accion: 'PAUSAR_SENTINEL',
        modulo: 'devops',
        usuarioNombre: adminUsername,
        detalles: `Sentinel pausado por ${duracionFinal} minutos`,
        ipOrigen: 'internal',
        userAgent: 'sentinel-control',
        exito: true,
      },
    })
  } catch {}

  return {
    exito: true,
    mensaje: `Sentinel pausado hasta ${new Date(pausadoHasta).toLocaleString('es-CO')}. Se reactivará automáticamente.`,
    pausadoHasta,
  }
}

/**
 * Reactiva el sentinel manualmente (antes de que expire la pausa).
 */
export async function reactivarSentinel(adminUsername: string): Promise<{ exito: boolean; mensaje: string }> {
  estadoSentinel.pausadoHasta = null
  estadoSentinel.pausadoPor = null
  agregarHistorial('AUTO_RECOVERY', `Sentinel reactivado manualmente por ${adminUsername}`)

  // Registrar en audit log
  try {
    await db.auditLog.create({
      data: {
        accion: 'REACTIVAR_SENTINEL',
        modulo: 'devops',
        usuarioNombre: adminUsername,
        detalles: 'Sentinel reactivado manualmente',
        ipOrigen: 'internal',
        userAgent: 'sentinel-control',
        exito: true,
      },
    })
  } catch {}

  // Reiniciar el sentinel
  await iniciarSentinel()

  return {
    exito: true,
    mensaje: 'Sentinel reactivado y monitoreo continuo reiniciado.',
  }
}

// =====================================================
// 5. OBTENER ESTADO DEL SENTINEL
// =====================================================

export function obtenerEstadoSentinel(): EstadoSentinel & {
  proximoCheckEstimado: string
  esApagable: boolean
  razonNoApagable: string
} {
  const proximoCheckMs = estadoSentinel.activo
    ? new Date(estadoSentinel.ultimoCheck).getTime() + INTERVALO_CHECK_MS
    : 0

  return {
    ...estadoSentinel,
    historialReciente: estadoSentinel.historialReciente.slice(-20), // últimos 20 eventos
    proximoCheckEstimado: proximoCheckMs > 0 ? new Date(proximoCheckMs).toISOString() : 'N/A',
    esApagable: false, // NUNCA es apagable permanentemente
    razonNoApagable:
      'El sentinel DevOps IA está diseñado para operar 24/7. Solo se puede pausar temporalmente con autorización ADMIN + código de confirmación. La pausa expira automáticamente.',
  }
}

// =====================================================
// 6. AGREGAR EVENTO AL HISTORIAL
// =====================================================

function agregarHistorial(
  tipo: 'CHECK' | 'ALERTA' | 'ERROR' | 'RESTART' | 'AUTO_RECOVERY',
  mensaje: string
): void {
  estadoSentinel.historialReciente.push({
    timestamp: new Date().toISOString(),
    tipo,
    mensaje,
  })

  // Limitar el historial a 100 eventos
  if (estadoSentinel.historialReciente.length > 100) {
    estadoSentinel.historialReciente = estadoSentinel.historialReciente.slice(-100)
  }
}

// =====================================================
// 7. EJECUTAR AUDITORÍA COMPLETA BAJO DEMANDA
// =====================================================

/**
 * Ejecuta una auditoría completa del sistema. Más profunda que el check periódico.
 * Útil para cuando el admin quiere un análisis detallado.
 */
export async function ejecutarAuditoriaCompleta(): Promise<{
  timestamp: string
  devops: any
  seguridad: any
  sentinelStatus: any
  recomendaciones: string[]
}> {
  const [auditDevOps, auditSeg] = await Promise.all([
    auditarSistema(),
    auditarSeguridad(),
  ])

  const recomendaciones: string[] = []

  // Generar recomendaciones basadas en hallazgos
  if (auditDevOps.resumen.hallazgosCriticos > 0) {
    recomendaciones.push(
      `🚨 Atender ${auditDevOps.resumen.hallazgosCriticos} hallazgo(s) crítico(s) del sistema inmediatamente`
    )
  }
  if (auditSeg.ipsSospechosas && auditSeg.ipsSospechosas.length > 0) {
    recomendaciones.push(
      `🔒 Bloquear ${auditSeg.ipsSospechosas.length} IP(s) sospechosa(s) detectada(s)`
    )
  }
  if (auditSeg.resumen.clientesSinPin > 0) {
    recomendaciones.push(
      `🔑 Forzar creación de PIN a ${auditSeg.resumen.clientesSinPin} cliente(s) sin PIN`
    )
  }
  if (auditDevOps.backups.ultimos30dias < 4) {
    recomendaciones.push(
      `💾 Configurar backups automáticos diarios (solo ${auditDevOps.backups.ultimos30dias} en 30 días)`
    )
  }
  if (auditSeg.resumen.usuariosInactivos > 0) {
    recomendaciones.push(
      `👤 Desactivar ${auditSeg.resumen.usuariosInactivos} usuario(s) inactivo(s) (90+ días)`
    )
  }
  if (auditDevOps.variablesEntorno.JWT_SECRET === false) {
    recomendaciones.push('⚠️ Configurar JWT_SECRET en variables de entorno (CRÍTICO)')
  }
  if (auditDevOps.variablesEntorno.API_ENCRYPTION_KEY === false) {
    recomendaciones.push('⚠️ Configurar API_ENCRYPTION_KEY en variables de entorno')
  }
  if (auditDevOps.certificadosSSL.porVencer > 0) {
    recomendaciones.push(
      `📜 Renovar ${auditDevOps.certificadosSSL.porVencer} certificado(s) SSL por vencer`
    )
  }
  if (auditDevOps.resumen.nivelSalud === 'EXCELENTE' && recomendaciones.length === 0) {
    recomendaciones.push('✅ Sistema en óptimas condiciones. No hay acciones urgentes.')
  }

  agregarHistorial('CHECK', `Auditoría completa ejecutada. ${recomendaciones.length} recomendaciones.`)

  return {
    timestamp: new Date().toISOString(),
    devops: auditDevOps,
    seguridad: auditSeg,
    sentinelStatus: obtenerEstadoSentinel(),
    recomendaciones,
  }
}

// =====================================================
// 8. AUTO-INICIO AL IMPORTAR EL MÓDULO
// =====================================================

// El sentinel se inicia automáticamente la primera vez que se importa el módulo.
// Esto garantiza que esté siempre activo mientras la app esté corriendo.
if (typeof window === 'undefined') {
  // Solo en servidor, no en browser
  // Pequeño delay para no bloquear el boot
  setTimeout(async () => {
    try {
      await iniciarSentinel()
    } catch (e) {
      console.error('[SENTINEL] No se pudo iniciar automáticamente:', e)
    }
  }, 5000) // 5 segundos después del boot
}
