// =====================================================
// hub-ia/tools/registry.ts
// Tool Registry — registra todas las herramientas disponibles para la IA.
// Cada herramienta es una función REAL conectada a la plataforma.
//
// Categorías:
//   - Consulta (read-only): clientes, solicitudes, pagos, mora, config, etc.
//   - Modificación (write): crear_alerta, modificar_configuracion, etc.
//   - Sistema: estado, errores, integridad, reportes
//
// Cada herramienta declara:
//   - name: identificador único
//   - description: para qué sirve (la ve la IA)
//   - parameters: JSON Schema de los args
//   - riesgo: bajo | medio | alto | critico
//   - execute: función que recibe args + user y devuelve resultado
// =====================================================

import { db } from '@/lib/db'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import type { AuthUser } from '@/lib/auth-guard'

export interface ToolContext {
  user: AuthUser
  ipOrigen?: string | null
  userAgent?: string | null
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
  riesgo: 'bajo' | 'medio' | 'alto' | 'critico'
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{ ok: boolean; data?: unknown; error?: string }>
}

// =====================================================
// HERRAMIENTAS DE CONSULTA (read-only)
// =====================================================

const consultar_clientes: ToolDef = {
  name: 'consultar_clientes',
  description: 'Consulta la lista de clientes. Puede filtrar por cédula, nombre o estado. Devuelve datos básicos (sin información sensible como claves/PIN).',
  parameters: {
    type: 'object',
    properties: {
      cedula: { type: 'string', description: 'Cédula exacta del cliente (opcional)' },
      nombre: { type: 'string', description: 'Parte del nombre (búsqueda parcial, opcional)' },
      activo: { type: 'boolean', description: 'Filtrar por activo/inactivo (opcional)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 20, max 100)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const limite = Math.min(Number(args.limite) || 20, 100)
    const where: any = {}
    if (args.cedula) where.cedula = { equals: String(args.cedula), mode: 'insensitive' }
    if (args.nombre) where.nombre = { contains: String(args.nombre), mode: 'insensitive' }
    if (typeof args.activo === 'boolean') where.activo = args.activo
    const clientes = await db.cliente.findMany({
      where,
      select: {
        id: true, nombre: true, cedula: true, telefono: true,
        ciudad: true, departamento: true, activo: true, createdAt: true,
      },
      take: limite,
      orderBy: { createdAt: 'desc' },
    })
    return {
      ok: true,
      data: {
        total: clientes.length,
        clientes: clientes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          cedula: `***${c.cedula.slice(-4)}`, // masking parcial
          telefono: c.telefono ? `***${c.telefono.slice(-3)}` : null,
          ciudad: c.ciudad,
          activo: c.activo,
        })),
      },
    }
  },
}

const consultar_prestamos: ToolDef = {
  name: 'consultar_prestamos',
  description: 'Consulta solicitudes. Puede filtrar por código, cliente (cédula), o estado (ACTIVO, EN_MORA, CANCELADO, etc.). Devuelve datos bancarios del solicitud (no PII del cliente).',
  parameters: {
    type: 'object',
    properties: {
      codigo: { type: 'string', description: 'Código exacto del solicitud (opcional)' },
      cedula: { type: 'string', description: 'Cédula del cliente (opcional)' },
      estado: { type: 'string', enum: ['SOLICITUD', 'ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO', 'RECHAZADO'], description: 'Estado del solicitud (opcional)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 20, max 100)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const limite = Math.min(Number(args.limite) || 20, 100)
    const where: any = {}
    if (args.codigo) where.codigo = { equals: String(args.codigo), mode: 'insensitive' }
    if (args.estado) where.estado = String(args.estado)
    if (args.cedula) where.cliente = { cedula: { equals: String(args.cedula), mode: 'insensitive' } }
    const prestamos = await db.prestamo.findMany({
      where,
      select: {
        id: true, codigo: true, estado: true,
        montoPrincipal: true, saldoTotal: true, saldoCapital: true,
        numeroCuotas: true, cuotasPagadas: true, montoCuota: true,
        frecuencia: true, diasMora: true, fechaSolicitud: true,
        cliente: { select: { nombre: true, cedula: true } },
      },
      take: limite,
      orderBy: { fechaSolicitud: 'desc' },
    })
    return {
      ok: true,
      data: {
        total: prestamos.length,
        prestamos: prestamos.map((p) => ({
          codigo: p.codigo,
          estado: p.estado,
          montoPrincipal: p.montoPrincipal,
          saldoTotal: p.saldoTotal,
          cuotas: `${p.cuotasPagadas}/${p.numeroCuotas}`,
          montoCuota: p.montoCuota,
          frecuencia: p.frecuencia,
          diasMora: p.diasMora,
          cliente: p.cliente.nombre,
        })),
      },
    }
  },
}

const consultar_pagos: ToolDef = {
  name: 'consultar_pagos',
  description: 'Consulta pagos. Puede filtrar por código de solicitud, estado (PENDIENTE, APLICADO, VENCIDO, etc.) o rango de fechas.',
  parameters: {
    type: 'object',
    properties: {
      prestamoCodigo: { type: 'string', description: 'Código del solicitud (opcional)' },
      estado: { type: 'string', enum: ['PENDIENTE', 'APLICADO', 'VENCIDO', 'ANULADO', 'REVERSADO', 'PAGO_PARCIAL'] },
      desde: { type: 'string', description: 'Fecha desde (YYYY-MM-DD, opcional)' },
      hasta: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD, opcional)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 20, max 100)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const limite = Math.min(Number(args.limite) || 20, 100)
    const where: any = {}
    if (args.estado) where.estado = String(args.estado)
    if (args.prestamoCodigo) where.prestamo = { codigo: { equals: String(args.prestamoCodigo), mode: 'insensitive' } }
    if (args.desde || args.hasta) {
      where.fechaPago = {}
      if (args.desde) where.fechaPago.gte = new Date(String(args.desde))
      if (args.hasta) where.fechaPago.lte = new Date(String(args.hasta))
    }
    const pagos = await db.pago.findMany({
      where,
      select: {
        codigo: true, numeroCuota: true, montoTotal: true,
        estado: true, fechaPago: true, fechaVencimiento: true, metodoPago: true,
        prestamo: { select: { codigo: true, cliente: { select: { nombre: true } } } },
      },
      take: limite,
      orderBy: { fechaPago: 'desc' },
    })
    return {
      ok: true,
      data: {
        total: pagos.length,
        pagos: pagos.map((p) => ({
          codigo: p.codigo,
          cuota: p.numeroCuota,
          monto: p.montoTotal,
          estado: p.estado,
          fechaPago: p.fechaPago ? formatearFecha(p.fechaPago) : null,
          vencimiento: formatearFecha(p.fechaVencimiento),
          metodo: p.metodoPago,
          prestamo: p.prestamo.codigo,
          cliente: p.prestamo.cliente.nombre,
        })),
      },
    }
  },
}

const consultar_mora: ToolDef = {
  name: 'consultar_mora',
  description: 'Consulta solicitudes en mora. Devuelve estadísticas y lista detallada con días de mora y saldo pendiente.',
  parameters: {
    type: 'object',
    properties: {
      minDiasMora: { type: 'number', description: 'Días mínimos de mora (default 1)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 50, max 200)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const minDias = Math.max(1, Number(args.minDiasMora) || 1)
    const limite = Math.min(Number(args.limite) || 50, 200)
    const prestamos = await db.prestamo.findMany({
      where: { estado: 'EN_MORA', diasMora: { gte: minDias } },
      select: {
        codigo: true, diasMora: true, saldoTotal: true,
        montoMoraAcumulado: true, montoCuota: true,
        cliente: { select: { nombre: true, cedula: true, telefono: true } },
      },
      orderBy: { diasMora: 'desc' },
      take: limite,
    })
    const totalSaldo = prestamos.reduce((s, p) => s + p.saldoTotal, 0)
    const totalMora = prestamos.reduce((s, p) => s + (p.montoMoraAcumulado || 0), 0)
    return {
      ok: true,
      data: {
        totalPrestamos: prestamos.length,
        totalSaldo,
        totalMoraAcumulado: totalMora,
        promedioDiasMora: prestamos.length
          ? Math.round(prestamos.reduce((s, p) => s + p.diasMora, 0) / prestamos.length)
          : 0,
        prestamos: prestamos.map((p) => ({
          codigo: p.codigo,
          diasMora: p.diasMora,
          saldo: p.saldoTotal,
          moraAcumulada: p.montoMoraAcumulado || 0,
          cliente: p.cliente.nombre,
        })),
      },
    }
  },
}

const consultar_configuracion: ToolDef = {
  name: 'consultar_configuracion',
  description: 'Consulta variables globales de configuración de la plataforma. NO devuelve secretos (API keys, passwords) — solo valores no sensibles.',
  parameters: {
    type: 'object',
    properties: {
      clave: { type: 'string', description: 'Clave exacta de la variable (opcional)' },
      categoria: { type: 'string', description: 'Categoría (opcional)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const where: any = {}
    if (args.clave) where.clave = String(args.clave)
    if (args.categoria) where.categoria = String(args.categoria)
    const vars = await db.variableGlobal.findMany({
      where,
      select: { clave: true, valor: true, tipo: true, descripcion: true, categoria: true, editable: true },
      take: 50,
    })
    // Filtrar claves que parezcan sensibles
    const SENSIBLE = /key|secret|pass|token|pwd/i
    return {
      ok: true,
      data: {
        total: vars.length,
        variables: vars
          .filter((v) => !SENSIBLE.test(v.clave))
          .map((v) => ({
            clave: v.clave,
            valor: v.valor,
            tipo: v.tipo,
            categoria: v.categoria,
            editable: v.editable,
          })),
      },
    }
  },
}

const consultar_usuarios: ToolDef = {
  name: 'consultar_usuarios',
  description: 'Consulta usuarios del sistema (administradores, gestores). NO devuelve contraseñas ni hashes.',
  parameters: {
    type: 'object',
    properties: {
      rol: { type: 'string', enum: ['ADMIN', 'GESTOR', 'CONSULTOR', 'ABOGADO'] },
      activo: { type: 'boolean' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const where: any = {}
    if (args.rol) where.rol = String(args.rol)
    if (typeof args.activo === 'boolean') where.activo = args.activo
    const usuarios = await db.usuario.findMany({
      where,
      select: { id: true, nombre: true, username: true, rol: true, activo: true, createdAt: true },
      take: 50,
    })
    return {
      ok: true,
      data: {
        total: usuarios.length,
        usuarios: usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          username: u.username,
          rol: u.rol,
          activo: u.activo,
        })),
      },
    }
  },
}

const consultar_estado_sistema: ToolDef = {
  name: 'consultar_estado_sistema',
  description: 'Consulta el estado general del sistema: conteos de clientes, solicitudes, pagos, mora, etc.',
  parameters: { type: 'object', properties: {} },
  riesgo: 'bajo',
  async execute() {
    const [clientes, prestamosActivos, prestamosMora, pagosPendientes, auditLogs24h] = await Promise.all([
      db.cliente.count({ where: { activo: true } }),
      db.prestamo.count({ where: { estado: 'ACTIVO' } }),
      db.prestamo.count({ where: { estado: 'EN_MORA' } }),
      db.pago.count({ where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } } }),
      db.auditLog.count({ where: { fecha: { gte: new Date(Date.now() - 86400000) } } }),
    ])
    return {
      ok: true,
      data: {
        clientesActivos: clientes,
        prestamosActivos,
        prestamosEnMora: prestamosMora,
        pagosPendientes,
        auditLogsUltimas24h: auditLogs24h,
        timestamp: new Date().toISOString(),
      },
    }
  },
}

const consultar_logs: ToolDef = {
  name: 'consultar_logs',
  description: 'Consulta los registros de auditoría recientes. NO devuelve detalles sensibles (secrets, passwords).',
  parameters: {
    type: 'object',
    properties: {
      modulo: { type: 'string', description: 'Módulo a filtrar (clientes, pagos, etc.)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 20, max 50)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const limite = Math.min(Number(args.limite) || 20, 50)
    const where: any = {}
    if (args.modulo) where.modulo = String(args.modulo)
    const logs = await db.auditLog.findMany({
      where,
      select: {
        usuarioNombre: true, accion: true, modulo: true,
        entidadNombre: true, exito: true, errorMessage: true, fecha: true,
      },
      orderBy: { fecha: 'desc' },
      take: limite,
    })
    return {
      ok: true,
      data: {
        total: logs.length,
        logs: logs.map((l) => ({
          usuario: l.usuarioNombre,
          accion: l.accion,
          modulo: l.modulo,
          entidad: l.entidadNombre,
          exito: l.exito,
          error: l.errorMessage,
          fecha: formatearFecha(l.fecha),
        })),
      },
    }
  },
}

// =====================================================
// HERRAMIENTAS DE MODIFICACIÓN (write)
// =====================================================

const crear_alerta: ToolDef = {
  name: 'crear_alerta',
  description: 'Crea una alerta financiera en el sistema. Útil para marcar situaciones que requieren atención.',
  parameters: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['GASTO_EXCESIVO', 'ENDEUDAMIENTO_ALTO', 'RIESGO_LIQUIDEZ', 'VENCIMIENTO_PROXIMO', 'PAGO_OLVIDADO', 'PRESUPUESTO_EXCEDIDO', 'OPORTUNIDAD_AHORRO'] },
      severidad: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] },
      titulo: { type: 'string' },
      descripcion: { type: 'string' },
      montoInvolucrado: { type: 'number' },
    },
    required: ['tipo', 'severidad', 'titulo', 'descripcion'],
  },
  riesgo: 'medio',
  async execute(args) {
    const alerta = await db.alertaFinanciera.create({
      data: {
        tipo: String(args.tipo),
        ambito: 'NEGOCIO',
        severidad: String(args.severidad),
        titulo: String(args.titulo),
        descripcion: String(args.descripcion),
        montoInvolucrado: args.montoInvolucrado ? Number(args.montoInvolucrado) : null,
      },
    })
    return { ok: true, data: { id: alerta.id, creado: true } }
  },
}

const actualizar_parametro: ToolDef = {
  name: 'actualizar_parametro',
  description: 'Actualiza una variable global del sistema. Solo se permiten variables marcadas como editables.',
  parameters: {
    type: 'object',
    properties: {
      clave: { type: 'string', description: 'Clave de la variable' },
      valor: { type: 'string', description: 'Nuevo valor' },
    },
    required: ['clave', 'valor'],
  },
  riesgo: 'alto',
  async execute(args) {
    const clave = String(args.clave)
    const valor = String(args.valor)
    // Bloquear claves sensibles
    const SENSIBLE = /key|secret|pass|token|pwd/i
    if (SENSIBLE.test(clave)) {
      return { ok: false, error: 'No se permite actualizar variables sensibles vía IA.' }
    }
    const existing = await db.variableGlobal.findUnique({ where: { clave } })
    if (!existing) return { ok: false, error: `Variable '${clave}' no existe.` }
    if (!existing.editable) return { ok: false, error: `Variable '${clave}' no es editable.` }
    const updated = await db.variableGlobal.update({
      where: { clave },
      data: { valor, updatedBy: 'hub-ia' },
    })
    return { ok: true, data: { clave: updated.clave, valor: updated.valor, actualizado: true } }
  },
}

// =====================================================
// HERRAMIENTAS DE ANÁLISIS (read-only, devuelven conclusiones)
// =====================================================

const analizar_modulo: ToolDef = {
  name: 'analizar_modulo',
  description: 'Analiza un módulo específico de la plataforma (clientes, prestamos, pagos, juridico, configuracion) y devuelve métricas clave, estado de salud y posibles problemas detectados.',
  parameters: {
    type: 'object',
    properties: {
      modulo: { type: 'string', enum: ['clientes', 'prestamos', 'pagos', 'juridico', 'configuracion', 'seguridad'], description: 'Módulo a analizar' },
    },
    required: ['modulo'],
  },
  riesgo: 'bajo',
  async execute(args) {
    const modulo = String(args.modulo)
    const out: Record<string, unknown> = { modulo }
    if (modulo === 'prestamos') {
      const [total, activos, mora, juridico] = await Promise.all([
        db.prestamo.count(),
        db.prestamo.count({ where: { estado: 'ACTIVO' } }),
        db.prestamo.count({ where: { estado: 'EN_MORA' } }),
        db.prestamo.count({ where: { estado: 'JURIDICO' } }),
      ])
      out.totalPrestamos = total
      out.activos = activos
      out.enMora = mora
      out.juridico = juridico
      out.tasaMora = total ? ((mora / total) * 100).toFixed(2) + '%' : '0%'
      out.observaciones = mora > 0 ? `Hay ${mora} solicitudes en mora (${((mora / total) * 100).toFixed(2)}% del total).` : 'No hay solicitudes en mora.'
    } else if (modulo === 'clientes') {
      const [total, activos] = await Promise.all([
        db.cliente.count(),
        db.cliente.count({ where: { activo: true } }),
      ])
      out.totalClientes = total
      out.activos = activos
      out.observaciones = activos < total * 0.7 ? 'Más del 30% de los clientes están inactivos.' : 'Salud del módulo de clientes: OK.'
    } else if (modulo === 'pagos') {
      const [pendientes, vencidos, aplicadosHoy] = await Promise.all([
        db.pago.count({ where: { estado: 'PENDIENTE' } }),
        db.pago.count({ where: { estado: 'VENCIDO' } }),
        db.pago.count({ where: { estado: 'APLICADO', fechaPago: { gte: new Date(Date.now() - 86400000) } } }),
      ])
      out.pagosPendientes = pendientes
      out.pagosVencidos = vencidos
      out.pagosAplicadosHoy = aplicadosHoy
      out.observaciones = vencidos > 0 ? `Hay ${vencidos} pagos vencidos que requieren acción inmediata.` : 'No hay pagos vencidos.'
    } else if (modulo === 'juridico') {
      const [casosAbiertos] = await Promise.all([
        db.casoJuridico.count({ where: { estado: { not: 'CERRADO' } } }),
      ])
      out.casosAbiertos = casosAbiertos
      out.observaciones = casosAbiertos > 0 ? `Hay ${casosAbiertos} casos jurídicos en proceso.` : 'No hay casos jurídicos abiertos.'
    } else if (modulo === 'configuracion') {
      const total = await db.variableGlobal.count()
      out.totalVariables = total
      out.observaciones = `Hay ${total} variables globales configuradas.`
    } else if (modulo === 'seguridad') {
      const [usuarios, audit24h, promptInjectionBlocked] = await Promise.all([
        db.usuario.count({ where: { activo: true } }),
        db.auditLog.count({ where: { fecha: { gte: new Date(Date.now() - 86400000) } } }),
        db.hubIAAccion.count({ where: { toolName: 'prompt_injection_blocked', createdAt: { gte: new Date(Date.now() - 86400000) } } }),
      ])
      out.usuariosActivos = usuarios
      out.eventosAuditoria24h = audit24h
      out.intentosPromptInjectionBloqueados = promptInjectionBlocked
      out.observaciones = promptInjectionBlocked > 0 ? `⚠️ Se bloquearon ${promptInjectionBlocked} intentos de prompt injection en 24h.` : 'Sin actividad maliciosa detectada.'
    } else {
      return { ok: false, error: `Módulo '${modulo}' no soportado para análisis.` }
    }
    return { ok: true, data: out }
  },
}

const detectar_errores: ToolDef = {
  name: 'detectar_errores',
  description: 'Busca errores recientes en los logs de auditoría del sistema. Devuelve los eventos fallidos de las últimas 24-72 horas.',
  parameters: {
    type: 'object',
    properties: {
      horas: { type: 'number', description: 'Cantidad de horas hacia atrás (default 24, max 168)' },
      limite: { type: 'number', description: 'Máximo de resultados (default 20, max 50)' },
    },
  },
  riesgo: 'bajo',
  async execute(args) {
    const horas = Math.min(Number(args.horas) || 24, 168)
    const limite = Math.min(Number(args.limite) || 20, 50)
    const desde = new Date(Date.now() - horas * 3600000)
    const errores = await db.auditLog.findMany({
      where: { exito: false, fecha: { gte: desde } },
      orderBy: { fecha: 'desc' },
      take: limite,
      select: {
        accion: true, modulo: true, errorMessage: true, fecha: true,
        usuarioNombre: true, entidadNombre: true,
      },
    })
    // Agrupar por tipo de error
    const porTipo: Record<string, number> = {}
    for (const e of errores) {
      const tipo = e.accion
      porTipo[tipo] = (porTipo[tipo] || 0) + 1
    }
    return {
      ok: true,
      data: {
        totalErrores: errores.length,
        horas,
        porTipo,
        errores: errores.map((e) => ({
          accion: e.accion,
          modulo: e.modulo,
          usuario: e.usuarioNombre,
          entidad: e.entidadNombre,
          error: e.errorMessage,
          fecha: e.fecha.toISOString(),
        })),
      },
    }
  },
}

const generar_reporte: ToolDef = {
  name: 'generar_reporte',
  description: 'Genera un reporte de cartera o mora con estadísticas agregadas. Devuelve datos estructurados para análisis.',
  parameters: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['cartera', 'mora', 'pagos', 'clientes'], description: 'Tipo de reporte' },
      desde: { type: 'string', description: 'Fecha desde (YYYY-MM-DD, opcional)' },
      hasta: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD, opcional)' },
    },
    required: ['tipo'],
  },
  riesgo: 'bajo',
  async execute(args) {
    const tipo = String(args.tipo)
    if (tipo === 'cartera') {
      const prestamos = await db.prestamo.findMany({
        where: { estado: { in: ['ACTIVO', 'EN_MORA', 'JURIDICO'] } },
        select: { estado: true, montoPrincipal: true, saldoTotal: true, montoMora: true },
      })
      const totalCartera = prestamos.reduce((s, p) => s + p.saldoTotal, 0)
      const totalMora = prestamos.reduce((s, p) => s + p.montoMora, 0)
      const porEstado = prestamos.reduce((acc, p) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      return {
        ok: true,
        data: {
          tipo: 'cartera',
          totalPrestamos: prestamos.length,
          totalCartera,
          totalMora,
          porEstado,
          generadoEn: new Date().toISOString(),
        },
      }
    }
    if (tipo === 'mora') {
      const enMora = await db.prestamo.findMany({
        where: { estado: 'EN_MORA' },
        select: { diasMora: true, montoMora: true, saldoTotal: true },
      })
      const buckets = { '1-30': 0, '31-60': 0, '61-90': 0, '+90': 0 }
      for (const p of enMora) {
        if (p.diasMora <= 30) buckets['1-30']++
        else if (p.diasMora <= 60) buckets['31-60']++
        else if (p.diasMora <= 90) buckets['61-90']++
        else buckets['+90']++
      }
      return {
        ok: true,
        data: {
          tipo: 'mora',
          totalEnMora: enMora.length,
          totalMoraAcumulada: enMora.reduce((s, p) => s + p.montoMora, 0),
          bucketsAntiguedad: buckets,
          promedioDiasMora: enMora.length ? Math.round(enMora.reduce((s, p) => s + p.diasMora, 0) / enMora.length) : 0,
          generadoEn: new Date().toISOString(),
        },
      }
    }
    if (tipo === 'pagos') {
      const desde = args.desde ? new Date(String(args.desde)) : new Date(Date.now() - 30 * 86400000)
      const hasta = args.hasta ? new Date(String(args.hasta)) : new Date()
      const pagos = await db.pago.findMany({
        where: { fechaPago: { gte: desde, lte: hasta } },
        select: { estado: true, montoTotal: true, metodoPago: true },
      })
      const porEstado = pagos.reduce((acc, p) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const porMetodo = pagos.reduce((acc, p) => {
        acc[p.metodoPago] = (acc[p.metodoPago] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      return {
        ok: true,
        data: {
          tipo: 'pagos',
          desde: desde.toISOString(),
          hasta: hasta.toISOString(),
          totalPagos: pagos.length,
          totalMonto: pagos.reduce((s, p) => s + p.montoTotal, 0),
          porEstado,
          porMetodo,
          generadoEn: new Date().toISOString(),
        },
      }
    }
    if (tipo === 'clientes') {
      const [total, activos, optOut] = await Promise.all([
        db.cliente.count(),
        db.cliente.count({ where: { activo: true } }),
        db.cliente.count({ where: { optOutNotificaciones: true } }),
      ])
      return {
        ok: true,
        data: {
          tipo: 'clientes',
          total,
          activos,
          inactivos: total - activos,
          optOutNotificaciones: optOut,
          generadoEn: new Date().toISOString(),
        },
      }
    }
    return { ok: false, error: `Tipo de reporte '${tipo}' no soportado.` }
  },
}

const verificar_servicios: ToolDef = {
  name: 'verificar_servicios',
  description: 'Verifica el estado de los servicios internos del sistema (base de datos, conexión a IA, auditoría, etc.).',
  parameters: { type: 'object', properties: {} },
  riesgo: 'bajo',
  async execute() {
    const servicios: Array<{ nombre: string; estado: string; latenciaMs?: number; detalle?: string }> = []
    // DB
    const inicioDb = Date.now()
    try {
      await db.$queryRaw`SELECT 1`
      servicios.push({ nombre: 'PostgreSQL (Neon)', estado: 'operativo', latenciaMs: Date.now() - inicioDb })
    } catch (e: any) {
      servicios.push({ nombre: 'PostgreSQL (Neon)', estado: 'error', detalle: e.message })
    }
    // Auditoría
    try {
      const count = await db.auditLog.count({ where: { fecha: { gte: new Date(Date.now() - 86400000) } } })
      servicios.push({ nombre: 'Auditoría (AuditLog)', estado: 'operativo', detalle: `${count} eventos en 24h` })
    } catch (e: any) {
      servicios.push({ nombre: 'Auditoría (AuditLog)', estado: 'error', detalle: e.message })
    }
    // Hub IA
    try {
      const conversaciones = await db.hubIAConversation.count()
      servicios.push({ nombre: 'Hub IA', estado: 'operativo', detalle: `${conversaciones} conversaciones registradas` })
    } catch (e: any) {
      servicios.push({ nombre: 'Hub IA', estado: 'error', detalle: e.message })
    }
    return {
      ok: true,
      data: {
        timestamp: new Date().toISOString(),
        totalServicios: servicios.length,
        operativos: servicios.filter((s) => s.estado === 'operativo').length,
        conError: servicios.filter((s) => s.estado === 'error').length,
        servicios,
      },
    }
  },
}

const consultar_modulos: ToolDef = {
  name: 'consultar_modulos',
  description: 'Lista los módulos disponibles en la plataforma que el agente IA puede analizar o sobre los que puede ejecutar acciones.',
  parameters: { type: 'object', properties: {} },
  riesgo: 'bajo',
  async execute() {
    return {
      ok: true,
      data: {
        modulos: [
          { nombre: 'clientes', descripcion: 'Gestión de clientes' },
          { nombre: 'prestamos', descripcion: 'Gestión de solicitudes' },
          { nombre: 'pagos', descripcion: 'Registro y conciliación de pagos' },
          { nombre: 'juridico', descripcion: 'Casos jurídicos y cobranza' },
          { nombre: 'configuracion', descripcion: 'Configuración global de la plataforma' },
          { nombre: 'seguridad', descripcion: 'Auditoría, usuarios, permisos' },
        ],
      },
    }
  },
}

const consultar_permisos: ToolDef = {
  name: 'consultar_permisos',
  description: 'Consulta los permisos del usuario actual (rol, qué vistas puede ver, qué herramientas puede ejecutar).',
  parameters: { type: 'object', properties: {} },
  riesgo: 'bajo',
  async execute(args, ctx) {
    const rol = ctx.user.rol
    const puedeConsultar = true
    const puedeModificar = rol === 'ADMIN'
    const puedeEliminar = false // siempre requiere confirmación adicional
    return {
      ok: true,
      data: {
        usuario: ctx.user.nombre,
        rol,
        permisos: {
          consultar: puedeConsultar,
          modificar: puedeModificar,
          eliminar: puedeEliminar,
          ejecutar_herramientas_riesgo_bajo: true,
          ejecutar_herramientas_riesgo_medio: puedeModificar,
          ejecutar_herramientas_riesgo_alto: puedeModificar,
          ejecutar_herramientas_riesgo_critico: false, // siempre bloqueado
        },
      },
    }
  },
}

const consultar_reportes: ToolDef = {
  name: 'consultar_reportes',
  description: 'Lista los reportes disponibles que pueden generarse mediante la herramienta generar_reporte.',
  parameters: { type: 'object', properties: {} },
  riesgo: 'bajo',
  async execute() {
    return {
      ok: true,
      data: {
        reportes: [
          { tipo: 'cartera', descripcion: 'Reporte de cartera activa (solicitudes ACTIVO/EN_MORA/JURIDICO)' },
          { tipo: 'mora', descripcion: 'Reporte de mora con buckets de antigüedad (1-30, 31-60, 61-90, +90 días)' },
          { tipo: 'pagos', descripcion: 'Reporte de pagos en rango de fechas (default: últimos 30 días)' },
          { tipo: 'clientes', descripcion: 'Reporte de clientes (totales, activos, opt-out)' },
        ],
      },
    }
  },
}

// =====================================================
// HERRAMIENTAS DE MODIFICACIÓN — bitácora (riesgo medio)
// =====================================================

const crear_registro: ToolDef = {
  name: 'crear_registro',
  description: 'Crea una nota en la bitácora de un solicitud. Útil para registrar observaciones, llamadas, visitas o seguimientos.',
  parameters: {
    type: 'object',
    properties: {
      prestamoId: { type: 'string', description: 'ID del solicitud' },
      tipo: { type: 'string', enum: ['NOTA', 'LLAMADA', 'VISITA', 'EMAIL', 'WHATSAPP', 'REUNION', 'OTRO'], description: 'Tipo de evento' },
      titulo: { type: 'string', description: 'Título breve' },
      descripcion: { type: 'string', description: 'Descripción del evento' },
      resultado: { type: 'string', description: 'Resultado (opcional)' },
    },
    required: ['prestamoId', 'tipo', 'titulo', 'descripcion'],
  },
  riesgo: 'medio',
  async execute(args, ctx) {
    const prestamo = await db.prestamo.findUnique({ where: { id: String(args.prestamoId) } })
    if (!prestamo) return { ok: false, error: 'Solicitud no encontrado' }
    const nota = await db.bitacoraPrestamo.create({
      data: {
        prestamoId: prestamo.id,
        prestamoCodigo: prestamo.codigo,
        usuarioId: ctx.user.id,
        usuarioNombre: ctx.user.nombre,
        tipo: String(args.tipo),
        titulo: String(args.titulo),
        descripcion: String(args.descripcion),
        resultado: args.resultado ? String(args.resultado) : null,
        fechaEvento: new Date(),
      },
    })
    return { ok: true, data: { id: nota.id, creado: true } }
  },
}

const actualizar_registro: ToolDef = {
  name: 'actualizar_registro',
  description: 'Actualiza una nota existente en la bitácora de un solicitud. Solo el autor o un ADMIN pueden modificarla.',
  parameters: {
    type: 'object',
    properties: {
      notaId: { type: 'string', description: 'ID de la nota a actualizar' },
      titulo: { type: 'string', description: 'Nuevo título (opcional)' },
      descripcion: { type: 'string', description: 'Nueva descripción (opcional)' },
      resultado: { type: 'string', description: 'Nuevo resultado (opcional)' },
    },
    required: ['notaId'],
  },
  riesgo: 'alto',
  async execute(args, ctx) {
    const nota = await db.bitacoraPrestamo.findUnique({ where: { id: String(args.notaId) } })
    if (!nota) return { ok: false, error: 'Nota no encontrada' }
    // Solo el autor o ADMIN
    if (nota.usuarioId !== ctx.user.id && ctx.user.rol !== 'ADMIN') {
      return { ok: false, error: 'Solo el autor o un administrador pueden modificar esta nota.' }
    }
    const data: any = {}
    if (args.titulo) data.titulo = String(args.titulo)
    if (args.descripcion) data.descripcion = String(args.descripcion)
    if (args.resultado) data.resultado = String(args.resultado)
    const updated = await db.bitacoraPrestamo.update({ where: { id: nota.id }, data })
    return { ok: true, data: { id: updated.id, actualizado: true } }
  },
}

const modificar_configuracion: ToolDef = {
  name: 'modificar_configuracion',
  description: 'Modifica una variable global de configuración de la plataforma. Solo se permiten variables marcadas como editables. NO se permiten variables sensibles (API keys, secrets, passwords).',
  parameters: {
    type: 'object',
    properties: {
      clave: { type: 'string', description: 'Clave de la variable a modificar' },
      valor: { type: 'string', description: 'Nuevo valor' },
      motivo: { type: 'string', description: 'Motivo del cambio (auditable)' },
    },
    required: ['clave', 'valor'],
  },
  riesgo: 'alto',
  async execute(args, ctx) {
    const clave = String(args.clave)
    const valor = String(args.valor)
    const SENSIBLE = /key|secret|pass|token|pwd/i
    if (SENSIBLE.test(clave)) {
      return { ok: false, error: 'No se permite modificar variables sensibles vía IA.' }
    }
    const existing = await db.variableGlobal.findUnique({ where: { clave } })
    if (!existing) return { ok: false, error: `Variable '${clave}' no existe.` }
    if (!existing.editable) return { ok: false, error: `Variable '${clave}' no es editable.` }
    const valorAnterior = existing.valor
    const updated = await db.variableGlobal.update({
      where: { clave },
      data: { valor, updatedBy: `hub-ia:${ctx.user.nombre}` },
    })
    // Registrar en AuditoriaConfiguracion (tabla separada para cambios de configuración)
    await db.auditoriaConfiguracion.create({
      data: {
        seccion: 'variables_globales',
        campo: clave,
        valorAnterior,
        valorNuevo: valor,
        usuarioId: ctx.user.id,
        usuarioNombre: ctx.user.nombre,
        motivo: args.motivo ? String(args.motivo) : 'Modificación vía Hub IA',
      },
    })
    return {
      ok: true,
      data: {
        clave: updated.clave,
        valorAnterior,
        valorNuevo: updated.valor,
        actualizado: true,
      },
    }
  },
}

// =====================================================
// REGISTRO FINAL
// =====================================================

export const TOOLS: ToolDef[] = [
  // Consulta
  consultar_clientes,
  consultar_prestamos,
  consultar_pagos,
  consultar_mora,
  consultar_configuracion,
  consultar_usuarios,
  consultar_modulos,
  consultar_permisos,
  consultar_reportes,
  consultar_estado_sistema,
  consultar_logs,
  // Análisis
  analizar_modulo,
  detectar_errores,
  generar_reporte,
  verificar_servicios,
  // Modificación
  crear_alerta,
  crear_registro,
  actualizar_registro,
  actualizar_parametro,
  modificar_configuracion,
]

export function getToolByName(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name)
}

/**
 * Devuelve la definición de herramientas en el formato que espera OpenAI
 * (function calling). ZAI usa un formato simplificado.
 */
export function getToolsParaLLM(): Array<{
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}> {
  return TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}
