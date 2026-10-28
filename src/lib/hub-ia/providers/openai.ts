// =====================================================
// hub-ia/providers/openai.ts
// Provider OpenAI — usa el SDK oficial `openai`.
// Requiere OPENAI_API_KEY en variables de entorno (server-side only).
// =====================================================

import OpenAI from 'openai'
import { db } from '@/lib/db'
import { decryptSensitive } from '@/lib/security'

const CLAVE_API_KEY = 'openai_api_key'
const CLAVE_MODELO = 'openai_modelo'

let cachedClient: OpenAI | null = null
let cachedKeyHash: string | null = null

/**
 * Lee la API key de OpenAI desde:
 *   1. process.env.OPENAI_API_KEY (preferida)
 *   2. Tabla HubIAConfig (cifrada con AES-256)
 */
async function getApiKey(): Promise<string | null> {
  // 1. Variable de entorno
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  // 2. Base de datos
  try {
    const row = await db.hubIAConfig.findUnique({ where: { clave: CLAVE_API_KEY } })
    if (row?.valor) {
      try {
        return decryptSensitive(row.valor)
      } catch {
        return null
      }
    }
  } catch {}
  return null
}

/**
 * Lee el modelo configurado (default: gpt-4o-mini).
 */
export async function getModelo(): Promise<string> {
  try {
    const row = await db.hubIAConfig.findUnique({ where: { clave: CLAVE_MODELO } })
    if (row?.valor) return row.valor
  } catch {}
  return 'gpt-4o-mini'
}

/**
 * Obtiene cliente OpenAI (cached). Lanza error si no hay API key.
 */
async function getClient(): Promise<OpenAI> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key no configurada. Establécela en OPENAI_API_KEY o en Configuración Global → Asistente IA.')
  }
  // Hash simple para detectar cambios de key
  const keyHash = apiKey.slice(0, 8) + apiKey.length
  if (cachedClient && cachedKeyHash === keyHash) return cachedClient
  cachedClient = new OpenAI({ apiKey })
  cachedKeyHash = keyHash
  return cachedClient
}

export interface ProviderResponse {
  contenido: string
  tokensInput: number
  tokensOutput: number
  modelo: string
  latencyMs: number
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>
}

export interface ProviderRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }>
  modelo?: string
  temperatura?: number
  herramientas?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }>
  toolChoice?: 'auto' | 'none' | { type: 'function', function: { name: string } }
}

export async function llamarOpenAI(req: ProviderRequest): Promise<ProviderResponse> {
  const inicio = Date.now()
  const client = await getClient()
  const modelo = req.modelo || (await getModelo())

  // Mapear mensajes
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = req.messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content,
        tool_call_id: m.tool_call_id || '',
      } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam
    }
    if (m.role === 'assistant' && m.name) {
      return {
        role: 'assistant',
        content: m.content,
      } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
    }
    return {
      role: m.role,
      content: m.content,
    } as OpenAI.Chat.Completions.ChatCompletionSystemMessageParam
  })

  const completion = await client.chat.completions.create({
    model: modelo,
    messages,
    temperature: req.temperatura ?? 0.4,
    tools: req.herramientas as any,
    tool_choice: req.toolChoice as any,
  })

  const choice = completion.choices?.[0]
  const contenido = choice?.message?.content || ''
  const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
    id: tc.id,
    name: tc.function?.name || '',
    args: JSON.parse(tc.function?.arguments || '{}'),
  })) || undefined

  const latencyMs = Date.now() - inicio
  return {
    contenido,
    tokensInput: completion.usage?.prompt_tokens || 0,
    tokensOutput: completion.usage?.completion_tokens || 0,
    modelo,
    latencyMs,
    toolCalls,
  }
}

export async function verificarOpenAI(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await llamarOpenAI({
      messages: [
        { role: 'system', content: 'Responde solo "OK".' },
        { role: 'user', content: 'test' },
      ],
      temperatura: 0,
    })
    return { ok: r.contenido.length > 0 }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error desconocido' }
  }
}

export async function estaOpenAIConfigurado(): Promise<boolean> {
  const k = await getApiKey()
  return !!k
}
