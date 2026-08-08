'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent } from '@/components/ui/card'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  MapPin,
  Pencil,
  UserCheck,
  UserX,
  UserPlus,
  Landmark,
  Percent,
  AlertCircle,
} from 'lucide-react'
import { SolicitudesPendientesPanel } from './SolicitudesPendientesPanel'

interface ReferidorInfo {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string | null
  departamento: string | null
  municipio: string | null
  direccion: string | null
  bancoCliente: string | null
  tipoCuentaCliente: string | null
  numeroCuentaCliente: string | null
}

interface ReferidoMini {
  id: string
  nombre: string
  cedula: string
  telefono: string
  createdAt: string
  activo: boolean
}

interface Cliente {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string | null
  departamento: string | null
  municipio: string | null
  salario: number | null
  fechaIngreso: string | null
  direccion: string | null
  ciudad: string | null
  barrio: string | null
  notas: string | null
  bancoCliente: string | null
  tipoCuentaCliente: string | null
  numeroCuentaCliente: string | null
  activo: boolean
  tieneTasaPersonalizada: boolean
  tasaPersonalizada: number | null
  referidoPorId: string | null
  referidoPor: ReferidorInfo | null
  referidos?: ReferidoMini[]
  categoriaId: string | null
  // === Cuenta de recaudo asignada (v3.7) ===
  cuentaRecaudoId: string | null
  cuentaRecaudo?: { id: string; codigo: string; nombre: string; banco: string; tipoCuenta: string; numeroCuenta: string } | null
  instruccionCuentaId: string | null
  instruccionCuentaNota: string | null
  instruccionCuentaExpira: string | null
  // === Preferencia de notificación (v4.4) ===
  preferenciaNotificacion?: 'WHATSAPP' | 'EMAIL' | 'AMBOS' | 'NINGUNO' | null
  createdAt: string
  _count?: { prestamos: number; referidos: number }
}

interface FormData {
  nombre: string
  cedula: string
  telefono: string
  email: string
  departamento: string
  municipio: string
  salario: string
  fechaIngreso: string
  direccion: string
  ciudad: string
  barrio: string
  notas: string
  bancoCliente: string
  tipoCuentaCliente: string
  numeroCuentaCliente: string
  referidoPorId: string
  categoriaId: string
  tieneTasaPersonalizada: boolean
  tasaPersonalizada: string
  // === Cuenta de recaudo asignada (v3.7) ===
  cuentaRecaudoId: string
  instruccionCuentaId: string
  instruccionCuentaNota: string
  instruccionCuentaExpira: string
  // === Preferencia de notificación (v4.4) ===
  preferenciaNotificacion: 'WHATSAPP' | 'EMAIL' | 'AMBOS' | 'NINGUNO'
}

const VACIO: FormData = {
  nombre: '',
  cedula: '',
  telefono: '',
  email: '',
  departamento: '',
  municipio: '',
  salario: '',
  fechaIngreso: '',
  direccion: '',
  ciudad: '',
  barrio: '',
  notas: '',
  bancoCliente: '',
  tipoCuentaCliente: '',
  numeroCuentaCliente: '',
  referidoPorId: '',
  categoriaId: '',
  tieneTasaPersonalizada: false,
  tasaPersonalizada: '',
  // === Cuenta de recaudo asignada (v3.7) ===
  cuentaRecaudoId: '',
  instruccionCuentaId: '',
  instruccionCuentaNota: '',
  instruccionCuentaExpira: '',
  // === Preferencia de notificación (v4.4) ===
  preferenciaNotificacion: 'WHATSAPP',
}

export function ClientesView({ onChanged }: { onChanged: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormData>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    cargar()
    cargarCategorias()
    cargarCuentas()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/clientes')
      const json = await res.json()
      if (json.success) setClientes(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cargarCategorias = async () => {
    try {
      const res = await fetch('/api/categorias')
      const json = await res.json()
      if (json.success) setCategorias(json.data)
    } catch (e) {
      console.error(e)
    }
  }

  const cargarCuentas = async () => {
    try {
      const res = await fetch('/api/cuentas')
      const json = await res.json()
      if (json.success) setCuentas(json.data)
    } catch (e) {
      console.error(e)
    }
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const q = busqueda.toLowerCase()
      const matchBusqueda =
        c.nombre.toLowerCase().includes(q) ||
        c.cedula.includes(q) ||
        c.telefono.includes(q) ||
        (c.municipio || '').toLowerCase().includes(q) ||
        (c.referidoPor?.nombre || '').toLowerCase().includes(q)
      const matchEstado =
        filtroActivo === 'todos' ||
        (filtroActivo === 'activos' && c.activo) ||
        (filtroActivo === 'inactivos' && !c.activo)
      return matchBusqueda && matchEstado
    })
  }, [clientes, busqueda, filtroActivo])

  // Clientes disponibles como referidores (todos menos el que se está editando)
  const referidoresDisponibles = useMemo(() => {
    return clientes.filter((c) => c.id !== editandoId && c.activo)
  }, [clientes, editandoId])

  // Información del referidor seleccionado en el formulario
  const referidorSeleccionado = useMemo(() => {
    if (!form.referidoPorId) return null
    return clientes.find((c) => c.id === form.referidoPorId) || null
  }, [form.referidoPorId, clientes])

  const abrirModalNuevo = () => {
    setForm(VACIO)
    setEditandoId(null)
    setModalAbierto(true)
  }

  const abrirModalEditar = (cliente: Cliente) => {
    setForm({
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      email: cliente.email || '',
      departamento: cliente.departamento || '',
      municipio: cliente.municipio || '',
      salario: cliente.salario?.toString() || '',
      fechaIngreso: cliente.fechaIngreso
        ? new Date(cliente.fechaIngreso).toISOString().slice(0, 10)
        : '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      barrio: cliente.barrio || '',
      notas: cliente.notas || '',
      bancoCliente: cliente.bancoCliente || '',
      tipoCuentaCliente: cliente.tipoCuentaCliente || '',
      numeroCuentaCliente: cliente.numeroCuentaCliente || '',
      referidoPorId: cliente.referidoPorId || '',
      categoriaId: cliente.categoriaId || '',
      tieneTasaPersonalizada: cliente.tieneTasaPersonalizada ?? false,
      tasaPersonalizada:
        cliente.tasaPersonalizada != null
          ? cliente.tasaPersonalizada.toString()
          : '',
      // === Cuenta de recaudo asignada (v3.7) ===
      cuentaRecaudoId: cliente.cuentaRecaudoId || '',
      instruccionCuentaId: cliente.instruccionCuentaId || '',
      instruccionCuentaNota: cliente.instruccionCuentaNota || '',
      instruccionCuentaExpira: cliente.instruccionCuentaExpira
        ? new Date(cliente.instruccionCuentaExpira).toISOString().slice(0, 10)
        : '',
      // === Preferencia de notificación (v4.4) ===
      preferenciaNotificacion: cliente.preferenciaNotificacion || 'WHATSAPP',
    })
    setEditandoId(cliente.id)
    setModalAbierto(true)
  }

  const abrirModalDetalle = async (cliente: Cliente) => {
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`)
      const json = await res.json()
      if (json.success) {
        setClienteDetalle(json.data)
        setModalDetalle(true)
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      })
    }
  }

  const toggleActivo = async (cliente: Cliente) => {
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !cliente.activo }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: cliente.activo ? 'Cliente desactivado' : 'Cliente activado',
          description: `${cliente.nombre} ahora está ${
            cliente.activo ? 'inactivo' : 'activo'
          }`,
        })
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (guardando) return
    // === Validación obligatoria de categoría ===
    if (!form.categoriaId) {
      toast({
        title: 'Categoría requerida',
        description: 'Debe seleccionar una categoría antes de crear el cliente. La categoría define el monto máximo, la tasa y la cuenta de recaudo.',
        variant: 'destructive',
      })
      return
    }
    setGuardando(true)

    try {
      const url = editandoId ? `/api/clientes/${editandoId}` : '/api/clientes'
      const method = editandoId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        // === v4.13 — Mostrar información de la clave temporal generada ===
        // Si el backend envió la clave temporal en la respuesta (porque el cliente
        // no tiene email o el envío falló), se la mostramos al gestor para que
        // la comunique por otro canal. Si el email se envió correctamente, sólo
        // mostramos el mensaje de éxito.
        if (!editandoId) {
          if (json.claveTemporal) {
            // Mostrar la clave temporal en un toast de larga duración
            toast({
              title: '🔐 Cliente creado — Clave temporal',
              description: `${json.mensaje || 'Comunica esta clave al cliente:'} — CLAVE: ${json.claveTemporal}`,
              duration: 12000,
            })
            // También intentar copiar al portapapeles para facilitar la comunicación
            try {
              navigator.clipboard?.writeText(json.claveTemporal)
              toast({
                title: 'Clave copiada',
                description: 'La clave temporal se copió al portapapeles.',
                duration: 4000,
              })
            } catch {}
          } else if (json.emailEnviado) {
            toast({
              title: 'Cliente creado',
              description: json.mensaje || `Se envió la clave temporal al correo del cliente.`,
              duration: 6000,
            })
          } else {
            toast({
              title: 'Cliente creado',
              description: `${form.nombre} registrado correctamente.`,
            })
          }
        } else {
          toast({
            title: 'Cliente actualizado',
            description: `${form.nombre} actualizado correctamente`,
          })
        }
        setModalAbierto(false)
        setForm(VACIO)
        setEditandoId(null)
        cargar()
        onChanged()
        // === ORDEN OBLIGATORIA 3: Abrir vista previa siempre que se termina un proceso ===
        // Tras crear/actualizar el cliente, abrir automáticamente el modal de detalle
        // para que el usuario vea los datos guardados (categoría, cuenta, saldos, etc.)
        if (json.data?.id) {
          const nuevoCliente: Cliente = json.data
          setTimeout(() => {
            abrirModalDetalle(nuevoCliente)
          }, 400)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const activos = clientes.filter((c) => c.activo).length
    const inactivos = clientes.length - activos
    const conReferidor = clientes.filter((c) => c.referidoPorId).length
    return { total: clientes.length, activos, inactivos, conReferidor }
  }, [clientes])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Registro de clientes, referidos y datos bancarios"
        icon={<Users className="w-5 h-5" />}
        actions={
          <Button onClick={abrirModalNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        }
      />

      {/* Solicitudes de registro pendientes (desde el formulario público /register) */}
      <SolicitudesPendientesPanel
        categorias={categorias}
        cuentas={cuentas}
        onClienteCreado={cargar}
      />

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Activos
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.activos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <UserX className="w-3 h-3" /> Inactivos
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.inactivos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <UserPlus className="w-3 h-3" /> Con referidor
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.conReferidor}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cédula, teléfono, municipio o referidor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filtroActivo}
          onValueChange={(v: any) => setFiltroActivo(v)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Solo activos</SelectItem>
            <SelectItem value="inactivos">Solo inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Referido por</TableHead>
                <TableHead>Tasa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Préstamos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : clientesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay clientes que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                clientesFiltrados.map((c) => (
                  <TableRow
                    key={c.id}
                    className={`hover:bg-muted/40 cursor-pointer ${!c.activo ? 'opacity-60' : ''}`}
                    onClick={() => abrirModalDetalle(c)}
                  >
                    <TableCell>
                      <div className="font-semibold">{c.nombre}</div>
                      {c.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.cedula}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{c.telefono}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.municipio || c.departamento ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span>
                            {c.municipio || '—'}
                            {c.departamento && (
                              <span className="text-xs text-muted-foreground">
                                {' '}
                                / {c.departamento}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.referidoPor ? (
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1">
                            <UserPlus className="w-3 h-3 text-blue-600" />
                            {c.referidoPor.nombre}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {c.referidoPor.cedula}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.tieneTasaPersonalizada && c.tasaPersonalizada != null ? (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                          Tasa: {c.tasaPersonalizada}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Sin tasa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.activo ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {c._count?.prestamos || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirModalEditar(c)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActivo(c)}
                          title={c.activo ? 'Desactivar' : 'Activar'}
                        >
                          {c.activo ? (
                            <UserX className="w-4 h-4 text-red-600" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal nuevo/editar cliente */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editandoId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Datos básicos */}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Datos personales</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input
                  id="nombre"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula *</Label>
                <Input
                  id="cedula"
                  required
                  placeholder="1234567890"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono WhatsApp *</Label>
                <Input
                  id="telefono"
                  required
                  placeholder="3001234567"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Se usará para enviar notificaciones automáticas
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {/* Preferencia de notificación de pagos (v4.4) */}
            <div className="space-y-3 pt-2 border-t">
              <div>
                <h4 className="text-sm font-semibold">Recordatorios de pago</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ¿Cómo deseas que el sistema le recuerde al cliente las cuotas próximas a vencer?
                  Se enviará automáticamente un recordatorio el día anterior al vencimiento.
                </p>
              </div>
              <RadioGroup
                value={form.preferenciaNotificacion}
                onValueChange={(val: 'WHATSAPP' | 'EMAIL' | 'AMBOS' | 'NINGUNO') =>
                  setForm({ ...form, preferenciaNotificacion: val })
                }
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {[
                  { value: 'WHATSAPP', label: 'WhatsApp', icon: '💬', desc: 'Solo al teléfono' },
                  { value: 'EMAIL', label: 'Correo', icon: '📧', desc: 'Solo al email' },
                  { value: 'AMBOS', label: 'Ambos', icon: '📱', desc: 'WhatsApp + correo', recommended: true },
                  { value: 'NINGUNO', label: 'Ninguno', icon: '🔕', desc: 'Sin recordatorios' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`pref-${opt.value}`}
                    className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-accent/40 ${
                      form.preferenciaNotificacion === opt.value
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-muted opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id={`pref-${opt.value}`} value={opt.value} />
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-sm font-semibold">{opt.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground pl-6">{opt.desc}</span>
                  </label>
                ))}
              </RadioGroup>
              {(form.preferenciaNotificacion === 'EMAIL' || form.preferenciaNotificacion === 'AMBOS') && !form.email && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠️ Seleccionaste correo, pero falta el email. Ingrésalo arriba para que el recordatorio llegue.
                </p>
              )}
            </div>

            {/* Ubicación */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold">Ubicación</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  placeholder="Cundinamarca"
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="municipio">Municipio</Label>
                <Input
                  id="municipio"
                  placeholder="Soacha"
                  value={form.municipio}
                  onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  placeholder="Bogotá"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barrio">Barrio</Label>
                <Input
                  id="barrio"
                  placeholder="Centro"
                  value={form.barrio}
                  onChange={(e) => setForm({ ...form, barrio: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                placeholder="Calle 123 #45-67"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>

            {/* Datos bancarios */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Datos bancarios
              </h4>
              <p className="text-xs text-muted-foreground">
                Cuenta donde el cliente recibe pagos o donde se descuentan cuotas
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bancoCliente">Banco</Label>
                <Input
                  id="bancoCliente"
                  placeholder="Bancolombia"
                  value={form.bancoCliente}
                  onChange={(e) => setForm({ ...form, bancoCliente: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipoCuentaCliente">Tipo de cuenta</Label>
                <Select
                  value={form.tipoCuentaCliente || 'none'}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      tipoCuentaCliente: v === 'none' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger id="tipoCuentaCliente">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin definir —</SelectItem>
                    <SelectItem value="AHORROS">Ahorros</SelectItem>
                    <SelectItem value="CORRIENTE">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroCuentaCliente">Número de cuenta</Label>
                <Input
                  id="numeroCuentaCliente"
                  placeholder="000-000-000"
                  value={form.numeroCuentaCliente}
                  onChange={(e) =>
                    setForm({ ...form, numeroCuentaCliente: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Configuración de Tasa de Interés */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Percent className="w-4 h-4" /> Configuración de Tasa de Interés
              </h4>
              <p className="text-xs text-muted-foreground">
                Define si el cliente tiene una tasa personalizada (mensual fija sobre capital inicial)
                aplicable a sus solicitudes web.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>¿Tiene tasa personalizada?</Label>
                <RadioGroup
                  value={form.tieneTasaPersonalizada ? 'si' : 'no'}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      tieneTasaPersonalizada: v === 'si',
                      tasaPersonalizada:
                        v === 'si' ? form.tasaPersonalizada : '',
                    })
                  }
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="tasa-si" value="si" />
                    <Label htmlFor="tasa-si" className="cursor-pointer font-normal">
                      Sí, tasa personalizada
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="tasa-no" value="no" />
                    <Label htmlFor="tasa-no" className="cursor-pointer font-normal">
                      No, usar tasa general
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {form.tieneTasaPersonalizada && (
                <div className="space-y-2">
                  <Label htmlFor="tasaPersonalizada">
                    Tasa personalizada (% mensual)
                  </Label>
                  <Input
                    id="tasaPersonalizada"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1000"
                    placeholder="Ej: 3.5"
                    value={form.tasaPersonalizada}
                    onChange={(e) =>
                      setForm({ ...form, tasaPersonalizada: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tasa mensual fija aplicada sobre el capital inicial. Se usará en lugar de
                    la tasa general al calcular solicitudes web del portal.
                  </p>
                </div>
              )}
            </div>

            {/* Referido por */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Referido por
              </h4>
              <p className="text-xs text-muted-foreground">
                Selecciona el cliente que refirió a esta persona. Quedará como evidencia
                con su responsabilidad en caso de novedades.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="referidoPorId">Cliente referidor</Label>
                <Select
                  value={form.referidoPorId || 'none'}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      referidoPorId: v === 'none' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger id="referidoPorId">
                    <SelectValue placeholder="— Sin referidor —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin referidor —</SelectItem>
                    {referidoresDisponibles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} — CC {c.cedula}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datos del referidor seleccionado */}
              {referidorSeleccionado && (
                <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm">
                  <div className="font-semibold text-blue-900 mb-2 flex items-center gap-1">
                    <UserPlus className="w-4 h-4" /> Datos del referidor
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-blue-900">
                    <div>
                      <span className="text-blue-700">Nombre:</span>{' '}
                      <strong>{referidorSeleccionado.nombre}</strong>
                    </div>
                    <div>
                      <span className="text-blue-700">Cédula:</span>{' '}
                      <span className="font-mono">
                        {referidorSeleccionado.cedula}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700">Teléfono:</span>{' '}
                      <span className="font-mono">
                        {referidorSeleccionado.telefono}
                      </span>
                    </div>
                    {referidorSeleccionado.email && (
                      <div>
                        <span className="text-blue-700">Email:</span>{' '}
                        {referidorSeleccionado.email}
                      </div>
                    )}
                    {(referidorSeleccionado.municipio ||
                      referidorSeleccionado.departamento) && (
                      <div>
                        <span className="text-blue-700">Ubicación:</span>{' '}
                        {[
                          referidorSeleccionado.municipio,
                          referidorSeleccionado.departamento,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                    {referidorSeleccionado.bancoCliente && (
                      <div>
                        <span className="text-blue-700">Banco:</span>{' '}
                        {referidorSeleccionado.bancoCliente}
                        {referidorSeleccionado.tipoCuentaCliente && (
                          <span className="text-blue-700">
                            {' '}
                            ({referidorSeleccionado.tipoCuentaCliente})
                          </span>
                        )}
                      </div>
                    )}
                    {referidorSeleccionado.numeroCuentaCliente && (
                      <div>
                        <span className="text-blue-700">Cuenta:</span>{' '}
                        <span className="font-mono">
                          {referidorSeleccionado.numeroCuentaCliente}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-blue-700 mt-2 italic">
                    Esta información quedará registrada como evidencia del referidor
                    responsable en caso de cualquier novedad con el cliente.
                  </p>
                </div>
              )}
            </div>

            {/* Categoría y otros */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold">Información adicional</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoriaId">
                  Categoría <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.categoriaId || 'none'}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      categoriaId: v === 'none' ? '' : v,
                      // Si el usuario no ha fijado manualmente la cuenta, limpiarla
                      // para que se reasigne automáticamente a la de la categoría en el backend.
                      cuentaRecaudoId: v === 'none' ? '' : form.cuentaRecaudoId,
                    })
                  }
                >
                  <SelectTrigger id="categoriaId">
                    <SelectValue placeholder="Seleccione una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin categoría —</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre} ·{' '}
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.montoMinimo)}–{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.montoMaximo)} · {c.tasaInteresAnual}% anual
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* === Resumen de la categoría seleccionada === */}
                {form.categoriaId && (() => {
                  const cat = categorias.find((c) => c.id === form.categoriaId)
                  if (!cat) return null
                  const fmtCOP = (n: number) =>
                    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
                  return (
                    <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{cat.codigo}</Badge>
                        <span className="font-semibold text-slate-900">{cat.nombre}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Monto mín.</p>
                          <p className="font-semibold text-slate-900">{fmtCOP(cat.montoMinimo)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Monto máx.</p>
                          <p className="font-semibold text-slate-900">{fmtCOP(cat.montoMaximo)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Tasa anual</p>
                          <p className="font-semibold text-slate-900">{cat.tasaInteresAnual}%</p>
                        </div>
                      </div>
                      {cat.cuentaRecaudo ? (
                        <div className="mt-1 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                          <Landmark className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <p className="font-semibold text-amber-900">Cuenta de recaudo asignada</p>
                            <p className="text-amber-800">
                              {cat.cuentaRecaudo.banco} · {cat.cuentaRecaudo.tipoCuenta} ·{' '}
                              <span className="font-mono font-semibold">{cat.cuentaRecaudo.numeroCuenta}</span>
                            </p>
                            <p className="text-amber-700">Titular: {cat.cuentaRecaudo.titular}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                          <p className="text-xs text-red-800">
                            Esta categoría <strong>no tiene cuenta de recaudo asignada</strong>. Configúrela antes de crear clientes en ella.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="salario">Salario</Label>
                <Input
                  id="salario"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.salario}
                  onChange={(e) => setForm({ ...form, salario: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
                <Input
                  id="fechaIngreso"
                  type="date"
                  value={form.fechaIngreso}
                  onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                />
              </div>
            </div>

            {/* === Cuenta de recaudo asignada al cliente (v3.7) === */}
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                Cuenta de pago asignada
              </h4>
              <p className="text-xs text-muted-foreground">
                El cliente debe pagar ÚNICAMENTE a esta cuenta. Si no asignas una,
                se usa la cuenta de su categoría. Los pagos a otra cuenta se rechazan
                automáticamente salvo que exista una instrucción temporal activa.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cuentaRecaudoId">Cuenta asignada al cliente</Label>
                <Select
                  value={form.cuentaRecaudoId || 'none'}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      cuentaRecaudoId: v === 'none' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger id="cuentaRecaudoId">
                    <SelectValue placeholder="Usar cuenta de la categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Usar cuenta de la categoría —</SelectItem>
                    {cuentas.map((cta) => (
                      <SelectItem key={cta.id} value={cta.id} disabled={!cta.activa}>
                        {cta.codigo} — {cta.banco} · {cta.tipoCuenta} ·{' '}
                        <span className="font-mono">{cta.numeroCuenta}</span>
                        {!cta.activa ? ' (inactiva)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <Percent className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-amber-700">
                        Instrucción temporal (opcional)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Activa un cambio temporal de cuenta para este cliente.
                        Útil cuando el gestor instruye pagar a otra cuenta por un tiempo.
                        Expira en la fecha indicada y vuelve automáticamente a la cuenta asignada.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="instruccionCuentaId" className="text-xs">
                          Cuenta temporal
                        </Label>
                        <Select
                          value={form.instruccionCuentaId || 'none'}
                          onValueChange={(v) =>
                            setForm({
                              ...form,
                              instruccionCuentaId: v === 'none' ? '' : v,
                            })
                          }
                        >
                          <SelectTrigger id="instruccionCuentaId">
                            <SelectValue placeholder="Sin instrucción" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sin instrucción —</SelectItem>
                            {cuentas.map((cta) => (
                              <SelectItem key={cta.id} value={cta.id} disabled={!cta.activa}>
                                {cta.codigo} — {cta.banco} · {cta.tipoCuenta}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="instruccionCuentaExpira" className="text-xs">
                          Expira el
                        </Label>
                        <Input
                          id="instruccionCuentaExpira"
                          type="date"
                          value={form.instruccionCuentaExpira}
                          onChange={(e) =>
                            setForm({ ...form, instruccionCuentaExpira: e.target.value })
                          }
                          disabled={!form.instruccionCuentaId}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="instruccionCuentaNota" className="text-xs">
                        Nota (motivo del cambio)
                      </Label>
                      <Input
                        id="instruccionCuentaNota"
                        type="text"
                        placeholder="Ej: Pago puntual a CTA-3 por cierre de mes"
                        value={form.instruccionCuentaNota}
                        onChange={(e) =>
                          setForm({ ...form, instruccionCuentaNota: e.target.value })
                        }
                        disabled={!form.instruccionCuentaId}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                placeholder="Observaciones del cliente"
                rows={2}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando
                  ? 'Guardando...'
                  : editandoId
                  ? 'Guardar Cambios'
                  : 'Crear Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal detalle del cliente */}
      <Dialog open={modalDetalle} onOpenChange={setModalDetalle}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {clienteDetalle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {clienteDetalle.nombre}
                  {clienteDetalle.activo ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactivo</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cédula</Label>
                    <div className="font-mono">{clienteDetalle.cedula}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Teléfono</Label>
                    <div className="font-mono">{clienteDetalle.telefono}</div>
                  </div>
                  {clienteDetalle.email && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div>{clienteDetalle.email}</div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Departamento
                    </Label>
                    <div>{clienteDetalle.departamento || '—'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Municipio</Label>
                    <div>{clienteDetalle.municipio || '—'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Ciudad</Label>
                    <div>{clienteDetalle.ciudad || '—'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Barrio</Label>
                    <div>{clienteDetalle.barrio || '—'}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Dirección</Label>
                    <div>{clienteDetalle.direccion || '—'}</div>
                  </div>
                </div>

                {/* Datos bancarios */}
                {(clienteDetalle.bancoCliente ||
                  clienteDetalle.tipoCuentaCliente ||
                  clienteDetalle.numeroCuentaCliente) && (
                  <div className="p-3 rounded-md bg-muted/50 border">
                    <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Landmark className="w-4 h-4" /> Datos bancarios
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Banco: </span>
                        <strong>{clienteDetalle.bancoCliente || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Tipo: </span>
                        <strong>{clienteDetalle.tipoCuentaCliente || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Cuenta:{' '}
                        </span>
                        <strong className="font-mono">
                          {clienteDetalle.numeroCuentaCliente || '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tasa personalizada */}
                <div className="p-3 rounded-md bg-purple-50 border border-purple-200">
                  <div className="text-sm font-semibold text-purple-900 flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4" /> Tasa de Interés Personalizada
                  </div>
                  {clienteDetalle.tieneTasaPersonalizada ? (
                    <div className="text-sm text-purple-900 space-y-1">
                      <div>
                        <span className="text-purple-700">Tasa aplicable: </span>
                        <strong className="text-base">
                          {clienteDetalle.tasaPersonalizada ?? '—'}%
                        </strong>
                        <span className="text-xs text-purple-700"> mensual fija</span>
                      </div>
                      <p className="text-xs text-purple-700">
                        Esta tasa se aplica sobre el capital inicial en cada cuota de las
                        solicitudes web generadas desde el portal del cliente.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-purple-900">
                      <Badge variant="outline" className="text-purple-700 border-purple-300">
                        Sin tasa personalizada
                      </Badge>
                      <span className="ml-2 text-xs text-purple-700">
                        Las solicitudes web usan la tasa general del sistema.
                      </span>
                    </div>
                  )}
                </div>

                {/* Referidor */}
                {clienteDetalle.referidoPor && (
                  <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-2">
                      <UserPlus className="w-4 h-4" /> Referido por
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-900">
                      <div>
                        <span className="text-blue-700">Nombre: </span>
                        <strong>{clienteDetalle.referidoPor.nombre}</strong>
                      </div>
                      <div>
                        <span className="text-blue-700">Cédula: </span>
                        <span className="font-mono">
                          {clienteDetalle.referidoPor.cedula}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Teléfono: </span>
                        <span className="font-mono">
                          {clienteDetalle.referidoPor.telefono}
                        </span>
                      </div>
                      {clienteDetalle.referidoPor.email && (
                        <div>
                          <span className="text-blue-700">Email: </span>
                          {clienteDetalle.referidoPor.email}
                        </div>
                      )}
                      {clienteDetalle.referidoPor.bancoCliente && (
                        <div>
                          <span className="text-blue-700">Banco: </span>
                          {clienteDetalle.referidoPor.bancoCliente}{' '}
                          {clienteDetalle.referidoPor.tipoCuentaCliente &&
                            `(${clienteDetalle.referidoPor.tipoCuentaCliente})`}
                        </div>
                      )}
                      {clienteDetalle.referidoPor.numeroCuentaCliente && (
                        <div>
                          <span className="text-blue-700">Cuenta: </span>
                          <span className="font-mono">
                            {clienteDetalle.referidoPor.numeroCuentaCliente}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Personas que este cliente refirió */}
                {clienteDetalle._count?.referidos &&
                  clienteDetalle._count.referidos > 0 && (
                    <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                      <div className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Referidos por este cliente (
                        {clienteDetalle._count.referidos})
                      </div>
                      <ul className="space-y-1 text-sm text-amber-900">
                        {clienteDetalle.referidos?.map((r) => (
                          <li key={r.id} className="flex justify-between">
                            <span>
                              {r.nombre} — CC {r.cedula}
                            </span>
                            <span className="text-xs text-amber-700">
                              {formatearFecha(r.createdAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {clienteDetalle.notas && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <div className="text-sm p-2 rounded bg-muted/30 whitespace-pre-wrap">
                      {clienteDetalle.notas}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Registrado el {formatearFecha(clienteDetalle.createdAt)}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModalDetalle(false)
                      abrirModalEditar(clienteDetalle)
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
