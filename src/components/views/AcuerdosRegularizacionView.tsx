'use client'

// =====================================================
// AcuerdosRegularizacionView
// -----------------------------------------------------
// Vista del admin/gestor para revisar y gestionar los
// acuerdos de regularización que los clientes envían
// desde el portal del cliente.
//
// Funciones:
// - Listar acuerdos pendientes (REGISTRADO) y otros estados
// - Ver detalle del acuerdo (cliente, cuotas, montos)
// - APROBAR acuerdo → genera Otro Sí automáticamente
// - Hacer CONTRAOFERTA al cliente
// - NEGOCIAR MORA (anular o fijar valor)
// - RECHAZAR acuerdo con motivo
//
// El Otro Sí generado se ve en:
// - Acciones del crédito (sección Otros Síes)
// - Bitácora del crédito (evento de regularización)
// - Portal del cliente (pendiente de firma)
// =====================================================

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
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  Handshake,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  FileSignature,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingDown,
  ArrowRightLeft,
  Search,
} from 'lucide-react'

interface Acuerdo {
  id: string
  clienteId: string
  prestamoId: string
  cliente: {
    id: string
    nombre: string
    cedula: string
    telefono: string
    email: string | null
  }
  prestamo: {
    id: string
    codigo: string
    montoPrincipal: number
    estado: string
    diasMora: number
    montoMora: number
    saldoTotal: number
    tasaMoraDiaria: number
    moraRenegociada: number | null
    moraRenegociadaAccion: string | null
  }
  razon: string
  razonOtroTexto: string
  observacionCliente: string
  fechaComprometida: string
  valorComprometido: number
  estado: string
  createdAt: string
  tipoAcuerdo: string
  montoPropuesto: number
  montoTotalAcordado: number
  saldoRestante: number
  cuotasVencidasIncluidas: number[]
  fechasPagosPosteriores: string[]
  moraActualPrestamo: number
  diasMoraPrestamo: number
  moraRenegociada: number | null
  moraRenegociadaAccion: string | null
}

type EstadoFiltro = 'REGISTRADO' | 'APROBADO' | 'CONTRAOFERTA' | 'RECHAZADO' | 'TODOS'

export function AcuerdosRegularizacionView() {
  const { toast } = useToast()
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('REGISTRADO')
  const [busqueda, setBusqueda] = useState('')

  // Modales
  const [acuerdoSeleccionado, setAcuerdoSeleccionado] = useState<Acuerdo | null>(null)
  const [modalAprobar, setModalAprobar] = useState(false)
  const [modalContraoferta, setModalContraoferta] = useState(false)
  const [modalNegociarMora, setModalNegociarMora] = useState(false)
  const [modalRechazar, setModalRechazar] = useState(false)

  // Form states
  const [aprobarObs, setAprobarObs] = useState('')
  const [aprobarMonto, setAprobarMonto] = useState('')
  const [aprobarFecha, setAprobarFecha] = useState('')
  const [aprobarMoraAccion, setAprobarMoraAccion] = useState<'MANTENER' | 'ANULAR' | 'NEGOCIAR'>('MANTENER')
  const [aprobarMoraValor, setAprobarMoraValor] = useState('')
  const [contraofertaMonto, setContraofertaMonto] = useState('')
  const [contraofertaFecha, setContraofertaFecha] = useState('')
  const [contraofertaObs, setContraofertaObs] = useState('')
  const [moraAccion, setMoraAccion] = useState<'ANULAR' | 'NEGOCIAR'>('ANULAR')
  const [moraValor, setMoraValor] = useState('')
  const [moraObs, setMoraObs] = useState('')
  const [rechazarMotivo, setRechazarMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargarAcuerdos = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/regularizacion?estado=${estadoFiltro}`)
      const json = await res.json()
      if (json.success) {
        setAcuerdos(json.data)
      }
    } catch (e: any) {
      toast({
        title: 'Error al cargar',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarAcuerdos()
  }, [estadoFiltro])

  // Filtrar por búsqueda
  const acuerdosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return acuerdos
    const q = busqueda.toLowerCase()
    return acuerdos.filter(
      (a) =>
        a.cliente.nombre.toLowerCase().includes(q) ||
        a.cliente.cedula.includes(q) ||
        a.prestamo.codigo.toLowerCase().includes(q)
    )
  }, [acuerdos, busqueda])

  // === Acciones ===
  const abrirAprobar = (a: Acuerdo) => {
    setAcuerdoSeleccionado(a)
    setAprobarObs('')
    setAprobarMonto(String(a.valorComprometido))
    setAprobarFecha(a.fechaComprometida.slice(0, 10))
    setAprobarMoraAccion('MANTENER')
    setAprobarMoraValor('')
    setModalAprobar(true)
  }

  const abrirContraoferta = (a: Acuerdo) => {
    setAcuerdoSeleccionado(a)
    setContraofertaMonto(String(a.valorComprometido))
    setContraofertaFecha(a.fechaComprometida.slice(0, 10))
    setContraofertaObs('')
    setModalContraoferta(true)
  }

  const abrirNegociarMora = (a: Acuerdo) => {
    setAcuerdoSeleccionado(a)
    setMoraAccion('ANULAR')
    setMoraValor(String(a.moraActualPrestamo))
    setMoraObs('')
    setModalNegociarMora(true)
  }

  const abrirRechazar = (a: Acuerdo) => {
    setAcuerdoSeleccionado(a)
    setRechazarMotivo('')
    setModalRechazar(true)
  }

  const ejecutarAccion = async (accion: string, payload: any) => {
    setProcesando(true)
    try {
      const res = await fetch('/api/regularizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...payload }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Acción realizada',
          description: json.data.mensaje,
          duration: 6000,
        })
        // Cerrar modal y recargar
        setModalAprobar(false)
        setModalContraoferta(false)
        setModalNegociarMora(false)
        setModalRechazar(false)
        cargarAcuerdos()
      } else {
        toast({
          title: 'No se pudo procesar',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setProcesando(false)
    }
  }

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'REGISTRADO': return 'bg-blue-500/15 text-blue-700 border-blue-400/30'
      case 'APROBADO': return 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30'
      case 'CONTRAOFERTA': return 'bg-amber-500/15 text-amber-700 border-amber-400/30'
      case 'RECHAZADO': return 'bg-red-500/15 text-red-700 border-red-400/30'
      default: return 'bg-slate-500/15 text-slate-700 border-slate-400/30'
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Acuerdos de Regularización"
        subtitle="Solicitudes de negociación enviadas desde el portal del cliente"
        icon={<Handshake className="w-5 h-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={cargarAcuerdos} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        }
      />

      {/* === KPIs === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-xs text-muted-foreground uppercase font-semibold">Pendientes</p>
            </div>
            <p className="text-2xl font-bold text-blue-700">
              {acuerdos.filter((a) => a.estado === 'REGISTRADO').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-xs text-muted-foreground uppercase font-semibold">Aprobados</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              {acuerdos.filter((a) => a.estado === 'APROBADO').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs text-muted-foreground uppercase font-semibold">Contraofertas</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">
              {acuerdos.filter((a) => a.estado === 'CONTRAOFERTA').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <p className="text-xs text-muted-foreground uppercase font-semibold">Rechazados</p>
            </div>
            <p className="text-2xl font-bold text-red-700">
              {acuerdos.filter((a) => a.estado === 'RECHAZADO').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Filtros === */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label className="text-xs mb-1.5 block">Estado</Label>
          <Select
            value={estadoFiltro}
            onValueChange={(v) => setEstadoFiltro(v as EstadoFiltro)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGISTRADO">Pendientes (REGISTRADO)</SelectItem>
              <SelectItem value="APROBADO">Aprobados</SelectItem>
              <SelectItem value="CONTRAOFERTA">Contraofertas enviadas</SelectItem>
              <SelectItem value="RECHAZADO">Rechazados</SelectItem>
              <SelectItem value="TODOS">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs mb-1.5 block">Buscar</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nombre, cédula o código de crédito..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* === Tabla de acuerdos === */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando acuerdos...
            </div>
          ) : acuerdosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Handshake className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No hay acuerdos en este estado</p>
              <p className="text-xs mt-1">
                Cuando un cliente envíe una solicitud de regularización desde el portal,
                aparecerá aquí para su revisión.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Crédito</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead>Mora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acuerdosFiltrados.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{a.cliente.nombre}</p>
                        <p className="text-xs text-muted-foreground">CC {a.cliente.cedula}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs">{a.prestamo.codigo}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.diasMoraPrestamo} días mora
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {a.tipoAcuerdo.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-bold text-sm">{formatearMoneda(a.valorComprometido)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        de {formatearMoneda(a.montoTotalAcordado)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{formatearFecha(a.fechaComprometida)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-red-600">
                        {formatearMoneda(a.moraActualPrestamo)}
                      </p>
                      {a.moraRenegociadaAccion && (
                        <Badge variant="outline" className="text-[9px] mt-0.5">
                          {a.moraRenegociadaAccion}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={estadoColor(a.estado)} variant="outline">
                        {a.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {a.estado === 'REGISTRADO' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => abrirAprobar(a)}
                              title="Aprobar y generar Otro Sí"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={() => abrirContraoferta(a)}
                              title="Hacer contraoferta"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-orange-400 text-orange-700 hover:bg-orange-50"
                              onClick={() => abrirNegociarMora(a)}
                              title="Negociar mora"
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-red-400 text-red-700 hover:bg-red-50"
                              onClick={() => abrirRechazar(a)}
                              title="Rechazar"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {(a.estado === 'APROBADO' || a.estado === 'RECHAZADO' || a.estado === 'CONTRAOFERTA') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => {
                              setAcuerdoSeleccionado(a)
                              // Mostrar toast con el detalle
                              toast({
                                title: `Acuerdo ${a.estado}`,
                                description: `${a.cliente.nombre} — ${a.prestamo.codigo} — ${formatearMoneda(a.valorComprometido)}`,
                                duration: 4000,
                              })
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* === MODAL: APROBAR (genera Otro Sí) === */}
      <Dialog open={modalAprobar} onOpenChange={setModalAprobar}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-600" />
              Aprobar acuerdo y generar Otro Sí
            </DialogTitle>
          </DialogHeader>

          {acuerdoSeleccionado && (
            <div className="space-y-4">
              {/* Resumen del acuerdo original */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-sm">
                <p><strong>Cliente:</strong> {acuerdoSeleccionado.cliente.nombre} (CC {acuerdoSeleccionado.cliente.cedula})</p>
                <p><strong>Crédito:</strong> <span className="font-mono">{acuerdoSeleccionado.prestamo.codigo}</span></p>
                <p><strong>Cuotas vencidas incluidas:</strong> {acuerdoSeleccionado.cuotasVencidasIncluidas.join(', ')}</p>
                <p><strong>Total acordado:</strong> {formatearMoneda(acuerdoSeleccionado.montoTotalAcordado)}</p>
                <p><strong>Saldo restante:</strong> {formatearMoneda(acuerdoSeleccionado.saldoRestante)}</p>
                <p><strong>Mora actual del crédito:</strong> <span className="text-red-600">{formatearMoneda(acuerdoSeleccionado.moraActualPrestamo)}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Monto del primer pago (ajustable)</Label>
                  <Input
                    type="number"
                    value={aprobarMonto}
                    onChange={(e) => setAprobarMonto(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha de pago (ajustable)</Label>
                  <Input
                    type="date"
                    value={aprobarFecha}
                    onChange={(e) => setAprobarFecha(e.target.value)}
                  />
                </div>
              </div>

              {/* Negociación de mora opcional */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Negociación de intereses moratorios (opcional)</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAprobarMoraAccion('MANTENER')}
                    className={`p-2 rounded-md text-xs font-medium border ${
                      aprobarMoraAccion === 'MANTENER'
                        ? 'bg-slate-600 text-white border-slate-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Mantener mora
                  </button>
                  <button
                    type="button"
                    onClick={() => setAprobarMoraAccion('ANULAR')}
                    className={`p-2 rounded-md text-xs font-medium border ${
                      aprobarMoraAccion === 'ANULAR'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Anular mora
                  </button>
                  <button
                    type="button"
                    onClick={() => setAprobarMoraAccion('NEGOCIAR')}
                    className={`p-2 rounded-md text-xs font-medium border ${
                      aprobarMoraAccion === 'NEGOCIAR'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Negociar valor
                  </button>
                </div>
                {aprobarMoraAccion === 'NEGOCIAR' && (
                  <div className="mt-2">
                    <Label className="text-xs">Valor de mora acordado</Label>
                    <Input
                      type="number"
                      value={aprobarMoraValor}
                      onChange={(e) => setAprobarMoraValor(e.target.value)}
                      placeholder="Ej: 100000"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Mora actual: {formatearMoneda(acuerdoSeleccionado.moraActualPrestamo)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">Observaciones del asesor (aparecerán en el Otro Sí)</Label>
                <Textarea
                  value={aprobarObs}
                  onChange={(e) => setAprobarObs(e.target.value)}
                  placeholder="Ej: Se ajusta fecha por día no hábil. Se anula mora por buena fe del cliente..."
                  rows={3}
                />
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                <p className="font-semibold text-emerald-800 mb-1">📋 Al aprobar se generará:</p>
                <ul className="space-y-0.5 text-emerald-700">
                  <li>• Un <strong>Otro Sí</strong> como acuerdo de partes (código OS-XXX)</li>
                  <li>• Pendiente de firma electrónica del cliente</li>
                  <li>• Visible en <strong>Acciones del crédito</strong> y <strong>Bitácora</strong></li>
                  <li>• Si negoció la mora, se aplica automáticamente al préstamo</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAprobar(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={procesando || !aprobarMonto || !aprobarFecha}
              onClick={() => {
                if (!acuerdoSeleccionado) return
                ejecutarAccion('aprobar', {
                  compromisoId: acuerdoSeleccionado.id,
                  observaciones: aprobarObs,
                  montoAjustado: parseFloat(aprobarMonto),
                  fechaAjustada: aprobarFecha,
                  moraNegociadaAccion: aprobarMoraAccion,
                  moraNegociadaValor: aprobarMoraValor,
                })
              }}
            >
              {procesando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Aprobando...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4 mr-2" />
                  Aprobar y generar Otro Sí
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL: CONTRAOFERTA === */}
      <Dialog open={modalContraoferta} onOpenChange={setModalContraoferta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              Hacer contraoferta al cliente
            </DialogTitle>
          </DialogHeader>

          {acuerdoSeleccionado && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                <p><strong>Cliente propuso:</strong> {formatearMoneda(acuerdoSeleccionado.valorComprometido)} el {formatearFecha(acuerdoSeleccionado.fechaComprometida)}</p>
                <p><strong>Total necesario:</strong> {formatearMoneda(acuerdoSeleccionado.montoTotalAcordado)}</p>
              </div>
              <div>
                <Label className="text-xs">Monto de la contraoferta</Label>
                <Input
                  type="number"
                  value={contraofertaMonto}
                  onChange={(e) => setContraofertaMonto(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Fecha propuesta</Label>
                <Input
                  type="date"
                  value={contraofertaFecha}
                  onChange={(e) => setContraofertaFecha(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Observaciones para el cliente</Label>
                <Textarea
                  value={contraofertaObs}
                  onChange={(e) => setContraofertaObs(e.target.value)}
                  placeholder="Ej: Podemos aceptar este monto si pagas en esta fecha..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalContraoferta(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={procesando || !contraofertaMonto || !contraofertaFecha}
              onClick={() => {
                if (!acuerdoSeleccionado) return
                ejecutarAccion('contraoferta', {
                  compromisoId: acuerdoSeleccionado.id,
                  montoContraoferta: contraofertaMonto,
                  fechaContraoferta: contraofertaFecha,
                  observaciones: contraofertaObs,
                })
              }}
            >
              {procesando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Enviar contraoferta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL: NEGOCIAR MORA === */}
      <Dialog open={modalNegociarMora} onOpenChange={setModalNegociarMora}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              Negociar intereses moratorios
            </DialogTitle>
          </DialogHeader>

          {acuerdoSeleccionado && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
                <p><strong>Mora actual del crédito:</strong></p>
                <p className="text-2xl font-bold text-red-700">
                  {formatearMoneda(acuerdoSeleccionado.moraActualPrestamo)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {acuerdoSeleccionado.diasMoraPrestamo} días de mora · Tasa: {acuerdoSeleccionado.prestamo.tasaMoraDiaria}% diario
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMoraAccion('ANULAR')}
                  className={`p-3 rounded-md text-sm font-medium border ${
                    moraAccion === 'ANULAR'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-5 h-5 mx-auto mb-1" />
                  Anular mora
                </button>
                <button
                  type="button"
                  onClick={() => setMoraAccion('NEGOCIAR')}
                  className={`p-3 rounded-md text-sm font-medium border ${
                    moraAccion === 'NEGOCIAR'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-5 h-5 mx-auto mb-1" />
                  Negociar valor
                </button>
              </div>
              {moraAccion === 'NEGOCIAR' && (
                <div>
                  <Label className="text-xs">Valor acordado de la mora</Label>
                  <Input
                    type="number"
                    value={moraValor}
                    onChange={(e) => setMoraValor(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    El cliente deberá pagar este monto en lugar de la mora completa.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-xs">Observaciones</Label>
                <Textarea
                  value={moraObs}
                  onChange={(e) => setMoraObs(e.target.value)}
                  placeholder="Motivo de la negociación de mora..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNegociarMora(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={procesando || (moraAccion === 'NEGOCIAR' && !moraValor)}
              onClick={() => {
                if (!acuerdoSeleccionado) return
                ejecutarAccion('negociar_mora', {
                  compromisoId: acuerdoSeleccionado.id,
                  moraAccion,
                  moraValor,
                  observaciones: moraObs,
                })
              }}
            >
              {procesando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Negociando...
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Aplicar negociación de mora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL: RECHAZAR === */}
      <Dialog open={modalRechazar} onOpenChange={setModalRechazar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Rechazar acuerdo
            </DialogTitle>
          </DialogHeader>

          {acuerdoSeleccionado && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Estás por rechazar el acuerdo de regularización de{' '}
                <strong>{acuerdoSeleccionado.cliente.nombre}</strong>. El cliente será notificado.
              </p>
              <div>
                <Label className="text-xs">Motivo del rechazo</Label>
                <Textarea
                  value={rechazarMotivo}
                  onChange={(e) => setRechazarMotivo(e.target.value)}
                  placeholder="Ej: El monto no cubre el mínimo requerido por política..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRechazar(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={procesando || !rechazarMotivo}
              onClick={() => {
                if (!acuerdoSeleccionado) return
                ejecutarAccion('rechazar', {
                  compromisoId: acuerdoSeleccionado.id,
                  motivo: rechazarMotivo,
                })
              }}
            >
              {procesando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Rechazando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar acuerdo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
