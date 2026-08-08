// =====================================================
// hub-ia/providers/zai.ts
// Provider ZAI — wrapper sobre z-ai-web-dev-sdk.
// No requiere API key (usa credenciales sandbox del entorno).
// =====================================================

import ZAI, { ChatMessage } from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
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
      parameters: Record<string, unknown> // JSON Schema
    }
  }>
  toolChoice?: 'auto' | 'none' | { type: 'function', function: { name: string } }
}

export async function llamarZAI(req: ProviderRequest): Promise<ProviderResponse> {
  const inicio = Date.now()
  const zai = await getZai()

  // Mapear mensajes al formato del SDK
  const mensajes: ChatMessage[] = req.messages.map((m) => ({
    role: m.role === 'tool' ? 'user' : (m.role as 'system' | 'user' | 'assistant'),
    content: m.content,
  }))

  const completion = await zai.chat.completions.create({
    messages: mensajes,
    stream: false,
    thinking: { type: 'disabled' },
  })

  const contenido = completion.choices?.[0]?.message?.content?.trim() || ''
  const latencyMs = Date.now() - inicio
  const tokensInput = (completion as any).usage?.prompt_tokens || Math.ceil(JSON.stringify(mensajes).length / 4)
  const tokensOutput = (completion as any).usage?.completion_tokens || Math.ceil(contenido.length / 4)

  return {
    contenido,
    tokensInput,
    tokensOutput,
    modelo: req.modelo || 'zai-glm',
    latencyMs,
  }
}

export async function verificarZAI(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await llamarZAI({
      messages: [
        { role: 'system', content: 'Responde solo "OK".' },
        { role: 'user', content: 'test' },
      ],
    })
    return { ok: r.contenido.length > 0 }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error desconocido' }
  }
}
