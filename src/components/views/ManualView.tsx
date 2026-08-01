'use client'

// =====================================================
// ManualView — Manual automático (Módulo 8)
// Se genera en tiempo real leyendo:
//   - src/components/views/*.tsx (componentes y comentarios)
//   - src/app/api/**/route.ts   (endpoints)
//   - prisma/schema.prisma      (modelos)
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  RefreshCw,
  Database,
  Code2,
  Boxes,
  Search,
  ChevronDown,
  ChevronRight,
  FileCode,
  Webhook,
} from 'lucide-react'

interface ComponentInfo {
  archivo: string
  nombre: string
  descripcion: string | null
  esClient: boolean
}

interface EndpointInfo {
  ruta: string
  metodos: string[]
  descripcion: string | null
  archivo: string
}

interface ModeloInfo {
  nombre: string
  campos: { nombre: string; tipo: string; extras?: string }[]
  comentario: string | null
}

interface ManualData {
  generadoEn: string
  version: string
  componentes: ComponentInfo[]
  endpoints: EndpointInfo[]
  modelos: ModeloInfo[]
  resumen: {
    totalComponentes: number
    totalEndpoints: number
    totalModelos: number
    totalArchivosApi: number
  }
}

const METODO_COLOR: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  POST: 'bg-blue-500/15 text-blue-700 border-blue-300',
  PUT: 'bg-amber-500/15 text-amber-700 border-amber-300',
  PATCH: 'bg-violet-500/15 text-violet-700 border-violet-300',
  DELETE: 'bg-red-500/15 text-red-700 border-red-300',
}

export function ManualView() {
  const [data, setData] = useState<ManualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seccion, setSeccion] = useState<'componentes' | 'endpoints' | 'modelos'>('componentes')
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/manual', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const toggleExpand = (key: string) => {
    setExpandido((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const filtrar = (texto: string) => {
    if (!busqueda) return true
    return texto.toLowerCase().includes(busqueda.toLowerCase())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual del Sistema (Auto-generado)"
        subtitle="Generado automáticamente en tiempo real leyendo el código fuente, APIs y esquema de BD"
        icon={<BookOpen className="w-5 h-5" />}
        actions={
          <Button variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Regenerar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Boxes className="w-6 h-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{data?.resumen.totalComponentes ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Componentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Webhook className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{data?.resumen.totalEndpoints ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Endpoints API</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Database className="w-6 h-6 mx-auto text-violet-600 mb-1" />
            <p className="text-2xl font-bold">{data?.resumen.totalModelos ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Modelos BD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Code2 className="w-6 h-6 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{data?.version ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Versión</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en componentes, endpoints o modelos..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                variant={seccion === 'componentes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeccion('componentes')}
              >
                <Boxes className="w-3.5 h-3.5 mr-1.5" />
                Componentes
              </Button>
              <Button
                variant={seccion === 'endpoints' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeccion('endpoints')}
              >
                <Webhook className="w-3.5 h-3.5 mr-1.5" />
                Endpoints
              </Button>
              <Button
                variant={seccion === 'modelos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeccion('modelos')}
              >
                <Database className="w-3.5 h-3.5 mr-1.5" />
                Modelos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
            Generando manual desde el código fuente...
          </CardContent>
        </Card>
      )}

      {/* === Sección Componentes === */}
      {data && seccion === 'componentes' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="w-4 h-4" />
              Componentes ({data.componentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
            {data.componentes
              .filter(
                (c) =>
                  filtrar(c.nombre) ||
                  filtrar(c.archivo) ||
                  (c.descripcion && filtrar(c.descripcion))
              )
              .map((c, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="flex items-start gap-2">
                    <FileCode className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-semibold">{c.nombre}</code>
                        {c.esClient && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                            client
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.archivo}</div>
                      {c.descripcion && (
                        <div className="text-xs text-muted-foreground mt-1">{c.descripcion}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* === Sección Endpoints === */}
      {data && seccion === 'endpoints' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Endpoints API ({data.endpoints.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
            {data.endpoints
              .filter(
                (e) =>
                  filtrar(e.ruta) ||
                  filtrar(e.archivo) ||
                  (e.descripcion && filtrar(e.descripcion))
              )
              .map((e, i) => (
                <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex gap-1 shrink-0">
                      {e.metodos.map((m) => (
                        <Badge
                          key={m}
                          variant="outline"
                          className={`text-[10px] font-mono ${METODO_COLOR[m] || ''}`}
                        >
                          {m}
                        </Badge>
                      ))}
                    </div>
                    <code className="text-sm font-mono font-semibold flex-1">{e.ruta}</code>
                  </div>
                  {e.descripcion && (
                    <div className="text-xs text-muted-foreground mt-1 ml-1">{e.descripcion}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1 ml-1">{e.archivo}</div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* === Sección Modelos === */}
      {data && seccion === 'modelos' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Modelos de Base de Datos ({data.modelos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
            {data.modelos
              .filter(
                (m) =>
                  filtrar(m.nombre) ||
                  m.campos.some((c) => filtrar(c.nombre) || filtrar(c.tipo)) ||
                  (m.comentario && filtrar(m.comentario))
              )
              .map((m) => {
                const key = m.nombre
                const exp = expandido[key] ?? false
                return (
                  <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02]">
                    <button
                      onClick={() => toggleExpand(key)}
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/[0.03] rounded-t-lg"
                    >
                      {exp ? (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      )}
                      <Database className="w-4 h-4 shrink-0 text-violet-600" />
                      <code className="text-sm font-mono font-semibold">{m.nombre}</code>
                      <Badge variant="outline" className="text-[10px] ml-1">
                        {m.campos.length} campos
                      </Badge>
                    </button>
                    {exp && (
                      <div className="px-3 pb-3 space-y-2">
                        {m.comentario && (
                          <div className="text-xs text-muted-foreground italic">{m.comentario}</div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs font-mono">
                            <tbody>
                              {m.campos.map((c, idx) => (
                                <tr key={idx} className="border-b border-white/5">
                                  <td className="py-1 pr-3 font-semibold text-foreground">{c.nombre}</td>
                                  <td className="py-1 pr-3 text-cyan-700">{c.tipo}</td>
                                  <td className="py-1 text-muted-foreground">{c.extras || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {data && (
        <Card className="border-primary/20">
          <CardContent className="p-5 text-center text-xs text-muted-foreground">
            <p>
              <strong>Manual generado automáticamente</strong> — {data.version} ·{' '}
              {new Date(data.generadoEn).toLocaleString('es-CO')}
            </p>
            <p className="mt-1">
              Este manual se actualiza cada vez que recargas la página, reflejando el estado
              actual del código, las APIs y el esquema de base de datos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
