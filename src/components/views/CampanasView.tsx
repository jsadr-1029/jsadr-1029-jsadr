'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
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
import { useToast } from '@/hooks/use-toast'
import { formatearFecha } from '@/lib/finanzas'
import { Megaphone, Plus, Eye, Bell, Trash2, Send } from 'lucide-react'

interface Campana {
  id: string
  titulo: string
  descripcion: string
  contenido: string | null
  tipo: string
  fechaInicio: string
  fechaFin: string | null
  activa: boolean
  destinatarios: string
  createdAt: string
  _count: { vistas: number }
}

export function CampanasView({ onChanged }: { onChanged: () => void }) {
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  // === Vista previa de campaña (ORDEN OBLIGATORIA 3) ===
  // Tras crear una campaña, se abre este modal para mostrar cómo la verán
  // los clientes (título, descripción, contenido, destinatarios).
  const [campanaPreview, setCampanaPreview] = useState<Campana | null>(null)
  const { toast } = useToast()

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [contenido, setContenido] = useState('')
  const [tipo, setTipo] = useState('INFORMATIVO')
  const [destinatarios, setDestinatarios] = useState('TODOS')
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/campanas?activas=false')
      const json = await res.json()
      if (json.success) setCampanas(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/campanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descripcion,
          contenido,
          tipo,
          destinatarios,
          enviarWhatsapp,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Campaña creada',
          description: enviarWhatsapp
            ? `Enviada por WhatsApp a ${json.whatsappEnviados}/${json.totalClientes} clientes`
            : 'Campaña publicada',
        })
        setModalCrear(false)
        limpiarForm()
        cargar()
        onChanged()
        // === ORDEN OBLIGATORIA 3: Abrir vista previa siempre que se termina un proceso ===
        // Tras crear la campaña, abrir el modal de vista previa para que el usuario
        // verifique cómo la verán los clientes (título, contenido, destinatarios).
        if (json.data) {
          setTimeout(() => {
            setCampanaPreview(json.data)
          }, 400)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const limpiarForm = () => {
    setTitulo('')
    setDescripcion('')
    setContenido('')
    setTipo('INFORMATIVO')
    setDestinatarios('TODOS')
    setEnviarWhatsapp(false)
  }

  const toggleActiva = async (c: Campana) => {
    try {
      await fetch('/api/campanas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, activa: !c.activa }),
      })
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (c: Campana) => {
    if (!confirm(`¿Eliminar la campaña "${c.titulo}"?`)) return
    try {
      await fetch(`/api/campanas?id=${c.id}`, { method: 'DELETE' })
      toast({ title: 'Campaña eliminada' })
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const tipoConfig: Record<string, { label: string; color: string }> = {
    PROMOCION: { label: 'Promoción', color: 'bg-blue-100 text-blue-800' },
    INFORMATIVO: { label: 'Informativo', color: 'bg-gray-100 text-gray-800' },
    RECORDATORIO: { label: 'Recordatorio', color: 'bg-amber-100 text-amber-800' },
    OFERTA: { label: 'Oferta', color: 'bg-emerald-100 text-emerald-800' },
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campañas"
        subtitle="Publica campañas que los clientes verán en el portal de consulta"
        icon={<Megaphone className="w-5 h-5" />}
        actions={
          <Button onClick={() => setModalCrear(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Campaña
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)
        ) : campanas.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>No hay campañas creadas. Crea la primera con el botón "Nueva Campaña".</p>
            </CardContent>
          </Card>
        ) : (
          campanas.map((c) => {
            const cfg = tipoConfig[c.tipo] || tipoConfig.INFORMATIVO
            return (
              <Card key={c.id} className={c.activa ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{c.titulo}</CardTitle>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {c.activa ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactiva</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">{c.descripcion}</p>
                  {c.contenido && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      "{c.contenido.slice(0, 100)}..."
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {c._count.vistas} vistas
                    </span>
                    <span>{formatearFecha(c.createdAt)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleActiva(c)}>
                      {c.activa ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => eliminar(c)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal crear campaña */}
      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Campaña</DialogTitle>
          </DialogHeader>
          <form onSubmit={crear} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                placeholder="Ej: Nueva línea de crédito con tasa preferencial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción corta *</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                rows={2}
                placeholder="Resumen visible en la tarjeta"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contenido">Contenido completo (opcional)</Label>
              <Textarea
                id="contenido"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={4}
                placeholder="Detalle de la campaña, condiciones, fechas, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFORMATIVO">Informativo</SelectItem>
                    <SelectItem value="PROMOCION">Promoción</SelectItem>
                    <SelectItem value="OFERTA">Oferta</SelectItem>
                    <SelectItem value="RECORDATORIO">Recordatorio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destinatarios</Label>
                <Select value={destinatarios} onValueChange={setDestinatarios}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los clientes</SelectItem>
                    <SelectItem value="CATEGORIA-1">Solo Categoría 1</SelectItem>
                    <SelectItem value="CATEGORIA-2">Solo Categoría 2</SelectItem>
                    <SelectItem value="CATEGORIA-3">Solo Categoría 3</SelectItem>
                    <SelectItem value="CATEGORIA-4">Solo Categoría 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-md border border-amber-200">
              <input
                type="checkbox"
                id="enviarWhatsapp"
                checked={enviarWhatsapp}
                onChange={(e) => setEnviarWhatsapp(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="enviarWhatsapp" className="cursor-pointer flex items-center gap-2 text-sm">
                <Send className="w-4 h-4" />
                Enviar también por WhatsApp a todos los clientes
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>
                Cancelar
              </Button>
              <Button type="submit">Publicar Campaña</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === VISTA PREVIA DE CAMPAÑA (ORDEN OBLIGATORIA 3) ===
          Tras crear la campaña, mostrar cómo la verán los clientes. */}
      <Dialog open={!!campanaPreview} onOpenChange={(open) => !open && setCampanaPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa de la campaña</DialogTitle>
          </DialogHeader>
          {campanaPreview && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-primary/10 p-4 border-b border-border">
                  <Badge variant="outline" className="mb-2">
                    {campanaPreview.tipo}
                  </Badge>
                  <h3 className="font-bold text-lg">{campanaPreview.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{campanaPreview.descripcion}</p>
                </div>
                <div className="p-4 bg-background">
                  <p className="text-sm whitespace-pre-wrap">{campanaPreview.contenido}</p>
                </div>
                <div className="p-3 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                  <span>Destinatarios: {campanaPreview.destinatarios}</span>
                  <span>
                    {new Date(campanaPreview.createdAt).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setCampanaPreview(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
