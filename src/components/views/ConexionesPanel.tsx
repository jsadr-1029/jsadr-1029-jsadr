'use client'

// =====================================================
// ConexionesPanel — Pestaña del módulo Automatización
// Permite conectar WhatsApp Cloud API + n8n + Google AI Studio
// Persiste en modelo ConexionAPI (tabla ConexionAPI).
// =====================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  MessageSquare,
  Workflow,
  Sparkles,
  Save,
  Plug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Webhook,
} from 'lucide-react'

// === Tipos ===
type TipoConexion = 'WHATSAPP_BUSINESS' | 'N8N_WEBHOOK' | 'GOOGLE_AI_STUDIO'

interface ConexionState {
  id?: string
  nombre: string
  tipo: TipoConexion
  descripcion: string
  url: string
  apiKey: string // WHATSAPP: Webhook Verify Token | N8N: API Key | GOOGLE: API Key
  apiSecret: string // WHATSAPP: Access Token
  accountId: string // WHATSAPP: Phone Number ID
  telefonoOrigen: string // WHATSAPP: display phone number
  configuracionExtra: string // JSON string con extras (apiVersion, defaultModel, etc.)
  activa: boolean
  probada: boolean
  fechaUltimaPrueba: string | null
  resultadoUltimaPrueba: string | null
}

const ESTADOS_INICIALES: Record<TipoConexion, ConexionState> = {
  WHATSAPP_BUSINESS: {
    nombre: 'WhatsApp Cloud API',
    tipo: 'WHATSAPP_BUSINESS',
    descripcion: 'Conexión con WhatsApp Business Cloud API de Meta para envío de mensajes automatizados.',
    url: '',
    apiKey: '', // Webhook Verify Token
    apiSecret: '', // Access Token
    accountId: '', // Phone Number ID
    telefonoOrigen: '',
    configuracionExtra: JSON.stringify({ apiVersion: 'v21.0', wabaId: '' }, null, 2),
    activa: false,
    probada: false,
    fechaUltimaPrueba: null,
    resultadoUltimaPrueba: null,
  },
  N8N_WEBHOOK: {
    nombre: 'n8n Webhook',
    tipo: 'N8N_WEBHOOK',
    descripcion: 'Integración con n8n para automatizaciones y workflows personalizados.',
    url: '', // Webhook URL
    apiKey: '', // X-N8N-API-KEY
    apiSecret: '',
    accountId: '',
    telefonoOrigen: '',
    configuracionExtra: JSON.stringify({ webhookUrlTest: '', workflowIds: [] }, null, 2),
    activa: false,
    probada: false,
    fechaUltimaPrueba: null,
    resultadoUltimaPrueba: null,
  },
  GOOGLE_AI_STUDIO: {
    nombre: 'Google AI Studio (Gemini)',
    tipo: 'GOOGLE_AI_STUDIO',
    descripcion: 'API key de Google AI Studio para usar modelos Gemini en los bots del sistema.',
    url: '',
    apiKey: '', // API Key
    apiSecret: '',
    accountId: '',
    telefonoOrigen: '',
    configuracionExtra: JSON.stringify({ defaultModel: 'gemini-2.0-flash', projectId: '', location: 'us-central1' }, null, 2),
    activa: false,
    probada: false,
    fechaUltimaPrueba: null,
    resultadoUltimaPrueba: null,
  },
}

// === Componente principal ===
export function ConexionesPanel() {
  const { toast } = useToast()
  const [conexiones, setConexiones] = useState<Record<TipoConexion, ConexionState>>(ESTADOS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<TipoConexion | null>(null)
  const [probando, setProbando] = useState<TipoConexion | null>(null)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const cargarConexiones = useCallback(async () => {
    try {
      const resp = await fetch('/api/conexiones')
      const json = await resp.json()
      if (json.success && Array.isArray(json.data)) {
        const nuevas: Record<TipoConexion, ConexionState> = { ...ESTADOS_INICIALES }
        for (const c of json.data) {
          if (c.tipo in ESTADOS_INICIALES) {
            nuevas[c.tipo as TipoConexion] = {
              id: c.id,
              nombre: c.nombre,
              tipo: c.tipo,
              descripcion: c.descripcion || '',
              url: c.url || '',
              apiKey: c.apiKey === '••••••••' ? '' : c.apiKey || '',
              apiSecret: c.apiSecret === '••••••••' ? '' : c.apiSecret || '',
              accountId: c.accountId || '',
              telefonoOrigen: c.telefonoOrigen || '',
              configuracionExtra: c.configuracionExtra || nuevas[c.tipo as TipoConexion].configuracionExtra,
              activa: c.activa,
              probada: c.probada,
              fechaUltimaPrueba: c.fechaUltimaPrueba,
              resultadoUltimaPrueba: c.resultadoUltimaPrueba,
            }
          }
        }
        setConexiones(nuevas)
      }
    } catch (e: any) {
      toast({
        title: 'Error cargando conexiones',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    cargarConexiones()
  }, [cargarConexiones])

  const toggleSecret = (campo: string) => {
    setShowSecrets((prev) => ({ ...prev, [campo]: !prev[campo] }))
  }

  const guardar = async (tipo: TipoConexion) => {
    const c = conexiones[tipo]
    setGuardando(tipo)
    try {
      // Si ya existe, hacer PUT; si no, POST
      const method = c.id ? 'PUT' : 'POST'
      const url = c.id ? `/api/conexiones/${c.id}` : '/api/conexiones'
      const body = {
        nombre: c.nombre,
        tipo: c.tipo,
        descripcion: c.descripcion,
        url: c.url,
        apiKey: c.apiKey || undefined,
        apiSecret: c.apiSecret || undefined,
        accountId: c.accountId,
        telefonoOrigen: c.telefonoOrigen,
        configuracionExtra: c.configuracionExtra,
        activa: c.activa,
      }
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await resp.json()
      if (json.success) {
        toast({
          title: '✅ Conexión guardada',
          description: `${c.nombre} — ${c.activa ? 'Activa' : 'Inactiva'}`,
        })
        // Recargar para obtener el id y estado
        await cargarConexiones()
      } else {
        toast({
          title: 'Error guardando',
          description: json.error || 'No se pudo guardar',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setGuardando(null)
    }
  }

  const probar = async (tipo: TipoConexion) => {
    const c = conexiones[tipo]
    if (!c.id) {
      toast({
        title: 'Guarda primero',
        description: 'Debes guardar la conexión antes de probarla.',
        variant: 'destructive',
      })
      return
    }
    setProbando(tipo)
    try {
      const resp = await fetch(`/api/conexiones/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'probar' }),
      })
      const json = await resp.json()
      if (json.success) {
        toast({
          title: '✅ Conexión exitosa',
          description: json.message,
        })
      } else {
        toast({
          title: '❌ Prueba fallida',
          description: json.message || json.error || 'Error desconocido',
          variant: 'destructive',
        })
      }
      await cargarConexiones()
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setProbando(null)
    }
  }

  const actualizar = (tipo: TipoConexion, campo: keyof ConexionState, valor: any) => {
    setConexiones((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], [campo]: valor },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando conexiones…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <Card className="border-violet-400/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0">
              <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Centro de Integraciones</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configura las credenciales para que el bot del sistema pueda enviar mensajes por WhatsApp,
                disparar workflows en n8n y razonar con Gemini (Google AI Studio). Las credenciales se
                cifran en la base de datos con AES-256-GCM.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(['WHATSAPP_BUSINESS', 'N8N_WEBHOOK', 'GOOGLE_AI_STUDIO'] as TipoConexion[]).map((t) => {
                  const c = conexiones[t]
                  return (
                    <Badge
                      key={t}
                      variant="outline"
                      className={`text-[10px] ${
                        c.activa
                          ? c.probada
                            ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                            : 'border-amber-400/40 text-amber-300 bg-amber-500/10'
                          : 'border-white/10 text-muted-foreground'
                      }`}
                    >
                      {c.activa ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {c.nombre}
                      {c.probada && ' · verificada'}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Cloud API */}
      <WhatsAppCard
        state={conexiones.WHATSAPP_BUSINESS}
        onUpdate={(c, v) => actualizar('WHATSAPP_BUSINESS', c, v)}
        onGuardar={() => guardar('WHATSAPP_BUSINESS')}
        onProbar={() => probar('WHATSAPP_BUSINESS')}
        guardando={guardando === 'WHATSAPP_BUSINESS'}
        probando={probando === 'WHATSAPP_BUSINESS'}
        showSecrets={showSecrets}
        onToggleSecret={toggleSecret}
      />

      {/* n8n */}
      <N8nCard
        state={conexiones.N8N_WEBHOOK}
        onUpdate={(c, v) => actualizar('N8N_WEBHOOK', c, v)}
        onGuardar={() => guardar('N8N_WEBHOOK')}
        onProbar={() => probar('N8N_WEBHOOK')}
        guardando={guardando === 'N8N_WEBHOOK'}
        probando={probando === 'N8N_WEBHOOK'}
        showSecrets={showSecrets}
        onToggleSecret={toggleSecret}
      />

      {/* Google AI Studio */}
      <GoogleAICard
        state={conexiones.GOOGLE_AI_STUDIO}
        onUpdate={(c, v) => actualizar('GOOGLE_AI_STUDIO', c, v)}
        onGuardar={() => guardar('GOOGLE_AI_STUDIO')}
        onProbar={() => probar('GOOGLE_AI_STUDIO')}
        guardando={guardando === 'GOOGLE_AI_STUDIO'}
        probando={probando === 'GOOGLE_AI_STUDIO'}
        showSecrets={showSecrets}
        onToggleSecret={toggleSecret}
      />
    </div>
  )
}

// =====================================================
// Sub-componentes por tipo de conexión
// =====================================================

interface CardProps {
  state: ConexionState
  onUpdate: (campo: keyof ConexionState, valor: any) => void
  onGuardar: () => void
  onProbar: () => void
  guardando: boolean
  probando: boolean
  showSecrets: Record<string, boolean>
  onToggleSecret: (campo: string) => void
}

function EstadoConexion({ state }: { state: ConexionState }) {
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`text-[10px] ${
          state.activa
            ? state.probada
              ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
              : 'border-amber-400/40 text-amber-300 bg-amber-500/10'
            : 'border-white/10 text-muted-foreground'
        }`}
      >
        {state.activa ? 'Activa' : 'Inactiva'}
        {state.probada && ' · verificada'}
      </Badge>
      {state.fechaUltimaPrueba && (
        <span className="text-[10px] text-muted-foreground">
          Última prueba: {new Date(state.fechaUltimaPrueba).toLocaleString('es-CO')}
        </span>
      )}
    </div>
  )
}

function ResultadoPrueba({ state }: { state: ConexionState }) {
  if (!state.resultadoUltimaPrueba) return null
  const ok = state.probada
  return (
    <div
      className={`mt-3 p-3 rounded-lg border text-xs ${
        ok
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
          : 'border-red-400/30 bg-red-500/10 text-red-200'
      }`}
    >
      <div className="flex items-start gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div className="flex-1 break-words">{state.resultadoUltimaPrueba}</div>
      </div>
    </div>
  )
}

function WhatsAppCard(props: CardProps) {
  const { state, onUpdate, onGuardar, onProbar, guardando, probando, showSecrets, onToggleSecret } = props
  const cfg = safeParseJson(state.configuracionExtra, { apiVersion: 'v21.0', wabaId: '' })

  return (
    <Card className="border-emerald-400/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                WhatsApp Cloud API
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardTitle>
              <CardDescription className="mt-1">{state.descripcion}</CardDescription>
            </div>
          </div>
          <EstadoConexion state={state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Phone Number ID <span className="text-red-400">*</span></Label>
            <Input
              value={state.accountId}
              onChange={(e) => onUpdate('accountId', e.target.value)}
              placeholder="123456789012345"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Lo encuentras en Meta for Developers → WhatsApp → API Setup.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número visible (display)</Label>
            <Input
              value={state.telefonoOrigen}
              onChange={(e) => onUpdate('telefonoOrigen', e.target.value)}
              placeholder="+57 300 123 4567"
            />
            <p className="text-[10px] text-muted-foreground">
              Solo informativo, para mostrar en la UI.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Access Token (permanente) <span className="text-red-400">*</span></Label>
          <div className="relative">
            <Input
              type={showSecrets.wa_access ? 'text' : 'password'}
              value={state.apiSecret}
              onChange={(e) => onUpdate('apiSecret', e.target.value)}
              placeholder="EAAG..."
              className="font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => onToggleSecret('wa_access')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecrets.wa_access ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Genera un token permanente en System Users → Generate Access Token. NO lo compartas.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Webhook Verify Token (tú lo defines)</Label>
          <div className="relative">
            <Input
              type={showSecrets.wa_verify ? 'text' : 'password'}
              value={state.apiKey}
              onChange={(e) => onUpdate('apiKey', e.target.value)}
              placeholder="jsadr_webhook_secret_2026"
              className="font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => onToggleSecret('wa_verify')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecrets.wa_verify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cadena arbitraria que tú inventes. Meta lo enviará al webhook para verificar la autenticidad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">WABA ID (opcional)</Label>
            <Input
              value={cfg.wabaId || ''}
              onChange={(e) => {
                const nueva = JSON.stringify({ ...cfg, wabaId: e.target.value }, null, 2)
                onUpdate('configuracionExtra', nueva)
              }}
              placeholder="123456789012345"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              WhatsApp Business Account ID. Opcional, para registro.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Graph API Version</Label>
            <Input
              value={cfg.apiVersion || 'v21.0'}
              onChange={(e) => {
                const nueva = JSON.stringify({ ...cfg, apiVersion: e.target.value }, null, 2)
                onUpdate('configuracionExtra', nueva)
              }}
              placeholder="v21.0"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="bg-blue-500/5 border border-blue-400/20 rounded-lg p-3 text-[11px] text-blue-200/80 space-y-1">
          <p className="font-semibold">📡 URL del webhook (configúrala en Meta):</p>
          <code className="block bg-black/30 p-2 rounded text-blue-300 break-all">
            {typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.com'}/api/webhooks/whatsapp
          </code>
          <p>En Meta for Developers → WhatsApp → Configuration → Callback URL, pega esta URL y el Verify Token de arriba.</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={state.activa}
              onCheckedChange={(v) => onUpdate('activa', v)}
            />
            <Label className="text-xs">Activar como conexión principal</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onProbar} disabled={probando || !state.id}>
              {probando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Probar
            </Button>
            <Button size="sm" onClick={onGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        <ResultadoPrueba state={state} />
      </CardContent>
    </Card>
  )
}

function N8nCard(props: CardProps) {
  const { state, onUpdate, onGuardar, onProbar, guardando, probando, showSecrets, onToggleSecret } = props
  const cfg = safeParseJson(state.configuracionExtra, { webhookUrlTest: '', workflowIds: [] as string[] })

  return (
    <Card className="border-orange-400/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 text-white flex items-center justify-center shrink-0">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                n8n Webhook
                <a
                  href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardTitle>
              <CardDescription className="mt-1">{state.descripcion}</CardDescription>
            </div>
          </div>
          <EstadoConexion state={state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">URL del Webhook (producción) <span className="text-red-400">*</span></Label>
          <Input
            value={state.url}
            onChange={(e) => onUpdate('url', e.target.value)}
            placeholder="https://n8n.tudominio.com/webhook/jsadr-bot"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Copia la "Production URL" del nodo Webhook de tu workflow en n8n.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">URL del Webhook de prueba (opcional)</Label>
          <Input
            value={cfg.webhookUrlTest || ''}
            onChange={(e) => {
              const nueva = JSON.stringify({ ...cfg, webhookUrlTest: e.target.value }, null, 2)
              onUpdate('configuracionExtra', nueva)
            }}
            placeholder="https://n8n.tudominio.com/webhook-test/jsadr-bot"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">API Key (header X-N8N-API-KEY, opcional)</Label>
          <div className="relative">
            <Input
              type={showSecrets.n8n_key ? 'text' : 'password'}
              value={state.apiKey}
              onChange={(e) => onUpdate('apiKey', e.target.value)}
              placeholder="n8n_api_xxx..."
              className="font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => onToggleSecret('n8n_key')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecrets.n8n_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Si tu n8n está protegido con API Key, ponla aquí. Se envía como header <code>X-N8N-API-KEY</code>.
          </p>
        </div>

        <div className="bg-orange-500/5 border border-orange-400/20 rounded-lg p-3 text-[11px] text-orange-200/80 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5" /> Payload que se envía al webhook:</p>
          <pre className="bg-black/30 p-2 rounded text-orange-300 overflow-x-auto text-[10px] leading-relaxed">
{`{
  "source": "jsadr-automatizacion",
  "event": "test_connection" | "message_received" | ...,
  "timestamp": "2026-07-31T12:34:56.789Z",
  "payload": { ... }
}`}
          </pre>
          <p>Tu workflow en n8n debe esperar este formato y devolver HTTP 200.</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={state.activa}
              onCheckedChange={(v) => onUpdate('activa', v)}
            />
            <Label className="text-xs">Activar como conexión principal</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onProbar} disabled={probando || !state.id}>
              {probando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Probar
            </Button>
            <Button size="sm" onClick={onGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        <ResultadoPrueba state={state} />
      </CardContent>
    </Card>
  )
}

function GoogleAICard(props: CardProps) {
  const { state, onUpdate, onGuardar, onProbar, guardando, probando, showSecrets, onToggleSecret } = props
  const cfg = safeParseJson(state.configuracionExtra, {
    defaultModel: 'gemini-2.0-flash',
    projectId: '',
    location: 'us-central1',
  })

  return (
    <Card className="border-sky-400/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Google AI Studio (Gemini)
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardTitle>
              <CardDescription className="mt-1">{state.descripcion}</CardDescription>
            </div>
          </div>
          <EstadoConexion state={state} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">API Key <span className="text-red-400">*</span></Label>
          <div className="relative">
            <Input
              type={showSecrets.gai_key ? 'text' : 'password'}
              value={state.apiKey}
              onChange={(e) => onUpdate('apiKey', e.target.value)}
              placeholder="AIzaSy..."
              className="font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => onToggleSecret('gai_key')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecrets.gai_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Genera tu API key en <code>aistudio.google.com/app/apikey</code>. Es gratuita con cuotas generosas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Modelo por defecto</Label>
            <Input
              value={cfg.defaultModel || 'gemini-2.0-flash'}
              onChange={(e) => {
                const nueva = JSON.stringify({ ...cfg, defaultModel: e.target.value }, null, 2)
                onUpdate('configuracionExtra', nueva)
              }}
              placeholder="gemini-2.0-flash"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Modelos recomendados: <code>gemini-2.0-flash</code> (rápido), <code>gemini-1.5-pro</code> (potente).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Project ID (opcional)</Label>
            <Input
              value={cfg.projectId || ''}
              onChange={(e) => {
                const nueva = JSON.stringify({ ...cfg, projectId: e.target.value }, null, 2)
                onUpdate('configuracionExtra', nueva)
              }}
              placeholder="my-project-123"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="bg-sky-500/5 border border-sky-400/20 rounded-lg p-3 text-[11px] text-sky-200/80 space-y-1">
          <p className="font-semibold">🤖 Uso por los bots del sistema:</p>
          <p>
            Cuando un bot (Clientes, Asistente Personal, etc.) no encuentre una respuesta en su dataset
            y deba usar el LLM, el sistema priorizará Google Gemini si esta conexión está activa.
            Si no lo está, caerá al fallback por defecto (z-ai-web-dev-sdk).
          </p>
          <p>
            Temperatura sugerida por bot: Clientes (0.4), Asistente Personal (0.6), Jurídico (0.2).
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={state.activa}
              onCheckedChange={(v) => onUpdate('activa', v)}
            />
            <Label className="text-xs">Activar como conexión principal</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onProbar} disabled={probando || !state.id}>
              {probando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Probar
            </Button>
            <Button size="sm" onClick={onGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        <ResultadoPrueba state={state} />
      </CardContent>
    </Card>
  )
}

// === Utilidad ===
function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return { ...fallback, ...JSON.parse(s) } as T
  } catch {
    return fallback
  }
}
