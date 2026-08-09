'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import {
  ShieldCheck,
  Lock,
  Save,
  Github,
  Cloud,
  Database,
  RefreshCw,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Radio,
  Power,
  KeyRound,
  Webhook,
  Loader2,
  ExternalLink,
  Key,
  UserCog,
  Mail,
  MessageCircle,
  History,
  Plus,
  Trash2,
  Send,
  Users,
  Shield,
  Plug,
  Code2,
  BookOpen,
  Database as DatabaseIcon,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { EliminarConfirmacionDialog } from '@/components/views/EliminarConfirmacionDialog'
import { getUserData } from '@/lib/api-client'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
import { puedeAccederUsuario } from '@/lib/permisos'

// =====================================================
// Carga diferida (lazy) de los submódulos internos.
// Esto evita inflar el bundle inicial de SeguridadView y
// permite que cada submódulo se cargue solo cuando el
// usuario lo selecciona en su pestaña correspondiente.
// =====================================================
const ConexionesView = lazy(() =>
  import('@/components/views/ConexionesView').then((m) => ({ default: m.ConexionesView }))
)
const UsuariosView = lazy(() =>
  import('@/components/views/UsuariosView').then((m) => ({ default: m.UsuariosView }))
)
const CodigoFuenteView = lazy(() =>
  import('@/components/views/CodigoFuenteView').then((m) => ({ default: m.CodigoFuenteView }))
)
const ManualView = lazy(() =>
  import('@/components/views/ManualView').then((m) => ({ default: m.ManualView }))
)
const AuditoriaSeguridadView = lazy(() =>
  import('@/components/views/AuditoriaSeguridadView').then((m) => ({ default: m.AuditoriaSeguridadView }))
)
const ExportarView = lazy(() =>
  import('@/components/views/ExportarView').then((m) => ({ default: m.ExportarView }))
)

// Wrapper simple para mostrar un loader mientras carga el chunk diferido
function LazyFallback({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/60">
      <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-400" />
      <p className="text-sm">Cargando {nombre}…</p>
    </div>
  )
}

// =====================================================
// Tipos
// =====================================================
interface PlataformaSync {
  id: string
  plataforma: string         // GITHUB | VERCEL | NEON
  nombreMostrar: string
  descripcion: string | null
  sincronizado: boolean
  tiempoReal: boolean
  endpoint: string | null
  proyectoRef: string | null
  region: string | null
  ramaPrincipal: string | null
  tokenConfigurado: boolean
  webhookSecretConfigurado: boolean
  webhookSecret: string | null
  webhookUrl: string | null
  ultimoSync: string | null
  ultimoEstado: string | null
  ultimoError: string | null
  eventosRecibidos: number
}

interface ModuloSeguridad {
  id: string
  moduloKey: string
  moduloNombre: string
  protegido: boolean
}

// =====================================================
// Helpers
// =====================================================
const ICONS: Record<string, any> = {
  GITHUB: Github,
  VERCEL: Cloud,
  NEON: Database,
}

const COLORES: Record<string, string> = {
  GITHUB: 'bg-slate-900 text-white border-slate-700',
  VERCEL: 'bg-black text-white border-zinc-800',
  NEON: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const ESTADO_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  OK: { label: 'Operativo', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  ERROR: { label: 'Error', cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  PENDIENTE: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  NO_CONFIGURADO: { label: 'No configurado', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: Clock },
}

function formatLastSync(value: string | null): string {
  if (!value) return 'Nunca'
  try {
    const d = new Date(value)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'Hace segundos'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
    return d.toLocaleString('es-CO')
  } catch {
    return '—'
  }
}

// =====================================================
// Componente principal
// =====================================================
export function SeguridadView() {
  // === Pestana interna activa ===
  // 'principal' = sincronizacion + modulos protegidos + recuperacion + historial
  // Las demas pestanas cargan de forma diferida (lazy) los submodulos internos.
  const [tab, setTab] = useState<
    'principal' | 'conexiones' | 'usuarios' | 'codigo-fuente' | 'manual' | 'auditoria' | 'exportar'
  >('principal')

  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useFetch<{ modulos: ModuloSeguridad[] }>(`/api/seguridad/modulos`, { refreshKey })
  const modulos = data?.modulos || []

  const {
    data: dataPlat,
    loading: loadingPlat,
  } = useFetch<{ plataformas: PlataformaSync[] }>(`/api/seguridad/plataformas-sync`, { refreshKey })
  const plataformas = dataPlat?.plataformas || []

  const [configOpen, setConfigOpen] = useState(false)
  const [editing, setEditing] = useState<PlataformaSync | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Estado para eliminar credenciales (clave maestra "Eliminar")
  const [pendienteEliminar, setPendienteEliminar] = useState<{
    plataforma: string
    nombreMostrar: string
    detalle?: string
  } | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // === RBAC interno de pestañas ===
  // Cada pestaña se muestra solo si el usuario tiene permiso para acceder
  // a la vista correspondiente. Así, un GESTOR solo verá "Exportar BD" y
  // "Manual" (las vistas a las que tiene permiso), mientras que un ADMIN
  // verá todas las pestañas.
  const { rol: reactiveRol } = useAuthReactive()
  const user = getUserData()
  const rol = reactiveRol || user?.rol || ''
  const puede = (v: string) => puedeAccederUsuario(user?.username, rol, v as any)

  // Lista de pestañas con su key, label, icono y vista requerida
  const todasTabs: Array<{ key: typeof tab; label: string; icon: LucideIcon; vista: string }> = [
    { key: 'principal', label: 'Principal', icon: ShieldCheck, vista: 'seguridad' },
    { key: 'conexiones', label: 'Conexiones API', icon: Plug, vista: 'conexiones' },
    { key: 'usuarios', label: 'Usuarios', icon: Users, vista: 'usuarios' },
    { key: 'codigo-fuente', label: 'Código Fuente', icon: Code2, vista: 'codigo-fuente' },
    { key: 'manual', label: 'Manual', icon: BookOpen, vista: 'manual' },
    { key: 'auditoria', label: 'Auditoría', icon: ShieldAlert, vista: 'auditoria' },
    { key: 'exportar', label: 'Exportar BD', icon: DatabaseIcon, vista: 'exportar' },
  ]
  const tabsVisibles = todasTabs.filter((t) => puede(t.vista))

  // Si la pestaña activa no es visible para el usuario (porque cambió de rol
  // o porque la vista se cargó con un tab por defecto que no tiene permiso),
  // cambiar a la primera pestaña visible.
  useEffect(() => {
    if (tabsVisibles.length > 0 && !tabsVisibles.some((t) => t.key === tab)) {
      setTab(tabsVisibles[0].key)
    }
  }, [tabsVisibles, tab])

  const toggleProtegido = async (modulo: ModuloSeguridad) => {
    try {
      await apiPost('/api/seguridad/modulos', {
        moduloKey: modulo.moduloKey,
        moduloNombre: modulo.moduloNombre,
        protegido: !modulo.protegido,
      })
      setRefreshKey(k => k + 1)
      toast.success(`Módulo ${!modulo.protegido ? 'protegido' : 'desprotegido'}`)
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
  }

  const callApi = async (plataforma: string, accion: string, extra: any = {}) => {
    setBusy(`${plataforma}:${accion}`)
    try {
      const res = await apiPost('/api/seguridad/plataformas-sync', { plataforma, accion, ...extra })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(res.mensaje || res.detalle || 'Operación completada')
        setRefreshKey(k => k + 1)
      }
    } catch (e: any) {
      // apiPost lanza Error(json.error) cuando la API responde con status >= 400
      const msg = (e as Error).message || String(e)
      // Si el error menciona que falta token, abrir el modal automáticamente
      if (msg.toLowerCase().includes('token')) {
        const plat = plataformas.find(p => p.plataforma === plataforma)
        if (plat) {
          toast.error(msg)
          openConfig(plat)
          return
        }
      }
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const openConfig = (p: PlataformaSync) => {
    setEditing(p)
    setConfigOpen(true)
  }

  // === Eliminar credenciales con clave maestra "Eliminar" ===
  const eliminarCredencial = (plataforma: string, nombreMostrar: string, detalle?: string) => {
    setPendienteEliminar({ plataforma, nombreMostrar, detalle })
  }

  const confirmarEliminarCredencial = async () => {
    if (!pendienteEliminar) return
    setEliminando(true)
    try {
      const res = await fetch('/api/seguridad/credenciales/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plataforma: pendienteEliminar.plataforma,
          clave: 'Eliminar',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.mensaje || `Credenciales de ${pendienteEliminar.nombreMostrar} eliminadas`)
        setPendienteEliminar(null)
        setRefreshKey((k) => k + 1)
      } else {
        toast.error(json.error || 'No se pudieron eliminar las credenciales')
      }
    } catch (e: any) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguridad"
        subtitle="Centro de operaciones de seguridad · Sincronización, usuarios, conexiones, auditoría y BD"
        icon={ShieldCheck}
      />

      {/* =================================================
          Pestañas internas — submódulos de Seguridad
          (los que antes eran submenús ahora son internos)
          Cada pestaña se muestra solo si el usuario tiene permiso.
          ================================================= */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList
          className="flex overflow-x-auto whitespace-nowrap w-full gap-1 no-scrollbar h-auto"
          style={{ gridTemplateColumns: `repeat(${tabsVisibles.length}, minmax(0, 1fr))` }}
        >
          {tabsVisibles.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.key} value={t.key} className="flex-1">
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {t.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* === Pestaña: Principal (contenido original) === */}
        {puede('seguridad') && (
        <TabsContent value="principal" className="mt-6 space-y-6">
      {/* =================================================
          SECCIÓN 1: Sincronización de plataformas
          ================================================= */}
      <Card>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sincronización de Plataformas
                </h2>
                <p className="text-sm text-slate-500">
                  Activa o desactiva la sincronización en tiempo real con GitHub, Vercel y Neon Database.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loadingPlat}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loadingPlat ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
          </div>
        </div>

        {loadingPlat ? (
          <LoadingState />
        ) : !plataformas.length ? (
          <EmptyState icon={Cloud} title="Sin plataformas configuradas" />
        ) : (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {plataformas.map((p) => {
              const Icon = ICONS[p.plataforma] || Cloud
              const estado = ESTADO_BADGE[p.ultimoEstado || 'NO_CONFIGURADO'] || ESTADO_BADGE.NO_CONFIGURADO
              const EstadoIcon = estado.icon
              const isBusy = busy?.startsWith(p.plataforma + ':')

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border-2 ${p.sincronizado ? 'border-emerald-300' : 'border-slate-200'} bg-white overflow-hidden flex flex-col`}
                >
                  {/* Header de la tarjeta */}
                  <div className={`p-4 ${COLORES[p.plataforma] || 'bg-slate-100 text-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-7 h-7" />
                        <div>
                          <p className="font-semibold text-sm">{p.nombreMostrar}</p>
                          <p className="text-xs opacity-80">{p.plataforma}</p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-white/20`}>
                        <EstadoIcon className="w-3 h-3" />
                        {estado.label}
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="p-4 flex-1 space-y-3 bg-white">
                    <p className="text-xs text-slate-600 leading-relaxed min-h-[3em]">
                      {p.descripcion || 'Sin descripción'}
                    </p>

                    {/* Estado de conexión */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Proyecto</p>
                        <p className="font-mono text-slate-800 truncate">{p.proyectoRef || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Último sync</p>
                        <p className="font-medium text-slate-800">{formatLastSync(p.ultimoSync)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Token</p>
                        <p className="font-medium text-slate-800">
                          {p.tokenConfigurado ? (
                            <span className="text-emerald-600 inline-flex items-center gap-1">
                              <KeyRound className="w-3 h-3" /> Configurado
                            </span>
                          ) : (
                            <span className="text-amber-600">No configurado</span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Eventos recibidos</p>
                        <p className="font-medium text-slate-800">{p.eventosRecibidos}</p>
                      </div>
                    </div>

                    {p.ultimoError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="break-words">{p.ultimoError}</span>
                      </div>
                    )}

                    {/* Toggle: Sincronización principal */}
                    <div className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Power className={`w-4 h-4 ${p.sincronizado ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">Sincronización</p>
                            <p className="text-xs text-slate-500">
                              {p.sincronizado ? 'Activa' : 'Desactivada'}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={p.sincronizado}
                          onCheckedChange={() => callApi(p.plataforma, 'toggle_sync')}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    {/* Aviso: falta configurar token */}
                    {p.sincronizado && !p.tokenConfigurado && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Configuración incompleta</p>
                          <p>Pulsa <strong>Configurar</strong> para ingresar tu token de {p.nombreMostrar}. Sin token no se puede activar tiempo real ni probar la conexión.</p>
                        </div>
                      </div>
                    )}

                    {/* Toggle: Tiempo real (webhooks) */}
                    <div className={`rounded-lg border p-3 ${p.tiempoReal ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className={`w-4 h-4 ${p.tiempoReal ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">Tiempo real</p>
                            <p className="text-xs text-slate-500">
                              {p.tiempoReal
                                ? 'Webhooks activos'
                                : !p.sincronizado
                                  ? 'Requiere sincronización activa'
                                  : !p.tokenConfigurado
                                    ? 'Requiere token configurado'
                                    : 'Webhooks desactivados'}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={p.tiempoReal}
                          onCheckedChange={() => {
                            if (!p.sincronizado) {
                              toast.error(`Activa primero la sincronización de ${p.nombreMostrar}`)
                              return
                            }
                            if (!p.tokenConfigurado && !p.tiempoReal) {
                              toast.error(`Configura el token de ${p.nombreMostrar} primero (botón Configurar)`)
                              openConfig(p)
                              return
                            }
                            callApi(p.plataforma, 'toggle_realtime')
                          }}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openConfig(p)}
                        disabled={isBusy}
                      >
                        <Settings2 className="w-4 h-4 mr-1" />
                        Configurar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (!p.tokenConfigurado) {
                            toast.error(`Configura el token de ${p.nombreMostrar} primero (botón Configurar)`)
                            openConfig(p)
                            return
                          }
                          callApi(p.plataforma, 'test_connection')
                        }}
                        disabled={isBusy}
                      >
                        {isBusy && busy === `${p.plataforma}:test_connection` ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Probar
                      </Button>
                    </div>

                    {/* Eliminar credenciales (con clave maestra "Eliminar") */}
                    {p.tokenConfigurado && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                        onClick={() =>
                          eliminarCredencial(
                            p.plataforma,
                            p.nombreMostrar,
                            `Token de ${p.nombreMostrar} (${p.plataforma}) — se elimina de la BD local y de las env vars de Vercel`
                          )
                        }
                        disabled={isBusy}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar credenciales de {p.plataforma}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Banner informativo */}
        <div className="px-5 pb-5">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Webhook className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-blue-900">
                <p className="font-medium mb-1">¿Cómo funciona la sincronización en tiempo real?</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs text-blue-800">
                  <li>Activa el toggle <strong>Sincronización</strong> para habilitar la conexión con la plataforma.</li>
                  <li>Pulsa <strong>Configurar</strong> e ingresa tu token de API y el webhook secreto.</li>
                  <li>Activa el toggle <strong>Tiempo real</strong> para empezar a recibir eventos vía webhook.</li>
                  <li>Copia la URL del webhook y configúrala en la plataforma (GitHub/Vercel/Neon).</li>
                  <li>Cada evento recibido incrementará el contador y actualizará el último sync.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* =================================================
          SECCIÓN 1b: Credenciales SMTP (Brevo) — bloqueable con "Eliminar"
          ================================================= */}
      <Card>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Credenciales SMTP (Brevo) — Fallback
              </h2>
              <p className="text-sm text-slate-500">
                Clave SMTP (xsmtpsib-...) usada como <strong>fallback</strong> cuando la API HTTPS de Brevo falla.
                El botón «Eliminar» requiere la clave maestra <strong>«Eliminar»</strong> (no caduca).
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 text-blue-700">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Brevo SMTP</p>
                <p className="text-xs text-slate-500 font-mono">jsa@jsadr.com.co</p>
                <p className="text-xs text-slate-500">smtp-relay.brevo.com:587</p>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 flex flex-col justify-center gap-2 sm:col-span-2">
            <p className="text-xs text-slate-600">
              Esta clave se usa para enviar correos desde el sistema (recuperación de clave, OTP de firma,
              notificaciones automáticas). Está protegida: para eliminarla hay que escribir la palabra
              <strong> «Eliminar»</strong> en el modal de confirmación. La clave maestra <strong>no caduca</strong>.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
              onClick={() =>
                eliminarCredencial(
                  'BREVO_SMTP',
                  'Brevo SMTP (jsa@jsadr.com.co)',
                  'Clave SMTP de Brevo — se elimina de ConexionAPI, CorreoInstitucional y de la env var BREVO_SMTP_KEY en Vercel'
                )
              }
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar clave Brevo SMTP
            </Button>
          </div>
        </div>
      </Card>

      {/* =================================================
          SECCIÓN 1c: Credenciales API HTTPS (Brevo) — camino principal
          ================================================= */}
      <Card>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Credenciales API HTTPS (Brevo) — Principal
              </h2>
              <p className="text-sm text-slate-500">
                API key (xkeysib-...) usada como <strong>camino principal</strong> para envío de correos vía
                <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">POST api.brevo.com/v3/smtp/email</code>.
                No tiene restricción de IP → funciona en Vercel sin configuración adicional.
                El botón «Eliminar» requiere la clave maestra <strong>«Eliminar»</strong> (no caduca).
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-700">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Brevo API HTTPS</p>
                <p className="text-xs text-slate-500 font-mono">jsa@jsadr.com.co</p>
                <p className="text-xs text-slate-500">api.brevo.com/v3/smtp/email</p>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 flex flex-col justify-center gap-2 sm:col-span-2">
            <p className="text-xs text-slate-600">
              Esta API key (xkeysib-...) es el <strong>camino principal</strong> de envío de correos desde el sistema.
              Si falla (servicio caído, red), el sistema intenta automáticamente el <strong>fallback SMTP</strong> de arriba.
              Está protegida: para eliminarla hay que escribir la palabra <strong>«Eliminar»</strong> en el modal de confirmación.
              La clave maestra <strong>no caduca</strong>.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
              onClick={() =>
                eliminarCredencial(
                  'BREVO_API',
                  'Brevo API HTTPS (jsa@jsadr.com.co)',
                  'API key de Brevo (xkeysib-...) — se elimina de ConexionAPI.EMAIL_SMTP.apiKey y de la env var BREVO_API_KEY en Vercel. El sistema seguirá funcionando con el fallback SMTP.'
                )
              }
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar clave Brevo API HTTPS
            </Button>
          </div>
        </div>
      </Card>

      {/* =================================================
          SECCIÓN 2: Módulos protegidos
          ================================================= */}
      <Card>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Módulos Protegidos</h2>
              <p className="text-sm text-slate-500">
                Módulos del sistema que requieren clave maestra para ser accedidos.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : !modulos.length ? (
          <EmptyState icon={ShieldCheck} title="Sin módulos" />
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modulos.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    m.protegido ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.moduloNombre}</p>
                    <p className="text-xs text-slate-500">{m.moduloKey}</p>
                  </div>
                </div>
                <Switch checked={m.protegido} onCheckedChange={() => toggleProtegido(m)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* =================================================
          Modal de configuración de plataforma
          ================================================= */}
      <ConfigPlataformaModal
        plataforma={editing}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={() => {
          setConfigOpen(false)
          setRefreshKey(k => k + 1)
        }}
      />

      {/* =================================================
          SECCIÓN 3: Validador de Firma Electrónica
          Permite a ADMIN/GESTOR pegar un código de firma
          (el del QR del certificado) para verificar si es
          auténtico o si fue modificado/falsificado.
          ================================================= */}
      <ValidadorFirmaPanel />

      {/* =================================================
          SECCIÓN 4: Centro de Recuperación de Claves
          ================================================= */}
      <RecuperacionClavesPanel />

      {/* =================================================
          SECCIÓN 5: Historial de Ingresos al Portal del Cliente
          Registra IP + tipo de dispositivo cada vez que un
          cliente ingresa al portal. Visible únicamente desde
          el módulo de Seguridad (orden obligatoria del usuario).
          ================================================= */}
      <HistorialIngresosPortalPanel />

      {/* =================================================
          Modal de confirmación reforzada para eliminar credenciales
          Requiere la palabra exacta "Eliminar" (clave maestra,
          no caduca, no se almacena en BD).
          ================================================= */}
      <EliminarConfirmacionDialog
        open={pendienteEliminar !== null}
        onClose={() => { if (!eliminando) setPendienteEliminar(null) }}
        onConfirm={confirmarEliminarCredencial}
        recursoTipo={`credencial de ${pendienteEliminar?.nombreMostrar || ''}`}
        recursoNombre={pendienteEliminar?.nombreMostrar || ''}
        recursoDetalle={pendienteEliminar?.detalle}
        cargando={eliminando}
      />
        </TabsContent>
        )}

        {/* === Pestaña: Conexiones API (submódulo interno) === */}
        {puede('conexiones') && (
        <TabsContent value="conexiones" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Conexiones API" />}>
            <ConexionesView />
          </Suspense>
        </TabsContent>
        )}

        {/* === Pestaña: Usuarios (submódulo interno) === */}
        {puede('usuarios') && (
        <TabsContent value="usuarios" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Usuarios" />}>
            <UsuariosView />
          </Suspense>
        </TabsContent>
        )}

        {/* === Pestaña: Código Fuente (submódulo interno) === */}
        {puede('codigo-fuente') && (
        <TabsContent value="codigo-fuente" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Código Fuente" />}>
            <CodigoFuenteView />
          </Suspense>
        </TabsContent>
        )}

        {/* === Pestaña: Manual (submódulo interno) === */}
        {puede('manual') && (
        <TabsContent value="manual" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Manual" />}>
            <ManualView />
          </Suspense>
        </TabsContent>
        )}

        {/* === Pestaña: Auditoría Seguridad (submódulo interno) === */}
        {puede('auditoria') && (
        <TabsContent value="auditoria" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Auditoría de Seguridad" />}>
            <AuditoriaSeguridadView />
          </Suspense>
        </TabsContent>
        )}

        {/* === Pestaña: Exportar Base de Datos (submódulo interno) === */}
        {puede('exportar') && (
        <TabsContent value="exportar" className="mt-6">
          <Suspense fallback={<LazyFallback nombre="Exportar Base de Datos" />}>
            <ExportarView />
          </Suspense>
        </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// =====================================================
// Modal de configuración por plataforma
// =====================================================
function ConfigPlataformaModal({
  plataforma,
  open,
  onOpenChange,
  onSaved,
}: {
  plataforma: PlataformaSync | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    proyectoRef: '',
    region: '',
    ramaPrincipal: 'main',
    endpoint: '',
    webhookUrl: '',
    token: '',
    webhookSecret: '',
    descripcion: '',
  })
  const [saving, setSaving] = useState(false)

  // Sincronizar formulario cuando cambia la plataforma seleccionada
  useEffect(() => {
    if (plataforma) {
      setForm({
        proyectoRef: plataforma.proyectoRef || '',
        region: plataforma.region || '',
        ramaPrincipal: plataforma.ramaPrincipal || 'main',
        endpoint: plataforma.endpoint || '',
        webhookUrl: plataforma.webhookUrl || '',
        token: '', // no se rellena por seguridad
        webhookSecret: '', // no se rellena por seguridad
        descripcion: plataforma.descripcion || '',
      })
    }
  }, [plataforma])

  if (!plataforma) return null

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const payload: any = {
        plataforma: plataforma.plataforma,
        accion: 'update_config',
        proyectoRef: form.proyectoRef,
        region: form.region,
        ramaPrincipal: form.ramaPrincipal,
        endpoint: form.endpoint,
        webhookUrl: form.webhookUrl,
        descripcion: form.descripcion,
      }
      if (form.token) payload.token = form.token
      if (form.webhookSecret) payload.webhookSecret = form.webhookSecret

      const res = await apiPost('/api/seguridad/plataformas-sync', payload)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(res.mensaje || 'Configuración guardada')
        onSaved()
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const Icon = ICONS[plataforma.plataforma] || Cloud
  const webhookPath = plataforma.plataforma === 'NEON'
    ? `/api/seguridad/plataformas-sync/webhook?plataforma=NEON&secret=TU_SECRETO`
    : `/api/seguridad/plataformas-sync/webhook?plataforma=${plataforma.plataforma}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            Configurar {plataforma.nombreMostrar}
          </DialogTitle>
          <DialogDescription>
            Ingresa las credenciales y parámetros de conexión. Los tokens se cifran con AES-256-GCM antes de almacenarse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Identificación del proyecto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Proyecto / Repo (owner/name o project-id)</Label>
              <Input
                value={form.proyectoRef}
                onChange={(e) => setForm({ ...form, proyectoRef: e.target.value })}
                placeholder={plataforma.plataforma === 'GITHUB' ? 'jsadr-1029/jsadr' : plataforma.plataforma === 'VERCEL' ? 'prj_xxxxxxxx' : 'rapid-darkness-56995142'}
              />
            </div>
            <div>
              <Label className="text-xs">Región (solo Vercel/Neon)</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder={plataforma.plataforma === 'NEON' ? 'AWS us-east-2' : 'iad1'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Endpoint base</Label>
              <Input
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://api.github.com"
              />
            </div>
            <div>
              <Label className="text-xs">Rama principal</Label>
              <Input
                value={form.ramaPrincipal}
                onChange={(e) => setForm({ ...form, ramaPrincipal: e.target.value })}
                placeholder="main"
              />
            </div>
          </div>

          {/* Credenciales */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <KeyRound className="w-3 h-3" />
              Token de API {plataforma.tokenConfigurado && (
                <span className="text-emerald-600 ml-1">(actualmente configurado — dejar vacío para mantener)</span>
              )}
            </Label>
            <Input
              type="password"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              placeholder={plataforma.plataforma === 'GITHUB' ? 'ghp_xxxxxxxxxxxx' : plataforma.plataforma === 'VERCEL' ? 'vercel_xxxxxxxxxxxx' : 'neon_xxxxxxxxxxxx'}
            />
            <p className="text-xs text-slate-500 mt-1">
              {plataforma.plataforma === 'GITHUB' && 'Crea un PAT en: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained (repo, workflow, webhook).'}
              {plataforma.plataforma === 'VERCEL' && 'Crea un token en: Vercel → Account Settings → Tokens.'}
              {plataforma.plataforma === 'NEON' && 'Crea un API key en: Neon Console → Account → API Keys.'}
            </p>
          </div>

          {/* Webhook */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Webhook className="w-3 h-3" />
              Webhook Secret (compartido con la plataforma)
            </Label>
            <Input
              type="password"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              placeholder="Secreto aleatorio de al menos 20 caracteres"
            />
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">
              <p className="font-mono break-all text-slate-700">{webhookPath}</p>
              <p className="text-slate-500 mt-1">
                Copia esta URL y configúrala como webhook en {plataforma.nombreMostrar}.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs">URL pública del webhook (opcional — se autocompleta con tu dominio)</Label>
            <Input
              value={form.webhookUrl}
              onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
              placeholder="https://tu-dominio.com/api/seguridad/plataformas-sync/webhook"
            />
          </div>

          <div>
            <Label className="text-xs">Descripción (notas internas)</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Para qué se usa esta conexión, responsable, fecha de creación..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// RecuperacionClavesPanel — Centro de control de
// recuperación de credenciales (usuarios y clientes)
// =====================================================

interface HistorialRecuperacion {
  id: string
  fecha: string
  tipo: string
  usuarioNombre: string
  username: string
  metodo: string
  destinatario: string
  exito: boolean
  ip: string
  detalles: string[]
  origen: string
}

interface Destinatario {
  tipo: string
  destino: string
  nombre: string
}

function RecuperacionClavesPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useFetch<{
    historial: HistorialRecuperacion[]
    stats: { totalSolicitudes: number; exitosas: number; fallidas: number; porMetodo: { EMAIL: number; WHATSAPP: number } }
    destinatarios: Destinatario[]
  }>(`/api/seguridad/recuperacion-claves`, { refreshKey })

  const [tab, setTab] = useState<'historial' | 'destinatarios' | 'reset' | 'credenciales'>('credenciales')
  const [busqueda, setBusqueda] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Estado para reset manual
  const [resetTipo, setResetTipo] = useState<'usuario' | 'cliente'>('usuario')
  const [resetId, setResetId] = useState('')
  const [resetNotificar, setResetNotificar] = useState(true)
  const [resetResultado, setResetResultado] = useState<any>(null)

  // Estado para gestionar destinatarios
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [nuevoDest, setNuevoDest] = useState<Destinatario>({ tipo: 'EMAIL', destino: '', nombre: '' })

  // Estado para credenciales activas (usuarios y clientes)
  // Permite ver qué credenciales hay activas y bloquearlas.
  interface CredencialActiva {
    id: string
    tipo: 'USUARIO' | 'CLIENTE'
    nombre: string
    identificador: string // username (usuario) o cedula (cliente)
    email: string | null
    telefono: string | null
    rol: string | null // ADMIN/GESTOR/CONSULTOR/ABOGADO para usuarios
    activo: boolean
    ultimoAcceso: string | null
  }
  const [credenciales, setCredenciales] = useState<CredencialActiva[]>([])
  const [loadingCred, setLoadingCred] = useState(false)
  const [bloqueando, setBloqueando] = useState<string | null>(null)

  useEffect(() => {
    if (data?.destinatarios) {
      setDestinatarios(data.destinatarios)
    }
  }, [data?.destinatarios])

  const ejecutarReset = async () => {
    if (!resetId.trim()) {
      toast.error('Ingresa el ID del ' + (resetTipo === 'usuario' ? 'usuario' : 'cliente'))
      return
    }
    setBusy('reset')
    setResetResultado(null)
    try {
      const res: any = await apiPost('/api/seguridad/recuperacion-claves', {
        accion: resetTipo === 'usuario' ? 'reset_usuario' : 'reset_cliente',
        [resetTipo === 'usuario' ? 'usuarioId' : 'clienteId']: resetId.trim(),
        enviarNotificacion: resetNotificar,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(res.mensaje || 'Clave restablecida')
        setResetResultado(res.data)
        setRefreshKey((k) => k + 1)
        setResetId('')
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const guardarDestinatarios = async () => {
    setBusy('destinatarios')
    try {
      const res: any = await apiPost('/api/seguridad/recuperacion-claves', {
        accion: 'config_destinatarios',
        destinatarios,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Destinatarios actualizados')
        setRefreshKey((k) => k + 1)
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const agregarDest = () => {
    if (!nuevoDest.destino.trim()) {
      toast.error('Ingresa el destino (correo o teléfono)')
      return
    }
    if (destinatarios.some((d) => d.destino === nuevoDest.destino)) {
      toast.error('Ese destinatario ya está en la lista')
      return
    }
    setDestinatarios([...destinatarios, { ...nuevoDest, nombre: nuevoDest.nombre || nuevoDest.destino }])
    setNuevoDest({ tipo: 'EMAIL', destino: '', nombre: '' })
  }

  const eliminarDest = (idx: number) => {
    setDestinatarios(destinatarios.filter((_, i) => i !== idx))
  }

  // === Credenciales activas ===
  // Carga la lista de usuarios y clientes con su estado (activo/bloqueado)
  const cargarCredenciales = async () => {
    setLoadingCred(true)
    try {
      const res = await fetch('/api/seguridad/credenciales-activas', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setCredenciales(json.data || [])
      } else {
        toast.error(json.error || 'No se pudieron cargar las credenciales')
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setLoadingCred(false)
    }
  }

  // Cargar credenciales al montar el componente y cuando cambie el refreshKey
  useEffect(() => {
    cargarCredenciales()
  }, [refreshKey])

  // Bloquear o desbloquear un usuario/cliente
  const toggleBloqueo = async (cred: CredencialActiva) => {
    if (cred.rol === 'ADMIN' && cred.activo) {
      toast.error('No se puede bloquear a un administrador desde aquí')
      return
    }
    const accion = cred.activo ? 'bloquear' : 'desbloquear'
    if (!confirm(`¿Confirmas ${accion} a "${cred.nombre}" (${cred.identificador})?`)) return
    setBloqueando(cred.id)
    try {
      const res: any = await apiPost('/api/seguridad/credenciales-activas', {
        accion,
        tipo: cred.tipo,
        id: cred.id,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(res.mensaje || `Cuenta ${accion}da correctamente`)
        // Actualizar la lista localmente
        setCredenciales((prev) =>
          prev.map((c) => (c.id === cred.id ? { ...c, activo: !c.activo } : c))
        )
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setBloqueando(null)
    }
  }

  const historial = data?.historial || []
  const stats = data?.stats || { totalSolicitudes: 0, exitosas: 0, fallidas: 0, porMetodo: { EMAIL: 0, WHATSAPP: 0 } }
  const destinatariosList = destinatarios || []

  const historialFiltrado = historial.filter((h) => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return true
    return (
      h.usuarioNombre.toLowerCase().includes(q) ||
      h.username.toLowerCase().includes(q) ||
      h.destinatario.toLowerCase().includes(q) ||
      h.metodo.toLowerCase().includes(q)
    )
  })

  return (
    <Card>
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Centro de Recuperación de Claves</h2>
              <p className="text-sm text-slate-500">
                Automatiza el restablecimiento de credenciales para usuarios del sistema y clientes del portal.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Total solicitudes</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalSolicitudes}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-xs text-emerald-700">Exitosas</p>
            <p className="text-xl font-bold text-emerald-700">{stats.exitosas}</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-700">Fallidas</p>
            <p className="text-xl font-bold text-red-700">{stats.fallidas}</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-700">Por WhatsApp</p>
            <p className="text-xl font-bold text-blue-700">{stats.porMetodo?.WHATSAPP || 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4 flex gap-2 border-b border-slate-200 flex-wrap">
        <button
          onClick={() => setTab('credenciales')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'credenciales'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4 inline mr-1.5" />
          Credenciales activas
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'historial'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4 inline mr-1.5" />
          Historial
        </button>
        <button
          onClick={() => setTab('reset')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'reset'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCog className="w-4 h-4 inline mr-1.5" />
          Reset manual
        </button>
        <button
          onClick={() => setTab('destinatarios')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'destinatarios'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="w-4 h-4 inline mr-1.5" />
          Destinatarios
        </button>
      </div>

      {/* Contenido de tabs */}
      <div className="p-5">
        {tab === 'credenciales' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Credenciales activas del sistema</h3>
                <p className="text-xs text-slate-500">
                  Lista en tiempo real de todos los usuarios internos y clientes del portal con sus credenciales.
                  Puedes bloquear o desbloquear cualquiera desde aquí.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={cargarCredenciales}
                disabled={loadingCred}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingCred ? 'animate-spin' : ''}`} />
                Refrescar
              </Button>
            </div>

            {loadingCred ? (
              <LoadingState />
            ) : credenciales.length === 0 ? (
              <EmptyState icon={KeyRound} title="No hay credenciales para mostrar" />
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {credenciales.map((cred) => (
                  <div
                    key={`${cred.tipo}-${cred.id}`}
                    className={`rounded-lg border p-3 transition-shadow hover:shadow-sm ${
                      cred.activo
                        ? 'border-slate-200 bg-white'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cred.tipo === 'CLIENTE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {cred.tipo === 'CLIENTE' ? <Users className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                            {cred.tipo}
                          </span>
                          {cred.rol && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                              {cred.rol}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cred.activo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {cred.activo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {cred.activo ? 'Activo' : 'Bloqueado'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{cred.nombre}</p>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{cred.identificador}</span>
                          {cred.email && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {cred.email}
                              </span>
                            </>
                          )}
                          {cred.telefono && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {cred.telefono}
                              </span>
                            </>
                          )}
                          {cred.ultimoAcceso && (
                            <>
                              <span>·</span>
                              <span>Último acceso: {new Date(cred.ultimoAcceso).toLocaleString('es-CO')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={cred.activo ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() => toggleBloqueo(cred)}
                        disabled={bloqueando === cred.id || (cred.rol === 'ADMIN' && cred.activo)}
                        title={cred.rol === 'ADMIN' && cred.activo ? 'No se puede bloquear a un administrador' : ''}
                      >
                        {bloqueando === cred.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : cred.activo ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5" />
                        )}
                        {cred.activo ? 'Bloquear' : 'Desbloquear'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'historial' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por usuario, destino, método..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="flex-1"
              />
            </div>

            {loading ? (
              <LoadingState />
            ) : !historialFiltrado.length ? (
              <EmptyState icon={History} title="Sin registros de recuperación" />
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {historialFiltrado.map((h, i) => (
                  <div
                    key={`${h.id}-${i}`}
                    className="rounded-lg border border-slate-200 bg-white p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.tipo === 'CLIENTE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {h.tipo === 'CLIENTE' ? <Users className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                            {h.tipo}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.exito
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {h.exito ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {h.exito ? 'Enviado' : 'Falló'}
                          </span>
                          {h.origen === 'ADMIN_RESET' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              <Key className="w-3 h-3" />
                              Reset admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {h.usuarioNombre || h.username || '—'}
                        </p>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          {h.metodo && (
                            <span className="inline-flex items-center gap-1">
                              {h.metodo === 'EMAIL' ? <Mail className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                              {h.destinatario || h.metodo}
                            </span>
                          )}
                          <span>·</span>
                          <span>{new Date(h.fecha).toLocaleString('es-CO')}</span>
                          {h.ip && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{h.ip}</span>
                            </>
                          )}
                        </div>
                        {h.detalles && h.detalles.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                              Ver detalles del envío ({h.detalles.length})
                            </summary>
                            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 ml-4 list-disc">
                              {h.detalles.map((d, j) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reset' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              <p className="font-medium mb-1">Reset manual de credenciales</p>
              <p className="text-xs text-blue-800">
                Genera una nueva contraseña temporal y la envía a los destinatarios configurados.
                Si es un cliente, la nueva clave se envía por WhatsApp directamente a su teléfono.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setResetTipo('usuario')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  resetTipo === 'usuario'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <UserCog className="w-4 h-4" />
                <span className="text-sm font-medium">Usuario del sistema</span>
              </button>
              <button
                onClick={() => setResetTipo('cliente')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  resetTipo === 'cliente'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Cliente del portal</span>
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                ID del {resetTipo === 'usuario' ? 'usuario' : 'cliente'} (cuid)
              </Label>
              <Input
                placeholder={resetTipo === 'usuario' ? 'clr_xxxxxxxx' : 'clr_xxxxxxxx'}
                value={resetId}
                onChange={(e) => setResetId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Copia el ID desde el módulo de {resetTipo === 'usuario' ? 'Usuarios' : 'Clientes'}.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Enviar notificación</p>
                  <p className="text-xs text-slate-500">
                    {resetTipo === 'usuario'
                      ? 'A los destinatarios configurados (jsa@jsadr.com.co, jsadr23@outlook.com, WhatsApp 3235949510)'
                      : 'Al WhatsApp del cliente directamente'}
                  </p>
                </div>
              </div>
              <Switch checked={resetNotificar} onCheckedChange={setResetNotificar} />
            </div>

            <Button
              onClick={ejecutarReset}
              disabled={busy === 'reset' || !resetId.trim()}
              className="w-full"
            >
              {busy === 'reset' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              Restablecer clave
            </Button>

            {resetResultado && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-emerald-900">Operación completada</p>
                    {resetResultado.usuario && (
                      <p className="text-emerald-800 mt-1">
                        Usuario: <strong>{resetResultado.usuario.nombre}</strong> (@{resetResultado.usuario.username})
                      </p>
                    )}
                    {resetResultado.cliente && (
                      <p className="text-emerald-800 mt-1">
                        Cliente: <strong>{resetResultado.cliente.nombre}</strong> (CC {resetResultado.cliente.cedula})
                      </p>
                    )}
                    {resetResultado.nuevaClave && (
                      <div className="mt-2 p-2 rounded bg-white border border-emerald-200">
                        <p className="text-xs text-emerald-700 mb-0.5">Nueva clave temporal (guárdala):</p>
                        <p className="font-mono font-bold text-emerald-900">{resetResultado.nuevaClave}</p>
                      </div>
                    )}
                    {resetResultado.envio && (
                      <p className="text-xs text-emerald-700 mt-2">
                        Envío: {resetResultado.envio.metodo} → {resetResultado.envio.destinatarioUsado}
                        {resetResultado.envio.linkWaMe && (
                          <>
                            {' '}
                            · <a href={resetResultado.envio.linkWaMe} target="_blank" rel="noopener noreferrer" className="underline font-medium">Abrir WhatsApp</a>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'destinatarios' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
              <p className="font-medium mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Configuración de destinatarios
              </p>
              <p className="text-xs text-amber-800">
                Estos son los canales donde se envían las credenciales cuando un usuario olvida su clave.
                El sistema intenta cada destinatario en orden hasta que uno funcione.
              </p>
            </div>

            <div className="space-y-2">
              {destinatariosList.map((d, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    d.tipo === 'EMAIL' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {d.tipo === 'EMAIL' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{d.destino}</p>
                    <p className="text-xs text-slate-500">
                      {d.nombre} · {d.tipo} · Prioridad #{idx + 1}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarDest(idx)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!destinatariosList.length && (
                <EmptyState icon={Mail} title="Sin destinatarios configurados" />
              )}
            </div>

            {/* Agregar nuevo */}
            <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Agregar nuevo destinatario</p>
              <div className="grid grid-cols-12 gap-2">
                <select
                  value={nuevoDest.tipo}
                  onChange={(e) => setNuevoDest({ ...nuevoDest, tipo: e.target.value })}
                  className="col-span-3 px-2 py-2 rounded-md border border-slate-300 text-sm bg-white"
                >
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                <Input
                  placeholder={nuevoDest.tipo === 'EMAIL' ? 'correo@dominio.com' : '3001234567'}
                  value={nuevoDest.destino}
                  onChange={(e) => setNuevoDest({ ...nuevoDest, destino: e.target.value })}
                  className="col-span-5"
                />
                <Input
                  placeholder="Nombre (opcional)"
                  value={nuevoDest.nombre}
                  onChange={(e) => setNuevoDest({ ...nuevoDest, nombre: e.target.value })}
                  className="col-span-3"
                />
                <Button
                  onClick={agregarDest}
                  variant="outline"
                  className="col-span-1"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={guardarDestinatarios}
              disabled={busy === 'destinatarios'}
              className="w-full"
            >
              {busy === 'destinatarios' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar configuración
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// =====================================================
// ValidadorFirmaPanel — Validador de código de firma
// -----------------------------------------------------
// Permite a ADMIN y GESTOR pegar el código que aparece
// en el QR del certificado de firma electrónica para
// verificar si el documento es auténtico o si fue
// modificado/falsificado.
// =====================================================

function ValidadorFirmaPanel() {
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const validar = async () => {
    const cod = codigo.trim()
    if (!cod) {
      toast.error('Ingresa el código a validar')
      return
    }
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch(`/api/seguridad/validar-firma?codigo=${encodeURIComponent(cod)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      setResultado(json)
      if (json.valido) {
        toast.success('Código VÁLIDO — el documento es auténtico')
      } else {
        toast.error(json.error || 'Código no válido o modificado')
      }
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const limpiar = () => {
    setCodigo('')
    setResultado(null)
  }

  return (
    <Card>
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Validador de Firma Electrónica</h2>
            <p className="text-sm text-slate-500">
              Verifica si un código de firma (el del QR del certificado) es auténtico o si fue modificado. Evita la falsificación de documentos.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Input + botón */}
        <div className="flex gap-2 flex-col sm:flex-row">
          <Input
            placeholder="Pega el código (formato: XXXX-XXXX-XXXX-XXXX)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) validar()
            }}
            className="flex-1 font-mono"
            disabled={loading}
          />
          <Button onClick={validar} disabled={loading || !codigo.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Validar
          </Button>
          {resultado && (
            <Button variant="outline" onClick={limpiar} disabled={loading}>
              Limpiar
            </Button>
          )}
        </div>

        {/* Resultado */}
        {resultado && (
          <div
            className={`rounded-lg border p-4 ${
              resultado.valido
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {resultado.valido ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    resultado.valido ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {resultado.valido ? 'DOCUMENTO AUTÉNTICO' : 'DOCUMENTO NO VÁLIDO'}
                </p>
                <p className="text-xs text-slate-600 mt-1">{resultado.mensaje || resultado.error}</p>

                {resultado.data && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {resultado.data.deudor && (
                      <div>
                        <span className="text-slate-500">Deudor:</span>{' '}
                        <span className="font-semibold text-slate-900">{resultado.data.deudor}</span>
                      </div>
                    )}
                    {resultado.data.cedula && (
                      <div>
                        <span className="text-slate-500">Cédula:</span>{' '}
                        <span className="font-mono font-semibold text-slate-900">{resultado.data.cedula}</span>
                      </div>
                    )}
                    {resultado.data.codigoPrestamo && (
                      <div>
                        <span className="text-slate-500">Préstamo:</span>{' '}
                        <span className="font-mono font-semibold text-slate-900">{resultado.data.codigoPrestamo}</span>
                      </div>
                    )}
                    {resultado.data.monto !== null && resultado.data.monto !== undefined && (
                      <div>
                        <span className="text-slate-500">Monto:</span>{' '}
                        <span className="font-semibold text-slate-900">
                          ${Number(resultado.data.monto).toLocaleString('es-CO')}
                        </span>
                      </div>
                    )}
                    {resultado.data.fechaFirma && (
                      <div>
                        <span className="text-slate-500">Fecha firma:</span>{' '}
                        <span className="font-semibold text-slate-900">
                          {new Date(resultado.data.fechaFirma).toLocaleString('es-CO')}
                        </span>
                      </div>
                    )}
                    {resultado.data.canalOTP && (
                      <div>
                        <span className="text-slate-500">Canal OTP:</span>{' '}
                        <span className="font-semibold text-slate-900">{resultado.data.canalOTP}</span>
                      </div>
                    )}
                    {resultado.data.ipFirma && (
                      <div>
                        <span className="text-slate-500">IP firma:</span>{' '}
                        <span className="font-mono font-semibold text-slate-900">{resultado.data.ipFirma}</span>
                      </div>
                    )}
                    {resultado.data.firmaId && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">ID firma:</span>{' '}
                        <span className="font-mono text-[10px] text-slate-700">{resultado.data.firmaId}</span>
                      </div>
                    )}
                    {resultado.data.hashCompleto && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">Hash SHA-256 completo:</span>{' '}
                        <span className="font-mono text-[10px] text-slate-700 break-all">{resultado.data.hashCompleto}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Información de ayuda */}
        {!resultado && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">¿Cómo usar el validador?</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Abre el certificado de firma electrónica del pagaré.</li>
              <li>Copia el código de verificación (formato XXXX-XXXX-XXXX-XXXX) que aparece junto al QR.</li>
              <li>Pégalo arriba y presiona <strong>Validar</strong>.</li>
              <li>El sistema verificará si el código coincide con una firma registrada o si fue modificado.</li>
            </ol>
          </div>
        )}
      </div>
    </Card>
  )
}

// =====================================================
// SECCIÓN 5: Historial de Ingresos al Portal del Cliente
// Muestra IP + tipo de dispositivo + usuario + fecha de
// cada ingreso al portal. Vive únicamente dentro del
// módulo de Seguridad (no accesible desde otros módulos).
// =====================================================
interface AccesoPortalItem {
  id: string
  clienteId: string | null
  clienteCedula: string | null
  clienteNombre: string | null
  ipOrigen: string | null
  userAgent: string | null
  accion: string
  exito: boolean
  detalle: string | null
  metadata: string | null
  createdAt: string
}

interface AccesosData {
  accesos: AccesoPortalItem[]
  kpis: {
    totalRegistros: number
    totalHoy: number
    intentosFallidosHoy: number
    loginsExitososHoy: number
    clientesUnicosHoy: number
    clientesUnicosRango: number
    intentosFallidosRango: number
  }
  resumen: {
    topClientes: {
      clienteCedula: string | null
      clienteNombre: string | null
      _count: number
    }[]
    porAccion: { accion: string; _count: number }[]
    porDia: { fecha: string; logins: number; consultas: number; fallidos: number }[]
    porDispositivo: { name: string; value: number }[]
  }
}

const DIAS_HISTORIAL = [1, 7, 15, 30, 90]

const ACCION_LABELS_SEG: Record<string, string> = {
  LOGIN: 'Ingreso',
  CONSULTA: 'Consulta',
  INTENTO_FALLIDO: 'Intento fallido',
  INTENTO_FALLIDO_CLAVE: 'Intento fallido (clave)',
  LOGOUT: 'Cierre de sesión',
  CAMBIO_PIN: 'Cambio de PIN',
  CAMBIO_CLAVE: 'Cambio de clave',
  VERIFICAR_CEDULA: 'Verificación de cédula',
  VERIFICAR_CEDULA_CLAVE: 'Verificación de cédula (clave)',
  CREAR_PIN: 'Creación de PIN',
  PIN_EXPIRADO: 'PIN expirado',
  CLAVE_EXPIRADA: 'Clave expirada',
}

function parsearDispositivoSeg(ua: string): { tipo: string; color: string } {
  const u = (ua || '').toLowerCase()
  if (/ipad|tablet/.test(u)) return { tipo: 'Tablet', color: 'text-amber-600' }
  if (/mobile|android|iphone|ipod/.test(u)) return { tipo: 'Móvil', color: 'text-violet-600' }
  if (/windows|macintosh|linux|cros/.test(u)) return { tipo: 'Escritorio', color: 'text-emerald-600' }
  if (/bot|crawler|spider/.test(u)) return { tipo: 'Bot', color: 'text-red-600' }
  return { tipo: 'Otro', color: 'text-slate-500' }
}

function parsearNavegadorSeg(ua: string): string {
  const u = ua || ''
  if (/edg\//i.test(u)) return 'Edge'
  if (/opr\/|opera/i.test(u)) return 'Opera'
  if (/chrome|crios/i.test(u)) return 'Chrome'
  if (/firefox|fxios/i.test(u)) return 'Firefox'
  if (/safari/i.test(u)) return 'Safari'
  return '—'
}

function parsearSOsSeg(ua: string): string {
  const u = ua || ''
  if (/windows nt 10/i.test(u)) return 'Windows 10/11'
  if (/windows nt/i.test(u)) return 'Windows'
  if (/android/i.test(u)) return 'Android'
  if (/iphone|ipad|ios/i.test(u)) return 'iOS'
  if (/mac os x|macintosh/i.test(u)) return 'macOS'
  if (/linux/i.test(u)) return 'Linux'
  return '—'
}

function HistorialIngresosPortalPanel() {
  const [data, setData] = useState<AccesosData | null>(null)
  const [dias, setDias] = useState(7)
  const [loading, setLoading] = useState(true)
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroAccion, setFiltroAccion] = useState<string>('TODAS')
  const [soloExitosos, setSoloExitosos] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/accesos-portal?dias=${dias}&limit=500`)
      const json = await res.json()
      if (json.success) {
        setData({
          accesos: json.data,
          kpis: json.kpis,
          resumen: json.resumen,
        })
      } else {
        toast.error(json.error || 'Error al cargar historial')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [dias])

  // Filtrado en memoria (búsqueda por cédula / nombre / IP)
  const accesosFiltrados = (data?.accesos || []).filter((a) => {
    if (filtroAccion !== 'TODAS' && a.accion !== filtroAccion) return false
    if (soloExitosos && !a.exito) return false
    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.trim().toLowerCase()
      const txt = `${a.clienteCedula || ''} ${a.clienteNombre || ''} ${a.ipOrigen || ''}`.toLowerCase()
      if (!txt.includes(q)) return false
    }
    return true
  })

  // Top dispositivos para los KPIs
  const totalMovil = (data?.resumen.porDispositivo || []).find((d) => d.name === 'Móvil')?.value || 0
  const totalEscritorio = (data?.resumen.porDispositivo || []).find((d) => d.name === 'Escritorio')?.value || 0
  const totalTablet = (data?.resumen.porDispositivo || []).find((d) => d.name === 'Tablet')?.value || 0

  return (
    <Card className="glass-card">
      <div className="p-5 border-b border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Historial de Ingresos al Portal del Cliente
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Registro automático de IP y dispositivo cada vez que un cliente ingresa al portal.
              Información confidencial — visible únicamente desde el módulo de Seguridad.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Periodo:</span>
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
              {DIAS_HISTORIAL.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={dias === d ? 'default' : 'ghost'}
                  onClick={() => setDias(d)}
                  className={`h-7 px-3 text-xs ${
                    dias === d
                      ? 'gradient-primary text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d === 1 ? 'Hoy' : `${d}d`}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={cargar}
              disabled={loading}
              className="h-7"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-white/10">
        <KPIBox
          label="Ingresos exitosos hoy"
          value={data?.kpis.loginsExitososHoy ?? 0}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="text-emerald-600"
        />
        <KPIBox
          label="Intentos fallidos hoy"
          value={data?.kpis.intentosFallidosHoy ?? 0}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="text-red-600"
        />
        <KPIBox
          label="Clientes únicos (rango)"
          value={data?.kpis.clientesUnicosRango ?? 0}
          icon={<Users className="w-4 h-4" />}
          color="text-violet-600"
        />
        <KPIBox
          label="Registros totales"
          value={data?.kpis.totalRegistros ?? 0}
          icon={<Clock className="w-4 h-4" />}
          color="text-slate-600"
        />
      </div>

      {/* Desglose por dispositivo */}
      <div className="grid grid-cols-3 gap-3 p-5 border-b border-white/10">
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-center">
          <div className="text-2xl font-bold text-violet-700">{totalMovil}</div>
          <div className="text-xs text-violet-600 mt-0.5">Móvil</div>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{totalEscritorio}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Escritorio</div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{totalTablet}</div>
          <div className="text-xs text-amber-600 mt-0.5">Tablet</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 border-b border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Input
          placeholder="Buscar por cédula, nombre o IP..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="h-9 text-sm"
        />
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="h-9 text-sm rounded-md border border-input bg-background px-2"
        >
          <option value="TODAS">Todas las acciones</option>
          {Object.entries(ACCION_LABELS_SEG).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={soloExitosos} onCheckedChange={setSoloExitosos} />
          Solo exitosos
        </label>
        <div className="text-xs text-muted-foreground text-right self-center">
          Mostrando {accesosFiltrados.length} de {data?.accesos.length || 0} registros
        </div>
      </div>

      {/* Tabla de accesos */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Cargando historial de ingresos...</p>
          </div>
        ) : accesosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No hay registros para los filtros seleccionados.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr>
                <th className="text-left font-medium p-2 text-muted-foreground">Fecha y hora</th>
                <th className="text-left font-medium p-2 text-muted-foreground">Cliente</th>
                <th className="text-left font-medium p-2 text-muted-foreground">Acción</th>
                <th className="text-left font-medium p-2 text-muted-foreground">IP</th>
                <th className="text-left font-medium p-2 text-muted-foreground">Dispositivo</th>
                <th className="text-left font-medium p-2 text-muted-foreground">SO / Navegador</th>
                <th className="text-left font-medium p-2 text-muted-foreground">Estado</th>
                <th className="text-left font-medium p-2 text-muted-foreground">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {accesosFiltrados.map((a) => {
                const disp = parsearDispositivoSeg(a.userAgent || '')
                const so = parsearSOsSeg(a.userAgent || '')
                const nav = parsearNavegadorSeg(a.userAgent || '')
                return (
                  <tr key={a.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString('es-CO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="font-medium">{a.clienteNombre || '—'}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {a.clienteCedula ? `CC ${a.clienteCedula}` : 'Anónimo'}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <Badge
                        variant="neutral"
                        className="text-[10px] bg-slate-100/70 border-slate-200"
                      >
                        {ACCION_LABELS_SEG[a.accion] || a.accion}
                      </Badge>
                    </td>
                    <td className="p-2 whitespace-nowrap font-mono text-[10px]">
                      {a.ipOrigen || '—'}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 ${disp.color}`}>
                        {disp.tipo}
                      </span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      <div>{so}</div>
                      <div className="text-[10px] opacity-70">{nav}</div>
                    </td>
                    <td className="p-2">
                      {a.exito ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-[10px]">
                          <XCircle className="w-3 h-3" /> Falló
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-[10px] max-w-[200px] truncate">
                      {a.detalle || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Aviso de privacidad */}
      <div className="p-4 border-t border-white/10 bg-blue-50/50 rounded-b-lg">
        <div className="flex items-start gap-2 text-xs text-blue-800">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Uso confidencial</p>
            <p className="mt-0.5">
              Este registro se almacena automáticamente con fines de seguridad y trazabilidad.
              Cada vez que un cliente ingresa al portal, el sistema identifica la IP de origen
              y el tipo de dispositivo, preservando la integridad de la información del cliente.
              Solo el equipo autorizado con acceso al módulo de Seguridad puede consultar este historial.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

function KPIBox({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
