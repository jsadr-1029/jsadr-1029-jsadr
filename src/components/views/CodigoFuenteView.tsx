'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  RefreshCw,
  Copy,
  Check,
  Search,
  Clock,
  Hash,
  HardDrive,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react'
import { sanitizeHtmlForHighlight } from '@/lib/sanitize'
import { useToast } from '@/hooks/use-toast'
import hljs from 'highlight.js/lib/core'

// Lenguajes soportados (registrados on-demand)
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('plaintext', plaintext)

interface ArchivoInfo {
  nombre: string
  ruta: string
  esDirectorio: boolean
  tamano?: number
  modificado?: string
  extension?: string
}

interface ArchivoContenido {
  success: boolean
  tipo: 'archivo'
  ruta: string
  nombre: string
  extension: string
  contenido: string
  lineas: number
  tamano: number
  modificado: string
  error?: string
}

interface DirectorioResp {
  success: boolean
  tipo: 'directorio'
  ruta: string
  archivos: ArchivoInfo[]
}

// Mapa de iconos por extensión
function getIconoArchivo(nombre: string, esDir: boolean) {
  if (esDir) return Folder
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext === 'ts' || ext === 'tsx') return FileCode
  if (ext === 'js' || ext === 'jsx' || ext === 'cjs' || ext === 'mjs') return FileCode
  if (ext === 'json') return FileJson
  if (ext === 'md' || ext === 'txt') return FileText
  if (ext === 'prisma') return FileCode
  if (ext === 'css') return FileCode
  if (ext === 'env' || nombre.startsWith('.env')) return FileText
  return File
}

// Color por extensión
function getColorArchivo(nombre: string, esDir: boolean): string {
  if (esDir) return 'text-blue-600'
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext === 'ts' || ext === 'tsx') return 'text-blue-500'
  if (ext === 'js' || ext === 'jsx' || ext === 'cjs' || ext === 'mjs') return 'text-yellow-500'
  if (ext === 'json') return 'text-green-500'
  if (ext === 'md') return 'text-gray-500'
  if (ext === 'prisma') return 'text-indigo-500'
  if (ext === 'css') return 'text-pink-500'
  if (ext === 'sh') return 'text-green-600'
  return 'text-gray-500'
}

// Lenguaje para highlight.js según extensión
function getLenguaje(extension: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    cjs: 'javascript',
    mjs: 'javascript',
    json: 'json',
    sh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    html: 'xml',
    xml: 'xml',
    css: 'css',
    md: 'markdown',
    txt: 'plaintext',
    env: 'plaintext',
    prisma: 'plaintext', // no hay highlight nativo para prisma
    toml: 'plaintext',
  }
  return map[extension] || 'plaintext'
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

export function CodigoFuenteView() {
  const [arbolDirectorios, setArbolDirectorios] = useState<Record<string, ArchivoInfo[]>>({})
  const [directoriosAbiertos, setDirectoriosAbiertos] = useState<Set<string>>(new Set(['/']))
  const [archivoActual, setArchivoActual] = useState<ArchivoContenido | null>(null)
  const [rutaArchivoActual, setRutaArchivoActual] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingArchivo, setLoadingArchivo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [ultimoRefresh, setUltimoRefresh] = useState<Date>(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // Cargar directorio raíz al iniciar
  useEffect(() => {
    cargarDirectorio('/')
  }, [])

  // Auto-refresh del archivo actual cada 5 segundos
  useEffect(() => {
    if (!autoRefresh || !rutaArchivoActual) return
    intervalRef.current = setInterval(() => {
      cargarArchivo(rutaArchivoActual, true)
      setUltimoRefresh(new Date())
    }, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, rutaArchivoActual])

  const cargarDirectorio = useCallback(async (ruta: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/codigo-fuente?ruta=${encodeURIComponent(ruta === '/' ? '' : ruta)}`)
      const json: DirectorioResp = await res.json()
      if (json.success) {
        setArbolDirectorios((prev) => ({ ...prev, [ruta]: json.archivos }))
      } else {
        toast({ title: 'Error', description: 'No se pudo cargar el directorio', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const cargarArchivo = useCallback(async (ruta: string, silencioso = false) => {
    try {
      if (!silencioso) setLoadingArchivo(true)
      const res = await fetch(`/api/codigo-fuente?ruta=${encodeURIComponent(ruta)}`)
      const json: ArchivoContenido = await res.json()
      if (json.success) {
        setArchivoActual(json)
        setRutaArchivoActual(ruta)
        if (!silencioso) setUltimoRefresh(new Date())
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudo cargar', variant: 'destructive' })
      }
    } catch (e: any) {
      if (!silencioso) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' })
      }
    } finally {
      if (!silencioso) setLoadingArchivo(false)
    }
  }, [toast])

  const toggleDirectorio = (ruta: string) => {
    setDirectoriosAbiertos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(ruta)) {
        nuevo.delete(ruta)
      } else {
        nuevo.add(ruta)
        if (!arbolDirectorios[ruta]) {
          cargarDirectorio(ruta)
        }
      }
      return nuevo
    })
  }

  const copiarContenido = async () => {
    if (!archivoActual) return
    try {
      await navigator.clipboard.writeText(archivoActual.contenido)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
      toast({ title: 'Copiado', description: `${archivoActual.lineas} líneas copiadas al portapapeles` })
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  const refreshManual = async () => {
    if (rutaArchivoActual) {
      await cargarArchivo(rutaArchivoActual)
      setUltimoRefresh(new Date())
    }
  }

  // Render del árbol de directorios recursivo
  const renderDirectorio = (ruta: string, nivel: number = 0) => {
    const items = arbolDirectorios[ruta]
    if (!items) return null

    const itemsFiltrados = busqueda
      ? items.filter((i) => i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      : items

    return (
      <div className="space-y-0.5">
        {itemsFiltrados.map((item) => {
          const Icon = getIconoArchivo(item.nombre, item.esDirectorio)
          const color = getColorArchivo(item.nombre, item.esDirectorio)
          const isOpen = directoriosAbiertos.has(item.ruta)
          const isActivo = rutaArchivoActual === item.ruta

          return (
            <div key={item.ruta}>
              <button
                onClick={() => {
                  if (item.esDirectorio) {
                    toggleDirectorio(item.ruta)
                  } else {
                    cargarArchivo(item.ruta)
                  }
                }}
                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted/60 transition-colors text-left ${
                  isActivo ? 'bg-primary/10 text-primary' : ''
                }`}
                style={{ paddingLeft: `${nivel * 12 + 8}px` }}
                title={item.ruta}
              >
                {item.esDirectorio ? (
                  isOpen ? (
                    <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                <span className="truncate flex-1">{item.nombre}</span>
                {!item.esDirectorio && item.tamano !== undefined && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatearTamano(item.tamano)}
                  </span>
                )}
              </button>
              {item.esDirectorio && isOpen && (
                <div>{renderDirectorio(item.ruta, nivel + 1)}</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Resaltar código con highlight.js
  const codigoResaltado = useMemo(() => {
    if (!archivoActual) return ''
    try {
      const lenguaje = getLenguaje(archivoActual.extension)
      if (lenguaje === 'plaintext' || !hljs.getLanguage(lenguaje)) {
        return archivoActual.contenido
      }
      return hljs.highlight(archivoActual.contenido, { language: lenguaje }).value
    } catch {
      return archivoActual.contenido
    }
  }, [archivoActual])

  // Generar números de línea
  const numerosLinea = useMemo(() => {
    if (!archivoActual) return ''
    const total = archivoActual.lineas
    return Array.from({ length: total }, (_, i) => i + 1).join('\n')
  }, [archivoActual])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Código Fuente del Sistema"
        subtitle="Visor en tiempo real de todos los archivos del proyecto"
        icon={<FileCode className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={autoRefresh ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setAutoRefresh(!autoRefresh)}>
              {autoRefresh ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Badge>
            <Button size="sm" variant="outline" onClick={refreshManual}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Actualizar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Panel izquierdo: árbol de archivos */}
        <Card className="h-[calc(100vh-220px)] overflow-hidden flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar archivo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading && !arbolDirectorios['/'] ? (
              <div className="text-xs text-muted-foreground p-4 text-center">Cargando...</div>
            ) : (
              renderDirectorio('/')
            )}
          </div>
          <div className="p-2 border-t text-[10px] text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              <span>Actualizado: {ultimoRefresh.toLocaleTimeString('es-CO')}</span>
            </div>
            <div className="flex items-center gap-1">
              <FolderOpen className="w-2.5 h-2.5" />
              <span>Proyecto: /home/z/my-project</span>
            </div>
          </div>
        </Card>

        {/* Panel derecho: visor de código */}
        <Card className="h-[calc(100vh-220px)] overflow-hidden flex flex-col">
          {archivoActual ? (
            <>
              {/* Header del archivo */}
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {(() => {
                      const Icon = getIconoArchivo(archivoActual.nombre, false)
                      const color = getColorArchivo(archivoActual.nombre, false)
                      return <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                    })()}
                    <span className="font-mono text-sm font-semibold truncate">
                      {archivoActual.ruta}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={copiarContenido} className="h-7 px-2">
                    {copiado ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-green-600" />
                        <span className="text-xs">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        <span className="text-xs">Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">
                    <Hash className="w-2.5 h-2.5 mr-1" />
                    {archivoActual.lineas} líneas
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <HardDrive className="w-2.5 h-2.5 mr-1" />
                    {formatearTamano(archivoActual.tamano)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {archivoActual.extension || 'txt'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    Modificado: {formatearFecha(archivoActual.modificado)}
                  </Badge>
                  {autoRefresh && (
                    <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                      Auto-refresh 5s
                    </Badge>
                  )}
                </div>
              </div>

              {/* Código con números de línea */}
              <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                <div className="flex">
                  {/* Números de línea */}
                  <pre className="select-none text-right text-xs text-gray-500 py-3 px-3 bg-[#1a1a1a] border-r border-gray-800 sticky left-0">
                    {numerosLinea}
                  </pre>
                  {/* Código */}
                  <pre className="flex-1 text-xs py-3 px-4 overflow-x-auto">
                    <code
                      className="font-mono text-gray-100"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtmlForHighlight(codigoResaltado) }}
                    />
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-3 max-w-md">
                <FileCode className="w-16 h-16 mx-auto text-muted-foreground/40" />
                <div>
                  <h3 className="font-semibold text-lg">Selecciona un archivo</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Navega por el árbol de directorios en el panel izquierdo para ver el contenido
                    de cualquier archivo del proyecto.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-3 border-t">
                  <p>📁 <strong>{Object.keys(arbolDirectorios).length}</strong> directorios cargados</p>
                  <p>⏱️ Auto-refresh cada 5 segundos (cuando un archivo está abierto)</p>
                  <p>🔒 Archivos sensibles (node_modules, .next, .git) están ocultos</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
