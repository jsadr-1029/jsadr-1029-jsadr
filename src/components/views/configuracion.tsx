'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { formatCOP } from '@/lib/format'
import { Settings, Plus, Building, Tag, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function ConfiguracionView() {
  return (
    <div className="space-y-4">
      <PageHeader title="Configuración" subtitle="Parámetros, categorías y cuentas" icon={Settings} />
      <Tabs defaultValue="categorias">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3">
          <TabsTrigger value="categorias"><Tag className="w-3.5 h-3.5 mr-1.5" />Categorías</TabsTrigger>
          <TabsTrigger value="cuentas"><Building className="w-3.5 h-3.5 mr-1.5" />Cuentas</TabsTrigger>
          <TabsTrigger value="parametros"><Settings className="w-3.5 h-3.5 mr-1.5" />Parámetros</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias"><CategoriasPanel /></TabsContent>
        <TabsContent value="cuentas"><CuentasPanel /></TabsContent>
        <TabsContent value="parametros"><ParametrosPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

function CategoriasPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [open, setOpen] = useState(false)
  const { data, loading } = useFetch<{ categorias: any[] }>(`/api/categorias`, { refreshKey })

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-600">{data?.categorias?.length || 0} categorías</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nueva</Button>
      </div>
      {loading ? <LoadingState /> : !data?.categorias?.length ? (
        <EmptyState icon={Tag} title="Sin categorías" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.categorias.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-slate-900">{c.nombre}</p>
                  <p className="text-xs text-slate-500">{c.codigo}</p>
                </div>
                <Badge variant={c.activa ? 'success' : 'neutral'}>{c.activa ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-slate-500">Monto</p><p className="font-semibold">{formatCOP(c.montoMinimo)} - {formatCOP(c.montoMaximo)}</p></div>
                <div><p className="text-slate-500">Tasa anual</p><p className="font-semibold">{c.tasaInteresAnual}%</p></div>
                <div><p className="text-slate-500">Mora anual</p><p className="font-semibold">{c.tasaMoraAnual}%</p></div>
                <div><p className="text-slate-500">Clientes</p><p className="font-semibold">{c._count?.clientes || 0}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <NuevaCategoriaModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setRefreshKey(k => k + 1) }} />}
    </Card>
  )
}

function NuevaCategoriaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nombre: '', montoMinimo: '', montoMaximo: '', tasaInteresAnual: '', tasaMoraAnual: '', descripcion: '', cuentaRecaudoId: '' })
  const [cuentas, setCuentas] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetch('/api/cuentas').then(r => r.json()).then(d => setCuentas(d.cuentas || [])) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost('/api/categorias', {
        ...form,
        montoMinimo: Number(form.montoMinimo),
        montoMaximo: Number(form.montoMaximo),
        tasaInteresAnual: Number(form.tasaInteresAnual),
        tasaMoraAnual: Number(form.tasaMoraAnual),
      })
      onSaved(); toast.success('Categoría creada')
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><Label>Nombre *</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto mínimo *</Label><Input type="number" value={form.montoMinimo} onChange={(e) => setForm({ ...form, montoMinimo: e.target.value })} required /></div>
            <div><Label>Monto máximo *</Label><Input type="number" value={form.montoMaximo} onChange={(e) => setForm({ ...form, montoMaximo: e.target.value })} required /></div>
            <div><Label>Tasa anual (%) *</Label><Input type="number" value={form.tasaInteresAnual} onChange={(e) => setForm({ ...form, tasaInteresAnual: e.target.value })} required /></div>
            <div><Label>Tasa mora anual (%) *</Label><Input type="number" value={form.tasaMoraAnual} onChange={(e) => setForm({ ...form, tasaMoraAnual: e.target.value })} required /></div>
          </div>
          <div>
            <Label>Cuenta de recaudo</Label>
            <Select value={form.cuentaRecaudoId} onValueChange={(v) => setForm({ ...form, cuentaRecaudoId: v })}>
              <SelectTrigger><SelectValue placeholder="Sin cuenta..." /></SelectTrigger>
              <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numeroCuenta}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Descripción</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CuentasPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [open, setOpen] = useState(false)
  const { data, loading } = useFetch<{ cuentas: any[] }>(`/api/cuentas`, { refreshKey })

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-600">{data?.cuentas?.length || 0} cuentas</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nueva</Button>
      </div>
      {loading ? <LoadingState /> : !data?.cuentas?.length ? (
        <EmptyState icon={Building} title="Sin cuentas" />
      ) : (
        <div className="space-y-2">
          {data.cuentas.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{c.banco}</p>
                  <Badge variant="neutral">{c.tipoCuenta}</Badge>
                </div>
                <p className="text-xs text-slate-500">****{c.numeroCuenta.slice(-4)} · {c.titular}</p>
              </div>
              <Badge variant={c.activa ? 'success' : 'neutral'}>{c.activa ? 'Activa' : 'Inactiva'}</Badge>
            </div>
          ))}
        </div>
      )}
      {open && <NuevaCuentaModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setRefreshKey(k => k + 1) }} />}
    </Card>
  )
}

function NuevaCuentaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nombre: '', banco: '', tipoCuenta: 'AHORROS', numeroCuenta: '', titular: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost('/api/cuentas', form)
      onSaved(); toast.success('Cuenta creada')
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva Cuenta Bancaria</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><Label>Nombre *</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Banco *</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} required /></div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipoCuenta} onValueChange={(v) => setForm({ ...form, tipoCuenta: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AHORROS">Ahorros</SelectItem>
                  <SelectItem value="CORRIENTE">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Número de cuenta *</Label><Input value={form.numeroCuenta} onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })} required /></div>
          <div><Label>Titular *</Label><Input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ParametrosPanel() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useFetch<{ configuraciones: any[] }>(`/api/configuracion`, { refreshKey })
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (data?.configuraciones) {
      const vals: Record<string, string> = {}
      data.configuraciones.forEach((c) => { vals[c.clave] = c.valor })
      setEditValues(vals)
    }
  }, [data])

  const save = async (clave: string) => {
    setSaving(clave)
    try {
      const config = data?.configuraciones.find(c => c.clave === clave)
      await apiPost('/api/configuracion', { clave, valor: editValues[clave], descripcion: config?.descripcion })
      toast.success(`Parámetro ${clave} actualizado`)
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
    finally { setSaving(null) }
  }

  if (loading) return <LoadingState />
  if (!data?.configuraciones?.length) return <EmptyState icon={Settings} title="Sin parámetros" />

  return (
    <Card>
      <div className="space-y-3">
        {data.configuraciones.map((c) => (
          <div key={c.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-lg border border-slate-200">
            <div className="sm:col-span-4">
              <Label className="text-xs">{c.clave}</Label>
              <p className="text-xs text-slate-500">{c.descripcion || 'Sin descripción'}</p>
            </div>
            <div className="sm:col-span-6">
              <Input
                value={editValues[c.clave] || ''}
                onChange={(e) => setEditValues({ ...editValues, [c.clave]: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => save(c.clave)}
                disabled={saving === c.clave}
                className="w-full"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving === c.clave ? '...' : 'Guardar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
