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
import { FileText, Plus, Search, Eye, Check, X, ArrowRight, RefreshCw, PenTool, Shield, Trash2, Calendar, Scissors, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientesView } from '@/components/views/ClientesView'
import { CajasView } from '@/components/views/CajasView'
import { CampanasView } from '@/components/views/CampanasView'
import { NotificacionesView } from '@/components/views/NotificacionesView'
import { BuzonSolicitudesView } from '@/components/views/BuzonSolicitudesView'
import { PlanClienteView } from '@/components/views/PlanClienteView'
import { SimuladorView } from '@/components/views/SimuladorView'
import { DocumentosPrestamosView } from '@/components/views/DocumentosPrestamosView'
import { DashboardPrestamos } from '@/components/views/DashboardPrestamos'
import { BotIcons } from '@/components/views/BotIcons'

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
  requiereDocumentos: boolean
  tycAceptado: boolean
  firmaId?: string | null
  tieneCodeudor?: boolean
  codeudorNombre?: string | null
  codeudorCedula?: string | null
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
  const { toast } = useToast()

  // Estado del formulario
  const [clienteId, setClienteId] = useState('')
  const [modalidad, setModalidad] = useState<'FRANCES' | 'TASA_FIJA' | 'CUOTA_PERSONALIZADA'>('FRANCES')
  const [montoPrincipal, setMontoPrincipal] = useState('')
  const [tasaInteresAnual, setTasaInteresAnual] = useState('24')
  const [tasaMoraAnual, setTasaMoraAnual] = useState('36')
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

  // === Renovación de crédito ===
  const [esRenovacion, setEsRenovacion] = useState(false)
  const [prestamoARenovar, setPrestamoARenovar] = useState('')
  const [saldoPendienteRenovacion, setSaldoPendienteRenovacion] = useState(0)
  const [infoPrestamoRenovacion, setInfoPrestamoRenovacion] = useState<any>(null)

  // === Flexibilidad Financiera (beneficio opcional) ===
  // Se ofrece cuando el número de cuotas >= 4. Costo adicional fijo de $10.000 COP.
  // Permite al cliente:
  //   1) Trasladar UNA cuota al final del crédito
  //   2) Solicitar cambio de fecha de pago (genera documento "Otro Sí")
  //
  // - flexibilidadFinanciera: si el cliente adquirió el beneficio en esta solicitud
  // - flexibilidadCosto: monto COP (por defecto 10000)
  const [flexibilidadFinanciera, setFlexibilidadFinanciera] = useState(false)
  const [flexibilidadCosto] = useState(10000)

  // === Función: cargar saldo pendiente del préstamo a renovar ===
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
        setInfoPrestamoRenovacion({
          codigo: prestamo.codigo,
          montoPrincipal: prestamo.montoPrincipal,
          montoCuota: prestamo.montoCuota,
          numeroCuotas: prestamo.numeroCuotas,
          cuotasPagadas: prestamo.cuotasPagadas,
          saldoTotal: prestamo.saldoTotal,
          estado: prestamo.estado,
          fechaDesembolso: prestamo.fechaDesembolso,
        })
      }
    } catch (e: any) {
      console.error('Error cargando préstamo a renovar:', e)
    }
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
        fondoGarantia: Math.round(monto * 0.05 * 100) / 100,
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
      // Solo se envía si el usuario activó el beneficio. El backend lo guarda
      // en el préstamo y queda disponible para que el cliente lo active (pagando)
      // y solicite Otros Síes después.
      if (flexibilidadFinanciera) {
        body.flexibilidadFinanciera = true
        body.flexibilidadCosto = flexibilidadCosto
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
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
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
                <TableHead>Saldo</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : prestamosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No hay préstamos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                prestamosFiltrados.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
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
                          onClick={() => window.open(`/api/estado-cuenta?cedula=${encodeURIComponent(p.cliente.cedula)}&prestamoId=${p.id}`, '_blank', 'noopener,noreferrer')}
                          title="Estado de cuenta"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {/* Reforzado: botón para ver certificado de firma electrónica */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className={p.firmaId ? "text-blue-600 hover:text-blue-700" : "text-muted-foreground opacity-40"}
                          onClick={() => p.firmaId && window.open(`/api/firma/certificado?firmaId=${p.firmaId}`, '_blank', 'noopener,noreferrer')}
                          title={p.firmaId ? "Ver Certificado de Firma Electrónica" : "Sin firma electrónica"}
                          disabled={!p.firmaId}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
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
            <div className="space-y-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <Label htmlFor="fechaPrestamo" className="text-sm font-medium flex items-center gap-1.5">
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
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                📅 Esta será la fecha base del préstamo. Todos los documentos generados (pagaré, carta, tabla de amortización) y el código del préstamo usarán esta fecha, no la fecha actual del sistema.
              </p>
              {fechaPrestamo !== (() => {
                const hoy = new Date()
                const yyyy = hoy.getFullYear()
                const mm = String(hoy.getMonth() + 1).padStart(2, '0')
                const dd = String(hoy.getDate()).padStart(2, '0')
                return `${yyyy}-${mm}-${dd}`
              })() && (
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
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
            <div className="space-y-3 p-3 rounded-md bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
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
                    className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline"
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
              <p className="text-xs text-indigo-800 dark:text-indigo-200">
                💡 Para clientes que solicitan crédito <strong>antes</strong> de la fecha de corte.
                El sistema calcula automáticamente los días causados hasta el corte más cercano y
                programa los pagos desde esa fecha de corte.
              </p>

              {/* === Bloque de cálculo automático === */}
              {periodoCorte && fechaPrestamo && (
                <div className="space-y-3 p-3 rounded-md bg-white dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700">
                  {/* Resumen automático */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="text-indigo-700 dark:text-indigo-300 font-medium">
                        📅 Fecha del préstamo
                      </div>
                      <div className="font-bold text-foreground">
                        {formatearFecha(new Date(fechaPrestamo + 'T12:00:00'))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-indigo-700 dark:text-indigo-300 font-medium">
                        🎯 Fecha del primer corte
                      </div>
                      <div className="font-bold text-foreground">
                        {fechaPrimerCorte ? formatearFecha(fechaPrimerCorte) : '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-indigo-700 dark:text-indigo-300 font-medium">
                        ⏳ Días causados antes del corte
                      </div>
                      <div className="font-bold text-foreground">
                        {diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  {fechaPrimerCorte && (
                    <div className="text-xs text-indigo-800 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-900/40 rounded p-2">
                      {diasCausadosAntes > 0 ? (
                        <>
                          📊 El préstamo se entrega el{' '}
                          <strong>{formatearFecha(new Date(fechaPrestamo + 'T12:00:00'))}</strong>{' '}
                          pero el corte más cercano es el{' '}
                          <strong>{formatearFecha(fechaPrimerCorte)}</strong>. El sistema cobrará{' '}
                          <strong>{diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'}</strong>{' '}
                          de interés anticipado y las cuotas se programarán desde el{' '}
                          <strong>{formatearFecha(fechaPrimerCorte)}</strong>.
                        </>
                      ) : (
                        <>
                          ✅ La fecha del préstamo cae <strong>justo en un día de corte</strong>{' '}
                          ({formatearFecha(fechaPrimerCorte)}). No hay días causados adicionales y
                          las cuotas se programarán desde esta fecha.
                        </>
                      )}
                    </div>
                  )}

                  {/* === Campos editables: días causados y valor a cobrar === */}
                  {diasCausadosAntes > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-200 dark:border-indigo-700">
                      <div className="space-y-1.5">
                        <Label htmlFor="diasCausadosAntes" className="text-xs font-medium flex items-center gap-1.5">
                          Días causados antes del corte
                          {editarDiasCausadosManual && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
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
                          className="bg-white dark:bg-indigo-900/40"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="valorDiasCausados" className="text-xs font-medium flex items-center gap-1.5">
                          Valor a cobrar por días causados (COP)
                          {editarDiasCausadosManual && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
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
                          className="bg-white dark:bg-indigo-900/40"
                        />
                      </div>
                      {editarDiasCausadosManual && (
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={handleRecalcularDiasCausados}
                            className="text-xs px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-700 transition flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Recalcular automáticamente
                          </button>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                            ⚠️ Estás usando valores editados manualmente. Si cambian el monto o la tasa,
                            no se recalcularán hasta que presiones este botón.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === Aviso de cobro adicional === */}
                  {valorDiasCausados > 0 && (
                    <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-900 dark:text-emerald-100">
                      💰 Se cobrarán <strong>{formatearMoneda(valorDiasCausados)}</strong> adicionales
                      por {diasCausadosAntes} día{diasCausadosAntes === 1 ? '' : 's'} de interés anticipado.
                      Este valor se suma al total a pagar del préstamo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* === Si es renovación, mostrar préstamos del cliente === */}
            {esRenovacion && clienteId && (
              <div className="space-y-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Selecciona el crédito a renovar
                  </Label>
                  <Select value={prestamoARenovar} onValueChange={seleccionarPrestamoARenovar}>
                    <SelectTrigger className="border-amber-400 dark:border-amber-600">
                      <SelectValue placeholder="Selecciona el crédito previo del cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {prestamos
                        .filter((p) => p.cliente?.id === clienteId && p.estado !== 'RECHAZADO' && p.estado !== 'CANCELADO')
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} - {formatearMoneda(p.montoPrincipal)} - {p.cuotasPagadas}/{p.numeroCuotas} cuotas - Saldo: {formatearMoneda(p.saldoTotal)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* === Info del préstamo a renovar === */}
                {infoPrestamoRenovacion && (
                  <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-600 text-xs space-y-2">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      📋 Crédito a renovar: {infoPrestamoRenovacion.codigo}
                    </p>
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
                    </div>
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
                {clienteId && prestamos.filter((p) => p.cliente?.id === clienteId && p.estado !== 'RECHAZADO' && p.estado !== 'CANCELADO').length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ℹ️ Este cliente no tiene créditos activos para renovar
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
                    <Label htmlFor="tasaMoraAnual">Tasa Moratoria Anual (%) *</Label>
                    <Input
                      id="tasaMoraAnual"
                      type="number"
                      step="0.01"
                      value={tasaMoraAnual}
                      onChange={(e) => setTasaMoraAnual(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Mora <strong>compuesta diaria</strong>. Tú determinas el % anual; el sistema
                        lo convierte automáticamente a tasa diaria (anual ÷ 360) y aplica
                        interés compuesto cada día sobre la cuota vencida.
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Mensual: <strong>{((parseFloat(tasaMoraAnual) || 0) / 12).toFixed(4)}%</strong>
                      </p>
                      <p className="text-amber-700 font-medium">
                        ≡ Diaria: <strong>{((parseFloat(tasaMoraAnual) || 0) / 360).toFixed(6)}%</strong>
                      </p>
                    </div>
                    {montoPrincipal && tasaMoraAnual && (
                      <p className="text-xs text-muted-foreground">
                        Mora por día de atraso (sobre capital):{' '}
                        <strong className="text-amber-700">
                          {formatearMoneda(
                            (parseFloat(montoPrincipal) || 0) * (parseFloat(tasaMoraAnual) || 0) / 100 / 360
                          )}
                        </strong>
                      </p>
                    )}
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
                      <strong>Fórmula:</strong> M = S × [(1 + r/360)^d − 1]<br/>
                      <strong>S</strong> = saldo de la cuota vencida · <strong>r</strong> = tasa anual ·{' '}
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
                  <p className="text-xs text-blue-700 font-medium">
                    🛡️ Fondo de Garantía (5% primer préstamo): {formatearMoneda(calculo.fondoGarantia)}
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
                      Flexibilidad Financiera: ADQUIRIDA
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Costo adicional:</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          {formatearMoneda(flexibilidadCosto)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Estado:</span>{' '}
                        <strong className="text-amber-700 dark:text-amber-300">
                          Pendiente de activación
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Beneficios:</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          Cambio de fecha + Traslado de cuota
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      ✨ El cliente podrá activar el beneficio pagando {formatearMoneda(flexibilidadCosto)}.
                      Al activarse, podrá generar Otros Síes con firma electrónica OTP.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* === FLEXIBILIDAD FINANCIERA (beneficio opcional, cuotas >= 4) === */}
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
                      ? `✨ ADQUIRIDO (+$${flexibilidadCosto.toLocaleString('es-CO')})`
                      : `Opcional · $${flexibilidadCosto.toLocaleString('es-CO')}`}
                  </Badge>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {flexibilidadFinanciera
                    ? '✅ Activo: el cliente podrá (previo pago del costo) trasladar una cuota al final del crédito o solicitar cambio de fecha de pago. Se generará un documento "Otro Sí" firmado electrónicamente con OTP.'
                    : `Disponible porque el crédito tiene ${cuotasActuales} cuotas (≥ 4). Por un costo adicional de $${flexibilidadCosto.toLocaleString('es-CO')}, el cliente tendrá la posibilidad de:`}
                </p>
                {!flexibilidadFinanciera && (
                  <ul className="list-disc list-inside text-xs text-emerald-800 dark:text-emerald-200 ml-2 space-y-0.5">
                    <li>Trasladar UNA cuota al final del crédito</li>
                    <li>Solicitar cambio de fecha de pago (se genera "Otro Sí" sin modificar pagare/carta originales)</li>
                  </ul>
                )}
                {flexibilidadFinanciera && (
                  <div className="mt-2 pt-2 border-t border-emerald-300 dark:border-emerald-700 text-[11px] text-emerald-700 dark:text-emerald-300">
                    💡 El cliente deberá pagar el costo de <strong>${flexibilidadCosto.toLocaleString('es-CO')}</strong> para activar el beneficio.
                    Una vez activado, podrá generar Otros Síes desde el detalle del préstamo.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
                ℹ️ <strong>Flexibilidad Financiera</strong> está disponible solo para créditos con
                <strong> 4 o más cuotas</strong>. Actualmente: {cuotasActuales} cuota(s).
              </div>
            )}

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

  // === Limpiar todos los registros ===
  const [modalLimpiarAbierto, setModalLimpiarAbierto] = useState(false)
  const [passwordLimpiar, setPasswordLimpiar] = useState('')
  const [motivoLimpiar, setMotivoLimpiar] = useState('')
  const [limpiando, setLimpiando] = useState(false)
  const [resultadoLimpieza, setResultadoLimpieza] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const limpiarTodosPrestamos = async () => {
    // La contraseña NO se compara en el frontend — el backend la valida
    // contra LIMPIAR_PRESTAMOS_PASSWORD en .env. Aquí solo verificamos
    // que el campo no esté vacío antes de llamar al endpoint.
    if (!passwordLimpiar || passwordLimpiar.length < 4) {
      toast({ title: 'Contraseña requerida', description: 'Ingresa la contraseña de autorización (definida en LIMPIAR_PRESTAMOS_PASSWORD del .env).', variant: 'destructive' })
      return
    }
    setLimpiando(true)
    setResultadoLimpieza(null)
    try {
      const res = await fetch('/api/prestamos/limpiar-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordLimpiar, motivo: motivoLimpiar }),
      })
      const json = await res.json()
      if (json.success) {
        setResultadoLimpieza(json)
        setPasswordLimpiar('')
        setMotivoLimpiar('')
        setRefreshKey(k => k + 1)
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudo completar', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLimpiando(false)
    }
  }

  const cerrarModalLimpiar = () => {
    setModalLimpiarAbierto(false)
    setPasswordLimpiar('')
    setMotivoLimpiar('')
    setResultadoLimpieza(null)
  }

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
    }
    setSimulacionInicial(params)
    setTab('solicitudes')
    toast({
      title: 'Solicitud cargada',
      description: `Se precargó el formulario con los datos de la solicitud ${solicitud.codigo}. Completa la información restante para crear el préstamo.`,
      duration: 6000,
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
        <TabsList className="flex overflow-x-auto whitespace-nowrap md:grid md:grid-cols-4 lg:grid-cols-9 w-full gap-1 md:gap-0 no-scrollbar">
          <TabsTrigger value="solicitudes" className="flex-1 md:flex-initial">Solicitudes</TabsTrigger>
          <TabsTrigger value="clientes" className="flex-1 md:flex-initial">Clientes</TabsTrigger>
          <TabsTrigger value="simulador" className="flex-1 md:flex-initial">Simulador</TabsTrigger>
          <TabsTrigger value="cajas" className="flex-1 md:flex-initial">Cajas</TabsTrigger>
          <TabsTrigger value="campanas" className="flex-1 md:flex-initial">Campañas</TabsTrigger>
          <TabsTrigger value="notificaciones" className="flex-1 md:flex-initial">Notificaciones</TabsTrigger>
          <TabsTrigger value="documentos" className="flex-1 md:flex-initial">Documentos</TabsTrigger>
          <TabsTrigger value="buzon" className="flex-1 md:flex-initial">Buzón Web</TabsTrigger>
          <TabsTrigger value="plan-cliente" className="flex-1 md:flex-initial">Plan Cliente</TabsTrigger>
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
      </Tabs>

      {/* === BOTÓN FLOTANTE: Limpiar registros === */}
      <button
        onClick={() => setModalLimpiarAbierto(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 group"
        title="Limpiar todos los registros de préstamos"
      >
        <Trash2 className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Limpiar registros</span>
      </button>

      {/* === MODAL: Limpiar todos los registros === */}
      <Dialog open={modalLimpiarAbierto} onOpenChange={(o) => !o && cerrarModalLimpiar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Limpiar todos los registros de préstamos
            </DialogTitle>
          </DialogHeader>

          {resultadoLimpieza ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-600 mb-2">✅ Registros borrados correctamente</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>• Préstamos: {resultadoLimpieza.datosBorrados?.prestamos || 0}</p>
                  <p>• Pagos: {resultadoLimpieza.datosBorrados?.pagos || 0}</p>
                  <p>• Bitácoras: {resultadoLimpieza.datosBorrados?.bitacoras || 0}</p>
                  <p>• Firmas: {resultadoLimpieza.datosBorrados?.firmas || 0}</p>
                  <p>• Códigos confirmación: {resultadoLimpieza.datosBorrados?.codigosConfirmacion || 0}</p>
                  <p>• Casos jurídicos: {resultadoLimpieza.datosBorrados?.casosJuridicos || 0}</p>
                  <p>• Movimientos caja: {resultadoLimpieza.datosBorrados?.movimientosCaja || 0}</p>
                </div>
              </div>
              <Button onClick={cerrarModalLimpiar} className="w-full">
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-600 mb-2">⚠️ Acción irreversible</p>
                <p className="text-xs text-muted-foreground">
                  Esta acción borrará <strong>TODOS</strong> los préstamos, pagos, bitácoras, firmas electrónicas, códigos de confirmación, casos jurídicos y movimientos de caja asociados. Los clientes NO se borran.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Motivo de la limpieza (opcional)</Label>
                <Input
                  value={motivoLimpiar}
                  onChange={(e) => setMotivoLimpiar(e.target.value)}
                  placeholder="Ej: Limpieza de datos de prueba"
                  disabled={limpiando}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Contraseña de autorización <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="password"
                  value={passwordLimpiar}
                  onChange={(e) => setPasswordLimpiar(e.target.value)}
                  placeholder="Ingresa la contraseña"
                  disabled={limpiando}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && passwordLimpiar && !limpiando) {
                      limpiarTodosPrestamos()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Pista: la contraseña es una palabra de 7 letras que significa "limpiar"
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={cerrarModalLimpiar}
                  disabled={limpiando}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={limpiarTodosPrestamos}
                  disabled={limpiando || !passwordLimpiar}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {limpiando ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Borrar todo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
