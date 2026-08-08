// =====================================================
// hub-ia/orchestrator.ts
// AI Orchestrator — servicio central que coordina:
//   1. Recepción de la solicitud del usuario
//   2. Verificación de estado del agente (3 estados: operativo/solo_consulta/bloqueado)
//   3. Verificación de límite mensual de costos
//   4. Filtrado de seguridad (sanitización, prompt injection, acciones masivas)
//   5. Selección de proveedor (router) — soporta multi-IA (ZAI + OpenAI en paralelo)
//   6. Construcción del contexto y system prompt (con PII masking activo)
//   7. Llamada al proveedor (con fallback)
//   8. Validación de respuesta (anti-exfiltración)
//   9. Ejecución de herramientas (con permisos y confirmación)
//  10. Verificación post-ejecución
//  11. Registro de auditoría y uso
//  12. Fallback si el proveedor principal falla
// =====================================================

import { db } from '@/lib/db'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import type { AuthUser } from '@/lib/auth-guard'
import type { NextRequest } from 'next/server'
import {
  sanitizarInput,
  detectarPromptInjection,
  validarRespuestaIA,
  enmascararPII,
  enmascararPIIObjeto,
  requiereConfirmacion,
  clasificarRiesgo,
  usuarioPuedeUsarHerramienta,
  verificarPermisoCompleto,
  checkRateLimit,
  obtenerEstadoAgente,
  puedeEjecutarHerramientas,
  detectarAccionMasiva,
  verificarLimiteMensual,
} from './security-gateway'
import { llamarZAI, verificarZAI } from './providers/zai'
import { llamarOpenAI, verificarOpenAI, estaOpenAIConfigurado } from './providers/openai'
import { getToolByName, getToolsParaLLM, type ToolContext } from './tools/registry'

// ---------------------------------------------------------
// Tipos
// ---------------------------------------------------------

export type Provider = 'auto' | 'zai' | 'openai' | 'multi'

export interface ChatRequest {
  mensaje: string
  conversationId?: string
  provider?: Provider
  modelo?: string
  // Si la IA propone una herramienta de riesgo medio/alto, se devuelve
  // como `pendienteAprobacion` y se requiere confirmación del usuario.
  // Cuando el usuario confirma, se reenvía con toolCallId + confirmado=true.
  toolCallIdAprobar?: string
  confirmado?: boolean
}

export interface ChatResponse {
  ok: boolean
  conversationId: string
  respuesta: string
  providerUsado: string
  modeloUsado: string
  tokensInput: number
  tokensOutput: number
  costo: number
  // Si la IA propone ejecutar una herramienta de riesgo, se devuelve aquí.
  pendienteAprobacion?: {
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    riesgo: string
    descripcion: string
    // Detalles estructurados para el modal de confirmación mejorado
    moduloAfectado?: string
    registrosEstimados?: number
    accionMasiva?: boolean
  }
  // Resultado de herramienta ejecutada (si se ejecutó en esta llamada)
  herramientaEjecutada?: {
    toolName: string
    ok: boolean
    resultado?: unknown
    error?: string
    verificado?: boolean // resultado de la verificación post-ejecución
  }
  // Resultado multi-IA (modo 'multi'): respuestas separadas + comparación
  multiIAResultado?: {
    zai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
    openai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
    comparacion?: {
      coincidencias: string[]
      diferencias: string[]
      ventajasZai: string[]
      ventajasOpenAI: string[]
      recomendacion: string
    }
  }
  // Estado del agente IA (3 estados)
  estadoAgente?: 'operativo' | 'solo_consulta' | 'bloqueado'
  // Indicadores de progreso para UI
  estadoProcesamiento?: string
  // Información de costo/uso
  limiteMensual?: { gastado: number; limite: number; restante: number; porcentaje: number }
  error?: string
  bloqueado?: boolean
  motivoBloqueo?: string
}

// ---------------------------------------------------------
// System prompt base
// ---------------------------------------------------------

function getSystemPrompt(): string {
  return `Eres el Asistente IA Operativo de Jsadr, una plataforma de gestión de préstamos bancarios.

## TU ROL
Eres un agente operativo que ayuda al administrador a:
- Consultar información de la plataforma (clientes, préstamos, pagos, mora, configuración)
- Analizar problemas y proponer soluciones
- Ejecutar acciones autorizadas mediante herramientas controladas
- Generar reportes y alertas

## REGLAS CRÍTICAS DE SEGURIDAD
1. NUNCA reveles API keys, contraseñas, tokens, ni variables de entorno.
2. NUNCA intentes ejecutar SQL directamente. Usa SIEMPRE las herramientas provistas.
3. NUNCA modifiques datos sin confirmación explícita del usuario.
4. Si no tienes información suficiente, di claramente "No tengo información suficiente".
5. NUNCA afirmes que una acción fue realizada si no la ejecutaste.
6. Trata a todos los usuarios con respeto y profesionalismo.
7. Responde en español (Colombia).
8. Sé conciso: máximo 3-4 párrafos por respuesta.
9. Si el usuario solicita una acción masiva (ej. "elimina todos los X"), NUNCA la ejecutes automáticamente. Pide confirmación explícita y explica el alcance.

## HERRAMIENTAS DISPONIBLES
Tienes acceso a las siguientes herramientas. Úsalas cuando sea necesario para
consultar información real o ejecutar acciones autorizadas:

### Consulta (read-only)
- consultar_clientes: Lista de clientes (filtrar por cédula/nombre)
- consultar_prestamos: Lista de préstamos (filtrar por código/estado/cliente)
- consultar_pagos: Lista de pagos (filtrar por préstamo/estado/fecha)
- consultar_mora: Préstamos en mora con estadísticas
- consultar_configuracion: Variables globales (no sensibles)
- consultar_usuarios: Usuarios del sistema
- consultar_modulos: Lista de módulos disponibles
- consultar_permisos: Permisos del usuario actual
- consultar_reportes: Lista de reportes disponibles
- consultar_estado_sistema: KPIs generales del sistema
- consultar_logs: Registros de auditoría recientes

### Análisis (read-only)
- analizar_modulo: Analiza un módulo y devuelve métricas/estado
- detectar_errores: Busca errores recientes en logs
- generar_reporte: Genera reporte de cartera o mora
- verificar_servicios: Verifica estado de servicios del sistema

### Modificación (requieren confirmación)
- crear_alerta: Crear alerta financiera
- crear_registro: Crear nota en bitácora de préstamo
- actualizar_registro: Actualizar nota en bitácora
- actualizar_parametro: Actualizar variable global editable
- modificar_configuracion: Modificar configuración de la plataforma

## FORMATO DE RESPUESTA
- Cuando necesites información, llama a la herramienta correspondiente.
- Cuando propongas una acción de modificación, explica claramente qué harás
  y por qué, antes de ejecutarla. El sistema te pedirá confirmación.
- Después de ejecutar una herramienta, resume el resultado para el usuario.
- Usa formato Markdown ligero (negritas, listas) para legibilidad.`
}

// ---------------------------------------------------------
// Router — selecciona proveedor
// ---------------------------------------------------------

async function seleccionarProvider(solicitado: Provider): Promise<{
  provider: 'zai' | 'openai' | 'multi'
  openaiConfigurado: boolean
  zaiDisponible: boolean
}> {
  const [zaiOk, openaiOk] = await Promise.all([verificarZAI(), estaOpenAIConfigurado()])
  if (solicitado === 'zai') return { provider: 'zai', openaiConfigurado: openaiOk, zaiDisponible: zaiOk.ok }
  if (solicitado === 'openai') {
    if (!openaiOk) throw new Error('OpenAI no está configurado. Establece OPENAI_API_KEY en Configuración Global → Asistente IA.')
    return { provider: 'openai', openaiConfigurado: true, zaiDisponible: zaiOk.ok }
  }
  if (solicitado === 'multi') {
    if (!openaiOk) throw new Error('Para modo Multi-IA necesitas configurar OpenAI (ZAI + OpenAI). Establece OPENAI_API_KEY en Configuración Global → Asistente IA.')
    return { provider: 'multi', openaiConfigurado: true, zaiDisponible: zaiOk.ok }
  }
  // auto: preferir ZAI (gratis), fallback a OpenAI
  if (zaiOk.ok) return { provider: 'zai', openaiConfigurado: openaiOk, zaiDisponible: true }
  if (openaiOk) return { provider: 'openai', openaiConfigurado: true, zaiDisponible: false }
  throw new Error('No hay proveedores IA disponibles. Configura al menos uno.')
}

// ---------------------------------------------------------
// Costos estimados (USD por 1K tokens)
// ---------------------------------------------------------

const COSTOS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'zai-glm': { input: 0, output: 0 }, // ZAI sandbox es gratis
}

function calcularCosto(modelo: string, tokensInput: number, tokensOutput: number): number {
  const c = COSTOS[modelo] || COSTOS['gpt-4o-mini']
  return (tokensInput / 1000) * c.input + (tokensOutput / 1000) * c.output
}

// ---------------------------------------------------------
// Llamada Multi-IA — consulta ZAI + OpenAI en paralelo y compara
// ---------------------------------------------------------

async function llamarMultiIA(
  mensajes: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }>,
  modelo?: string
): Promise<{
  zai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
  openai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
}> {
  const tools = getToolsParaLLM()
  const toolsDesc = tools.map((t) => `- ${t.function.name}: ${t.function.description}`).join('\n')

  // Ejecutar ambas llamadas en paralelo
  const [zaiResult, openaiResult] = await Promise.allSettled([
    llamarZAI({
      messages: [
        { ...mensajes[0], content: mensajes[0].content + `\n\n## HERRAMIENTAS DISPONIBLES\n${toolsDesc}` },
        ...mensajes.slice(1),
      ],
      modelo,
    }),
    llamarOpenAI({
      messages: mensajes,
      modelo,
      herramientas: tools,
      toolChoice: 'auto',
      temperatura: 0.4,
    }),
  ])

  return {
    zai: zaiResult.status === 'fulfilled'
      ? {
          contenido: zaiResult.value.contenido,
          modelo: zaiResult.value.modelo,
          tokensInput: zaiResult.value.tokensInput,
          tokensOutput: zaiResult.value.tokensOutput,
          costo: calcularCosto(zaiResult.value.modelo, zaiResult.value.tokensInput, zaiResult.value.tokensOutput),
        }
      : {
          contenido: '',
          modelo: 'zai-glm',
          tokensInput: 0,
          tokensOutput: 0,
          costo: 0,
          error: zaiResult.reason?.message || 'Error desconocido en ZAI',
        },
    openai: openaiResult.status === 'fulfilled'
      ? {
          contenido: openaiResult.value.contenido,
          modelo: openaiResult.value.modelo,
          tokensInput: openaiResult.value.tokensInput,
          tokensOutput: openaiResult.value.tokensOutput,
          costo: calcularCosto(openaiResult.value.modelo, openaiResult.value.tokensInput, openaiResult.value.tokensOutput),
        }
      : {
          contenido: '',
          modelo: modelo || 'gpt-4o-mini',
          tokensInput: 0,
          tokensOutput: 0,
          costo: 0,
          error: openaiResult.reason?.message || 'Error desconocido en OpenAI',
        },
  }
}

/**
 * Genera una comparación entre las respuestas de ZAI y OpenAI.
 */
function generarComparacion(zaiResp: string, openaiResp: string): {
  coincidencias: string[]
  diferencias: string[]
  ventajasZai: string[]
  ventajasOpenAI: string[]
  recomendacion: string
} {
  const coincidencias: string[] = []
  const diferencias: string[] = []
  const ventajasZai: string[] = []
  const ventajasOpenAI: string[] = []

  // Análisis básico: longitudes, palabras clave compartidas, presencia de recomendaciones
  const zaiWords = new Set(zaiResp.toLowerCase().split(/\W+/).filter((w) => w.length > 4))
  const openaiWords = new Set(openaiResp.toLowerCase().split(/\W+/).filter((w) => w.length > 4))
  const compartidas = [...zaiWords].filter((w) => openaiWords.has(w)).slice(0, 5)

  if (compartidas.length > 0) {
    coincidencias.push(`Ambas respuestas mencionan conceptos clave similares: ${compartidas.join(', ')}.`)
  }
  if (zaiResp.length > openaiResp.length * 1.5) {
    diferencias.push('ZAI proporcionó una respuesta más extensa que OpenAI.')
    ventajasZai.push('Mayor nivel de detalle.')
  } else if (openaiResp.length > zaiResp.length * 1.5) {
    diferencias.push('OpenAI proporcionó una respuesta más extensa que ZAI.')
    ventajasOpenAI.push('Mayor nivel de detalle.')
  } else {
    coincidencias.push('Ambas respuestas tienen longitud similar.')
  }
  if (/^\s*[-*•]/m.test(zaiResp) && /^\s*[-*•]/m.test(openaiResp)) {
    coincidencias.push('Ambas respuestas usan listas estructuradas.')
  }
  if (/\d+/.test(zaiResp) && /\d+/.test(openaiResp)) {
    ventajasOpenAI.push('OpenAI tiende a ser más preciso con datos numéricos.')
  }
  if (zaiResp.split('\n').length > openaiResp.split('\n').length) {
    ventajasZai.push('ZAI estructuró mejor la respuesta en secciones.')
  }
  // Recomendación del sistema
  let recomendacion = ''
  if (zaiResp.length > 100 && openaiResp.length > 100) {
    recomendacion = 'Ambas respuestas son válidas. Se recomienda revisar la de OpenAI si la consulta requiere precisión técnica; la de ZAI si requiere contexto amplio.'
  } else if (zaiResp.length > 100) {
    recomendacion = 'Se recomienda la respuesta de ZAI por ser más completa.'
  } else if (openaiResp.length > 100) {
    recomendacion = 'Se recomienda la respuesta de OpenAI por ser más completa.'
  } else {
    recomendacion = 'Ambas respuestas son breves. Reformula la consulta para obtener más detalle.'
  }
  return { coincidencias, diferencias, ventajasZai, ventajasOpenAI, recomendacion }
}

// ---------------------------------------------------------
// Ejecución de herramienta (con permisos, pausa y auditoría)
// ---------------------------------------------------------

async function ejecutarHerramienta(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  conversationId: string,
  confirmado: boolean
): Promise<{ ok: boolean; resultado?: unknown; error?: string; requiereConfirmacion?: boolean; riesgo?: string; verificado?: boolean }> {
  const tool = getToolByName(toolName)
  if (!tool) return { ok: false, error: `Herramienta '${toolName}' no existe` }

  // Verificar estado del agente (3 estados) + permisos del usuario
  const permiso = await verificarPermisoCompleto(ctx.user.rol, toolName)
  if (!permiso.ok) {
    return { ok: false, error: permiso.motivo || 'Permiso denegado' }
  }

  const riesgo = clasificarRiesgo(toolName)

  // Si requiere confirmación y no fue confirmado, devolver pendiente
  if (requiereConfirmacion(toolName) && !confirmado) {
    // Registrar como propuesta pendiente
    await db.hubIAAccion.create({
      data: {
        conversationId,
        usuarioId: ctx.user.id,
        usuarioNombre: ctx.user.nombre,
        toolName,
        modulo: toolName.split('_')[1] || 'general',
        args: JSON.stringify(args),
        estado: 'propuesta',
        riesgo,
        ipOrigen: ctx.ipOrigen,
        userAgent: ctx.userAgent,
      },
    })
    return { ok: false, requiereConfirmacion: true, riesgo, error: 'Requiere confirmación del usuario' }
  }

  // Ejecutar
  try {
    const result = await tool.execute(args, ctx)

    // ----- VERIFICACIÓN POST-EJECUCIÓN -----
    // Para herramientas de modificación, verificar que el cambio realmente se persistió
    let verificado = true
    if (result.ok && tool.riesgo !== 'bajo') {
      try {
        // Para crear_alerta, actualizar_parametro, crear_registro, etc.: verificar que existe el registro
        // Esta es una verificación ligera; cada tool podría implementar su propia verificación
        const resultData = result.data as { id?: string } | undefined
        if (toolName === 'actualizar_parametro' && args.clave) {
          const v = await db.variableGlobal.findUnique({ where: { clave: String(args.clave) } })
          verificado = v?.valor === String(args.valor)
        } else if (toolName === 'crear_alerta' && resultData?.id) {
          const a = await db.alertaFinanciera.findUnique({ where: { id: String(resultData.id) } })
          verificado = !!a
        } else if (toolName === 'crear_registro' && resultData?.id) {
          const b = await db.bitacoraPrestamo.findUnique({ where: { id: String(resultData.id) } })
          verificado = !!b
        }
      } catch (verifyErr) {
        verificado = false
        console.error('[HubIA] Verificación post-ejecución falló:', verifyErr)
      }
    }

    // Registrar acción
    await db.hubIAAccion.create({
      data: {
        conversationId,
        usuarioId: ctx.user.id,
        usuarioNombre: ctx.user.nombre,
        toolName,
        modulo: toolName.split('_')[1] || 'general',
        args: JSON.stringify(args),
        resultado: JSON.stringify(result.data || result.error),
        estado: result.ok ? (verificado ? 'ejecutada' : 'fallida') : 'fallida',
        riesgo,
        ipOrigen: ctx.ipOrigen,
        userAgent: ctx.userAgent,
        errorMessage: verificado ? undefined : 'Verificación post-ejecución falló: el cambio no se persistió',
      },
    })
    return { ok: result.ok, resultado: result.data, error: result.error, riesgo, verificado }
  } catch (e: any) {
    await db.hubIAAccion.create({
      data: {
        conversationId,
        usuarioId: ctx.user.id,
        usuarioNombre: ctx.user.nombre,
        toolName,
        modulo: toolName.split('_')[1] || 'general',
        args: JSON.stringify(args),
        estado: 'fallida',
        riesgo,
        ipOrigen: ctx.ipOrigen,
        userAgent: ctx.userAgent,
        errorMessage: e?.message || 'Error desconocido',
      },
    })
    return { ok: false, error: e?.message || 'Error al ejecutar herramienta' }
  }
}

// ---------------------------------------------------------
// Helper para construir respuestas de error
// ---------------------------------------------------------

function errorResponse(conversationId: string, error: string, motivoBloqueo?: string, extra: Partial<ChatResponse> = {}): ChatResponse {
  return {
    ok: false,
    conversationId,
    respuesta: '',
    providerUsado: '',
    modeloUsado: '',
    tokensInput: 0,
    tokensOutput: 0,
    costo: 0,
    error,
    bloqueado: !!motivoBloqueo,
    motivoBloqueo,
    ...extra,
  }
}

// ---------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------

export async function orchestrate(
  req: ChatRequest,
  user: AuthUser,
  reqHttp?: NextRequest
): Promise<ChatResponse> {
  const clientInfo = reqHttp ? getClientInfo(reqHttp) : { ip: null, userAgent: null }
  const ctx: ToolContext = {
    user,
    ipOrigen: clientInfo.ip,
    userAgent: clientInfo.userAgent,
  }

  // 0. Verificar estado del agente (3 estados)
  const estadoAgente = await obtenerEstadoAgente()
  if (estadoAgente === 'bloqueado') {
    return errorResponse(
      req.conversationId || '',
      'El agente IA está BLOQUEADO por el administrador. El chat y todas las herramientas están deshabilitados.',
      'agente_bloqueado',
      { estadoAgente }
    )
  }

  // 1. Verificar límite mensual de costos
  const limite = await verificarLimiteMensual()
  if (!limite.ok) {
    return errorResponse(
      req.conversationId || '',
      `Límite mensual de gasto IA alcanzado ($${limite.gastado.toFixed(2)} / $${limite.limite.toFixed(2)}). Contacta al administrador para ajustar el límite en Configuración Global → Asistente IA.`,
      'limite_mensual_excedido',
      { estadoAgente, limiteMensual: limite }
    )
  }

  // 2. Rate limiting
  const rl = checkRateLimit(user.id)
  if (!rl.ok) {
    return errorResponse(
      req.conversationId || '',
      `Rate limit excedido. Intenta de nuevo en ${Math.ceil(rl.resetEnMs / 1000)}s.`,
      'rate_limit',
      { estadoAgente, limiteMensual: limite }
    )
  }

  // 3. Sanitizar input
  const san = sanitizarInput(req.mensaje)
  if (!san.ok) {
    return errorResponse(req.conversationId || '', 'Input inválido', 'invalid_input', { estadoAgente, limiteMensual: limite })
  }

  // 4. Detectar prompt injection
  const injection = detectarPromptInjection(san.texto)
  if (injection.severidad === 'critico') {
    // Bloquear directamente
    await db.hubIAAccion.create({
      data: {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        toolName: 'prompt_injection_blocked',
        modulo: 'seguridad',
        args: JSON.stringify({ mensaje: san.texto.slice(0, 200) }),
        estado: 'bloqueada',
        riesgo: 'critico',
        ipOrigen: ctx.ipOrigen,
        userAgent: ctx.userAgent,
        errorMessage: injection.mensaje,
      },
    })
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: 'PROMPT_INJECTION_BLOCKED',
      modulo: 'hub-ia',
      entidadNombre: 'Prompt injection bloqueado',
      detalles: JSON.stringify({ patrones: injection.patrones, mensaje: san.texto.slice(0, 200) }),
      ipOrigen: ctx.ipOrigen,
      userAgent: ctx.userAgent,
      exito: false,
      errorMessage: injection.mensaje,
    })
    return errorResponse(
      req.conversationId || '',
      'Tu mensaje fue bloqueado por contener patrones de prompt injection no permitidos. Si crees que es un error, reformula tu consulta.',
      'prompt_injection',
      { estadoAgente, limiteMensual: limite,
        respuesta: 'Tu mensaje fue bloqueado por contener patrones de prompt injection no permitidos.' }
    )
  }

  // 5. Detectar acciones masivas (se marca pero no bloquea — la confirmación vendrá después)
  const accionMasiva = detectarAccionMasiva(san.texto)

  // 6. Crear o cargar conversación
  let conversation = req.conversationId
    ? await db.hubIAConversation.findUnique({ where: { id: req.conversationId } })
    : null
  if (!conversation) {
    conversation = await db.hubIAConversation.create({
      data: {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        titulo: san.texto.slice(0, 60),
        provider: req.provider || 'auto',
      },
    })
  }

  // 7. Guardar mensaje del usuario
  await db.hubIAMensaje.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      contenido: san.texto,
    },
  })

  // 8. Cargar historial (últimos 20 mensajes para contexto)
  const historial = await db.hubIAMensaje.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  // 9. Construir mensajes para el LLM (aplicando PII masking a TODOS los mensajes)
  const mensajes = [
    { role: 'system' as const, content: getSystemPrompt() },
    ...historial.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'tool',
      content: m.role === 'tool' && m.toolResult
        ? `[Resultado de ${m.toolName}]: ${m.toolResult}`
        : enmascararPII(m.contenido), // PII masking activo
      tool_call_id: m.toolCallId || undefined,
      name: m.toolName || undefined,
    })),
  ]

  // 10. Seleccionar proveedor
  let providerUsado: 'zai' | 'openai' | 'multi'
  try {
    const sel = await seleccionarProvider(req.provider || 'auto')
    providerUsado = sel.provider
  } catch (e: any) {
    return errorResponse(conversation.id, e.message, 'no_provider', { estadoAgente, limiteMensual: limite })
  }

  // ---------------------------------------------------------
  // CASO ESPECIAL: Multi-IA (ZAI + OpenAI en paralelo + comparación)
  // ---------------------------------------------------------
  if (providerUsado === 'multi') {
    const multiResult = await llamarMultiIA(mensajes, req.modelo)

    // Validar ambas respuestas
    if (multiResult.zai?.contenido) {
      const v = validarRespuestaIA(multiResult.zai.contenido)
      if (v.bloquear) multiResult.zai.contenido = '⚠️ Respuesta bloqueada por el sistema de seguridad.'
    }
    if (multiResult.openai?.contenido) {
      const v = validarRespuestaIA(multiResult.openai.contenido)
      if (v.bloquear) multiResult.openai.contenido = '⚠️ Respuesta bloqueada por el sistema de seguridad.'
    }

    // Generar comparación
    const comparacion = generarComparacion(multiResult.zai?.contenido || '', multiResult.openai?.contenido || '')

    // Combinar tokens y costo
    const tokensInputTotal = (multiResult.zai?.tokensInput || 0) + (multiResult.openai?.tokensInput || 0)
    const tokensOutputTotal = (multiResult.zai?.tokensOutput || 0) + (multiResult.openai?.tokensOutput || 0)
    const costoTotal = (multiResult.zai?.costo || 0) + (multiResult.openai?.costo || 0)

    // Construir respuesta combinada
    const respuestaCombinada = `## 🤖 Respuesta Multi-IA

### Respuesta de Z.AI (GLM)
${multiResult.zai?.contenido || `_Error: ${multiResult.zai?.error || 'desconocido'}_`}

### Respuesta de OpenAI (${multiResult.openai?.modelo || 'gpt-4o-mini'})
${multiResult.openai?.contenido || `_Error: ${multiResult.openai?.error || 'desconocido'}_`}

### 📊 Comparación
- **Coincidencias**: ${comparacion.coincidencias.join(' ') || 'No se detectaron coincidencias significativas.'}
- **Diferencias**: ${comparacion.diferencias.join(' ') || 'No se detectaron diferencias significativas.'}
- **Ventajas ZAI**: ${comparacion.ventajasZai.join(' ') || 'No se identificaron ventajas claras.'}
- **Ventajas OpenAI**: ${comparacion.ventajasOpenAI.join(' ') || 'No se identificaron ventajas claras.'}
- **Recomendación del sistema**: ${comparacion.recomendacion}`

    // Guardar mensaje del assistant
    await db.hubIAMensaje.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        contenido: respuestaCombinada,
        provider: 'multi',
        modelo: 'zai+openai',
        tokensInput: tokensInputTotal,
        tokensOutput: tokensOutputTotal,
        costo: costoTotal,
        latencyMs: 0,
      },
    })

    await db.hubIAConversation.update({
      where: { id: conversation.id },
      data: {
        mensajeCount: { increment: 2 },
        totalTokens: { increment: tokensInputTotal + tokensOutputTotal },
        totalCosto: { increment: costoTotal },
        provider: 'multi',
        modelo: 'zai+openai',
      },
    })

    // Registrar uso para cada provider
    if (multiResult.zai) {
      await db.hubIAUso.create({
        data: {
          usuarioId: user.id, usuarioNombre: user.nombre, conversationId: conversation.id,
          provider: 'zai', modelo: multiResult.zai.modelo,
          tokensInput: multiResult.zai.tokensInput, tokensOutput: multiResult.zai.tokensOutput,
          costo: multiResult.zai.costo, exito: !multiResult.zai.error, errorMessage: multiResult.zai.error,
        },
      })
    }
    if (multiResult.openai) {
      await db.hubIAUso.create({
        data: {
          usuarioId: user.id, usuarioNombre: user.nombre, conversationId: conversation.id,
          provider: 'openai', modelo: multiResult.openai.modelo,
          tokensInput: multiResult.openai.tokensInput, tokensOutput: multiResult.openai.tokensOutput,
          costo: multiResult.openai.costo, exito: !multiResult.openai.error, errorMessage: multiResult.openai.error,
        },
      })
    }

    return {
      ok: true,
      conversationId: conversation.id,
      respuesta: respuestaCombinada,
      providerUsado: 'multi',
      modeloUsado: 'zai+openai',
      tokensInput: tokensInputTotal,
      tokensOutput: tokensOutputTotal,
      costo: costoTotal,
      multiIAResultado: { ...multiResult, comparacion },
      estadoAgente,
      limiteMensual: limite,
      estadoProcesamiento: 'completado',
    }
  }

  // ---------------------------------------------------------
  // CASO NORMAL: un solo proveedor (ZAI u OpenAI)
  // ---------------------------------------------------------
  let respuesta: string = ''
  let tokensInput = 0
  let tokensOutput = 0
  let modeloUsado = ''
  let latencyMs = 0
  let toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> | undefined
  let providerFinal: 'zai' | 'openai' = providerUsado
  let error: string | undefined

  try {
    const tools = getToolsParaLLM()
    if (providerUsado === 'openai') {
      const r = await llamarOpenAI({
        messages: mensajes,
        modelo: req.modelo,
        herramientas: tools,
        toolChoice: 'auto',
        temperatura: 0.4,
      })
      respuesta = r.contenido
      tokensInput = r.tokensInput
      tokensOutput = r.tokensOutput
      modeloUsado = r.modelo
      latencyMs = r.latencyMs
      toolCalls = r.toolCalls
    } else {
      // ZAI: no soporta function calling nativo. Pasamos descripción de herramientas en system prompt.
      const toolsDesc = tools.map((t) => `- ${t.function.name}: ${t.function.description}`).join('\n')
      const mensajesConTools = [...mensajes]
      mensajesConTools[0] = {
        ...mensajesConTools[0],
        content: mensajesConTools[0].content + `\n\n## HERRAMIENTAS DISPONIBLES\n${toolsDesc}\n\nSi necesitas usar una herramienta, responde con el formato JSON:\n{"tool":"nombre_herramienta","args":{...}}\nSolo usa este formato cuando sea necesario. Para respuestas directas, responde normalmente.`,
      }
      const r = await llamarZAI({ messages: mensajesConTools, modelo: req.modelo })
      respuesta = r.contenido
      tokensInput = r.tokensInput
      tokensOutput = r.tokensOutput
      modeloUsado = r.modelo
      latencyMs = r.latencyMs
      // Detectar tool call embebido en la respuesta de ZAI
      const toolMatch = respuesta.match(/\{[\s\S]*?"tool"[\s\S]*?\}/)
      if (toolMatch) {
        try {
          const parsed = JSON.parse(toolMatch[0])
          if (parsed.tool && typeof parsed.tool === 'string') {
            toolCalls = [{ id: `call_${Date.now()}`, name: parsed.tool, args: parsed.args || {} }]
            // Limpiar el JSON de la respuesta visible
            respuesta = respuesta.replace(toolMatch[0], '').trim()
          }
        } catch {}
      }
    }
  } catch (e: any) {
    // Fallback: si ZAI falla y OpenAI está configurado, usar OpenAI
    if (providerUsado === 'zai' && await estaOpenAIConfigurado()) {
      try {
        const r = await llamarOpenAI({
          messages: mensajes,
          modelo: req.modelo,
          herramientas: getToolsParaLLM(),
          toolChoice: 'auto',
          temperatura: 0.4,
        })
        respuesta = r.contenido
        tokensInput = r.tokensInput
        tokensOutput = r.tokensOutput
        modeloUsado = r.modelo
        latencyMs = r.latencyMs
        toolCalls = r.toolCalls
        providerFinal = 'openai'
        error = 'Fallback: ZAI falló, se usó OpenAI.'
      } catch (e2: any) {
        return errorResponse(
          conversation.id,
          `Ambos proveedores fallaron. ZAI: ${e.message} | OpenAI: ${e2.message}`,
          undefined,
          { providerUsado: providerFinal, modeloUsado, tokensInput, tokensOutput, estadoAgente, limiteMensual: limite }
        )
      }
    } else {
      return errorResponse(
        conversation.id,
        e.message,
        undefined,
        { providerUsado: providerFinal, modeloUsado, tokensInput, tokensOutput, estadoAgente, limiteMensual: limite }
      )
    }
  }

  // 11. Validar respuesta (anti-exfiltración)
  const validacion = validarRespuestaIA(respuesta)
  if (validacion.bloquear) {
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: 'IA_RESPONSE_BLOCKED',
      modulo: 'hub-ia',
      entidadNombre: 'Respuesta IA bloqueada',
      detalles: JSON.stringify({ motivo: validacion.motivo, errores: validacion.errores }),
      ipOrigen: ctx.ipOrigen,
      userAgent: ctx.userAgent,
      exito: false,
      errorMessage: validacion.motivo,
    })
    return {
      ...errorResponse(
        conversation.id,
        'La respuesta fue bloqueada por el sistema de seguridad.',
        'response_blocked',
        { providerUsado: providerFinal, modeloUsado, tokensInput, tokensOutput, estadoAgente, limiteMensual: limite }
      ),
      respuesta: 'La respuesta fue bloqueada por el sistema de seguridad.',
    }
  }

  // 12. Procesar tool calls
  let herramientaEjecutada: ChatResponse['herramientaEjecutada'] | undefined
  let pendienteAprobacion: ChatResponse['pendienteAprobacion'] | undefined

  if (toolCalls && toolCalls.length > 0) {
    const tc = toolCalls[0]
    const tool = getToolByName(tc.name)
    if (!tool) {
      respuesta += `\n\n⚠️ La IA intentó usar una herramienta desconocida: ${tc.name}`
    } else {
      // Verificar si requiere confirmación
      const riesgo = clasificarRiesgo(tc.name)
      if (requiereConfirmacion(tc.name) && !req.confirmado) {
        // Pendiente de aprobación — incluir detalles para modal mejorado
        const moduloAfectado = tc.name.split('_')[1] || 'general'
        // Detectar si los args sugieren acción masiva
        const argsStr = JSON.stringify(tc.args).toLowerCase()
        const esAccionMasiva = accionMasiva.detectado || /todos|todas|all/.test(argsStr)
        // Estimar registros afectados (heurística simple)
        let registrosEstimados = 1
        if (esAccionMasiva) registrosEstimados = -1 // indeterminado, se muestra como "afecta múltiples registros"
        else if (typeof tc.args.limite === 'number') registrosEstimados = tc.args.limite as number

        pendienteAprobacion = {
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
          riesgo,
          descripcion: tool.description,
          moduloAfectado,
          registrosEstimados,
          accionMasiva: esAccionMasiva,
        }
        // Guardar como mensaje assistant con toolCall pendiente
        await db.hubIAMensaje.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            contenido: respuesta || `Voy a ejecutar ${tc.name}. ¿Deseas continuar?`,
            provider: providerFinal,
            modelo: modeloUsado,
            toolName: tc.name,
            toolCallId: tc.id,
            toolArgs: JSON.stringify(tc.args),
            tokensInput,
            tokensOutput,
            costo: calcularCosto(modeloUsado, tokensInput, tokensOutput),
            latencyMs,
            aprobado: false,
          },
        })
        // Actualizar conversación
        await db.hubIAConversation.update({
          where: { id: conversation.id },
          data: {
            mensajeCount: { increment: 2 },
            totalTokens: { increment: tokensInput + tokensOutput },
            totalCosto: { increment: calcularCosto(modeloUsado, tokensInput, tokensOutput) },
            provider: providerFinal,
            modelo: modeloUsado,
          },
        })
        // Registrar uso
        await db.hubIAUso.create({
          data: {
            usuarioId: user.id,
            usuarioNombre: user.nombre,
            conversationId: conversation.id,
            provider: providerFinal,
            modelo: modeloUsado,
            tokensInput,
            tokensOutput,
            costo: calcularCosto(modeloUsado, tokensInput, tokensOutput),
            exito: true,
          },
        })
        return {
          ok: true,
          conversationId: conversation.id,
          respuesta: respuesta || `Propuesta: ejecutar ${tc.name}.`,
          providerUsado: providerFinal,
          modeloUsado,
          tokensInput,
          tokensOutput,
          costo: calcularCosto(modeloUsado, tokensInput, tokensOutput),
          pendienteAprobacion,
          estadoAgente,
          limiteMensual: limite,
          estadoProcesamiento: 'esperando_autorizacion',
        }
      } else {
        // Ejecutar herramienta
        const execResult = await ejecutarHerramienta(
          tc.name,
          tc.args,
          ctx,
          conversation.id,
          !!req.confirmado
        )
        if (execResult.requiereConfirmacion) {
          pendienteAprobacion = {
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.args,
            riesgo: execResult.riesgo || 'medio',
            descripcion: tool.description,
            moduloAfectado: tc.name.split('_')[1] || 'general',
            accionMasiva: accionMasiva.detectado,
          }
        } else if (execResult.ok) {
          herramientaEjecutada = {
            toolName: tc.name,
            ok: true,
            resultado: execResult.resultado,
            verificado: execResult.verificado,
          }
          // Añadir resultado al contexto para siguiente llamada (opcional)
          const verifStr = execResult.verificado === false ? ' ⚠️ Advertencia: la verificación post-ejecución no pudo confirmar el cambio.'
            : execResult.verificado === true ? ' ✅ Verificación: cambio persistido correctamente.' : ''
          respuesta += `\n\n✅ **${tc.name}** ejecutada correctamente.${verifStr} Resultado: ${JSON.stringify(execResult.resultado).slice(0, 500)}`
        } else {
          herramientaEjecutada = {
            toolName: tc.name,
            ok: false,
            error: execResult.error,
          }
          respuesta += `\n\n❌ **${tc.name}** falló: ${execResult.error}`
        }
      }
    }
  }

  // 13. Guardar mensaje del assistant
  const costoTotal = calcularCosto(modeloUsado, tokensInput, tokensOutput)
  await db.hubIAMensaje.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      contenido: respuesta,
      provider: providerFinal,
      modelo: modeloUsado,
      tokensInput,
      tokensOutput,
      costo: costoTotal,
      latencyMs,
    },
  })

  // 14. Actualizar conversación
  await db.hubIAConversation.update({
    where: { id: conversation.id },
    data: {
      mensajeCount: { increment: 2 },
      totalTokens: { increment: tokensInput + tokensOutput },
      totalCosto: { increment: costoTotal },
      provider: providerFinal,
      modelo: modeloUsado,
    },
  })

  // 15. Registrar uso
  await db.hubIAUso.create({
    data: {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      conversationId: conversation.id,
      provider: providerFinal,
      modelo: modeloUsado,
      tokensInput,
      tokensOutput,
      costo: costoTotal,
      exito: true,
      errorMessage: error,
    },
  })

  return {
    ok: true,
    conversationId: conversation.id,
    respuesta,
    providerUsado: providerFinal,
    modeloUsado,
    tokensInput,
    tokensOutput,
    costo: costoTotal,
    herramientaEjecutada,
    error,
    estadoAgente,
    limiteMensual: limite,
    estadoProcesamiento: 'completado',
  }
}

// ---------------------------------------------------------
// Confirmar y ejecutar herramienta pendiente
// ---------------------------------------------------------

export async function confirmarYEjecutarHerramienta(
  conversationId: string,
  toolCallId: string,
  user: AuthUser,
  reqHttp?: NextRequest
): Promise<ChatResponse> {
  const clientInfo = reqHttp ? getClientInfo(reqHttp) : { ip: null, userAgent: null }
  const ctx: ToolContext = { user, ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent }

  // Verificar estado del agente (3 estados)
  const estadoAgente = await obtenerEstadoAgente()
  if (estadoAgente === 'bloqueado') {
    return errorResponse(conversationId, 'El agente IA está bloqueado. No se pueden ejecutar herramientas.', 'agente_bloqueado', { estadoAgente })
  }

  // Buscar el mensaje assistant con el toolCall pendiente
  const msg = await db.hubIAMensaje.findFirst({
    where: { conversationId, toolCallId, role: 'assistant', aprobado: false },
  })
  if (!msg) {
    return errorResponse(conversationId, 'No se encontró la herramienta pendiente de aprobación.')
  }
  if (!msg.toolName || !msg.toolArgs) {
    return errorResponse(conversationId, 'El mensaje no tiene herramienta asociada.')
  }

  const args = JSON.parse(msg.toolArgs)
  const execResult = await ejecutarHerramienta(msg.toolName, args, ctx, conversationId, true)

  // Marcar como aprobado
  await db.hubIAMensaje.update({
    where: { id: msg.id },
    data: {
      aprobado: true,
      aprobadoPor: user.nombre,
      aprobadoAt: new Date(),
      toolResult: JSON.stringify(execResult.resultado || execResult.error),
    },
  })

  // Guardar mensaje tool
  await db.hubIAMensaje.create({
    data: {
      conversationId,
      role: 'tool',
      contenido: JSON.stringify(execResult.resultado || execResult.error),
      toolName: msg.toolName,
      toolCallId,
      toolArgs: msg.toolArgs,
      toolResult: JSON.stringify(execResult.resultado || execResult.error),
    },
  })

  const verifStr = execResult.verificado === false
    ? '\n\n⚠️ **Advertencia**: la verificación post-ejecución no pudo confirmar que el cambio se persistió. Verifica manualmente.'
    : execResult.verificado === true
    ? '\n\n✅ **Verificación**: cambio confirmado en base de datos.'
    : ''

  const respuesta = execResult.ok
    ? `✅ **${msg.toolName}** ejecutada correctamente.${verifStr}\n\nResultado: ${JSON.stringify(execResult.resultado, null, 2).slice(0, 1000)}`
    : `❌ **${msg.toolName}** falló: ${execResult.error}`

  // Guardar respuesta final
  await db.hubIAMensaje.create({
    data: {
      conversationId,
      role: 'assistant',
      contenido: respuesta,
      provider: msg.provider,
      modelo: msg.modelo,
    },
  })

  await db.hubIAConversation.update({
    where: { id: conversationId },
    data: { mensajeCount: { increment: 2 } },
  })

  return {
    ok: execResult.ok,
    conversationId,
    respuesta,
    providerUsado: msg.provider || '',
    modeloUsado: msg.modelo || '',
    tokensInput: 0,
    tokensOutput: 0,
    costo: 0,
    herramientaEjecutada: {
      toolName: msg.toolName,
      ok: execResult.ok,
      resultado: execResult.resultado,
      error: execResult.error,
      verificado: execResult.verificado,
    },
    error: execResult.error,
    estadoAgente,
    estadoProcesamiento: execResult.ok ? 'completado' : 'fallido',
  }
}
