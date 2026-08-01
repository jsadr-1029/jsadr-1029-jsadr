'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import { BookOpen, Plus, Trash2, Phone, Mail, MapPin, FileText, Users, DollarSign, Scale, MessageSquare } from 'lucide-react'

interface BitacoraEntry {
  id: string
  prestamoId: string
  prestamoCodigo: string
  usuarioNombre: string
  tipo: string
  titulo: string
  descripcion: string
  resultado: string | null
  fechaEvento: string
  createdAt: string
  usuario?: { nombre: string; rol: string } | null
}

const TIPO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  NOTA: { label: 'Nota', color: 'bg-gray-100 text-gray-800', icon: FileText },
  LLAMADA: { label: 'Llamada', color: 'bg-blue-100 text-blue-800', icon: Phone },
  VISITA: { label: 'Visita', color: 'bg-purple-100 text-purple-800', icon: MapPin },
  EMAIL: { label: 'Email', color: 'bg-cyan-100 text-cyan-800', icon: Mail },
  WHATSAPP: { label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-800', icon: MessageSquare },
  REUNION: { label: 'Reunión', color: 'bg-amber-100 text-amber-800', icon: Users },
  PAGO: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: DollarSign },
  JURIDICO: { label: 'Jurídico', color: 'bg-red-100 text-red-800', icon: Scale },
  OTRO: { label: 'Otro', color: 'bg-pink-100 text-pink-800', icon: FileText },
}

export function BitacoraPanel({
  prestamoId,
  prestamoCodigo,
  usuarioNombre = 'Administrador',
}: {
  prestamoId: string
  prestamoCodigo: string
  usuarioNombre?: string
}) {
  const [entries, setEntries] = useState<BitacoraEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const { toast } = useToast()

  const [form, setForm] = useState({
    tipo: 'NOTA',
    titulo: '',
    descripcion: '',
    resultado: '',
  })

  useEffect(() => {
    cargar()
  }, [prestamoId])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/bitacora?prestamoId=${prestamoId}`)
      const json = await res.json()
      if (json.success) setEntries(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo || !form.descripcion) {
      toast({ title: 'Error', description: 'Título y descripción son obligatorios', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/bitacora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestamoId,
          prestamoCodigo,
          usuarioNombre,
          tipo: form.tipo,
          titulo: form.titulo,
          descripcion: form.descripcion,
          resultado: form.resultado || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Entrada registrada en bitácora' })
        setForm({ tipo: 'NOTA', titulo: '', descripcion: '', resultado: '' })
        setMostrarForm(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada de la bitácora?')) return
    try {
      await fetch(`/api/bitacora?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Entrada eliminada' })
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Bitácora del Préstamo ({entries.length})
            <span className="text-xs text-muted-foreground font-normal">
              · {prestamoCodigo}
            </span>
          </CardTitle>
          <Button size="sm" onClick={() => setMostrarForm(!mostrarForm)}>
            <Plus className="w-4 h-4 mr-1" />
            Nueva entrada
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Formulario nueva entrada */}
        {mostrarForm && (
          <form onSubmit={crear} className="p-3 border rounded-md bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                  placeholder="Ej: Llamada de seguimiento"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción *</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                required
                rows={3}
                placeholder="Detalle de lo sucedido..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Resultado (opcional)</Label>
              <Input
                value={form.resultado}
                onChange={(e) => setForm({ ...form, resultado: e.target.value })}
                placeholder="Ej: Cliente promete pagar el viernes"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Guardar entrada
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Lista de entradas */}
        {loading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Cargando bitácora...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p>No hay entradas en la bitácora de este préstamo.</p>
            <p className="text-xs mt-1">
              Documenta llamadas, visitas, correos, pagos, reuniones o cualquier evento relacionado
              con el crédito {prestamoCodigo}.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {entries.map((entry) => {
              const cfg = TIPO_CONFIG[entry.tipo] || TIPO_CONFIG.NOTA
              const Icon = cfg.icon
              return (
                <div key={entry.id} className="flex gap-3 p-3 border rounded-md hover:bg-muted/30">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{entry.titulo}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatearFechaHora(entry.fechaEvento)} · por{' '}
                          <strong>{entry.usuarioNombre}</strong>
                          {entry.usuario?.rol && (
                            <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-muted">
                              {entry.usuario.rol}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-red-600"
                        onClick={() => eliminar(entry.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm mt-1.5 whitespace-pre-wrap">{entry.descripcion}</p>
                    {entry.resultado && (
                      <p className="text-xs mt-1.5 text-emerald-700">
                        ✓ <strong>Resultado:</strong> {entry.resultado}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
