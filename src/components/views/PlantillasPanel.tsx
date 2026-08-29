'use client'

// =====================================================
// PlantillasPanel — Gestión de plantillas Email/WhatsApp
// =====================================================
// Componente principal del módulo Administración → Plantillas.
// Permite:
//   - Listar todas las plantillas (con filtros por tipo/categoria)
//   - Editar contenido, asunto, HTML
//   - Activar/desactivar plantillas
//   - Crear nuevas plantillas
//   - Eliminar plantillas (no las del sistema)
//   - Vista previa con variables de ejemplo
//   - Envío de prueba (Email)
// =====================================================

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit,
  Trash2,
  Mail,
  MessageSquare,
  Eye,
  Send,
  Power,
  Copy,
  Search,
} from 'lucide-react'

interface Plantilla {
  id: string
  codigo: string
  nombre: string
  tipo: string
  categoria: string
  descripcion: string | null
  asunto: string | null
  contenido: string
  contenidoHtml: string | null
  variables: string
  sistema: boolean
  activa: boolean
  evento: string | null
  createdAt: string
  updatedAt: string
}

const CATEGORIAS = [
  'SOLICITUDES',
  'PAGOS',
  'FIRMA',
  'SEGURIDAD',
  'JURÍDICO',
  'CLIENTES',
  'GENERAL',
]

export function PlantillasPanel() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Plantilla | null>(null)
  const [modalPreview, setModalPreview] = useState<Plantilla | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    cargar()
  }, [filtroTipo, filtroCategoria])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroTipo !== 'TODOS') params.set('tipo', filtroTipo)
      if (filtroCategoria !== 'TODAS') params.set('categoria', filtroCategoria)
      const res = await fetch(`/api/plantillas?${params.toString()}`)
      const json = await res.json()
      if (json.success) setPlantillas(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const plantillasFiltradas = plantillas.filter((p) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      p.codigo.toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.evento || '').toLowerCase().includes(q)
    )
  })

  const abrirNuevo = () => {
    setEditando(null)
    setModal(true)
  }

  const abrirEditar = (p: Plantilla) => {
    setEditando(p)
    setModal(true)
  }

  const toggleActiva = async (p: Plantilla) => {
    try {
      const res = await fetch('/api/plantillas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, activa: !p.activa }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: p.activa ? 'Plantilla desactivada' : 'Plantilla activada',
          description: p.codigo,
        })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (p: Plantilla) => {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}" (${p.codigo})?`)) return
    try {
      const res = await fetch(`/api/plantillas?id=${p.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Plantilla eliminada' })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Plantillas de Mensajes (Email y WhatsApp)
          </CardTitle>
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Plantilla
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Gestiona las plantillas base que se envían a los clientes por correo y WhatsApp.
          Edita, activa, desactiva o crea nuevas plantillas según tus necesidades.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* === Filtros === */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoría</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Código, nombre, evento..."
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* === Tabla de plantillas === */}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : plantillasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No se encontraron plantillas
                  </TableCell>
                </TableRow>
              ) : (
                plantillasFiltradas.map((p) => (
                  <TableRow key={p.id} className={!p.activa ? 'opacity-50' : ''}>
                    <TableCell>
                      {p.tipo === 'EMAIL' ? (
                        <Mail className="w-4 h-4 text-blue-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-green-600" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                    <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.tipo === 'EMAIL' ? 'text-blue-700' : 'text-green-700'}>
                        {p.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.categoria}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.evento || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {p.sistema && (
                          <Badge variant="outline" className="text-purple-700 w-fit">Sistema</Badge>
                        )}
                        <Badge
                          variant={p.activa ? 'default' : 'secondary'}
                          className={p.activa ? 'bg-green-100 text-green-800 w-fit' : 'w-fit'}
                        >
                          {p.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setModalPreview(p)}
                          title="Vista previa"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirEditar(p)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActiva(p)}
                          title={p.activa ? 'Desactivar' : 'Activar'}
                        >
                          <Power className={`w-4 h-4 ${p.activa ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </Button>
                        {!p.sistema && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => eliminar(p)}
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* === Resumen === */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Total: <strong>{plantillasFiltradas.length}</strong></span>
          <span>Email: <strong>{plantillasFiltradas.filter((p) => p.tipo === 'EMAIL').length}</strong></span>
          <span>WhatsApp: <strong>{plantillasFiltradas.filter((p) => p.tipo === 'WHATSAPP').length}</strong></span>
          <span>Activas: <strong>{plantillasFiltradas.filter((p) => p.activa).length}</strong></span>
        </div>
      </CardContent>

      {/* === Modal Crear/Editar === */}
      {modal && (
        <PlantillaModal
          plantilla={editando}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false)
            cargar()
          }}
        />
      )}

      {/* === Modal Vista Previa === */}
      {modalPreview && (
        <PreviewModal
          plantilla={modalPreview}
          onClose={() => setModalPreview(null)}
        />
      )}
    </Card>
  )
}

// =====================================================
// Modal Crear/Editar Plantilla
// =====================================================
function PlantillaModal({
  plantilla,
  onClose,
  onSaved,
}: {
  plantilla: Plantilla | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const isEdit = !!plantilla

  const [form, setForm] = useState({
    codigo: plantilla?.codigo || '',
    nombre: plantilla?.nombre || '',
    tipo: plantilla?.tipo || 'EMAIL',
    categoria: plantilla?.categoria || 'GENERAL',
    descripcion: plantilla?.descripcion || '',
    asunto: plantilla?.asunto || '',
    contenido: plantilla?.contenido || '',
    contenidoHtml: plantilla?.contenidoHtml || '',
    evento: plantilla?.evento || '',
    variables: plantilla?.variables || '[]',
  })
  const [saving, setSaving] = useState(false)
  const [varsList, setVarsList] = useState<string[]>(() => {
    try {
      return JSON.parse(plantilla?.variables || '[]')
    } catch {
      return []
    }
  })
  const [newVar, setNewVar] = useState('')

  const addVar = () => {
    if (newVar && !varsList.includes(newVar)) {
      const updated = [...varsList, newVar.trim()]
      setVarsList(updated)
      setForm({ ...form, variables: JSON.stringify(updated) })
      setNewVar('')
    }
  }

  const removeVar = (v: string) => {
    const updated = varsList.filter((x) => x !== v)
    setVarsList(updated)
    setForm({ ...form, variables: JSON.stringify(updated) })
  }

  const insertVar = (v: string) => {
    setForm({ ...form, contenido: form.contenido + ` {{${v}}}` })
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit ? { id: plantilla!.id, ...form } : form
      const res = await fetch('/api/plantillas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: isEdit ? 'Plantilla actualizada' : 'Plantilla creada' })
        onSaved()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          {/* === Datos básicos === */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                required
                disabled={isEdit && plantilla?.sistema}
                placeholder="MI_PLANTILLA_WA"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Nombre descriptivo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v })}
                disabled={isEdit && plantilla?.sistema}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Evento (opcional)</Label>
              <Input
                value={form.evento}
                onChange={(e) => setForm({ ...form, evento: e.target.value })}
                placeholder="prestamo.solicitud, pago.confirmado, firma.solicitada..."
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Cuándo se dispara esta plantilla..."
              />
            </div>
          </div>

          {/* === Variables disponibles === */}
          <div className="space-y-1.5 border rounded-md p-3 bg-muted/30">
            <Label className="text-xs uppercase tracking-wide">Variables disponibles</Label>
            <p className="text-xs text-muted-foreground">
              Agrega las variables que esta plantilla puede usar. Insértalas en el contenido con {'{{nombre_variable}}'}.
            </p>
            <div className="flex gap-2">
              <Input
                value={newVar}
                onChange={(e) => setNewVar(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addVar()
                  }
                }}
                placeholder="ej: clienteNombre, monto, fechaVencimiento..."
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={addVar}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {varsList.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">Sin variables</span>
              ) : (
                varsList.map((v) => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 font-mono text-xs"
                    onClick={() => insertVar(v)}
                    title="Click para insertar en contenido"
                  >
                    {`{{${v}}}`}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeVar(v)
                      }}
                      className="ml-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* === Asunto (solo EMAIL) === */}
          {form.tipo === 'EMAIL' && (
            <div className="space-y-1.5">
              <Label>Asunto del correo</Label>
              <Input
                value={form.asunto}
                onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                placeholder="Asunto del correo..."
                required
              />
            </div>
          )}

          {/* === Contenido === */}
          <div className="space-y-1.5">
            <Label>Contenido (texto)</Label>
            <Textarea
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              required
              rows={10}
              placeholder="Escribe aquí el contenido. Usa {{variables}} para insertar valores dinámicos."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {form.contenido.length} caracteres
            </p>
          </div>

          {/* === HTML (solo EMAIL, opcional) === */}
          {form.tipo === 'EMAIL' && (
            <div className="space-y-1.5">
              <Label>Contenido HTML (opcional)</Label>
              <Textarea
                value={form.contenidoHtml}
                onChange={(e) => setForm({ ...form, contenidoHtml: e.target.value })}
                rows={8}
                placeholder="<html>... (opcional, si vacío se usa solo texto)"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Si se proporciona, se envía como HTML. Las mismas {'{{variables}}'} funcionan aquí.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Modal de Vista Previa
// =====================================================
function PreviewModal({
  plantilla,
  onClose,
}: {
  plantilla: Plantilla
  onClose: () => void
}) {
  const { toast } = useToast()
  const [varsValues, setVarsValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ asunto: string; contenido: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const vars: string[] = (() => {
    try {
      return JSON.parse(plantilla.variables)
    } catch {
      return []
    }
  })()

  const renderPreview = async () => {
    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          contenido: plantilla.contenido,
          asunto: plantilla.asunto || '',
          vars: varsValues,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setPreview(json.data)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const sendTest = async () => {
    if (!testEmail) {
      toast({ title: 'Email requerido', variant: 'destructive' })
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_send',
          to: testEmail,
          asunto: plantilla.asunto || '',
          contenido: plantilla.contenido,
          contenidoHtml: plantilla.contenidoHtml || '',
          vars: varsValues,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Email de prueba enviado', description: `A ${testEmail}` })
      } else {
        toast({ title: 'Error al enviar', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Vista Previa: {plantilla.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* === Variables de prueba === */}
          {vars.length > 0 && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <Label className="text-xs uppercase tracking-wide">Variables de prueba</Label>
              <div className="grid grid-cols-2 gap-2">
                {vars.map((v) => (
                  <div key={v} className="space-y-1">
                    <Label className="text-xs font-mono">{`{{${v}}}`}</Label>
                    <Input
                      value={varsValues[v] || ''}
                      onChange={(e) =>
                        setVarsValues({ ...varsValues, [v]: e.target.value })
                      }
                      placeholder={v}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Botones === */}
          <div className="flex gap-2">
            <Button onClick={renderPreview} variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Generar vista previa
            </Button>
          </div>

          {/* === Resultado === */}
          {preview && (
            <div className="space-y-3 border rounded-md p-3">
              {plantilla.tipo === 'EMAIL' && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Asunto</Label>
                  <div className="text-sm font-medium p-2 bg-muted rounded">
                    {preview.asunto || '(sin asunto)'}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Contenido</Label>
                <pre className="text-xs p-3 bg-muted rounded whitespace-pre-wrap font-mono">
                  {preview.contenido}
                </pre>
              </div>
            </div>
          )}

          {/* === Envío de prueba (solo EMAIL) === */}
          {plantilla.tipo === 'EMAIL' && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide">
                Enviar email de prueba
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="flex-1"
                />
                <Button onClick={sendTest} disabled={testing} size="sm">
                  <Send className="w-4 h-4 mr-1" />
                  {testing ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
