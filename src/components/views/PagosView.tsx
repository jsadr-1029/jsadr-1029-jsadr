'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { abrirHtmlImprimible, descargarArchivo } from '@/lib/auth-docs'
import {
  DollarSign, Bell, RefreshCw, Undo2, RotateCcw, Trash2, Plus,
  TrendingUp, TrendingDown, Calendar, Users, AlertTriangle, Clock,
  Search, CheckCircle, Banknote, Wallet, FileText, Download,
  Handshake, Save, Sparkles, Brain, FileSpreadsheet, CalendarDays, Receipt,
  Info,
} from 'lucide-react'
import { BotIcons } from '@/components/views/BotIcons'
import { PagosCharts } from '@/components/views/pagos/PagosCharts'
import { PagosCalendario } from '@/components/views/pagos/PagosCalendario'
import { PagoSoloInteresesModal } from '@/components/views/pagos/PagoSoloInteresesModal'
import { ConciliacionBancariaModal } from '@/components/views/pagos/ConciliacionBancariaModal'
import { PrediccionMoraModal } from '@/components/views/pagos/PrediccionMoraModal'
import { ReciboPreviewModal } from '@/components/views/pagos/ReciboPreviewModal'

interface Pago {
  id: string
  numeroCuota: number
  montoCapital: number
  montoInteres: number
  montoMora: number
  montoTotal: number
  fechaPago: string
  fechaVencimiento: string
  metodoPago: string
  referencia: string | null
  estado: string
  notas?: string | null
  motivoReversion?: string | null
  fechaReversion?: string | null
  prestamo: {
    codigo: string
    cliente: { nombre: string; cedula: string }
  }
}

interface PrestamoAplicar {
  id: string
  codigo: string
  cliente: { id: string; nombre: string; cedula: string; telefono: string }
  montoPrincipal?: number
  montoCuota: number
  numeroCuotas: number
  cuotasPagadas: number
  proximaCuota: number
  fechaVencimiento: string
  // Mora en tiempo real
  diasMora: number
  moraActual: number
  moraPagadaCuota: number
  moraPendiente: number
  moraDiariaPesos: number
  tasaMoraDiaria: number
  // === Renegociación de mora ===
  moraRenegociada: number | null
  moraRenegociadaAccion: string | null
  moraRenegociadaFecha: string | null
  moraRenegociadaPorNombre: string | null
  moraRenegociadaObservacion: string | null
  moraRenegociadaMoraOriginal: number | null
  moraRenegociadaAplicada: boolean
  // Pagos acumulados en esta cuota
  capitalPagadoCuota: number
  interesPagadoCuota: number
  totalPagadoCuota: number
  // Totales
  cuotaBase: number
  totalCuotaConMora: number
  montoPendiente: number
  montoTotalPendiente: number
  cuentaRecaudo: any
  estado: string
  frecuencia: string
  // === Tarea Q: Flexibilidad Financiera ===
  flexibilidadFinanciera?: boolean
  flexibilidadActivada?: boolean
  flexibilidadModalidad?: string | null
  flexibilidadUsosDisponibles?: number
  flexibilidadUsosEjercidos?: number
  flexibilidadCosto?: number
  flexibilidadElegible?: boolean
  flexibilidadRazonInelegible?: string | null
  // === Modalidad INTERES_FIJO_SIN_CAPITAL ===
  modalidadAmortizacion?: string
  interesFijoMensual?: number
  capitalPagadoExtra?: number
  saldoReal?: number
  proximaCuotaInteresFecha?: string | null
}

interface ProximoPago {
  prestamoId: string
  codigo: string
  cliente: { nombre: string; cedula: string; telefono: string }
  proximaCuota: number
  totalCuotas: number
  frecuencia: string
  fechaVencimiento: string
  diasMora: number
  // Desglose de la cuota
  cuotaBase: number
  capitalCuota: number
  interesCuota: number
  // Mora
  moraActual: number
  moraPagadaCuota: number
  moraPendiente: number
  moraDiariaPesos: number
  tasaMoraDiaria: number
  // Pagos acumulados
  capitalPagadoCuota: number
  interesPagadoCuota: number
  totalPagadoCuota: number
  // Totales
  totalCuotaConMora: number
  montoPendiente: number
  estado: 'VENCIDO' | 'HOY' | 'PROXIMO'
  esAplazada?: boolean
}

interface InformeData {
  periodo?: {
    tipo: string
    etiqueta: string
    inicio: string
    fin: string
  }
  resumenPeriodo?: {
    totalRecaudado: number
    capitalRecaudado: number
    interesRecaudado: number
    moraRecaudada: number
    numPagos: number
  }
  proyeccion?: {
    capitalProgramado: number
    capitalRecaudado: number
    capitalPendiente: number
    interesProgramado: number
    interesRecaudado: number
    interesPendiente: number
    moraAcumulada: number
    moraRecaudada: number
    moraPendiente: number
  }
  morosos?: any[]
  reporteAnual?: any[]
  comparativoDiario: {
    hoy: { fecha: string; total: number; numPagos: number; promedio: number }
    ayer: { fecha: string; total: number; numPagos: number; promedio: number }
    variacion: number
  }
  comparativoMensual: {
    mesActual: { mes: string; total: number; numPagos: number }
    mesAnterior: { mes: string; total: number; numPagos: number }
    variacion: number
  }
  cartera: {
    prestamosActivos: number
    prestamosEnMora: number
    saldoTotalActivos: number
    tasaMora: number
  }
  topClientesHoy: any[]
  metodosHoy: any
}

export function PagosView({ onChanged }: { onChanged: () => void }) {
  const [tab, setTab] = useState('pagos-dia')

  // Pagos del día
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])
  const [enviandoNotif, setEnviandoNotif] = useState(false)

  // === v4.0: estados para nuevas funcionalidades ===
  const [pagoSoloInteresesTarget, setPagoSoloInteresesTarget] = useState<any | null>(null)
  const [modalConciliacion, setModalConciliacion] = useState(false)
  const [modalPrediccion, setModalPrediccion] = useState(false)
  const [reciboPagoId, setReciboPagoId] = useState<string | null>(null)
  
  // Modal reversar pago
  const [pagoAReversar, setPagoAReversar] = useState<Pago | null>(null)
  const [motivoReversion, setMotivoReversion] = useState('')
  const [reversando, setReversando] = useState(false)
  
  // Modal eliminar pago
  const [pagoAEliminar, setPagoAEliminar] = useState<Pago | null>(null)
  const [eliminando, setEliminando] = useState(false)
  
  // Modal aplicar pago
  const [modalAplicar, setModalAplicar] = useState(false)
  const [busquedaAplicar, setBusquedaAplicar] = useState('')
  const [prestamosAplicar, setPrestamosAplicar] = useState<PrestamoAplicar[]>([])
  const [loadingAplicar, setLoadingAplicar] = useState(false)
  const [prestamoSeleccionadoAplicar, setPrestamoSeleccionadoAplicar] = useState<PrestamoAplicar | null>(null)
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [referencia, setReferencia] = useState('')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [cuentaRecaudoId, setCuentaRecaudoId] = useState('')
  const [aplicandoPago, setAplicandoPago] = useState(false)
  // === Abono extraordinario al capital (modalidad INTERES_FIJO_SIN_CAPITAL) ===
  const [abonarAlCapital, setAbonarAlCapital] = useState(false)
  const [montoAbonoCapital, setMontoAbonoCapital] = useState('')

  // === Modal renegociar / anular mora ===
  const [modalRenegociarMora, setModalRenegociarMora] = useState(false)
  const [accionMora, setAccionMora] = useState<'ANULAR' | 'NEGOCIAR'>('ANULAR')
  const [nuevaMoraValor, setNuevaMoraValor] = useState('')
  const [observacionMora, setObservacionMora] = useState('')
  const [renegociandoMora, setRenegociandoMora] = useState(false)

  // === Tarea Q: Modal Flexibilidad Financiera ===
  const [modalFlexibilidad, setModalFlexibilidad] = useState(false)
  const [observacionFlexibilidad, setObservacionFlexibilidad] = useState('')
  const [usandoFlexibilidad, setUsandoFlexibilidad] = useState(false)
  const [confirmacionFlexibilidad, setConfirmacionFlexibilidad] = useState(false)
  
  // Próximos pagos
  const [proximos, setProximos] = useState<ProximoPago[]>([])
  const [loadingProximos, setLoadingProximos] = useState(false)
  const [resumenProximos, setResumenProximos] = useState<any>(null)
  const [exportando, setExportando] = useState(false)

  // Informe
  const [informe, setInforme] = useState<InformeData | null>(null)
  const [loadingInforme, setLoadingInforme] = useState(false)
  const [periodoInforme, setPeriodoInforme] = useState<'semana' | 'quincena' | 'mes' | 'año'>('mes')
  
  const { toast } = useToast()

  useEffect(() => {
    if (tab === 'pagos-dia') cargarPagos()
    else if (tab === 'proximos') cargarProximos()
    else if (tab === 'informe') cargarInforme()
  }, [tab, fechaFiltro, periodoInforme])

  const cargarPagos = async () => {
    try {
      setLoading(true)
      const url = fechaFiltro ? `/api/pagos?fecha=${fechaFiltro}` : '/api/pagos'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setPagos(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cargarProximos = async () => {
    try {
      setLoadingProximos(true)
      const res = await fetch('/api/pagos/proximos?dias=30')
      const json = await res.json()
      if (json.success) {
        setProximos(json.data)
        setResumenProximos(json.resumen)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingProximos(false)
    }
  }

  const cargarInforme = async (periodo?: string) => {
    try {
      setLoadingInforme(true)
      const p = periodo || periodoInforme
      const res = await fetch(`/api/pagos/informe?periodo=${p}`)
      const json = await res.json()
      if (json.success) setInforme(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingInforme(false)
    }
  }

  const dispararRecordatorios = async () => {
    try {
      setEnviandoNotif(true)
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'recordatorios' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Recordatorios enviados',
          description: `${json.data.notificacionesEnviadas} enviados, ${json.data.notificacionesFallidas} fallidos`,
        })
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoNotif(false)
    }
  }

  const avisosMora = async () => {
    try {
      setEnviandoNotif(true)
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'mora' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Avisos de mora enviados',
          description: `${json.data.notificacionesEnviadas} enviados, ${json.data.notificacionesFallidas} fallidos`,
        })
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoNotif(false)
    }
  }

  // === ABRIR MODAL APLICAR PAGO ===
  const abrirModalAplicar = async () => {
    setModalAplicar(true)
    setBusquedaAplicar('')
    setPrestamoSeleccionadoAplicar(null)
    setMetodoPago('EFECTIVO')
    setReferencia('')
    setMontoRecibido('')
    setCuentaRecaudoId('')
    setAbonarAlCapital(false)
    setMontoAbonoCapital('')
    await buscarPrestamosAplicar('')
  }

  const buscarPrestamosAplicar = async (q: string) => {
    try {
      setLoadingAplicar(true)
      const res = await fetch(`/api/pagos/aplicar?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success) setPrestamosAplicar(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoadingAplicar(false)
    }
  }

  const seleccionarPrestamoAplicar = (p: PrestamoAplicar) => {
    setPrestamoSeleccionadoAplicar(p)
    setMontoRecibido(p.montoTotalPendiente.toString())
    if (p.cuentaRecaudo) {
      setCuentaRecaudoId(p.cuentaRecaudo.id)
      setMetodoPago('TRANSFERENCIA')
    }
  }

  // === Cálculo de desglose en tiempo real (para preview del pago parcial) ===
  // Usa los datos del API: cuota base, mora pendiente, ya pagado
  const desglosePago = (() => {
    if (!prestamoSeleccionadoAplicar || !montoRecibido) return null
    const monto = parseFloat(montoRecibido)
    if (isNaN(monto) || monto <= 0) return null

    const p = prestamoSeleccionadoAplicar
    // Total a pagar para completar la cuota (con mora)
    const totalCuota = p.totalCuotaConMora
    // Lo ya pagado en esta cuota (parcial)
    const yaPagado = p.totalPagadoCuota
    // Lo pendiente (incluyendo mora si aplica)
    const pendiente = p.montoPendiente

    // Distribución del nuevo pago (mora → interés → capital)
    // Solo sobre lo pendiente
    const moraPendienteCuota = p.moraPendiente
    const interesPendienteCuota = Math.max(0, (p.cuotaBase - p.capitalPagadoCuota) - (p.cuotaBase - p.interesPagadoCuota - p.capitalPagadoCuota))
    // Interés pendiente = interés de la cuota - ya pagado
    const interesCuotaTotal = p.cuotaBase - (p.montoCuota - (p.montoCuota * 0.3)) // aproximado
    // Mejor: usar el cuotaPendiente si está disponible
    const interesBasePendiente = Math.max(0, p.cuotaBase * 0.3 - p.interesPagadoCuota) // ~30% interés
    const capitalBasePendiente = Math.max(0, p.cuotaBase * 0.7 - p.capitalPagadoCuota)

    let resto = monto
    let moraPagada = 0
    let interesPagado = 0
    let capitalPagado = 0

    // 1. Mora pendiente
    if (moraPendienteCuota > 0) {
      moraPagada = Math.min(resto, moraPendienteCuota)
      resto = Math.max(0, resto - moraPagada)
    }
    // 2. Interés pendiente
    if (resto > 0 && interesBasePendiente > 0) {
      interesPagado = Math.min(resto, interesBasePendiente)
      resto = Math.max(0, resto - interesPagado)
    }
    // 3. Capital pendiente
    if (resto > 0 && capitalBasePendiente > 0) {
      capitalPagado = Math.min(resto, capitalBasePendiente)
      resto = Math.max(0, resto - capitalPagado)
    }

    const totalPagado = moraPagada + interesPagado + capitalPagado
    const nuevoAcumulado = yaPagado + totalPagado
    const esParcial = nuevoAcumulado < totalCuota
    const faltante = Math.max(0, totalCuota - nuevoAcumulado)

    return {
      moraPagada,
      interesPagado,
      capitalPagado,
      totalPagado,
      nuevoAcumulado,
      esParcial,
      faltante,
      totalCuota,
      pendiente,
      yaPagado,
    }
  })()

  const confirmarAplicarPago = async () => {
    if (!prestamoSeleccionadoAplicar) return

    // === Caso especial: Abono extraordinario al capital ===
    // Si el préstamo es INTERES_FIJO_SIN_CAPITAL y el gestor marcó "Abonar al capital",
    // enviamos una acción diferente al backend (accion: 'abonar_capital') que registra
    // el pago como abono extraordinario y actualiza el saldo real sin tocar la cuota mensual.
    if (abonarAlCapital) {
      const montoAbono = parseFloat(montoAbonoCapital)
      if (!montoAbonoCapital || isNaN(montoAbono) || montoAbono <= 0) {
        toast({ title: 'Error', description: 'Ingresa un monto de abono válido', variant: 'destructive' })
        return
      }
      const saldoRealMax = prestamoSeleccionadoAplicar.saldoReal || prestamoSeleccionadoAplicar.montoPrincipal || 0
      if (montoAbono > saldoRealMax) {
        toast({
          title: 'Error',
          description: `El monto del abono (${formatearMoneda(montoAbono)}) no puede exceder el saldo real del capital (${formatearMoneda(saldoRealMax)}).`,
          variant: 'destructive',
        })
        return
      }
      setAplicandoPago(true)
      try {
        const body: any = {
          accion: 'abonar_capital',
          prestamoId: prestamoSeleccionadoAplicar.id,
          montoAbono: montoAbono,
          metodoPago,
          referencia: referencia || `Abono al capital - ${prestamoSeleccionadoAplicar.codigo}`,
          cuentaRecaudoId: cuentaRecaudoId || null,
        }
        const res = await fetch('/api/pagos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (json.success) {
          toast({
            title: '✅ Abono al capital aplicado',
            description: json.mensaje || `Abono de ${formatearMoneda(montoAbono)} registrado. Nuevo saldo: ${formatearMoneda(json.nuevoSaldoReal)}.`,
          })
          setModalAplicar(false)
          setPrestamoSeleccionadoAplicar(null)
          setMontoAbonoCapital('')
          setAbonarAlCapital(false)
          setReferencia('')
          setMontoRecibido('')
          cargarPagos()
          onChanged()
          if (json.data?.id) {
            setTimeout(() => setReciboPagoId(json.data.id), 400)
          }
        } else {
          toast({ title: 'Error', description: json.error, variant: 'destructive' })
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' })
      } finally {
        setAplicandoPago(false)
      }
      return
    }

    // === Flujo normal de pago de cuota ===
    if (!montoRecibido) {
      toast({ title: 'Error', description: 'Ingresa el monto recibido', variant: 'destructive' })
      return
    }
    setAplicandoPago(true)
    try {
      const body: any = {
        prestamoId: prestamoSeleccionadoAplicar.id,
        numeroCuota: prestamoSeleccionadoAplicar.proximaCuota,
        montoTotal: parseFloat(montoRecibido),
        metodoPago,
        referencia: referencia || null,
        cuentaRecaudoId: cuentaRecaudoId || null,
      }
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '✅ Pago aplicado',
          description: `Cuota ${prestamoSeleccionadoAplicar.proximaCuota} de ${prestamoSeleccionadoAplicar.cliente.nombre} registrada por ${formatearMoneda(parseFloat(montoRecibido))}`,
        })
        setModalAplicar(false)
        setPrestamoSeleccionadoAplicar(null)
        setMontoRecibido('')
        setReferencia('')
        cargarPagos()
        onChanged()
        // === ORDEN OBLIGATORIA 3: Abrir vista previa siempre que se termina un proceso ===
        // Tras aplicar el pago, abrir automáticamente el recibo preview para que el
        // usuario pueda imprimirlo, descargarlo o enviarlo al cliente.
        if (json.data?.id) {
          setTimeout(() => {
            setReciboPagoId(json.data.id)
          }, 400)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setAplicandoPago(false)
    }
  }

  // === REVERSAR PAGO ===
  const abrirModalReversar = (pago: Pago) => {
    setPagoAReversar(pago)
    setMotivoReversion('')
  }

  // === Tarea Q: USAR FLEXIBILIDAD FINANCIERA ===
  // Abre el modal de confirmación para trasladar la cuota pendiente al final del crédito.
  const abrirModalFlexibilidad = () => {
    if (!prestamoSeleccionadoAplicar) return
    if (!prestamoSeleccionadoAplicar.flexibilidadElegible) {
      toast({
        title: 'No disponible',
        description: prestamoSeleccionadoAplicar.flexibilidadRazonInelegible || 'No se puede usar Flexibilidad Financiera en este momento.',
        variant: 'destructive',
      })
      return
    }
    setObservacionFlexibilidad('')
    setConfirmacionFlexibilidad(false)
    setModalFlexibilidad(true)
  }

  const confirmarUsarFlexibilidad = async () => {
    if (!prestamoSeleccionadoAplicar) return
    if (!confirmacionFlexibilidad) {
      toast({
        title: 'Confirmación requerida',
        description: 'Debes marcar la casilla de confirmación para usar el beneficio.',
        variant: 'destructive',
      })
      return
    }
    setUsandoFlexibilidad(true)
    try {
      const body: any = {
        accion: 'usar_flexibilidad',
        prestamoId: prestamoSeleccionadoAplicar.id,
        observacion: observacionFlexibilidad.trim() || null,
      }
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '✅ Flexibilidad aplicada',
          description: json.mensaje,
        })
        setModalFlexibilidad(false)
        setModalAplicar(false)
        setPrestamoSeleccionadoAplicar(null)
        setMontoRecibido('')
        setReferencia('')
        setObservacionFlexibilidad('')
        setConfirmacionFlexibilidad(false)
        cargarPagos()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setUsandoFlexibilidad(false)
    }
  }

  // === RENEGOCIAR / ANULAR MORA ===
  const abrirModalRenegociarMora = () => {
    if (!prestamoSeleccionadoAplicar) return
    setAccionMora('ANULAR')
    setNuevaMoraValor('0')
    setObservacionMora('')
    setModalRenegociarMora(true)
  }

  const confirmarRenegociarMora = async () => {
    if (!prestamoSeleccionadoAplicar) return
    if (observacionMora.trim().length < 10) {
      toast({
        title: 'Observación requerida',
        description: 'Explica el acuerdo con el cliente (mínimo 10 caracteres)',
        variant: 'destructive',
      })
      return
    }
    if (accionMora === 'NEGOCIAR') {
      const v = parseFloat(nuevaMoraValor)
      if (isNaN(v) || v < 0) {
        toast({
          title: 'Valor inválido',
          description: 'Ingresa un valor válido para la nueva mora',
          variant: 'destructive',
        })
        return
      }
    }
    setRenegociandoMora(true)
    try {
      const body: any = {
        prestamoId: prestamoSeleccionadoAplicar.id,
        accion: accionMora,
        observacion: observacionMora.trim(),
      }
      if (accionMora === 'NEGOCIAR') {
        body.nuevaMora = parseFloat(nuevaMoraValor)
      }
      const res = await fetch('/api/pagos/renegociar-mora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Mora actualizada',
          description: json.mensaje,
        })
        setModalRenegociarMora(false)
        // Recargar el préstamo seleccionado para reflejar la nueva mora
        await buscarPrestamosAplicar(busquedaAplicar)
        // Actualizar el préstamo seleccionado
        const actualizado = await fetch(
          `/api/pagos/aplicar?q=${encodeURIComponent(prestamoSeleccionadoAplicar.codigo)}`
        )
        const jsonAct = await actualizado.json()
        if (jsonAct.success) {
          const encontrado = jsonAct.data.find(
            (p: PrestamoAplicar) => p.id === prestamoSeleccionadoAplicar.id
          )
          if (encontrado) {
            setPrestamoSeleccionadoAplicar(encontrado)
            setMontoRecibido(encontrado.montoTotalPendiente.toString())
          }
        }
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setRenegociandoMora(false)
    }
  }

  const revertirRenegociacionMora = async () => {
    if (!prestamoSeleccionadoAplicar) return
    if (
      !confirm(
        '¿Revertir la renegociación de mora? La mora volverá a calcularse automáticamente según los días de atraso.'
      )
    )
      return
    try {
      const res = await fetch(
        `/api/pagos/renegociar-mora?prestamoId=${prestamoSeleccionadoAplicar.id}`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Renegociación revertida', description: json.mensaje })
        await buscarPrestamosAplicar(busquedaAplicar)
        const actualizado = await fetch(
          `/api/pagos/aplicar?q=${encodeURIComponent(prestamoSeleccionadoAplicar.codigo)}`
        )
        const jsonAct = await actualizado.json()
        if (jsonAct.success) {
          const encontrado = jsonAct.data.find(
            (p: PrestamoAplicar) => p.id === prestamoSeleccionadoAplicar.id
          )
          if (encontrado) {
            setPrestamoSeleccionadoAplicar(encontrado)
            setMontoRecibido(encontrado.montoTotalPendiente.toString())
          }
        }
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const confirmarReversar = async () => {
    if (!pagoAReversar) return
    if (!motivoReversion.trim()) {
      toast({ title: 'Error', description: 'Debes ingresar un motivo de reversión', variant: 'destructive' })
      return
    }
    setReversando(true)
    try {
      const res = await fetch(`/api/pagos/${pagoAReversar.id}/reversar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoReversion }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Pago reversado',
          description: json.mensaje || `Pago de ${pagoAReversar.montoTotal} reversado correctamente`,
        })
        setPagoAReversar(null)
        cargarPagos()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setReversando(false)
    }
  }

  // === ELIMINAR PAGO ===
  const abrirModalEliminar = (pago: Pago) => {
    setPagoAEliminar(pago)
  }

  const confirmarEliminar = async () => {
    if (!pagoAEliminar) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/pagos/${pagoAEliminar.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Pago eliminado',
          description: json.mensaje || 'Pago eliminado completamente',
        })
        setPagoAEliminar(null)
        cargarPagos()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEliminando(false)
    }
  }

  // === DESCARGAR ESTADO DE CUENTA ===
  const descargarEstadoCuenta = (cedula: string, nombre: string) => {
    abrirHtmlImprimible(`/api/estado-cuenta?cedula=${encodeURIComponent(cedula)}`)
    toast({
      title: 'Estado de cuenta abierto',
      description: `Se abrió el estado de cuenta de ${nombre}. Usa el botón "Imprimir / Guardar PDF" para descargarlo.`,
      duration: 6000,
    })
  }

  // === Cálculos ===
  const totalDia = pagos
    .filter((p) => p.estado === 'APLICADO')
    .reduce((s, p) => s + p.montoTotal, 0)

  // === RENDER ===
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos"
        subtitle="Recaudo, aplicación y gestión de pagos"
        icon={<DollarSign className="w-5 h-5" />}
        actions={
          <>
            <Button onClick={abrirModalAplicar} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Aplicar Pago
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalConciliacion(true)}
              title="Importar CSV del banco y conciliar pagos pendientes"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Conciliación
            </Button>
            <Button
              variant="outline"
              className="text-purple-700 border-purple-300 hover:bg-purple-50"
              onClick={() => setModalPrediccion(true)}
              title="Análisis predictivo de mora con IA"
            >
              <Brain className="w-4 h-4 mr-2" />
              IA Mora
            </Button>
            <Button
              variant="outline"
              onClick={dispararRecordatorios}
              disabled={enviandoNotif}
            >
              <Bell className="w-4 h-4 mr-2" />
              Recordatorios
            </Button>
            <Button
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={avisosMora}
              disabled={enviandoNotif}
            >
              <Bell className="w-4 h-4 mr-2" />
              Avisos Mora
            </Button>
          </>
        }
      />

      {/* === BOTS DISPONIBLES === */}
      <BotIcons modulo="pagos" />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="pagos-dia">
              <DollarSign className="w-3.5 h-3.5 mr-1.5" />
              Pagos del día
            </TabsTrigger>
            <TabsTrigger value="proximos">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Próximos
            </TabsTrigger>
            <TabsTrigger value="calendario">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="informe">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Informe
            </TabsTrigger>
            <TabsTrigger value="graficos">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Gráficos
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            disabled={exportando}
            onClick={async () => {
              const params = new URLSearchParams()
              if (tab === 'pagos-dia') {
                params.set('tipo', 'hoy')
                if (fechaFiltro) params.set('fecha', fechaFiltro)
              } else if (tab === 'proximos') {
                params.set('tipo', 'rango')
                params.set('desde', new Date().toISOString().slice(0, 10))
                const fin = new Date()
                fin.setDate(fin.getDate() + 30)
                params.set('hasta', fin.toISOString().slice(0, 10))
              } else if (tab === 'informe' || tab === 'graficos') {
                params.set('tipo', 'informe')
                params.set('periodo', periodoInforme)
              } else {
                params.set('tipo', 'hoy')
              }
              // IMPORTANTE: usar descargarArchivo (fetch + Blob) en lugar de
              // window.open, porque window.open NO puede añadir el header
              // Authorization: Bearer y en producción el endpoint devuelve
              // 401 "No autorizado. Token requerido."
              setExportando(true)
              const ok = await descargarArchivo(`/api/pagos/export?${params.toString()}`)
              setExportando(false)
              if (!ok) {
                toast({
                  title: 'No se pudo exportar',
                  description: 'Verifica tu sesión e intenta nuevamente.',
                  variant: 'destructive',
                })
              }
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        </div>

        {/* ============== TAB: PAGOS DEL DÍA ============== */}
        <TabsContent value="pagos-dia" className="space-y-4 mt-4">
          {/* Resumen del día */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Recaudado
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{formatearMoneda(totalDia)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  N° Pagos
                </p>
                <p className="text-2xl font-bold mt-1">{pagos.filter(p => p.estado === 'APLICADO').length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Fecha</p>
                  <Input
                    type="date"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={cargarPagos} title="Recargar">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Préstamo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Interés</TableHead>
                    <TableHead>Mora</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : pagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No hay pagos registrados en esta fecha.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagos.map((p) => (
                      <TableRow
                        key={p.id}
                        className={`hover:bg-muted/40 ${p.estado === 'REVERSADO' ? 'opacity-60 bg-red-50/30' : ''}`}
                      >
                        <TableCell className="text-sm">{formatearFecha(p.fechaPago)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.prestamo.codigo}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{p.prestamo.cliente.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.prestamo.cliente.cedula}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.numeroCuota}</TableCell>
                        <TableCell className="text-sm">{formatearMoneda(p.montoCapital)}</TableCell>
                        <TableCell className="text-sm">{formatearMoneda(p.montoInteres)}</TableCell>
                        <TableCell className="text-sm">
                          {p.montoMora > 0 ? (
                            <span className="text-red-700">{formatearMoneda(p.montoMora)}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700">
                          {formatearMoneda(p.montoTotal)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-xs font-medium">
                            {p.metodoPago}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.estado === 'APLICADO' && (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                              Aplicado
                            </Badge>
                          )}
                          {p.estado === 'PAGO_PARCIAL' && (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              ⚡ Pago Parcial
                            </Badge>
                          )}
                          {p.estado === 'REVERSADO' && (
                            <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                              ⚠ Reversado
                            </Badge>
                          )}
                          {p.estado === 'PENDIENTE' && (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              Pendiente
                            </Badge>
                          )}
                          {p.estado === 'ANULADO' && (
                            <Badge variant="outline" className="text-gray-700">
                              Anulado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 h-8"
                              onClick={() => descargarEstadoCuenta(p.prestamo.cliente.cedula, p.prestamo.cliente.nombre)}
                              title="Descargar estado de cuenta del cliente"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {(p.estado === 'APLICADO' || p.estado === 'PAGO_PARCIAL') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8"
                                onClick={() => setReciboPagoId(p.id)}
                                title="Generar recibo con QR de verificación"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {p.estado === 'APLICADO' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-8"
                                  onClick={() => abrirModalReversar(p)}
                                  title="Reversar pago (mantiene registro)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-700 hover:text-red-800 hover:bg-red-50 h-8"
                                  onClick={() => abrirModalEliminar(p)}
                                  title="Eliminar pago (borra el registro)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {p.estado === 'PAGO_PARCIAL' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-8"
                                  onClick={() => abrirModalReversar(p)}
                                  title="Reversar pago parcial"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-700 hover:text-red-800 hover:bg-red-50 h-8"
                                  onClick={() => abrirModalEliminar(p)}
                                  title="Eliminar pago parcial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {p.estado === 'REVERSADO' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-700 hover:text-red-800 hover:bg-red-50 h-8"
                                onClick={() => abrirModalEliminar(p)}
                                title="Eliminar pago (borra el registro)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== TAB: PRÓXIMOS PAGOS ============== */}
        <TabsContent value="proximos" className="space-y-4 mt-4">
          {resumenProximos && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total esperado (30 días)</p>
                  <p className="text-xl font-bold text-blue-700">{formatearMoneda(resumenProximos.totalEsperado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total recaudado</p>
                  <p className="text-xl font-bold text-emerald-700">{formatearMoneda(resumenProximos.totalRecaudado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total pendiente</p>
                  <p className="text-xl font-bold text-amber-700">{formatearMoneda(resumenProximos.totalPendiente)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total mora acumulada</p>
                  <p className="text-xl font-bold text-red-700">{formatearMoneda(resumenProximos.totalMoraAcumulada || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Vencidos / Hoy / Próximos</p>
                  <p className="text-xl font-bold">
                    <span className="text-red-700">{resumenProximos.vencidos}</span>
                    {' / '}
                    <span className="text-amber-700">{resumenProximos.hoy}</span>
                    {' / '}
                    <span className="text-blue-700">{resumenProximos.proximos}</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Préstamo / Cliente</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Días mora</TableHead>
                    <TableHead>Desglose cuota</TableHead>
                    <TableHead>Ya pagado</TableHead>
                    <TableHead>Pendiente HOY</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProximos ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Cargando próximos pagos...
                      </TableCell>
                    </TableRow>
                  ) : proximos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No hay pagos próximos en los siguientes 30 días.
                      </TableCell>
                    </TableRow>
                  ) : (
                    proximos.map((p) => (
                      <TableRow key={p.prestamoId} className={p.estado === 'VENCIDO' ? 'bg-red-50/40' : ''}>
                        <TableCell>
                          {p.estado === 'VENCIDO' && (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Vencido
                            </Badge>
                          )}
                          {p.estado === 'HOY' && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                              <Clock className="w-3 h-3 mr-1" /> Hoy
                            </Badge>
                          )}
                          {p.estado === 'PROXIMO' && (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                              Próximo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{p.codigo}</div>
                          <div className="font-semibold text-sm">{p.cliente.nombre}</div>
                          <div className="text-xs text-muted-foreground">{p.cliente.cedula}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.proximaCuota}/{p.totalCuotas}
                          <div className="text-xs text-muted-foreground capitalize">{p.frecuencia.toLowerCase()}</div>
                        </TableCell>
                        <TableCell className="text-sm">{formatearFecha(p.fechaVencimiento)}</TableCell>
                        <TableCell>
                          {p.diasMora > 0 ? (
                            <div>
                              <span className="text-red-700 font-bold text-base">{p.diasMora}</span>
                              <div className="text-[10px] text-red-700">días</div>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Base:</span>
                              <strong>{formatearMoneda(p.cuotaBase)}</strong>
                            </div>
                            {p.moraPendiente > 0 ? (
                              <>
                                <div className="flex justify-between gap-2 text-red-700 bg-red-50 px-1 rounded">
                                  <span>+ Mora ({p.tasaMoraDiaria}% × {p.diasMora}d):</span>
                                  <strong>+{formatearMoneda(p.moraActual)}</strong>
                                </div>
                                {p.moraPagadaCuota > 0 && (
                                  <div className="flex justify-between gap-2 text-emerald-700">
                                    <span>− Mora pagada:</span>
                                    <strong>−{formatearMoneda(p.moraPagadaCuota)}</strong>
                                  </div>
                                )}
                                <div className="text-[10px] text-red-700 italic flex items-center gap-1 mt-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  +{formatearMoneda(p.moraDiariaPesos)}/día
                                </div>
                              </>
                            ) : (
                              <div className="text-[10px] text-muted-foreground italic">
                                Sin mora
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.totalPagadoCuota > 0 ? (
                            <div className="text-xs">
                              <span className="font-bold text-emerald-700">{formatearMoneda(p.totalPagadoCuota)}</span>
                              <div className="text-[10px] text-muted-foreground">pagado</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-bold text-amber-700">{formatearMoneda(p.montoPendiente)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              de {formatearMoneda(p.totalCuotaConMora)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:bg-emerald-50 h-8"
                              onClick={() => {
                                const mensaje = `🔔 *RECORDATORIO DE PAGO - JSADR*

Hola *${p.cliente.nombre}*,

Te recordamos tu próximo pago:

📋 *Detalle:*
• Préstamo: ${p.codigo}
• Cuota: ${p.proximaCuota}/${p.totalCuotas}
• Fecha de vencimiento: ${formatearFecha(p.fechaVencimiento)}
${p.diasMora > 0 ? `• Días de mora: ${p.diasMora}\n` : ''}• Valor a pagar: ${formatearMoneda(p.totalCuotaConMora)}

Por favor realiza tu pago a tiempo para evitar recargos.

Si ya realizaste el pago, ignora este mensaje.`
                                const link = `https://wa.me/57${p.cliente.telefono}?text=${encodeURIComponent(mensaje)}`
                                window.open(link, '_blank')
                                toast({
                                  title: 'WhatsApp abierto',
                                  description: `Mensaje de cobro para ${p.cliente.nombre}`,
                                })
                              }}
                              title="Enviar cobro por WhatsApp"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 h-8"
                              onClick={() => {
                                abrirModalAplicar()
                                setTimeout(() => setBusquedaAplicar(p.codigo), 500)
                              }}
                            >
                              <Banknote className="w-3.5 h-3.5 mr-1" />
                              Aplicar
                            </Button>
                            {!p.esAplazada && p.interesCuota > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50 h-8"
                                onClick={() => setPagoSoloInteresesTarget(p)}
                                title="Pagar solo intereses y aplazar la cuota (sin mora)"
                              >
                                <Sparkles className="w-3.5 h-3.5 mr-1" />
                                Solo Intereses
                              </Button>
                            )}
                            {p.esAplazada && (
                              <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-[10px]">
                                Aplazada
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== TAB: INFORME ============== */}
        <TabsContent value="informe" className="space-y-4 mt-4">
          {loadingInforme ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Cargando informe...
              </CardContent>
            </Card>
          ) : informe ? (
            <>
              {/* === Selector de periodo === */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">Periodo del informe</p>
                      <p className="text-xs text-muted-foreground">
                        {informe.periodo?.etiqueta || 'Mes actual'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(['semana', 'quincena', 'mes', 'año'] as const).map((p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant={periodoInforme === p ? 'default' : 'outline'}
                          onClick={() => setPeriodoInforme(p)}
                          className="text-xs"
                        >
                          {p === 'semana' ? 'Semana' : p === 'quincena' ? 'Quincena' : p === 'mes' ? 'Mes' : 'Año'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* === Resumen del periodo === */}
              {informe.resumenPeriodo && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Total Recaudado</p>
                      <p className="text-xl font-bold text-emerald-400">{formatearMoneda(informe.resumenPeriodo.totalRecaudado)}</p>
                      <p className="text-[10px] text-muted-foreground">{informe.resumenPeriodo.numPagos} pagos</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Capital</p>
                      <p className="text-xl font-bold text-blue-400">{formatearMoneda(informe.resumenPeriodo.capitalRecaudado)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-cyan-500/5 border-cyan-500/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Intereses</p>
                      <p className="text-xl font-bold text-cyan-400">{formatearMoneda(informe.resumenPeriodo.interesRecaudado)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Mora</p>
                      <p className="text-xl font-bold text-amber-400">{formatearMoneda(informe.resumenPeriodo.moraRecaudada)}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* === Proyección: programado vs recaudado === */}
              {informe.proyeccion && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Proyección vs Recaudado — {informe.periodo?.etiqueta}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Capital */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">Capital programado</span>
                        <span>{formatearMoneda(informe.proyeccion.capitalProgramado)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${informe.proyeccion.capitalProgramado > 0
                              ? Math.min(100, (informe.proyeccion.capitalRecaudado / informe.proyeccion.capitalProgramado) * 100)
                              : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Recaudado: {formatearMoneda(informe.proyeccion.capitalRecaudado)}</span>
                        <span>Pendiente: {formatearMoneda(informe.proyeccion.capitalPendiente)}</span>
                      </div>
                    </div>

                    {/* Intereses */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">Intereses proyectados</span>
                        <span>{formatearMoneda(informe.proyeccion.interesProgramado)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500"
                          style={{
                            width: `${informe.proyeccion.interesProgramado > 0
                              ? Math.min(100, (informe.proyeccion.interesRecaudado / informe.proyeccion.interesProgramado) * 100)
                              : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Recaudado: {formatearMoneda(informe.proyeccion.interesRecaudado)}</span>
                        <span>Pendiente: {formatearMoneda(informe.proyeccion.interesPendiente)}</span>
                      </div>
                    </div>

                    {/* Mora */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">Mora acumulada (saldo entrante)</span>
                        <span>{formatearMoneda(informe.proyeccion.moraAcumulada)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{
                            width: `${informe.proyeccion.moraAcumulada > 0
                              ? Math.min(100, (informe.proyeccion.moraRecaudada / informe.proyeccion.moraAcumulada) * 100)
                              : 0}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Recaudado: {formatearMoneda(informe.proyeccion.moraRecaudada)}</span>
                        <span>Pendiente: {formatearMoneda(informe.proyeccion.moraPendiente)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* === Listado de morosos === */}
              {informe.morosos && informe.morosos.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Personas que no han pagado
                      <Badge variant="outline" className="text-red-400 border-red-500/30">
                        {informe.morosos.length} morosos
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Préstamo</TableHead>
                            <TableHead>Cuota</TableHead>
                            <TableHead>Vencimiento</TableHead>
                            <TableHead>Días mora</TableHead>
                            <TableHead>Cuota</TableHead>
                            <TableHead>Mora</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead className="text-right">Cobrar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {informe.morosos.map((m: any, i: number) => (
                            <TableRow key={`${m.prestamoId}-${i}`} className="bg-red-50/30">
                              <TableCell>
                                <div className="font-medium text-sm">{m.clienteNombre}</div>
                                <div className="text-xs text-muted-foreground">{m.clienteCedula}</div>
                                <div className="text-xs text-muted-foreground">{m.clienteTelefono}</div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                              <TableCell className="text-xs">#{m.cuotaPendiente}</TableCell>
                              <TableCell className="text-xs">{formatearFecha(m.fechaVencimiento)}</TableCell>
                              <TableCell>
                                <span className="text-red-700 font-bold text-base">{m.diasMora}</span>
                                <span className="text-[10px] text-red-600 ml-1">días</span>
                              </TableCell>
                              <TableCell className="text-sm">{formatearMoneda(m.montoCuota)}</TableCell>
                              <TableCell className="text-sm text-amber-600">{formatearMoneda(m.moraAcumulada)}</TableCell>
                              <TableCell className="text-sm font-bold text-red-700">{formatearMoneda(m.totalAdeudado)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                                  onClick={() => {
                                    // Abrir WhatsApp con mensaje de cobro
                                    const mensaje = `🔔 *RECORDATORIO DE PAGO - JSADR*

Hola *${m.clienteNombre}*,

Te recordamos que tienes un pago pendiente:

📋 *Detalle:*
• Préstamo: ${m.codigo}
• Cuota #: ${m.cuotaPendiente}
• Fecha de vencimiento: ${formatearFecha(m.fechaVencimiento)}
• Días de mora: ${m.diasMora}
• Valor de la cuota: ${formatearMoneda(m.montoCuota)}
• Mora acumulada: ${formatearMoneda(m.moraAcumulada)}
• **Total a pagar: ${formatearMoneda(m.totalAdeudado)}**

Por favor realiza tu pago lo antes posible para evitar mayores recargos.

Si ya realizaste el pago, ignora este mensaje.`
                                    const link = `https://wa.me/57${m.clienteTelefono}?text=${encodeURIComponent(mensaje)}`
                                    window.open(link, '_blank')
                                  }}
                                >
                                  <Banknote className="w-3 h-3 mr-1" />
                                  Cobrar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* === Reporte anual (12 meses) === */}
              {informe.reporteAnual && informe.reporteAnual.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Reporte Anual — {new Date().getFullYear()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mes</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Capital</TableHead>
                          <TableHead className="text-right">Interés</TableHead>
                          <TableHead className="text-right">Mora</TableHead>
                          <TableHead className="text-right">N° Pagos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {informe.reporteAnual.map((mes: any) => (
                          <TableRow key={mes.mesNumero}>
                            <TableCell className="font-medium capitalize">{mes.mes}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">{formatearMoneda(mes.total)}</TableCell>
                            <TableCell className="text-right text-blue-400">{formatearMoneda(mes.capital)}</TableCell>
                            <TableCell className="text-right text-cyan-400">{formatearMoneda(mes.interes)}</TableCell>
                            <TableCell className="text-right text-amber-400">{formatearMoneda(mes.mora)}</TableCell>
                            <TableCell className="text-right">{mes.numPagos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Comparativo diario */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase">Hoy</p>
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-700 mt-2">
                      {formatearMoneda(informe.comparativoDiario.hoy.total)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {informe.comparativoDiario.hoy.numPagos} pagos · Promedio: {formatearMoneda(informe.comparativoDiario.hoy.promedio)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase">Ayer</p>
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold text-blue-700 mt-2">
                      {formatearMoneda(informe.comparativoDiario.ayer.total)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {informe.comparativoDiario.ayer.numPagos} pagos · Promedio: {formatearMoneda(informe.comparativoDiario.ayer.promedio)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase">Variación diaria</p>
                      {informe.comparativoDiario.variacion >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${informe.comparativoDiario.variacion >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {informe.comparativoDiario.variacion >= 0 ? '+' : ''}{informe.comparativoDiario.variacion.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs ayer
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Comparativo mensual */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground uppercase">Mes actual</p>
                    <p className="text-sm font-semibold capitalize mt-1">{informe.comparativoMensual.mesActual.mes}</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-2">
                      {formatearMoneda(informe.comparativoMensual.mesActual.total)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {informe.comparativoMensual.mesActual.numPagos} pagos
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground uppercase">Mes anterior</p>
                    <p className="text-sm font-semibold capitalize mt-1">{informe.comparativoMensual.mesAnterior.mes}</p>
                    <p className="text-2xl font-bold text-blue-700 mt-2">
                      {formatearMoneda(informe.comparativoMensual.mesAnterior.total)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {informe.comparativoMensual.mesAnterior.numPagos} pagos
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase">Variación mensual</p>
                      {informe.comparativoMensual.variacion >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${informe.comparativoMensual.variacion >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {informe.comparativoMensual.variacion >= 0 ? '+' : ''}{informe.comparativoMensual.variacion.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs mes anterior
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Cartera */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Préstamos activos</p>
                    <p className="text-xl font-bold text-emerald-700">{informe.cartera.prestamosActivos}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">En mora</p>
                    <p className="text-xl font-bold text-red-700">{informe.cartera.prestamosEnMora}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Saldo cartera</p>
                    <p className="text-xl font-bold text-blue-700">{formatearMoneda(informe.cartera.saldoTotalActivos)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Tasa de mora</p>
                    <p className="text-xl font-bold text-amber-700">{informe.cartera.tasaMora.toFixed(2)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top clientes hoy */}
              {informe.topClientesHoy.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Top clientes que más pagaron hoy
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Cédula</TableHead>
                          <TableHead className="text-right">Pagos</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {informe.topClientesHoy.map((c, idx) => (
                          <TableRow key={c.clienteId}>
                            <TableCell className="font-semibold">{c.nombre}</TableCell>
                            <TableCell className="font-mono text-xs">{c.cedula}</TableCell>
                            <TableCell className="text-right">{c.pagos}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-700">
                              {formatearMoneda(c.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No se pudo cargar el informe.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============== TAB: CALENDARIO ============== */}
        <TabsContent value="calendario" className="space-y-4 mt-4">
          <PagosCalendario />
        </TabsContent>

        {/* ============== TAB: GRÁFICOS ============== */}
        <TabsContent value="graficos" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-500">Periodo:</span>
            {(['semana', 'quincena', 'mes', 'año'] as const).map((p) => (
              <Button
                key={p}
                variant={periodoInforme === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodoInforme(p)}
                className="h-7 text-xs"
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>
          <PagosCharts periodo={periodoInforme} />
        </TabsContent>
      </Tabs>

      {/* ============== MODAL APLICAR PAGO ============== */}
      <Dialog open={modalAplicar} onOpenChange={setModalAplicar}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Aplicar Pago
            </DialogTitle>
          </DialogHeader>

          {!prestamoSeleccionadoAplicar ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, nombre, cédula o teléfono..."
                  value={busquedaAplicar}
                  onChange={(e) => {
                    setBusquedaAplicar(e.target.value)
                    buscarPrestamosAplicar(e.target.value)
                  }}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {loadingAplicar ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando préstamos...</div>
                ) : prestamosAplicar.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay préstamos activos con cuotas pendientes.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prestamosAplicar.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => seleccionarPrestamoAplicar(p)}
                        className={`w-full text-left p-3 rounded-md border-2 transition hover:border-emerald-400 hover:bg-emerald-50/30 ${
                          p.diasMora > 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold">{p.cliente.nombre}</div>
                            <div className="text-xs text-muted-foreground">
                              CC {p.cliente.cedula} · {p.cliente.telefono}
                            </div>
                            <div className="text-xs font-mono mt-1">
                              {p.codigo} · Cuota {p.proximaCuota}/{p.numeroCuotas}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Pendiente</div>
                            <div className="font-bold text-emerald-700">
                              {formatearMoneda(p.montoTotalPendiente)}
                            </div>
                            {p.diasMora > 0 && (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 mt-1">
                                {p.diasMora} días mora
                              </Badge>
                            )}
                          </div>
                        </div>
                        {p.cuentaRecaudo && (
                          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                            🏦 Sugerido: {p.cuentaRecaudo.banco} - {p.cuentaRecaudo.tipoCuenta} - {p.cuentaRecaudo.numeroCuenta}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info del préstamo seleccionado */}
              <div className="p-3 rounded-md bg-muted/50 border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{prestamoSeleccionadoAplicar.cliente.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      CC {prestamoSeleccionadoAplicar.cliente.cedula} · {prestamoSeleccionadoAplicar.cliente.telefono}
                    </div>
                    <div className="text-xs font-mono mt-1">
                      {prestamoSeleccionadoAplicar.codigo} · Cuota {prestamoSeleccionadoAplicar.proximaCuota}/{prestamoSeleccionadoAplicar.numeroCuotas}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPrestamoSeleccionadoAplicar(null)}
                  >
                    Cambiar
                  </Button>
                </div>
              </div>

              {/* Detalle del pago - desglose completo con mora diaria */}
              <div className="p-3 rounded-md bg-muted/30 border space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  📊 Estado de la cuota {prestamoSeleccionadoAplicar.proximaCuota} de {prestamoSeleccionadoAplicar.numeroCuotas}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Vencimiento:</span>{' '}
                    <strong>{formatearFecha(prestamoSeleccionadoAplicar.fechaVencimiento)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Frecuencia:</span>{' '}
                    <strong className="capitalize">{prestamoSeleccionadoAplicar.frecuencia.toLowerCase()}</strong>
                  </div>
                </div>

                {/* === Banner de mora renegociada (si aplica) === */}
                {prestamoSeleccionadoAplicar.moraRenegociadaAplicada && (
                  <div className="p-3 rounded-md bg-violet-50 border-2 border-violet-300 space-y-1.5">
                    <div className="flex items-center gap-2 text-violet-800 font-semibold text-sm">
                      <Handshake className="w-4 h-4" />
                      Mora {prestamoSeleccionadoAplicar.moraRenegociadaAccion === 'ANULAR' ? 'ANULADA' : 'NEGOCIADA'} por acuerdo
                    </div>
                    <div className="text-xs text-violet-700 space-y-0.5">
                      <div>
                        • Mora original calculada:{' '}
                        <strong>{formatearMoneda(prestamoSeleccionadoAplicar.moraRenegociadaMoraOriginal || 0)}</strong>
                      </div>
                      <div>
                        • Nueva mora acordada:{' '}
                        <strong className="text-base">
                          {formatearMoneda(prestamoSeleccionadoAplicar.moraRenegociada || 0)}
                        </strong>
                      </div>
                      {prestamoSeleccionadoAplicar.moraRenegociadaPorNombre && (
                        <div>
                          • Acordado por:{' '}
                          <strong>{prestamoSeleccionadoAplicar.moraRenegociadaPorNombre}</strong>
                        </div>
                      )}
                      {prestamoSeleccionadoAplicar.moraRenegociadaFecha && (
                        <div>
                          • Fecha:{' '}
                          <strong>{formatearFecha(prestamoSeleccionadoAplicar.moraRenegociadaFecha)}</strong>
                        </div>
                      )}
                      {prestamoSeleccionadoAplicar.moraRenegociadaObservacion && (
                        <div className="mt-1 p-2 bg-white/60 rounded text-violet-900 italic">
                          "{prestamoSeleccionadoAplicar.moraRenegociadaObservacion}"
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 text-violet-700 border-violet-300 hover:bg-violet-100 h-7 text-xs"
                      onClick={revertirRenegociacionMora}
                    >
                      <Undo2 className="w-3 h-3 mr-1" />
                      Revertir acuerdo
                    </Button>
                  </div>
                )}

                <div className="border-t pt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuota base (capital + interés):</span>
                    <strong>{formatearMoneda(prestamoSeleccionadoAplicar.cuotaBase)}</strong>
                  </div>
                  {prestamoSeleccionadoAplicar.totalPagadoCuota > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>− Ya pagado (pagos parciales):</span>
                      <strong>−{formatearMoneda(prestamoSeleccionadoAplicar.totalPagadoCuota)}</strong>
                    </div>
                  )}
                  {prestamoSeleccionadoAplicar.diasMora > 0 && !prestamoSeleccionadoAplicar.moraRenegociadaAplicada ? (
                    <>
                      <div className="flex justify-between text-red-700 bg-red-50/50 px-2 py-1 rounded">
                        <span>
                          + Mora acumulada ({prestamoSeleccionadoAplicar.diasMora} días × {prestamoSeleccionadoAplicar.tasaMoraDiaria}% diario):
                        </span>
                        <strong>+{formatearMoneda(prestamoSeleccionadoAplicar.moraActual)}</strong>
                      </div>
                      {prestamoSeleccionadoAplicar.moraPagadaCuota > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>− Mora ya pagada:</span>
                          <strong>−{formatearMoneda(prestamoSeleccionadoAplicar.moraPagadaCuota)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-red-700 bg-red-100 px-2 py-1 rounded animate-pulse">
                        <span>⏰ Mora crece {formatearMoneda(prestamoSeleccionadoAplicar.moraDiariaPesos)}/día adicional</span>
                        <strong>{prestamoSeleccionadoAplicar.tasaMoraDiaria}% diario</strong>
                      </div>
                    </>
                  ) : prestamoSeleccionadoAplicar.moraRenegociadaAplicada ? (
                    <div className="flex justify-between text-violet-700 bg-violet-50 px-2 py-1 rounded">
                      <span>+ Mora acordada (renegociada):</span>
                      <strong>+{formatearMoneda(prestamoSeleccionadoAplicar.moraPendiente)}</strong>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      💡 Si se pasa de la fecha de vencimiento, se cobrará mora de {prestamoSeleccionadoAplicar.tasaMoraDiaria}% diario ({formatearMoneda(prestamoSeleccionadoAplicar.moraDiariaPesos)}/día)
                    </div>
                  )}
                  <div className="border-t pt-1.5 flex justify-between">
                    <span className="font-semibold text-emerald-700">Total a pagar HOY:</span>
                    <strong className="text-emerald-700 text-lg">{formatearMoneda(prestamoSeleccionadoAplicar.totalCuotaConMora)}</strong>
                  </div>
                  {prestamoSeleccionadoAplicar.totalPagadoCuota > 0 && (
                    <div className="flex justify-between text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      <span>💰 Pendiente después de pagos parciales:</span>
                      <strong>{formatearMoneda(prestamoSeleccionadoAplicar.montoPendiente)}</strong>
                    </div>
                  )}
                </div>

                {/* === Botón Anular o negociar mora (solo si hay mora pendiente y no está ya renegociada) === */}
                {prestamoSeleccionadoAplicar.diasMora > 0 &&
                  !prestamoSeleccionadoAplicar.moraRenegociadaAplicada && (
                    <div className="pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full bg-violet-50 border-violet-400 text-violet-800 hover:bg-violet-100"
                        onClick={abrirModalRenegociarMora}
                      >
                        <Handshake className="w-4 h-4 mr-2" />
                        Anular o negociar mora
                      </Button>
                      <p className="text-[10px] text-muted-foreground mt-1 text-center italic">
                        Si llegaste a un acuerdo con el cliente, puedes anular la mora o fijar un nuevo valor
                      </p>
                    </div>
                  )}

                {/* === Botón para renegociar de nuevo (si ya está renegociada) === */}
                {prestamoSeleccionadoAplicar.moraRenegociadaAplicada && (
                  <div className="pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-violet-50 border-violet-400 text-violet-800 hover:bg-violet-100"
                      onClick={abrirModalRenegociarMora}
                    >
                      <Handshake className="w-4 h-4 mr-2" />
                      Modificar acuerdo de mora
                    </Button>
                  </div>
                )}

                {/* === TAREA Q: Banner de Flexibilidad Financiera === */}
                {/* Si el préstamo tiene el beneficio activado, mostrar banner con estado */}
                {prestamoSeleccionadoAplicar.flexibilidadFinanciera && (
                  <div className={`mt-3 p-3 rounded-md border-2 ${
                    prestamoSeleccionadoAplicar.flexibilidadElegible
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-amber-50/40 border-amber-200'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${
                          prestamoSeleccionadoAplicar.flexibilidadElegible ? 'text-emerald-800' : 'text-amber-800'
                        }`}>
                          <Sparkles className="w-3.5 h-3.5" />
                          Flexibilidad Financiera {prestamoSeleccionadoAplicar.flexibilidadModalidad || 'BASICA'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>
                            • Usos disponibles: <strong>{prestamoSeleccionadoAplicar.flexibilidadUsosDisponibles ?? 0}</strong> de{' '}
                            {prestamoSeleccionadoAplicar.flexibilidadModalidad === 'PREMIUM' ? '2' : '1'}
                          </div>
                          <div>
                            • Usos ejercidos: <strong>{prestamoSeleccionadoAplicar.flexibilidadUsosEjercidos ?? 0}</strong>
                          </div>
                          <div>
                            • Costo pagado al inicio: <strong>{formatearMoneda(prestamoSeleccionadoAplicar.flexibilidadCosto ?? 0)}</strong>
                          </div>
                          {prestamoSeleccionadoAplicar.flexibilidadElegible ? (
                            <div className="mt-1 text-emerald-700 italic">
                              ✓ Cuota {prestamoSeleccionadoAplicar.proximaCuota} es elegible para traslado al final del crédito
                            </div>
                          ) : (
                            <div className="mt-1 text-amber-700 italic">
                              ⚠ {prestamoSeleccionadoAplicar.flexibilidadRazonInelegible}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {prestamoSeleccionadoAplicar.flexibilidadElegible && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                          onClick={abrirModalFlexibilidad}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Usar Flexibilidad Financiera para esta cuota
                        </Button>
                        <p className="text-[10px] text-muted-foreground mt-1 text-center italic">
                          La cuota se trasladará al final del crédito junto con los intereses ya causados, evitando mora. No recibe dinero en este momento (el costo ya fue pagado al inicio).
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* === Opción Abonar al Capital (solo para modalidad INTERES_FIJO_SIN_CAPITAL) === */}
              {prestamoSeleccionadoAplicar.modalidadAmortizacion === 'INTERES_FIJO_SIN_CAPITAL' && (
                <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 space-y-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="abonarAlCapital"
                      checked={abonarAlCapital}
                      onChange={(e) => {
                        setAbonarAlCapital(e.target.checked)
                        if (e.target.checked) {
                          setMontoRecibido('')
                        } else {
                          setMontoAbonoCapital('')
                        }
                      }}
                      className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 mt-0.5"
                    />
                    <Label htmlFor="abonarAlCapital" className="text-sm font-semibold cursor-pointer flex-1 text-purple-900 dark:text-purple-100">
                      💰 Abonar al capital (pago extraordinario)
                    </Label>
                  </div>
                  {abonarAlCapital ? (
                    <div className="pl-7 space-y-2">
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Ingresa el valor del abono al capital. Este pago reducirá el saldo real del préstamo
                        sin modificar la cuota mensual de intereses ({formatearMoneda(prestamoSeleccionadoAplicar.interesFijoMensual || 0)}).
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs text-purple-900 dark:text-purple-100">
                          Valor del abono (COP) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          max={prestamoSeleccionadoAplicar.saldoReal || prestamoSeleccionadoAplicar.montoPrincipal}
                          value={montoAbonoCapital}
                          onChange={(e) => setMontoAbonoCapital(e.target.value)}
                          placeholder="Ej: 500000"
                          className="bg-white dark:bg-slate-800 dark:text-white border-purple-300 dark:border-purple-600"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-purple-900 dark:text-purple-100">
                        <div>
                          Saldo real actual:{' '}
                          <strong>{formatearMoneda(prestamoSeleccionadoAplicar.saldoReal || prestamoSeleccionadoAplicar.montoPrincipal || 0)}</strong>
                        </div>
                        <div>
                          Capital abonado acumulado:{' '}
                          <strong>{formatearMoneda(prestamoSeleccionadoAplicar.capitalPagadoExtra || 0)}</strong>
                        </div>
                      </div>
                      {montoAbonoCapital && parseFloat(montoAbonoCapital) > 0 && (
                        <div className="text-xs p-2 rounded bg-white/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-700">
                          {parseFloat(montoAbonoCapital) >= (prestamoSeleccionadoAplicar.saldoReal || prestamoSeleccionadoAplicar.montoPrincipal || 0) ? (
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              ✅ Este abono saldará el préstamo por completo. El préstamo pasará a estado CANCELADO.
                            </span>
                          ) : (
                            <span className="text-purple-900 dark:text-purple-100">
                              Nuevo saldo real después del abono:{' '}
                              <strong>
                                {formatearMoneda(
                                  (prestamoSeleccionadoAplicar.saldoReal || prestamoSeleccionadoAplicar.montoPrincipal || 0) - parseFloat(montoAbonoCapital)
                                )}
                              </strong>
                              {' '}· La cuota mensual de {formatearMoneda(prestamoSeleccionadoAplicar.interesFijoMensual || 0)} se mantiene igual.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-purple-700 dark:text-purple-300 pl-7">
                      Marca esta casilla si el cliente va a abonar al capital (pago extraordinario).
                      Si no la marcas, el pago se aplicará normalmente a la cuota mensual de intereses.
                    </p>
                  )}
                </div>
              )}

              {/* Formulario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {abonarAlCapital
                      ? 'Monto del abono (COP) *'
                      : 'Monto recibido (COP) *'}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={abonarAlCapital ? montoAbonoCapital : montoRecibido}
                    onChange={(e) => abonarAlCapital ? setMontoAbonoCapital(e.target.value) : setMontoRecibido(e.target.value)}
                    disabled={abonarAlCapital && !prestamoSeleccionadoAplicar.modalidadAmortizacion?.includes('INTERES_FIJO')}
                  />
                  {abonarAlCapital && (
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      💡 El abono al capital NO cambia la cuota mensual de intereses. Solo reduce el saldo real del préstamo.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                      <SelectItem value="CONSIGNACION">Consignación</SelectItem>
                      <SelectItem value="PSE">PSE</SelectItem>
                      <SelectItem value="DATÁFONO">Datáfono</SelectItem>
                      <SelectItem value="OTRO">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Referencia (opcional)</Label>
                  <Input
                    placeholder="N° de transacción, comprobante, etc."
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>
              </div>

              {prestamoSeleccionadoAplicar.cuentaRecaudo && (
                <div className="p-2 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900">
                  🏦 Cuenta sugerida: {prestamoSeleccionadoAplicar.cuentaRecaudo.banco} -{' '}
                  {prestamoSeleccionadoAplicar.cuentaRecaudo.tipoCuenta} -{' '}
                  <span className="font-mono">{prestamoSeleccionadoAplicar.cuentaRecaudo.numeroCuenta}</span>
                </div>
              )}

              {/* Desglose del pago en tiempo real */}
              {desglosePago && (
                <div className={`p-3 rounded-md border-2 ${desglosePago.esParcial ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                  <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                    <span>📊 Desglose del pago</span>
                    {desglosePago.esParcial ? (
                      <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200">⚡ PAGO PARCIAL</Badge>
                    ) : (
                      <Badge className="bg-emerald-200 text-emerald-900 hover:bg-emerald-200">✓ Cuota completa</Badge>
                    )}
                  </div>

                  {desglosePago.yaPagado > 0 && (
                    <div className="mb-2 text-xs text-emerald-700 bg-emerald-100/60 px-2 py-1 rounded">
                      Pagos parciales anteriores: <strong>{formatearMoneda(desglosePago.yaPagado)}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-white/50">
                      <div className="text-muted-foreground">→ Mora</div>
                      <div className="font-bold text-amber-700">{formatearMoneda(desglosePago.moraPagada)}</div>
                    </div>
                    <div className="p-2 rounded bg-white/50">
                      <div className="text-muted-foreground">→ Interés</div>
                      <div className="font-bold text-blue-700">{formatearMoneda(desglosePago.interesPagado)}</div>
                    </div>
                    <div className="p-2 rounded bg-white/50">
                      <div className="text-muted-foreground">→ Capital</div>
                      <div className="font-bold text-emerald-700">{formatearMoneda(desglosePago.capitalPagado)}</div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-amber-200 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Este pago:</span>
                      <strong>{formatearMoneda(desglosePago.totalPagado)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Acumulado tras este pago:</span>
                      <strong>{formatearMoneda(desglosePago.nuevoAcumulado)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total cuota (con mora):</span>
                      <strong>{formatearMoneda(desglosePago.totalCuota)}</strong>
                    </div>
                    {desglosePago.esParcial ? (
                      <div className="flex justify-between text-red-700 bg-red-50 px-2 py-1 rounded mt-1">
                        <span>⏳ Faltará después de este pago:</span>
                        <strong>{formatearMoneda(desglosePago.faltante)}</strong>
                      </div>
                    ) : (
                      <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded mt-1">
                        <span>✓ Cuota completa pagada</span>
                        <strong>{formatearMoneda(desglosePago.faltante)} restante</strong>
                      </div>
                    )}
                  </div>

                  {desglosePago.esParcial && (
                    <p className="text-[11px] text-amber-900 mt-2 italic">
                      💡 El pago parcial se acumulará con futuros pagos hasta completar la cuota. La cuota no se marcará como pagada hasta completar el total. La mora sigue creciendo diariamente hasta que se complete el pago.
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setPrestamoSeleccionadoAplicar(null)}>
                  Atrás
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmarAplicarPago}
                  disabled={!montoRecibido || aplicandoPago}
                >
                  {aplicandoPago ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Aplicar Pago
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============== MODAL REVERSAR PAGO ============== */}
      <Dialog open={!!pagoAReversar} onOpenChange={(open) => !open && setPagoAReversar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="w-5 h-5" />
              Reversar Pago
            </DialogTitle>
          </DialogHeader>
          {pagoAReversar && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <p><strong>Préstamo:</strong> {pagoAReversar.prestamo.codigo}</p>
                <p><strong>Cliente:</strong> {pagoAReversar.prestamo.cliente.nombre}</p>
                <p><strong>Cuota:</strong> {pagoAReversar.numeroCuota}</p>
                <p><strong>Monto:</strong> <span className="font-bold text-red-700">{formatearMoneda(pagoAReversar.montoTotal)}</span></p>
                <p><strong>Fecha pago:</strong> {formatearFecha(pagoAReversar.fechaPago)}</p>
              </div>
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p><strong>⚠️ Atención:</strong> Al reversar este pago:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>El pago queda marcado como REVERSADO (no se borra)</li>
                  <li>Se descuenta del saldo del préstamo</li>
                  <li>La cuota vuelve a quedar pendiente</li>
                  <li>Se mantiene el registro para auditoría</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label>Motivo de reversión *</Label>
                <Textarea
                  value={motivoReversion}
                  onChange={(e) => setMotivoReversion(e.target.value)}
                  rows={3}
                  placeholder="Ej: Pago duplicado, error en monto, transferencia devuelta..."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPagoAReversar(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmarReversar}
                  disabled={reversando || !motivoReversion.trim()}
                >
                  {reversando ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Reversando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reversar Pago
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============== MODAL ELIMINAR PAGO ============== */}
      <Dialog open={!!pagoAEliminar} onOpenChange={(open) => !open && setPagoAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Eliminar Pago
            </DialogTitle>
          </DialogHeader>
          {pagoAEliminar && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <p><strong>Préstamo:</strong> {pagoAEliminar.prestamo.codigo}</p>
                <p><strong>Cliente:</strong> {pagoAEliminar.prestamo.cliente.nombre}</p>
                <p><strong>Cuota:</strong> {pagoAEliminar.numeroCuota}</p>
                <p><strong>Monto:</strong> <span className="font-bold">{formatearMoneda(pagoAEliminar.montoTotal)}</span></p>
                <p><strong>Estado actual:</strong> {pagoAEliminar.estado}</p>
              </div>
              <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
                <p><strong>🚨 Diferencia con Reversar:</strong></p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Eliminar</strong>: Borra el pago COMPLETAMENTE de la BD</li>
                  <li>No queda rastro del pago (excepto en audit log)</li>
                  <li>El préstamo se recalcula automáticamente</li>
                  <li>Usa esta opción solo para errores obvios (pago duplicado, dato equivocado)</li>
                </ul>
                <p className="mt-2"><strong>Recomendación:</strong> Usa "Reversar" si quieres mantener el historial.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPagoAEliminar(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmarEliminar}
                  disabled={eliminando}
                >
                  {eliminando ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar Definitivamente
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============== MODAL RENEGOCIAR / ANULAR MORA ============== */}
      <Dialog open={modalRenegociarMora} onOpenChange={setModalRenegociarMora}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700">
              <Handshake className="w-5 h-5" />
              Anular o negociar mora
            </DialogTitle>
          </DialogHeader>
          {prestamoSeleccionadoAplicar && (
            <div className="space-y-4">
              {/* Info del préstamo */}
              <div className="p-3 rounded-md bg-muted/50 border">
                <div className="font-semibold">{prestamoSeleccionadoAplicar.cliente.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  CC {prestamoSeleccionadoAplicar.cliente.cedula} · {prestamoSeleccionadoAplicar.cliente.telefono}
                </div>
                <div className="text-xs font-mono mt-1">
                  {prestamoSeleccionadoAplicar.codigo} · Cuota {prestamoSeleccionadoAplicar.proximaCuota}/{prestamoSeleccionadoAplicar.numeroCuotas}
                </div>
              </div>

              {/* Estado actual de la mora */}
              <div className="p-3 rounded-md bg-red-50 border border-red-200 space-y-1.5 text-sm">
                <div className="font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Mora calculada actualmente
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Días de mora</div>
                    <div className="font-bold text-red-700 text-lg">{prestamoSeleccionadoAplicar.diasMora}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Mora total</div>
                    <div className="font-bold text-red-700 text-lg">{formatearMoneda(prestamoSeleccionadoAplicar.moraActual)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Mora pendiente</div>
                    <div className="font-bold text-red-700 text-lg">{formatearMoneda(prestamoSeleccionadoAplicar.moraPendiente)}</div>
                  </div>
                </div>
                {prestamoSeleccionadoAplicar.moraDiariaPesos > 0 && (
                  <div className="text-xs text-red-700 italic">
                    ⏰ La mora crece {formatearMoneda(prestamoSeleccionadoAplicar.moraDiariaPesos)}/día adicional
                  </div>
                )}
              </div>

              {/* Banner si ya está renegociada */}
              {prestamoSeleccionadoAplicar.moraRenegociadaAplicada && (
                <div className="p-3 rounded-md bg-violet-50 border border-violet-300 text-xs text-violet-800">
                  <strong>Acuerdo previo:</strong> La mora ya fue{' '}
                  {prestamoSeleccionadoAplicar.moraRenegociadaAccion === 'ANULAR' ? 'ANULADA' : 'NEGOCIADA'}{' '}
                  el {formatearFecha(prestamoSeleccionadoAplicar.moraRenegociadaFecha || '')} por{' '}
                  {prestamoSeleccionadoAplicar.moraRenegociadaPorNombre}. Al confirmar un nuevo acuerdo,
                  se reemplazará el anterior.
                </div>
              )}

              {/* Selector de acción */}
              <div className="space-y-2">
                <Label>¿Qué acuerdo tomaste con el cliente? *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccionMora('ANULAR')
                      setNuevaMoraValor('0')
                    }}
                    className={`p-3 rounded-md border-2 text-left transition ${
                      accionMora === 'ANULAR'
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-violet-700" />
                      Anular mora
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Eliminar toda la mora pendiente. El cliente no debe mora.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccionMora('NEGOCIAR')}
                    className={`p-3 rounded-md border-2 text-left transition ${
                      accionMora === 'NEGOCIAR'
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-violet-700" />
                      Negociar mora
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Fijar un nuevo valor de mora acordado con el cliente.
                    </div>
                  </button>
                </div>
              </div>

              {/* Si es NEGOCIAR, pedir el nuevo valor */}
              {accionMora === 'NEGOCIAR' && (
                <div className="space-y-2">
                  <Label>Nueva mora acordada (COP) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={nuevaMoraValor}
                    onChange={(e) => setNuevaMoraValor(e.target.value)}
                    placeholder="Ej: 50000"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Indica el valor que el cliente pagará como mora. Debe ser menor a{' '}
                    {formatearMoneda(prestamoSeleccionadoAplicar.moraPendiente)} (mora pendiente actual).
                  </p>
                  {nuevaMoraValor && !isNaN(parseFloat(nuevaMoraValor)) && (
                    <div className="p-2 rounded bg-violet-50 border border-violet-200 text-xs text-violet-800">
                      ✓ Ahorro para el cliente:{' '}
                      <strong>
                        {formatearMoneda(
                          Math.max(0, prestamoSeleccionadoAplicar.moraPendiente - parseFloat(nuevaMoraValor))
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Observación del acuerdo */}
              <div className="space-y-2">
                <Label>Observación del acuerdo *</Label>
                <Textarea
                  value={observacionMora}
                  onChange={(e) => setObservacionMora(e.target.value)}
                  rows={4}
                  placeholder="Ej: El cliente pagará la cuota base hoy y se le perdona la mora acumulada por dificultades familiares. Acuerdo verbal confirmado por WhatsApp el 24/07/2026..."
                  minLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Esta observación quedará registrada en la bitácora del préstamo y en el audit log
                  inmutable del sistema. Explica claramente el acuerdo tomado con el cliente.
                </p>
              </div>

              {/* Resumen del acuerdo */}
              <div className="p-3 rounded-md bg-muted/30 border space-y-1.5 text-sm">
                <div className="font-semibold text-violet-700">📋 Resumen del acuerdo</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acción:</span>
                  <strong>
                    {accionMora === 'ANULAR'
                      ? 'ANULAR mora (fijar en $0)'
                      : 'NEGOCIAR mora (fijar nuevo valor)'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mora original calculada:</span>
                  <strong>{formatearMoneda(prestamoSeleccionadoAplicar.moraActual)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mora pendiente actual:</span>
                  <strong>{formatearMoneda(prestamoSeleccionadoAplicar.moraPendiente)}</strong>
                </div>
                <div className="flex justify-between text-violet-700 bg-violet-50 px-2 py-1 rounded">
                  <span>Nueva mora acordada:</span>
                  <strong className="text-base">
                    {formatearMoneda(accionMora === 'ANULAR' ? 0 : parseFloat(nuevaMoraValor) || 0)}
                  </strong>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Ahorro para el cliente:</span>
                  <strong>
                    {formatearMoneda(
                      Math.max(
                        0,
                        prestamoSeleccionadoAplicar.moraPendiente -
                          (accionMora === 'ANULAR' ? 0 : parseFloat(nuevaMoraValor) || 0)
                      )
                    )}
                  </strong>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalRenegociarMora(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={confirmarRenegociarMora}
                  disabled={renegociandoMora || observacionMora.trim().length < 10}
                >
                  {renegociandoMora ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Confirmar acuerdo
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============== MODAL: PAGO SOLO INTERESES (v4.0) ============== */}
      <PagoSoloInteresesModal
        abierto={!!pagoSoloInteresesTarget}
        pago={pagoSoloInteresesTarget}
        onCerrar={() => setPagoSoloInteresesTarget(null)}
        onAplicado={() => {
          setPagoSoloInteresesTarget(null)
          cargarPagos()
          onChanged()
        }}
      />

      {/* ============== MODAL: CONCILIACIÓN BANCARIA ============== */}
      <ConciliacionBancariaModal
        abierto={modalConciliacion}
        onCerrar={() => setModalConciliacion(false)}
        onAplicado={() => {
          setModalConciliacion(false)
          cargarPagos()
          onChanged()
        }}
      />

      {/* ============== MODAL: IA PREDICTIVA DE MORA ============== */}
      <PrediccionMoraModal
        abierto={modalPrediccion}
        onCerrar={() => setModalPrediccion(false)}
      />

      {/* ============== MODAL: RECIBO DE PAGO ============== */}
      <ReciboPreviewModal
        abierto={!!reciboPagoId}
        pagoId={reciboPagoId}
        onCerrar={() => setReciboPagoId(null)}
      />

      {/* ============== TAREA Q: MODAL USAR FLEXIBILIDAD FINANCIERA ============== */}
      <Dialog open={modalFlexibilidad} onOpenChange={setModalFlexibilidad}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="w-5 h-5" />
              Usar Flexibilidad Financiera
            </DialogTitle>
          </DialogHeader>
          {prestamoSeleccionadoAplicar && (
            <div className="space-y-4">
              {/* Info del préstamo */}
              <div className="p-3 rounded-md bg-emerald-50/60 border-2 border-emerald-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{prestamoSeleccionadoAplicar.cliente.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      CC {prestamoSeleccionadoAplicar.cliente.cedula} · {prestamoSeleccionadoAplicar.cliente.telefono}
                    </div>
                    <div className="text-xs font-mono mt-1">
                      {prestamoSeleccionadoAplicar.codigo} · Cuota {prestamoSeleccionadoAplicar.proximaCuota}/{prestamoSeleccionadoAplicar.numeroCuotas}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {prestamoSeleccionadoAplicar.flexibilidadModalidad || 'BASICA'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-emerald-200">
                  <div>
                    <div className="text-muted-foreground">Usos disponibles</div>
                    <div className="font-bold text-emerald-700">
                      {prestamoSeleccionadoAplicar.flexibilidadUsosDisponibles ?? 0} / {prestamoSeleccionadoAplicar.flexibilidadModalidad === 'PREMIUM' ? '2' : '1'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cuota a trasladar</div>
                    <div className="font-bold">#{prestamoSeleccionadoAplicar.proximaCuota}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Vencimiento actual</div>
                    <div className="font-bold text-xs">
                      {formatearFecha(prestamoSeleccionadoAplicar.fechaVencimiento)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Explicación del beneficio */}
              <div className="p-3 rounded-md bg-blue-50/50 border border-blue-200 text-sm space-y-2">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  ¿Cómo funciona este beneficio?
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-blue-900">
                  <li>
                    La cuota <strong>{prestamoSeleccionadoAplicar.proximaCuota}</strong> se{' '}
                    <strong>trasladará al FINAL del crédito</strong> (después de la última cuota programada).
                  </li>
                  <li>
                    Los intereses moratorios ya causados ({' '}
                    <strong>{formatearMoneda(prestamoSeleccionadoAplicar.moraActual)}</strong>
                    {' '}por {prestamoSeleccionadoAplicar.diasMora} días de mora) se{' '}
                    <strong>incluyen en la cuota trasladada</strong>, NO se cobran aparte.
                  </li>
                  <li>
                    NO se genera mora futura sobre esta cuota (queda aplazada oficialmente).
                  </li>
                  <li>
                    NO se interpreta como pago de solo intereses (es un traslado de cuota).
                  </li>
                  <li>
                    NO recibes dinero en este momento — el costo del beneficio ya fue pagado al inicio del crédito.
                  </li>
                  <li>
                    Quedarán <strong>{(prestamoSeleccionadoAplicar.flexibilidadUsosDisponibles ?? 0) - 1} uso(s)</strong> disponibles después de este.
                  </li>
                </ul>
              </div>

              {/* Ejemplo de cálculo */}
              <div className="p-3 rounded-md bg-muted/30 border text-xs space-y-1">
                <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Resumen del traslado
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="text-muted-foreground">Capital de la cuota:</div>
                  <div className="text-right font-mono">
                    {formatearMoneda(prestamoSeleccionadoAplicar.cuotaBase - (prestamoSeleccionadoAplicar.interesPagadoCuota || 0))}
                  </div>
                  <div className="text-muted-foreground">Interés original:</div>
                  <div className="text-right font-mono">
                    {formatearMoneda(prestamoSeleccionadoAplicar.interesPagadoCuota || 0)}
                  </div>
                  <div className="text-muted-foreground">Intereses moratorios ya causados:</div>
                  <div className="text-right font-mono text-red-700">
                    +{formatearMoneda(prestamoSeleccionadoAplicar.moraActual)}
                  </div>
                  <div className="col-span-2 border-t my-1"></div>
                  <div className="font-semibold">Total a pagar al final del crédito:</div>
                  <div className="text-right font-mono font-bold text-emerald-700">
                    {formatearMoneda(
                      prestamoSeleccionadoAplicar.cuotaBase +
                      (prestamoSeleccionadoAplicar.moraActual || 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Observación opcional */}
              <div className="space-y-2">
                <Label>Observación del gestor (opcional)</Label>
                <Textarea
                  value={observacionFlexibilidad}
                  onChange={(e) => setObservacionFlexibilidad(e.target.value)}
                  rows={2}
                  placeholder="Ej: Cliente solicita traslado por dificultades temporales..."
                />
              </div>

              {/* Confirmación obligatoria */}
              <div className="p-3 rounded-md bg-amber-50 border-2 border-amber-300">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmacionFlexibilidad}
                    onChange={(e) => setConfirmacionFlexibilidad(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <span className="text-xs text-amber-900">
                    <strong>Confirmo</strong> que el cliente ha solicitado ejercer el beneficio de Flexibilidad Financiera
                    para la cuota {prestamoSeleccionadoAplicar.proximaCuota}. Entiendo que esta cuota se trasladará al
                    final del crédito con los intereses ya causados incluidos, y que NO se recibirá dinero en este momento
                    (el costo del beneficio fue pagado al inicio del crédito).
                  </span>
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalFlexibilidad(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmarUsarFlexibilidad}
                  disabled={!confirmacionFlexibilidad || usandoFlexibilidad}
                >
                  {usandoFlexibilidad ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Aplicar Flexibilidad Financiera
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
