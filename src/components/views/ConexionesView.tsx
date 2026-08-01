'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import {
  Plug, Plus, Edit, Trash2, Zap, CheckCircle, XCircle,
  MessageCircle, Mail, Building2, Link2, Webhook, CreditCard, Loader2,
} from 'lucide-react'

interface Conexion {
  id: string
  nombre: string
  tipo: string
  descripcion: string | null
  url: string | null
  apiKey: string | null
  apiSecret: string | null
  usuario: string | null
  password: string | null
  accountId: string | null
  telefonoOrigen: string | null
  configuracionExtra: string | null
  activa: boolean
  probada: boolean
  fechaUltimaPrueba: string | null
  resultadoUltimaPrueba: string | null
  createdAt: string
}

const TIPO_CONFIG: Record<string, { label: string; icon: any; color: string; descripcion: string; campos: string[] }> = {
  WHATSAPP_BUSINESS: { label: 'WhatsApp Business API', icon: MessageCircle, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', descripcion: 'Envío automático de WhatsApp (Meta Business)', campos: ['url', 'apiKey', 'accountId', 'telefonoOrigen'] },
  TWILIO: { label: 'Twilio (WhatsApp/SMS)', icon: MessageCircle, color: 'text-red-700 bg-red-50 border-red-200', descripcion: 'WhatsApp y SMS vía Twilio', campos: ['url', 'accountId', 'apiKey', 'apiSecret', 'telefonoOrigen'] },
  EMAIL_SMTP: { label: 'Email (SMTP)', icon: Mail, color: 'text-blue-700 bg-blue-50 border-blue-200', descripcion: 'Envío de correos electrónicos', campos: ['url', 'usuario', 'password'] },
  BANCOLOMBIA: { label: 'Bancolombia API', icon: Building2, color: 'text-yellow-700 bg-yellow-50 border-yellow-200', descripcion: 'Integración con API de Bancolombia', campos: ['url', 'apiKey', 'apiSecret', 'accountId'] },
  BANCOLOMBIA_BOTON_PAGO: { label: 'Botón de Pago Bancolombia', icon: CreditCard, color: 'text-yellow-700 bg-yellow-50 border-yellow-200', descripcion: 'Botón de pago para que clientes paguen online', campos: ['url', 'apiKey', 'apiSecret', 'accountId', 'usuario', 'password'] },
  DAVIVIENDA: { label: 'Davivienda API', icon: Building2, color: 'text-red-700 bg-red-50 border-red-200', descripcion: 'Integración con Davivienda', campos: ['url', 'apiKey', 'apiSecret', 'accountId'] },
  PSE: { label: 'PSE (Pagos)', icon: Link2, color: 'text-purple-700 bg-purple-50 border-purple-200', descripcion: 'Recepción de pagos PSE', campos: ['url', 'apiKey', 'apiSecret', 'accountId'] },
  WEBHOOK: { label: 'Webhook Genérico', icon: Webhook, color: 'text-gray-700 bg-gray-50 border-gray-200', descripcion: 'Enviar eventos a URL externa', campos: ['url', 'apiKey'] },
  OTRO: { label: 'Otra API', icon: Plug, color: 'text-indigo-700 bg-indigo-50 border-indigo-200', descripcion: 'Cualquier otra API', campos: ['url', 'apiKey', 'apiSecret', 'usuario', 'password', 'accountId', 'telefonoOrigen'] },
}

export function ConexionesView() {
  const [conexiones, setConexiones] = useState<Conexion[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Conexion | null>(null)
  const [probandoId, setProbandoId] = useState<string | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    id: '', nombre: '', tipo: 'WHATSAPP_BUSINESS', descripcion: '',
    url: '', apiKey: '', apiSecret: '', usuario: '', password: '',
    accountId: '', telefonoOrigen: '', configuracionExtra: '', activa: false,
  })

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/conexiones')
      const json = await res.json()
      if (json.success) setConexiones(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ id: '', nombre: '', tipo: 'WHATSAPP_BUSINESS', descripcion: '', url: '', apiKey: '', apiSecret: '', usuario: '', password: '', accountId: '', telefonoOrigen: '', configuracionExtra: '', activa: false })
    setModalAbierto(true)
  }

  const abrirEditar = (c: Conexion) => {
    setEditando(c)
    setForm({ id: c.id, nombre: c.nombre, tipo: c.tipo, descripcion: c.descripcion || '', url: c.url || '', apiKey: c.apiKey || '', apiSecret: c.apiSecret || '', usuario: c.usuario || '', password: c.password || '', accountId: c.accountId || '', telefonoOrigen: c.telefonoOrigen || '', configuracionExtra: c.configuracionExtra || '', activa: c.activa })
    setModalAbierto(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editando ? 'PATCH' : 'POST'
      const body: any = { ...form }
      if (!editando) delete body.id
      const res = await fetch('/api/conexiones', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (json.success) {
        toast({ title: editando ? 'Conexión actualizada' : 'Conexión creada' })
        setModalAbierto(false)
        cargar()
      } else { toast({ title: 'Error', description: json.error, variant: 'destructive' }) }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  const toggleActiva = async (c: Conexion) => {
    try {
      await fetch('/api/conexiones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, activa: !c.activa }) })
      toast({ title: c.activa ? 'Desactivada' : 'Activada', description: c.nombre })
      cargar()
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  const eliminar = async (c: Conexion) => {
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return
    try {
      await fetch(`/api/conexiones?id=${c.id}`, { method: 'DELETE' })
      toast({ title: 'Conexión eliminada' })
      cargar()
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  const probarConexion = async (c: Conexion) => {
    setProbandoId(c.id)
    try {
      const res = await fetch(`/api/conexiones/${c.id}/probar`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast({ title: json.data.exito ? '✅ Conexión exitosa' : '❌ Falló', description: json.data.resultado, duration: 8000, variant: json.data.exito ? 'default' : 'destructive' })
        cargar()
      }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setProbandoId(null) }
  }

  const camposVisibles = TIPO_CONFIG[form.tipo]?.campos || []

  return (
    <div className="space-y-6">
      <PageHeader title="Conexiones de API" subtitle="Vincula la página con servicios externos" icon={<Plug className="w-5 h-5" />}
        actions={<Button onClick={abrirNuevo}><Plus className="w-4 h-4 mr-2" />Nueva Conexión</Button>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const cantidad = conexiones.filter((c) => c.tipo === key).length
          return (
            <Card key={key}><CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${cfg.color}`}><Icon className="w-5 h-5" /></div>
              <p className="text-xs font-medium">{cfg.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{cantidad} configurada(s)</p>
            </CardContent></Card>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conexiones Configuradas ({conexiones.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>URL/Endpoint</TableHead>
              <TableHead>Estado</TableHead><TableHead>Última prueba</TableHead><TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : conexiones.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay conexiones configuradas.</TableCell></TableRow>
              ) : conexiones.map((c) => {
                const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.OTRO
                const Icon = cfg.icon
                return (
                  <TableRow key={c.id}>
                    <TableCell><div className="flex items-center gap-2"><Icon className={`w-4 h-4 ${cfg.color.split(' ')[0]}`} /><div><p className="font-semibold text-sm">{c.nombre}</p>{c.descripcion && <p className="text-xs text-muted-foreground">{c.descripcion}</p>}</div></div></TableCell>
                    <TableCell><span className={`text-xs px-2 py-1 rounded border ${cfg.color}`}>{cfg.label}</span></TableCell>
                    <TableCell className="text-xs font-mono">{c.url || '—'}{c.telefonoOrigen && <div className="text-muted-foreground">📱 {c.telefonoOrigen}</div>}</TableCell>
                    <TableCell><div className="flex items-center gap-2">
                      {c.activa ? <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">● Activa</Badge> : <Badge variant="outline" className="text-gray-600">○ Inactiva</Badge>}
                      {c.probada && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50"><CheckCircle className="w-3 h-3 mr-1" />Probada</Badge>}
                      {c.fechaUltimaPrueba && !c.probada && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />Falló</Badge>}
                    </div>{c.resultadoUltimaPrueba && <p className="text-[10px] text-muted-foreground mt-1 max-w-xs truncate" title={c.resultadoUltimaPrueba}>{c.resultadoUltimaPrueba}</p>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.fechaUltimaPrueba ? formatearFechaHora(c.fechaUltimaPrueba) : 'Sin probar'}</TableCell>
                    <TableCell><div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => probarConexion(c)} disabled={probandoId === c.id} title="Probar" className="text-blue-600">{probandoId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}</Button>
                      <Switch checked={c.activa} onCheckedChange={() => toggleActiva(c)} title={c.activa ? 'Desactivar' : 'Activar'} />
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)} title="Editar"><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => eliminar(c)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plug className="w-5 h-5 text-primary" />{editando ? 'Editar Conexión' : 'Nueva Conexión de API'}</DialogTitle></DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre *</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Ej: WhatsApp Principal" /></div>
              <div className="space-y-2"><Label>Tipo de servicio *</Label><Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })} disabled={!!editando}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPO_CONFIG).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {TIPO_CONFIG[form.tipo] && <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">💡 {TIPO_CONFIG[form.tipo].descripcion}</div>}
            <div className="space-y-2"><Label>Descripción (opcional)</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {camposVisibles.includes('url') && <div className="space-y-2 sm:col-span-2"><Label>URL / Endpoint *</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://api.ejemplo.com/v1" /></div>}
              {camposVisibles.includes('apiKey') && <div className="space-y-2"><Label>API Key / Token</Label><Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-xxx" /></div>}
              {camposVisibles.includes('apiSecret') && <div className="space-y-2"><Label>API Secret</Label><Input type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} placeholder="••••••••" /></div>}
              {camposVisibles.includes('usuario') && <div className="space-y-2"><Label>Usuario</Label><Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} /></div>}
              {camposVisibles.includes('password') && <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></div>}
              {camposVisibles.includes('accountId') && <div className="space-y-2"><Label>Account ID</Label><Input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>}
              {camposVisibles.includes('telefonoOrigen') && <div className="space-y-2"><Label>Teléfono origen</Label><Input value={form.telefonoOrigen} onChange={(e) => setForm({ ...form, telefonoOrigen: e.target.value })} placeholder="573001234567" /></div>}
            </div>
            <div className="space-y-2"><Label>Configuración adicional (JSON opcional)</Label><Textarea value={form.configuracionExtra} onChange={(e) => setForm({ ...form, configuracionExtra: e.target.value })} rows={2} placeholder='{"campo": "valor"}' className="font-mono text-xs" /></div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50"><div><Label className="font-medium cursor-pointer">Activar conexión</Label><p className="text-xs text-muted-foreground">Las activas se usarán para notificaciones y pagos</p></div><Switch checked={form.activa} onCheckedChange={(v) => setForm({ ...form, activa: v })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setModalAbierto(false)}>Cancelar</Button><Button type="submit">{editando ? 'Guardar Cambios' : 'Crear Conexión'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
