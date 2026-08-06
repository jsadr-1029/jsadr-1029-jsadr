'use client'

// Panel de Solicitudes de Nuevos Clientes (registro público desde /register)
// Se incrusta al inicio de ClientesView para que el gestor las revise y convierta.

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda } from '@/lib/finanzas'
import {
  Inbox, RefreshCw, CheckCircle2, XCircle, Eye, Clock, UserPlus,
  Phone, Mail, MapPin, Briefcase, DollarSign, FileText, Camera,
  Calendar, AlertCircle, Copy, ShieldCheck,
} from 'lucide-react'

interface Solicitud {
  id: string
  codigo: string
  nombre: string
  apellido: string
  tipoDocumento: string
  cedula: string
  telefono: string
  email: string | null
  ciudad: string | null
  municipio: string | null
  ocupacion: string | null
  ingresoMensual: number | null
  valorSolicitado: number
  plazoDeseado: number | null
  destinoCredito: string | null
  estado: string
  observaciones: string | null
  createdAt: string
  fechaRevision: string | null
  revisadoPorNombre: string | null
  clienteCreadoId: string | null
  clienteCreadoCodigo: string | null
}

interface SolicitudDetalle extends Solicitud {
  fechaNacimiento: string | null
  direccion: string | null
  referidoPorNombre: string | null
  referidoPorApellido: string | null
  referidoPorTelefono: string | null
  referidoPorParentesco: string | null
  aceptaTyC: boolean
  aceptaTratamientoDatos: boolean
  aceptaConsultaCentrales: boolean
  aceptaReportarCentral: boolean
  fechaAceptacion: string | null
  ipOrigen: string | null
  userAgent: string | null
  fotoCedulaFrente: string | null
  fotoCedulaReverso: string | null
  fotoSelfie: string | null
  fotoCedulaFrenteNombre: string | null
  fotoCedulaReversoNombre: string | null
  fotoSelfieNombre: string | null
}

interface Categoria { id: string; codigo: string; nombre: string }
interface Cuenta { id: string; nombre: string; banco: string }

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  REVISADA: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  APROBADA: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  RECHAZADA: 'bg-red-500/15 text-red-300 border-red-500/30',
  CONVERTIDA: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
}

export function SolicitudesPendientesPanel({
  categorias,
  cuentas,
  onClienteCreado,
}: {
  categorias: Categoria[]
  cuentas: Cuenta[]
  onClienteCreado?: () => void
}) {
  const { toast } = useToast()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [resumen, setResumen] = useState({ total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0, convertidas: 0 })
  const [loading, setLoading] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<string>('PENDIENTE')
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null)
  const [abrirDetalle, setAbrirDetalle] = useState(false)
  const [abrirConvertir, setAbrirConvertir] = useState(false)
  const [abrirRechazar, setAbrirRechazar] = useState(false)
  const [categoriaSel, setCategoriaSel] = useState<string>('')
  const [cuentaSel, setCuentaSel] = useState<string>('')
  const [observaciones, setObservaciones] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultadoConversion, setResultadoConversion] = useState<{ clienteCreadoId: string; cedula: string; pin: string } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes-nuevos-clientes' + (filtroEstado && filtroEstado !== 'all' ? `?estado=${filtroEstado}` : ''))
      const json = await res.json()
      if (json.success) {
        setSolicitudes(json.data)
        setResumen(json.resumen)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, toast])

  useEffect(() => { cargar() }, [cargar])

  async function verDetalle(s: Solicitud) {
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/${s.id}`)
      const json = await res.json()
      if (json.success) {
        setDetalle(json.data)
        setAbrirDetalle(true)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  function abrirConvertirModal(s: Solicitud) {
    setDetalle(null)
    // Cargar detalle primero
    fetch(`/api/solicitudes-nuevos-clientes/${s.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setDetalle(json.data)
          setObservaciones('')
          setCategoriaSel('')
          setCuentaSel('')
          setResultadoConversion(null)
          setAbrirConvertir(true)
        }
      })
  }

  function abrirRechazarModal(s: Solicitud) {
    setDetalle(null)
    fetch(`/api/solicitudes-nuevos-clientes/${s.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setDetalle(json.data)
          setObservaciones('')
          setAbrirRechazar(true)
        }
      })
  }

  async function convertir() {
    if (!detalle) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/${detalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'convertir',
          categoriaId: categoriaSel || undefined,
          cuentaRecaudoId: cuentaSel || undefined,
          observaciones,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
        return
      }
      setResultadoConversion(json.clienteCreado)
      toast({ title: 'Cliente creado', description: `PIN inicial generado` })
      cargar()
      onClienteCreado?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcesando(false)
    }
  }

  async function aprobar() {
    if (!detalle) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/${detalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', observaciones }),
      })
      const json = await res.json()
      if (!json.success) {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Solicitud aprobada', description: 'Ya puedes convertirla a cliente' })
      setAbrirDetalle(false)
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcesando(false)
    }
  }

  async function rechazar() {
    if (!detalle) return
    if (!observaciones.trim()) {
      toast({ title: 'Falta motivo', description: 'Indica el motivo del rechazo', variant: 'destructive' })
      return
    }
    setProcesando(true)
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/${detalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar', observaciones }),
      })
      const json = await res.json()
      if (!json.success) {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Solicitud rechazada' })
      setAbrirRechazar(false)
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcesando(false)
    }
  }

  const filtradas = solicitudes.filter((s) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      s.nombre.toLowerCase().includes(q) ||
      s.apellido.toLowerCase().includes(q) ||
      s.cedula.includes(q) ||
      s.telefono.includes(q) ||
      s.codigo.toLowerCase().includes(q)
    )
  })

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.02]">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Solicitudes de registro</h3>
              <p className="text-xs text-muted-foreground">Personas que se registraron desde el formulario público</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/30 text-amber-300">
              {resumen.pendientes} pendientes
            </Badge>
            <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <MiniStat label="Total" value={resumen.total} color="text-slate-200" />
          <MiniStat label="Pendientes" value={resumen.pendientes} color="text-amber-300" />
          <MiniStat label="Aprobadas" value={resumen.aprobadas} color="text-emerald-300" />
          <MiniStat label="Rechazadas" value={resumen.rechazadas} color="text-red-300" />
          <MiniStat label="Convertidas" value={resumen.convertidas} color="text-purple-300" />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por nombre, cédula, teléfono o código…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-background"
            />
          </div>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDIENTE">Pendientes</SelectItem>
              <SelectItem value="REVISADA">Revisadas</SelectItem>
              <SelectItem value="APROBADA">Aprobadas</SelectItem>
              <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
              <SelectItem value="CONVERTIDA">Convertidas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        {filtradas.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay solicitudes en este estado.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Código</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead className="w-[110px]">Cédula</TableHead>
                  <TableHead className="w-[120px]">Teléfono</TableHead>
                  <TableHead className="w-[110px]">Valor</TableHead>
                  <TableHead className="w-[80px]">Plazo</TableHead>
                  <TableHead className="w-[110px]">Recibida</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="w-[230px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{s.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{s.nombre} {s.apellido}</div>
                      {s.email && <div className="text-[10px] text-muted-foreground">{s.email}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.cedula}</TableCell>
                    <TableCell className="text-xs">{s.telefono}</TableCell>
                    <TableCell className="text-xs">{formatearMoneda(s.valorSolicitado)}</TableCell>
                    <TableCell className="text-xs">{s.plazoDeseado ? `${s.plazoDeseado}m` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('es-CO')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[s.estado]}`}>{s.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => verDetalle(s)} title="Ver detalle">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(s.estado === 'PENDIENTE' || s.estado === 'REVISADA' || s.estado === 'APROBADA') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirConvertirModal(s)}
                            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                            title="Convertir en cliente"
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Crear cliente
                          </Button>
                        )}
                        {(s.estado === 'PENDIENTE' || s.estado === 'REVISADA') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirRechazarModal(s)}
                            className="text-red-400 hover:text-red-300"
                            title="Rechazar"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* === Modal DETALLE (solo ver) === */}
        <Dialog open={abrirDetalle} onOpenChange={setAbrirDetalle}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" /> Solicitud {detalle?.codigo}
              </DialogTitle>
              <DialogDescription>
                Recibida el {detalle ? new Date(detalle.createdAt).toLocaleString('es-CO') : ''}
              </DialogDescription>
            </DialogHeader>
            {detalle && (
              <div className="space-y-5">
                <DetalleCuerpo s={detalle} />

                {/* Acciones */}
                {(detalle.estado === 'PENDIENTE' || detalle.estado === 'REVISADA') && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      onClick={() => {
                        setAbrirDetalle(false)
                        abrirConvertirModal(detalle)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      <UserPlus className="h-4 w-4 mr-2" /> Aprobar y crear cliente
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        // Marcar como revisada
                        await fetch(`/api/solicitudes-nuevos-clientes/${detalle.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ accion: 'revisar' }),
                        })
                        toast({ title: 'Marcada como revisada' })
                        setAbrirDetalle(false)
                        cargar()
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como revisada
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAbrirDetalle(false)
                        abrirRechazarModal(detalle)
                      }}
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Rechazar
                    </Button>
                  </div>
                )}
                {detalle.estado === 'APROBADA' && (
                  <div className="flex gap-2 pt-3 border-t">
                    <Button onClick={() => { setAbrirDetalle(false); abrirConvertirModal(detalle) }} className="bg-emerald-600 hover:bg-emerald-500">
                      <UserPlus className="h-4 w-4 mr-2" /> Crear cliente ahora
                    </Button>
                  </div>
                )}
                {detalle.estado === 'CONVERTIDA' && detalle.clienteCreadoId && (
                  <div className="pt-3 border-t">
                    <Alert variant="default" className="bg-purple-500/10 border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <AlertDescription>
                        Cliente creado · ID: <span className="font-mono text-xs">{detalle.clienteCreadoId}</span>
                        {detalle.revisadoPorNombre && (
                          <span className="text-xs text-muted-foreground ml-2">por {detalle.revisadoPorNombre}</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                {detalle.estado === 'RECHAZADA' && (
                  <div className="pt-3 border-t">
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        Rechazada por {detalle.revisadoPorNombre || 'gestor'}
                        {detalle.observaciones && <span className="block text-xs mt-1">Motivo: {detalle.observaciones}</span>}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* === Modal CONVERTIR === */}
        <Dialog open={abrirConvertir} onOpenChange={(v) => { if (!procesando) setAbrirConvertir(v) }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-400" /> Convertir en cliente
              </DialogTitle>
              <DialogDescription>
                Se creará un cliente con los datos de la solicitud {detalle?.codigo}. El sistema generará un PIN inicial aleatorio.
              </DialogDescription>
            </DialogHeader>

            {detalle && !resultadoConversion && (
              <div className="space-y-4">
                <DetalleCuerpo s={detalle} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <Label className="text-xs">Categoría (opcional)</Label>
                    <Select value={categoriaSel} onValueChange={setCategoriaSel}>
                      <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Cuenta de recaudo (opcional)</Label>
                    <Select value={cuentaSel} onValueChange={setCuentaSel}>
                      <SelectTrigger><SelectValue placeholder="Heredar de categoría" /></SelectTrigger>
                      <SelectContent>
                        {cuentas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.banco} — {c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observaciones (opcional)</Label>
                  <Textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas internas sobre el cliente o la conversión…"
                    className="min-h-[60px]"
                  />
                </div>

                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-xs">
                    Al confirmar: se creará el cliente con estado activo, las 3 fotos se guardarán como documentos asociados al cliente y se generará un PIN de 4 dígitos que deberás entregar al cliente.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {resultadoConversion && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">¡Cliente creado!</h3>
                  <p className="text-sm text-muted-foreground">Entrega estas credenciales al cliente por WhatsApp o llamada:</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-4 space-y-3">
                  <CredRow label="Usuario (cédula)" value={resultadoConversion.cedula} />
                  <CredRow label="PIN inicial" value={resultadoConversion.pin} highlight />
                  <CredRow label="ID interno" value={resultadoConversion.clienteCreadoId} />
                </div>
                <Alert className="bg-amber-500/10 border-amber-500/30">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-xs">
                    El PIN debe ser cambiado por el cliente en su primer ingreso al portal. Recuérdale que su sesión expira en 2 horas.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter>
              {!resultadoConversion ? (
                <>
                  <Button variant="outline" onClick={() => setAbrirConvertir(false)} disabled={procesando}>
                    Cancelar
                  </Button>
                  <Button onClick={convertir} disabled={procesando} className="bg-emerald-600 hover:bg-emerald-500">
                    {procesando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creando…</> : <><UserPlus className="h-4 w-4 mr-2" /> Crear cliente</>}
                  </Button>
                </>
              ) : (
                <Button onClick={() => { setAbrirConvertir(false); setResultadoConversion(null) }} className="bg-emerald-600 hover:bg-emerald-500">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Listo
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* === Modal RECHAZAR === */}
        <Dialog open={abrirRechazar} onOpenChange={(v) => { if (!procesando) setAbrirRechazar(v) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-400" /> Rechazar solicitud
              </DialogTitle>
              <DialogDescription>
                {detalle?.nombre} {detalle?.apellido} · CC {detalle?.cedula}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Motivo del rechazo *</Label>
                <Textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: documentación incompleta, ya es cliente, no supera filtros…"
                  className="min-h-[80px]"
                />
              </div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  La solicitud quedará marcada como RECHAZADA. No se creará ningún cliente.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAbrirRechazar(false)} disabled={procesando}>Cancelar</Button>
              <Button variant="destructive" onClick={rechazar} disabled={procesando}>
                {procesando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Procesando…</> : <><XCircle className="h-4 w-4 mr-2" /> Confirmar rechazo</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// === Sub-componentes ===

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border p-2 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

function DetalleCuerpo({ s }: { s: SolicitudDetalle }) {
  return (
    <div className="space-y-4">
      {/* Datos personales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Detalle label="Nombre completo" value={`${s.nombre} ${s.apellido}`} icon={UserPlus} />
        <Detalle label="Documento" value={`${s.tipoDocumento} ${s.cedula}`} icon={FileText} />
        <Detalle label="Nacimiento" value={s.fechaNacimiento ? new Date(s.fechaNacimiento).toLocaleDateString('es-CO') : '—'} icon={Calendar} />
        <Detalle label="Teléfono" value={s.telefono} icon={Phone} />
        <Detalle label="Email" value={s.email || '—'} icon={Mail} />
        <Detalle label="Ciudad" value={[s.ciudad, s.municipio].filter(Boolean).join(' / ') || '—'} icon={MapPin} />
      </div>

      {/* Datos financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Detalle label="Ocupación" value={s.ocupacion || '—'} icon={Briefcase} />
        <Detalle label="Ingreso mensual" value={s.ingresoMensual ? formatearMoneda(s.ingresoMensual) : '—'} icon={DollarSign} />
        <Detalle label="Valor solicitado" value={formatearMoneda(s.valorSolicitado)} icon={DollarSign} />
        <Detalle label="Plazo deseado" value={s.plazoDeseado ? `${s.plazoDeseado} meses` : '—'} icon={Calendar} />
      </div>

      {s.destinoCredito && (
        <div className="p-3 rounded-lg bg-muted/40 border">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <FileText className="h-3.5 w-3.5" /> Destino del crédito
          </div>
          <p className="text-sm">{s.destinoCredito}</p>
        </div>
      )}

      {/* Dirección */}
      {s.direccion && (
        <Detalle label="Dirección" value={s.direccion} icon={MapPin} />
      )}

      {/* Referido */}
      {(s.referidoPorNombre || s.referidoPorTelefono) && (
        <div className="p-3 rounded-lg bg-muted/40 border">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <UserPlus className="h-3.5 w-3.5" /> Referido por
          </div>
          <div className="text-sm space-y-0.5">
            <div>{s.referidoPorNombre} {s.referidoPorApellido}</div>
            {s.referidoPorTelefono && <div className="text-xs text-muted-foreground">{s.referidoPorTelefono}</div>}
            {s.referidoPorParentesco && <div className="text-xs text-muted-foreground">Parentesco: {s.referidoPorParentesco}</div>}
          </div>
        </div>
      )}

      {/* Autorizaciones */}
      <div className="p-3 rounded-lg bg-muted/40 border">
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Autorizaciones
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <AuthRow label="TyC" ok={s.aceptaTyC} />
          <AuthRow label="Tratamiento datos" ok={s.aceptaTratamientoDatos} />
          <AuthRow label="Consulta centrales" ok={s.aceptaConsultaCentrales} />
          <AuthRow label="Reporte central" ok={s.aceptaReportarCentral} />
        </div>
        {s.fechaAceptacion && (
          <div className="text-[10px] text-muted-foreground mt-2">
            Aceptadas el {new Date(s.fechaAceptacion).toLocaleString('es-CO')}
          </div>
        )}
      </div>

      {/* Trazabilidad */}
      {(s.ipOrigen || s.userAgent) && (
        <div className="p-3 rounded-lg bg-muted/40 border">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <AlertCircle className="h-3.5 w-3.5" /> Trazabilidad
          </div>
          <div className="text-xs space-y-0.5 text-muted-foreground">
            {s.ipOrigen && <div>IP origen: <span className="font-mono">{s.ipOrigen}</span></div>}
            {s.userAgent && <div className="truncate">User-Agent: {s.userAgent}</div>}
          </div>
        </div>
      )}

      {/* Fotos */}
      <div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <Camera className="h-3.5 w-3.5" /> Verificación de identidad
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FotoBox label="Cédula frente" src={s.fotoCedulaFrente} nombre={s.fotoCedulaFrenteNombre} />
          <FotoBox label="Cédula reverso" src={s.fotoCedulaReverso} nombre={s.fotoCedulaReversoNombre} />
          <FotoBox label="Selfie con cédula" src={s.fotoSelfie} nombre={s.fotoSelfieNombre} />
        </div>
      </div>
    </div>
  )
}

function Detalle({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30 border">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  )
}

function AuthRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  )
}

function FotoBox({ label, src, nombre }: { label: string; src: string | null; nombre: string | null }) {
  const [open, setOpen] = useState(false)
  if (!src) {
    return (
      <div className="aspect-[4/3] rounded-lg bg-muted/30 border flex flex-col items-center justify-center text-muted-foreground">
        <Camera className="h-6 w-6 mb-1 opacity-40" />
        <span className="text-[10px]">Sin foto</span>
      </div>
    )
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block text-left">
        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 border hover:ring-2 hover:ring-indigo-500 transition-all">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="w-full h-full object-cover" />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[9px] opacity-60">{nombre}</span>
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  )
}

function CredRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { toast } = useToast()
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-bold ${highlight ? 'text-emerald-300 text-lg' : 'text-slate-200'}`}>{value}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => {
            navigator.clipboard.writeText(value)
            toast({ title: 'Copiado', description: value })
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
