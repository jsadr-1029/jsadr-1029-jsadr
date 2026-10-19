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
import { Plus, Edit, Trash2, CreditCard, Star, Phone, Mail, User } from 'lucide-react'
import { apiFetch } from './helpers'

const BANCOS = [
  'Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Banco Agrario',
  'Banco de Occidente', 'Colpatria', 'AV Villas', 'Scotiabank',
  'Nequi', 'Daviplata', 'PSE', 'Efecty', 'Supergiros', 'Otro',
]

const TIPOS_CUENTA = ['AHORROS', 'CORRIENTE', 'NEQUI', 'DAVIPLATA', 'PSE', 'EFECTY', 'OTRO']

const COLORES_TIPO: Record<string, string> = {
  AHORROS: 'bg-blue-100 text-blue-800 border-blue-300',
  CORRIENTE: 'bg-purple-100 text-purple-800 border-purple-300',
  NEQUI: 'bg-pink-100 text-pink-800 border-pink-300',
  DAVIPLATA: 'bg-orange-100 text-orange-800 border-orange-300',
  PSE: 'bg-green-100 text-green-800 border-green-300',
  EFECTY: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  OTRO: 'bg-gray-100 text-gray-800 border-gray-300',
}

export function CuentasPagoPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [cuentas, setCuentas] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroContrato, setFiltroContrato] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    contratoId: '', banco: 'Bancolombia', tipoCuenta: 'AHORROS',
    numeroCuenta: '', titularCuenta: '', tipoIdTitular: 'CC', numeroIdTitular: '',
    emailPago: '', telefonoPago: '', instrucciones: '', referenciaSugerida: '',
    esPrincipal: false,
  })

  const cargar = async () => {
    setLoading(true)
    const [rc, rct] = await Promise.all([
      apiFetch('/api/vehiculos/cuentas-pago' + (filtroContrato ? `?contratoId=${filtroContrato}` : '')),
      apiFetch('/api/vehiculos/contratos'),
    ])
    if (rc.success) setCuentas(rc.data || [])
    if (rct.success) setContratos(rct.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroContrato])

  const abrirCrear = () => {
    setEditando(null)
    setForm({
      contratoId: '', banco: 'Bancolombia', tipoCuenta: 'AHORROS',
      numeroCuenta: '', titularCuenta: '', tipoIdTitular: 'CC', numeroIdTitular: '',
      emailPago: '', telefonoPago: '', instrucciones: '', referenciaSugerida: '',
      esPrincipal: false,
    })
    setModalOpen(true)
  }

  const abrirEditar = (c: any) => {
    setEditando(c)
    setForm({ ...c })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.contratoId || !form.banco || !form.tipoCuenta || !form.numeroCuenta || !form.titularCuenta) {
      toast({ title: 'Faltan campos', variant: 'destructive' })
      return
    }
    const url = editando ? `/api/vehiculos/cuentas-pago/${editando.id}` : '/api/vehiculos/cuentas-pago'
    const method = editando ? 'PUT' : 'POST'
    const r = await apiFetch(url, { method, body: JSON.stringify(form) })
    if (r.success) {
      toast({ title: editando ? 'Cuenta actualizada' : 'Cuenta creada' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const eliminar = async (c: any) => {
    if (!confirm(`¿Desactivar la cuenta ${c.banco} ${c.numeroCuenta}?`)) return
    const r = await apiFetch(`/api/vehiculos/cuentas-pago/${c.id}`, { method: 'DELETE' })
    if (r.success) {
      toast({ title: 'Cuenta desactivada' })
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const getContrato = (id: string) => contratos.find(c => c.id === id)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroContrato || 'TODOS'} onValueChange={v => setFiltroContrato(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Filtrar por contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los contratos</SelectItem>
            {contratos.filter(c => c.estado === 'ACTIVO').map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.numeroContrato} - {c.conductor?.nombre} ({c.vehiculo?.placa})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nueva cuenta de pago
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : cuentas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay cuentas de pago registradas. Crea la primera para que el conductor sepa dónde pagar.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cuentas.map(c => {
            const contrato = getContrato(c.contratoId)
            return (
              <Card key={c.id} className={`border shadow-sm ${c.esPrincipal ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-bold">{c.banco}</div>
                        <Badge className={`text-xs ${COLORES_TIPO[c.tipoCuenta] || COLORES_TIPO.OTRO}`}>{c.tipoCuenta}</Badge>
                      </div>
                    </div>
                    {c.esPrincipal && (
                      <Badge className="bg-blue-600 text-white">
                        <Star className="w-3 h-3 mr-1 fill-current" /> Principal
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-sm mt-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Titular:</span>
                      <strong>{c.titularCuenta}</strong>
                      {c.numeroIdTitular && <span className="text-xs text-muted-foreground">({c.tipoIdTitular} {c.numeroIdTitular})</span>}
                    </div>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded border">
                      {c.numeroCuenta}
                    </div>
                    {c.telefonoPago && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{c.telefonoPago}</span>
                      </div>
                    )}
                    {c.emailPago && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs">{c.emailPago}</span>
                      </div>
                    )}
                    {c.referenciaSugerida && (
                      <div className="text-xs text-blue-700">Referencia sugerida: {c.referenciaSugerida}</div>
                    )}
                    {c.instrucciones && (
                      <div className="text-xs text-muted-foreground mt-1 p-1.5 bg-yellow-50 rounded">💡 {c.instrucciones}</div>
                    )}
                    {contrato && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        Contrato: {contrato.numeroContrato} · {contrato.conductor?.nombre} · {contrato.vehiculo?.placa}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 mt-3">
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>
                      <Edit className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => eliminar(c)} className="text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar cuenta de pago' : 'Nueva cuenta de pago'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Contrato *</Label>
              <Select value={form.contratoId} onValueChange={v => setForm({ ...form, contratoId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.filter(c => c.estado === 'ACTIVO').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numeroContrato} - {c.conductor?.nombre} ({c.vehiculo?.placa})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco / Plataforma *</Label>
              <Select value={form.banco} onValueChange={v => setForm({ ...form, banco: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de cuenta *</Label>
              <Select value={form.tipoCuenta} onValueChange={v => setForm({ ...form, tipoCuenta: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CUENTA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Número de cuenta / teléfono *</Label>
              <Input value={form.numeroCuenta} onChange={e => setForm({ ...form, numeroCuenta: e.target.value })}
                placeholder="ej: 1234 5678 9012 (cuenta) o 3001234567 (Nequi)" />
            </div>
            <div className="col-span-2">
              <Label>Titular (a nombre de quién) *</Label>
              <Input value={form.titularCuenta} onChange={e => setForm({ ...form, titularCuenta: e.target.value })}
                placeholder="Nombre del titular de la cuenta" />
            </div>
            <div>
              <Label>Tipo ID titular</Label>
              <Select value={form.tipoIdTitular || 'CC'} onValueChange={v => setForm({ ...form, tipoIdTitular: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula (CC)</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="CE">Cédula extranjería</SelectItem>
                  <SelectItem value="TI">Tarjeta identidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número ID titular</Label>
              <Input value={form.numeroIdTitular} onChange={e => setForm({ ...form, numeroIdTitular: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono para pago (Nequi/Daviplata)</Label>
              <Input value={form.telefonoPago} onChange={e => setForm({ ...form, telefonoPago: e.target.value })}
                placeholder="ej: 3001234567" />
            </div>
            <div>
              <Label>Email para notificación de pago</Label>
              <Input type="email" value={form.emailPago} onChange={e => setForm({ ...form, emailPago: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Referencia sugerida para el pago</Label>
              <Input value={form.referenciaSugerida} onChange={e => setForm({ ...form, referenciaSugerida: e.target.value })}
                placeholder="ej: ABC123-CARLOS (para que el conductor use como referencia)" />
            </div>
            <div className="col-span-2">
              <Label>Instrucciones para el conductor</Label>
              <Textarea value={form.instrucciones} onChange={e => setForm({ ...form, instrucciones: e.target.value })}
                rows={2} placeholder="ej: Enviar comprobante al WhatsApp 3001234567 o por el portal" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="esPrincipal"
                checked={form.esPrincipal}
                onChange={e => setForm({ ...form, esPrincipal: e.target.checked })}
              />
              <Label htmlFor="esPrincipal">Marcar como cuenta principal (preferida para el conductor)</Label>
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
