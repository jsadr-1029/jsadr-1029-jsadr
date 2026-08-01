'use client'

import { useEffect, useState } from 'react'
import { PageHeader, EstadoBadge } from '@/components/ui-basics'
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
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import { Scale, Plus, Eye, Calendar, FileText, Bell, CheckCircle, Download, FileDown, FileText as FileWord } from 'lucide-react'
import { BitacoraPanel } from '@/components/views/BitacoraPanel'
import { PortalAbogadoView } from '@/components/views/PortalAbogadoView'
import { BotIcons } from '@/components/views/BotIcons'

interface CasoJuridico {
  id: string
  estado: string
  abogadoNombre: string | null
  abogadoTelefono: string | null
  abogadoEmail: string | null
  honorarios: number
  juzgado: string | null
  radicado: string | null
  descripcion: string | null
  fechaApertura: string
  fechaCierre: string | null
  createdAt: string
  prestamo: any
  cronologia: any[]
  documentos: any[]
  alertas: any[]
}

export function JuridicoView({ onChanged }: { onChanged: () => void }) {
  const [casos, setCasos] = useState<CasoJuridico[]>([])
  const [loading, setLoading] = useState(true)
  const [casoSeleccionado, setCasoSeleccionado] = useState<CasoJuridico | null>(null)
  const [modalNuevoCaso, setModalNuevoCaso] = useState(false)
  const [tab, setTab] = useState('casos')
  const { toast } = useToast()

  // Form nuevo caso
  const [prestamoId, setPrestamoId] = useState('')
  const [prestamosDisponibles, setPrestamosDisponibles] = useState<any[]>([])
  const [abogadoNombre, setAbogadoNombre] = useState('')
  const [abogadoTelefono, setAbogadoTelefono] = useState('')
  const [abogadoEmail, setAbogadoEmail] = useState('')
  const [honorarios, setHonorarios] = useState('')
  const [juzgado, setJuzgado] = useState('')
  const [radicado, setRadicado] = useState('')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/juridico')
      const json = await res.json()
      if (json.success) setCasos(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cargarPrestamosDisponibles = async () => {
    // Traer préstamos activos/mora que no tengan caso jurídico
    const res = await fetch('/api/prestamos?estado=EN_MORA')
    const json = await res.json()
    const morosos = json.success ? json.data : []
    const res2 = await fetch('/api/prestamos?estado=ACTIVO')
    const json2 = await res2.json()
    const activos = json2.success ? json2.data : []
    setPrestamosDisponibles([...morosos, ...activos])
  }

  const abrirNuevoCaso = async () => {
    await cargarPrestamosDisponibles()
    setModalNuevoCaso(true)
  }

  const crearCaso = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/juridico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestamoId,
          abogadoNombre,
          abogadoTelefono,
          abogadoEmail,
          honorarios,
          juzgado,
          radicado,
          descripcion,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Caso jurídico creado',
          description: `WhatsApp ${json.whatsapp?.exito ? 'enviado' : 'falló'}.`,
        })
        setModalNuevoCaso(false)
        limpiarForm()
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const limpiarForm = () => {
    setPrestamoId('')
    setAbogadoNombre('')
    setAbogadoTelefono('')
    setAbogadoEmail('')
    setHonorarios('')
    setJuzgado('')
    setRadicado('')
    setDescripcion('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurídico"
        subtitle="Seguimiento de casos legales, cobro judicial y portal de abogados"
        icon={<Scale className="w-5 h-5" />}
      />

      <BotIcons modulo="juridico" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-md mb-4">
          <TabsTrigger value="casos">Casos Jurídicos</TabsTrigger>
          <TabsTrigger value="portal-abogado">Portal Abogado</TabsTrigger>
        </TabsList>

      <TabsContent value="casos" className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={abrirNuevoCaso}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Caso
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Préstamo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Abogado</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Honorarios</TableHead>
                <TableHead>Apertura</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : casos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay casos jurídicos registrados. Crea el primero con el botón "Nuevo Caso".
                  </TableCell>
                </TableRow>
              ) : (
                casos.map((caso) => (
                  <TableRow key={caso.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{caso.prestamo.codigo}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{caso.prestamo.cliente.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {caso.prestamo.cliente.cedula}
                      </div>
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={caso.estado} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {caso.abogadoNombre ? (
                        <div>
                          <div className="font-medium">{caso.abogadoNombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {caso.abogadoTelefono}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {formatearMoneda(caso.prestamo.saldoTotal)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {caso.honorarios > 0 ? formatearMoneda(caso.honorarios) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatearFecha(caso.fechaApertura)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCasoSeleccionado(caso)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal nuevo caso */}
      <Dialog open={modalNuevoCaso} onOpenChange={setModalNuevoCaso}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abrir Caso Jurídico</DialogTitle>
          </DialogHeader>
          <form onSubmit={crearCaso} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prestamo">Préstamo a derivar *</Label>
              <Select value={prestamoId} onValueChange={setPrestamoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el préstamo moroso" />
                </SelectTrigger>
                <SelectContent>
                  {prestamosDisponibles.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No hay préstamos disponibles
                    </SelectItem>
                  ) : (
                    prestamosDisponibles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.cliente.nombre} - Saldo: {formatearMoneda(p.saldoTotal)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Datos del Abogado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="abogadoNombre">Nombre del abogado</Label>
                  <Input
                    id="abogadoNombre"
                    value={abogadoNombre}
                    onChange={(e) => setAbogadoNombre(e.target.value)}
                    placeholder="Dr. Juan Abogado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abogadoTelefono">Teléfono</Label>
                  <Input
                    id="abogadoTelefono"
                    value={abogadoTelefono}
                    onChange={(e) => setAbogadoTelefono(e.target.value)}
                    placeholder="3001234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abogadoEmail">Email</Label>
                  <Input
                    id="abogadoEmail"
                    type="email"
                    value={abogadoEmail}
                    onChange={(e) => setAbogadoEmail(e.target.value)}
                    placeholder="abogado@estudio.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="honorarios">Honorarios (COP)</Label>
                  <Input
                    id="honorarios"
                    type="number"
                    step="0.01"
                    value={honorarios}
                    onChange={(e) => setHonorarios(e.target.value)}
                    placeholder="500000"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Datos del Proceso</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="juzgado">Juzgado</Label>
                  <Input
                    id="juzgado"
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    placeholder="Juzgado X Civil del Circuito"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radicado">Radicado</Label>
                  <Input
                    id="radicado"
                    value={radicado}
                    onChange={(e) => setRadicado(e.target.value)}
                    placeholder="2024-00123"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción del caso</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Motivo de la acción legal, antecedentes, situación actual..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNuevoCaso(false)}>
                Cancelar
              </Button>
              <Button type="submit">Abrir Caso</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal detalle caso */}
      {casoSeleccionado && (
        <DetalleCasoModal
          caso={casoSeleccionado}
          onClose={() => setCasoSeleccionado(null)}
          onChanged={() => {
            cargar()
            onChanged()
          }}
        />
      )}
      </TabsContent>

      <TabsContent value="portal-abogado">
        <PortalAbogadoView />
      </TabsContent>
      </Tabs>
    </div>
  )
}

function DetalleCasoModal({
  caso,
  onClose,
  onChanged,
}: {
  caso: CasoJuridico
  onClose: () => void
  onChanged: () => void
}) {
  const [nuevoEvento, setNuevoEvento] = useState({
    tipoEvento: 'NOTIFICACION',
    titulo: '',
    descripcion: '',
    resultado: '',
    actor: '',
    monto: '',
  })
  const [nuevaAlerta, setNuevaAlerta] = useState({
    tipo: 'SEGUIMIENTO',
    descripcion: '',
    fechaAlerta: '',
  })
  const { toast } = useToast()

  const actualizarCaso = async (data: any) => {
    try {
      const res = await fetch(`/api/juridico/${caso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Caso actualizado' })
        onChanged()
        onClose()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const agregarEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/juridico/${caso.id}/cronologia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoEvento),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Evento agregado' })
        setNuevoEvento({ tipoEvento: 'NOTIFICACION', titulo: '', descripcion: '', resultado: '', actor: '', monto: '' })
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const agregarAlerta = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/juridico/${caso.id}/alertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaAlerta),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Alerta creada' })
        setNuevaAlerta({ tipo: 'SEGUIMIENTO', descripcion: '', fechaAlerta: '' })
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Caso Jurídico</span>
            <EstadoBadge estado={caso.estado} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {caso.prestamo.codigo} - {caso.prestamo.cliente.nombre} - Saldo: {formatearMoneda(caso.prestamo.saldoTotal)}
          </p>
        </DialogHeader>

        {/* Botones de exportación */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/api/juridico/${caso.id}/exportar?formato=pdf`, '_blank')}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/api/juridico/${caso.id}/exportar?formato=word`, '_blank')}
          >
            <FileWord className="w-4 h-4 mr-2" />
            Exportar Word
          </Button>
        </div>

        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="cronologia">Cronología</TabsTrigger>
            <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          {/* INFO */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">Abogado</p>
                <p className="font-medium">{caso.abogadoNombre || 'Sin asignar'}</p>
                <p className="text-xs">{caso.abogadoTelefono}</p>
                <p className="text-xs">{caso.abogadoEmail}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">Honorarios</p>
                <p className="font-medium">
                  {caso.honorarios > 0 ? formatearMoneda(caso.honorarios) : '—'}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">Juzgado</p>
                <p className="font-medium">{caso.juzgado || '—'}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">Radicado</p>
                <p className="font-medium">{caso.radicado || '—'}</p>
              </div>
            </div>

            {caso.descripcion && (
              <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                <p className="text-sm">{caso.descripcion}</p>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold">Cambiar estado del caso</h4>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => actualizarCaso({ estado: 'PRE_JUDICIAL' })}>
                  Pre-judicial
                </Button>
                <Button size="sm" variant="outline" onClick={() => actualizarCaso({ estado: 'DEMANDA' })}>
                  Demanda
                </Button>
                <Button size="sm" variant="outline" onClick={() => actualizarCaso({ estado: 'EJECUCION' })}>
                  Ejecución
                </Button>
                <Button size="sm" variant="outline" onClick={() => actualizarCaso({ estado: 'COBRO_JUDICIAL' })}>
                  Cobro Judicial
                </Button>
                <Button size="sm" variant="outline" onClick={() => actualizarCaso({ estado: 'CONCILIACION' })}>
                  Conciliación
                </Button>
                <Button size="sm" variant="outline" className="text-purple-700 border-purple-300" onClick={() => actualizarCaso({ estado: 'SENTENCIA' })}>
                  Sentencia
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => actualizarCaso({ estado: 'CERRADO' })}
                >
                  Cerrar Caso
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* CRONOLOGÍA */}
          <TabsContent value="cronologia" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agregar Evento</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={agregarEvento} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de evento</Label>
                    <Select
                      value={nuevoEvento.tipoEvento}
                      onValueChange={(v) => setNuevoEvento({ ...nuevoEvento, tipoEvento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUDIENCIA">Audiencia</SelectItem>
                        <SelectItem value="ESCRITO">Escrito</SelectItem>
                        <SelectItem value="RESOLUCION">Resolución</SelectItem>
                        <SelectItem value="NOTIFICACION">Notificación</SelectItem>
                        <SelectItem value="REUNION">Reunión</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input
                      required
                      value={nuevoEvento.titulo}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })}
                      placeholder="Ej: Audiencia conciliación"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={nuevoEvento.descripcion}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resultado</Label>
                    <Input
                      value={nuevoEvento.resultado}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, resultado: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Actor (quien realizó la acción)</Label>
                    <Input
                      value={nuevoEvento.actor}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, actor: e.target.value })}
                      placeholder="Ej: Dr. Pérez / Juzgado / Cliente"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto (si aplica)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={nuevoEvento.monto}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, monto: e.target.value })}
                      placeholder="Honorarios, pagos parciales..."
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit">Agregar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {caso.cronologia.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin eventos registrados
                </div>
              ) : (
                caso.cronologia.map((ev) => (
                  <div key={ev.id} className="flex gap-3 p-3 border rounded-md">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{ev.titulo}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatearFechaHora(ev.fecha)}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted inline-block mt-1">
                        {ev.tipoEvento}
                      </span>
                      {ev.actor && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 inline-block mt-1 ml-1">
                          👤 {ev.actor}
                        </span>
                      )}
                      {ev.monto && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 inline-block mt-1 ml-1">
                          💰 {formatearMoneda(ev.monto)}
                        </span>
                      )}
                      {ev.descripcion && (
                        <p className="text-sm text-muted-foreground mt-2">{ev.descripcion}</p>
                      )}
                      {ev.resultado && (
                        <p className="text-xs mt-1">
                          <strong>Resultado:</strong> {ev.resultado}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* BITÁCORA */}
          <TabsContent value="bitacora" className="space-y-4">
            <BitacoraPanel
              prestamoId={(caso as any).prestamoId}
              prestamoCodigo={caso.prestamo.codigo}
              usuarioNombre="Administrador"
            />
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alertas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Crear Alerta</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={agregarAlerta} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={nuevaAlerta.tipo}
                      onValueChange={(v) => setNuevaAlerta({ ...nuevaAlerta, tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUDIENCIA">Audiencia</SelectItem>
                        <SelectItem value="PLAZO_LEGAL">Plazo legal</SelectItem>
                        <SelectItem value="VENCIMIENTO">Vencimiento</SelectItem>
                        <SelectItem value="SEGUIMIENTO">Seguimiento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={nuevaAlerta.fechaAlerta}
                      onChange={(e) => setNuevaAlerta({ ...nuevaAlerta, fechaAlerta: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descripción</Label>
                    <Input
                      required
                      value={nuevaAlerta.descripcion}
                      onChange={(e) => setNuevaAlerta({ ...nuevaAlerta, descripcion: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Button type="submit">
                      <Bell className="w-4 h-4 mr-2" />
                      Crear Alerta
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {caso.alertas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin alertas configuradas
                </div>
              ) : (
                caso.alertas.map((al) => (
                  <div
                    key={al.id}
                    className={`flex items-center gap-3 p-3 border rounded-md ${
                      al.atendida ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
                    }`}
                  >
                    <Bell className={`w-4 h-4 ${al.atendida ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{al.descripcion}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatearFechaHora(al.fechaAlerta)}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted inline-block mt-1">
                        {al.tipo}
                      </span>
                    </div>
                    {!al.atendida && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-600"
                        onClick={async () => {
                          await fetch(`/api/juridico/${caso.id}/alertas`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ alertaId: al.id, atendida: true }),
                          })
                          onChanged()
                          onClose()
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* DOCUMENTOS */}
          <TabsContent value="documentos" className="space-y-4">
            <div className="space-y-2">
              {caso.documentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin documentos registrados. Puedes ver el pagaré del préstamo en la sección de Préstamos.
                </div>
              ) : (
                caso.documentos.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-md">
                    <FileText className="w-4 h-4 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{doc.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.tipo} · {formatearFecha(doc.fechaSubida)}
                      </div>
                      {doc.descripcion && (
                        <p className="text-xs mt-1">{doc.descripcion}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Para generar documentos legales automáticos (pagaré, carta de instrucciones),
                ve a la sección <strong>Préstamos</strong> y abre el detalle del préstamo.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
