'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageHeader, EstadoBadge } from '@/components/ui-basics'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import { formatearMoneda, formatearFecha, calcularPrestamo, calcularPrestamoTasaFijaMensual, Frecuencia } from '@/lib/finanzas'
import { calcularBloqueCorte, calcularFechaPrimerCorte, calcularDiasCausadosAntes, calcularValorDiasCausados, PeriodoCorte } from '@/lib/corte-fechas'
import { abrirHtmlImprimible } from '@/lib/auth-docs'
import { FileText, Plus, Search, Eye, Check, X, ArrowRight, RefreshCw, PenTool, Shield, Trash2, Calendar, Scissors, Sparkles, MonitorSmartphone } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientesView } from '@/components/views/ClientesView'
import { CajasView } from '@/components/views/CajasView'
import { CampanasView } from '@/components/views/CampanasView'
import { NotificacionesView } from '@/components/views/NotificacionesView'
import { BuzonSolicitudesView } from '@/components/views/BuzonSolicitudesView'
import { PlanClienteView } from '@/components/views/PlanClienteView'
import { SimuladorView } from '@/components/views/SimuladorView'
import { DocumentosPrestamosView } from '@/components/views/DocumentosPrestamosView'
import { LineaTiempoView } from '@/components/views/LineaTiempoView'
import { DashboardPrestamos } from '@/components/views/DashboardPrestamos'
import { BotIcons } from '@/components/views/BotIcons'
import { OtroSiAccionesDropdown } from '@/components/views/OtroSiAccionesDropdown'
import { QueCambioModal } from '@/components/views/QueCambioModal'

interface Prestamo {
  id: string
  codigo: string
  cliente: any
  montoPrincipal: number
  tasaInteresAnual: number
  tasaMoraAnual: number
  plazoMeses: number
  frecuencia: string
  numeroCuotas: number
  montoCuota: number
  totalInteres: number
  totalPagar: number
  saldoTotal: number
  cuotasPagadas: number
  montoPagado: number
  estado: string
  fechaSolicitud: string
  // === Fechas para el conteo de vigencia ===
  // fechaDesembolso: fecha real de inicio del crédito (se setea al activar).
  // fechaVencimiento: fecha final pactada (se setea al activar).
  // updatedAt: fecha de la última modificación — se usa como aproximación
  //   de la fecha de cancelación cuando el crédito pasa a CANCELADO.
  fechaDesembolso?: string | null
  fechaVencimiento?: string | null
  updatedAt?: string
  requiereDocumentos: boolean
  tycAceptado: boolean
  firmaId?: string | null
  firmaFechaCompleta?: string | null
  firmaTipo?: string | null
  firmaRol?: string | null
  tieneCodeudor?: boolean
  codeudorNombre?: string | null
  codeudorCedula?: string | null
}

// =====================================================
// CONTEO DE VIGENCIA DE CRÉDITOS
// =====================================================
// Calcula automáticamente los días transcurridos del crédito en relación
// con el plazo total pactado. La lógica es:
//
//   - Si el crédito está CANCELADO → el conteo se CONGELA en la fecha de
//     cancelación (updatedAt). No sigue incrementándose.
//   - Si el crédito está ACTIVO/EN_MORA/JURIDICO → el conteo es dinámico
//     y usa la fecha actual del sistema.
//   - Para otros estados (SOLICITUD, PENDIENTE_ACEPTACION, RECHAZADO) el
//     conteo no aplica (aún no hay crédito vigente).
//
// Estados del plazo:
//   🟢 DENTRO DEL PLAZO   → días transcurridos < plazo total
//   🟡 PLAZO CUMPLIDO     → días transcurridos = plazo total
//   🔴 EXCEDIÓ EL PLAZO   → días transcurridos > plazo total (muestra días excedidos)
//   —                      → crédito CANCELADO (conteo congelado, sin estado de plazo)

export type EstadoPlazo = 'DENTRO' | 'CUMPLIDO' | 'EXCEDIDO' | 'CANCELADO' | 'NO_APLICA'

export interface ConteoVigencia {
  aplica: boolean                 // false si el conteo no aplica (solicitud, rechazado, etc.)
  diasTranscurridos: number       // días desde inicio hasta corte
  plazoTotalDias: number          // plazo total pactado en días
  diasExcedidos: number           // días que exceden el plazo (0 si no excede)
  estadoPlazo: EstadoPlazo        // estado del plazo
  congelado: boolean              // true si el conteo está congelado (crédito cancelado)
  fechaCorte: Date                // fecha usada para el cálculo
  fechaInicio: Date               // fecha de inicio del crédito
}

function calcularPlazoTotalDias(p: Prestamo): number {
  // Preferir la diferencia real entre fechaVencimiento y fechaDesembolso,
  // que refleja el plazo exacto pactado (incluye ajustes de frecuencia).
  if (p.fechaVencimiento && p.fechaDesembolso) {
    const diffMs = new Date(p.fechaVencimiento).getTime() - new Date(p.fechaDesembolso).getTime()
    const dias = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (dias > 0) return dias
  }
  // Fallback: calcular según frecuencia y número de cuotas
  const cuotas = p.numeroCuotas || 0
  switch (p.frecuencia) {
    case 'MENSUAL': return cuotas * 30
    case 'QUINCENAL': return cuotas * 15
    case 'SEMANAL': return cuotas * 7
    case 'DIARIO': return cuotas
    default: return cuotas * 30
  }
}

export function calcularConteoVigencia(p: Prestamo, ahora: Date = new Date()): ConteoVigencia {
  // Solo aplica a créditos activos, en mora, jurídicos o cancelados.
  // No aplica a solicitudes pendientes ni a préstamos rechazados.
  const estadosValidos = ['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO']
  if (!estadosValidos.includes(p.estado)) {
    return {
      aplica: false,
      diasTranscurridos: 0,
      plazoTotalDias: 0,
      diasExcedidos: 0,
      estadoPlazo: 'NO_APLICA',
      congelado: false,
      fechaCorte: ahora,
      fechaInicio: ahora,
    }
  }

  // Fecha de inicio: fechaDesembolso (cuando el crédito realmente se activó).
  // Si por algún motivo no existe, no podemos calcular el conteo.
  const fechaInicio = p.fechaDesembolso ? new Date(p.fechaDesembolso) : null
  if (!fechaInicio) {
    return {
      aplica: false,
      diasTranscurridos: 0,
      plazoTotalDias: 0,
      diasExcedidos: 0,
      estadoPlazo: 'NO_APLICA',
      congelado: false,
      fechaCorte: ahora,
      fechaInicio: ahora,
    }
  }

  const plazoTotalDias = calcularPlazoTotalDias(p)
  const estaCancelado = p.estado === 'CANCELADO'

  // Fecha de corte para el cálculo:
  //   - Si está CANCELADO: usar updatedAt (fecha de cancelación) → CONGELA el conteo.
  //   - Si está ACTIVO/EN_MORA/JURIDICO: usar la fecha actual → conteo dinámico.
  const fechaCorte = estaCancelado && p.updatedAt
    ? new Date(p.updatedAt)
    : ahora

  // Días transcurridos = diferencia en días (sin decimales, sin hora).
  // Usamos floor para no contar el día actual hasta que termine.
  const diffMs = fechaCorte.getTime() - fechaInicio.getTime()
  const diasTranscurridos = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  // Determinar estado del plazo
  let estadoPlazo: EstadoPlazo
  if (estaCancelado) {
    estadoPlazo = 'CANCELADO'
  } else if (diasTranscurridos < plazoTotalDias) {
    estadoPlazo = 'DENTRO'
  } else if (diasTranscurridos === plazoTotalDias) {
    estadoPlazo = 'CUMPLIDO'
  } else {
    estadoPlazo = 'EXCEDIDO'
  }

  const diasExcedidos = Math.max(0, diasTranscurridos - plazoTotalDias)

  return {
    aplica: true,
    diasTranscurridos,
    plazoTotalDias,
    diasExcedidos,
    estadoPlazo,
    congelado: estaCancelado,
    fechaCorte,
    fechaInicio,
  }
}

// =====================================================
// Tipos auxiliares para la vista de Préstamos
// =====================================================

// Parámetros de simulación que se pueden inyectar en el formulario
// de PrestamosPanel (por ejemplo, al convertir una solicitud web del
// buzón en un préstamo). Se aplican automáticamente al abrir el modal.
export interface SimulacionParams {
  clienteId?: string
  montoPrincipal: string
  tasaInteresAnual: string
  plazoMeses: string
  frecuencia: Frecuencia
  origen?: string
  // === ID de la solicitud web origen (para auto-marcarla como CONVERTIDA) ===
  solicitudWebId?: string
  // === Flexibilidad financiera elegida por el cliente en la simulación ===
  flexibilidadFinanciera?: boolean
  flexibilidadModalidad?: 'BASICA' | 'PREMIUM'
  flexibilidadCosto?: number
  // === Renovación Anticipada elegida por el cliente en la simulación ===
  renovacionAnticipada?: boolean
  renovacionAnticipadaCosto?: number
}

// Tipo mínimo estructuralmente compatible con la interfaz SolicitudWeb
// interna de BuzonSolicitudesView (no exportada). Solo declaramos los
// campos que necesitamos leer para construir la SimulacionParams.
interface SolicitudWebMin {
  id: string
  codigo: string
  clienteId: string
  clienteNombre: string
  valorSolicitado: number
  numeroCuotas: number
  frecuencia: string
  tasaUtilizada: number
  // === Campos opcionales para preservar la flexibilidad elegida por el cliente ===
  flexibilidadFinanciera?: boolean
  flexibilidadModalidad?: string | null
  flexibilidadCosto?: number
  // === Renovación Anticipada elegida por el cliente ===
  renovacionAnticipada?: boolean
  renovacionAnticipadaCosto?: number
}

// =====================================================
// PrestamosPanel — panel interno de la pestaña "Solicitudes"
// =====================================================
// Lista de préstamos + modal para crear una nueva solicitud.
// Recibe opcionalmente `simulacionInicial` para precargar el formulario
// (por ejemplo, al convertir una solicitud web del buzón).
function PrestamosPanel({
  onAbrirPrestamo,
  onChanged,
  simulacionInicial,
  onCambiarVista,
}: {
  onAbrirPrestamo: (id: string) => void
  onChanged: () => void
  simulacionInicial: SimulacionParams | null
  onCambiarVista?: (vista: string) => void
}) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')
  const [modalAbierto, setModalAbierto] = useState(false)
  // === Modal "¿Qué Cambió?" — análisis de comportamiento de pagos ===
  const [modalQueCambio, setModalQueCambio] = useState(false)
  const [prestamoQueCambioId, setPrestamoQueCambioId] = useState<string | null>(null)
  const [prestamoQueCambioCodigo, setPrestamoQueCambioCodigo] = useState<string>('')
  const { toast } = useToast()

  // === Tick para refresco dinámico del CONTEO DE VIGENCIA ===
  // Cada 60 segundos se actualiza `nowTick` para forzar un re-render del
  // componente y que el conteo de días transcurridos se recalcule con la
  // fecha/hora actual del sistema. Esto cumple el requisito de que el
  // conteo sea dinámico y no dependa de que el usuario recargue la página.
  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNowTick(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Estado del formulario
  const [clienteId, setClienteId] = useState('')
  const [modalidad, setModalidad] = useState<'FRANCES' | 'TASA_FIJA' | 'CUOTA_PERSONALIZADA'>('FRANCES')
  const [montoPrincipal, setMontoPrincipal] = useState('')
  const [tasaInteresAnual, setTasaInteresAnual] = useState('24')
  const [tasaMoraAnual, setTasaMoraAnual] = useState('1')
  const [tasaMensualPersonalizada, setTasaMensualPersonalizada] = useState('20')
  const [tasaMensualFija, setTasaMensualFija] = useState('15')
  const [numeroCuotasFija, setNumeroCuotasFija] = useState('2')
  const [montoCuotaPersonalizada, setMontoCuotaPersonalizada] = useState('')
  const [cuotaAutoCalculada, setCuotaAutoCalculada] = useState(true) // true = se recalcula solo
  const [numeroCuotasPersonalizada, setNumeroCuotasPersonalizada] = useState('2')
  const [plazoMeses, setPlazoMeses] = useState('12')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('MENSUAL')
  const [categoriaId, setCategoriaId] = useState('')
  const [requiereDocumentos, setRequiereDocumentos] = useState(true)
  const [generarPagare, setGenerarPagare] = useState(true)

  // === Tasa del cliente seleccionado ===
  // clienteTieneTasaPers: ¿el cliente tiene tasa personalizada en BD?
  // clienteTasaPersValor: el valor numérico de esa tasa
  // decisionTasa: 'CLIENTE' | 'NUEVA' | null — decide cuál tasa usar al crear
  const [clienteTieneTasaPers, setClienteTieneTasaPers] = useState(false)
  const [clienteTasaPersValor, setClienteTasaPersValor] = useState<number | null>(null)
  const [decisionTasa, setDecisionTasa] = useState<'CLIENTE' | 'NUEVA' | null>(null)
  const [generarCarta, setGenerarCarta] = useState(true)
  // === Codeudor ===
  const [tieneCodeudor, setTieneCodeudor] = useState(false)
  const [codeudorId, setCodeudorId] = useState('')

  // === Fecha del préstamo (fecha asignada) ===
  // Permite registrar una solicitud con la fecha real en que se realizó el préstamo,
  // no la fecha actual del sistema. Todos los documentos generados (pagaré, carta,
  // tabla de amortización) usarán esta fecha como fecha base.
  // Por defecto es hoy (formato YYYY-MM-DD para el input type="date").
  const [fechaPrestamo, setFechaPrestamo] = useState<string>(() => {
    const hoy = new Date()
    const yyyy = hoy.getFullYear()
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const dd = String(hoy.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })

  // === Periodo de corte + días causados antes del corte ===
  // Caso de uso: cliente solicita crédito ANTES de la fecha de corte.
  // Ej: fechaPrestamo = 2/08/2026, periodo = "5-20" → corte = 5/08/2026.
  // El sistema cobra 3 días de interés anticipado (valorDiasCausados) y las
  // cuotas se programan desde el 5/08/2026 (fechaPrimerCorte), no desde el 2/08.
  //
  // - periodoCorte: "5-20" | "15-30" | "" (vacío = sin corte, comportamiento por defecto)
  // - fechaPrimerCorte: auto-calculada al cambiar fechaPrestamo o periodoCorte
  // - diasCausadosAntes: días entre fechaPrestamo y fechaPrimerCorte (editable manual)
  // - valorDiasCausados: COP a cobrar por esos días (editable manual)
  // - editarDiasCausadosManual: si true, el usuario editó manualmente y NO se auto-recalcula
  const [periodoCorte, setPeriodoCorte] = useState<string>('')
  const [fechaPrimerCorte, setFechaPrimerCorte] = useState<Date | null>(null)
  const [diasCausadosAntes, setDiasCausadosAntes] = useState<number>(0)
  const [valorDiasCausados, setValorDiasCausados] = useState<number>(0)
  const [editarDiasCausadosManual, setEditarDiasCausadosManual] = useState(false)

  // === Fondo de garantía (opcional, tasa configurable) ===
  // El gestor decide si aplica y a qué tasa (default 5%).
  // NO se activa automáticamente — el usuario debe marcarlo explícitamente.
  const [incluirFondoGarantia, setIncluirFondoGarantia] = useState(false)
  const [tasaFondoGarantia, setTasaFondoGarantia] = useState<number>(5) // porcentaje (5 = 5%)

  // === Renovación de crédito ===
  const [esRenovacion, setEsRenovacion] = useState(false)
  const [prestamoARenovar, setPrestamoARenovar] = useState('')
  const [saldoPendienteRenovacion, setSaldoPendienteRenovacion] = useState(0)
  const [infoPrestamoRenovacion, setInfoPrestamoRenovacion] = useState<any>(null)

  // === Flexibilidad Financiera (beneficio opcional) ===
  // Se ofrece cuando el número de cuotas >= 4. DOS tarifas:
  //   - BASICA:  $15.000 COP — permite usar el beneficio 1 sola vez durante la vigencia
  //   - PREMIUM: $34.900 COP — permite usar el beneficio 2 veces durante la vigencia
  // Permite al cliente:
  //   1) Trasladar UNA cuota al final del crédito
  //   2) Solicitar cambio de fecha de pago (genera documento "Otro Sí")
  //
  // - flexibilidadFinanciera: si el cliente adquirió el beneficio en esta solicitud
  // - flexibilidadModalidad: "BASICA" | "PREMIUM"
  // - flexibilidadCosto: monto COP (15000 o 34900)
  // - El cobro se hace UNA sola vez al inicio, cargado en la primera cuota
  const [flexibilidadFinanciera, setFlexibilidadFinanciera] = useState(false)
  const [flexibilidadModalidad, setFlexibilidadModalidad] = useState<'BASICA' | 'PREMIUM'>('BASICA')
  const FLEXIBILIDAD_COSTO_BASICA = 15000
  const FLEXIBILIDAD_COSTO_PREMIUM = 34900
  const flexibilidadCosto = flexibilidadModalidad === 'PREMIUM' ? FLEXIBILIDAD_COSTO_PREMIUM : FLEXIBILIDAD_COSTO_BASICA

  // === Renovación Anticipada (beneficio opcional del simulador del portal) ===
  // Cobro único de $9.900 COP cuando el cliente activa este beneficio en el
  // simulador del portal del cliente. Se persiste en el préstamo y se cobra
  // automáticamente al activarse tras la aceptación de T&C, registrándose
  // en la caja CAJA-RENOVACIONES.
  const [renovacionAnticipada, setRenovacionAnticipada] = useState(false)
  const RENOVACION_ANTICIPADA_COSTO = 9900

  // === Cobro de Pagaré + Carta de Instrucciones ===
  // Cargo editable (por defecto $19.900 COP) que se cobra UNA sola vez al cliente
  // cuando el préstamo incluye generar pagare + carta de instrucciones.
  // Se explica en el estado de cuenta como concepto "Pagaré + Carta de Instrucciones".
  const [cobroPagareCarta, setCobroPagareCarta] = useState(true)
  const [valorPagareCarta, setValorPagareCarta] = useState<number>(19900)

  // === Tarifa de Uso de Plataforma (Tarea U) ===
  // Cargo editable (por defecto $4.900 COP) que se cobra UNA sola vez al cliente
  // por el uso de la plataforma tecnológica asociada al crédito.
  // Se refleja en el estado de cuenta como concepto "Tarifa de Uso de Plataforma".
  // El ingreso se registra automáticamente en la caja CAJA-USO-PLATAFORMA.
  const [cobroTarifaPlataforma, setCobroTarifaPlataforma] = useState(true)
  const [valorTarifaPlataforma, setValorTarifaPlataforma] = useState<number>(4900)

  // === ID de la solicitud web origen (para auto-marcarla como CONVERTIDA) ===
  // Cuando el admin convierte una solicitud web en préstamo, este ID se pasa
  // al backend para que marque automáticamente la solicitud como CONVERTIDA
  // y active el flujo de firma del lado del cliente.
  const [solicitudWebOrigenId, setSolicitudWebOrigenId] = useState<string | null>(null)

  // === Función: aplicar condiciones de un préstamo al formulario ===
  // Extraída para reutilizar tanto al seleccionar un crédito a renovar como
  // al pulsar "Restablecer condiciones originales".
  const aplicarCondicionesAlFormulario = (p: any) => {
    if (!p) return
    // Determinar la modalidad del crédito original
    const modOriginal = (p.modalidadAmortizacion || 'FRANCES').toUpperCase()
    const esTasaFijaOrig = modOriginal === 'TASA_FIJA'
    const esCuotaPersOrig = modOriginal === 'CUOTA_PERSONALIZADA'

    // Capital
    setMontoPrincipal(String(p.montoPrincipal ?? ''))

    // Campos según modalidad
    if (esCuotaPersOrig) {
      setModalidad('CUOTA_PERSONALIZADA')
      setTasaMensualPersonalizada(String(p.tasaInteresMensual ?? ''))
      setMontoCuotaPersonalizada(String(p.montoCuota ?? ''))
      setNumeroCuotasPersonalizada(String(p.numeroCuotas ?? ''))
    } else if (esTasaFijaOrig) {
      setModalidad('TASA_FIJA')
      setTasaMensualFija(String(p.tasaInteresMensual ?? ''))
      setNumeroCuotasFija(String(p.numeroCuotas ?? ''))
    } else {
      setModalidad('FRANCES')
      setTasaInteresAnual(String(p.tasaInteresAnual ?? ''))
      setPlazoMeses(String(p.plazoMeses ?? ''))
    }

    // Tasa moratoria diaria (común a todas las modalidades)
    setTasaMoraAnual(String(p.tasaMoraDiaria ?? ''))

    // Frecuencia
    if (p.frecuencia) {
      setFrecuencia(p.frecuencia as Frecuencia)
    }

    // Categoría
    if (p.categoriaId) {
      setCategoriaId(p.categoriaId)
    }

    // Documentos
    setRequiereDocumentos(p.requiereDocumentos ?? true)
    setGenerarPagare(p.generarPagare ?? true)
    setGenerarCarta(p.generarCarta ?? true)

    // Cobro Pagaré + Carta
    setCobroPagareCarta(p.cobroPagareCarta ?? false)
    if (p.valorPagareCarta != null) {
      setValorPagareCarta(Number(p.valorPagareCarta))
    }

    // Fondo de Garantía
    setIncluirFondoGarantia(p.fondoGarantiaCargado ?? false)
    if (p.fondoGarantiaTasa != null && Number(p.fondoGarantiaTasa) > 0) {
      setTasaFondoGarantia(Number(p.fondoGarantiaTasa))
    }

    // Periodo de corte
    if (p.periodoCorte) {
      setPeriodoCorte(p.periodoCorte)
    }
  }

  // === Función: cargar saldo pendiente del préstamo a renovar + auto-rellenar formulario ===
  // Cuando el admin selecciona un crédito a renovar, el sistema "arrastra"
  // automáticamente todas las condiciones (tasa, monto, cuotas, frecuencia,
  // modalidad, etc.) para que el admin pueda modificarlas.
  const seleccionarPrestamoARenovar = async (prestamoId: string) => {
    setPrestamoARenovar(prestamoId)
    if (!prestamoId) {
      setSaldoPendienteRenovacion(0)
      setInfoPrestamoRenovacion(null)
      return
    }
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`)
      const json = await res.json()
      if (json.success) {
        const prestamo = json.data
        // Calcular saldo pendiente total (capital + interés - pagado)
        const saldoPendiente = prestamo.saldoTotal || 0
        setSaldoPendienteRenovacion(saldoPendiente)

        // Guardar TODAS las condiciones originales para referencia y comparación
        const condicionesOriginales = {
          codigo: prestamo.codigo,
          montoPrincipal: prestamo.montoPrincipal,
          montoCuota: prestamo.montoCuota,
          numeroCuotas: prestamo.numeroCuotas,
          cuotasPagadas: prestamo.cuotasPagadas,
          saldoTotal: prestamo.saldoTotal,
          estado: prestamo.estado,
          fechaDesembolso: prestamo.fechaDesembolso,
          modalidadAmortizacion: prestamo.modalidadAmortizacion || 'FRANCES',
          tasaInteresAnual: prestamo.tasaInteresAnual,
          tasaInteresMensual: prestamo.tasaInteresMensual,
          tasaMoraDiaria: prestamo.tasaMoraDiaria,
          plazoMeses: prestamo.plazoMeses,
          frecuencia: prestamo.frecuencia,
          categoriaId: prestamo.categoriaId,
          requiereDocumentos: prestamo.requiereDocumentos,
          generarPagare: prestamo.generarPagare,
          generarCarta: prestamo.generarCarta,
          cobroPagareCarta: prestamo.cobroPagareCarta,
          valorPagareCarta: prestamo.valorPagareCarta,
          fondoGarantiaCargado: prestamo.fondoGarantiaCargado,
          fondoGarantiaTasa: prestamo.fondoGarantiaTasa,
          periodoCorte: prestamo.periodoCorte,
          totalInteres: prestamo.totalInteres,
          totalPagar: prestamo.totalPagar,
        }
        setInfoPrestamoRenovacion(condicionesOriginales)

        // === AUTO-RELLENAR el formulario con las condiciones del crédito a renovar ===
        // El admin puede modificar cualquier campo después.
        aplicarCondicionesAlFormulario(prestamo)

        toast({
          title: '✅ Condiciones cargadas',
          description: `Se cargaron las condiciones del crédito ${prestamo.codigo}. Modifica los campos que necesites cambiar.`,
        })
      }
    } catch (e: any) {
      console.error('Error cargando préstamo a renovar:', e)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las condiciones del crédito',
        variant: 'destructive',
      })
    }
  }

  // === Función: restablecer las condiciones originales en el formulario ===
  // Permite al admin volver a las condiciones del crédito original si modificó
  // algún campo por error.
  const restablecerCondicionesOriginales = () => {
    if (!infoPrestamoRenovacion) return
    aplicarCondicionesAlFormulario(infoPrestamoRenovacion)
    toast({
      title: '🔄 Condiciones restablecidas',
      description: `Se restauraron las condiciones originales del crédito ${infoPrestamoRenovacion.codigo}.`,
    })
  }

  // === Función: detectar qué campos cambiaron vs el crédito original ===
  // Devuelve un array de { campo, original, actual } para mostrar un resumen
  // visual de las modificaciones.
  const detectarCambios = () => {
    if (!infoPrestamoRenovacion) return []
    const p = infoPrestamoRenovacion
    const cambios: { campo: string; original: string; actual: string }[] = []

    const montoActual = parseFloat(montoPrincipal) || 0
    if (montoActual !== (p.montoPrincipal || 0)) {
      cambios.push({ campo: 'Capital', original: formatearMoneda(p.montoPrincipal), actual: formatearMoneda(montoActual) })
    }

    const tasaMorActual = parseFloat(tasaMoraAnual) || 0
    if (tasaMorActual !== (p.tasaMoraDiaria || 0)) {
      cambios.push({ campo: 'Tasa moratoria diaria', original: `${p.tasaMoraDiaria}%`, actual: `${tasaMorActual}%` })
    }

    if (frecuencia !== p.frecuencia) {
      cambios.push({ campo: 'Frecuencia', original: p.frecuencia || '—', actual: frecuencia })
    }

    const modOriginal = (p.modalidadAmortizacion || 'FRANCES').toUpperCase()
    if (modalidad !== modOriginal) {
      cambios.push({ campo: 'Modalidad', original: modOriginal, actual: modalidad })
    } else if (modalidad === 'FRANCES') {
      const tasaActual = parseFloat(tasaInteresAnual) || 0
      if (tasaActual !== (p.tasaInteresAnual || 0)) {
        cambios.push({ campo: 'Tasa anual', original: `${p.tasaInteresAnual}%`, actual: `${tasaActual}%` })
      }
      const plazoActual = parseInt(plazoMeses) || 0
      if (plazoActual !== (p.plazoMeses || 0)) {
        cambios.push({ campo: 'Plazo (meses)', original: String(p.plazoMeses), actual: String(plazoActual) })
      }
    } else if (modalidad === 'TASA_FIJA') {
      const tasaMensActual = parseFloat(tasaMensualFija) || 0
      const tasaMensOrig = p.tasaInteresMensual || 0
      if (tasaMensActual !== tasaMensOrig) {
        cambios.push({ campo: 'Tasa mensual', original: `${tasaMensOrig}%`, actual: `${tasaMensActual}%` })
      }
      const cuotasActual = parseInt(numeroCuotasFija) || 0
      if (cuotasActual !== (p.numeroCuotas || 0)) {
        cambios.push({ campo: 'N° cuotas', original: String(p.numeroCuotas), actual: String(cuotasActual) })
      }
    } else if (modalidad === 'CUOTA_PERSONALIZADA') {
      const tasaMensActual = parseFloat(tasaMensualPersonalizada) || 0
      const tasaMensOrig = p.tasaInteresMensual || 0
      if (tasaMensActual !== tasaMensOrig) {
        cambios.push({ campo: 'Tasa mensual', original: `${tasaMensOrig}%`, actual: `${tasaMensActual}%` })
      }
      const cuotaActual = parseFloat(montoCuotaPersonalizada) || 0
      if (cuotaActual !== (p.montoCuota || 0)) {
        cambios.push({ campo: 'Cuota', original: formatearMoneda(p.montoCuota), actual: formatearMoneda(cuotaActual) })
      }
      const cuotasActual = parseInt(numeroCuotasPersonalizada) || 0
      if (cuotasActual !== (p.numeroCuotas || 0)) {
        cambios.push({ campo: 'N° cuotas', original: String(p.numeroCuotas), actual: String(cuotasActual) })
      }
    }

    return cambios
  }

  // === Función: al activar el switch de codeudor, precargar automáticamente ===
  const handleTieneCodeudorChange = (checked: boolean) => {
    setTieneCodeudor(checked)
    if (checked) {
      // Si solo hay un cliente disponible (excluyendo el deudor), seleccionarlo automáticamente
      const disponibles = clientes.filter((c) => c.id !== clienteId)
      if (disponibles.length === 1) {
        setCodeudorId(disponibles[0].id)
      }
      // Si hay más de uno, no seleccionar nada para que el usuario elija
    } else {
      // Si se desactiva, limpiar el codeudor seleccionado
      setCodeudorId('')
    }
  }
  // Datos adicionales para pagare/carta (autocompletados desde el cliente)
  const [nombreClienteSel, setNombreClienteSel] = useState('')
  const [cedulaClienteSel, setCedulaClienteSel] = useState('')
  const [telefonoClienteSel, setTelefonoClienteSel] = useState('')
  const [emailClienteSel, setEmailClienteSel] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [barrio, setBarrio] = useState('')
  const [direccion, setDireccion] = useState('')
  // Datos bancarios del cliente (auto-cargados al seleccionar cliente)
  const [bancoCliente, setBancoCliente] = useState('')
  const [tipoCuentaCliente, setTipoCuentaCliente] = useState('')
  const [numeroCuentaCliente, setNumeroCuentaCliente] = useState('')
  const [aprobarYEnviarTyC, setAprobarYEnviarTyC] = useState(true)
  const [solicitarFirmaElectronica, setSolicitarFirmaElectronica] = useState(true)
  const [canalFirma, setCanalFirma] = useState<'WHATSAPP' | 'EMAIL' | 'AMBOS'>('AMBOS')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    // FIX C10: AbortController para cancelar fetches si el componente se
    // desmonta (evita setStates sobre componente desmontado → warning + memory leak).
    const ac = new AbortController()
    cargar(ac.signal)
    cargarClientes(ac.signal)
    cargarCategorias(ac.signal)
    return () => ac.abort()
  }, [])

  // Auto-calcular Cuota Fija cuando los inputs relevantes cambien
  // y el usuario no haya modificado manualmente la cuota
  useEffect(() => {
    if (modalidad !== 'CUOTA_PERSONALIZADA') return
    if (!cuotaAutoCalculada) return

    const monto = parseFloat(montoPrincipal)
    const tasaMen = parseFloat(tasaMensualPersonalizada)
    const nCuotas = parseInt(numeroCuotasPersonalizada)
    if (!monto || !tasaMen || !nCuotas || nCuotas <= 0) return

    // Cuotas por mes según frecuencia
    let cuotasPorMes = 1
    if (frecuencia === 'MENSUAL') cuotasPorMes = 1
    else if (frecuencia === 'QUINCENAL') cuotasPorMes = 2
    else if (frecuencia === 'SEMANAL') cuotasPorMes = 4

    // Interés por cuota = (monto * tasa/100) / cuotasPorMes
    const interesPorCuota = (monto * tasaMen / 100) / cuotasPorMes
    // Capital por cuota = monto / nCuotas
    const capitalPorCuota = monto / nCuotas
    // Cuota total = capital + interés
    const cuotaCalculada = Math.round((capitalPorCuota + interesPorCuota) * 100) / 100

    setMontoCuotaPersonalizada(cuotaCalculada.toString())
  }, [
    modalidad,
    cuotaAutoCalculada,
    montoPrincipal,
    tasaMensualPersonalizada,
    numeroCuotasPersonalizada,
    frecuencia,
  ])

  const cargar = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const res = await fetch('/api/prestamos', { signal })
      const json = await res.json()
      if (json.success) setPrestamos(json.data)
    } catch (e: any) {
      // AbortError es esperado al desmontar — no loguear
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      // Solo actualizar loading si no fue abortado
      if (!signal?.aborted) setLoading(false)
    }
  }

  const cargarClientes = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/clientes', { signal })
      const json = await res.json()
      if (json.success) setClientes(json.data)
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    }
  }

  const cargarCategorias = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/categorias', { signal })
      const json = await res.json()
      if (json.success) setCategorias(json.data)
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    }
  }

  // Cálculo según modalidad
  const calculo = useMemo(() => {
    // === Resolución de fecha base para la tabla de amortización ===
    // Si hay periodoCorte activo y fechaPrimerCorte calculada, las cuotas
    // se programan desde fechaPrimerCorte (no desde fechaPrestamo).
    // Esto implementa la regla: "las fechas de pago se iniciaran desde
    // esa fecha corte" (ej: préstamo 2/08 con corte 5-20 → primera cuota
    // se programa desde el 5/08).
    let fechaBaseParaAmortizacion: Date | undefined = undefined
    if (periodoCorte && fechaPrimerCorte) {
      fechaBaseParaAmortizacion = fechaPrimerCorte
    } else if (fechaPrestamo) {
      const [yyyy, mm, dd] = fechaPrestamo.split('-').map(Number)
      if (yyyy && mm && dd) {
        fechaBaseParaAmortizacion = new Date(yyyy, mm - 1, dd, 12, 0, 0)
      }
    }

    // === Modalidad TASA_FIJA (Tasa Fija Mensual sobre capital inicial) ===
    if (modalidad === 'TASA_FIJA') {
      const monto = parseFloat(montoPrincipal)
      const tasaMen = parseFloat(tasaMensualFija)
      const nCuotas = parseInt(numeroCuotasFija)
      if (!monto || !tasaMen || !nCuotas) return null

      const resultado = calcularPrestamoTasaFijaMensual({
        montoPrincipal: monto,
        tasaMensualFija: tasaMen,
        numeroCuotas: nCuotas,
        frecuencia,
        fechaDesembolso: fechaBaseParaAmortizacion,
      })

      // Si hay valorDiasCausados, sumarlo al total a pagar
      if (valorDiasCausados > 0) {
        return {
          ...resultado,
          totalPagar: Math.round((resultado.totalPagar + valorDiasCausados) * 100) / 100,
          valorDiasCausados,
          diasCausadosAntes,
          fechaPrimerCorte: fechaPrimerCorte || undefined,
        }
      }
      return resultado
    }

    if (modalidad === 'CUOTA_PERSONALIZADA') {
      const monto = parseFloat(montoPrincipal)
      const tasaMen = parseFloat(tasaMensualPersonalizada)
      const nCuotas = parseInt(numeroCuotasPersonalizada)
      const cuota = parseFloat(montoCuotaPersonalizada)
      if (!monto || !tasaMen || !nCuotas || !cuota) return null

      // Cálculo local sin llamar a la API (para preview en tiempo real)
      let cuotasPorMes = 1
      if (frecuencia === 'MENSUAL') cuotasPorMes = 1
      else if (frecuencia === 'QUINCENAL') cuotasPorMes = 2
      else if (frecuencia === 'SEMANAL') cuotasPorMes = 4

      const interesPorCuota = (monto * tasaMen / 100) / cuotasPorMes
      const totalInteres = Math.round(interesPorCuota * nCuotas * 100) / 100
      let totalPagar = Math.round((cuota * nCuotas) * 100) / 100
      const tasaAnual = tasaMen * 12

      // Generar tabla básica usando fechaBaseParaAmortizacion (corte o prestamo)
      const fechaBase = fechaBaseParaAmortizacion || null
      const tabla: any[] = []
      let saldoCapital = monto
      for (let i = 1; i <= nCuotas; i++) {
        const interes = Math.round(interesPorCuota * 100) / 100
        let capital = Math.round((cuota - interes) * 100) / 100
        if (i === nCuotas) capital = Math.round(saldoCapital * 100) / 100
        saldoCapital = Math.round((saldoCapital - capital) * 100) / 100
        if (saldoCapital < 0) saldoCapital = 0

        // === Usar fechaBase si está disponible, si no, la fecha actual ===
        const fechaVenc = fechaBase ? new Date(fechaBase.getTime()) : new Date()
        if (frecuencia === 'MENSUAL') fechaVenc.setMonth(fechaVenc.getMonth() + i)
        else if (frecuencia === 'QUINCENAL') fechaVenc.setDate(fechaVenc.getDate() + 15 * i)
        else if (frecuencia === 'SEMANAL') fechaVenc.setDate(fechaVenc.getDate() + 7 * i)

        tabla.push({
          numero: i,
          fechaVencimiento: fechaVenc,
          montoCuota: i === nCuotas ? Math.round((capital + interes) * 100) / 100 : cuota,
          capital,
          interes,
          saldoCapital,
        })
      }

      // Si hay valorDiasCausados, sumarlo al total a pagar
      const valorDiasExtra = valorDiasCausados > 0 ? valorDiasCausados : 0
      if (valorDiasExtra > 0) {
        totalPagar = Math.round((totalPagar + valorDiasExtra) * 100) / 100
      }

      return {
        numeroCuotas: nCuotas,
        montoCuota: cuota,
        totalInteres,
        totalPagar,
        tasaAplicada: tasaMen / 100 / cuotasPorMes,
        tablaAmortizacion: tabla,
        fechaVencimiento: tabla[tabla.length - 1]?.fechaVencimiento,
        fondoGarantia: incluirFondoGarantia ? Math.round(monto * (tasaFondoGarantia / 100) * 100) / 100 : 0,
        tipoCalculo: 'CUOTA_PERSONALIZADA',
        tasaMensual: tasaMen,
        tasaAnual,
        valorDiasCausados: valorDiasExtra > 0 ? valorDiasExtra : undefined,
        diasCausadosAntes: valorDiasExtra > 0 ? diasCausadosAntes : undefined,
        fechaPrimerCorte: valorDiasExtra > 0 ? (fechaPrimerCorte || undefined) : undefined,
      }
    }

    // Modalidad FRANCÉS (sistema tradicional)
    const monto = parseFloat(montoPrincipal)
    const tasa = parseFloat(tasaInteresAnual)
    const plazo = parseInt(plazoMeses)
    if (!monto || !tasa || !plazo) return null

    const resultado = calcularPrestamo({
      montoPrincipal: monto,
      tasaInteresAnual: tasa,
      tasaMoraAnual: parseFloat(tasaMoraAnual),
      plazoMeses: plazo,
      frecuencia,
      fechaDesembolso: fechaBaseParaAmortizacion,
    })

    // Si hay valorDiasCausados, sumarlo al total a pagar
    if (valorDiasCausados > 0) {
      return {
        ...resultado,
        totalPagar: Math.round((resultado.totalPagar + valorDiasCausados) * 100) / 100,
        valorDiasCausados,
        diasCausadosAntes,
        fechaPrimerCorte: fechaPrimerCorte || undefined,
      }
    }
    return resultado
  }, [
    modalidad, montoPrincipal, tasaInteresAnual, tasaMoraAnual, plazoMeses, frecuencia,
    tasaMensualPersonalizada, montoCuotaPersonalizada, numeroCuotasPersonalizada,
    tasaMensualFija, numeroCuotasFija, fechaPrestamo,
    periodoCorte, fechaPrimerCorte, valorDiasCausados, diasCausadosAntes,
    incluirFondoGarantia, tasaFondoGarantia,
  ])

  const prestamosFiltrados = prestamos.filter((p) => {
    const matchBusqueda =
      p.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente.cedula.includes(busqueda)
    const matchEstado = filtroEstado === 'all' || p.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  const seleccionarCategoria = (id: string) => {
    setCategoriaId(id)
    const cat = categorias.find((c) => c.id === id)
    if (cat) {
      setTasaInteresAnual(cat.tasaInteresAnual.toString())
      setTasaMoraAnual(cat.tasaMoraAnual.toString())
    }
  }

  const seleccionarCliente = (id: string) => {
    setClienteId(id)
    const c = clientes.find((cl) => cl.id === id)
    if (c) {
      // Datos de identidad del cliente (para pagaré y carta)
      setNombreClienteSel(c.nombre || '')
      setCedulaClienteSel(c.cedula || '')
      setTelefonoClienteSel(c.telefono || '')
      setEmailClienteSel(c.email || '')
      // Datos de ubicación (para pagaré y carta)
      setDepartamento(c.departamento || '')
      setMunicipio(c.municipio || '')
      setCiudad(c.ciudad || '')
      setBarrio(c.barrio || '')
      setDireccion(c.direccion || '')
      // Datos bancarios
      setBancoCliente(c.bancoCliente || '')
      setTipoCuentaCliente(c.tipoCuentaCliente || '')
      setNumeroCuentaCliente(c.numeroCuentaCliente || '')

      // === Cargar tasa personalizada del cliente desde la BD ===
      const tienePers = !!c.tieneTasaPersonalizada
      const valorPers = c.tasaPersonalizada != null ? Number(c.tasaPersonalizada) : null
      setClienteTieneTasaPers(tienePers)
      setClienteTasaPersValor(valorPers)
      // Por defecto, si el cliente tiene tasa asignada → usarla
      // El usuario podrá cambiar la decisión con el selector
      if (tienePers && valorPers != null && valorPers > 0) {
        setDecisionTasa('CLIENTE')
        // Cargar la tasa en los campos correspondientes según la modalidad
        setTasaMensualPersonalizada(String(valorPers))
        // Convertir a anual para el Sistema Francés
        setTasaInteresAnual(String((valorPers * 12).toFixed(2)))
      } else {
        setDecisionTasa(null)
      }
    }
  }

  // Cuando se habilite "Requiere documentos", recargar los datos del cliente
  // seleccionado por si el usuario aún no ha cambiado el select
  useEffect(() => {
    if (!requiereDocumentos || !clienteId) return
    const c = clientes.find((cl) => cl.id === clienteId)
    if (!c) return
    // Solo autocompletar si los campos están vacíos (para no sobreescribir ediciones manuales)
    if (!nombreClienteSel && !departamento && !bancoCliente) {
      setNombreClienteSel(c.nombre || '')
      setCedulaClienteSel(c.cedula || '')
      setTelefonoClienteSel(c.telefono || '')
      setEmailClienteSel(c.email || '')
      setDepartamento(c.departamento || '')
      setMunicipio(c.municipio || '')
      setCiudad(c.ciudad || '')
      setBarrio(c.barrio || '')
      setDireccion(c.direccion || '')
      setBancoCliente(c.bancoCliente || '')
      setTipoCuentaCliente(c.tipoCuentaCliente || '')
      setNumeroCuentaCliente(c.numeroCuentaCliente || '')
    }
  }, [requiereDocumentos, clienteId, clientes])

  // Aplicar parámetros de simulación inyectados (por ejemplo, al convertir
  // una solicitud web del buzón en préstamo). Se ejecuta cuando cambia
  // `simulacionInicial` y precarga el formulario abriendo el modal.
  useEffect(() => {
    if (!simulacionInicial) return
    // Forzar modalidad FRANCÉS (la simulación web se calcula con tasa anual)
    setModalidad('FRANCES')
    if (simulacionInicial.clienteId) {
      seleccionarCliente(simulacionInicial.clienteId)
    }
    if (simulacionInicial.montoPrincipal) setMontoPrincipal(simulacionInicial.montoPrincipal)
    if (simulacionInicial.tasaInteresAnual) setTasaInteresAnual(simulacionInicial.tasaInteresAnual)
    if (simulacionInicial.plazoMeses) setPlazoMeses(simulacionInicial.plazoMeses)
    if (simulacionInicial.frecuencia) setFrecuencia(simulacionInicial.frecuencia)
    // === Preservar ID de la solicitud web origen ===
    setSolicitudWebOrigenId(simulacionInicial.solicitudWebId || null)
    // === Preservar flexibilidad financiera elegida por el cliente ===
    if (simulacionInicial.flexibilidadFinanciera) {
      setFlexibilidadFinanciera(true)
      const modalidad = (simulacionInicial.flexibilidadModalidad || 'BASICA').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'BASICA'
      setFlexibilidadModalidad(modalidad)
    }
    // === Preservar Renovación Anticipada elegida por el cliente ===
    if (simulacionInicial.renovacionAnticipada) {
      setRenovacionAnticipada(true)
    }
    setModalAbierto(true)
  }, [simulacionInicial])

  // === AUTO-CÁLCULO DEL BLOQUE DE CORTE ===
  // Cuando cambian: fechaPrestamo, periodoCorte, montoPrincipal, o la tasa activa
  // según modalidad, se recalculan automáticamente:
  //   - fechaPrimerCorte (el corte más cercano forward desde fechaPrestamo)
  //   - diasCausadosAntes (días entre fechaPrestamo y fechaPrimerCorte)
  //   - valorDiasCausados (monto COP de interés anticipado por esos días)
  //
  // Si el usuario editó manualmente los días/valor (editarDiasCausadosManual=true),
  // NO se sobreescribe su edición — pero la fechaPrimerCorte sí se mantiene sincronizada.

  // === Calcular el número de cuotas actual según la modalidad ===
  // (para mostrar/ocultar la opción de Flexibilidad Financiera cuando cuotas >= 4)
  const cuotasActuales = useMemo(() => {
    if (modalidad === 'TASA_FIJA') return parseInt(numeroCuotasFija) || 0
    if (modalidad === 'CUOTA_PERSONALIZADA') return parseInt(numeroCuotasPersonalizada) || 0
    // FRANCÉS: plazoMeses * cuotasPorMes según frecuencia
    const plazo = parseInt(plazoMeses) || 0
    if (frecuencia === 'MENSUAL') return plazo
    if (frecuencia === 'QUINCENAL') return plazo * 2
    if (frecuencia === 'SEMANAL') return plazo * 4
    return plazo
  }, [modalidad, numeroCuotasFija, numeroCuotasPersonalizada, plazoMeses, frecuencia])

  // === Si el número de cuotas baja de 4, desactivar flexibilidad automáticamente ===
  useEffect(() => {
    if (cuotasActuales < 4 && flexibilidadFinanciera) {
      setFlexibilidadFinanciera(false)
    }
  }, [cuotasActuales, flexibilidadFinanciera])
  useEffect(() => {
    if (!fechaPrestamo || !periodoCorte) {
      setFechaPrimerCorte(null)
      if (!editarDiasCausadosManual) {
        setDiasCausadosAntes(0)
        setValorDiasCausados(0)
      }
      return
    }

    // Determinar la tasa activa según la modalidad para el cálculo del valor
    let tasaValor = 0
    let tipoTasa: 'ANUAL' | 'MENSUAL' = 'ANUAL'
    if (modalidad === 'FRANCES') {
      tasaValor = parseFloat(tasaInteresAnual) || 0
      tipoTasa = 'ANUAL'
    } else if (modalidad === 'TASA_FIJA') {
      tasaValor = parseFloat(tasaMensualFija) || 0
      tipoTasa = 'MENSUAL'
    } else if (modalidad === 'CUOTA_PERSONALIZADA') {
      tasaValor = parseFloat(tasaMensualPersonalizada) || 0
      tipoTasa = 'MENSUAL'
    }

    const bloque = calcularBloqueCorte({
      fechaPrestamo,
      periodo: periodoCorte as PeriodoCorte,
      montoPrincipal,
      tasaValor,
      tipoTasa,
    })

    if (!bloque) {
      setFechaPrimerCorte(null)
      if (!editarDiasCausadosManual) {
        setDiasCausadosAntes(0)
        setValorDiasCausados(0)
      }
      return
    }

    setFechaPrimerCorte(prev => {
      // Evitar re-render infinito: solo actualizar si la fecha realmente cambió
      // (comparar timestamps, no referencias de objeto Date).
      const nuevoTs = bloque.fechaPrimerCorte.getTime()
      const prevTs = prev ? prev.getTime() : 0
      return nuevoTs !== prevTs ? bloque.fechaPrimerCorte : prev
    })
    if (!editarDiasCausadosManual) {
      setDiasCausadosAntes(prev => prev === bloque.diasCausadosAntes ? prev : bloque.diasCausadosAntes)
      setValorDiasCausados(prev => prev === bloque.valorDiasCausados ? prev : bloque.valorDiasCausados)
    }
  }, [
    fechaPrestamo,
    periodoCorte,
    montoPrincipal,
    modalidad,
    tasaInteresAnual,
    tasaMensualFija,
    tasaMensualPersonalizada,
    editarDiasCausadosManual,
  ])

  // Helper: cuando el usuario edita manualmente los días o el valor,
  // activamos el modo manual. Si quiere volver al auto-cálculo, debe
  // presionar el botón "Recalcular auto".
  const handleEditarDiasCausados = () => {
    setEditarDiasCausadosManual(true)
  }
  const handleRecalcularDiasCausados = () => {
    setEditarDiasCausadosManual(false)
    // Forzar recálculo inmediato (no espera al próximo render)
    if (!fechaPrestamo || !periodoCorte) return
    let tasaValor = 0
    let tipoTasa: 'ANUAL' | 'MENSUAL' = 'ANUAL'
    if (modalidad === 'FRANCES') {
      tasaValor = parseFloat(tasaInteresAnual) || 0
      tipoTasa = 'ANUAL'
    } else if (modalidad === 'TASA_FIJA') {
      tasaValor = parseFloat(tasaMensualFija) || 0
      tipoTasa = 'MENSUAL'
    } else if (modalidad === 'CUOTA_PERSONALIZADA') {
      tasaValor = parseFloat(tasaMensualPersonalizada) || 0
      tipoTasa = 'MENSUAL'
    }
    const bloque = calcularBloqueCorte({
      fechaPrestamo,
      periodo: periodoCorte as PeriodoCorte,
      montoPrincipal,
      tasaValor,
      tipoTasa,
    })
    if (bloque) {
      setFechaPrimerCorte(bloque.fechaPrimerCorte)
      setDiasCausadosAntes(bloque.diasCausadosAntes)
      setValorDiasCausados(bloque.valorDiasCausados)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) {
      toast({ title: 'Error', description: 'Selecciona un cliente', variant: 'destructive' })
      return
    }

    const docsDatosAdicionales = requiereDocumentos
      ? {
          nombreCliente: nombreClienteSel,
          cedulaCliente: cedulaClienteSel,
          telefonoCliente: telefonoClienteSel,
          emailCliente: emailClienteSel,
          departamento,
          municipio,
          ciudad,
          barrio,
          direccion,
          bancoCliente,
          tipoCuentaCliente,
          numeroCuentaCliente,
        }
      : null

    try {
      const body: any = {
        clienteId,
        montoPrincipal,
        categoriaId,
        requiereDocumentos,
        generarPagare,
        generarCarta,
        docsDatosAdicionales,
        aprobarYEnviarTyC,
        notas,
        // === Fecha del préstamo (fecha asignada) ===
        // Se envía al backend para que el código del préstamo, fechaSolicitud,
        // fechaDesembolso y todos los documentos usen esta fecha como base.
        fechaPrestamo,
      }

      // === Periodo de corte + días causados antes del corte ===
      // Solo se envían si el usuario seleccionó un periodo de corte.
      // El backend los usa para:
      //   - Programar las cuotas desde fechaPrimerCorte (no desde fechaPrestamo)
      //   - Cobrar valorDiasCausados como interés anticipado (suma al totalPagar)
      if (periodoCorte && fechaPrimerCorte) {
        body.periodoCorte = periodoCorte
        body.fechaPrimerCorte = fechaPrimerCorte.toISOString()
        body.diasCausadosAntes = diasCausadosAntes
        body.valorDiasCausados = valorDiasCausados
      }

      // === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) ===
      // DOS tarifas:
      //   - BASICA  ($15.000): 1 uso durante la vigencia
      //   - PREMIUM ($34.900): 2 usos durante la vigencia
      // El cobro se hace UNA sola vez al inicio del crédito, cargado en la primera cuota.
      if (flexibilidadFinanciera) {
        body.flexibilidadFinanciera = true
        body.flexibilidadModalidad = flexibilidadModalidad
        body.flexibilidadCosto = flexibilidadCosto
      }

      // === Renovación Anticipada (beneficio opcional del simulador del portal) ===
      // Cobro único de $9.900 COP. Se cobra UNA sola vez al inicio del crédito
      // (al activarse tras T&C) y se registra automáticamente en CAJA-RENOVACIONES.
      if (renovacionAnticipada) {
        body.renovacionAnticipada = true
        body.renovacionAnticipadaCosto = RENOVACION_ANTICIPADA_COSTO
      }

      // === Fondo de Garantía (opcional, tasa configurable) ===
      // Solo se envía si el gestor activó el fondo. La tasa se envía como decimal (0.05 = 5%).
      body.incluirFondoGarantia = incluirFondoGarantia
      body.tasaFondoGarantia = tasaFondoGarantia / 100 // Convertir % a decimal

      // === Cobro de Pagaré + Carta de Instrucciones ===
      // Cargo editable (por defecto $19.900 COP) cobrado UNA sola vez al inicio.
      // Se explica en el estado de cuenta como concepto "Pagaré + Carta de Instrucciones".
      if (cobroPagareCarta && requiereDocumentos && (generarPagare || generarCarta)) {
        body.cobroPagareCarta = true
        body.valorPagareCarta = Number(valorPagareCarta) || 19900
      }

      // === Tarifa de Uso de Plataforma (Tarea U) ===
      // Cargo editable (por defecto $4.900 COP) cobrado UNA sola vez al inicio.
      // Se refleja en el estado de cuenta como concepto "Tarifa de Uso de Plataforma".
      if (cobroTarifaPlataforma) {
        body.cobroTarifaPlataforma = true
        body.valorTarifaPlataforma = Number(valorTarifaPlataforma) || 4900
      }

      // === ID de la solicitud web origen (para auto-marcarla como CONVERTIDA) ===
      // Cuando se crea el préstamo, el backend marca la solicitud web como CONVERTIDA
      // y activa el flujo de firma del lado del cliente.
      if (solicitudWebOrigenId) {
        body.solicitudWebOrigenId = solicitudWebOrigenId
      }


      // === Renovación ===
      if (esRenovacion && prestamoARenovar) {
        body.esRenovacion = true
        body.prestamoARenovarId = prestamoARenovar
        body.saldoPendienteRenovacion = saldoPendienteRenovacion
      }

      // === Codeudor ===
      if (tieneCodeudor && codeudorId) {
        const cod = clientes.find((c) => c.id === codeudorId)
        if (cod) {
          body.tieneCodeudor = true
          body.codeudorId = cod.id
          body.codeudorNombre = cod.nombre
          body.codeudorCedula = cod.cedula
          body.codeudorTelefono = cod.telefono
          body.codeudorEmail = cod.email || ''
          body.codeudorDireccion = cod.direccion || ''
        }
      } else {
        body.tieneCodeudor = false
      }

      if (modalidad === 'CUOTA_PERSONALIZADA') {
        body.modalidad = 'CUOTA_PERSONALIZADA'
        body.tasaMensualPersonalizada = tasaMensualPersonalizada
        body.montoCuotaPersonalizada = montoCuotaPersonalizada
        body.numeroCuotasPersonalizada = numeroCuotasPersonalizada
        body.frecuencia = frecuencia
        body.tasaMoraAnual = tasaMoraAnual
      } else if (modalidad === 'TASA_FIJA') {
        body.modalidad = 'TASA_FIJA'
        body.tasaMensualFija = tasaMensualFija
        body.numeroCuotasFija = numeroCuotasFija
        body.frecuencia = frecuencia
        body.tasaMoraAnual = tasaMoraAnual
      } else {
        body.tasaInteresAnual = tasaInteresAnual
        body.tasaMoraAnual = tasaMoraAnual
        body.plazoMeses = plazoMeses
        body.frecuencia = frecuencia
      }

      const res = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        // Si está habilitada la firma electrónica, iniciar el flujo automáticamente
        if (aprobarYEnviarTyC && solicitarFirmaElectronica) {
          try {
            const resFirma = await fetch('/api/firma', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accion: 'iniciar_firma',
                prestamoId: json.data.id,
                tipo: 'TYC',
                canal: canalFirma,
              }),
            })
            const jsonFirma = await resFirma.json()
            if (jsonFirma.success) {
              // Construir mensaje de WhatsApp con el link de firma del DEUDOR
              const clienteNombre = jsonFirma.data.cliente.nombre
              const linkFirma = jsonFirma.data.linkFirma
              const telefono = jsonFirma.data.cliente.telefono
              const mensajeFirma = `🔐 *FIRMA ELECTRÓNICA - PRÉSTAMO ${json.data.codigo}*

Hola *${clienteNombre}*,

Como *DEUDOR* del préstamo, necesitas firmar electrónicamente:

📋 *Pasos a seguir:*
1. Ingresa al siguiente enlace:
${linkFirma}

2. Sube foto de tu documento de identidad
3. Sube una selfie sosteniendo tu cédula
4. Dibuja tu firma
5. Recibe un código de verificación y confírmalo

⏰ El enlace expira en 7 días.
🔒 Es un proceso seguro con verificación de identidad.`

              const linkWa = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensajeFirma)}`
              window.open(linkWa, '_blank', 'noopener,noreferrer')

              // === Si hay codeudor, abrir también su link de WhatsApp ===
              if (jsonFirma.data.tieneCodeudor && jsonFirma.data.linkFirmaCodeudor) {
                const codeudorNombre = jsonFirma.data.codeudor.nombre
                const codeudorTelefono = jsonFirma.data.codeudor.telefono
                const linkFirmaCodeudor = jsonFirma.data.linkFirmaCodeudor
                const mensajeFirmaCodeudor = `🔐 *FIRMA ELECTRÓNICA - PRÉSTAMO ${json.data.codigo}*

Hola *${codeudorNombre}*,

Como *CODEUDOR* del préstamo, necesitas firmar electrónicamente:

📋 *Pasos a seguir:*
1. Ingresa al siguiente enlace:
${linkFirmaCodeudor}

2. Sube foto de tu documento de identidad
3. Sube una selfie sosteniendo tu cédula
4. Dibuja tu firma
5. Recibe un código de verificación y confírmalo

⏰ El enlace expira en 7 días.
🔒 Es un proceso seguro con verificación de identidad.`

                // Abrir WhatsApp del codeudor después de 1 segundo
                setTimeout(() => {
                  const linkWaCodeudor = `https://wa.me/57${codeudorTelefono}?text=${encodeURIComponent(mensajeFirmaCodeudor)}`
                  window.open(linkWaCodeudor, '_blank', 'noopener,noreferrer')
                }, 1500)

                toast({
                  title: '✅ Préstamo creado + Firmas enviadas a DEUDOR y CODEUDOR',
                  description: `Código ${json.data.codigo}. Se abrieron 2 ventanas de WhatsApp: una para ${clienteNombre} (deudor) y otra para ${codeudorNombre} (codeudor). Ambos deben firmar con OTP por ${canalFirma === 'EMAIL' ? 'correo' : canalFirma === 'WHATSAPP' ? 'WhatsApp' : 'WhatsApp o correo'}.`,
                  duration: 12000,
                })

                // Si el canal incluye correo, mostrar toast de email
                if ((canalFirma === 'EMAIL' || canalFirma === 'AMBOS')) {
                  toast({
                    title: '📧 Links de firma también enviados por correo',
                    description: `Deudor: ${jsonFirma.data.cliente.email || 'sin email'} · Codeudor: ${jsonFirma.data.codeudor.email || 'sin email'}`,
                    duration: 6000,
                  })
                }
              } else {
                // Sin codeudor: solo deudor
                toast({
                  title: '✅ Préstamo creado + Solicitud de firma electrónica enviada',
                  description: `Código ${json.data.codigo}. Se abrió WhatsApp con el link de firma. El cliente debe: subir foto del documento, selfie con cédula, dibujar firma y validar código ${canalFirma === 'EMAIL' ? 'por correo' : canalFirma === 'WHATSAPP' ? 'por WhatsApp' : 'por WhatsApp o correo'}.`,
                  duration: 10000,
                })

                // También enviar por correo si el canal es EMAIL o AMBOS
                if ((canalFirma === 'EMAIL' || canalFirma === 'AMBOS') && jsonFirma.data.cliente.email) {
                  toast({
                    title: '📧 Link de firma también enviado por correo',
                    description: `A: ${jsonFirma.data.cliente.email}`,
                    duration: 5000,
                  })
                }
              }
            } else {
              toast({
                title: '⚠️ Préstamo creado pero no se pudo iniciar firma',
                description: jsonFirma.error || 'Error desconocido',
                variant: 'destructive',
                duration: 8000,
              })
            }
          } catch (e: any) {
            toast({
              title: '⚠️ Error al iniciar firma electrónica',
              description: e.message,
              variant: 'destructive',
            })
          }
        } else if (aprobarYEnviarTyC && json.linkTycWaMe) {
          // Abrir WhatsApp automáticamente con el mensaje de T&C
          window.open(json.linkTycWaMe, '_blank', 'noopener,noreferrer')
          toast({
            title: '✅ Préstamo creado - Abre WhatsApp para enviar T&C',
            description: `Código ${json.data.codigo}. Se abrió WhatsApp con el mensaje de T&C. Haz clic en enviar desde WhatsApp para que el cliente reciba el link de aceptación.`,
            duration: 8000,
          })
        } else if (json.linkSolicitudWaMe) {
          window.open(json.linkSolicitudWaMe, '_blank', 'noopener,noreferrer')
          toast({
            title: 'Préstamo creado - Abre WhatsApp',
            description: `Código ${json.data.codigo}. Se abrió WhatsApp con el mensaje de solicitud.`,
            duration: 6000,
          })
        } else {
          toast({
            title: 'Préstamo creado',
            description: `Código ${json.data.codigo}.`,
          })
        }
        setModalAbierto(false)
        limpiarForm()
        cargar()
        onChanged()
        // === ORDEN OBLIGATORIA 3: Abrir vista previa siempre que se termine un proceso ===
        // Después de crear el préstamo, abrir automáticamente el modal de detalle
        // para que el usuario vea el resultado (código, cuotas, documentos generados, etc.)
        if (json.data?.id) {
          setTimeout(() => {
            onAbrirPrestamo(json.data.id)
          }, 400)
        }
      } else {
        // === Manejo específico del bloqueo por mora ===
        // Si el cliente tiene créditos en mora, la API devuelve codigo=CLIENTE_EN_MORA_BLOQUEADO
        // y el detalle de los préstamos en mora. Mostramos un toast detallado y permitimos
        // al admin decidir si forzar la creación con confirmación explícita.
        if (json.codigo === 'CLIENTE_EN_MORA_BLOQUEADO' && json.prestamosEnMora?.length > 0) {
          const detalleMora = json.prestamosEnMora.map((p: any) =>
            `• ${p.codigo} (${p.estado}, ${p.diasMora} días mora, saldo ${formatearMoneda(p.saldoTotal)})`
          ).join('\n')
          toast({
            title: '🚫 Cliente bloqueado por mora',
            description: `El cliente tiene ${json.prestamosEnMora.length} crédito(s) en mora.\n${detalleMora}\n\nResuelva la mora antes de crear un nuevo préstamo.`,
            variant: 'destructive',
            duration: 12000,
          })
        } else {
          toast({ title: 'Error', description: json.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const limpiarForm = () => {
    setClienteId('')
    setModalidad('FRANCES')
    setMontoPrincipal('')
    setTasaInteresAnual('24')
    setTasaMoraAnual('36')
    setTasaMensualPersonalizada('20')
    setMontoCuotaPersonalizada('')
    setNumeroCuotasPersonalizada('2')
    setPlazoMeses('12')
    setFrecuencia('MENSUAL')
    setCategoriaId('')
    setRequiereDocumentos(true)
    setGenerarPagare(true)
    setGenerarCarta(true)
    setDepartamento('')
    setCiudad('')
    setBarrio('')
    setDireccion('')
    setAprobarYEnviarTyC(true)
    setNotas('')
    // Reset fecha del préstamo a hoy
    const hoy = new Date()
    const yyyy = hoy.getFullYear()
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const dd = String(hoy.getDate()).padStart(2, '0')
    setFechaPrestamo(`${yyyy}-${mm}-${dd}`)
    // Reset periodo de corte + días causados
    setPeriodoCorte('')
    setFechaPrimerCorte(null)
    setDiasCausadosAntes(0)
    setValorDiasCausados(0)
    setEditarDiasCausadosManual(false)
    // Reset renovación
    setEsRenovacion(false)
    setPrestamoARenovar('')
    setSaldoPendienteRenovacion(0)
    setInfoPrestamoRenovacion(null)
    // Reset codeudor
    setTieneCodeudor(false)
    setCodeudorId('')
    // Reset flexibilidad financiera
    setFlexibilidadFinanciera(false)
    // Reset renovación anticipada
    setRenovacionAnticipada(false)
  }

  const cambiarEstado = async (id: string, accion: string) => {
    try {
      const res = await fetch(`/api/prestamos/${id}`, {
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

  // === ELIMINAR PRÉSTAMO (borra todo el registro) ===
  const [prestamoAEliminar, setPrestamoAEliminar] = useState<Prestamo | null>(null)
  const [motivoEliminacion, setMotivoEliminacion] = useState('')
  const [eliminandoPrestamo, setEliminandoPrestamo] = useState(false)

  const eliminarPrestamo = (p: Prestamo) => {
    setPrestamoAEliminar(p)
    setMotivoEliminacion('')
  }

  const confirmarEliminarPrestamo = async () => {
    if (!prestamoAEliminar) return
    if (motivoEliminacion.trim().length < 5) {
      toast({
        title: 'Motivo requerido',
        description: 'Explica por qué eliminas el préstamo (mínimo 5 caracteres)',
        variant: 'destructive',
      })
      return
    }
    setEliminandoPrestamo(true)
    try {
      const res = await fetch(
        `/api/prestamos/${prestamoAEliminar.id}?motivo=${encodeURIComponent(motivoEliminacion.trim())}`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (json.success) {
        toast({
          title: '🗑️ Préstamo eliminado',
          description: json.mensaje,
          duration: 8000,
        })
        setPrestamoAEliminar(null)
        setMotivoEliminacion('')
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEliminandoPrestamo(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Préstamos"
        subtitle="Solicitudes y créditos vigentes"
        icon={<FileText className="w-5 h-5" />}
        actions={
          <Button onClick={() => setModalAbierto(true)} disabled={clientes.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Solicitud
          </Button>
        }
      />

      {/* === DASHBOARD / TABLERO DE CONTROL === */}
      <DashboardPrestamos onIrA={(modulo) => {
        // Mapear módulos del dashboard a vistas del sidebar
        const mapeoVistas: Record<string, string> = {
          'solicitudes': 'prestamos',   // ya estamos aquí, scroll a la tabla
          'pagos': 'pagos',
          'juridico': 'juridico',
          'notificaciones': 'notificaciones',
          'comunicaciones': 'comunicaciones',
          'admin': 'admin',
          'seguridad': 'seguridad',
        }
        const vistaDestino = mapeoVistas[modulo] || modulo
        if (modulo === 'solicitudes') {
          // Ya estamos en solicitudes, scroll a la tabla
          document.getElementById('tabla-solicitudes')?.scrollIntoView({ behavior: 'smooth' })
        } else if (onCambiarVista) {
          // Navegar a la vista correspondiente del sidebar
          onCambiarVista(vistaDestino)
        }
      }} />

      {/* === BOTS DISPONIBLES === */}
      <BotIcons modulo="prestamos" />

      {clientes.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            ⚠️ Para crear un préstamo primero debes registrar al menos un cliente en la sección Clientes.
          </CardContent>
        </Card>
      )}

      <div id="tabla-solicitudes" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, cliente o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="SOLICITUD">Solicitud</SelectItem>
            <SelectItem value="PENDIENTE_ACEPTACION">Pend. Aceptación T&C</SelectItem>
            <SelectItem value="ACTIVO">Activo</SelectItem>
            <SelectItem value="EN_MORA">En Mora</SelectItem>
            <SelectItem value="JURIDICO">Jurídico</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Tasa</TableHead>
                <TableHead>Cuota</TableHead>
                <TableHead>Plazo</TableHead>
                {/* === CONTEO DE VIGENCIA — Días transcurridos / Plazo total === */}
                <TableHead className="text-center">Conteo</TableHead>
                {/* === ESTADO DEL PLAZO — Dentro / Cumplido / Excedido / Cancelado === */}
                <TableHead className="text-center">Estado del Plazo</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : prestamosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    No hay préstamos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                prestamosFiltrados.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">
                      {p.codigo}
                      {p.cliente?.esPrueba && (
                        <span
                          className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 align-middle"
                          title="Préstamo de cliente de prueba: no se contabiliza en saldos reales"
                        >
                          PRUEBA
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{p.cliente.nombre}</div>
                      <div className="text-xs text-muted-foreground">{p.cliente.cedula}</div>
                    </TableCell>
                    <TableCell className="text-sm">{formatearMoneda(p.montoPrincipal)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{p.tasaInteresAnual}% anual</div>
                      <div className="text-xs text-muted-foreground">
                        {(p.tasaInteresAnual / 12).toFixed(4)}% mensual
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{formatearMoneda(p.montoCuota)}</TableCell>
                    <TableCell className="text-xs">
                      {p.numeroCuotas} cuotas
                      <div className="text-muted-foreground">{p.frecuencia.toLowerCase()}</div>
                    </TableCell>
                    {/* === CONTEO DE VIGENCIA + ESTADO DEL PLAZO === */}
                    {/* Calculamos `conteo` una sola vez y renderizamos ambas celdas. */}
                    {/* Para créditos CANCELADOS el conteo queda congelado en el valor */}
                    {/* alcanzado al momento de la cancelación (no sigue incrementándose). */}
                    {(() => {
                      const conteo = calcularConteoVigencia(p, nowTick)
                      if (!conteo.aplica) {
                        return (
                          <>
                            <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                          </>
                        )
                      }
                      // Mapear estado del plazo a etiqueta + emoji + clases de color
                      const cfgPlazo: Record<EstadoPlazo, { label: string; emoji: string; className: string }> = {
                        DENTRO: {
                          label: 'DENTRO DEL PLAZO',
                          emoji: '🟢',
                          className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
                        },
                        CUMPLIDO: {
                          label: 'PLAZO CUMPLIDO',
                          emoji: '🟡',
                          className: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
                        },
                        EXCEDIDO: {
                          label: `EXCEDIÓ EL PLAZO — ${conteo.diasExcedidos} DÍAS`,
                          emoji: '🔴',
                          className: 'bg-red-500/15 text-red-300 border-red-400/30',
                        },
                        CANCELADO: {
                          label: 'CANCELADO',
                          emoji: '🔵',
                          className: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
                        },
                        NO_APLICA: { label: '—', emoji: '', className: '' },
                      }
                      const c = cfgPlazo[conteo.estadoPlazo]
                      return (
                        <>
                          {/* Celda CONTEO: "DÍA TRANSCURRIDO / PLAZO TOTAL días" */}
                          <TableCell className="text-center">
                            <div className={`text-sm font-semibold ${conteo.congelado ? 'text-blue-400' : 'text-foreground'}`}>
                              {conteo.diasTranscurridos} / {conteo.plazoTotalDias}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {conteo.congelado ? 'días (congelado)' : 'días'}
                            </div>
                          </TableCell>
                          {/* Celda ESTADO DEL PLAZO: badge de estado con tooltip */}
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.className}`}
                              title={
                                conteo.congelado
                                  ? `Conteo congelado al cancelar el crédito. Último valor: ${conteo.diasTranscurridos}/${conteo.plazoTotalDias} días.`
                                  : `Inicio: ${conteo.fechaInicio.toLocaleDateString('es-CO')} · Corte: ${conteo.fechaCorte.toLocaleDateString('es-CO')}`
                              }
                            >
                              {c.emoji && <span>{c.emoji}</span>}
                              <span>{c.label}</span>
                            </span>
                          </TableCell>
                        </>
                      )
                    })()}
                    <TableCell className="text-sm font-semibold">{formatearMoneda(p.saldoTotal)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: `${(p.cuotasPagadas / p.numeroCuotas) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {p.cuotasPagadas}/{p.numeroCuotas}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={p.estado} />
                      {p.tieneCodeudor && (
                        <Badge variant="outline" className="ml-1 text-[10px] bg-violet-500/15 text-violet-300 border-violet-400/40">
                          🛡️ Codeudor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAbrirPrestamo(p.id)}
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-purple-600 hover:text-purple-700"
                          onClick={() => abrirHtmlImprimible(`/api/estado-cuenta?cedula=${encodeURIComponent(p.cliente.cedula)}&prestamoId=${p.id}`)}
                          title="Estado de cuenta"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {/* === Otros Síes — ver / descargar Otros Síes firmados === */}
                        {/* Dropdown con lazy-load: al abrir, hace fetch de los Otros Síes */}
                        {/* del préstamo y habilita Ver / Descargar para los FIRMADO. */}
                        <OtroSiAccionesDropdown
                          prestamoId={p.id}
                          prestamoCodigo={p.codigo}
                        />
                        {/* Reforzado: botón para ver certificado de firma electrónica.
                            Habilitado para descarga repetida — cuantas veces el gestor lo necesite.
                            Solo se deshabilita si NO existe ninguna firma completada. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className={p.firmaId ? "text-blue-600 hover:text-blue-700" : "text-muted-foreground opacity-40"}
                          onClick={() => {
                            if (!p.firmaId) return
                            // FIX 2026-08-12: El endpoint /api/firma/certificado está
                            // protegido por JWT. window.open() no envía el header
                            // Authorization, por lo que el endpoint devolvía 401 y el
                            // botón "Descargar Certificado de Firma Electrónica" no
                            // funcionaba. Usamos abrirHtmlImprimible que hace fetch
                            // autenticado (con Authorization: Bearer) y abre un blob
                            // URL en una nueva pestaña.
                            abrirHtmlImprimible(`/api/firma/certificado?firmaId=${p.firmaId}`)
                          }}
                          title={p.firmaId ? `Descargar Certificado de Firma Electrónica (descargable las veces que necesite)${p.firmaFechaCompleta ? ` · Firmado: ${new Date(p.firmaFechaCompleta).toLocaleDateString('es-CO')}` : ''}` : "Sin firma electrónica completada"}
                          disabled={!p.firmaId}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        {/* === ¿QUÉ CAMBIÓ? — Análisis de comportamiento de pagos === */}
                        {/* Solo se muestra para préstamos con pagos (ACTIVO/EN_MORA/JURIDICO/CANCELADO). */}
                        {/* Compara el comportamiento actual vs anterior y muestra los */}
                        {/* cambios detectados: pagos menores, atrasos, ritmo de pago, etc. */}
                        {['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO'].includes(p.estado) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-purple-600 hover:text-purple-700"
                            onClick={() => {
                              setPrestamoQueCambioId(p.id)
                              setPrestamoQueCambioCodigo(p.codigo)
                              setModalQueCambio(true)
                            }}
                            title="¿Qué cambió? — Analiza el comportamiento actual vs. anterior del crédito"
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                        )}
                        {p.estado === 'SOLICITUD' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/prestamos/${p.id}/enviar-codigo`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                  })
                                  const json = await res.json()
                                  if (json.success) {
                                    const codigos = json.data?.codigos || []
                                    const esDual = json.data?.requiereCodeudor
                                    const desc = esDual
                                      ? `Doble OTP: 1 al TITULAR (${codigos[0]?.email}) y 1 al CODEUDOR (${codigos[1]?.email}). El préstamo se activa solo cuando el gestor verifique AMBOS códigos.`
                                      : `Al correo ${codigos[0]?.email || json.data.email}. Revisa y pide el código al cliente.`
                                    toast({
                                      title: esDual ? '🔐 Doble código enviado' : '🔐 Código enviado',
                                      description: desc,
                                      duration: 9000,
                                    })
                                    if (json.whatsapp?.linkWaMe) {
                                      window.open(json.whatsapp.linkWaMe, '_blank', 'noopener,noreferrer')
                                    }
                                    cargar()
                                    onChanged()
                                  } else {
                                    toast({ title: 'Error', description: json.error, variant: 'destructive' })
                                  }
                                } catch (e: any) {
                                  toast({ title: 'Error', description: e.message, variant: 'destructive' })
                                }
                              }}
                              title="Enviar código de confirmación por correo"
                            >
                              📧
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => cambiarEstado(p.id, 'rechazar')}
                              title="Rechazar"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {/* === Botón ELIMINAR préstamo (siempre disponible) === */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:text-red-800 hover:bg-red-50"
                          onClick={() => eliminarPrestamo(p)}
                          title="Eliminar préstamo (borra TODO el registro)"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* === MODAL ELIMINAR PRÉSTAMO === */}
      <Dialog open={!!prestamoAEliminar} onOpenChange={(open) => !open && setPrestamoAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              Eliminar Préstamo
            </DialogTitle>
          </DialogHeader>
          {prestamoAEliminar && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-red-50 border border-red-200 text-sm space-y-1">
                <p className="text-red-900 font-semibold">⚠️ Esta acción NO se puede deshacer</p>
                <p className="text-red-800">
                  Se borrará permanentemente el préstamo y TODOS sus registros asociados:
                </p>
                <ul className="list-disc list-inside text-xs text-red-700 ml-2">
                  <li>Préstamo: <strong>{prestamoAEliminar.codigo}</strong></li>
                  <li>Cliente: <strong>{prestamoAEliminar.cliente.nombre}</strong></li>
                  <li>Estado: <strong>{prestamoAEliminar.estado}</strong></li>
                  <li>Monto: <strong>{formatearMoneda(prestamoAEliminar.montoPrincipal)}</strong></li>
                </ul>
              </div>
              <div className="p-3 rounded bg-muted/50 border text-xs space-y-1">
                <p className="font-semibold">Se eliminarán también:</p>
                <ul className="list-disc list-inside text-muted-foreground ml-2">
                  <li>Pagos registrados</li>
                  <li>Firmas electrónicas (con fotos y OTP)</li>
                  <li>Notificaciones enviadas</li>
                  <li>Documentos del gestor vinculados</li>
                  <li>Bitácora del préstamo</li>
                  <li>Caso jurídico (si existe)</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label>Motivo de la eliminación *</Label>
                <Textarea
                  value={motivoEliminacion}
                  onChange={(e) => setMotivoEliminacion(e.target.value)}
                  rows={3}
                  placeholder="Ej: Error en el monto, cliente equivocado, cuotas mal calculadas, duplicado..."
                  minLength={5}
                />
                <p className="text-xs text-muted-foreground">
                  Este motivo quedará registrado en el audit log inmutable del sistema.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPrestamoAEliminar(null)}
                  disabled={eliminandoPrestamo}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmarEliminarPrestamo}
                  disabled={eliminandoPrestamo || motivoEliminacion.trim().length < 5}
                >
                  {eliminandoPrestamo ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar definitivamente
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal nueva solicitud */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Préstamo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* === Tipo de solicitud: Nuevo o Renovación === */}
            <div className="space-y-2">
              <Label>Tipo de solicitud *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEsRenovacion(false)
                    setPrestamoARenovar('')
                    setSaldoPendienteRenovacion(0)
                    setInfoPrestamoRenovacion(null)
                  }}
                  className={`p-3 rounded-md border-2 text-left transition ${
                    !esRenovacion
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-700" />
                    Crédito Nuevo
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Solicitud de préstamo sin relación a créditos anteriores
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setEsRenovacion(true)}
                  className={`p-3 rounded-md border-2 text-left transition ${
                    esRenovacion
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-700" />
                    Renovación
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Trae el saldo pendiente de un crédito anterior
                  </div>
                </button>
              </div>
            </div>

            {/* === FECHA DEL PRÉSTAMO (fecha asignada) ===
                Permite registrar la fecha real en que se realizó el préstamo.
                Todos los documentos generados (pagaré, carta, tabla de amortización)
                usarán esta fecha como fecha base.
                Ej: si el préstamo se hizo el 2/08/2026 y se carga el 5/08/2026,
                todos los documentos empezarán desde el 2/08/2026. */}
            <div className="space-y-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/60 border-2 border-emerald-300 dark:border-emerald-500 shadow-sm">
              <Label htmlFor="fechaPrestamo" className="text-sm font-semibold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-100">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                Fecha del préstamo *
              </Label>
              <Input
                id="fechaPrestamo"
                type="date"
                value={fechaPrestamo}
                onChange={(e) => setFechaPrestamo(e.target.value)}
                required
                max={(() => {
                  const hoy = new Date()
                  const yyyy = hoy.getFullYear()
                  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
                  const dd = String(hoy.getDate()).padStart(2, '0')
                  return `${yyyy}-${mm}-${dd}`
                })()}
              />
              <p className="text-xs text-emerald-900 dark:text-emerald-100 font-medium">
                📅 Esta será la fecha base del préstamo. Todos los documentos generados (pagaré, carta, tabla de amortización) y el código del préstamo usarán esta fecha, no la fecha actual del sistema.
              </p>
              {fechaPrestamo !== (() => {
                const hoy = new Date()
                const yyyy = hoy.getFullYear()
                const mm = String(hoy.getMonth() + 1).padStart(2, '0')
                const dd = String(hoy.getDate()).padStart(2, '0')
                return `${yyyy}-${mm}-${dd}`
              })() && (
                <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold bg-amber-100 dark:bg-amber-900/60 p-2 rounded border border-amber-300 dark:border-amber-700">
                  ⚠️ Estás registrando un préstamo con fecha retroactiva ({fechaPrestamo}). Verifica que sea correcto.
                </p>
              )}
            </div>

            {/* === PERIODO DE CORTE + DÍAS CAUSADOS ANTES DEL CORTE ===
                Caso de uso: cliente solicita crédito ANTES de la fecha de corte.
                Ej: préstamo 2/08/2026, periodo "5-20" → corte más cercano = 5/08/2026.
                El sistema cobra 3 días de interés anticipado (valorDiasCausados) y
                las cuotas se programan desde el 5/08/2026 (fechaPrimerCorte).

                Si no se selecciona periodo, el préstamo se comporta normalmente
                (las cuotas se programan desde fechaPrestamo).
            */}
            <div className="space-y-3 p-3 rounded-md bg-indigo-50 dark:bg-indigo-900/60 border-2 border-indigo-300 dark:border-indigo-500 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-100">
                  <Scissors className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />
                  Periodo de corte (opcional)
                </Label>
                {periodoCorte && (
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodoCorte('')
                      setFechaPrimerCorte(null)
                      setDiasCausadosAntes(0)
                      setValorDiasCausados(0)
                      setEditarDiasCausadosManual(false)
                    }}
                    className="text-xs text-indigo-800 dark:text-indigo-200 hover:underline font-medium"
                  >
                    Quitar corte
                  </button>
                )}
              </div>
              <Select value={periodoCorte} onValueChange={(v) => {
                setPeriodoCorte(v === 'NINGUNO' ? '' : v)
                // Reset modo manual al cambiar periodo (forzar recálculo)
                setEditarDiasCausadosManual(false)
                if (v === 'NINGUNO') {
                  setFechaPrimerCorte(null)
                  setDiasCausadosAntes(0)
                  setValorDiasCausados(0)
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin periodo de corte (las cuotas inician en fechaPrestamo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NINGUNO">Sin periodo de corte</SelectItem>
                  <SelectItem value="5-20">📅 Periodo 5-20 (cortes los días 5 y 20 de cada mes)</SelectItem>
                  <SelectItem value="15-30">📅 Periodo 15-30 (cortes los días 15 y 30 de cada mes)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-indigo-900 dark:text-indigo-100 font-medium">
                💡 Para clientes que solicitan crédito <strong className="text-indigo-950 dark:text-white">antes</strong> de la fecha de corte.
                El sistema calcula automáticamente los días causados hasta el corte más cercano y
                programa los pagos desde esa fecha de corte.
              </p>

              {/* === Bloque de cálculo automático === */}
              {periodoCorte && fechaPrestamo && (
                <div className="space-y-3 p-4 rounded-md bg-white dark:bg-slate-900/90 border-2 border-indigo-400 dark:border-indigo-400 shadow-md">
                  {/* Resumen automático */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1 p-2 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800">
                      <div className="text-indigo-900 dark:text-indigo-200 font-semibold flex items-center gap-1">
                        📅 Fecha del préstamo
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {formatearFecha(new Date(fechaPrestamo + 'T12:00:00'))}
                      </div>
                    </div>
                    <div className="space-y-1 p-2 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800">
                      <div className="text-indigo-900 dark:text-indigo-200 font-semibold flex items-center gap-1">
                        🎯 Fecha del primer corte
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {fechaPrimerCorte ? formatearFecha(fechaPrimerCorte) : '—'}
                      </div>
                    </div>
                    <div className="space-y-1 p-2 rounded bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800">
                      <div className="text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-1">
                        ⏳ Días causados antes del corte
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  {fechaPrimerCorte && (
                    <div className="text-xs text-indigo-950 dark:text-indigo-50 bg-indigo-100 dark:bg-indigo-800 rounded p-2.5 border border-indigo-300 dark:border-indigo-600 font-medium">
                      {diasCausadosAntes > 0 ? (
                        <>
                          📊 El préstamo se entrega el{' '}
                          <strong className="text-indigo-950 dark:text-white">{formatearFecha(new Date(fechaPrestamo + 'T12:00:00'))}</strong>{' '}
                          pero el corte más cercano es el{' '}
                          <strong className="text-indigo-950 dark:text-white">{formatearFecha(fechaPrimerCorte)}</strong>. El sistema cobrará{' '}
                          <strong className="text-indigo-950 dark:text-white">{diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'}</strong>{' '}
                          de interés anticipado y las cuotas se programarán desde el{' '}
                          <strong className="text-indigo-950 dark:text-white">{formatearFecha(fechaPrimerCorte)}</strong>.
                        </>
                      ) : (
                        <>
                          ✅ La fecha del préstamo cae <strong className="text-indigo-950 dark:text-white">justo en un día de corte</strong>{' '}
                          ({formatearFecha(fechaPrimerCorte)}). No hay días causados adicionales y
                          las cuotas se programarán desde esta fecha.
                        </>
                      )}
                    </div>
                  )}

                  {/* === Campos editables: días causados y valor a cobrar === */}
                  {diasCausadosAntes > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t-2 border-indigo-200 dark:border-indigo-700">
                      <div className="space-y-1.5">
                        <Label htmlFor="diasCausadosAntes" className="text-xs font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                          Días causados antes del corte
                          {editarDiasCausadosManual && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-950 font-bold">
                              ✏️ Manual
                            </span>
                          )}
                        </Label>
                        <Input
                          id="diasCausadosAntes"
                          type="number"
                          min="0"
                          value={diasCausadosAntes}
                          onChange={(e) => {
                            handleEditarDiasCausados()
                            setDiasCausadosAntes(parseInt(e.target.value) || 0)
                          }}
                          className="bg-white dark:bg-slate-800 dark:text-white border-indigo-300 dark:border-indigo-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="valorDiasCausados" className="text-xs font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                          Valor a cobrar por días causados (COP)
                          {editarDiasCausadosManual && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-950 font-bold">
                              ✏️ Manual
                            </span>
                          )}
                        </Label>
                        <Input
                          id="valorDiasCausados"
                          type="number"
                          step="0.01"
                          min="0"
                          value={valorDiasCausados}
                          onChange={(e) => {
                            handleEditarDiasCausados()
                            setValorDiasCausados(parseFloat(e.target.value) || 0)
                          }}
                          className="bg-white dark:bg-slate-800 dark:text-white border-indigo-300 dark:border-indigo-600"
                        />
                      </div>
                      {editarDiasCausadosManual && (
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={handleRecalcularDiasCausados}
                            className="text-xs px-3 py-1.5 rounded-md bg-indigo-200 text-indigo-900 hover:bg-indigo-300 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-500 transition flex items-center gap-1.5 font-medium"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Recalcular automáticamente
                          </button>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 font-medium">
                            ⚠️ Estás usando valores editados manualmente. Si cambian el monto o la tasa,
                            no se recalcularán hasta que presiones este botón.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === Aviso de cobro adicional === */}
                  {valorDiasCausados > 0 && (
                    <div className="p-2.5 rounded-md bg-emerald-100 dark:bg-emerald-700/80 border-2 border-emerald-400 dark:border-emerald-400 text-xs text-emerald-950 dark:text-emerald-50 font-medium">
                      💰 Se cobrarán <strong>{formatearMoneda(valorDiasCausados)}</strong> adicionales
                      por {diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'} de interés anticipado.
                      Este valor se suma al total a pagar del préstamo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* === FONDO DE GARANTÍA (opcional, tasa configurable) ===
                El gestor decide si el crédito lleva o no fondo de garantía.
                Ya NO se activa automáticamente. Si se activa, se pregunta la tasa.
                El monto se calcula como: montoPrincipal * (tasa / 100). */}
            <div className="space-y-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/60 border-2 border-blue-300 dark:border-blue-500 shadow-sm">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-blue-900 dark:text-blue-100">
                <Shield className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                Fondo de Garantía (opcional)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="incluirFondoGarantia"
                  type="checkbox"
                  checked={incluirFondoGarantia}
                  onChange={(e) => setIncluirFondoGarantia(e.target.checked)}
                  className="w-4 h-4 rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="incluirFondoGarantia" className="text-xs font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
                  Este crédito lleva fondo de garantía
                </Label>
              </div>
              {incluirFondoGarantia && (
                <div className="space-y-1.5 pl-7">
                  <Label htmlFor="tasaFondoGarantia" className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Tasa del fondo de garantía (%)
                  </Label>
                  <Input
                    id="tasaFondoGarantia"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tasaFondoGarantia}
                    onChange={(e) => setTasaFondoGarantia(parseFloat(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-800 dark:text-white border-blue-300 dark:border-blue-600"
                  />
                  <p className="text-[11px] text-blue-900 dark:text-blue-200 font-medium bg-blue-100 dark:bg-blue-800/80 p-2 rounded border border-blue-300 dark:border-blue-600">
                    💡 Se cobrarán <strong className="text-blue-950 dark:text-white">{formatearMoneda((parseFloat(montoPrincipal) || 0) * (tasaFondoGarantia / 100))}</strong> adicionales
                    por concepto de fondo de garantía ({tasaFondoGarantia}% del monto principal).
                    Este valor se suma al total a pagar del préstamo.
                  </p>
                </div>
              )}
              {!incluirFondoGarantia && (
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                  No se cobrará fondo de garantía en este crédito.
                </p>
              )}
            </div>

            {/* === Si es renovación, mostrar créditos ACTIVOS del cliente === */}
            {esRenovacion && clienteId && (
              <div className="space-y-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Selecciona el crédito activo a renovar
                  </Label>
                  <Select value={prestamoARenovar} onValueChange={seleccionarPrestamoARenovar}>
                    <SelectTrigger className="border-amber-400 dark:border-amber-600">
                      <SelectValue placeholder="Selecciona el crédito activo del cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {prestamos
                        .filter((p) =>
                          p.cliente?.id === clienteId &&
                          ['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(p.estado)
                        )
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} · {formatearMoneda(p.montoPrincipal)} · {p.cuotasPagadas}/{p.numeroCuotas} cuotas · Saldo: {formatearMoneda(p.saldoTotal)} · {p.estado === 'ACTIVO' ? '✅ Activo' : p.estado === 'EN_MORA' ? '⚠️ En mora' : '⚖️ Jurídico'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300">
                    💡 Solo se muestran créditos en estado ACTIVO, EN_MORA o JURIDICO (renovables). Al seleccionar uno, el formulario se auto-rellenará con sus condiciones para que las modifiques.
                  </p>
                </div>

                {/* === Info del préstamo a renovar + condiciones originales === */}
                {infoPrestamoRenovacion && (
                  <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-600 text-xs space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        📋 Crédito a renovar: {infoPrestamoRenovacion.codigo}
                      </p>
                      <button
                        type="button"
                        onClick={restablecerCondicionesOriginales}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 border border-amber-400 dark:border-amber-600 transition-colors"
                        title="Volver a cargar las condiciones originales del crédito en el formulario"
                      >
                        🔄 Restablecer condiciones originales
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-amber-900 dark:text-amber-100">
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Capital original:</span>{' '}
                        <strong>{formatearMoneda(infoPrestamoRenovacion.montoPrincipal)}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Cuota:</span>{' '}
                        <strong>{formatearMoneda(infoPrestamoRenovacion.montoCuota)}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Cuotas pagadas:</span>{' '}
                        <strong>{infoPrestamoRenovacion.cuotasPagadas}/{infoPrestamoRenovacion.numeroCuotas}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Saldo pendiente:</span>{' '}
                        <strong className="text-base">{formatearMoneda(infoPrestamoRenovacion.saldoTotal)}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Modalidad:</span>{' '}
                        <strong>{infoPrestamoRenovacion.modalidadAmortizacion}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Frecuencia:</span>{' '}
                        <strong>{infoPrestamoRenovacion.frecuencia}</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Tasa anual:</span>{' '}
                        <strong>{infoPrestamoRenovacion.tasaInteresAnual?.toFixed(2)}%</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Tasa mensual:</span>{' '}
                        <strong>{infoPrestamoRenovacion.tasaInteresMensual?.toFixed(4)}%</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Tasa moratoria diaria:</span>{' '}
                        <strong>{infoPrestamoRenovacion.tasaMoraDiaria}%</strong>
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300">Plazo:</span>{' '}
                        <strong>{infoPrestamoRenovacion.plazoMeses} meses</strong>
                      </div>
                    </div>

                    {/* === Banner: condiciones cargadas automáticamente === */}
                    <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200">
                      <p className="font-medium">
                        ✅ Condiciones cargadas automáticamente en el formulario
                      </p>
                      <p className="mt-0.5 text-[10px]">
                        Modifica los campos que necesites cambiar (tasa, monto, cuotas, frecuencia, etc.). Los campos sin modificar conservarán los valores originales del crédito.
                      </p>
                    </div>

                    {/* === Resumen de cambios detectados === */}
                    {(() => {
                      const cambios = detectarCambios()
                      if (cambios.length === 0) {
                        return (
                          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <p className="font-medium">📋 Sin cambios detectados</p>
                            <p className="mt-0.5 text-[10px]">Las condiciones del formulario coinciden con el crédito original.</p>
                          </div>
                        )
                      }
                      return (
                        <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100">
                          <p className="font-medium">
                            ✏️ {cambios.length} cambio(s) detectado(s) vs el crédito original:
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {cambios.map((c, i) => (
                              <div key={i} className="flex justify-between gap-2 text-[10px]">
                                <span className="text-blue-700 dark:text-blue-300">{c.campo}:</span>
                                <span className="line-through text-red-600 dark:text-red-400">{c.original}</span>
                                <span className="text-blue-500">→</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{c.actual}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    <div className="pt-2 border-t border-amber-300 dark:border-amber-700">
                      <p className="text-amber-800 dark:text-amber-200">
                        💡 Al crear la nueva solicitud:
                      </p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800 dark:text-amber-200">
                        <li>El crédito anterior se <strong>cierra</strong> (estado: CANCELADO, saldos en 0)</li>
                        <li>El nuevo préstamo se crea por el <strong>capital que ingreses</strong></li>
                        <li>El saldo anterior se descuenta del nuevo capital</li>
                        <li>Si el capital nuevo &gt; saldo anterior → entregas el <strong>excedente</strong> en efectivo</li>
                        <li>Si el capital nuevo &lt; saldo anterior → cliente abona la <strong>diferencia</strong></li>
                      </ul>
                    </div>
                  </div>
                )}

                {!clienteId && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ Selecciona primero un cliente para ver sus créditos activos
                  </p>
                )}
                {clienteId && prestamos.filter((p) =>
                  p.cliente?.id === clienteId &&
                  ['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(p.estado)
                ).length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ℹ️ Este cliente no tiene créditos activos (ACTIVO / EN_MORA / JURIDICO) para renovar
                  </p>
                )}
              </div>
            )}

            {/* === Resumen del monto total con renovación === */}
            {esRenovacion && saldoPendienteRenovacion > 0 && montoPrincipal && (
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs space-y-2">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  💰 Cálculo de la renovación:
                </p>
                <div className="space-y-1 text-blue-900 dark:text-blue-100">
                  <div className="flex justify-between">
                    <span>Capital nuevo solicitado:</span>
                    <strong>{formatearMoneda(parseFloat(montoPrincipal) || 0)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>(−) Saldo pendiente del crédito anterior:</span>
                    <strong>{formatearMoneda(saldoPendienteRenovacion)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-300 dark:border-blue-700 text-emerald-700 dark:text-emerald-300">
                    <span>= Excedente a entregar al cliente (efectivo):</span>
                    <strong className="text-base">
                      {formatearMoneda(Math.max(0, (parseFloat(montoPrincipal) || 0) - saldoPendienteRenovacion))}
                    </strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                  <p>📋 El nuevo préstamo se creará por <strong>{formatearMoneda(parseFloat(montoPrincipal) || 0)}</strong> de capital.</p>
                  <p>💸 El crédito anterior se cierra y el cliente recibe <strong>{formatearMoneda(Math.max(0, (parseFloat(montoPrincipal) || 0) - saldoPendienteRenovacion))}</strong> en efectivo.</p>
                  {(parseFloat(montoPrincipal) || 0) < saldoPendienteRenovacion && (
                    <p className="text-amber-700 dark:text-amber-300 font-medium mt-1">
                      ⚠️ El capital nuevo ({formatearMoneda(parseFloat(montoPrincipal) || 0)}) es menor al saldo pendiente ({formatearMoneda(saldoPendienteRenovacion)}). 
                      El cliente debe abonar la diferencia de {formatearMoneda(saldoPendienteRenovacion - (parseFloat(montoPrincipal) || 0))}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Selección de categoría */}
            <div className="space-y-2">
              <Label>Categoría del cliente (pre-carga tasas)</Label>
              <Select value={categoriaId} onValueChange={seleccionarCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre} - {c.tasaInteresAnual}% anual
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              <Select value={clienteId} onValueChange={seleccionarCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} - {c.cedula} - {c.telefono}
                      {c.tieneTasaPersonalizada && c.tasaPersonalizada != null
                        ? ` · tasa ${c.tasaPersonalizada}% mensual`
                        : ' · sin tasa asignada'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* === PREGUNTA DE TASA — solo si el cliente tiene tasa personalizada === */}
            {clienteId && clienteTieneTasaPers && clienteTasaPersValor != null && (
              <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-md bg-violet-500/20 shrink-0">
                    <svg className="w-4 h-4 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-violet-200">
                      Tasa personalizada detectada en el cliente
                    </p>
                    <p className="text-xs text-violet-100/80 mt-0.5">
                      El cliente tiene asignada una tasa de{' '}
                      <strong className="text-violet-100">{clienteTasaPersValor}% mensual</strong>{' '}
                      en su ficha (módulo Clientes). ¿Qué tasa usar para esta solicitud?
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionTasa('CLIENTE')
                      // Cargar la tasa del cliente en los campos
                      setTasaMensualPersonalizada(String(clienteTasaPersValor))
                      setTasaInteresAnual(String((clienteTasaPersValor * 12).toFixed(2)))
                      toast({
                        title: 'Tasa del cliente aplicada',
                        description: `Tasa mensual fija: ${clienteTasaPersValor}% · Anual: ${(clienteTasaPersValor * 12).toFixed(2)}%`,
                      })
                    }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-md border-2 text-left transition-all ${
                      decisionTasa === 'CLIENTE'
                        ? 'border-violet-500 bg-violet-500/20'
                        : 'border-border hover:border-violet-400/60 bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 ${decisionTasa === 'CLIENTE' ? 'border-violet-400 bg-violet-400' : 'border-muted-foreground'}`} />
                      <span className="text-sm font-semibold">Usar tasa del cliente</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-5">
                      {clienteTasaPersValor}% mensual · {(clienteTasaPersValor * 12).toFixed(2)}% anual
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDecisionTasa('NUEVA')
                      toast({
                        title: 'Asignar nueva tasa',
                        description: 'Edita manualmente los campos de tasa abajo.',
                      })
                    }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-md border-2 text-left transition-all ${
                      decisionTasa === 'NUEVA'
                        ? 'border-amber-500 bg-amber-500/20'
                        : 'border-border hover:border-amber-400/60 bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 ${decisionTasa === 'NUEVA' ? 'border-amber-400 bg-amber-400' : 'border-muted-foreground'}`} />
                      <span className="text-sm font-semibold">Asignar tasa nueva</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-5">
                      Definir manualmente (ignora la del cliente)
                    </span>
                  </button>
                </div>

                {decisionTasa === 'CLIENTE' && (
                  <div className="text-[11px] text-violet-200/80 flex items-center gap-1.5 pt-1 border-t border-violet-500/20">
                    ✓ La tasa del cliente se cargó en los campos. Puedes editarla si lo necesitas.
                  </div>
                )}
                {decisionTasa === 'NUEVA' && (
                  <div className="text-[11px] text-amber-200/80 flex items-center gap-1.5 pt-1 border-t border-amber-500/20">
                    ⚠ Define la tasa manualmente en los campos de abajo. Esta solicitud no usará la tasa del cliente.
                  </div>
                )}
              </div>
            )}

            {/* Aviso si el cliente NO tiene tasa personalizada */}
            {clienteId && !clienteTieneTasaPers && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  Este cliente <strong>no tiene tasa personalizada</strong> en su ficha.
                  Se usará la tasa que definas abajo (categoría o manual).
                  Para asignarle una tasa fija permanente, edítalo en el módulo <strong>Préstamos → Clientes</strong>.
                </span>
              </div>
            )}

            {/* Selección de modalidad */}
            <div className="space-y-2">
              <Label>Modalidad del Crédito *</Label>
              <Select value={modalidad} onValueChange={(v) => setModalidad(v as 'FRANCES' | 'TASA_FIJA' | 'CUOTA_PERSONALIZADA')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRANCES">📊 Sistema Francés (tasa anual, cuota calculada automáticamente)</SelectItem>
                  <SelectItem value="TASA_FIJA">💰 Tasa Fija Mensual (tasa mensual sobre capital inicial)</SelectItem>
                  <SelectItem value="CUOTA_PERSONALIZADA">✏️ Cuota Personalizada / Checa (tú defines la cuota y la tasa mensual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="montoPrincipal">Monto Principal (COP) *</Label>
                <Input
                  id="montoPrincipal"
                  type="number"
                  step="0.01"
                  value={montoPrincipal}
                  onChange={(e) => setMontoPrincipal(e.target.value)}
                  required
                  placeholder="1000000"
                />
              </div>

              {/* Campos según modalidad */}
              {modalidad === 'FRANCES' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tasaInteresAnual">Tasa de Interés Anual (%) *</Label>
                    <Input
                      id="tasaInteresAnual"
                      type="number"
                      step="0.01"
                      value={tasaInteresAnual}
                      onChange={(e) => setTasaInteresAnual(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Fija sobre capital inicial, no varía.
                      </p>
                      <p className="text-blue-700 font-medium">
                        ≡ Mensual: <strong>{(parseFloat(tasaInteresAnual) / 12 || 0).toFixed(4)}%</strong>
                      </p>
                      <p className="text-blue-700 font-medium">
                        ≡ Diaria: <strong>{(parseFloat(tasaInteresAnual) / 365 || 0).toFixed(5)}%</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tasaMoraAnual">Tasa Moratoria Diaria (%) *</Label>
                    <Input
                      id="tasaMoraAnual"
                      type="number"
                      step="0.0001"
                      value={tasaMoraAnual}
                      onChange={(e) => setTasaMoraAnual(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Mora <strong>compuesta diaria</strong> sobre el <strong>capital inicial prestado</strong>.
                        Ej: <strong>1 = 1% diario</strong>. Cada día de atraso se calcula sobre
                        capital + mora acumulada del día anterior.
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Mensual: <strong>{((parseFloat(tasaMoraAnual) || 0) * 30).toFixed(4)}%</strong>
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Anual: <strong>{((parseFloat(tasaMoraAnual) || 0) * 360).toFixed(4)}%</strong>
                      </p>
                    </div>
                    {montoPrincipal && tasaMoraAnual && (
                      <p className="text-xs text-muted-foreground">
                        Mora por día de atraso (sobre capital inicial):{' '}
                        <strong className="text-amber-700">
                          {formatearMoneda(
                            (parseFloat(montoPrincipal) || 0) * (parseFloat(tasaMoraAnual) || 0) / 100
                          )}
                        </strong>
                      </p>
                    )}
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
                      <strong>Fórmula compuesta diaria:</strong> M = S × [(1 + r)^d − 1]<br/>
                      <strong>S</strong> = capital inicial prestado · <strong>r</strong> = tasa diaria (ej: 0.01) ·{' '}
                      <strong>d</strong> = días de mora
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plazoMeses">Plazo (meses) *</Label>
                    <Input
                      id="plazoMeses"
                      type="number"
                      value={plazoMeses}
                      onChange={(e) => setPlazoMeses(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : modalidad === 'TASA_FIJA' ? (
                <>
                  {/* Modalidad Tasa Fija Mensual (sobre capital inicial) */}
                  <div className="space-y-2">
                    <Label htmlFor="tasaMensualFija">Tasa Mensual (%) *</Label>
                    <Input
                      id="tasaMensualFija"
                      type="number"
                      step="0.01"
                      value={tasaMensualFija}
                      onChange={(e) => setTasaMensualFija(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Ej: 15 = 15% mensual. Interés fijo sobre capital inicial (por mes de duración).
                      </p>
                      <p className="text-emerald-700 font-medium">
                        ≡ Anual: <strong>{((parseFloat(tasaMensualFija) || 0) * 12).toFixed(2)}%</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tasaMoraAnualFija">Tasa Moratoria Diaria (%) *</Label>
                    <Input
                      id="tasaMoraAnualFija"
                      type="number"
                      step="0.0001"
                      value={tasaMoraAnual}
                      onChange={(e) => setTasaMoraAnual(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Mora compuesta diaria sobre capital inicial. Ej: 1 = 1% diario.
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Mensual: <strong>{((parseFloat(tasaMoraAnual) || 0) * 30).toFixed(4)}%</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numeroCuotasFija">Número de Cuotas *</Label>
                    <Input
                      id="numeroCuotasFija"
                      type="number"
                      min="1"
                      value={numeroCuotasFija}
                      onChange={(e) => setNumeroCuotasFija(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Total de cuotas a pagar (la duración en meses se calcula según la frecuencia).
                      </p>
                      {(() => {
                        const nCuotas = parseInt(numeroCuotasFija) || 0
                        let meses = 1
                        if (frecuencia === 'MENSUAL') meses = nCuotas
                        else if (frecuencia === 'QUINCENAL') meses = Math.max(1, Math.ceil(nCuotas / 2))
                        else if (frecuencia === 'SEMANAL') meses = Math.max(1, Math.ceil(nCuotas / 4))
                        return (
                          <p className="text-blue-700 font-medium">
                            ≡ Duración: <strong>{meses} mes(es)</strong>
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Modalidad Cuota Personalizada / Checa */}
                  <div className="space-y-2">
                    <Label htmlFor="tasaMensual">Tasa Mensual (%) *</Label>
                    <Input
                      id="tasaMensual"
                      type="number"
                      step="0.01"
                      value={tasaMensualPersonalizada}
                      onChange={(e) => setTasaMensualPersonalizada(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Ej: 20 = 20% mensual. Interés fijo sobre capital inicial.
                      </p>
                      <p className="text-blue-700 font-medium">
                        ≡ Anual: <strong>{((parseFloat(tasaMensualPersonalizada) || 0) * 12).toFixed(2)}%</strong>
                      </p>
                      <p className="text-blue-700 font-medium">
                        ≡ Diaria: <strong>{((parseFloat(tasaMensualPersonalizada) || 0) / 30).toFixed(5)}%</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nCuotasPers">Número de Cuotas *</Label>
                    <Input
                      id="nCuotasPers"
                      type="number"
                      min="1"
                      value={numeroCuotasPersonalizada}
                      onChange={(e) => setNumeroCuotasPersonalizada(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Ej: 2 (mensual) = 2 meses. Si es quincenal, 4 cuotas = 2 meses (interés mensual dividido en 2).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="montoCuotaPers">Cuota Fija (COP) *</Label>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {cuotaAutoCalculada ? '🔒 Auto' : '✏️ Manual'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCuotaAutoCalculada(!cuotaAutoCalculada)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                            cuotaAutoCalculada
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {cuotaAutoCalculada ? 'Editar manual' : 'Recalcular auto'}
                        </button>
                      </div>
                    </div>
                    <Input
                      id="montoCuotaPers"
                      type="number"
                      step="0.01"
                      value={montoCuotaPersonalizada}
                      onChange={(e) => {
                        setMontoCuotaPersonalizada(e.target.value)
                        // Si el usuario edita manualmente, pasamos a modo manual
                        if (cuotaAutoCalculada) setCuotaAutoCalculada(false)
                      }}
                      required
                      placeholder={cuotaAutoCalculada ? 'Se calcula automáticamente...' : 'Ej: 210000'}
                      className={cuotaAutoCalculada ? 'bg-blue-50/50 border-blue-200' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      {cuotaAutoCalculada ? (
                        <>
                          Calculada automáticamente:{' '}
                          <strong>capital/n° cuotas</strong> +{' '}
                          <strong>interés por cuota</strong>. Edita el valor si necesitas ajustarlo.
                        </>
                      ) : (
                        <>
                          Valor editado manualmente. El sistema respetará la cuota que indiques.
                        </>
                      )}
                    </p>
                    {/* Desglose del cálculo automático */}
                    {cuotaAutoCalculada && montoPrincipal && tasaMensualPersonalizada && numeroCuotasPersonalizada && (
                      <div className="text-xs p-2 rounded bg-blue-50/50 border border-blue-100 text-blue-900">
                        <div>Capital por cuota: <strong>{formatearMoneda((parseFloat(montoPrincipal) || 0) / (parseInt(numeroCuotasPersonalizada) || 1))}</strong></div>
                        <div>
                          Interés por cuota:{' '}
                          <strong>
                            {formatearMoneda(
                              (() => {
                                const monto = parseFloat(montoPrincipal) || 0
                                const tasaMen = parseFloat(tasaMensualPersonalizada) || 0
                                const cuotasPorMes = frecuencia === 'MENSUAL' ? 1 : frecuencia === 'QUINCENAL' ? 2 : 4
                                return (monto * tasaMen / 100) / cuotasPorMes
                              })()
                            )}
                          </strong>
                        </div>
                        <div className="mt-1 pt-1 border-t border-blue-200">
                          Cuota total = <strong>{formatearMoneda(parseFloat(montoCuotaPersonalizada) || 0)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tasaMoraPers">Tasa Moratoria Diaria (%) *</Label>
                    <Input
                      id="tasaMoraPers"
                      type="number"
                      step="0.0001"
                      value={tasaMoraAnual}
                      onChange={(e) => setTasaMoraAnual(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Mora compuesta diaria. Ej: 1 = 1% diario sobre capital inicial.
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Mensual: <strong>{((parseFloat(tasaMoraAnual) || 0) * 30).toFixed(4)}%</strong>
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Anual: <strong>{((parseFloat(tasaMoraAnual) || 0) * 365).toFixed(4)}%</strong>
                      </p>
                    </div>
                    {montoPrincipal && tasaMoraAnual && (
                      <p className="text-xs text-muted-foreground">
                        Mora por día de atraso:{' '}
                        <strong className="text-amber-700">
                          {formatearMoneda(
                            (parseFloat(montoPrincipal) || 0) * (parseFloat(tasaMoraAnual) || 0) / 100
                          )}
                        </strong>
                      </p>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="frecuencia">Frecuencia de Pagos *</Label>
                <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as Frecuencia)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSUAL">Mensual</SelectItem>
                    <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                    <SelectItem value="SEMANAL">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cálculo en tiempo real */}
            {calculo && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  📊 Resumen del Crédito
                  {modalidad === 'CUOTA_PERSONALIZADA' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      Cuota Personalizada / Checa
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">N° Cuotas</div>
                    <div className="font-bold">{calculo.numeroCuotas}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Cuota Fija</div>
                    <div className="font-bold">{formatearMoneda(calculo.montoCuota)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Interés</div>
                    <div className="font-bold text-amber-700">{formatearMoneda(calculo.totalInteres)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total a Pagar</div>
                    <div className="font-bold text-primary">{formatearMoneda(calculo.totalPagar)}</div>
                  </div>
                </div>
                {modalidad === 'CUOTA_PERSONALIZADA' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mt-2 pt-2 border-t border-primary/20">
                    <div>
                      <span className="text-muted-foreground">Tasa mensual:</span>{' '}
                      <strong className="text-purple-700">{(calculo as any).tasaMensual}%</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tasa anual:</span>{' '}
                      <strong>{(calculo as any).tasaAnual}%</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Interés por cuota:</span>{' '}
                      <strong>{formatearMoneda(calculo.totalInteres / calculo.numeroCuotas)}</strong>
                    </div>
                  </div>
                )}

                {/* Tasas aplicables (todas las modalidades) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t border-primary/20">
                  {modalidad === 'FRANCES' ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">Interés anual:</span>{' '}
                        <strong className="text-blue-700">{parseFloat(tasaInteresAnual) || 0}%</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interés mensual:</span>{' '}
                        <strong className="text-blue-700">
                          {((parseFloat(tasaInteresAnual) || 0) / 12).toFixed(4)}%
                        </strong>
                      </div>
                    </>
                  ) : modalidad === 'TASA_FIJA' ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">Interés mensual:</span>{' '}
                        <strong className="text-emerald-700">
                          {parseFloat(tasaMensualFija) || 0}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interés anual:</span>{' '}
                        <strong className="text-emerald-700">
                          {((parseFloat(tasaMensualFija) || 0) * 12).toFixed(2)}%
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-muted-foreground">Interés mensual:</span>{' '}
                        <strong className="text-purple-700">
                          {parseFloat(tasaMensualPersonalizada) || 0}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interés anual:</span>{' '}
                        <strong className="text-purple-700">
                          {((parseFloat(tasaMensualPersonalizada) || 0) * 12).toFixed(2)}%
                        </strong>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-muted-foreground">Mora diaria:</span>{' '}
                    <strong className="text-amber-700">
                      {parseFloat(tasaMoraAnual) || 0}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mora mensual:</span>{' '}
                    <strong className="text-amber-700">
                      {((parseFloat(tasaMoraAnual) || 0) * 30).toFixed(4)}%
                    </strong>
                  </div>
                </div>
                {calculo.fondoGarantia > 0 && (
                  <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold bg-blue-50 dark:bg-blue-900/60 p-2 rounded border border-blue-200 dark:border-blue-700">
                    🛡️ Fondo de Garantía ({tasaFondoGarantia}%): {formatearMoneda(calculo.fondoGarantia)}
                  </p>
                )}

                {/* === Bloque de periodo de corte (solo si está activo) === */}
                {(calculo as any).valorDiasCausados != null && (calculo as any).valorDiasCausados > 0 && (
                  <div className="mt-2 pt-2 border-t border-primary/20 space-y-1.5">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5" />
                      Periodo de corte: {periodoCorte}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Días causados:</span>{' '}
                        <strong className="text-indigo-700 dark:text-indigo-300">
                          {(calculo as any).diasCausadosAntes} día{(calculo as any).diasCausadosAntes === 1 ? '' : 's'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor días causados:</span>{' '}
                        <strong className="text-indigo-700 dark:text-indigo-300">
                          {formatearMoneda((calculo as any).valorDiasCausados)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Inicia pagos:</span>{' '}
                        <strong className="text-indigo-700 dark:text-indigo-300">
                          {(calculo as any).fechaPrimerCorte
                            ? formatearFecha((calculo as any).fechaPrimerCorte)
                            : '—'}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      💡 Las cuotas se programan desde la fecha de corte. El valor de los días causados
                      se suma al total a pagar (no afecta el valor de la cuota).
                    </p>
                  </div>
                )}

                {/* === Bloque de Flexibilidad Financiera (solo si está activa) === */}
                {flexibilidadFinanciera && cuotasActuales >= 4 && (
                  <div className="mt-2 pt-2 border-t border-primary/20 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Flexibilidad Financiera: ADQUIRIDA ({flexibilidadModalidad})
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Costo adicional:</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {formatearMoneda(flexibilidadCosto)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Usos disponibles:</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {flexibilidadModalidad === 'PREMIUM' ? '2 veces' : '1 vez'} durante la vigencia
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Modalidad:</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {flexibilidadModalidad === 'PREMIUM' ? 'Premium ($34.900)' : 'Básica ($15.000)'}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      ✨ El cobro de {formatearMoneda(flexibilidadCosto)} se cargará UNA sola vez en la primera cuota.
                      {' '}El cliente podrá usar el beneficio {flexibilidadModalidad === 'PREMIUM' ? '2 veces' : '1 vez'} durante la vigencia.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* === FLEXIBILIDAD FINANCIERA (beneficio opcional, cuotas >= 4) === */}
            {/* DOS tarifas: Básica $15.000 (1 uso) | Premium $34.900 (2 usos) */}
            {cuotasActuales >= 4 ? (
              <div className={`space-y-3 p-4 rounded-lg border-2 transition-colors ${
                flexibilidadFinanciera
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 dark:border-emerald-500'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flexibilidadFinanciera}
                      onCheckedChange={setFlexibilidadFinanciera}
                      id="flexibilidadFinanciera"
                    />
                    <Label
                      htmlFor="flexibilidadFinanciera"
                      className="text-sm cursor-pointer font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                      Flexibilidad Financiera
                    </Label>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      flexibilidadFinanciera
                        ? 'text-emerald-700 dark:text-emerald-200 border-emerald-400 dark:border-emerald-500 bg-emerald-200 dark:bg-emerald-800'
                        : 'text-muted-foreground border-muted-foreground/30'
                    }
                  >
                    {flexibilidadFinanciera
                      ? `✨ ADQUIRIDO (${flexibilidadModalidad})`
                      : 'Opcional — 2 tarifas disponibles'}
                  </Badge>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {flexibilidadFinanciera
                    ? '✅ Activo. El cliente podrá trasladar una cuota al final del crédito o solicitar cambio de fecha de pago. Se generará un "Otro Sí" firmado electrónicamente con OTP. El cobro se realiza UNA sola vez al inicio del crédito (cargado en la primera cuota).'
                    : `Disponible porque el crédito tiene ${cuotasActuales} cuotas (≥ 4). El cliente podrá trasladar UNA cuota al final del crédito o solicitar cambio de fecha (genera "Otro Sí" sin modificar pagaré/carta originales).`}
                </p>

                {/* === Selector de modalidad (2 tarifas) — solo si está activo === */}
                {flexibilidadFinanciera && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {/* Básica */}
                    <button
                      type="button"
                      onClick={() => setFlexibilidadModalidad('BASICA')}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        flexibilidadModalidad === 'BASICA'
                          ? 'border-emerald-500 bg-emerald-200/60 dark:bg-emerald-900/60'
                          : 'border-emerald-300/40 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/40 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Básica</span>
                        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">$15.000</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                        ✅ <strong>1 uso</strong> durante la vigencia del crédito.
                      </p>
                      <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                        Nota: esta opción solo podrá usarse una vez durante la vigencia del crédito.
                      </p>
                    </button>

                    {/* Premium */}
                    <button
                      type="button"
                      onClick={() => setFlexibilidadModalidad('PREMIUM')}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        flexibilidadModalidad === 'PREMIUM'
                          ? 'border-emerald-500 bg-emerald-200/60 dark:bg-emerald-900/60'
                          : 'border-emerald-300/40 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/40 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-1">
                          Premium
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/30 text-amber-800 dark:text-amber-200 border border-amber-400/40">RECOMENDADA</span>
                        </span>
                        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">$34.900</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                        ✅ <strong>2 usos</strong> durante la vigencia del crédito (para las dos cuotas del mes).
                      </p>
                      <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                        Nota: esta opción podrá usarse dos veces durante la vigencia del crédito.
                      </p>
                    </button>
                  </div>
                )}

                {/* === Ejemplo de beneficio === */}
                {flexibilidadFinanciera && (
                  <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-100">
                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                      <span>💡</span> Ejemplo: cómo beneficia al cliente
                    </div>
                    <p className="leading-relaxed">
                      Imagina que el cliente tiene una cuota de <strong>$200.000</strong> con vencimiento el <strong>5 de agosto</strong>,
                      y por un imprevisto no podrá pagar a tiempo. Sin Flexibilidad Financiera, se generarían
                      intereses moratorios diarios (ej: <strong>$6.000/día</strong>) — en 5 días serían <strong>$30.000</strong> solo en mora.
                    </p>
                    <p className="mt-1.5 leading-relaxed">
                      Con Flexibilidad Financiera ({flexibilidadModalidad === 'PREMIUM' ? 'Premium $34.900' : 'Básica $15.000'}),
                      el cliente puede <strong>trasladar esa cuota al final del crédito</strong> o <strong>cambiar la fecha de pago</strong>,
                      <strong> evitando el cobro de mora</strong>. El ahorro supera ampliamente el costo del beneficio.
                      {' '}El cobro de {formatearMoneda(flexibilidadCosto)} se cargará una sola vez en la <strong>primera cuota</strong>.
                    </p>
                  </div>
                )}

                {!flexibilidadFinanciera && (
                  <ul className="list-disc list-inside text-xs text-emerald-800 dark:text-emerald-200 ml-2 space-y-0.5">
                    <li>Trasladar UNA cuota al final del crédito</li>
                    <li>Solicitar cambio de fecha de pago (se genera "Otro Sí" sin modificar pagare/carta originales)</li>
                  </ul>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
                ℹ️ <strong>Flexibilidad Financiera</strong> está disponible solo para créditos con
                <strong> 4 o más cuotas</strong>. Actualmente: {cuotasActuales} cuota(s).
              </div>
            )}

            {/* === RENOVACIÓN ANTICIPADA (beneficio opcional del simulador del portal) === */}
            {/* Cobro único de $9.900 COP. Se cobra al activarse tras T&C y se */}
            {/* registra automáticamente en la caja CAJA-RENOVACIONES. */}
            <div className={`space-y-3 p-4 rounded-lg border-2 transition-colors ${
              renovacionAnticipada
                ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-500 dark:border-amber-500'
                : 'bg-muted/30 border-muted-foreground/20'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Renovación Anticipada
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold">
                      $9.900
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Beneficio opcional que el cliente puede activar desde el simulador del portal.
                    Le da derecho a reserva anticipada de cupo, prioridad en procesamiento,
                    tasa preferencial mantenida y desembolso acelerado.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="renovacionAnticipadaAdmin"
                  checked={renovacionAnticipada}
                  onChange={(e) => setRenovacionAnticipada(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 shrink-0 cursor-pointer mt-1"
                  aria-label="Activar Renovación Anticipada"
                />
              </div>
              {renovacionAnticipada && (
                <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-100">
                  <div className="font-semibold mb-1">✨ Beneficios que recibe el cliente:</div>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Reserva anticipada de su cupo para el siguiente ciclo</li>
                    <li>Prioridad en el procesamiento de la próxima solicitud</li>
                    <li>Tasa preferencial mantenida (sin re-evaluación)</li>
                    <li>Desembolso acelerado (menos de 24 horas hábiles)</li>
                    <li>Trámite simplificado (sin cargue de documentos)</li>
                  </ul>
                  <p className="mt-2 pt-1.5 border-t border-amber-300 dark:border-amber-800">
                    El cobro de <strong>{formatearMoneda(RENOVACION_ANTICIPADA_COSTO)}</strong> se hará
                    una sola vez al activarse el préstamo tras la aceptación de T&C,
                    y se registrará automáticamente en la caja <strong>CAJA-RENOVACIONES</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* === COBRO DE PAGARÉ + CARTA DE INSTRUCCIONES === */}
            {/* Cargo editable $19.900 — se cobra UNA sola vez al inicio del crédito */}
            {requiereDocumentos && (generarPagare || generarCarta) && (
              <div className={`space-y-3 p-4 rounded-lg border-2 transition-colors ${
                cobroPagareCarta
                  ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-500 dark:border-violet-500'
                  : 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cobroPagareCarta}
                      onCheckedChange={setCobroPagareCarta}
                      id="cobroPagareCarta"
                    />
                    <Label
                      htmlFor="cobroPagareCarta"
                      className="text-sm cursor-pointer font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                      Cobro de Pagaré + Carta de Instrucciones
                    </Label>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      cobroPagareCarta
                        ? 'text-violet-700 dark:text-violet-200 border-violet-400 dark:border-violet-500 bg-violet-200 dark:bg-violet-800'
                        : 'text-muted-foreground border-muted-foreground/30'
                    }
                  >
                    {cobroPagareCarta ? `Facturado: $${valorPagareCarta.toLocaleString('es-CO')}` : 'Sin cobro'}
                  </Badge>
                </div>
                {cobroPagareCarta && (
                  <>
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      ✅ Cargo único aplicado al cliente por la generación del pagaré y carta de instrucciones.
                      {' '}Se explica en el estado de cuenta como concepto "Pagaré + Carta de Instrucciones".
                      {' '}El valor es <strong>editable</strong> (puede variar según el cliente).
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Label htmlFor="valorPagareCarta" className="text-xs text-violet-800 dark:text-violet-200 whitespace-nowrap">
                        Valor a cobrar (COP):
                      </Label>
                      <Input
                        id="valorPagareCarta"
                        type="number"
                        min={0}
                        step={100}
                        value={valorPagareCarta}
                        onChange={(e) => setValorPagareCarta(Number(e.target.value) || 0)}
                        className="w-40 h-9"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        ≈ ${valorPagareCarta.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* === TARIFA DE USO DE PLATAFORMA (Tarea U) === */}
            {/* Cargo editable $4.900 — se cobra UNA sola vez al inicio del crédito */}
            <div className={`space-y-3 p-4 rounded-lg border-2 transition-colors ${
              cobroTarifaPlataforma
                ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 dark:border-amber-500'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
            }`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={cobroTarifaPlataforma}
                    onCheckedChange={setCobroTarifaPlataforma}
                    id="cobroTarifaPlataforma"
                  />
                  <Label
                    htmlFor="cobroTarifaPlataforma"
                    className="text-sm cursor-pointer font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5"
                  >
                    <MonitorSmartphone className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                    Tarifa de Uso de Plataforma
                  </Label>
                </div>
                <Badge
                  variant="outline"
                  className={
                    cobroTarifaPlataforma
                      ? 'text-amber-700 dark:text-amber-200 border-amber-400 dark:border-amber-500 bg-amber-200 dark:bg-amber-800'
                      : 'text-muted-foreground border-muted-foreground/30'
                  }
                >
                  {cobroTarifaPlataforma ? `Facturado: $${valorTarifaPlataforma.toLocaleString('es-CO')}` : 'Sin cobro'}
                </Badge>
              </div>
              {cobroTarifaPlataforma && (
                <>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ✅ Cargo único aplicado al cliente por el uso de la plataforma tecnológica asociada al crédito.
                    {' '}Se refleja en el estado de cuenta como concepto "Tarifa de Uso de Plataforma".
                    {' '}El valor es <strong>editable</strong> (puede variar según el cliente).
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Label htmlFor="valorTarifaPlataforma" className="text-xs text-amber-800 dark:text-amber-200 whitespace-nowrap">
                      Valor a cobrar (COP):
                    </Label>
                    <Input
                      id="valorTarifaPlataforma"
                      type="number"
                      min={0}
                      step={100}
                      value={valorTarifaPlataforma}
                      onChange={(e) => setValorTarifaPlataforma(Number(e.target.value) || 0)}
                      className="w-40 h-9"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      ≈ ${valorTarifaPlataforma.toLocaleString('es-CO')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Documentos */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <Label className="font-medium cursor-pointer">¿Requiere documentos (pagaré/carta)?</Label>
                  <p className="text-xs text-muted-foreground">
                    Si seleccionas "No", continúa el proceso sin generar documentos
                  </p>
                </div>
                <Switch checked={requiereDocumentos} onCheckedChange={setRequiereDocumentos} />
              </div>

              {requiereDocumentos && (
                <div className="space-y-3 p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Datos para Pagaré y Carta de Instrucciones</h4>
                      <p className="text-xs text-muted-foreground">
                        Se cargan automáticamente desde el cliente registrado. Puedes editarlos si necesitas ajustarlos para este documento.
                      </p>
                    </div>
                    {clienteId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const c = clientes.find((cl) => cl.id === clienteId)
                          if (!c) return
                          setNombreClienteSel(c.nombre || '')
                          setCedulaClienteSel(c.cedula || '')
                          setTelefonoClienteSel(c.telefono || '')
                          setEmailClienteSel(c.email || '')
                          setDepartamento(c.departamento || '')
                          setMunicipio(c.municipio || '')
                          setCiudad(c.ciudad || '')
                          setBarrio(c.barrio || '')
                          setDireccion(c.direccion || '')
                          setBancoCliente(c.bancoCliente || '')
                          setTipoCuentaCliente(c.tipoCuentaCliente || '')
                          setNumeroCuentaCliente(c.numeroCuentaCliente || '')
                          toast({
                            title: 'Datos recargados',
                            description: `Se cargaron los datos actuales de ${c.nombre}`,
                          })
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Recargar datos del cliente
                      </Button>
                    )}
                  </div>

                  {/* Datos de identidad del cliente */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Datos del cliente
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nombre completo</Label>
                        <Input
                          value={nombreClienteSel}
                          onChange={(e) => setNombreClienteSel(e.target.value)}
                          placeholder="Juan Pérez"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cédula</Label>
                        <Input
                          value={cedulaClienteSel}
                          onChange={(e) => setCedulaClienteSel(e.target.value)}
                          placeholder="1234567890"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Teléfono</Label>
                        <Input
                          value={telefonoClienteSel}
                          onChange={(e) => setTelefonoClienteSel(e.target.value)}
                          placeholder="3001234567"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                          value={emailClienteSel}
                          onChange={(e) => setEmailClienteSel(e.target.value)}
                          placeholder="cliente@empresa.com"
                          className="bg-blue-50/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datos de ubicación */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ubicación
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Departamento</Label>
                        <Input
                          value={departamento}
                          onChange={(e) => setDepartamento(e.target.value)}
                          placeholder="Cundinamarca"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Municipio</Label>
                        <Input
                          value={municipio}
                          onChange={(e) => setMunicipio(e.target.value)}
                          placeholder="Soacha"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ciudad</Label>
                        <Input
                          value={ciudad}
                          onChange={(e) => setCiudad(e.target.value)}
                          placeholder="Bogotá"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Barrio</Label>
                        <Input
                          value={barrio}
                          onChange={(e) => setBarrio(e.target.value)}
                          placeholder="Centro"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Dirección</Label>
                        <Input
                          value={direccion}
                          onChange={(e) => setDireccion(e.target.value)}
                          placeholder="Calle 123 #45-67"
                          className="bg-blue-50/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datos bancarios del cliente */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Datos bancarios
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Banco</Label>
                        <Input
                          value={bancoCliente}
                          onChange={(e) => setBancoCliente(e.target.value)}
                          placeholder="Bancolombia"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tipo de cuenta</Label>
                        <Input
                          value={tipoCuentaCliente}
                          onChange={(e) => setTipoCuentaCliente(e.target.value)}
                          placeholder="AHORROS / CORRIENTE"
                          className="bg-blue-50/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número de cuenta</Label>
                        <Input
                          value={numeroCuentaCliente}
                          onChange={(e) => setNumeroCuentaCliente(e.target.value)}
                          placeholder="000-000-000"
                          className="bg-blue-50/30"
                        />
                      </div>
                    </div>
                  </div>

                  {!clienteId && (
                    <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      ⚠️ Selecciona un cliente para autocompletar estos datos.
                    </div>
                  )}

                  <div className="flex gap-3 mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={generarPagare} onCheckedChange={setGenerarPagare} id="pagare" />
                      <Label htmlFor="pagare" className="text-sm cursor-pointer">Generar Pagaré</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={generarCarta} onCheckedChange={setGenerarCarta} id="carta" />
                      <Label htmlFor="carta" className="text-sm cursor-pointer">Generar Carta</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* === CODEUDOR === */}
              <div className={`space-y-3 p-4 rounded-lg border-2 transition-colors ${
                tieneCodeudor
                  ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-500 dark:border-violet-500'
                  : 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={tieneCodeudor} onCheckedChange={handleTieneCodeudorChange} id="codeudor" />
                    <Label htmlFor="codeudor" className="text-sm cursor-pointer font-semibold text-violet-900 dark:text-violet-100">
                      ¿Requiere codeudor?
                    </Label>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      tieneCodeudor
                        ? 'text-violet-700 dark:text-violet-200 border-violet-400 dark:border-violet-500 bg-violet-200 dark:bg-violet-800'
                        : 'text-muted-foreground border-muted-foreground/30'
                    }
                  >
                    {tieneCodeudor ? '🛡️ CON CODEUDOR' : 'Sin codeudor'}
                  </Badge>
                </div>
                <p className="text-xs text-violet-700 dark:text-violet-300">
                  {tieneCodeudor
                    ? '✅ Activo: el codeudor firmará electrónicamente el pagaré y respaldará el préstamo.'
                    : 'Si activas esta opción, podrás seleccionar un cliente como codeudor.'}
                </p>
                {tieneCodeudor && (
                  <div className="space-y-3 pt-2 border-t border-violet-300 dark:border-violet-700">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-violet-900 dark:text-violet-100">
                        Selecciona el codeudor de la matriz de clientes
                      </Label>
                      <Select value={codeudorId} onValueChange={setCodeudorId}>
                        <SelectTrigger className="border-violet-400 dark:border-violet-600">
                          <SelectValue placeholder="Selecciona un cliente como codeudor" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes
                            .filter((c) => c.id !== clienteId)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre} - {c.cedula} - {c.telefono}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* === PRECARGA AUTOMÁTICA DE DATOS DEL CODEUDOR === */}
                    {codeudorId && (() => {
                      const cod = clientes.find((c) => c.id === codeudorId)
                      return cod ? (
                        <div className="p-3 rounded-lg bg-violet-200 dark:bg-violet-900/50 border border-violet-400 dark:border-violet-600 text-xs space-y-2">
                          <p className="font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-1">
                            🛡️ Datos del codeudor cargados:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-violet-900 dark:text-violet-100">
                            <div>
                              <span className="text-violet-700 dark:text-violet-300">Nombre:</span>{' '}
                              <strong>{cod.nombre}</strong>
                            </div>
                            <div>
                              <span className="text-violet-700 dark:text-violet-300">Cédula:</span>{' '}
                              <strong>{cod.cedula}</strong>
                            </div>
                            <div>
                              <span className="text-violet-700 dark:text-violet-300">Teléfono:</span>{' '}
                              <strong>{cod.telefono}</strong>
                            </div>
                            <div>
                              <span className="text-violet-700 dark:text-violet-300">Email:</span>{' '}
                              <strong>{cod.email || 'N/A'}</strong>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-violet-700 dark:text-violet-300">Dirección:</span>{' '}
                              <strong>{cod.direccion || 'N/A'}</strong>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-violet-300 dark:border-violet-700">
                            <p className="text-violet-700 dark:text-violet-300 font-medium">
                              ✓ Estos datos se incluirán automáticamente en:
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5 text-violet-800 dark:text-violet-200">
                              <li>Pagaré (con firma electrónica del codeudor)</li>
                              <li>Carta de instrucciones</li>
                              <li>Certificado de firma electrónica</li>
                            </ul>
                          </div>
                        </div>
                      ) : null
                    })()}

                    {/* === Si no hay codeudor seleccionado, mostrar aviso === */}
                    {!codeudorId && (
                      <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-600 text-xs text-amber-800 dark:text-amber-200">
                        ⚠️ Selecciona un cliente de la lista para precargar sus datos como codeudor.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-amber-50 border border-amber-200">
                <div>
                  <Label className="font-medium cursor-pointer">Aprobar y enviar T&C al cliente</Label>
                  <p className="text-xs text-muted-foreground">
                    El cliente recibirá un link por WhatsApp para aceptar términos y condiciones
                  </p>
                </div>
                <Switch checked={aprobarYEnviarTyC} onCheckedChange={setAprobarYEnviarTyC} />
              </div>

              {/* Firma electrónica con verificación de identidad */}
              {aprobarYEnviarTyC && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md bg-purple-50 border border-purple-200">
                    <div>
                      <Label className="font-medium cursor-pointer flex items-center gap-1">
                        <PenTool className="w-3.5 h-3.5 text-purple-700" />
                        Solicitar firma electrónica con verificación de identidad
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        El cliente deberá subir foto del documento, selfie con cédula, dibujar firma y validar código OTP
                      </p>
                    </div>
                    <Switch checked={solicitarFirmaElectronica} onCheckedChange={setSolicitarFirmaElectronica} />
                  </div>

                  {solicitarFirmaElectronica && (
                    <div className="ml-3 p-3 border-l-2 border-purple-300 space-y-2">
                      <Label className="text-xs font-semibold text-purple-900">
                        Canal para enviar el código de verificación
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['WHATSAPP', 'EMAIL', 'AMBOS'] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCanalFirma(c)}
                            className={`px-3 py-2 rounded-md text-xs font-medium border-2 transition ${
                              canalFirma === c
                                ? 'border-purple-500 bg-purple-100 text-purple-900'
                                : 'border-gray-200 hover:border-purple-300 text-gray-700'
                            }`}
                          >
                            {c === 'WHATSAPP' && '📱 WhatsApp'}
                            {c === 'EMAIL' && '📧 Correo'}
                            {c === 'AMBOS' && '🔒 Ambos'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        💡 Recomendado: <strong>Ambos</strong>. El cliente recibirá el código por WhatsApp y correo para mayor seguridad.
                      </p>
                      <div className="bg-purple-100/50 p-2 rounded text-[11px] text-purple-900">
                        📋 Flujo: 1) Cliente recibe link → 2) Sube foto del documento → 3) Sube selfie con cédula → 4) Dibuja firma → 5) Recibe código OTP → 6) Confirma código → 7) Préstamo se activa automáticamente
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas internas</Label>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Observaciones del crédito"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Solicitud</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Modal "¿QUÉ CAMBIÓ?" — Análisis de comportamiento de pagos === */}
      {/* Muestra los cambios detectados comparando los últimos 30 días vs. los 30 días anteriores. */}
      <QueCambioModal
        prestamoId={prestamoQueCambioId}
        prestamoCodigo={prestamoQueCambioCodigo}
        open={modalQueCambio}
        onClose={() => {
          setModalQueCambio(false)
          setPrestamoQueCambioId(null)
        }}
      />
    </div>
  )
}

// =====================================================
// SimuladorPanel — wrapper interno de SimuladorView
// =====================================================
// Reutiliza el SimuladorView standalone dentro de la pestaña de préstamos.
// Mantener un wrapper propio permite inyectar props adicionales (por
// ejemplo, parámetros precargados) en el futuro sin romper la API pública.
function SimuladorPanel() {
  return <SimuladorView />
}

// =====================================================
// PrestamosView — wrapper con pestañas internas
// =====================================================
// Vista principal de Préstamos que agrupa 8 pestañas:
//   1. Solicitudes     -> PrestamosPanel (lista + crear solicitud)
//   2. Clientes        -> ClientesView
//   3. Simulador       -> SimuladorPanel
//   4. Cajas           -> CajasView
//   5. Campañas        -> CampanasView
//   6. Notificaciones  -> NotificacionesView
//   7. Documentos      -> DocumentosPanel
//   8. Buzón Web       -> BuzonSolicitudesView
//
// La acción "Convertir" del Buzón Web construye una SimulacionParams a
// partir de la solicitud web y la inyecta en PrestamosPanel cambiando a
// la pestaña "Solicitudes" para que el operador complete la creación.
export function PrestamosView({
  onAbrirPrestamo,
  onChanged,
  onCambiarVista,
}: {
  onAbrirPrestamo: (id: string) => void
  onChanged: () => void
  onCambiarVista?: (vista: string) => void
}) {
  const [tab, setTab] = useState('solicitudes')
  const [simulacionInicial, setSimulacionInicial] = useState<SimulacionParams | null>(null)
  const { toast } = useToast()

  // Convertir una solicitud web en una simulación precargada en la pestaña
  // "Solicitudes" para que el operador complete la creación del préstamo.
  const convertirSolicitudWeb = (solicitud: SolicitudWebMin) => {
    const params: SimulacionParams = {
      clienteId: solicitud.clienteId,
      montoPrincipal: solicitud.valorSolicitado?.toString() ?? '',
      tasaInteresAnual: solicitud.tasaUtilizada?.toString() ?? '24',
      plazoMeses: solicitud.numeroCuotas?.toString() ?? '12',
      frecuencia: (solicitud.frecuencia as Frecuencia) || 'MENSUAL',
      origen: `Solicitud web ${solicitud.codigo}`,
      // === Preservar ID de la solicitud web para auto-marcarla como CONVERTIDA ===
      solicitudWebId: solicitud.id,
      // === Preservar flexibilidad financiera elegida por el cliente ===
      flexibilidadFinanciera: solicitud.flexibilidadFinanciera,
      flexibilidadModalidad: (solicitud.flexibilidadModalidad === 'PREMIUM' ? 'PREMIUM' : 'BASICA'),
      flexibilidadCosto: solicitud.flexibilidadCosto,
      // === Preservar Renovación Anticipada elegida por el cliente ===
      renovacionAnticipada: solicitud.renovacionAnticipada,
      renovacionAnticipadaCosto: solicitud.renovacionAnticipadaCosto,
    }
    setSimulacionInicial(params)
    setTab('solicitudes')
    toast({
      title: 'Solicitud cargada',
      description: `Se precargó el formulario con los datos de la solicitud ${solicitud.codigo}. Completa la información restante para crear el préstamo. Al crear, la solicitud se marcará como CONVERTIDA y el cliente verá el flujo de firma en su portal.`,
      duration: 7000,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Préstamos"
        subtitle="Solicitudes, clientes, simulador, cajas y más"
        icon={<FileText className="w-5 h-5" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        {/* === FIX MOBILE (2026-08-05): Antes era grid-cols-2 que mostraba 9 pestañas
            en 5 filas en la mitad de la pantalla del móvil, bloqueando la navegación.
            Ahora es un TabsList horizontal con scroll suave en móvil, y grid en desktop. === */}
        <TabsList className="flex overflow-x-auto whitespace-nowrap md:grid md:grid-cols-4 lg:grid-cols-10 w-full gap-1 md:gap-0 no-scrollbar">
          <TabsTrigger value="solicitudes" className="flex-1 md:flex-initial">Solicitudes</TabsTrigger>
          <TabsTrigger value="clientes" className="flex-1 md:flex-initial">Clientes</TabsTrigger>
          <TabsTrigger value="simulador" className="flex-1 md:flex-initial">Simulador</TabsTrigger>
          <TabsTrigger value="cajas" className="flex-1 md:flex-initial">Cajas</TabsTrigger>
          <TabsTrigger value="campanas" className="flex-1 md:flex-initial">Campañas</TabsTrigger>
          <TabsTrigger value="notificaciones" className="flex-1 md:flex-initial">Notificaciones</TabsTrigger>
          <TabsTrigger value="documentos" className="flex-1 md:flex-initial">Documentos</TabsTrigger>
          <TabsTrigger value="buzon" className="flex-1 md:flex-initial">Buzón Web</TabsTrigger>
          <TabsTrigger value="plan-cliente" className="flex-1 md:flex-initial">Plan Cliente</TabsTrigger>
          <TabsTrigger value="linea-tiempo" className="flex-1 md:flex-initial" title="Línea de Tiempo 360°">🕰️ Línea de Tiempo</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitudes" className="mt-6">
          <PrestamosPanel
            onAbrirPrestamo={onAbrirPrestamo}
            onChanged={onChanged}
            simulacionInicial={simulacionInicial}
            onCambiarVista={onCambiarVista}
          />
        </TabsContent>

        <TabsContent value="clientes" className="mt-6">
          <ClientesView onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="simulador" className="mt-6">
          <SimuladorPanel />
        </TabsContent>

        <TabsContent value="cajas" className="mt-6">
          <CajasView onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="campanas" className="mt-6">
          <CampanasView onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="notificaciones" className="mt-6">
          <NotificacionesView />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <DocumentosPrestamosView />
        </TabsContent>

        <TabsContent value="buzon" className="mt-6">
          <BuzonSolicitudesView onConvertir={convertirSolicitudWeb} />
        </TabsContent>

        <TabsContent value="plan-cliente" className="mt-6">
          <PlanClienteView />
        </TabsContent>

        <TabsContent value="linea-tiempo" className="mt-6">
          <LineaTiempoView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
