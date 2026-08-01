// =====================================================
// ciberseguridad.ts — CISO Inteligente (SOC AI)
// Función: auditoría permanente + detección de riesgos
// =====================================================

import { db } from '@/lib/db'

// =====================================================
// Auditar el sistema completo
// =====================================================
export async function auditarSistema() {
  const ahora = new Date()
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000)
  const hace7dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)
  const hace30dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
  const hace90dias = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000)

  // === 1. Usuarios y permisos ===
  const [totalUsuarios, totalClientes, usuariosBloqueados, admins] = await Promise.all([
    db.usuario.count(),
    db.cliente.count(),
    db.usuario.count({ where: { bloqueadoHasta: { gt: ahora } } }),
    db.usuario.count({ where: { rol: 'ADMIN' } }),
  ])

  // === 2. Clientes sin PIN o sin clave ===
  const clientesSinPin = await db.cliente.count({ where: { pinHash: null } })
  const clientesSinClave = await db.cliente.count({ where: { claveHash: null } })

  // === 3. Accesos en últimas 24h ===
  const accesos24h = await db.accesoPortal.findMany({
    where: { createdAt: { gte: hace24h } },
    select: { exito: true, ipOrigen: true, accion: true, clienteCedula: true, createdAt: true },
  })

  const accesosExitosos = accesos24h.filter((a) => a.exito).length
  const accesosFallidos = accesos24h.filter((a) => !a.exito).length

  // === 4. IPs distintas en 24h ===
  const ipsUnicas = new Set(accesos24h.map((a) => a.ipOrigen).filter(Boolean))

  // === 5. Intentos fallidos por IP (potencial fuerza bruta) ===
  const intentosPorIP: Record<string, number> = {}
  accesos24h.forEach((a) => {
    if (!a.exito && a.ipOrigen) {
      intentosPorIP[a.ipOrigen] = (intentosPorIP[a.ipOrigen] || 0) + 1
    }
  })
  const ipsSospechosas = Object.entries(intentosPorIP)
    .filter(([_, count]) => count >= 5)
    .map(([ip, count]) => ({ ip, intentos: count }))

  // === 6. Auditoría reciente ===
  const auditReciente = await db.auditLog.findMany({
    where: { fecha: { gte: hace24h } },
    select: { accion: true, usuarioNombre: true, modulo: true, exito: true, fecha: true },
    orderBy: { fecha: 'desc' },
    take: 50,
  })

  // === 7. Auditoría fallida (acciones que fallaron) ===
  const auditFallida = auditReciente.filter((a) => a.exito === false)

  // === 8. Backups ===
  const [totalBackups, backups30dias] = await Promise.all([
    db.backup.count(),
    db.backup.count({ where: { createdAt: { gte: hace30dias } } }),
  ])

  // === 9. Conexiones API ===
  const [conexionesActivas, conexionesInactivas] = await Promise.all([
    db.conexionAPI.count({ where: { activa: true } }),
    db.conexionAPI.count({ where: { activa: false } }),
  ])

  // === 10. Usuarios inactivos (sin acceso en 90 días) ===
  const usuariosInactivos = await db.usuario.count({
    where: {
      OR: [
        { ultimoAcceso: null },
        { ultimoAcceso: { lt: hace90dias } },
      ],
    },
  })

  // === 11. Módulos protegidos ===
  const modulosProtegidos = await db.seguridadModulo.count({ where: { protegido: true } })

  // === 12. Generar hallazgos ===
  const hallazgos: Array<{
    id: string
    descripcion: string
    nivel: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'
    impacto: string
    probabilidad: string
    recomendacion: string
    estado: string
    fechaDeteccion: string
  }> = []

  // 12.1 Clientes sin PIN
  if (clientesSinPin > 0) {
    hallazgos.push({
      id: 'H001',
      descripcion: `${clientesSinPin} cliente(s) sin PIN configurado`,
      nivel: 'ALTA',
      impacto: 'Acceso al portal sin autenticación adecuada',
      probabilidad: 'Alta',
      recomendacion: 'Forzar creación de PIN en próximo acceso',
      estado: 'PENDIENTE',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.2 Clientes sin clave
  if (clientesSinClave > 0) {
    hallazgos.push({
      id: 'H002',
      descripcion: `${clientesSinClave} cliente(s) sin clave de acceso`,
      nivel: 'MEDIA',
      impacto: 'No pueden usar autenticación con clave',
      probabilidad: 'Media',
      recomendacion: 'Ofrecer creación de clave desde el portal',
      estado: 'PENDIENTE',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.3 IPs sospechosas (fuerza bruta)
  if (ipsSospechosas.length > 0) {
    hallazgos.push({
      id: 'H003',
      descripcion: `${ipsSospechosas.length} IP(s) con 5+ intentos fallidos en 24h`,
      nivel: 'CRITICA',
      impacto: 'Posible ataque de fuerza bruta',
      probabilidad: 'Alta',
      recomendacion: `Bloquear IPs: ${ipsSospechosas.map((i) => i.ip).join(', ')}`,
      estado: 'CRITICO',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.4 Usuarios bloqueados
  if (usuariosBloqueados > 0) {
    hallazgos.push({
      id: 'H004',
      descripcion: `${usuariosBloqueados} usuario(s) interno(s) bloqueado(s)`,
      nivel: 'MEDIA',
      impacto: 'Posibles intentos de acceso no autorizados',
      probabilidad: 'Media',
      recomendacion: 'Revisar y desbloquear si corresponde',
      estado: 'PENDIENTE',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.5 Usuarios inactivos con permisos
  if (usuariosInactivos > 0) {
    hallazgos.push({
      id: 'H005',
      descripcion: `${usuariosInactivos} usuario(s) inactivo(s) (90+ días sin acceso) con cuenta activa`,
      nivel: 'MEDIA',
      impacto: 'Cuentas dormidas que pueden ser comprometidas',
      probabilidad: 'Media',
      recomendacion: 'Desactivar cuentas inactivas o requerir reactivación',
      estado: 'PENDIENTE',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.6 Sin backups recientes
  if (backups30dias === 0) {
    hallazgos.push({
      id: 'H006',
      descripcion: 'No hay backups en los últimos 30 días',
      nivel: 'CRITICA',
      impacto: 'Pérdida de datos en caso de incidente',
      probabilidad: 'Alta',
      recomendacion: 'Configurar backups automáticos diarios',
      estado: 'CRITICO',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.7 Accesos fallidos altos
  if (accesosFallidos > 20) {
    hallazgos.push({
      id: 'H007',
      descripcion: `${accesosFallidos} intentos fallidos de acceso en 24h`,
      nivel: 'ALTA',
      impacto: 'Posible ataque o usuarios olvidando credenciales',
      probabilidad: 'Alta',
      recomendacion: 'Revisar IPs y considerar CAPTCHA',
      estado: 'PENDIENTE',
      fechaDeteccion: ahora.toISOString(),
    })
  }

  // 12.8 Sin MFA (sin código para detectar, lo marcamos como recordatorio)
  hallazgos.push({
    id: 'H008',
    descripcion: 'Verificar MFA activado en cuentas ADMIN',
    nivel: 'MEDIA',
    impacto: 'Si un ADMIN es comprometido, acceso total al sistema',
    probabilidad: 'Media',
    recomendacion: 'Activar MFA en todas las cuentas ADMIN',
    estado: 'PENDIENTE',
    fechaDeteccion: ahora.toISOString(),
  })

  // === 13. Calcular nivel de riesgo general ===
  const criticos = hallazgos.filter((h) => h.nivel === 'CRITICA').length
  const altos = hallazgos.filter((h) => h.nivel === 'ALTA').length
  const medios = hallazgos.filter((h) => h.nivel === 'MEDIA').length

  let nivelRiesgoGeneral = 'BAJO'
  let colorRiesgo = '🟢'
  if (criticos > 0) {
    nivelRiesgoGeneral = 'CRITICO'
    colorRiesgo = '🔴'
  } else if (altos > 0) {
    nivelRiesgoGeneral = 'ALTO'
    colorRiesgo = '🟠'
  } else if (medios > 0) {
    nivelRiesgoGeneral = 'MEDIO'
    colorRiesgo = '🟡'
  }

  // === 14. Resumen ejecutivo ===
  const resumen = {
    fecha: ahora.toISOString(),
    nivelRiesgoGeneral,
    colorRiesgo,
    totalUsuarios,
    totalClientes,
    admins,
    usuariosBloqueados,
    usuariosInactivos,
    clientesSinPin,
    clientesSinClave,
    accesos24h: accesos24h.length,
    accesosExitosos,
    accesosFallidos,
    ipsUnicas: ipsUnicas.size,
    ipsSospechosas: ipsSospechosas.length,
    auditReciente: auditReciente.length,
    auditFallida: auditFallida.length,
    totalBackups,
    backups30dias,
    conexionesActivas,
    conexionesInactivas,
    modulosProtegidos,
    totalHallazgos: hallazgos.length,
    hallazgosCriticos: criticos,
    hallazgosAltos: altos,
    hallazgosMedios: medios,
  }

  return {
    resumen,
    hallazgos,
    ipsSospechosas,
    accesosRecientes: accesos24h.slice(0, 10).map((a) => ({
      ip: a.ipOrigen,
      exito: a.exito,
      accion: a.accion,
      cedula: a.clienteCedula,
      fecha: a.createdAt,
    })),
    auditReciente: auditReciente.slice(0, 10).map((a) => ({
      accion: a.accion,
      usuario: a.usuarioNombre,
      modulo: a.modulo,
      exito: a.exito,
      fecha: a.fecha,
    })),
  }
}

// =====================================================
// Generar informe de seguridad en texto
// =====================================================
export async function generarInformeSeguridad() {
  const audit = await auditarSistema()
  const r = audit.resumen

  let texto = `🛡️ INFORME DE SEGURIDAD — ${new Date().toLocaleString('es-CO')}\n\n`

  texto += `═══ RESUMEN EJECUTIVO ═══\n`
  texto += `Nivel general: ${r.colorRiesgo} ${r.nivelRiesgoGeneral}\n`
  texto += `Hallazgos totales: ${r.totalHallazgos} (${r.hallazgosCriticos} críticos, ${r.hallazgosAltos} altos, ${r.hallazgosMedios} medios)\n\n`

  texto += `═══ INDICADORES ═══\n`
  texto += `Usuarios internos: ${r.totalUsuarios} (${r.admins} ADMIN)\n`
  texto += `Clientes: ${r.totalClientes}\n`
  texto += `• Sin PIN: ${r.clientesSinPin}\n`
  texto += `• Sin clave: ${r.clientesSinClave}\n`
  texto += `Usuarios bloqueados: ${r.usuariosBloqueados}\n`
  texto += `Usuarios inactivos (90+ días): ${r.usuariosInactivos}\n\n`

  texto += `═══ ACCESOS (24h) ═══\n`
  texto += `Total: ${r.accesos24h}\n`
  texto += `Exitosos: ${r.accesosExitosos}\n`
  texto += `Fallidos: ${r.accesosFallidos}\n`
  texto += `IPs únicas: ${r.ipsUnicas}\n`
  texto += `IPs sospechosas (5+ intentos): ${r.ipsSospechosas}\n\n`

  texto += `══️ AUDITORÍA (24h) ═══\n`
  texto += `Eventos: ${r.auditReciente}\n`
  texto += `Fallidos: ${r.auditFallida}\n\n`

  texto += `═══ BACKUPS ═══\n`
  texto += `Total: ${r.totalBackups}\n`
  texto += `Últimos 30 días: ${r.backups30dias}\n\n`

  texto += `═══ CONEXIONES API ═══\n`
  texto += `Activas: ${r.conexionesActivas}\n`
  texto += `Inactivas: ${r.conexionesInactivas}\n\n`

  if (audit.hallazgos.length > 0) {
    texto += `═══ HALLAZGOS (${audit.hallazgos.length}) ═══\n\n`
    audit.hallazgos.forEach((h, i) => {
      const emoji = h.nivel === 'CRITICA' ? '🔴' : h.nivel === 'ALTA' ? '🟠' : h.nivel === 'MEDIA' ? '🟡' : '🟢'
      texto += `${i + 1}. ${emoji} [${h.nivel}] ${h.descripcion}\n`
      texto += `   Impacto: ${h.impacto}\n`
      texto += `   Probabilidad: ${h.probabilidad}\n`
      texto += `   Recomendación: ${h.recomendacion}\n`
      texto += `   Estado: ${h.estado}\n\n`
    })
  }

  // Plan de acción
  texto += `═══ PLAN DE ACCIÓN PRIORIZADO ═══\n\n`
  const criticos = audit.hallazgos.filter((h) => h.nivel === 'CRITICA')
  const altos = audit.hallazgos.filter((h) => h.nivel === 'ALTA')
  const medios = audit.hallazgos.filter((h) => h.nivel === 'MEDIA')

  let prioridad = 1
  if (criticos.length > 0) {
    texto += `🔴 PRIORIDAD CRÍTICA (inmediata)\n`
    criticos.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   ${h.descripcion}\n\n`
      prioridad++
    })
  }
  if (altos.length > 0) {
    texto += `🟠 PRIORIDAD ALTA (24-48h)\n`
    altos.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   ${h.descripcion}\n\n`
      prioridad++
    })
  }
  if (medios.length > 0) {
    texto += `🟡 PRIORIDAD MEDIA (1 semana)\n`
    medios.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   ${h.descripcion}\n\n`
      prioridad++
    })
  }

  return texto
}

// =====================================================
// Generar plan de acción priorizado
// =====================================================
export async function generarPlanAccion() {
  const audit = await auditarSistema()

  let texto = `📋 PLAN DE ACCIÓN DE SEGURIDAD\n\n`

  const criticos = audit.hallazgos.filter((h) => h.nivel === 'CRITICA')
  const altos = audit.hallazgos.filter((h) => h.nivel === 'ALTA')
  const medios = audit.hallazgos.filter((h) => h.nivel === 'MEDIA')

  if (criticos.length === 0 && altos.length === 0 && medios.length === 0) {
    texto += `✅ No hay acciones urgentes. Sistema en buen estado de seguridad.`
    return texto
  }

  let prioridad = 1
  if (criticos.length > 0) {
    texto += `🔴 ACCIONES INMEDIATAS (hoy)\n`
    criticos.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   Problema: ${h.descripcion}\n   Impacto: ${h.impacto}\n\n`
      prioridad++
    })
  }
  if (altos.length > 0) {
    texto += `🟠 ACCIONES ESTA SEMANA\n`
    altos.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   Problema: ${h.descripcion}\n\n`
      prioridad++
    })
  }
  if (medios.length > 0) {
    texto += `🟡 MEJORAS PLANIFICADAS (próximo mes)\n`
    medios.forEach((h) => {
      texto += `${prioridad}. ${h.recomendacion}\n   Problema: ${h.descripcion}\n\n`
      prioridad++
    })
  }

  return texto
}
