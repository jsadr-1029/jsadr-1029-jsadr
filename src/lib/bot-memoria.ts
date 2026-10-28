// =====================================================
// bot-memoria.ts — Sistema de MEMORIA PERSISTENTE para todos los bots
// =====================================================
// Permite que cada bot recuerde:
//   • Los últimos N mensajes de la conversación actual (CONTEXTO)
//   • Hechos clave del usuario (HECHO): "tiene 2 solicitudes activos"
//   • Preferencias (PREFERENCIA): "prefiere trato formal, llamarlo por nombre"
//   • Resúmenes de conversaciones anteriores (RESUMEN)
//
// La memoria se persiste en la tabla MemoriaBot (Neon PostgreSQL),
// por lo que sobrevive a reinicios del servidor y cambios de sesión.
//
// Estrategia de relevancia:
//   • peso = 1.0 al crearse
//   • peso decae según antigüedad (half-life = 30 días para HECHO/PREFERENCIA)
//   • peso aumenta cada vez que la memoria es recordada
//   • memorias temporales (expiresAt) se eliminan automáticamente
// =====================================================

import { db } from '@/lib/db'

// =====================================================
// TIPOS
// =====================================================

export type TipoMemoria = 'CONTEXTO' | 'HECHO' | 'PREFERENCIA' | 'RESUMEN'

export interface GuardarMemoriaInput {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
  tipoMemoria: TipoMemoria
  categoria?: string
  contenido: string
  expiresAt?: Date
}

export interface MemoriaContexto {
  contexto: Array<{ rol: string; texto: string; ts: Date }>
  hechos: string[]
  preferencias: string[]
  resumenes: string[]
}

// =====================================================
// CONSTANTES
// =====================================================

const MAX_MENSAJES_CONTEXTO = 20      // últimos N mensajes en la conversación
const MAX_HECHOS = 10                  // máximo de hechos relevantes a inyectar
const MAX_PREFERENCIAS = 5             // máximo de preferencias a inyectar
const MAX_RESUMENES = 3                // máximo de resúmenes históricos
const TTL_CONTEXTO_DIAS = 1            // los mensajes de contexto expiran en 1 día
const HALF_VIDA_DIAS = 30              // decaimiento de peso para HECHO/PREFERENCIA

// =====================================================
// 1. GUARDAR MENSAJE EN MEMORIA (CONTEXTO)
// =====================================================

export async function guardarMensajeMemoria(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
  rol: 'usuario' | 'bot' | 'sistema'
  texto: string
  categoria?: string
}): Promise<void> {
  try {
    if (!params.texto || params.texto.trim().length === 0) return
    const contenido = `${params.rol}: ${params.texto.slice(0, 2000)}`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TTL_CONTEXTO_DIAS)

    await db.memoriaBot.create({
      data: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        usuarioNombre: params.usuarioNombre || null,
        conversacionId: params.conversacionId || null,
        tipoMemoria: 'CONTEXTO',
        categoria: params.categoria || null,
        contenido,
        peso: 1.0,
        expiresAt,
      },
    })

    // Limpieza periódica: eliminar mensajes expirados (1% probabilidad)
    if (Math.random() < 0.01) {
      await limpiarMemoriasExpiradas().catch(() => {})
    }
  } catch (err) {
    console.error('[bot-memoria] Error guardando mensaje:', err)
    // No propagar: la memoria es best-effort, no debe romper la conversación
  }
}

// =====================================================
// 2. RECORDAR UN HECHO ESPECÍFICO
// =====================================================

export async function recordarHecho(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
  hecho: string
  categoria?: string
}): Promise<void> {
  try {
    // Verificar si ya existe un hecho igual para no duplicar
    const existente = await db.memoriaBot.findFirst({
      where: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        tipoMemoria: 'HECHO',
        contenido: params.hecho,
      },
    })
    if (existente) {
      // Actualizar peso y fecha
      await db.memoriaBot.update({
        where: { id: existente.id },
        data: {
          peso: Math.min(existente.peso + 0.5, 5.0),
          vecesRecordada: existente.vecesRecordada + 1,
          ultimaRecuperada: new Date(),
        },
      })
      return
    }

    await db.memoriaBot.create({
      data: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        usuarioNombre: params.usuarioNombre || null,
        conversacionId: params.conversacionId || null,
        tipoMemoria: 'HECHO',
        categoria: params.categoria || null,
        contenido: params.hecho,
        peso: 1.0,
        // HECHO no expira (expiresAt = null)
      },
    })
  } catch (err) {
    console.error('[bot-memoria] Error guardando hecho:', err)
  }
}

// =====================================================
// 3. RECORDAR UNA PREFERENCIA
// =====================================================

export async function recordarPreferencia(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  preferencia: string
  categoria?: string
}): Promise<void> {
  try {
    const existente = await db.memoriaBot.findFirst({
      where: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        tipoMemoria: 'PREFERENCIA',
        contenido: params.preferencia,
      },
    })
    if (existente) return

    await db.memoriaBot.create({
      data: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        usuarioNombre: params.usuarioNombre || null,
        tipoMemoria: 'PREFERENCIA',
        categoria: params.categoria || null,
        contenido: params.preferencia,
        peso: 2.0, // las preferencias pesan más
      },
    })
  } catch (err) {
    console.error('[bot-memoria] Error guardando preferencia:', err)
  }
}

// =====================================================
// 4. GUARDAR RESUMEN DE CONVERSACIÓN
// =====================================================

export async function guardarResumenConversacion(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
  resumen: string
}): Promise<void> {
  try {
    await db.memoriaBot.create({
      data: {
        botTipo: params.botTipo,
        usuarioId: params.usuarioId || null,
        usuarioNombre: params.usuarioNombre || null,
        conversacionId: params.conversacionId || null,
        tipoMemoria: 'RESUMEN',
        contenido: params.resumen.slice(0, 4000),
        peso: 1.5,
      },
    })
  } catch (err) {
    console.error('[bot-memoria] Error guardando resumen:', err)
  }
}

// =====================================================
// 5. CARGAR CONTEXTO COMPLETO DE MEMORIA
// =====================================================

export async function cargarContextoMemoria(params: {
  botTipo: string
  usuarioId?: string
  conversacionId?: string
}): Promise<MemoriaContexto> {
  const ctx: MemoriaContexto = {
    contexto: [],
    hechos: [],
    preferencias: [],
    resumenes: [],
  }
  try {
    const where = {
      botTipo: params.botTipo,
      OR: [
        { usuarioId: params.usuarioId || '__NONE__' },
        { conversacionId: params.conversacionId || '__NONE__' },
      ],
    }

    // === CONTEXTO (mensajes recientes, orden ASC) ===
    const contextoRaw = await db.memoriaBot.findMany({
      where: { ...where, tipoMemoria: 'CONTEXTO', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: MAX_MENSAJES_CONTEXTO,
    })
    ctx.contexto = contextoRaw.map((m) => {
      const match = m.contenido.match(/^(usuario|bot|sistema): ([\s\S]*)$/)
      return {
        rol: match?.[1] || 'usuario',
        texto: match?.[2] || m.contenido,
        ts: m.createdAt,
      }
    })

    // === HECHOS (por peso decaído) ===
    const hechosRaw = await db.memoriaBot.findMany({
      where: { ...where, tipoMemoria: 'HECHO' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    ctx.hechos = hechosRaw
      .map((m) => ({ contenido: m.contenido, peso: decaerPeso(m) }))
      .sort((a, b) => b.peso - a.peso)
      .slice(0, MAX_HECHOS)
      .map((m) => m.contenido)

    // === PREFERENCIAS (siempre se incluyen todas) ===
    const prefRaw = await db.memoriaBot.findMany({
      where: { ...where, tipoMemoria: 'PREFERENCIA' },
      orderBy: { createdAt: 'desc' },
      take: MAX_PREFERENCIAS,
    })
    ctx.preferencias = prefRaw.map((m) => m.contenido)

    // === RESUMENES (de conversaciones anteriores, no de la actual) ===
    const resRaw = await db.memoriaBot.findMany({
      where: { ...where, tipoMemoria: 'RESUMEN' },
      orderBy: { createdAt: 'desc' },
      take: MAX_RESUMENES,
    })
    ctx.resumenes = resRaw.map((m) => m.contenido)

    // Marcar como "recordadas" las memorias cargadas
    if (contextoRaw.length + hechosRaw.length + prefRaw.length + resRaw.length > 0) {
      const ids = [
        ...contextoRaw.map((m) => m.id),
        ...hechosRaw.map((m) => m.id),
        ...prefRaw.map((m) => m.id),
        ...resRaw.map((m) => m.id),
      ]
      // Best-effort: no esperar
      db.memoriaBot.updateMany({
        where: { id: { in: ids } },
        data: {
          vecesRecordada: { increment: 1 },
          ultimaRecuperada: new Date(),
        },
      }).catch(() => {})
    }
  } catch (err) {
    console.error('[bot-memoria] Error cargando contexto:', err)
  }
  return ctx
}

// =====================================================
// 6. CONSTRUIR TEXTO DE CONTEXTO PARA INYECTAR EN PROMPT
// =====================================================

export function construirTextoContexto(ctx: MemoriaContexto): string {
  const partes: string[] = []

  if (ctx.preferencias.length > 0) {
    partes.push(
      `=== PREFERENCIAS DEL USUARIO ===\n${ctx.preferencias.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    )
  }

  if (ctx.hechos.length > 0) {
    partes.push(
      `=== HECHOS RECORDADOS ===\n${ctx.hechos.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    )
  }

  if (ctx.resumenes.length > 0) {
    partes.push(
      `=== RESUMEN DE CONVERSACIONES ANTERIORES ===\n${ctx.resumenes.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    )
  }

  if (ctx.contexto.length > 0) {
    partes.push(
      `=== CONVERSACIÓN RECIENTE ===\n${ctx.contexto
        .map((m) => `[${m.rol}] ${m.texto.slice(0, 300)}`)
        .join('\n')}`
    )
  }

  return partes.join('\n\n')
}

// =====================================================
// 7. DETECTAR Y RECORDAR HECHOS AUTOMÁTICAMENTE
// =====================================================

// Patrones que detectan hechos implícitos en los mensajes del usuario
const PATRONES_HECHO: Array<{ regex: RegExp; categoria: string; plantilla: (m: RegExpMatchArray) => string }> = [
  // Menciones de monto
  { regex: /(?:tengo|debo|pago|prest[ée]|recib[íi])\s+(?:un|una)?\s*(\d[\d.,]*)\s*(?:pesos|cop|\$)?/i,
    categoria: 'MONTO_MENCIONADO',
    plantilla: (m) => `Usuario mencionó monto: ${m[1]}` },
  // Menciones de solicitud/crédito
  { regex: /(?:mi|del|con)\s+(?:prestamo|cr[eé]dito|obligaci[oó]n)\s+(?:n[uú]mero|c[oó]digo)?\s*#?\s*([A-Z0-9-]{3,})/i,
    categoria: 'PRESTAMO_MENCIONADO',
    plantilla: (m) => `Usuario tiene solicitud con código: ${m[1]}` },
  // Menciones de problema financiero
  { regex: /(?:no puedo pagar|no tengo (?:dinero|plata)|estoy (?:mora|atrasado|estresado|preocupado))/i,
    categoria: 'SITUACION_FINANCIERA',
    plantilla: () => `Usuario reportó situación financiera difícil (requiere seguimiento)` },
  // Menciones de codeudor
  { regex: /(?:mi|con el|con la)\s+(?:codeudor|fiador|aval)\s+(?:es\s+)?(\w+(?:\s+\w+){0,2})/i,
    categoria: 'CODEUDOR',
    plantilla: (m) => `Codeudor mencionado: ${m[1]}` },
  // Menciones de fecha de pago
  { regex: /(?:pago|me pagan|recibo)\s+(?:el|los)?\s*(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2})/i,
    categoria: 'FECHA_PAGO_PREFERIDA',
    plantilla: (m) => `Día de pago preferido: ${m[1]}` },
]

// Patrones de preferencias de trato
const PATRONES_PREFERENCIA: Array<{ regex: RegExp; plantilla: (m: RegExpMatchArray) => string }> = [
  { regex: /(?:ll[aá]mame|me llamas|tr[aá]tame)\s+(?:de\s+)?(\w+(?:\s+\w+){0,2})/i,
    plantilla: (m) => `Usuario prefiere ser llamado: "${m[1]}"` },
  { regex: /(?:habla (?:tú|tu)|trata (?:tú|tu)|de t[uú])\s*,/i,
    plantilla: () => `Usuario prefiere trato informal (tú)` },
  { regex: /(?:trate\s+de\s+usted|hable\s+de\s+usted)/i,
    plantilla: () => `Usuario prefiere trato formal (usted)` },
]

export async function detectarYRecordarHechos(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
  mensaje: string
}): Promise<void> {
  try {
    // Hechos
    for (const patron of PATRONES_HECHO) {
      const match = params.mensaje.match(patron.regex)
      if (match) {
        await recordarHecho({
          botTipo: params.botTipo,
          usuarioId: params.usuarioId,
          usuarioNombre: params.usuarioNombre,
          conversacionId: params.conversacionId,
          hecho: patron.plantilla(match),
          categoria: patron.categoria,
        })
      }
    }
    // Preferencias
    for (const patron of PATRONES_PREFERENCIA) {
      const match = params.mensaje.match(patron.regex)
      if (match) {
        await recordarPreferencia({
          botTipo: params.botTipo,
          usuarioId: params.usuarioId,
          usuarioNombre: params.usuarioNombre,
          preferencia: patron.plantilla(match),
        })
      }
    }
  } catch (err) {
    console.error('[bot-memoria] Error detectando hechos:', err)
  }
}

// =====================================================
// 8. REGISTRAR APRENDIZAJE (cuando una pregunta no está en dataset)
// =====================================================

export async function registrarAprendizaje(params: {
  botTipo: string
  pregunta: string
  respuestaDada?: string
  respuestaSugerida?: string
  categoria?: string
  fuente?: string
}): Promise<void> {
  try {
    // Buscar si ya existe una pregunta similar (igual normalizada)
    const preguntaNorm = params.pregunta.toLowerCase().trim().slice(0, 500)
    const existente = await db.aprendizajeBot.findFirst({
      where: {
        botTipo: params.botTipo,
        pregunta: { contains: preguntaNorm.slice(0, 100) },
        estado: { in: ['PENDIENTE', 'APROBADO'] },
      },
    })

    if (existente) {
      await db.aprendizajeBot.update({
        where: { id: existente.id },
        data: {
          frecuencia: { increment: 1 },
          updatedAt: new Date(),
        },
      })
      return
    }

    await db.aprendizajeBot.create({
      data: {
        botTipo: params.botTipo,
        pregunta: params.pregunta.slice(0, 1000),
        respuestaDada: params.respuestaDada?.slice(0, 2000) || null,
        respuestaSugerida: params.respuestaSugerida?.slice(0, 2000) || null,
        categoria: params.categoria || null,
        fuente: params.fuente || 'USUARIO',
        estado: 'PENDIENTE',
      },
    })
  } catch (err) {
    console.error('[bot-memoria] Error registrando aprendizaje:', err)
  }
}

// =====================================================
// 9. LIMPIEZA DE MEMORIAS EXPIRADAS
// =====================================================

export async function limpiarMemoriasExpiradas(): Promise<number> {
  try {
    const result = await db.memoriaBot.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
    return result.count
  } catch (err) {
    console.error('[bot-memoria] Error limpiando memorias:', err)
    return 0
  }
}

// =====================================================
// 10. HELPERS
// =====================================================

function decaerPeso(memoria: { peso: number; createdAt: Date; vecesRecordada: number }): number {
  const diasDesdeCreacion = (Date.now() - memoria.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  const factorDecaimiento = Math.pow(0.5, diasDesdeCreacion / HALF_VIDA_DIAS)
  const boostRecordacion = Math.min(memoria.vecesRecordada * 0.1, 1.0)
  return memoria.peso * factorDecaimiento + boostRecordacion
}

// =====================================================
// 11. ESTADÍSTICAS DE MEMORIA (para dashboard)
// =====================================================

export async function obtenerEstadisticasMemoria(botTipo?: string) {
  try {
    const where = botTipo ? { botTipo } : {}
    const [totalMemorias, totalContexto, totalHechos, totalPreferencias, totalResumenes, totalAprendizajes, aprendizajesPendientes] = await Promise.all([
      db.memoriaBot.count({ where }),
      db.memoriaBot.count({ where: { ...where, tipoMemoria: 'CONTEXTO' } }),
      db.memoriaBot.count({ where: { ...where, tipoMemoria: 'HECHO' } }),
      db.memoriaBot.count({ where: { ...where, tipoMemoria: 'PREFERENCIA' } }),
      db.memoriaBot.count({ where: { ...where, tipoMemoria: 'RESUMEN' } }),
      db.aprendizajeBot.count({ where: botTipo ? { botTipo } : {} }),
      db.aprendizajeBot.count({ where: botTipo ? { botTipo, estado: 'PENDIENTE' } : { estado: 'PENDIENTE' } }),
    ])

    return {
      totalMemorias,
      porTipo: {
        CONTEXTO: totalContexto,
        HECHO: totalHechos,
        PREFERENCIA: totalPreferencias,
        RESUMEN: totalResumenes,
      },
      aprendizajes: {
        total: totalAprendizajes,
        pendientes: aprendizajesPendientes,
      },
    }
  } catch (err) {
    console.error('[bot-memoria] Error estadísticas:', err)
    return null
  }
}

// =====================================================
// 12. GENERAR RESUMEN DE CONVERSACIÓN AL CERRAR
// =====================================================

export async function cerrarYResumirConversacion(params: {
  botTipo: string
  usuarioId?: string
  usuarioNombre?: string
  conversacionId?: string
}): Promise<void> {
  try {
    const ctx = await cargarContextoMemoria({
      botTipo: params.botTipo,
      usuarioId: params.usuarioId,
      conversacionId: params.conversacionId,
    })

    if (ctx.contexto.length < 4) return // muy poca información para resumir

    // Resumen simple: temas detectados + último mensaje
    const temasDetectados = new Set<string>()
    for (const msg of ctx.contexto) {
      const t = msg.texto.toLowerCase()
      if (t.includes('saldo') || t.includes('deuda')) temasDetectados.add('saldo')
      if (t.includes('pago') || t.includes('cuota')) temasDetectados.add('pagos')
      if (t.includes('mora') || t.includes('atraso')) temasDetectados.add('mora')
      if (t.includes('renovac') || t.includes('refinanc')) temasDetectados.add('renovacion')
      if (t.includes('requisito') || t.includes('document')) temasDetectados.add('requisitos')
      if (t.includes('asesor') || t.includes('humano')) temasDetectados.add('asesor_humano')
      if (t.includes('juridic') || t.includes('demanda')) temasDetectados.add('juridico')
      if (t.includes('clave') || t.includes('pin') || t.includes('login')) temasDetectados.add('autenticacion')
    }

    const temas = Array.from(temasDetectados).join(', ') || 'general'
    const ultimoMsg = ctx.contexto[ctx.contexto.length - 1]
    const fechaStr = new Date().toLocaleString('es-CO')

    const resumen = `Conversación del ${fechaStr}. Temas: ${temas}. ` +
      `Mensajes intercambiados: ${ctx.contexto.length}. ` +
      `Último mensaje del ${ultimoMsg.rol}: "${ultimoMsg.texto.slice(0, 200)}"`

    await guardarResumenConversacion({
      botTipo: params.botTipo,
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
      conversacionId: params.conversacionId,
      resumen,
    })

    // Limpiar mensajes de contexto viejos de esta conversación (ya están resumidos)
    if (params.conversacionId) {
      await db.memoriaBot.deleteMany({
        where: {
          botTipo: params.botTipo,
          conversacionId: params.conversacionId,
          tipoMemoria: 'CONTEXTO',
        },
      })
    }
  } catch (err) {
    console.error('[bot-memoria] Error cerrando conversación:', err)
  }
}

// =====================================================
// 13. BORRAR MEMORIA DE UN USUARIO (GDPR / olvido)
// =====================================================

export async function borrarMemoriaUsuario(params: {
  botTipo?: string
  usuarioId: string
}): Promise<{ memoriasBorradas: number; aprendizajesBorrados: number }> {
  try {
    const whereMem = params.botTipo
      ? { botTipo: params.botTipo, usuarioId: params.usuarioId }
      : { usuarioId: params.usuarioId }
    const delMem = await db.memoriaBot.deleteMany({ where: whereMem })

    // Aprendizajes no se borran (son conocimiento del bot, no del usuario)
    return { memoriasBorradas: delMem.count, aprendizajesBorrados: 0 }
  } catch (err) {
    console.error('[bot-memoria] Error borrando memoria:', err)
    return { memoriasBorradas: 0, aprendizajesBorrados: 0 }
  }
}
