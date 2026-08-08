// =====================================================
// hub-ia/orchestrator.ts
// AI Orchestrator — servicio central que coordina:
//   1. Recepción de la solicitud del usuario
//   2. Filtrado de seguridad (sanitización, prompt injection)
//   3. Selección de proveedor (router)
//   4. Construcción del contexto y system prompt
//   5. Llamada al proveedor
//   6. Validación de respuesta
//   7. Ejecución de herramientas (con permisos y confirmación)
//   8. Registro de auditoría y uso
//   9. Fallback si el proveedor principal falla
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
  requiereConfirmacion,
  clasificarRiesgo,
  usuarioPuedeUsarHerramienta,
  checkRateLimit,
  estaAgentePausado,
} from './security-gateway'
import { llamarZAI, verificarZAI } from './providers/zai'
import { llamarOpenAI, verificarOpenAI, estaOpenAIConfigurado } from './providers/openai'
import { getToolByName, getToolsParaLLM, type ToolContext } from './tools/registry'

// ---------------------------------------------------------
// Tipos
// ---------------------------------------------------------

export type Provider = 'auto' | 'zai' | 'openai'

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
  }
  // Resultado de herramienta ejecutada (si se ejecutó en esta llamada)
  herramientaEjecutada?: {
    toolName: string
    ok: boolean
    resultado?: unknown
    error?: string
  }
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
- consultar_estado_sistema: KPIs generales del sistema
- consultar_logs: Registros de auditoría recientes

### Modificación (requieren confirmación)
- crear_alerta: Crear alerta financiera
- actualizar_parametro: Actualizar variable global editable

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
  provider: 'zai' | 'openai'
  openaiConfigurado: boolean
  zaiDisponible: boolean
}> {
  const [zaiOk, openaiOk] = await Promise.all([verificarZAI(), estaOpenAIConfigurado()])
  if (solicitado === 'zai') return { provider: 'zai', openaiConfigurado: openaiOk, zaiDisponible: zaiOk.ok }
  if (solicitado === 'openai') {
    if (!openaiOk) throw new Error('OpenAI no está configurado. Establece OPENAI_API_KEY en Configuración Global → Asistente IA.')
    return { provider: 'openai', openaiConfigurado: true, zaiDisponible: zaiOk.ok }
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
// Ejecución de herramienta (con permisos y auditoría)
// ---------------------------------------------------------

async function ejecutarHerramienta(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  conversationId: string,
  confirmado: boolean
): Promise<{ ok: boolean; resultado?: unknown; error?: string; requiereConfirmacion?: boolean; riesgo?: string }> {
  const tool = getToolByName(toolName)
  if (!tool) return { ok: false, error: `Herramienta '${toolName}' no existe` }

  // Verificar pausa del agente
  if (await estaAgentePausado()) {
    return { ok: false, error: 'Agente IA pausado por el administrador. No se pueden ejecutar herramientas.' }
  }

  // Verificar permisos del usuario
  const permiso = usuarioPuedeUsarHerramienta(ctx.user.rol, toolName)
  if (!permiso.ok) return { ok: false, error: permiso.motivo || 'Permiso denegado' }

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
        estado: result.ok ? 'ejecutada' : 'fallida',
        riesgo,
        ipOrigen: ctx.ipOrigen,
        userAgent: ctx.userAgent,
        errorMessage: result.error,
      },
    })
    return { ok: result.ok, resultado: result.data, error: result.error, riesgo }
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

  // 1. Rate limiting
  const rl = checkRateLimit(user.id)
  if (!rl.ok) {
    return {
      ok: false,
      conversationId: req.conversationId || '',
      respuesta: '',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: `Rate limit excedido. Intenta de nuevo en ${Math.ceil(rl.resetEnMs / 1000)}s.`,
      bloqueado: true,
      motivoBloqueo: 'rate_limit',
    }
  }

  // 2. Sanitizar input
  const san = sanitizarInput(req.mensaje)
  if (!san.ok) {
    return {
      ok: false,
      conversationId: req.conversationId || '',
      respuesta: '',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: 'Input inválido',
      bloqueado: true,
      motivoBloqueo: 'invalid_input',
    }
  }

  // 3. Detectar prompt injection
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
    return {
      ok: false,
      conversationId: req.conversationId || '',
      respuesta: 'Tu mensaje fue bloqueado por contener patrones de prompt injection no permitidos. Si crees que es un error, reformula tu consulta.',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: injection.mensaje,
      bloqueado: true,
      motivoBloqueo: 'prompt_injection',
    }
  }

  // 4. Crear o cargar conversación
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

  // 5. Guardar mensaje del usuario
  await db.hubIAMensaje.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      contenido: san.texto,
    },
  })

  // 6. Cargar historial (últimos 20 mensajes para contexto)
  const historial = await db.hubIAMensaje.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  // 7. Construir mensajes para el LLM
  const mensajes = [
    { role: 'system' as const, content: getSystemPrompt() },
    ...historial.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'tool',
      content: m.role === 'tool' && m.toolResult
        ? `[Resultado de ${m.toolName}]: ${m.toolResult}`
        : m.contenido,
      tool_call_id: m.toolCallId || undefined,
      name: m.toolName || undefined,
    })),
  ]

  // 8. Seleccionar proveedor
  let providerUsado: 'zai' | 'openai'
  try {
    const sel = await seleccionarProvider(req.provider || 'auto')
    providerUsado = sel.provider
  } catch (e: any) {
    return {
      ok: false,
      conversationId: conversation.id,
      respuesta: '',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: e.message,
    }
  }

  // 9. Llamar al proveedor (con fallback)
  let respuesta: string = ''
  let tokensInput = 0
  let tokensOutput = 0
  let modeloUsado = ''
  let latencyMs = 0
  let toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> | undefined
  let providerFinal = providerUsado
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
        return {
          ok: false,
          conversationId: conversation.id,
          respuesta: '',
          providerUsado: providerFinal,
          modeloUsado,
          tokensInput,
          tokensOutput,
          costo: 0,
          error: `Ambos proveedores fallaron. ZAI: ${e.message} | OpenAI: ${e2.message}`,
        }
      }
    } else {
      return {
        ok: false,
        conversationId: conversation.id,
        respuesta: '',
        providerUsado: providerFinal,
        modeloUsado,
        tokensInput,
        tokensOutput,
        costo: 0,
        error: e.message,
      }
    }
  }

  // 10. Validar respuesta (anti-exfiltración)
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
      ok: false,
      conversationId: conversation.id,
      respuesta: 'La respuesta fue bloqueada por el sistema de seguridad.',
      providerUsado: providerFinal,
      modeloUsado,
      tokensInput,
      tokensOutput,
      costo: 0,
      error: validacion.motivo,
      bloqueado: true,
      motivoBloqueo: 'response_blocked',
    }
  }

  // 11. Procesar tool calls
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
        // Pendiente de aprobación
        pendienteAprobacion = {
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
          riesgo,
          descripcion: tool.description,
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
          }
        } else if (execResult.ok) {
          herramientaEjecutada = {
            toolName: tc.name,
            ok: true,
            resultado: execResult.resultado,
          }
          // Añadir resultado al contexto para siguiente llamada (opcional)
          respuesta += `\n\n✅ **${tc.name}** ejecutada correctamente. Resultado: ${JSON.stringify(execResult.resultado).slice(0, 500)}`
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

  // 12. Guardar mensaje del assistant
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

  // 13. Actualizar conversación
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

  // 14. Registrar uso
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

  // 15. Enmascarar PII en la respuesta visible (por seguridad adicional)
  // Solo si la respuesta se enviará a un frontend externo. Como esto es
  // admin interno, devolvemos la respuesta tal cual.
  void enmascararPII // referenced to keep import

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

  // Buscar el mensaje assistant con el toolCall pendiente
  const msg = await db.hubIAMensaje.findFirst({
    where: { conversationId, toolCallId, role: 'assistant', aprobado: false },
  })
  if (!msg) {
    return {
      ok: false,
      conversationId,
      respuesta: '',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: 'No se encontró la herramienta pendiente de aprobación.',
    }
  }
  if (!msg.toolName || !msg.toolArgs) {
    return {
      ok: false,
      conversationId,
      respuesta: '',
      providerUsado: '',
      modeloUsado: '',
      tokensInput: 0,
      tokensOutput: 0,
      costo: 0,
      error: 'El mensaje no tiene herramienta asociada.',
    }
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

  const respuesta = execResult.ok
    ? `✅ **${msg.toolName}** ejecutada correctamente.\n\nResultado: ${JSON.stringify(execResult.resultado, null, 2).slice(0, 1000)}`
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
    },
    error: execResult.error,
  }
}
