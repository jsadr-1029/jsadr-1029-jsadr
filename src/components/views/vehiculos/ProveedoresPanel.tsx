'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Search, Phone, MapPin, Mail, Building2, Trash2 } from 'lucide-react'
import { apiFetch, formatDate } from './helpers'

const TIPOS_PROVEEDOR = ['TALLER', 'REPUESTERO', 'SEGURO', 'GASOLINERA', 'OTRO']

const COLORES_TIPO: Record<string, string> = {
  TALLER: 'bg-blue-100 text-blue-800 border-blue-300',
  REPUESTERO: 'bg-purple-100 text-purple-800 border-purple-300',
  SEGURO: 'bg-green-100 text-green-800 border-green-300',
  GASOLINERA: 'bg-orange-100 text-orange-800 border-orange-300',
  OTRO: 'bg-gray-100 text-gray-800 border-gray-300',
}

export function ProveedoresPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    nombre: '', tipo: 'TALLER', documento: '', contacto: '',
    telefono: '', telefono2: '', email: '', direccion: '', ciudad: '', barrio: '', notas: '',
  })

  const cargar = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtro) params.set('q', filtro)
    if (filtroTipo) params.set('tipo', filtroTipo)
    const r = await apiFetch('/api/vehiculos/proveedores' + (params.toString() ? `?${params}` : ''))
    if (r.success) setProveedores(r.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtro, filtroTipo])

  const abrirCrear = () => {
    setEditando(null)
    setForm({
      nombre: '', tipo: 'TALLER', documento: '', contacto: '',
      telefono: '', telefono2: '', email: '', direccion: '', ciudad: '', barrio: '', notas: '',
    })
    setModalOpen(true)
  }

  const abrirEditar = (p: any) => {
    setEditando(p)
    setForm({ ...p })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    const url = editando ? `/api/vehiculos/proveedores/${editando.id}` : '/api/vehiculos/proveedores'
    const method = editando ? 'PUT' : 'POST'
    const r = await apiFetch(url, { method, body: JSON.stringify(form) })
    if (r.success) {
      toast({ title: editando ? 'Proveedor actualizado' : 'Proveedor creado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const eliminar = async (p: any) => {
    if (!confirm(`¿Desactivar el proveedor "${p.nombre}"?`)) return
    const r = await apiFetch(`/api/vehiculos/proveedores/${p.id}`, { method: 'DELETE' })
    if (r.success) {
      toast({ title: 'Proveedor desactivado' })
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto, teléfono, documento..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo || 'TODOS'} onValueChange={v => setFiltroTipo(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los tipos</SelectItem>
            {TIPOS_PROVEEDOR.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo proveedor
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : proveedores.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay proveedores registrados.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {proveedores.map(p => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{p.nombre}</div>
                    {p.contacto && <div className="text-xs text-muted-foreground">{p.contacto}</div>}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${COLORES_TIPO[p.tipo] || COLORES_TIPO.OTRO}`}>
                    {p.tipo}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {p.documento && (
                    <div className="text-xs text-muted-foreground">NIT/CC: {p.documento}</div>
                  )}
                  {p.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <span>{p.telefono}</span>
                      {p.telefono2 && <span className="text-xs text-muted-foreground">· {p.telefono2}</span>}
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate text-xs">{p.email}</span>
                    </div>
                  )}
                  {(p.direccion || p.ciudad) && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />
                      <span className="text-xs">
                        {p.direccion}{p.direccion && p.ciudad ? ', ' : ''}{p.ciudad}
                      </span>
                    </div>
                  )}
                  {p._count && (p._count.mantenimientos > 0 || p._count.gastos > 0) && (
                    <div className="mt-2 pt-1 border-t text-xs text-muted-foreground">
                      {p._count.mantenimientos > 0 && <span>{p._count.mantenimientos} mant. </span>}
                      {p._count.gastos > 0 && <span>· {p._count.gastos} gastos</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 mt-3">
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(p)}>
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => eliminar(p)} className="text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre / Razón social *</Label>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PROVEEDOR.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>NIT / Cédula</Label>
              <Input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Persona de contacto</Label>
              <Input value={form.contacto} onChange={e => setForm({ ...form, contacto: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono principal</Label>
              <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono alternativo</Label>
              <Input value={form.telefono2} onChange={e => setForm({ ...form, telefono2: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} />
            </div>
            <div>
              <Label>Barrio</Label>
              <Input value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>{editando ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
