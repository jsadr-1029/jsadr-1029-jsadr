'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost, apiPatch } from '@/hooks/use-fetch'
import { formatCOP, formatDate, estadoCasoJuridicoColor } from '@/lib/format'
import { Scale, Plus, Calendar, Gavel, Building2, User, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export function JuridicosView({ navigate }: { navigate: (v: any) => void }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const { data, loading } = useFetch<{ casos: any[] }>(`/api/casos-juridicos`, { refreshKey })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cobranza Jurídica"
        subtitle={`${data?.casos?.length || 0} casos`}
        icon={Scale}
        actions={<Button onClick={() => setNuevoOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo Caso</Button>}
      />

      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.casos?.length ? (
          <EmptyState icon={Scale} title="Sin casos jurídicos" description="Cuando un solicitud entre en cobro jurídico, aparecerá aquí." />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Caso</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden md:table-cell">Abogado</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Saldo</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600">Estado</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.casos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-slate-900">{c.prestamo?.codigo}</p>
                      <p className="text-xs text-slate-500">Abierto: {formatDate(c.fechaApertura)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{c.prestamo?.cliente?.nombre}</p>
                      <p className="text-xs text-slate-500">CC {c.prestamo?.cliente?.cedula}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.abogadoNombre ? (
                        <div className="text-xs">
                          <p className="text-slate-900">{c.abogadoNombre}</p>
                          <p className="text-slate-500">{c.abogadoTelefono}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-red-700">{formatCOP(c.prestamo?.saldoTotal || 0)}</p>
                      {c.honorarios > 0 && <p className="text-xs text-slate-500">Honorarios: {formatCOP(c.honorarios)}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={estadoCasoJuridicoColor(c.estado)}>{c.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <DetalleCasoModal
          caso={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null)
            setRefreshKey(k => k + 1)
          }}
          navigate={navigate}
        />
      )}

      <NuevoCasoModal
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreated={() => {
          setNuevoOpen(false)
          setRefreshKey(k => k + 1)
          toast.success('Caso creado')
        }}
      />
    </div>
  )
}

function DetalleCasoModal({ caso, onClose, onUpdated, navigate }: any) {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: casoFull, loading } = useFetch<any>(`/api/casos-juridicos/${caso.id}`, { refreshKey })
  const [evento, setEvento] = useState({ tipoEvento: 'NOTIFICACION', titulo: '', descripcion: '', resultado: '', actor: '' })

  if (loading || !casoFull) return <LoadingState />

  const addEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiPost(`/api/casos-juridicos/${caso.id}`, evento)
      setEvento({ tipoEvento: 'NOTIFICACION', titulo: '', descripcion: '', resultado: '', actor: '' })
      setRefreshKey(k => k + 1)
      toast.success('Evento agregado')
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
  }

  const updateEstado = async (nuevoEstado: string) => {
    try {
      await apiPatch(`/api/casos-juridicos/${caso.id}`, { estado: nuevoEstado })
      setRefreshKey(k => k + 1)
      toast.success('Estado actualizado')
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Caso Jurídico · {casoFull.prestamo?.codigo}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="font-semibold text-slate-900">{casoFull.prestamo?.cliente?.nombre}</p>
            <p className="text-xs text-slate-500">CC {casoFull.prestamo?.cliente?.cedula}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs text-slate-500">Saldo reclamado</p>
            <p className="font-semibold text-red-700">{formatCOP(casoFull.prestamo?.saldoTotal)}</p>
            <p className="text-xs text-slate-500">Honorarios: {formatCOP(casoFull.honorarios)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><Label>Estado actual</Label>
            <Select value={casoFull.estado} onValueChange={updateEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RADICADO">Radicado</SelectItem>
                <SelectItem value="COBRO_JUDICIAL">Cobro Judicial</SelectItem>
                <SelectItem value="DEMANDA">Demanda</SelectItem>
                <SelectItem value="EMBARGO">Embargo</SelectItem>
                <SelectItem value="AUDIENCIA">Audiencia</SelectItem>
                <SelectItem value="CERRADO">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Juzgado</Label>
            <Input defaultValue={casoFull.juzgado || ''} onBlur={(e) => apiPatch(`/api/casos-juridicos/${caso.id}`, { juzgado: e.target.value })} />
          </div>
          <div><Label>Radicado</Label>
            <Input defaultValue={casoFull.radicado || ''} onBlur={(e) => apiPatch(`/api/casos-juridicos/${caso.id}`, { radicado: e.target.value })} />
          </div>
          <div><Label>Tipo proceso</Label>
            <Input defaultValue={casoFull.tipoProceso || ''} onBlur={(e) => apiPatch(`/api/casos-juridicos/${caso.id}`, { tipoProceso: e.target.value })} />
          </div>
          <div><Label>Abogado</Label>
            <Input defaultValue={casoFull.abogadoNombre || ''} onBlur={(e) => apiPatch(`/api/casos-juridicos/${caso.id}`, { abogadoNombre: e.target.value })} />
          </div>
          <div><Label>Teléfono abogado</Label>
            <Input defaultValue={casoFull.abogadoTelefono || ''} onBlur={(e) => apiPatch(`/api/casos-juridicos/${caso.id}`, { abogadoTelefono: e.target.value })} />
          </div>
        </div>

        <Tabs defaultValue="cronologia">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cronologia">Cronología ({casoFull.cronologias?.length})</TabsTrigger>
            <TabsTrigger value="agregar">Agregar Evento</TabsTrigger>
          </TabsList>
          <TabsContent value="cronologia">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {casoFull.cronologias?.map((cr: any) => (
                <div key={cr.id} className="p-2 rounded border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="info">{cr.tipoEvento}</Badge>
                    <span className="text-xs text-slate-400">{formatDate(cr.fecha, { withTime: true })}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{cr.titulo}</p>
                  {cr.descripcion && <p className="text-xs text-slate-600">{cr.descripcion}</p>}
                  {cr.resultado && <p className="text-xs text-emerald-700">→ {cr.resultado}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="agregar">
            <form onSubmit={addEvento} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo evento</Label>
                  <Select value={evento.tipoEvento} onValueChange={(v) => setEvento({ ...evento, tipoEvento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTIFICACION">Notificación</SelectItem>
                      <SelectItem value="AUDIENCIA">Audiencia</SelectItem>
                      <SelectItem value="EMBARGO">Embargo</SelectItem>
                      <SelectItem value="DEMANDA">Demanda</SelectItem>
                      <SelectItem value="OTRO">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Actor</Label>
                  <Input value={evento.actor} onChange={(e) => setEvento({ ...evento, actor: e.target.value })} placeholder="Juzgado, abogado..." />
                </div>
              </div>
              <div><Label>Título *</Label>
                <Input value={evento.titulo} onChange={(e) => setEvento({ ...evento, titulo: e.target.value })} required />
              </div>
              <div><Label>Descripción</Label>
                <Textarea value={evento.descripcion} onChange={(e) => setEvento({ ...evento, descripcion: e.target.value })} rows={2} />
              </div>
              <div><Label>Resultado</Label>
                <Input value={evento.resultado} onChange={(e) => setEvento({ ...evento, resultado: e.target.value })} />
              </div>
              <Button type="submit" size="sm"><Plus className="w-4 h-4 mr-1" />Agregar Evento</Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => navigate({ name: 'prestamo-detalle', id: casoFull.prestamoId })}>Ver solicitud</Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NuevoCasoModal({ open, onClose, onCreated }: any) {
  const [prestamos, setPrestamos] = useState<any[]>([])
  const [prestamoId, setPrestamoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/prestamos?pageSize=200').then(r => r.json()).then(d => setPrestamos(d.prestamos || []))
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost('/api/casos-juridicos', { prestamoId, descripcion })
      onCreated()
      setPrestamoId(''); setDescripcion('')
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo Caso Jurídico</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Solicitud *</Label>
            <Select value={prestamoId} onValueChange={setPrestamoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona solicitud..." /></SelectTrigger>
              <SelectContent>
                {prestamos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.cliente?.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Motivo de derivación a jurídico..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !prestamoId}>{saving ? 'Creando...' : 'Crear Caso'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
