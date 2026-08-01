'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EstadoBadge } from '@/components/ui-basics'
import { BitacoraPanel } from '@/components/views/BitacoraPanel'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  X,
  Printer,
  DollarSign,
  CheckCircle2,
  Bell,
  Download,
  Link as LinkIcon,
  Edit,
  PenTool,
  AlertTriangle,
  Send,
  Mail,
  FileText,
  Users,
  MessageCircle,
} from 'lucide-react'

interface PrestamoDetalle {
  id: string
  codigo: string
  cliente: any
  montoPrincipal: number
  tasaInteresAnual: number
  tasaMoraAnual: number
  tasaMoraPersonalizada: number | null
  plazoMeses: number
  frecuencia: string
  numeroCuotas: number
  montoCuota: number
  totalInteres: number
  totalPagar: number
  saldoCapital: number
  saldoInteres: number
  saldoTotal: number
  cuotasPagadas: number
  montoPagado: number
  montoMora: number
  diasMora: number
  estado: string
  fechaSolicitud: string
  fechaDesembolso: string | null
  fechaVencimiento: string | null
  requiereDocumentos: boolean
  generarPagare: boolean
  generarCarta: boolean
  tycEnviado: boolean
  tycAceptado: boolean
  tycFechaAceptacion: string | null
  fondoGarantiaMonto: number
  fondoGarantiaCargado: boolean
  pagos: any[]
  notificaciones: any[]
  casoJuridico: any | null
  firmas: any[]
  tablaAmortizacion: any[]
  moraTotalActual: number
  diasMoraMaximo: number
  enviarAJuridico: boolean
  tasaMoraEfectiva: number
  metodoConfirmacion: string | null
  // Codeudor
  tieneCodeudor: boolean
  codeudorId?: string | null
  codeudorNombre?: string | null
  codeudorCedula?: string | null
  codeudorTelefono?: string | null
  codeudorEmail?: string | null
  codeudorDireccion?: string | null
  codeudorFirmaId?: string | null
  firmaId?: string | null
}

export function PrestamoDetalleModal({
  prestamoId,
  onClose,
  onChanged,
}: {
  prestamoId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [data, setData] = useState<PrestamoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [cuotaAPagar, setCuotaAPagar] = useState<string>('')
  const [montoPago, setMontoPago] = useState<string>('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [referencia, setReferencia] = useState('')
  const [cuentaRecaudoId, setCuentaRecaudoId] = useState('')

  // Modificar tasa mora
  const [editandoTasaMora, setEditandoTasaMora] = useState(false)
  const [nuevaTasaMora, setNuevaTasaMora] = useState('')

  const [cuentas, setCuentas] = useState<any[]>([])
  // Código de confirmación por correo
  const [codigoConfirmacionInput, setCodigoConfirmacionInput] = useState('')
  const [codigoCodeudorInput, setCodigoCodeudorInput] = useState('')
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [estadoVerificacion, setEstadoVerificacion] = useState<any>(null)
  // Modal selección método de confirmación
  const [modalMetodoConfirmacion, setModalMetodoConfirmacion] = useState(false)
  const [enviandoConfirmacion, setEnviandoConfirmacion] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // FIX C10: AbortController para cancelar fetches si el modal se cierra
    // antes de que terminen (evita setStates sobre componente desmontado).
    const ac = new AbortController()
    cargar(ac.signal)
    cargarCuentas(ac.signal)
    cargarEstadoVerificacion(ac.signal)
    return () => ac.abort()
  }, [prestamoId])

  const cargar = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setErrorCarga(null)
      const res = await fetch(`/api/prestamos/${prestamoId}`, { signal })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — el servidor respondió con error`)
      }
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        const proxima = json.data.tablaAmortizacion?.find((c: any) => !c.pagada)
        if (proxima) {
          setCuotaAPagar(proxima.numero.toString())
          setMontoPago(proxima.montoCuota.toString())
        }
        // FIX audit #37: si ambos tasaMoraPersonalizada y tasaMoraAnual son
        // null/undefined, .toString() lanzaría TypeError. Defaultear a '0'.
        const tasaMoraValue = json.data.tasaMoraPersonalizada ?? json.data.tasaMoraAnual ?? 0
        setNuevaTasaMora(String(tasaMoraValue))
        // Cargar estado de verificación si está en PENDIENTE_ACEPTACION
        if (json.data.estado === 'PENDIENTE_ACEPTACION') {
          cargarEstadoVerificacion(signal)
        } else {
          setEstadoVerificacion(null)
        }
      } else {
        throw new Error(json.error || 'No se pudo cargar el préstamo')
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error(e)
        setErrorCarga(e.message || 'Error desconocido al cargar el préstamo')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const cargarCuentas = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/cuentas', { signal })
      const json = await res.json()
      if (json.success) setCuentas(json.data)
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    }
  }

  // Carga el estado de verificación de códigos OTP del préstamo
  // (deudor y, si aplica, codeudor). Permite mostrar badges de
  // "verificado / pendiente" en la UI.
  const cargarEstadoVerificacion = async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/verificar-codigo`, { signal })
      const json = await res.json()
      if (json.success) {
        setEstadoVerificacion(json.data)
      } else {
        setEstadoVerificacion(null)
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setEstadoVerificacion(null)
    }
  }

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestamoId,
          numeroCuota: cuotaAPagar,
          montoTotal: montoPago,
          metodoPago,
          referencia,
          cuentaRecaudoId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Pago aplicado',
          description: `WhatsApp ${json.whatsapp?.exito ? 'enviado' : 'falló'} al cliente.`,
        })
        setReferencia('')
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const generarLinkPago = async (numeroCuota: number) => {
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'generar_link', prestamoId, numeroCuota }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Link de pago generado',
          description: `WhatsApp ${json.whatsapp?.exito ? 'enviado' : 'falló'}. Link: ${json.linkPago}`,
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

  const cambiarEstado = async (accion: string) => {
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Estado actualizado' })
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const actualizarTasaMora = async () => {
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'actualizar_tasa_mora',
          tasaMoraPersonalizada: nuevaTasaMora,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Tasa moratoria actualizada', description: `Nueva tasa: ${nuevaTasaMora}%` })
        setEditandoTasaMora(false)
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const crearCasoJuridico = async () => {
    try {
      const res = await fetch('/api/juridico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestamoId,
          estado: 'PRE_JUDICIAL',
          descripcion: `Caso derivado por incumplimiento de pago (${data?.diasMoraMaximo || 0} días de mora)`,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Caso jurídico creado' })
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const descargarPagos = (formato: 'csv' | 'json', cuota?: string) => {
    const url = `/api/prestamos/${prestamoId}/pagos-export?formato=${formato}${cuota ? `&cuota=${cuota}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Marcar notificación como ENVIADA después de abrir WhatsApp manualmente
  const marcarNotificacionEnviada = async (notifId: string) => {
    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notifId, estado: 'ENVIADO' }),
      })
      toast({
        title: 'WhatsApp abierto',
        description: 'Se abrió WhatsApp con el mensaje. Marca como enviado.',
      })
      cargar()
      onChanged()
    } catch (e: any) {
      console.error(e)
    }
  }

  if (loading && !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl">
          <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span>Cargando préstamo...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (errorCarga && !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl">
          <div className="py-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <p className="font-semibold text-red-700">Error cargando el préstamo</p>
              <p className="text-sm text-muted-foreground mt-1">{errorCarga}</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => cargar()}>
                Reintentar
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl">
          <div className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">No se encontraron datos del préstamo.</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <span>{data.codigo}</span>
                <EstadoBadge estado={data.estado} />
                {data.tycAceptado && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    ✓ T&C aceptados
                  </span>
                )}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.cliente.nombre} · {data.cliente.cedula} · {data.cliente.telefono}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/estado-cuenta?cedula=${encodeURIComponent(data.cliente.cedula)}&prestamoId=${data.id}`, '_blank', 'noopener,noreferrer')}
                title="Ver estado de cuenta"
              >
                <FileText className="w-4 h-4 mr-1" />
                Estado de Cuenta
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {data.enviarAJuridico && !data.casoJuridico && (
          <div className="p-3 bg-red-50 border border-red-300 rounded-md flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-900 text-sm">
                ⚠️ {data.diasMoraMaximo} días de mora - Política de cobro jurídico
              </p>
              <p className="text-xs text-red-800">
                Cumple la condición de 60+ días para iniciar cobro jurídico.
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={crearCasoJuridico}>
              Derivar a Jurídico
            </Button>
          </div>
        )}

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="amortizacion">Amortización</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
            <TabsTrigger value="notificaciones">WhatsApp</TabsTrigger>
            <TabsTrigger value="firma">Firma</TabsTrigger>
          </TabsList>

          {/* INFO */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Monto Principal</p>
                  <p className="font-bold">{formatearMoneda(data.montoPrincipal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Cuota Fija</p>
                  <p className="font-bold text-primary">{formatearMoneda(data.montoCuota)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total a Pagar</p>
                  <p className="font-bold">{formatearMoneda(data.totalPagar)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
                  <p className="font-bold text-amber-700">{formatearMoneda(data.saldoTotal)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Tasa anual:</span>{' '}
                    <strong>{data.tasaInteresAnual}%</strong> (fija sobre capital inicial)
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tasa moratoria:</span>{' '}
                    {editandoTasaMora ? (
                      <span className="inline-flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={nuevaTasaMora}
                          onChange={(e) => setNuevaTasaMora(e.target.value)}
                          className="w-20 h-7 text-xs"
                        />
                        <Button size="sm" className="h-7 px-2" onClick={actualizarTasaMora}>
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setEditandoTasaMora(false)}
                        >
                          ✕
                        </Button>
                      </span>
                    ) : (
                      <span>
                        <strong>{data.tasaMoraEfectiva}%</strong>
                        {data.tasaMoraPersonalizada && (
                          <span className="text-xs text-amber-700"> (personalizada)</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 ml-1"
                          onClick={() => setEditandoTasaMora(true)}
                          title="Modificar tasa moratoria"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plazo:</span>{' '}
                    <strong>{data.plazoMeses} meses</strong> ({data.numeroCuotas} cuotas)
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total interés:</span>{' '}
                    <strong>{formatearMoneda(data.totalInteres)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Desembolso:</span>{' '}
                    <strong>{formatearFecha(data.fechaDesembolso)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vencimiento:</span>{' '}
                    <strong>{formatearFecha(data.fechaVencimiento)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cuotas pagadas:</span>{' '}
                    <strong>{data.cuotasPagadas}/{data.numeroCuotas}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Días mora máx:</span>{' '}
                    <strong className={data.diasMoraMaximo > 0 ? 'text-red-600' : ''}>
                      {data.diasMoraMaximo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mora total actual:</span>{' '}
                    <strong className={data.moraTotalActual > 0 ? 'text-red-600' : ''}>
                      {formatearMoneda(data.moraTotalActual)}
                    </strong>
                  </div>
                  {data.fondoGarantiaMonto > 0 && (
                    <div>
                      <span className="text-muted-foreground">Fondo garantía:</span>{' '}
                      <strong className="text-blue-700">
                        {formatearMoneda(data.fondoGarantiaMonto)}
                      </strong>
                      {data.fondoGarantiaCargado && (
                        <span className="text-xs text-emerald-700 ml-1">✓ cargado</span>
                      )}
                    </div>
                  )}
                  {data.tycEnviado && (
                    <div>
                      <span className="text-muted-foreground">T&C:</span>{' '}
                      <strong>
                        {data.tycAceptado
                          ? `✓ Aceptados ${formatearFecha(data.tycFechaAceptacion)}`
                          : '⏳ Pendientes'}
                      </strong>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* === Codeudor === */}
            {data.tieneCodeudor && (
              <Card className="border-amber-300 bg-amber-50/50">
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-700" />
                      <h4 className="font-semibold text-amber-900">Codeudor / Garante</h4>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold">
                      CODEUDOR
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nombre:</span>{' '}
                      <strong>{data.codeudorNombre || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">C.C.:</span>{' '}
                      <strong>{data.codeudorCedula || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono:</span>{' '}
                      <strong>{data.codeudorTelefono || '—'}</strong>
                      {data.codeudorTelefono && (
                        <a
                          href={`https://wa.me/57${data.codeudorTelefono.replace(/\D/g, '').replace(/^57/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-emerald-700 hover:underline"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Correo:</span>{' '}
                      <strong>{data.codeudorEmail || '—'}</strong>
                      {data.codeudorEmail && (
                        <a
                          href={`mailto:${data.codeudorEmail}`}
                          className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline"
                          title="Enviar correo"
                        >
                          <Mail className="w-3 h-3" /> Email
                        </a>
                      )}
                    </div>
                    {data.codeudorDireccion && (
                      <div className="col-span-1 sm:col-span-2">
                        <span className="text-muted-foreground">Dirección:</span>{' '}
                        <strong>{data.codeudorDireccion}</strong>
                      </div>
                    )}
                    <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                      <span className="text-muted-foreground">Firma electrónica:</span>{' '}
                      {data.codeudorFirmaId ? (
                        <span className="inline-flex items-center gap-2">
                          <strong className="text-emerald-700">✓ Registrada</strong>
                          <a
                            href={`/api/firma/certificado?firmaId=${data.codeudorFirmaId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> Ver certificado
                          </a>
                        </span>
                      ) : (
                        <strong className="text-amber-700">⏳ Pendiente</strong>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Acciones rápidas */}
            <div className="flex flex-wrap gap-2">
              {data.generarPagare && data.requiereDocumentos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`/api/documentos?prestamoId=${data.id}&tipo=pagare`, '_blank', 'noopener,noreferrer')
                  }
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Ver Pagaré
                </Button>
              )}
              {data.generarCarta && data.requiereDocumentos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`/api/documentos?prestamoId=${data.id}&tipo=carta`, '_blank', 'noopener,noreferrer')
                  }
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Ver Carta
                </Button>
              )}
              {data.generarPagare && data.generarCarta && data.requiereDocumentos && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    window.open(`/api/documentos?prestamoId=${data.id}&tipo=combinado`, '_blank', 'noopener,noreferrer')
                  }
                  title="Genera un único PDF con el Pagaré y la Carta de Instrucciones, cada uno con su propia sección de firma electrónica, fotos y OTP"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Ver Pagaré + Carta (PDF único)
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => descargarPagos('csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Pagos (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => descargarPagos('json')}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Pagos (JSON)
              </Button>
              {data.estado === 'SOLICITUD' && (
                <>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setModalMetodoConfirmacion(true)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aprobar y Enviar Confirmación
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => cambiarEstado('rechazar')}>
                    Rechazar
                  </Button>
                </>
              )}
              {data.estado === 'PENDIENTE_ACEPTACION' && (
                <div className="flex items-start gap-2 flex-wrap w-full">
                  {/* Si el método fue CORREO (o null/legacy — el endpoint enviar-codigo
                      siempre manda por correo y ahora setea metodoConfirmacion='CORREO',
                      pero los préstamos creados antes del fix tienen metodoConfirmacion=null),
                      mostrar input de código de verificación OTP */}
                  {(data.metodoConfirmacion === 'CORREO' || !data.metodoConfirmacion) && (
                    <div className="w-full space-y-2">
                      {/* === Aviso de doble confirmación cuando hay codeudor === */}
                      {estadoVerificacion?.requiereCodeudor && (
                        <div className="w-full bg-violet-50 border border-violet-200 rounded-md p-3 text-sm text-violet-900">
                          <div className="font-semibold mb-1">⚠️ Préstamo con codeudor — requiere doble confirmación</div>
                          <div className="text-xs">
                            El préstamo se activará <strong>ÚNICAMENTE</strong> cuando tanto el <strong>Titular</strong>
                            {' '}como el <strong>Codeudor</strong> verifiquen su respectivo código OTP enviado por correo.
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            {estadoVerificacion?.verificacion?.DEUDOR && (
                              <span className={`px-2 py-1 rounded ${estadoVerificacion.verificacion.DEUDOR.verificado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {estadoVerificacion.verificacion.DEUDOR.verificado ? '✅' : '⏳'} Titular ({estadoVerificacion.verificacion.DEUDOR.email})
                              </span>
                            )}
                            {estadoVerificacion?.verificacion?.CODEUDOR && (
                              <span className={`px-2 py-1 rounded ${estadoVerificacion.verificacion.CODEUDOR.verificado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {estadoVerificacion.verificacion.CODEUDOR.verificado ? '✅' : '⏳'} Codeudor ({estadoVerificacion.verificacion.CODEUDOR.email})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* === Input para el código del TITULAR (DEUDOR) === */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700 min-w-[60px]">
                          {estadoVerificacion?.verificacion?.DEUDOR?.verificado ? '✅' : '⏳'} Titular:
                        </span>
                        <Input
                          placeholder="Código Titular (6 caracteres)"
                          value={codigoConfirmacionInput}
                          onChange={(e) => setCodigoConfirmacionInput(e.target.value.toUpperCase().slice(0, 6))}
                          className="max-w-xs text-center text-lg tracking-widest font-mono"
                          maxLength={6}
                          disabled={!!estadoVerificacion?.verificacion?.DEUDOR?.verificado}
                        />
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={
                            !!estadoVerificacion?.verificacion?.DEUDOR?.verificado ||
                            !codigoConfirmacionInput ||
                            codigoConfirmacionInput.length !== 6 ||
                            verificandoCodigo
                          }
                          onClick={async () => {
                            setVerificandoCodigo(true)
                            try {
                              const res = await fetch(`/api/prestamos/${prestamoId}/verificar-codigo`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ codigo: codigoConfirmacionInput, rol: 'DEUDOR' }),
                              })
                              const json = await res.json()
                              if (json.success) {
                                toast({
                                  title: json.data?.activado ? '✅ Préstamo activado' : '✅ Código verificado',
                                  description: json.mensaje,
                                  duration: 8000,
                                })
                                setCodigoConfirmacionInput('')
                                cargar()
                                cargarEstadoVerificacion()
                                onChanged()
                              } else {
                                toast({ title: 'Error', description: json.error, variant: 'destructive' })
                              }
                            } catch (e: any) {
                              toast({ title: 'Error', description: e.message, variant: 'destructive' })
                            } finally {
                              setVerificandoCodigo(false)
                            }
                          }}
                        >
                          {verificandoCodigo ? 'Verificando...' : (<><CheckCircle2 className="w-4 h-4 mr-2" />Verificar Titular</>)}
                        </Button>
                      </div>

                      {/* === Input para el código del CODEUDOR (solo si aplica) === */}
                      {estadoVerificacion?.requiereCodeudor && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 min-w-[60px]">
                            {estadoVerificacion?.verificacion?.CODEUDOR?.verificado ? '✅' : '⏳'} Codeudor:
                          </span>
                          <Input
                            placeholder="Código Codeudor (6 caracteres)"
                            value={codigoCodeudorInput}
                            onChange={(e) => setCodigoCodeudorInput(e.target.value.toUpperCase().slice(0, 6))}
                            className="max-w-xs text-center text-lg tracking-widest font-mono"
                            maxLength={6}
                            disabled={!!estadoVerificacion?.verificacion?.CODEUDOR?.verificado}
                          />
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700"
                            disabled={
                              !!estadoVerificacion?.verificacion?.CODEUDOR?.verificado ||
                              !codigoCodeudorInput ||
                              codigoCodeudorInput.length !== 6 ||
                              verificandoCodigo
                            }
                            onClick={async () => {
                              setVerificandoCodigo(true)
                              try {
                                const res = await fetch(`/api/prestamos/${prestamoId}/verificar-codigo`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ codigo: codigoCodeudorInput, rol: 'CODEUDOR' }),
                                })
                                const json = await res.json()
                                if (json.success) {
                                  toast({
                                    title: json.data?.activado ? '✅ Préstamo activado' : '✅ Código verificado',
                                    description: json.mensaje,
                                    duration: 8000,
                                  })
                                  setCodigoCodeudorInput('')
                                  cargar()
                                  cargarEstadoVerificacion()
                                  onChanged()
                                } else {
                                  toast({ title: 'Error', description: json.error, variant: 'destructive' })
                                }
                              } catch (e: any) {
                                toast({ title: 'Error', description: e.message, variant: 'destructive' })
                              } finally {
                                setVerificandoCodigo(false)
                              }
                            }}
                          >
                            {verificandoCodigo ? 'Verificando...' : (<><CheckCircle2 className="w-4 h-4 mr-2" />Verificar Codeudor</>)}
                          </Button>
                        </div>
                      )}

                      {!data.metodoConfirmacion && (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                          ⚠️ Método de confirmación no registrado (legacy). El código fue enviado por correo.
                        </span>
                      )}
                    </div>
                  )}
                  {/* Si el método fue LINK, mostrar info del link */}
                  {data.metodoConfirmacion === 'LINK' && (
                    <span className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
                      🔗 Link enviado por WhatsApp. El cliente debe abrirlo y aceptar T&C.
                    </span>
                  )}
                  {/* Si el método fue WHATSAPP_API */}
                  {data.metodoConfirmacion === 'WHATSAPP_API' && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md">
                      📱 Botón interactivo enviado por WhatsApp API. Esperando respuesta del cliente.
                    </span>
                  )}
                  {/* Botón para reenviar por cualquier método */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalMetodoConfirmacion(true)}
                  >
                    Reenviar / Cambiar Método
                  </Button>
                </div>
              )}
              {(data.estado === 'EN_MORA' || data.estado === 'ACTIVO') && !data.casoJuridico && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-orange-700 border-orange-300 hover:bg-orange-50"
                  onClick={crearCasoJuridico}
                >
                  ⚖️ Enviar a Jurídico
                </Button>
              )}
            </div>
          </TabsContent>

          {/* AMORTIZACIÓN */}
          <TabsContent value="amortizacion" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Capital</TableHead>
                        <TableHead>Interés</TableHead>
                        <TableHead>Cuota</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Mora</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tablaAmortizacion.map((c) => (
                        <TableRow
                          key={c.numero}
                          className={c.pagada ? 'bg-emerald-50/50' : c.diasMora > 0 ? 'bg-red-50/50' : ''}
                        >
                          <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                          <TableCell className="text-sm">{formatearFecha(c.fechaVencimiento)}</TableCell>
                          <TableCell className="text-sm">{formatearMoneda(c.capital)}</TableCell>
                          <TableCell className="text-sm text-amber-700">{formatearMoneda(c.interes)}</TableCell>
                          <TableCell className="text-sm font-semibold">{formatearMoneda(c.montoCuota)}</TableCell>
                          <TableCell className="text-sm">{formatearMoneda(c.saldoCapital)}</TableCell>
                          <TableCell className="text-xs">
                            {c.diasMora > 0 ? (
                              <span className="text-red-700 font-medium">
                                {c.diasMora}d
                                <br />
                                <span className="text-xs">{formatearMoneda(c.moraGenerada)}</span>
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {c.pagada ? (
                              <span className="text-emerald-700 text-xs font-medium">Pagada</span>
                            ) : c.diasMora > 0 ? (
                              <span className="text-red-700 text-xs font-medium">
                                Vencida {c.enviarJuridico && '⚠️60+d'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!c.pagada && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => generarLinkPago(c.numero)}
                                title="Generar link de pago"
                              >
                                <LinkIcon className="w-3 h-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGOS */}
          <TabsContent value="pagos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Registrar Nuevo Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={registrarPago} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Cuota a pagar</Label>
                      <Select value={cuotaAPagar} onValueChange={setCuotaAPagar}>
                        <SelectTrigger>
                          <SelectValue placeholder="N° cuota" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.tablaAmortizacion
                            .filter((c) => !c.pagada)
                            .map((c) => (
                              <SelectItem key={c.numero} value={c.numero.toString()}>
                                Cuota {c.numero} - {formatearFecha(c.fechaVencimiento)}
                                {c.diasMora > 0 ? ` (Mora ${c.diasMora}d)` : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Monto (COP)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={montoPago}
                        onChange={(e) => setMontoPago(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Método</Label>
                      <Select value={metodoPago} onValueChange={setMetodoPago}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                          <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                          <SelectItem value="NOMINA">Nómina</SelectItem>
                          <SelectItem value="CHEQUE">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cuenta de recaudo</Label>
                      <Select value={cuentaRecaudoId} onValueChange={setCuentaRecaudoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {cuentas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.codigo} - {c.banco}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Referencia</Label>
                      <Input
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        placeholder="Comprobante"
                      />
                    </div>
                  </div>
                  <Button type="submit">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Aplicar Pago y notificar
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Historial de Pagos ({data.pagos.length})</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => descargarPagos('csv')}>
                      <Download className="w-3 h-3 mr-1" />
                      CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => descargarPagos('json')}>
                      <Download className="w-3 h-3 mr-1" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead>Capital</TableHead>
                      <TableHead>Interés</TableHead>
                      <TableHead>Mora</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Cuenta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pagos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">
                          Aún no se han registrado pagos
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.pagos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.numeroCuota}</TableCell>
                          <TableCell className="text-sm">{formatearFecha(p.fechaPago)}</TableCell>
                          <TableCell className="text-sm">{formatearMoneda(p.montoCapital)}</TableCell>
                          <TableCell className="text-sm">{formatearMoneda(p.montoInteres)}</TableCell>
                          <TableCell className="text-sm">{formatearMoneda(p.montoMora)}</TableCell>
                          <TableCell className="font-semibold text-emerald-700">
                            {formatearMoneda(p.montoTotal)}
                          </TableCell>
                          <TableCell className="text-xs">{p.metodoPago}</TableCell>
                          <TableCell className="text-xs">{p.cuentaRecaudo?.nombre || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BITÁCORA */}
          <TabsContent value="bitacora" className="space-y-4">
            <BitacoraPanel
              prestamoId={data.id}
              prestamoCodigo={data.codigo}
              usuarioNombre="Administrador"
            />
          </TabsContent>

          {/* NOTIFICACIONES */}
          <TabsContent value="notificaciones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  WhatsApp ({data.notificaciones.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {data.notificaciones.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No se han enviado notificaciones
                  </div>
                ) : (
                  data.notificaciones.map((n) => {
                    const esPendienteManual = n.estado === 'PENDIENTE_MANUAL' && n.linkWaMe
                    return (
                      <div
                        key={n.id}
                        className={`p-3 rounded-md border text-sm ${
                          n.estado === 'ENVIADO'
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : esPendienteManual
                            ? 'border-amber-300 bg-amber-50/50'
                            : 'border-red-200 bg-red-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs">{n.tipo}</span>
                          <span
                            className={`text-xs font-semibold ${
                              n.estado === 'ENVIADO'
                                ? 'text-emerald-700'
                                : esPendienteManual
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }`}
                          >
                            {n.estado === 'PENDIENTE_MANUAL' ? '⏳ Pendiente envío manual' : n.estado}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{n.mensaje}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {formatearFechaHora(n.fechaEnvio)}
                          {n.error && n.estado !== 'PENDIENTE_MANUAL' && (
                            <span className="text-red-600"> · {n.error}</span>
                          )}
                        </div>
                        {esPendienteManual && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                              onClick={() => {
                                window.open(n.linkWaMe!, '_blank', 'noopener,noreferrer')
                                marcarNotificacionEnviada(n.id)
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Abrir WhatsApp y enviar
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FIRMA */}
          <TabsContent value="firma" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Firma Electrónica
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.firmas.length > 0 ? (
                  <div className="space-y-3">
                    {data.firmas.map((f) => (
                      <div key={f.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{f.tipo}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              f.otpValidado
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {f.otpValidado ? '✓ Firmado y validado' : 'Pendiente OTP'}
                          </span>
                        </div>
                        {f.imagenFirma && (
                          <img
                            src={f.imagenFirma}
                            alt="Firma"
                            className="max-h-32 border rounded bg-white p-2"
                          />
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Canal: {f.otpCanal} · {formatearFechaHora(f.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <PenTool className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    No hay firmas electrónicas registradas para este préstamo.
                    <p className="text-xs mt-2">
                      Las firmas se realizan desde el portal del cliente con OTP por WhatsApp.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* MODAL SELECCIÓN MÉTODO DE CONFIRMACIÓN */}
      <Dialog open={modalMetodoConfirmacion} onOpenChange={setModalMetodoConfirmacion}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ¿Cómo enviar la confirmación al cliente?
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Préstamo: <strong>{data.codigo}</strong> · Cliente: <strong>{data.cliente.nombre}</strong>
            </p>
          </DialogHeader>
          <div className="space-y-3">
            {/* Opción 1: LINK */}
            <button
              className="w-full text-left p-4 border-2 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={async () => {
                setEnviandoConfirmacion(true)
                try {
                  const res = await fetch(`/api/prestamos/${prestamoId}/enviar-confirmacion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metodo: 'LINK' }),
                  })
                  const json = await res.json()
                  if (json.success) {
                    toast({
                      title: '🔗 Link enviado por WhatsApp',
                      description: 'El cliente debe abrir el link y hacer clic en "Acepto T&C".',
                      duration: 8000,
                    })
                    if (json.whatsapp?.linkWaMe) window.open(json.whatsapp.linkWaMe, '_blank', 'noopener,noreferrer')
                    setModalMetodoConfirmacion(false)
                    cargar()
                    onChanged()
                  } else {
                    toast({ title: 'Error', description: json.error, variant: 'destructive' })
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' })
                } finally {
                  setEnviandoConfirmacion(false)
                }
              }}
              disabled={enviandoConfirmacion}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">🔗 Link (Portal del Cliente)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se envía un link por WhatsApp. El cliente lo abre y hace clic en "Acepto T&C".
                    Es el método más rápido pero menos seguro (cualquiera con el teléfono puede aceptar).
                  </p>
                </div>
              </div>
            </button>

            {/* Opción 2: CORREO */}
            <button
              className="w-full text-left p-4 border-2 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
              onClick={async () => {
                setEnviandoConfirmacion(true)
                try {
                  const res = await fetch(`/api/prestamos/${prestamoId}/enviar-confirmacion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metodo: 'CORREO' }),
                  })
                  const json = await res.json()
                  if (json.success) {
                    toast({
                      title: '🔐 Código enviado por correo',
                      description: `A ${json.data.email}. El cliente debe compartir el código contigo. Expira en 24h.`,
                      duration: 8000,
                    })
                    if (json.whatsapp?.linkWaMe) window.open(json.whatsapp.linkWaMe, '_blank', 'noopener,noreferrer')
                    setModalMetodoConfirmacion(false)
                    cargar()
                    onChanged()
                  } else {
                    toast({ title: 'Error', description: json.error, variant: 'destructive' })
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' })
                } finally {
                  setEnviandoConfirmacion(false)
                }
              }}
              disabled={enviandoConfirmacion}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">🔐 Correo (Código de confirmación)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se envía un código de 6 caracteres al correo del cliente. El cliente te lo dicta
                    y tú lo ingresas en el sistema. Más seguro (doble canal: WhatsApp + email).
                    Requiere que el cliente tenga email registrado.
                  </p>
                </div>
              </div>
            </button>

            {/* Opción 3: WHATSAPP_API */}
            <button
              className="w-full text-left p-4 border-2 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
              onClick={async () => {
                setEnviandoConfirmacion(true)
                try {
                  const res = await fetch(`/api/prestamos/${prestamoId}/enviar-confirmacion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metodo: 'WHATSAPP_API' }),
                  })
                  const json = await res.json()
                  if (json.success) {
                    toast({
                      title: json.data.apiReal ? '📱 Botón enviado por WhatsApp API' : '📱 Enlace enviado (API no configurada)',
                      description: json.mensaje,
                      duration: 8000,
                    })
                    if (json.whatsapp?.linkWaMe) window.open(json.whatsapp.linkWaMe, '_blank', 'noopener,noreferrer')
                    setModalMetodoConfirmacion(false)
                    cargar()
                    onChanged()
                  } else {
                    toast({ title: 'Error', description: json.error, variant: 'destructive' })
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' })
                } finally {
                  setEnviandoConfirmacion(false)
                }
              }}
              disabled={enviandoConfirmacion}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">📱 WhatsApp API (Botón interactivo)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Envía un mensaje con botones "✅ Acepto T&C" y "❌ Rechazar" directamente
                    en WhatsApp. Requiere una conexión de WhatsApp Business API activa en Conexiones API.
                    Si no hay API configurada, usa link de respaldo.
                  </p>
                </div>
              </div>
            </button>
          </div>
          {enviandoConfirmacion && (
            <p className="text-center text-sm text-muted-foreground">Enviando...</p>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
