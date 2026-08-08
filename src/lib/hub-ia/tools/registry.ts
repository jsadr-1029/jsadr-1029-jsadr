// =====================================================
// hub-ia/tools/registry.ts
// Tool Registry — registra todas las herramientas disponibles para la IA.
// Cada herramienta es una función REAL conectada a la plataforma.
//
// Categorías:
//   - Consulta (read-only): clientes, préstamos, pagos, mora, config, etc.
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
  description: 'Consulta préstamos. Puede filtrar por código, cliente (cédula), o estado (ACTIVO, EN_MORA, CANCELADO, etc.). Devuelve datos bancarios del préstamo (no PII del cliente).',
  parameters: {
    type: 'object',
    properties: {
      codigo: { type: 'string', description: 'Código exacto del préstamo (opcional)' },
      cedula: { type: 'string', description: 'Cédula del cliente (opcional)' },
      estado: { type: 'string', enum: ['SOLICITUD', 'ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO', 'RECHAZADO'], description: 'Estado del préstamo (opcional)' },
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
  description: 'Consulta pagos. Puede filtrar por código de préstamo, estado (PENDIENTE, APLICADO, VENCIDO, etc.) o rango de fechas.',
  parameters: {
    type: 'object',
    properties: {
      prestamoCodigo: { type: 'string', description: 'Código del préstamo (opcional)' },
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
  description: 'Consulta préstamos en mora. Devuelve estadísticas y lista detallada con días de mora y saldo pendiente.',
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
  description: 'Consulta el estado general del sistema: conteos de clientes, préstamos, pagos, mora, etc.',
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
  consultar_estado_sistema,
  consultar_logs,
  // Modificación
  crear_alerta,
  actualizar_parametro,
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
