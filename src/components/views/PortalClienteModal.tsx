'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import FotoCaptureFirma from '@/components/firma/FotoCaptureFirma'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  formatearMoneda,
  formatearFecha,
  formatearFechaHora,
  type Frecuencia,
  type ResultadoCalculo,
} from '@/lib/finanzas'
import {
  User,
  FileText,
  DollarSign,
  Megaphone,
  CheckCircle,
  Clock,
  AlertTriangle,
  Bell,
  Award,
  CalendarClock,
  HeartPulse,
  CreditCard,
  FileCheck,
  Calculator,
  Send,
  Lightbulb,
  MessageSquare,
  ClipboardList,
  ShieldCheck,
  KeyRound,
  Camera,
  Upload,
  RefreshCw,
  Loader2,
  Smartphone,
  Mail,
  FileDown,
  Printer,
  LogOut,
  Home,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Wallet,
  History,
  Plus,
  Landmark,
  AlarmClockCheck,
  SlidersHorizontal,
  FileSignature,
  MessagesSquare,
  Clock3,
  Lock,
  BellRing,
  Repeat,
  Zap,
  BadgeCheck,
  Trophy,
} from 'lucide-react'
import { CentroComunicacionesPortal } from '@/components/views/CentroComunicacionesPortal'
import { useInactivityAutoLogout } from '@/hooks/use-inactivity-auto-logout'
import { PasaporteConfianzaView } from '@/components/views/pasaporte/PasaporteConfianzaView'

// =====================================================
// Tipos (sin cambios — preserva contrato de API)
// =====================================================
interface PortalKPIS {
  scorePago: number
  estadoSalud: string
  proximoVencimiento: string | null
  diasProximoPago: number
  montoProximoPago: number
  totalCuotasPendientes: number
  porcentajeAvancePromedio: number
}

interface NotificacionItem {
  id: string
  tipo: string
  mensaje: string
  estado: string
  fechaEnvio: string
  leida?: boolean
}

interface NotificacionesStats {
  total: number
  noLeidas: number
  pendientes: number
}

interface PortalClienteInfo {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email?: string | null
  categoria?: { nombre: string; codigo?: string } | null
  activo?: boolean
  municipio?: string | null
  departamento?: string | null
  tieneTasaPersonalizada?: boolean
  tasaPersonalizada?: number | null
  tokenSesion?: string | null
  tokenExpira?: string | null
}

interface CuentaRecaudoInfo {
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  titular: string
  nombreCuenta?: string | null
}

interface PortalData {
  cliente: PortalClienteInfo
  resumen: {
    totalPrestamos: number
    prestamosActivos: number
    prestamosCancelados: number
    prestamosJuridico: number
    saldoTotalActivos: number
    totalPagado: number
  }
  kpis?: PortalKPIS
  prestamos: any[]
  campanas: any[]
  notificaciones?: NotificacionItem[]
  notificacionesStats?: NotificacionesStats
  cuentaRecaudoPrincipal?: CuentaRecaudoInfo | null
}

// =====================================================
// Configuración visual del Hub Circular
// =====================================================
type HubItemId = 'prestamos' | 'proximos' | 'simulador' | 'solicitudes' | 'comunicaciones' | 'historial' | 'pasaporte'

interface HubItemConfig {
  id: HubItemId
  label: string
  icon: typeof FileText
  color: string
  gradient: string
  position: { x: number; y: number } // traslación desde el centro en px
  badge?: number
}

export function PortalClienteModal({
  cedula,
  token,
  onClose,
}: {
  cedula: string
  token?: string
  onClose: () => void
}) {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // === Vista activa del portal: 'hub' ( pantalla principal) o un HubItemId / secciones inferiores
  const [vista, setVista] = useState<'hub' | HubItemId | 'avisos' | 'campanas'>('hub')

  // === Pila de navegación para botón "Atrás" real ===
  // Cada vez que el cliente entra a una sección (simulador, préstamos, etc.)
  // empujamos un estado al historial del navegador. Cuando el cliente presiona
  // "Atrás" en el navegador/celular, interceptamos popstate y volvemos a la
  // vista anterior del portal en lugar de cerrar la sesión.
  const vistaHistoryRef = useRef<Array<'hub' | HubItemId | 'avisos' | 'campanas'>>(['hub'])
  const isInternalNavigationRef = useRef(false)
  // Ref para distinguir cierre explícito (botón "Cerrar sesión") de cierre
  // accidental (Escape, clic fuera del modal). Solo el botón explícito debe
  // activar el logout.
  const confirmLogoutRef = useRef(false)

  // Navega a una nueva vista, empujando estado al historial del navegador
  const navegarA = (nuevaVista: 'hub' | HubItemId | 'avisos' | 'campanas') => {
    if (nuevaVista === vista) return
    // Empujar la vista anterior a la pila interna
    vistaHistoryRef.current.push(vista)
    // Empujar estado al historial del navegador para interceptar "Atrás"
    if (typeof window !== 'undefined' && !isInternalNavigationRef.current) {
      isInternalNavigationRef.current = true
      window.history.pushState({ portalVista: nuevaVista, ts: Date.now() }, '')
      isInternalNavigationRef.current = false
    }
    setVista(nuevaVista)
    // Scroll al inicio de la nueva vista
    if (typeof document !== 'undefined') {
      const scrollable = document.querySelector('.flex-1.overflow-y-auto')
      if (scrollable) scrollable.scrollTop = 0
    }
  }

  // Vuelve a la vista anterior (si existe), sino vuelve al hub.
  // No cierra la sesión ni el modal.
  const volverAtras = () => {
    const anterior = vistaHistoryRef.current.pop()
    const destino = anterior || 'hub'
    // Si la pila quedó vacía, asegurar que tenga al menos 'hub'
    if (vistaHistoryRef.current.length === 0) {
      vistaHistoryRef.current.push('hub')
    }
    isInternalNavigationRef.current = true
    if (typeof window !== 'undefined') {
      // Reemplazar el estado actual en lugar de push para no inflar el historial
      window.history.replaceState({ portalVista: destino, ts: Date.now() }, '')
    }
    setVista(destino)
    isInternalNavigationRef.current = false
    // Scroll al inicio
    if (typeof document !== 'undefined') {
      const scrollable = document.querySelector('.flex-1.overflow-y-auto')
      if (scrollable) scrollable.scrollTop = 0
    }
  }

  // === Intercepta el botón "Atrás" del navegador/celular ===
  // Cuando el usuario presiona "Atrás", el navegador dispara popstate.
  // Si estamos en una vista != 'hub', volvemos a la vista anterior del portal.
  // Si estamos en 'hub', dejamos que el navegador haga su comportamiento normal
  // (pero NO cerramos la sesión — eso solo pasa con el botón explícito de logout).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (_e: PopStateEvent) => {
      if (isInternalNavigationRef.current) return
      const actual = vistaHistoryRef.current[vistaHistoryRef.current.length - 1] || 'hub'
      if (actual !== 'hub' || vistaHistoryRef.current.length > 1) {
        // Volver a la vista anterior del portal, no cerrar sesión
        const anterior = vistaHistoryRef.current.pop() || 'hub'
        const destino = vistaHistoryRef.current[vistaHistoryRef.current.length - 1] || 'hub'
        if (vistaHistoryRef.current.length === 0) {
          vistaHistoryRef.current.push('hub')
        }
        setVista(destino)
        // Volver a empujar el estado para mantener el comportamiento en futuros "Atrás"
        isInternalNavigationRef.current = true
        window.history.pushState({ portalVista: destino, ts: Date.now() }, '')
        isInternalNavigationRef.current = false
        // Scroll
        const scrollable = document.querySelector('.flex-1.overflow-y-auto')
        if (scrollable) scrollable.scrollTop = 0
        // Toast informativo (sutil)
        toast({
          title: 'Volviste',
          description: 'Estás en: ' + (destino === 'hub' ? 'Hub' : destino.charAt(0).toUpperCase() + destino.slice(1)),
        })
      }
      // Si está en hub y no hay historial, no hacer nada — el navegador decide
    }
    window.addEventListener('popstate', handler)
    // Inicializar historial con un estado para poder interceptar el primer "Atrás"
    if (vistaHistoryRef.current.length === 1 && vistaHistoryRef.current[0] === 'hub') {
      isInternalNavigationRef.current = true
      window.history.replaceState({ portalVista: 'hub', ts: Date.now() }, '')
      isInternalNavigationRef.current = false
    }
    return () => {
      window.removeEventListener('popstate', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // === Flujo de aceptación TyC con OTP + Selfie (PRESERVADO) ===
  const [tycPrestamoId, setTycPrestamoId] = useState<string | null>(null)
  const [tycPrestamoCodigo, setTycPrestamoCodigo] = useState<string>('')
  const [tycPaso, setTycPaso] = useState<1 | 2 | 3 | 4>(1)
  const [tycCanal, setTycCanal] = useState<'WHATSAPP' | 'EMAIL' | 'AMBOS'>('EMAIL')
  const [tycOtpIngresado, setTycOtpIngresado] = useState<string>('')
  const [tycSegundosRestantes, setTycSegundosRestantes] = useState<number>(0)
  const [tycFotoDocumento, setTycFotoDocumento] = useState<string | null>(null)
  const [tycFotoSelfie, setTycFotoSelfie] = useState<string | null>(null)
  const [tycEnviandoOtp, setTycEnviandoOtp] = useState(false)
  const [tycValidandoOtp, setTycValidandoOtp] = useState(false)
  const [tycGuardando, setTycGuardando] = useState(false)
  const tycIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Headers estándar para llamadas autenticadas del portal
  const portalHeaders = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['x-portal-token'] = token
    return h
  }

  // === Auto-logout por inactividad (10 minutos continuos) ===
  // Por seguridad del cliente: si no hay actividad (mouse, teclado, scroll,
  // touch) durante 10 minutos, la sesión se cierra automáticamente y se
  // muestra una advertencia 1 minuto antes para que el usuario pueda
  // extenderla con un clic.
  const cerrarSesionPorInactividad = () => {
    try {
      // Toast rápido antes de cerrar (best-effort)
      toast({
        title: 'Sesión cerrada por inactividad',
        description: 'Por seguridad, tu sesión se cerró tras 10 minutos sin actividad.',
        variant: 'destructive',
      })
    } catch {}
    // Marcar como logout explícito para que onClose se procese
    confirmLogoutRef.current = true
    // Limpiar el historial interno del portal para no afectar al navegador
    if (typeof window !== 'undefined' && vistaHistoryRef.current.length > 1) {
      try {
        window.history.go(-(vistaHistoryRef.current.length - 1))
      } catch {}
    }
    onClose()
  }

  const {
    warning: inactivityWarning,
    secondsLeft: inactivitySecondsLeft,
    extend: extenderSesion,
  } = useInactivityAutoLogout({
    timeoutMs: 10 * 60 * 1000,    // 10 minutos
    warningAtMs: 9 * 60 * 1000,   // advertir a los 9 minutos (1 min antes)
    onTimeout: cerrarSesionPorInactividad,
    enabled: true,
  })

  useEffect(() => {
    cargar()
  }, [cedula])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/portal/${cedula}`, { headers: portalHeaders() })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // === Cargar contador de novedades del Pasaporte de Confianza ===
  // Muestra un badge en el botón "Pasaporte" del hub radial cuando hay
  // novedades de pago (vencidos, no registrados, parciales, próximos a vencer).
  const [novedadesPasaporteCount, setNovedadesPasaporteCount] = useState(0)
  useEffect(() => {
    if (!token) return
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch(`/api/portal/pasaporte?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (!cancelado && json.success && Array.isArray(json.data?.novedades)) {
          setNovedadesPasaporteCount(json.data.novedades.length)
        }
      } catch (e) {
        // Silencioso: no bloquear la carga del portal si falla el pasaporte
        console.error('[Pasaporte] Error cargando novedades:', e)
      }
    })()
    return () => { cancelado = true }
  }, [token])

  // === Abrir flujo TyC completo (OTP + foto cédula + selfie) — PRESERVADO ===
  const abrirFlujoTyC = async (prestamoId: string, codigo: string) => {
    setTycPrestamoId(prestamoId)
    setTycPrestamoCodigo(codigo)
    setTycPaso(1)
    setTycOtpIngresado('')
    setTycFotoDocumento(null)
    setTycFotoSelfie(null)
    setTycSegundosRestantes(0)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        headers: portalHeaders(),
      })
      const json = await res.json()
      if (json.success && json.data?.activo) {
        setTycPaso(2)
        setTycCanal((json.data.canal as any) || 'EMAIL')
        setTycSegundosRestantes(json.data.segundosRestantes || 300)
        iniciarCuentaRegresiva(json.data.segundosRestantes || 300)
        if (json.data.otpValidado) {
          setTycPaso(3)
        }
      }
    } catch (e) {
      console.error('Error check OTP:', e)
    }
  }

  const cerrarFlujoTyC = () => {
    if (tycIntervalRef.current) {
      clearInterval(tycIntervalRef.current)
      tycIntervalRef.current = null
    }
    setTycPrestamoId(null)
    setTycPrestamoCodigo('')
    setTycPaso(1)
    setTycOtpIngresado('')
    setTycFotoSelfie(null)
    setTycSegundosRestantes(0)
  }

  const iniciarCuentaRegresiva = (segundos: number) => {
    if (tycIntervalRef.current) clearInterval(tycIntervalRef.current)
    setTycSegundosRestantes(segundos)
    tycIntervalRef.current = setInterval(() => {
      setTycSegundosRestantes((prev) => {
        if (prev <= 1) {
          if (tycIntervalRef.current) clearInterval(tycIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const enviarOTPTyC = async () => {
    if (!tycPrestamoId) return
    setTycEnviandoOtp(true)
    try {
      const res = await fetch(`/api/prestamos/${tycPrestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers: portalHeaders(),
        body: JSON.stringify({ accion: 'enviar_otp', canal: tycCanal }),
      })
      const json = await res.json()
      if (json.success) {
        setTycPaso(2)
        iniciarCuentaRegresiva(json.data.segundosRestantes || 300)
        toast({
          title: json.data.reutilizado ? 'Código reutilizado' : 'Código enviado',
          description: json.mensaje,
        })
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTycEnviandoOtp(false)
    }
  }

  const validarOTPTyC = async () => {
    if (!tycPrestamoId || !tycOtpIngresado) return
    setTycValidandoOtp(true)
    try {
      const res = await fetch(`/api/prestamos/${tycPrestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers: portalHeaders(),
        body: JSON.stringify({ accion: 'validar_otp', otpIngresado: tycOtpIngresado }),
      })
      const json = await res.json()
      if (json.success) {
        setTycPaso(3)
        if (tycIntervalRef.current) clearInterval(tycIntervalRef.current)
        toast({
          title: 'Código verificado',
          description: 'Ahora sube la foto de tu cédula.',
        })
      } else {
        toast({ title: 'Código incorrecto', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTycValidandoOtp(false)
    }
  }

  // === Captura de fotos (TyC) ===
  // NOTA: La captura de fotos (cámara + subir archivo) ahora se maneja
  // internamente en el componente FotoCaptureFirma. Las funciones auxiliares
  // tomarFotoSelfie(), tomarFotoDocumento(), subirFotoSelfieArchivo() y
  // subirFotoDocumentoArchivo() ya no son necesarias aquí.

  const confirmarAceptacionTyC = async () => {
    if (!tycPrestamoId || !tycFotoDocumento || !tycFotoSelfie) return
    setTycGuardando(true)
    try {
      const res = await fetch(`/api/prestamos/${tycPrestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers: portalHeaders(),
        body: JSON.stringify({
          accion: 'confirmar_con_foto',
          fotoDocumentoBase64: tycFotoDocumento,
          fotoSelfieBase64: tycFotoSelfie,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '¡Términos aceptados!',
          description:
            'Tu préstamo ha sido activado. Se guardaron tu foto de cédula y selfie como respaldo de firma.',
        })
        cerrarFlujoTyC()
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTycGuardando(false)
    }
  }

  const aceptarTyC = async (prestamoId: string) => {
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: portalHeaders(),
        body: JSON.stringify({ accion: 'aceptar_tyc' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '¡Términos aceptados!',
          description: 'Tu préstamo ha sido activado. Recibirás el desembolso pronto.',
        })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Generar paz y salvo para préstamos cancelados
  // Si el préstamo NO está saldado/cancelado, mostrar mensaje al cliente
  // indicando que el crédito aún se encuentra vigente.
  const generarPazYSalvo = (prestamoId: string, codigo: string, estado?: string, saldoTotal?: number, cuotasPagadas?: number, numeroCuotas?: number) => {
    // Validación local: el endpoint ya valida, pero damos feedback
    // inmediato sin necesidad de abrir una nueva pestaña.
    const estaCancelado = estado === 'CANCELADO'
    const estaSaldado = (saldoTotal ?? 0) <= 0 && (cuotasPagadas ?? 0) >= (numeroCuotas ?? 0)
    if (!estaCancelado && !estaSaldado) {
      const saldoPendiente = formatearMoneda(saldoTotal ?? 0)
      const cuotasFaltantes = Math.max(0, (numeroCuotas ?? 0) - (cuotasPagadas ?? 0))
      toast({
        title: '🔒 Crédito vigente',
        description: `Tu crédito ${codigo} aún se encuentra vigente. Saldo pendiente: ${saldoPendiente} · Cuotas restantes: ${cuotasFaltantes}. Solo podrás descargar el paz y salvo cuando el crédito esté 100% saldado.`,
        variant: 'destructive',
        duration: 6000,
      })
      return
    }
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    window.open(`/api/paz-y-salvo?prestamoId=${prestamoId}&codigo=${codigo}${tokenParam}&auto=1`, '_blank')
  }

  // Descargar estado de cuenta (global o por préstamo)
  const descargarEstadoCuenta = (prestamoId?: string) => {
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    const url = prestamoId
      ? `/api/estado-cuenta?cedula=${encodeURIComponent(cedula)}&prestamoId=${prestamoId}${tokenParam}`
      : `/api/estado-cuenta?cedula=${encodeURIComponent(cedula)}${tokenParam}`
    window.open(url, '_blank')
  }

  // Pagar con Bancolombia
  const pagarBancolombia = async (prestamoId: string, monto: number, numeroCuota: number) => {
    try {
      const res = await fetch('/api/pagos/bancolombia-checkout', {
        method: 'POST',
        headers: portalHeaders(),
        body: JSON.stringify({
          prestamoId,
          monto,
          numeroCuota,
          descripcion: `Pago cuota ${numeroCuota} - Portal Cliente`,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const destino = json.data.bancolombiaRedirectUrl || json.data.redirectUrl
        toast({
          title: json.data.modoSimulado ? 'Modo simulado' : 'Redirigiendo a Bancolombia',
          description: json.data.modoSimulado
            ? `Intención simulada. Checkout ID: ${json.data.checkoutId.slice(0, 8)}…`
            : `Te redirigiremos a Bancolombia para autorizar el pago.`,
        })
        if (destino) {
          if (destino.startsWith('http')) {
            window.location.href = destino
          } else {
            window.open(destino, '_blank')
          }
        }
      } else {
        toast({ title: 'Error al crear pago', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ============ LOADING STATE ============
  if (loading || !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-full" showCloseButton={false}>
          <VisuallyHidden>
            <DialogTitle>Cargando portal</DialogTitle>
          </VisuallyHidden>
          <div className="py-16 flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-muted-foreground tracking-wide">Cargando tu portal…</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const { cliente, resumen, prestamos, campanas } = data
  const kpis = data.kpis || {
    scorePago: 0,
    estadoSalud: 'N/D',
    proximoVencimiento: null,
    diasProximoPago: 0,
    montoProximoPago: 0,
    totalCuotasPendientes: 0,
    porcentajeAvancePromedio: 0,
  }
  const notificaciones = data.notificaciones || []
  const notifStats = data.notificacionesStats || { total: 0, noLeidas: 0, pendientes: 0 }

  // Configuración del Hub (7 items alrededor del logo) — Iconos premium
  // Layout redistribuido a 7 posiciones (ángulos de ~51.43°) para incluir
  // el "Pasaporte de Confianza" como ítem premium visible junto a los demás.
  const hubItems: HubItemConfig[] = [
    {
      id: 'prestamos',
      label: 'Créditos',
      icon: Landmark,
      color: 'text-indigo-300',
      gradient: 'from-indigo-500 via-indigo-600 to-violet-700',
      // Posición 1 (top, 0°)
      position: { x: 0, y: -110 },
      // Sin badge: los pendientes se muestran en Solicitudes
    },
    {
      id: 'proximos',
      label: 'Próximos',
      icon: AlarmClockCheck,
      color: 'text-cyan-300',
      gradient: 'from-cyan-400 via-cyan-600 to-blue-700',
      // Posición 2 (~51°, top-right)
      position: { x: 86, y: -69 },
    },
    {
      id: 'simulador',
      label: 'Simulador',
      icon: SlidersHorizontal,
      color: 'text-violet-300',
      gradient: 'from-violet-400 via-violet-600 to-purple-700',
      // Posición 3 (~103°, right)
      position: { x: 107, y: 25 },
    },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      icon: FileSignature,
      color: 'text-amber-300',
      gradient: 'from-amber-400 via-amber-600 to-orange-700',
      // Posición 4 (~154°, bottom-right)
      position: { x: 48, y: 99 },
      // Badge: cuenta préstamos pendientes de aceptación ( TyC ) que requieren firma electrónica
      badge: prestamos.filter(p => p.estado === 'PENDIENTE_ACEPTACION').length || undefined,
    },
    {
      id: 'comunicaciones',
      label: 'Chat',
      icon: MessagesSquare,
      color: 'text-emerald-300',
      gradient: 'from-emerald-400 via-emerald-600 to-teal-700',
      // Posición 5 (~206°, bottom-left)
      position: { x: -48, y: 99 },
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: Clock3,
      color: 'text-fuchsia-300',
      gradient: 'from-fuchsia-400 via-fuchsia-600 to-pink-700',
      // Posición 6 (~257°, left)
      position: { x: -107, y: 25 },
    },
    {
      id: 'pasaporte',
      label: 'Pasaporte',
      icon: Trophy,
      color: 'text-yellow-300',
      gradient: 'from-amber-300 via-yellow-500 to-amber-600',
      // Posición 7 (~309°, top-left)
      position: { x: -86, y: -69 },
      // Badge: cuenta novedades del pasaporte (vencidos, no registrados, etc.)
      badge: novedadesPasaporteCount || undefined,
    },
  ]

  // Helper para obtener config por id (incluye secciones extras: avisos, campañas)
  const hubConfig = (id: 'hub' | HubItemId | 'avisos' | 'campanas') => {
    if (id === 'avisos') return { label: 'Avisos', icon: Bell, gradient: 'from-red-500 to-rose-600', color: 'text-red-300' }
    if (id === 'campanas') return { label: 'Campañas', icon: Megaphone, gradient: 'from-indigo-500 to-violet-600', color: 'text-indigo-300' }
    return hubItems.find(h => h.id === id)!
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { /* Solo cerrar vía botón explícito */ if (open === false && confirmLogoutRef.current) { onClose() } }}>
      <DialogContent
        className="max-w-md w-full h-[100vh] sm:h-[95vh] sm:max-h-[860px] flex flex-col p-0 gap-0 overflow-hidden portal-bg border-0 sm:rounded-3xl"
        showCloseButton={false}
        // === Bloquear cierre accidental del modal ===
        // Antes: si el cliente presionaba Escape o hacía clic fuera del modal,
        // se disparaba onClose() → se borraban los tokens de localStorage →
        // el cliente perdía la sesión sin querer. Ahora SOLO el botón
        // explícito "Cerrar sesión" (que pone confirmLogoutRef=true antes de
        // llamar a onClose) puede cerrar el modal.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Portal del Cliente — {cliente.nombre}</DialogTitle>
        </VisuallyHidden>
        {/* === HEADER COMPACTO (App-like) === */}
        <div className="px-4 pt-4 pb-3 shrink-0 fade-scale">
          <div className="flex items-center justify-between gap-3">
            {vista !== 'hub' ? (
              <button
                onClick={volverAtras}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors btn-press"
                title="Volver a la sección anterior"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-9 h-9 rounded-full gradient-premium flex items-center justify-center shadow-md shrink-0">
                  <span className="text-xs font-bold text-white">
                    {cliente.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background"></span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">Hola,</p>
                  <p className="text-sm font-semibold truncate leading-tight">
                    {cliente.nombre.split(' ')[0]}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {cliente.categoria && (
                <span className="chip-premium !text-[10px] !py-0.5 !px-2">
                  <Sparkles className="w-2.5 h-2.5" />
                  {cliente.categoria.nombre}
                </span>
              )}
              <button
                onClick={() => {
                  // Confirmación explícita de cierre de sesión.
                  // Esto distingue un logout intencional de un cierre accidental
                  // (Escape, clic fuera) que NO debe cerrar la sesión.
                  if (confirm('¿Seguro que deseas cerrar la sesión?')) {
                    confirmLogoutRef.current = true
                    // Limpiar la pila de historial que creamos para la navegación
                    // interna del portal, para no afectar el historial del navegador
                    // después del logout.
                    if (typeof window !== 'undefined' && vistaHistoryRef.current.length > 1) {
                      window.history.go(-(vistaHistoryRef.current.length - 1))
                    }
                    onClose()
                  }
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 btn-press transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Título de la sección actual */}
          {vista !== 'hub' && (
            <div className="mt-3 slide-up">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${hubConfig(vista).gradient} flex items-center justify-center shadow-md`}>
                  {(() => {
                    const Icon = hubConfig(vista).icon
                    return <Icon className="w-4 h-4 text-white" />
                  })()}
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">{hubConfig(vista).label}</h2>
                  <p className="text-[10px] text-muted-foreground">Sección del portal</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="divider-soft shrink-0"></div>

        {/* === BODY CON SCROLL === */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {vista === 'hub' && (
            <HubView
              cliente={cliente}
              kpis={kpis}
              resumen={resumen}
              hubItems={hubItems}
              onSelect={(id) => navegarA(id)}
              cuentaRecaudoPrincipal={data.cuentaRecaudoPrincipal}
              onEstadoCuenta={descargarEstadoCuenta}
            />
          )}

          {vista === 'prestamos' && (
            <PrestamosView
              // FILTRO: préstamos PENDIENTE_ACEPTACION ya NO se muestran en Créditos.
              // Se muestran únicamente en la vista de Solicitudes.
              prestamos={prestamos.filter(p => p.estado !== 'PENDIENTE_ACEPTACION')}
              onAbrirTyC={abrirFlujoTyC}
              onAceptarTyC={aceptarTyC}
              onPazYSalvo={generarPazYSalvo}
              onEstadoCuenta={descargarEstadoCuenta}
            />
          )}

          {vista === 'proximos' && (
            <ProximosPagosView
              prestamos={prestamos}
              onPagar={pagarBancolombia}
            />
          )}

          {vista === 'historial' && (
            <HistorialView prestamos={prestamos} />
          )}

          {vista === 'simulador' && (
            <SimuladorCredito
              clienteId={cliente.id}
              token={token}
              tasaPersonalizadaInicial={{
                tiene: !!cliente.tieneTasaPersonalizada,
                valor: cliente.tasaPersonalizada ?? null,
              }}
            />
          )}

          {vista === 'solicitudes' && (
            <MisSolicitudesPanel
              cedula={cliente.cedula}
              token={token}
              prestamosPendientes={prestamos.filter(p => p.estado === 'PENDIENTE_ACEPTACION')}
              onAbrirTyC={abrirFlujoTyC}
            />
          )}

          {vista === 'comunicaciones' && (
            <CentroComunicacionesPortal
              clienteId={cliente.id}
              cedula={cliente.cedula}
              token={token}
            />
          )}

          {vista === 'avisos' && (
            <AvisosView
              notificaciones={notificaciones}
              notifStats={notifStats}
            />
          )}

          {vista === 'campanas' && (
            <CampanasView campanas={campanas} />
          )}

          {vista === 'pasaporte' && token && (
            <PasaporteConfianzaView token={token} />
          )}

          {vista === 'pasaporte' && !token && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sesión no disponible. Cierra e inicia sesión nuevamente para ver tu Pasaporte de Confianza.
            </div>
          )}
        </div>

        {/* === BARRA INFERIOR FIJA === */}
        <div className="bottom-nav shrink-0 px-2 pt-1.5 pb-2 safe-bottom">
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => navegarA('hub')}
              className={`bottom-nav-item ${vista === 'hub' ? 'active' : ''}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium">Hub</span>
            </button>

            <button
              onClick={() => navegarA('avisos')}
              className={`bottom-nav-item ${vista === 'avisos' ? 'active' : ''}`}
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {notifStats.noLeidas > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center font-bold pulse-glow">
                    {notifStats.noLeidas > 9 ? '9+' : notifStats.noLeidas}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">Avisos</span>
            </button>

            <button
              onClick={() => navegarA('campanas')}
              className={`bottom-nav-item ${vista === 'campanas' ? 'active' : ''}`}
            >
              <Megaphone className="w-5 h-5" />
              <span className="text-[10px] font-medium">Campañas</span>
            </button>

            <a
              href="https://wa.me/573103674546"
              target="_blank"
              rel="noopener noreferrer"
              className="bottom-nav-item"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-medium">Soporte</span>
            </a>
          </div>
        </div>

        {/* === MODAL TyC (4 pasos) — PRESERVADO, solo rediseño visual === */}
        {tycPrestamoId && (
          <Dialog open={true} onOpenChange={(o) => { if (!o && !tycGuardando) cerrarFlujoTyC() }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-premium flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Aceptación T&C</p>
                    <p className="text-[10px] text-muted-foreground font-normal">{tycPrestamoCodigo}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Stepper visual premium */}
              <div className="flex items-center justify-between mb-4 px-2">
                {[
                  { n: 1, label: 'OTP', icon: KeyRound },
                  { n: 2, label: 'Validar', icon: CheckCircle },
                  { n: 3, label: 'Cédula', icon: CreditCard },
                  { n: 4, label: 'Selfie', icon: Camera },
                ].map((s, idx) => (
                  <div key={s.n} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          tycPaso >= s.n
                            ? 'gradient-premium text-white shadow-md'
                            : 'bg-white/5 text-muted-foreground border border-white/10'
                        }`}
                      >
                        {tycPaso > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
                      </div>
                      <span className="text-[10px] mt-1 text-muted-foreground">{s.label}</span>
                    </div>
                    {idx < 3 && (
                      <div
                        className={`h-0.5 flex-1 mx-2 transition-colors duration-300 ${
                          tycPaso > s.n ? 'bg-primary' : 'bg-white/10'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Paso 1: Enviar OTP */}
              {tycPaso === 1 && (
                <div className="space-y-4 fade-scale">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-sm">
                    <p className="font-semibold mb-1 text-blue-200 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      Verificación de identidad
                    </p>
                    <p className="text-xs text-blue-100/80">
                      Te enviaremos un código de un solo uso (OTP) para confirmar tu identidad antes
                      de aceptar los Términos y Condiciones.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Canal de envío</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: 'WHATSAPP', icon: Smartphone, label: 'WhatsApp', color: 'emerald' },
                        { v: 'EMAIL', icon: Mail, label: 'Correo', color: 'blue' },
                        { v: 'AMBOS', icon: Send, label: 'Ambos', color: 'purple' },
                      ] as const).map((opt) => {
                        const Icon = opt.icon
                        const active = tycCanal === opt.v
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setTycCanal(opt.v)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all btn-press ${
                              active
                                ? `border-${opt.color}-500 bg-${opt.color}-500/10 text-${opt.color}-300`
                                : 'border-white/10 hover:border-white/20 text-muted-foreground'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Button
                    className="w-full gradient-premium gradient-premium-hover btn-press"
                    onClick={enviarOTPTyC}
                    disabled={tycEnviandoOtp}
                  >
                    {tycEnviandoOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 mr-2" />
                        Enviar código de verificación
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Paso 2: Validar OTP */}
              {tycPaso === 2 && (
                <div className="space-y-4 fade-scale">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-sm">
                    <p className="font-semibold mb-1 text-amber-200 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Tiempo restante:{' '}
                      <span className="font-mono">
                        {Math.floor(tycSegundosRestantes / 60)}:
                        {(tycSegundosRestantes % 60).toString().padStart(2, '0')}
                      </span>
                    </p>
                    <p className="text-xs text-amber-100/80">
                      Ingresa el código de 6 dígitos que enviamos por{' '}
                      {tycCanal === 'WHATSAPP' ? 'WhatsApp' : tycCanal === 'EMAIL' ? 'correo' : 'WhatsApp y correo'}.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp">Código de verificación</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={tycOtpIngresado}
                      onChange={(e) => setTycOtpIngresado(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-[0.5em] font-mono input-premium"
                      autoFocus
                    />
                  </div>

                  <Button
                    className="w-full gradient-premium gradient-premium-hover btn-press"
                    onClick={validarOTPTyC}
                    disabled={tycValidandoOtp || tycOtpIngresado.length !== 6 || tycSegundosRestantes === 0}
                  >
                    {tycValidandoOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validar código
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTycPaso(1)}
                      disabled={tycValidandoOtp}
                    >
                      Cambiar canal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={enviarOTPTyC}
                      disabled={tycEnviandoOtp || tycSegundosRestantes > 0}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {tycSegundosRestantes > 0
                        ? `Reenviar en ${tycSegundosRestantes}s`
                        : 'Reenviar código'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Paso 3: Foto de la Cédula */}
              {tycPaso === 3 && (
                <div className="space-y-4 fade-scale">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-sm">
                    <p className="font-semibold mb-1 text-emerald-200 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Identidad verificada
                    </p>
                    <p className="text-xs text-emerald-100/80">
                      Ahora toma o sube una foto clara de tu cédula de ciudadanía. Puedes usar la cámara o subir un archivo. Si necesitas cambiar de cámara, usa el botón "Girar cámara".
                    </p>
                  </div>

                  <FotoCaptureFirma
                    label="Foto de la cédula (frente)"
                    descripcion="Asegúrate de que se vean todos los datos (frente completo)."
                    valor={tycFotoDocumento}
                    onChange={(v) => setTycFotoDocumento(v)}
                    initialFacing="environment"
                    mirror={false}
                  />

                  <Button
                    className="w-full gradient-premium gradient-premium-hover btn-press"
                    onClick={() => setTycPaso(4)}
                    disabled={!tycFotoDocumento}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Continuar a selfie con cédula
                  </Button>
                </div>
              )}

              {/* Paso 4: Selfie sosteniendo la Cédula */}
              {tycPaso === 4 && (
                <div className="space-y-4 fade-scale">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-sm">
                    <p className="font-semibold mb-1 text-blue-200 flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Último paso: selfie con cédula
                    </p>
                    <p className="text-xs text-blue-100/80">
                      Toma una foto sosteniendo tu cédula junto a tu rostro. Esta
                      imagen se usará como respaldo de tu firma electrónica en el pagaré.
                    </p>
                  </div>

                  {/* Resumen: foto cédula ya cargada */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <img
                      src={tycFotoDocumento || ''}
                      alt="Cédula"
                      className="w-12 h-12 object-cover rounded-lg border border-white/10"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Foto de cédula cargada
                      </p>
                      <button
                        type="button"
                        onClick={() => setTycPaso(3)}
                        className="text-[10px] text-blue-300 hover:underline"
                      >
                        Volver a editar cédula
                      </button>
                    </div>
                  </div>

                  <FotoCaptureFirma
                    label="Selfie sosteniendo la cédula"
                    descripcion="Tu rostro completo y la cédula deben verse nítidos. Usa la cámara frontal para mayor comodidad."
                    valor={tycFotoSelfie}
                    onChange={(v) => setTycFotoSelfie(v)}
                    initialFacing="user"
                    mirror
                  />

                  <Button
                    className="w-full gradient-premium gradient-premium-hover btn-press"
                    onClick={confirmarAceptacionTyC}
                    disabled={tycGuardando || !tycFotoSelfie}
                  >
                    {tycGuardando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Activando préstamo...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Confirmar y activar préstamo
                      </>
                    )}
                  </Button>
                </div>
              )}

              <DialogFooter className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cerrarFlujoTyC()}
                  disabled={tycGuardando}
                >
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* === MODAL DE ADVERTENCIA DE INACTIVIDAD === */}
        {inactivityWarning && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Clock3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">¿Sigues ahí?</h3>
                    <p className="text-xs opacity-90">Tu sesión está por expirar</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3 text-center">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Por seguridad, cerraremos tu sesión en{' '}
                  <strong className="text-amber-300 text-lg">
                    {inactivitySecondsLeft}
                  </strong>{' '}
                  segundo{inactivitySecondsLeft === 1 ? '' : 's'} por inactividad.
                </p>
                <p className="text-xs text-slate-400">
                  Si deseas continuar, haz clic en el botón para extender tu sesión.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      confirmLogoutRef.current = true
                      if (typeof window !== 'undefined' && vistaHistoryRef.current.length > 1) {
                        try {
                          window.history.go(-(vistaHistoryRef.current.length - 1))
                        } catch {}
                      }
                      onClose()
                    }}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cerrar ahora
                  </Button>
                  <Button
                    type="button"
                    onClick={extenderSesion}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  >
                    <Clock3 className="w-4 h-4 mr-1.5" />
                    Seguir conectado
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// LETRERO ELECTRÓNICO — Aviso de cuenta de pago
// Muestra la cuenta bancaria asignada al cliente donde
// debe realizar sus pagos (Bancolombia / Davivienda / etc.).
// Se alimenta de `data.cuentaRecaudoPrincipal` que retorna
// /api/portal/[cedula] según la categoría del cliente.
// =====================================================
function AvisoCuentaPago({ cuenta }: { cuenta?: CuentaRecaudoInfo | null }) {
  // Si no hay cuenta asignada, no mostramos el letrero
  if (!cuenta || !cuenta.numeroCuenta) {
    return null
  }

  // Formatear el número de cuenta en grupos legibles
  // ej: "42061620839" → "420-616208-39" si tiene 11 dígitos
  const fmtCuenta = (num: string) => {
    const clean = (num || '').replace(/\s+/g, '')
    // Patrón Bancolombia típico: 3-6-2 dígitos
    if (/^\d{11}$/.test(clean)) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 9)}-${clean.slice(9, 11)}`
    }
    // Otros formatos con guiones ya puestos: dejar igual
    return clean
  }

  const bancoUpper = (cuenta.banco || '').toUpperCase()
  const esBancolombia = bancoUpper.includes('BANCOLOMBIA')

  return (
    <div className="led-sign fade-scale" role="status" aria-live="polite">
      {/* Pestaña superior — AVISO IMPORTANTE */}
      <div className="flex items-center justify-between mb-1.5 pl-3">
        <span className="led-tag">
          <AlertTriangle className="w-2.5 h-2.5" />
          AVISO IMPORTANTE
        </span>
        <span className="led-pill">
          <Lock className="w-2.5 h-2.5" />
          CUENTA EXCLUSIVA
        </span>
      </div>

      {/* Pantalla LED interior */}
      <div className="led-screen relative">
        {/* Barras LED decorativas a la izquierda */}
        <div className="led-bars">
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* Barrido de scan LED */}
        <div className="led-scan"></div>

        {/* Contenido principal del letrero */}
        <div className="pl-3 pr-1">
          <p className="led-text text-[11px] sm:text-xs font-bold leading-tight mb-1">
            RECUERDA QUE EL PAGO DE TUS CUOTAS
          </p>
          <p className="led-text text-[11px] sm:text-xs font-bold leading-tight mb-2">
            DEBES REALIZARLO SOLO A LA CUENTA:
          </p>

          <div className="flex flex-col gap-0.5 mb-1.5">
            <p className="led-text-amber text-[10px] font-semibold uppercase tracking-wider">
              {cuenta.banco} · {cuenta.tipoCuenta}
            </p>
            <p className="led-text-amber text-base sm:text-lg font-black tracking-wider font-mono">
              {fmtCuenta(cuenta.numeroCuenta)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-cyan-400/15">
            <p className="text-[9px] text-cyan-200/70 leading-tight">
              {esBancolombia
                ? 'No recibas instrucciones de pago por otros canales.'
                : 'Cuenta asignada según tu categoría.'}
            </p>
            <span className="led-text text-[9px] font-bold uppercase tracking-wider">
              JSADR
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// VISTA: HUB (pantalla principal)
// =====================================================
function HubView({
  cliente,
  kpis,
  resumen,
  hubItems,
  onSelect,
  cuentaRecaudoPrincipal,
  onEstadoCuenta,
}: {
  cliente: PortalClienteInfo
  kpis: PortalKPIS
  resumen: PortalData['resumen']
  hubItems: HubItemConfig[]
  onSelect: (id: HubItemId) => void
  cuentaRecaudoPrincipal?: CuentaRecaudoInfo | null
  onEstadoCuenta?: (prestamoId?: string) => void
}) {
  return (
    <div className="space-y-5 fade-scale">
      {/* === LETRERO ELECTRÓNICO — AVISO DE CUENTA DE PAGO === */}
      <AvisoCuentaPago cuenta={cuentaRecaudoPrincipal} />

      {/* === HERO: HUB CIRCULAR === */}
      <div className="relative w-full aspect-square max-w-[340px] mx-auto hub-stage rounded-full">
        {/* Anillos orbitales decorativos */}
        <div
          className="hub-ring"
          style={{ width: '92%', height: '92%' }}
        ></div>
        <div
          className="hub-ring hub-ring-outer rotate-slow"
          style={{ width: '100%', height: '100%' }}
        ></div>

        {/* Logo central (Jsadr) */}
        <div className="hub-center hub-breathe w-20 h-20 sm:w-24 sm:h-24">
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-none">J</span>
            <span className="text-[8px] text-white/80 tracking-[0.25em] mt-0.5">JSADR</span>
          </div>
        </div>

        {/* Items del hub alrededor — iconos premium con halo, profundidad y shimmer */}
        {hubItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="hub-item"
              style={{
                transform: `translate(-50%, -50%) translate(${item.position.x}px, ${item.position.y}px)`,
              }}
              aria-label={item.label}
            >
              <div
                className="hub-tile-wrap"
                style={{ animationDelay: `${idx * 0.18}s` }}
              >
                {/* Halo de resplandor detrás del icono */}
                <div className={`hub-halo bg-gradient-to-br ${item.gradient}`}></div>

                {/* Anillo decorativo translúcido */}
                <div className={`hub-ring-decor bg-gradient-to-br ${item.gradient}`}></div>

                {/* Tarjeta principal del icono */}
                <div className={`hub-tile bg-gradient-to-br ${item.gradient}`}>
                  {/* Reflejo superior-izquierdo (luz) */}
                  <div className="hub-tile-highlight"></div>
                  {/* Patrón sutil de profundidad */}
                  <div className="hub-tile-pattern"></div>
                  {/* Icono principal */}
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white relative z-10" strokeWidth={2.2} />
                  {/* Brillo deslizante */}
                  <div className="hub-tile-shimmer"></div>
                </div>

                {/* Badge de notificación */}
                {item.badge && item.badge > 0 && (
                  <span className="hub-badge">
                    {item.badge}
                  </span>
                )}

                {/* Punto de estado inferior (acento de color) */}
                <span className={`hub-status-dot bg-gradient-to-br ${item.gradient}`}></span>
              </div>

              <span className={`text-[11px] sm:text-xs font-bold ${item.color} hub-label`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* === KPI: SALDO DESTACADO === */}
      <Card className="premium-card premium-card-hover rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                Saldo Total Activos
              </p>
              <p className="text-2xl font-black text-amber-300 mt-0.5 tracking-tight">
                {formatearMoneda(resumen.saldoTotalActivos)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="chip-premium !text-[9px] !py-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                {resumen.prestamosActivos} activos
              </span>
              {resumen.prestamosCancelados > 0 && (
                <span className="text-[10px] text-emerald-300 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" />
                  {resumen.prestamosCancelados} cancelados
                </span>
              )}
            </div>
          </div>

          {/* Barra de progreso del avance promedio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Avance promedio</span>
              <span className="font-bold text-emerald-300">
                {kpis.porcentajeAvancePromedio.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full progress-shimmer rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, kpis.porcentajeAvancePromedio)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === 3 KPIs premium en grid === */}
      <div className="grid grid-cols-3 gap-2">
        {/* Score */}
        <Card className="premium-card premium-card-hover rounded-2xl">
          <CardContent className="p-2.5 flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1 self-start">
              <Award className="w-3 h-3 text-violet-300" />
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Score
              </p>
            </div>
            <ScoreCircular score={kpis.scorePago} />
          </CardContent>
        </Card>

        {/* Próximo pago */}
        <Card className="premium-card premium-card-hover rounded-2xl">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-1 mb-1.5">
              <CalendarClock className="w-3 h-3 text-cyan-300" />
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Próx. Pago
              </p>
            </div>
            <p className="text-sm font-bold text-cyan-300 leading-tight">
              {formatearMoneda(kpis.montoProximoPago)}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
              {kpis.proximoVencimiento ? formatearFecha(kpis.proximoVencimiento) : 'Sin vencim.'}
            </p>
            <div className="mt-1.5">
              <DiasRestantesBadge dias={kpis.diasProximoPago} />
            </div>
          </CardContent>
        </Card>

        {/* Estado salud */}
        <Card className="premium-card premium-card-hover rounded-2xl">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-1 mb-1.5">
              <HeartPulse className="w-3 h-3 text-emerald-300" />
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Salud
              </p>
            </div>
            <p className="text-sm font-bold text-emerald-300 leading-tight">
              {kpis.estadoSalud}
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700"
                style={{ width: `${Math.min(100, kpis.porcentajeAvancePromedio)}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {kpis.totalCuotasPendientes} cuotas pend.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Acceso rápido: Paz y salvo / Estado cuenta === */}
      <Card className="premium-card premium-card-hover rounded-2xl">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
              <FileDown className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Estado de Cuenta Completo</p>
              <p className="text-[10px] text-muted-foreground truncate">
                Documento imprimible con todos tus créditos
              </p>
            </div>
            <Button
              size="sm"
              className="gradient-premium gradient-premium-hover btn-press h-8 text-[11px]"
              onClick={() => onEstadoCuenta?.()}
            >
              <Printer className="w-3 h-3 mr-1" />
              Ver
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// VISTA: MIS CRÉDITOS
// =====================================================
function PrestamosView({
  prestamos,
  onAbrirTyC,
  onAceptarTyC,
  onPazYSalvo,
  onEstadoCuenta,
}: {
  prestamos: any[]
  onAbrirTyC: (prestamoId: string, codigo: string) => void
  onAceptarTyC: (prestamoId: string) => Promise<void>
  onPazYSalvo: (prestamoId: string, codigo: string, estado?: string, saldoTotal?: number, cuotasPagadas?: number, numeroCuotas?: number) => void
  onEstadoCuenta: (prestamoId?: string) => void
}) {
  if (prestamos.length === 0) {
    return (
      <EmptyStatePremium
        icon={FileText}
        title="No tienes créditos registrados"
        subtitle="Cuando tengas un crédito activo, aparecerá aquí."
      />
    )
  }

  return (
    <div className="space-y-3 fade-scale">
      {/* Banner estado cuenta global */}
      <Card className="premium-card rounded-2xl border-cyan-400/30">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-cyan-200">Estado de Cuenta</p>
            <p className="text-[10px] text-muted-foreground">Descarga el documento completo</p>
          </div>
          <Button
            size="sm"
            onClick={() => onEstadoCuenta()}
            className="gradient-premium gradient-premium-hover btn-press h-8"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            PDF
          </Button>
        </CardContent>
      </Card>

      {prestamos.map((p) => {
        const avance = p.numeroCuotas > 0 ? (p.cuotasPagadas / p.numeroCuotas) * 100 : 0
        const cancelado = p.estado === 'CANCELADO'
        const pendienteAcept = p.estado === 'PENDIENTE_ACEPTACION'
        return (
          <Card
            key={p.id}
            className={`premium-card premium-card-hover rounded-2xl ${
              pendienteAcept
                ? 'border-amber-400/50'
                : cancelado
                ? 'border-emerald-400/40'
                : ''
            }`}
          >
            <CardContent className="p-3.5">
              {/* Header: código + estado + saldo */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold">{p.codigo}</span>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Solicitado: {formatearFecha(p.fechaSolicitud)}
                    {p.fechaDesembolso && ` · Desembolso: ${formatearFecha(p.fechaDesembolso)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Saldo</p>
                  <p className="font-bold text-amber-300 text-sm">{formatearMoneda(p.saldoTotal)}</p>
                </div>
              </div>

              {/* Grid denso financiero */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-2.5">
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Principal</p>
                  <p className="font-semibold text-[11px]">{formatearMoneda(p.montoPrincipal)}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cuota</p>
                  <p className="font-semibold text-[11px]">{formatearMoneda(p.montoCuota)}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Pagadas</p>
                  <p className="font-semibold text-[11px]">{p.cuotasPagadas}/{p.numeroCuotas}</p>
                </div>
              </div>

              {/* Barra de avance */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-muted-foreground shrink-0">Avance</span>
                <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full progress-shimmer rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, avance)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-emerald-300 shrink-0 w-9 text-right">
                  {avance.toFixed(0)}%
                </span>
              </div>

              {/* Banner mora */}
              {p.diasMora > 0 && p.estado === 'EN_MORA' && (
                <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-400/30 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-[11px] text-red-200">
                    <strong>En mora:</strong> {p.diasMora} días · {formatearMoneda(p.montoMora)}
                  </p>
                </div>
              )}

              {/* Banner pendiente aceptación */}
              {pendienteAcept && (
                <div className="mb-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30">
                  <p className="text-xs font-semibold text-amber-200 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Requiere tu aceptación
                  </p>
                  <p className="text-[10px] text-amber-100/80 mb-2">
                    Activa tu préstamo con verificación OTP + foto selfie con cédula.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => onAbrirTyC(p.id, p.codigo)}
                    className="gradient-premium gradient-premium-hover btn-press w-full h-8"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    Acepto Términos y Condiciones
                  </Button>
                </div>
              )}

              {/* Cuenta de recaudo */}
              {p.cuentaRecaudoPago && (p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION') && (
                <div className="mb-2.5 p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-400/20">
                  <p className="text-[10px] font-semibold text-cyan-200 mb-1.5 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    Cuenta para pagar
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Banco:</span>{' '}
                      <strong>{p.cuentaRecaudoPago.banco}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>{' '}
                      <strong>{p.cuentaRecaudoPago.tipoCuenta}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">N°:</span>{' '}
                      <strong className="font-mono">{p.cuentaRecaudoPago.numeroCuenta}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones acción */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEstadoCuenta(p.id)}
                  className="text-[10px] h-7 input-premium"
                >
                  <FileDown className="w-3 h-3 mr-1" />
                  Estado cuenta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPazYSalvo(p.id, p.codigo, p.estado, p.saldoTotal, p.cuotasPagadas, p.numeroCuotas)}
                  className={`text-[10px] h-7 ${
                    cancelado
                      ? 'border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10'
                      : 'border-amber-400/40 text-amber-300 hover:bg-amber-500/10'
                  }`}
                  title={cancelado ? 'Descargar certificado de paz y salvo' : 'El crédito aún está vigente'}
                >
                  <FileCheck className="w-3 h-3 mr-1" />
                  {cancelado ? 'Paz y salvo' : '🔒 Paz y salvo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =====================================================
// VISTA: PRÓXIMOS PAGOS
// =====================================================
function ProximosPagosView({
  prestamos,
  onPagar,
}: {
  prestamos: any[]
  onPagar: (prestamoId: string, monto: number, numeroCuota: number) => void
}) {
  const proximos = prestamos
    .filter((p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA')
    .flatMap((p) =>
      (p.pagos || [])
        .filter((pg: any) => pg.estado === 'PENDIENTE')
        .map((pg: any) => ({ ...pg, prestamo: p }))
    )
    .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())

  if (proximos.length === 0) {
    return (
      <EmptyStatePremium
        icon={CalendarClock}
        title="No tienes pagos pendientes"
        subtitle="¡Estás al día con tus obligaciones!"
      />
    )
  }

  // === Identificar el próximo pago más urgente (vence hoy o mañana) ===
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const proximoUrgente = proximos.find((pg) => {
    const venc = new Date(pg.fechaVencimiento)
    venc.setHours(0, 0, 0, 0)
    const diff = Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 1
  })

  return (
    <div className="space-y-3 fade-scale">
      {/* Banner de recordatorio destacado (solo si hay cuota que vence hoy o mañana) */}
      {proximoUrgente && (
        <div className="rounded-xl p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-400/60">
          <div className="flex items-start gap-2">
            <BellRing className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-200">
                ⏰ Recordatorio: cuota vence {new Date(proximoUrgente.fechaVencimiento).toDateString() === hoy.toDateString() ? 'hoy' : 'mañana'}
              </p>
              <p className="text-[10px] text-amber-100/80 mt-0.5">
                Préstamo <span className="font-mono font-bold">{proximoUrgente.prestamo.codigo}</span> · Cuota {proximoUrgente.numeroCuota} · <span className="font-bold">{formatearMoneda(proximoUrgente.montoTotal)}</span>
              </p>
              <p className="text-[10px] text-amber-100/70 mt-1">
                Recuerda que enviamos un recordatorio automático el día anterior al vencimiento a tu correo y WhatsApp según tus preferencias.
              </p>
            </div>
          </div>
        </div>
      )}

      {proximos.map((pg: any) => {
        const venc = new Date(pg.fechaVencimiento)
        venc.setHours(0, 0, 0, 0)
        const hoyMid = new Date()
        hoyMid.setHours(0, 0, 0, 0)
        const dias = Math.round((venc.getTime() - hoyMid.getTime()) / (1000 * 60 * 60 * 24))
        const vencido = dias < 0
        const esHoy = dias === 0
        const esManana = dias === 1
        const recordatorioEnviado = !!pg.recordatorioEnviadoEn

        return (
          <Card
            key={pg.id}
            className={`premium-card premium-card-hover rounded-2xl ${
              vencido ? 'border-red-400/40' : (esHoy || esManana) ? 'border-amber-400/50' : ''
            }`}
          >
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold">{pg.prestamo.codigo}</span>
                    <Badge variant="outline" className="text-[10px] h-5">Cuota {pg.numeroCuota}</Badge>
                    {vencido && (
                      <Badge variant="destructive" className="text-[10px] h-5">Vencido</Badge>
                    )}
                    {esHoy && (
                      <Badge className="text-[10px] h-5 bg-orange-500/30 text-orange-200 border-orange-400/50">Vence hoy</Badge>
                    )}
                    {esManana && (
                      <Badge className="text-[10px] h-5 bg-amber-500/30 text-amber-200 border-amber-400/50">Vence mañana</Badge>
                    )}
                    {recordatorioEnviado && !vencido && (
                      <Badge variant="outline" className="text-[10px] h-5 border-blue-400/40 text-blue-300">
                        <BellRing className="w-2.5 h-2.5 mr-1" />
                        Recordatorio enviado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Vence: <strong>{formatearFecha(pg.fechaVencimiento)}</strong>
                    {vencido ? ` · ${Math.abs(dias)}d atrás` : dias === 0 ? ' · hoy' : ` · en ${dias}d`}
                  </p>
                </div>
                <DiasRestantesBadge dias={dias} />
              </div>

              <p className="text-xl font-black text-amber-300 mb-2.5">
                {formatearMoneda(pg.montoTotal)}
              </p>

              {(esHoy || esManana) && (
                <p className="text-[10px] text-amber-200/80 mb-2 italic">
                  💡 Paga a tiempo para evitar intereses moratorios.
                </p>
              )}

              <Button
                size="sm"
                onClick={() => onPagar(pg.prestamo.id, pg.montoTotal, pg.numeroCuota)}
                className="gradient-premium gradient-premium-hover btn-press w-full h-9"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagar con Bancolombia
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =====================================================
// VISTA: HISTORIAL DE PAGOS
// =====================================================
function HistorialView({ prestamos }: { prestamos: any[] }) {
  const pagos = prestamos.flatMap((p) => (p.pagos || []).map((pg: any) => ({ ...pg, prestamo: p })))

  if (pagos.length === 0) {
    return (
      <EmptyStatePremium
        icon={History}
        title="No hay pagos registrados"
        subtitle="Tu historial de pagos aparecerá aquí."
      />
    )
  }

  return (
    <div className="space-y-2 fade-scale">
      {pagos.map((pg) => (
        <Card key={pg.id} className="premium-card premium-card-hover rounded-2xl">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold truncate">{pg.prestamo.codigo}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Cuota {pg.numeroCuota} · {pg.metodoPago}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-300">
                  {formatearMoneda(pg.montoTotal)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {formatearFecha(pg.fechaPago)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] h-5">{pg.estado}</Badge>
              <span className="text-[9px] text-muted-foreground">
                Venc: {formatearFecha(pg.fechaVencimiento)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// =====================================================
// VISTA: AVISOS (Notificaciones)
// =====================================================
function AvisosView({
  notificaciones,
  notifStats,
}: {
  notificaciones: NotificacionItem[]
  notifStats: NotificacionesStats
}) {
  return (
    <div className="space-y-3 fade-scale">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="premium-card rounded-2xl">
          <CardContent className="p-2.5 text-center">
            <Bell className="w-4 h-4 mx-auto mb-0.5 text-primary" />
            <p className="text-[9px] text-muted-foreground">Total</p>
            <p className="text-base font-bold">{notifStats.total}</p>
          </CardContent>
        </Card>
        <Card className="premium-card rounded-2xl">
          <CardContent className="p-2.5 text-center">
            <AlertTriangle className="w-4 h-4 mx-auto mb-0.5 text-amber-400" />
            <p className="text-[9px] text-muted-foreground">No leídas</p>
            <p className="text-base font-bold text-amber-300">{notifStats.noLeidas}</p>
          </CardContent>
        </Card>
        <Card className="premium-card rounded-2xl">
          <CardContent className="p-2.5 text-center">
            <Clock className="w-4 h-4 mx-auto mb-0.5 text-cyan-400" />
            <p className="text-[9px] text-muted-foreground">Pendientes</p>
            <p className="text-base font-bold text-cyan-300">{notifStats.pendientes}</p>
          </CardContent>
        </Card>
      </div>

      {notificaciones.length === 0 ? (
        <EmptyStatePremium
          icon={Bell}
          title="No tienes notificaciones"
          subtitle="Las alertas y avisos aparecerán aquí."
        />
      ) : (
        <div className="space-y-2">
          {notificaciones.map((n) => (
            <Card key={n.id} className="premium-card premium-card-hover rounded-2xl">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    n.estado === 'ENVIADO' ? 'bg-emerald-500/15' :
                    n.estado === 'FALLIDO' ? 'bg-red-500/15' : 'bg-white/5'
                  }`}>
                    <Bell className={`w-3.5 h-3.5 ${
                      n.estado === 'ENVIADO' ? 'text-emerald-300' :
                      n.estado === 'FALLIDO' ? 'text-red-300' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[9px] h-4">{n.tipo}</Badge>
                      <span className="text-[9px] text-muted-foreground">
                        {formatearFecha(n.fechaEnvio)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-snug">{n.mensaje}</p>
                    <Badge
                      variant={
                        n.estado === 'ENVIADO' ? 'default' :
                        n.estado === 'FALLIDO' ? 'destructive' :
                        'secondary'
                      }
                      className="text-[9px] h-4 mt-1"
                    >
                      {n.estado}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// VISTA: CAMPAÑAS
// =====================================================
function CampanasView({ campanas }: { campanas: any[] }) {
  if (campanas.length === 0) {
    return (
      <EmptyStatePremium
        icon={Megaphone}
        title="No hay campañas activas"
        subtitle="Las promociones y campañas aparecerán aquí."
      />
    )
  }

  return (
    <div className="space-y-3 fade-scale">
      {campanas.map((c) => (
        <Card key={c.id} className="premium-card premium-card-hover rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"></div>
            <div className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="chip-premium !text-[9px] !py-0.5">
                  {c.tipo}
                </span>
              </div>
              <h4 className="font-bold text-sm">{c.titulo}</h4>
              <p className="text-xs text-muted-foreground mt-1">{c.descripcion}</p>
              {c.contenido && (
                <p className="text-[11px] mt-2 text-foreground/80 whitespace-pre-wrap p-2 rounded-lg bg-white/5">
                  {c.contenido}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// =====================================================
// COMPONENTE: Estado vacío premium
// =====================================================
function EmptyStatePremium({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof FileText
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center fade-scale">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center mb-4 float-y">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{subtitle}</p>
    </div>
  )
}

// =====================================================
// Componente: Score Circular (SVG) — PRESERVADO con rediseño
// =====================================================
function ScoreCircular({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const radio = 32
  const circunferencia = 2 * Math.PI * radio
  const offset = circunferencia - (pct / 100) * circunferencia
  const color =
    pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444'
  const etiqueta =
    pct >= 80 ? 'Excelente' : pct >= 60 ? 'Bueno' : pct >= 40 ? 'Regular' : 'Bajo'

  return (
    <div className="relative">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radio}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>
          {Math.round(pct)}
        </span>
        <span className="text-[8px] text-muted-foreground uppercase tracking-wide">
          {etiqueta}
        </span>
      </div>
    </div>
  )
}

// =====================================================
// Componente: Badge de días restantes — PRESERVADO con rediseño
// =====================================================
function DiasRestantesBadge({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <Badge variant="destructive" className="text-[9px] h-4">
        Vencido {Math.abs(dias)}d
      </Badge>
    )
  }
  if (dias <= 3) {
    return (
      <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-[9px] h-4">
        {dias === 0 ? 'Hoy' : `${dias}d`}
      </Badge>
    )
  }
  if (dias <= 7) {
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[9px] h-4">
        {dias}d
      </Badge>
    )
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[9px] h-4">
      {dias}d
    </Badge>
  )
}

// =====================================================
// Badge de estado — PRESERVADO
// =====================================================
function EstadoBadge({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    SOLICITUD: { label: 'Solicitud', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
    PENDIENTE_ACEPTACION: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    ACTIVO: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    EN_MORA: { label: 'En Mora', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
    JURIDICO: { label: 'Jurídico', className: 'bg-orange-500/15 text-orange-300 border-orange-400/30' },
    CANCELADO: { label: 'Cancelado', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    RECHAZADO: { label: 'Rechazado', className: 'bg-white/10 text-foreground border-white/20' },
  }
  const cfg = config[estado] || { label: estado, className: 'bg-white/10 text-foreground border-white/20' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// =====================================================
// Helper: plazo en meses desde cuotas y frecuencia — PRESERVADO
// =====================================================
function plazoMesesDesdeCuotas(numeroCuotas: number, frecuencia: Frecuencia): number {
  switch (frecuencia) {
    case 'MENSUAL':
      return numeroCuotas
    case 'QUINCENAL':
      return Math.ceil(numeroCuotas / 2)
    case 'SEMANAL':
      return Math.ceil(numeroCuotas / 4.345)
    case 'DIARIO':
      return Math.ceil(numeroCuotas / 30)
    default:
      return numeroCuotas
  }
}

// =====================================================
// Componente: Simulador de Crédito — PRESERVADO con rediseño
// =====================================================
const TASA_GENERAL_DEFAULT_SIM = 24

function SimuladorCredito({
  clienteId,
  token,
  tasaPersonalizadaInicial,
}: {
  clienteId: string
  token?: string
  tasaPersonalizadaInicial?: { tiene: boolean; valor: number | null }
}) {
  const { toast } = useToast()
  const [valorSolicitado, setValorSolicitado] = useState<string>('1000000')
  const [numeroCuotas, setNumeroCuotas] = useState<string>('12')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('MENSUAL')
  const [fechaPrimerPago, setFechaPrimerPago] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)

  // === Flexibilidad Financiera (beneficio visible para TODOS los clientes) ===
  // DOS tarifas:
  //   - BASICA:  $15.000 COP — 1 uso durante la vigencia
  //   - PREMIUM: $34.900 COP — 2 usos durante la vigencia
  // Regla de negocio: la opción DEBE aparecer en todas las simulaciones del
  // portal del cliente. Solo se puede ACTIVAR si la simulación tiene 4 o más
  // cuotas; con menos cuotas se muestra inhabilitada con explicación.
  const [flexibilidadFinanciera, setFlexibilidadFinanciera] = useState(false)
  const [flexibilidadModalidad, setFlexibilidadModalidad] = useState<'BASICA' | 'PREMIUM'>('BASICA')
  const FLEXIBILIDAD_COSTO_BASICA = 15000
  const FLEXIBILIDAD_COSTO_PREMIUM = 34900
  const FLEXIBILIDAD_COSTO = flexibilidadModalidad === 'PREMIUM' ? FLEXIBILIDAD_COSTO_PREMIUM : FLEXIBILIDAD_COSTO_BASICA

  // === Renovación Anticipada (beneficio opcional con cobro único) ===
  // El cliente puede activar este beneficio en el simulador del portal
  // por un cobro único de $9.900 COP. Le da derecho a:
  //   - Reserva anticipada de su cupo para el siguiente ciclo
  //   - Prioridad en el procesamiento de su próxima solicitud
  //   - Tasa preferencial mantenida (sin re-evaluación)
  //   - Aceleración del proceso de desembolso
  // El cobro se hace UNA sola vez al inicio del crédito y se registra
  // automáticamente en la caja CAJA-RENOVACIONES.
  const [renovacionAnticipada, setRenovacionAnticipada] = useState(false)
  const RENOVACION_ANTICIPADA_COSTO = 9900

  // === Flujo de Clave Dinámica (confirmación para enviar solicitud) ===
  const [claveDinamicaSolicitada, setClaveDinamicaSolicitada] = useState(false)
  const [claveDinamicaEnviando, setClaveDinamicaEnviando] = useState(false)
  const [claveDinamicaValor, setClaveDinamicaValor] = useState<string>('')
  const [claveDinamicaValidando, setClaveDinamicaValidando] = useState(false)
  const [claveDinamicaVerificada, setClaveDinamicaVerificada] = useState(false)
  const [otpRegistroId, setOtpRegistroId] = useState<string | null>(null)
  const [codigoConfirmacion, setCodigoConfirmacion] = useState<string | null>(null)
  const [emailEnmascarado, setEmailEnmascarado] = useState<string | null>(null)
  const [expiraEn, setExpiraEn] = useState<string | null>(null)
  const [segundosRestantes, setSegundosRestantes] = useState<number>(0)
  const [intentosClave, setIntentosClave] = useState<number>(3)

  const tieneTasaPers = !!tasaPersonalizadaInicial?.tiene
  const tasaPersValor = tasaPersonalizadaInicial?.valor ?? 0

  const calcularSimulacion = () => {
    const valor = parseFloat(valorSolicitado)
    const cuotas = parseInt(numeroCuotas, 10)
    if (isNaN(valor) || valor <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Ingresa un monto mayor a 0',
        variant: 'destructive',
      })
      return
    }
    if (isNaN(cuotas) || cuotas <= 0) {
      toast({
        title: 'Cuotas inválidas',
        description: 'Ingresa un número de cuotas mayor a 0',
        variant: 'destructive',
      })
      return
    }
    const fechaDesembolso = fechaPrimerPago ? new Date(fechaPrimerPago) : new Date()
    let res: ResultadoCalculo
    if (tieneTasaPers && tasaPersValor > 0) {
      res = calcularPrestamoTasaFijaMensual({
        montoPrincipal: valor,
        tasaMensualFija: tasaPersValor,
        numeroCuotas: cuotas,
        frecuencia,
        fechaDesembolso,
      })
    } else {
      const plazoMeses = plazoMesesDesdeCuotas(cuotas, frecuencia)
      res = calcularPrestamo({
        montoPrincipal: valor,
        tasaInteresAnual: TASA_GENERAL_DEFAULT_SIM,
        tasaMoraAnual: TASA_GENERAL_DEFAULT_SIM,
        plazoMeses,
        frecuencia,
        fechaDesembolso,
      })
    }
    setResultado(res)
  }

  // === Solicitar Clave Dinámica (envía OTP al correo del cliente) ===
  const solicitarClaveDinamica = async () => {
    if (!token) {
      toast({
        title: 'Sesión requerida',
        description: 'Inicia sesión para solicitar la clave.',
        variant: 'destructive',
      })
      return
    }
    try {
      setClaveDinamicaEnviando(true)
      setClaveDinamicaSolicitada(false)
      setClaveDinamicaVerificada(false)
      setClaveDinamicaValor('')
      setCodigoConfirmacion(null)
      setIntentosClave(3)

      const res = await fetch('/api/portal/clave-dinamica/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, token }),
      })
      const json = await res.json()

      if (json.success) {
        setClaveDinamicaSolicitada(true)
        setOtpRegistroId(json.otpRegistroId)
        setEmailEnmascarado(json.emailEnmascarado)
        setExpiraEn(json.expiraEn)
        toast({
          title: 'Clave enviada',
          description: `Hemos enviado tu clave dinámica al correo ${json.emailEnmascarado}. Válida por 5 minutos.`,
        })
      } else {
        toast({
          title: 'No se pudo enviar la clave',
          description: json.error || 'Intenta nuevamente',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setClaveDinamicaEnviando(false)
    }
  }

  // === Validar Clave Dinámica (verifica OTP y obtiene codigoConfirmacion) ===
  const validarClaveDinamica = async () => {
    if (!token || !otpRegistroId) return
    if (!claveDinamicaValor || claveDinamicaValor.trim().length !== 6) {
      toast({
        title: 'Clave inválida',
        description: 'Ingresa los 6 dígitos de tu clave dinámica.',
        variant: 'destructive',
      })
      return
    }
    try {
      setClaveDinamicaValidando(true)
      const res = await fetch('/api/portal/clave-dinamica/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          token,
          otpRegistroId,
          clave: claveDinamicaValor.trim(),
        }),
      })
      const json = await res.json()

      if (json.success) {
        setClaveDinamicaVerificada(true)
        setCodigoConfirmacion(json.codigoConfirmacion)
        toast({
          title: 'Clave verificada',
          description: 'Ya puedes enviar tu solicitud de crédito.',
        })
      } else {
        const restantes = json.intentosRestantes ?? 3
        setIntentosClave(restantes)
        if (json.bloqueado) {
          setClaveDinamicaSolicitada(false)
          setOtpRegistroId(null)
        }
        toast({
          title: 'Clave incorrecta',
          description: json.error || 'Intenta nuevamente',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setClaveDinamicaValidando(false)
    }
  }

  // === Enviar Solicitud (requiere codigoConfirmacion ya obtenido) ===
  const enviarSolicitud = async () => {
    if (!token) {
      toast({
        title: 'Sesión requerida',
        description: 'Inicia sesión para enviar tu solicitud.',
        variant: 'destructive',
      })
      return
    }
    if (!claveDinamicaVerificada || !codigoConfirmacion) {
      toast({
        title: 'Verificación requerida',
        description: 'Debes validar tu Clave Dinámica antes de enviar la solicitud.',
        variant: 'destructive',
      })
      return
    }
    try {
      setEnviando(true)
      // FIX: incluir x-portal-token en headers además del token en el body.
      // El proxy de seguridad acepta x-portal-token como credencial válida
      // para endpoints públicos (lista isPublicEndpoint), y el handler valida
      // el token del body contra cliente.tokenSesion con safeCompare.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-portal-token'] = token
      const res = await fetch('/api/solicitudes-web', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clienteId,
          token,
          valorSolicitado: parseFloat(valorSolicitado),
          numeroCuotas: parseInt(numeroCuotas, 10),
          frecuencia,
          primerPagoFecha: fechaPrimerPago,
          codigoConfirmacion,
          // === Flexibilidad Financiera (2 tarifas) ===
          flexibilidadFinanciera,
          flexibilidadModalidad,
          flexibilidadCosto: FLEXIBILIDAD_COSTO,
          // === Renovación Anticipada (cobro único $9.900) ===
          renovacionAnticipada,
          renovacionAnticipadaCosto: RENOVACION_ANTICIPADA_COSTO,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Solicitud enviada',
          description: `Código: ${json.data?.codigo}. Un asesor la revisará pronto.`,
        })
        // Reset del flujo de clave dinámica tras envío exitoso
        setClaveDinamicaSolicitada(false)
        setClaveDinamicaVerificada(false)
        setClaveDinamicaValor('')
        setCodigoConfirmacion(null)
        setOtpRegistroId(null)
      } else {
        // Si falla por codigoConfirmacion inválido, reset del flujo
        if (json.code === 'INVALID_CODIGO_CONFIRMACION') {
          setClaveDinamicaSolicitada(false)
          setClaveDinamicaVerificada(false)
          setCodigoConfirmacion(null)
          setOtpRegistroId(null)
        }
        toast({
          title: 'Error',
          description: json.error || 'No se pudo enviar la solicitud',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3 fade-scale">
      {/* Banner tasa aplicable */}
      <Card className="premium-card rounded-2xl">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tasa aplicable
            </p>
          </div>
          {tieneTasaPers && tasaPersValor > 0 ? (
            <Badge className="bg-violet-500/20 text-violet-200 border-violet-400/30">
              Tasa personalizada: {tasaPersValor}% mensual fija
            </Badge>
          ) : (
            <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30">
              Tasa general: {TASA_GENERAL_DEFAULT_SIM}% anual
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Formulario */}
      <Card className="premium-card rounded-2xl">
        <CardContent className="p-3.5 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sim-valor" className="text-xs">Valor solicitado (COP)</Label>
              <Input
                id="sim-valor"
                type="number"
                value={valorSolicitado}
                onChange={(e) => setValorSolicitado(e.target.value)}
                min={0}
                step={10000}
                className="input-premium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="sim-cuotas" className="text-xs">Cuotas</Label>
                <Input
                  id="sim-cuotas"
                  type="number"
                  value={numeroCuotas}
                  onChange={(e) => setNumeroCuotas(e.target.value)}
                  min={1}
                  step={1}
                  className="input-premium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frecuencia</Label>
                <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as Frecuencia)}>
                  <SelectTrigger className="input-premium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSUAL">Mensual</SelectItem>
                    <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                    <SelectItem value="SEMANAL">Semanal</SelectItem>
                    <SelectItem value="DIARIO">Diario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sim-fecha" className="text-xs">Fecha primer pago</Label>
              <Input
                id="sim-fecha"
                type="date"
                value={fechaPrimerPago}
                onChange={(e) => setFechaPrimerPago(e.target.value)}
                className="input-premium"
              />
            </div>
          </div>
          <Button
            onClick={calcularSimulacion}
            className="w-full gradient-premium gradient-premium-hover btn-press"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Simular crédito
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <div className="space-y-3 fade-scale">
          <div className="grid grid-cols-3 gap-2">
            <Card className="premium-card rounded-2xl">
              <CardContent className="p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cuota</p>
                <p className="text-sm font-bold text-cyan-300 mt-0.5">
                  {formatearMoneda(resultado.montoCuota)}
                </p>
              </CardContent>
            </Card>
            <Card className="premium-card rounded-2xl">
              <CardContent className="p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Interés</p>
                <p className="text-sm font-bold text-amber-300 mt-0.5">
                  {formatearMoneda(resultado.totalInteres)}
                </p>
              </CardContent>
            </Card>
            <Card className="premium-card rounded-2xl">
              <CardContent className="p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-sm font-bold text-emerald-300 mt-0.5">
                  {formatearMoneda(resultado.totalPagar)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla amortización */}
          <Card className="premium-card rounded-2xl">
            <CardContent className="p-0">
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                    <TableRow>
                      <TableHead className="text-[10px] h-8">#</TableHead>
                      <TableHead className="text-[10px] h-8">Venc.</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Cuota</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Interés</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.tablaAmortizacion.map((c) => (
                      <TableRow key={c.numero}>
                        <TableCell className="text-[10px] py-1.5">{c.numero}</TableCell>
                        <TableCell className="text-[10px] py-1.5">{formatearFecha(c.fechaVencimiento)}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right font-semibold">
                          {formatearMoneda(c.montoCuota)}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right text-amber-300">
                          {formatearMoneda(c.interes)}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right">
                          {formatearMoneda(c.saldoCapital)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-100/80">
              Esta simulación es referencial. La aprobación final está sujeta a estudio de crédito.
            </p>
          </div>

          {/* === Flexibilidad Financiera (visible para TODOS los clientes) === */}
          {/* DOS tarifas: Básica $15.000 (1 uso) | Premium $34.900 (2 usos) */}
          {/* Regla: la opción siempre se muestra. Si la simulación tiene < 4 cuotas, */}
          {/* se muestra inhabilitada con explicación. Si tiene ≥ 4, se puede activar. */}
          {(() => {
            const cuotas = parseInt(numeroCuotas, 10) || 0
            const elegible = cuotas >= 4
            return (
              <Card className={`premium-card rounded-2xl border-2 transition-colors ${
                flexibilidadFinanciera && elegible
                  ? 'border-emerald-500/60'
                  : elegible
                    ? 'border-emerald-500/20'
                    : 'border-muted-foreground/20'
              }`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        flexibilidadFinanciera && elegible
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          : 'bg-muted/40'
                      }`}>
                        <Sparkles className={`w-3.5 h-3.5 ${
                          flexibilidadFinanciera && elegible ? 'text-white' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          Flexibilidad Financiera
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              flexibilidadFinanciera && elegible
                                ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {flexibilidadFinanciera && elegible
                              ? `✨ ${flexibilidadModalidad} · +${formatearMoneda(FLEXIBILIDAD_COSTO)}`
                              : 'Opcional — 2 tarifas'}
                          </Badge>
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {elegible
                            ? flexibilidadFinanciera
                              ? `Activa · ${flexibilidadModalidad === 'PREMIUM' ? '2 usos' : '1 uso'} en la vigencia`
                              : 'Beneficio opcional disponible'
                            : `Requiere 4+ cuotas · Actual: ${cuotas}`}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="flexFlexPortalModal"
                      checked={flexibilidadFinanciera && elegible}
                      disabled={!elegible}
                      onChange={(e) => setFlexibilidadFinanciera(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Activar Flexibilidad Financiera"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground/90 leading-relaxed">
                    {elegible ? (
                      <ul className="list-disc list-inside space-y-0.5 ml-1">
                        <li>Trasladar UNA cuota al final del crédito</li>
                        <li>Solicitar cambio de fecha de pago (genera "Otro Sí" firmado con OTP)</li>
                      </ul>
                    ) : (
                      <p>
                        ℹ️ Esta simulación tiene <strong>{cuotas}</strong> cuota(s).
                        Flexibilidad Financiera está disponible a partir de <strong>4 cuotas</strong>.
                        Aumenta el plazo o reduce el monto para acceder al beneficio.
                      </p>
                    )}
                  </div>

                  {/* === Selector de modalidad (2 tarifas) === */}
                  {flexibilidadFinanciera && elegible && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setFlexibilidadModalidad('BASICA')}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          flexibilidadModalidad === 'BASICA'
                            ? 'border-emerald-500 bg-emerald-500/15'
                            : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-bold">Básica</span>
                          <span className="text-sm font-bold text-emerald-300">$15.000</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-tight">
                          1 uso · una vez en la vigencia
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlexibilidadModalidad('PREMIUM')}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          flexibilidadModalidad === 'PREMIUM'
                            ? 'border-emerald-500 bg-emerald-500/15'
                            : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-bold flex items-center gap-1">
                            Premium
                            <span className="text-[8px] px-1 py-0 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">REC</span>
                          </span>
                          <span className="text-sm font-bold text-emerald-300">$34.900</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-tight">
                          2 usos · para las dos cuotas del mes
                        </p>
                      </button>
                    </div>
                  )}

                  {/* === Ejemplo de beneficio === */}
                  {flexibilidadFinanciera && elegible && (
                    <div className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-100 leading-relaxed">
                      <div className="font-semibold mb-0.5">💡 ¿Cómo te beneficia?</div>
                      <p>
                        Si tu cuota es <strong>$200.000</strong> y no puedes pagar a tiempo, se generarían
                        intereses moratorios diarios (ej: <strong>$6.000/día</strong>) — en 5 días serían{' '}
                        <strong>$30.000</strong> solo en mora.
                      </p>
                      <p className="mt-1">
                        Con Flexibilidad Financiera puedes <strong>trasladar la cuota al final del crédito</strong> o{' '}
                        <strong>cambiar la fecha de pago</strong>, <strong>evitando el cobro de mora</strong>.
                        {' '}El cobro de <strong>{formatearMoneda(FLEXIBILIDAD_COSTO)}</strong> se hace una sola vez al inicio del crédito (cargado en la primera cuota).
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* === Renovación Anticipada (beneficio opcional, cobro único $9.900) === */}
          {/* El cliente puede activar este beneficio para reservar su cupo anticipadamente */}
          <Card className={`premium-card rounded-2xl border-2 transition-colors ${
            renovacionAnticipada
              ? 'border-amber-500/60'
              : 'border-amber-500/20'
          }`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    renovacionAnticipada
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-muted/40'
                  }`}>
                    <Repeat className={`w-3.5 h-3.5 ${renovacionAnticipada ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      Renovación Anticipada
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          renovacionAnticipada
                            ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {renovacionAnticipada
                          ? `✨ Activado · +${formatearMoneda(RENOVACION_ANTICIPADA_COSTO)}`
                          : 'Opcional · $9.900'}
                      </Badge>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {renovacionAnticipada
                        ? 'Beneficio activado · Reserva tu cupo para el siguiente crédito'
                        : 'Reserva tu cupo y obtén beneficios exclusivos'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="renovacionAnticipadaPortal"
                  checked={renovacionAnticipada}
                  onChange={(e) => setRenovacionAnticipada(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 shrink-0 cursor-pointer"
                  aria-label="Activar Renovación Anticipada"
                />
              </div>

              {/* Mensaje comercial persuasivo */}
              <div className="mt-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-100 leading-relaxed">
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> ¿Por qué tomar Renovación Anticipada?
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>
                    <strong>Reserva anticipada de tu cupo:</strong> asegura la
                    disponibilidad de tu monto para el siguiente ciclo de crédito,
                    sin depender de aprobaciones tardías.
                  </li>
                  <li>
                    <strong>Prioridad en el procesamiento:</strong> tu próxima
                    solicitud pasa al frente de la fila, reduciendo tiempos de
                    espera.
                  </li>
                  <li>
                    <strong>Tasa preferencial mantenida:</strong> conservas la
                    tasa actual sin re-evaluación, incluso si las condiciones del
                    mercado cambian.
                  </li>
                  <li>
                    <strong>Desembolso acelerado:</strong> al cancelar tu crédito
                    actual, el nuevo se desembolsa en menos de 24 horas hábiles.
                  </li>
                  <li>
                    <strong>Trámite simplificado:</strong> omites el cargue de
                    documentos y la validación de identidad en tu próxima solicitud.
                  </li>
                </ul>
                <p className="mt-2 pt-1.5 border-t border-amber-500/20">
                  💡 Por solo <strong>{formatearMoneda(RENOVACION_ANTICIPADA_COSTO)}</strong> pagaderos
                  una sola vez al inicio del crédito, te aseguras continuidad
                  financiera y ventajas exclusivas. El cobro se refleja en la
                  primera cuota y se notifica en tu estado de cuenta.
                </p>
              </div>

              {/* Banner de confirmación visual cuando está activo */}
              {renovacionAnticipada && (
                <div className="mt-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-100 flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    ✅ Beneficio activado. Se cobrarán{' '}
                    <strong>{formatearMoneda(RENOVACION_ANTICIPADA_COSTO)}</strong> una
                    sola vez al inicio del crédito. Tu solicitud tendrá marcador
                    de prioridad para el asesor.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* === PASO 1: Solicitar Clave Dinámica === */}
          {!claveDinamicaSolicitada && !claveDinamicaVerificada && (
            <Card className="premium-card rounded-2xl border-violet-500/30">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold">Confirmar con Clave Dinámica</p>
                    <p className="text-[10px] text-muted-foreground">
                      Para enviar tu solicitud, verifica tu identidad
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Te enviaremos una clave de 6 dígitos a tu correo registrado.
                  Deberás ingresarla para confirmar el envío de tu solicitud.
                </p>
                <Button
                  onClick={solicitarClaveDinamica}
                  disabled={claveDinamicaEnviando}
                  className="w-full gradient-premium gradient-premium-hover btn-press"
                >
                  {claveDinamicaEnviando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  {claveDinamicaEnviando ? 'Enviando clave...' : 'Solicitar Clave Dinámica'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* === PASO 2: Ingresar y validar Clave Dinámica === */}
          {claveDinamicaSolicitada && !claveDinamicaVerificada && (
            <Card className="premium-card rounded-2xl border-cyan-500/30 fade-scale">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">Ingresa tu Clave</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Enviada a: {emailEnmascarado}
                    </p>
                  </div>
                </div>

                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={claveDinamicaValor}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setClaveDinamicaValor(v)
                  }}
                  placeholder="______"
                  className="input-premium text-center text-2xl font-mono tracking-[0.5em] font-bold"
                  disabled={claveDinamicaValidando}
                />

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">
                    Intentos restantes: <span className="font-bold text-amber-300">{intentosClave}</span>
                  </span>
                  <span className="text-muted-foreground">Expira en 5 min</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={solicitarClaveDinamica}
                    disabled={claveDinamicaEnviando || claveDinamicaValidando}
                    variant="outline"
                    size="sm"
                    className="border-white/20 hover:bg-white/5"
                  >
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Reenviar
                  </Button>
                  <Button
                    onClick={validarClaveDinamica}
                    disabled={claveDinamicaValidando || claveDinamicaValor.length !== 6}
                    className="gradient-premium gradient-premium-hover btn-press"
                    size="sm"
                  >
                    {claveDinamicaValidando ? (
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3 mr-1.5" />
                    )}
                    {claveDinamicaValidando ? 'Validando...' : 'Validar Clave'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* === PASO 3: Clave verificada — Enviar solicitud === */}
          {claveDinamicaVerificada && (
            <Card className="premium-card rounded-2xl border-emerald-500/40 fade-scale">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-200">Identidad verificada</p>
                    <p className="text-[10px] text-muted-foreground">
                      Ya puedes enviar tu solicitud
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <Button
                  onClick={enviarSolicitud}
                  disabled={enviando}
                  className="w-full gradient-premium gradient-premium-hover btn-press"
                >
                  {enviando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {enviando ? 'Enviando...' : 'Enviar Solicitud de Crédito'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// =====================================================
// Componente: Mis Solicitudes (panel del cliente) — PRESERVADO con rediseño
// =====================================================
interface SolicitudWebItem {
  id: string
  codigo: string
  valorSolicitado: number
  numeroCuotas: number
  frecuencia: string
  tasaUtilizada: number
  tasaOrigen: string
  cuotaEstimada: number
  totalIntereses: number
  totalPagar: number
  primerPagoFecha: string | null
  estado: string
  observaciones: string | null
  fechaCreacion: string
  fechaRevision: string | null
  fechaConversion: string | null
  prestamoCreadoId: string | null
  // === Campos nuevos: flujo de firma + flexibilidad ===
  estadoFlujoFirma?: string
  flexibilidadFinanciera?: boolean
  flexibilidadModalidad?: string | null
  flexibilidadCosto?: number
}

function MisSolicitudesPanel({
  cedula,
  token,
  prestamosPendientes = [],
  onAbrirTyC,
}: {
  cedula: string
  token?: string
  prestamosPendientes?: any[]
  onAbrirTyC?: (prestamoId: string, codigo: string) => void
}) {
  const { toast } = useToast()
  const [solicitudes, setSolicitudes] = useState<SolicitudWebItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [generandoToken, setGenerandoToken] = useState<string | null>(null)

  const cargar = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      // FIX: incluir x-portal-token header además del token en query string.
      const headers: Record<string, string> = {}
      if (token) headers['x-portal-token'] = token
      const res = await fetch(
        `/api/solicitudes-web/cliente/${cedula}?token=${encodeURIComponent(token)}`,
        { headers }
      )
      const json = await res.json()
      if (json.success) {
        setSolicitudes(json.data?.solicitudes || [])
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedula, token])

  // === Generar token de firma electrónica y redirigir a /firma/[token] ===
  const iniciarFirmaElectronica = async (prestamoId: string, codigo: string) => {
    if (!token) {
      toast({ title: 'Error', description: 'Tu sesión ha expirado. Vuelve a iniciar sesión.', variant: 'destructive' })
      return
    }
    setGenerandoToken(prestamoId)
    try {
      const res = await fetch('/api/portal/iniciar-firma', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': token,
        },
        body: JSON.stringify({ prestamoId }),
      })
      const json = await res.json()
      if (json.success && json.data?.linkFirma) {
        toast({
          title: 'Abriendo firma electrónica',
          description: `Préstamo ${codigo} — completing los 4 pasos en una nueva pestaña.`,
        })
        // Abrir el flujo de firma en una nueva pestaña
        window.open(json.data.linkFirma, '_blank', 'noopener,noreferrer')
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudo iniciar la firma', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerandoToken(null)
    }
  }

  if (!token) {
    return (
      <EmptyStatePremium
        icon={ClipboardList}
        title="Inicia sesión"
        subtitle="Inicia sesión en el portal para ver tus solicitudes."
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-xs text-muted-foreground">Cargando solicitudes…</p>
      </div>
    )
  }

  const total = solicitudes.length + prestamosPendientes.length
  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length + prestamosPendientes.length
  const enProceso = solicitudes.filter((s) => s.estado === 'EN_REVISION').length
  const finalizadas = solicitudes.filter(
    (s) => s.estado === 'CONVERTIDA' || s.estado === 'APROBADA' || s.estado === 'RECHAZADA'
  ).length

  return (
    <div className="space-y-3 fade-scale">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-1.5">
        <Card className="premium-card rounded-xl">
          <CardContent className="p-2 text-center">
            <ClipboardList className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
            <p className="text-[8px] text-muted-foreground">Total</p>
            <p className="text-sm font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="premium-card rounded-xl">
          <CardContent className="p-2 text-center">
            <Clock className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-400" />
            <p className="text-[8px] text-muted-foreground">Pend.</p>
            <p className="text-sm font-bold text-amber-300">{pendientes}</p>
          </CardContent>
        </Card>
        <Card className="premium-card rounded-xl">
          <CardContent className="p-2 text-center">
            <FileText className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-400" />
            <p className="text-[8px] text-muted-foreground">Proc.</p>
            <p className="text-sm font-bold text-cyan-300">{enProceso}</p>
          </CardContent>
        </Card>
        <Card className="premium-card rounded-xl">
          <CardContent className="p-2 text-center">
            <CheckCircle className="w-3.5 h-3.5 mx-auto mb-0.5 text-emerald-400" />
            <p className="text-[8px] text-muted-foreground">Fin.</p>
            <p className="text-sm font-bold text-emerald-300">{finalizadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* === SECCIÓN NUEVA: Préstamos pendientes de aceptación de TyC === */}
      {prestamosPendientes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <p className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
              Pendientes de firma electrónica
            </p>
          </div>
          {prestamosPendientes.map((p) => (
            <Card key={p.id} className="premium-card premium-card-hover rounded-2xl border-amber-400/50">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold">{p.codigo}</span>
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Solicitado: {formatearFecha(p.fechaSolicitud || p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Principal</p>
                    <p className="font-bold text-amber-300 text-sm">{formatearMoneda(p.montoPrincipal)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-2.5">
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cuotas</p>
                    <p className="font-semibold text-[11px]">{p.numeroCuotas || p.plazoMeses}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cuota</p>
                    <p className="font-semibold text-[11px]">{formatearMoneda(p.montoCuota)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="font-semibold text-[11px]">{formatearMoneda(p.totalPagar || p.saldoTotal)}</p>
                  </div>
                </div>

                <div className="mb-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30">
                  <p className="text-xs font-semibold text-amber-200 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Requiere tu aceptación
                  </p>
                  <p className="text-[10px] text-amber-100/80 mb-2">
                    Inicia el flujo de firma electrónica: foto del documento → firma manuscrita → código OTP → selfie con cédula.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => iniciarFirmaElectronica(p.id, p.codigo)}
                    disabled={generandoToken === p.id}
                    className="gradient-premium gradient-premium-hover btn-press w-full h-8"
                  >
                    {generandoToken === p.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Generando enlace...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        Iniciar firma electrónica
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* === Solicitudes web (modelo SolicitudWeb) === */}
      {solicitudes.length === 0 && prestamosPendientes.length === 0 ? (
        <EmptyStatePremium
          icon={ClipboardList}
          title="No tienes solicitudes"
          subtitle="Cuando envíes una solicitud de crédito, aparecerá aquí."
        />
      ) : (
        solicitudes.map((s) => {
          const expanded = expandida === s.id
          return (
            <Card key={s.id} className="premium-card premium-card-hover rounded-2xl">
              <CardContent className="p-3">
                <button
                  type="button"
                  onClick={() => setExpandida(expanded ? null : s.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold truncate">{s.codigo}</span>
                        <EstadoSolicitudBadge estado={s.estado} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatearFechaHora(s.fechaCreacion)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-muted-foreground">Solicitado</p>
                      <p className="font-bold text-amber-300 text-xs">
                        {formatearMoneda(s.valorSolicitado)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div>
                      <p className="text-muted-foreground">Cuotas</p>
                      <p className="font-medium">{s.numeroCuotas}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cuota est.</p>
                      <p className="font-medium text-cyan-300">
                        {formatearMoneda(s.cuotaEstimada)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium text-emerald-300">
                        {formatearMoneda(s.totalPagar)}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="mt-2.5 pt-2 border-t border-white/10">
                  <SolicitudTimeline estado={s.estado} />
                </div>

                {/* === Flujo de firma del cliente (cuando la solicitud fue aprobada) === */}
                {/* Cuando el admin aprueba/crea préstamo, el cliente debe: */}
                {/* 1) Cargar fotos (cédula + selfie) */}
                {/* 2) Firma manuscrita */}
                {/* 3) Código OTP */}
                {(s.estado === 'APROBADA' || s.estado === 'CONVERTIDA') && s.prestamoCreadoId && (
                  <div className="mt-2.5">
                    <FlujoFirmaClient
                      solicitudId={s.id}
                      prestamoId={s.prestamoCreadoId}
                      estadoFlujoFirma={s.estadoFlujoFirma || 'EN_FIRMA_CLIENTE'}
                      token={token}
                      onCompletado={() => cargar()}
                    />
                  </div>
                )}

                {expanded && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2 fade-scale">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-muted-foreground">Primer pago</p>
                        <p className="font-medium">
                          {s.primerPagoFecha ? formatearFecha(s.primerPagoFecha) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Frecuencia</p>
                        <p className="font-medium capitalize">{s.frecuencia.toLowerCase()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tasa ({s.tasaOrigen === 'PERSONALIZADA' ? 'mensual' : 'anual'})</p>
                        <p className="font-medium">{s.tasaUtilizada}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total intereses</p>
                        <p className="font-medium text-amber-300">
                          {formatearMoneda(s.totalIntereses)}
                        </p>
                      </div>
                    </div>

                    {s.observaciones && (
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" />
                          Observaciones del asesor
                        </p>
                        <p className="text-[10px] whitespace-pre-wrap text-foreground/90">
                          {s.observaciones}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

// =====================================================
// Componente: Flujo de firma del cliente (cargue fotos + firma + OTP)
// Se muestra cuando una solicitud fue aprobada y se creó el préstamo.
// El cliente debe completar 3 pasos:
//   1. Cargar foto de cédula + selfie
//   2. Dibujar firma manuscrita
//   3. Ingresar código OTP recibido por correo/WhatsApp
// =====================================================
function FlujoFirmaClient({
  solicitudId,
  prestamoId,
  estadoFlujoFirma,
  token,
  onCompletado,
}: {
  solicitudId: string
  prestamoId: string
  estadoFlujoFirma: string
  token?: string
  onCompletado?: () => void
}) {
  const { toast } = useToast()
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1) // 1=fotos, 2=firma, 3=OTP, 4=completado
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null)
  const [fotoSelfie, setFotoSelfie] = useState<string | null>(null)
  const [guardandoFotos, setGuardandoFotos] = useState(false)
  const [firmaDibujada, setFirmaDibujada] = useState<string | null>(null)
  const [guardandoFirma, setGuardandoFirma] = useState(false)
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [otpValor, setOtpValor] = useState('')
  const [enviandoOtp, setEnviandoOtp] = useState(false)
  const [validandoOtp, setValidandoOtp] = useState(false)
  const [otpCanal, setOtpCanal] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)

  // === Si el flujo ya está completado, mostrar pantalla final ===
  useEffect(() => {
    if (estadoFlujoFirma === 'FIRMA_COMPLETADA') setPaso(4)
  }, [estadoFlujoFirma])

  // === Inicializar canvas con fondo blanco cuando se entra al paso 2 ===
  // Sin esto, el canvas arranca transparente y al exportar el PNG puede
  // quedar ilegible. También reinicia el fondo al limpiar.
  useEffect(() => {
    if (paso !== 2) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Pintar fondo blanco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Configurar estilo de trazo
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [paso])

  // === Helper: convertir coordenadas de evento a coordenadas reales del canvas ===
  // El canvas puede estar escalado por CSS, por lo que necesitamos mapear
  // las coordenadas de pantalla a las dimensiones internas (400x140).
  const getCanvasCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e
      ? (e.touches[0]?.clientX ?? (e as React.TouchEvent).changedTouches[0]?.clientX ?? 0)
      : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e
      ? (e.touches[0]?.clientY ?? (e as React.TouchEvent).changedTouches[0]?.clientY ?? 0)
      : (e as React.MouseEvent).clientY
    const x = ((clientX - rect.left) * canvas.width) / rect.width
    const y = ((clientY - rect.top) * canvas.height) / rect.height
    return { x, y }
  }

  // === Manejo del canvas para firma manuscrita ===
  const empezarDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Prevenir scroll en mobile
    if ('touches' in e) e.preventDefault()
    isDrawing.current = true
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // Dibujar un punto inicial para clicks simples
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
  }
  const moverDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Prevenir scroll en mobile mientras dibuja
    if ('touches' in e) e.preventDefault()
    const { x, y } = getCanvasCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    // Actualizar preview en tiempo real para que el usuario vea que se está dibujando
    setFirmaDibujada(canvas.toDataURL('image/png'))
  }
  const terminarDibujo = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const canvas = canvasRef.current
    if (canvas) setFirmaDibujada(canvas.toDataURL('image/png'))
  }
  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Repintar fondo blanco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setFirmaDibujada(null)
  }

  // === Paso 1: Guardar fotos ===
  const guardarFotos = async () => {
    if (!fotoDocumento || !fotoSelfie) {
      toast({ title: 'Faltan fotos', description: 'Sube la foto de tu cédula y tu selfie.', variant: 'destructive' })
      return
    }
    try {
      setGuardandoFotos(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-portal-token'] = token
      const res = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accion: 'guardar_fotos_simple',
          fotoDocumentoBase64: fotoDocumento,
          fotoSelfieBase64: fotoSelfie,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Fotos guardadas', description: 'Ahora dibuja tu firma manuscrita.' })
        setPaso(2)
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudieron guardar las fotos', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoFotos(false)
    }
  }

  // === Paso 2: Guardar firma manuscrita ===
  const guardarFirma = async () => {
    if (!firmaDibujada) {
      toast({ title: 'Firma requerida', description: 'Dibuja tu firma en el recuadro.', variant: 'destructive' })
      return
    }
    try {
      setGuardandoFirma(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-portal-token'] = token
      const res = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accion: 'guardar_firma_manuscrita',
          imagenFirmaBase64: firmaDibujada,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Firma guardada', description: 'Ahora solicita tu código OTP.' })
        setPaso(3)
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudo guardar la firma', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoFirma(false)
    }
  }

  // === Paso 3: Enviar OTP ===
  const enviarOTP = async () => {
    try {
      setEnviandoOtp(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-portal-token'] = token
      const res = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accion: 'enviar_otp', canal: otpCanal }),
      })
      const json = await res.json()
      if (json.success) {
        setOtpEnviado(true)
        toast({ title: 'Código enviado', description: `Revisa tu ${otpCanal === 'EMAIL' ? 'correo' : 'WhatsApp'}.` })
      } else {
        toast({ title: 'Error', description: json.error || 'No se pudo enviar el OTP', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoOtp(false)
    }
  }

  // === Paso 3b: Validar OTP y activar préstamo ===
  const validarOTP = async () => {
    if (!otpValor || otpValor.length !== 6) {
      toast({ title: 'Código inválido', description: 'Ingresa los 6 dígitos.', variant: 'destructive' })
      return
    }
    try {
      setValidandoOtp(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['x-portal-token'] = token
      // 1. Validar OTP
      // FIX 2026-08-12: El backend espera `otpIngresado`, no `otp`.
      // Antes se enviaba `{ otp: otpValor }` y el backend leía `otpIngresado`
      // (undefined), devolviendo "Código requerido" → el cliente veía
      // "OTP inválido" aunque el código fuera correcto.
      const resVal = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accion: 'validar_otp', otpIngresado: otpValor }),
      })
      const jsonVal = await resVal.json()
      if (!jsonVal.success) {
        toast({ title: 'OTP inválido', description: jsonVal.error || 'Verifica el código e intenta nuevamente', variant: 'destructive' })
        return
      }
      // 2. Confirmar (activa el préstamo)
      const resConf = await fetch(`/api/prestamos/${prestamoId}/aceptar-tyc-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accion: 'confirmar_activacion' }),
      })
      const jsonConf = await resConf.json()
      if (jsonConf.success) {
        toast({ title: '¡Préstamo activado!', description: 'Tu crédito ha sido activado correctamente.' })
        setPaso(4)
        onCompletado?.()
      } else {
        toast({ title: 'Activación pendiente', description: jsonConf.error || 'Tu OTP fue validado. Contacta al asesor para activar el crédito.' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setValidandoOtp(false)
    }
  }

  // === Captura de fotos (FlujoFirmaClient) ===
  // NOTA: La captura de fotos (cámara + subir archivo + girar cámara) ahora
  // se maneja internamente en el componente FotoCaptureFirma.

  const pasos = [
    { n: 1, label: 'Fotos', icon: Camera },
    { n: 2, label: 'Firma', icon: FileSignature },
    { n: 3, label: 'OTP', icon: KeyRound },
    { n: 4, label: 'Activado', icon: CheckCircle },
  ] as const

  return (
    <Card className="premium-card rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md">
            <FileSignature className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold">Flujo de firma del crédito</p>
            <p className="text-[10px] text-muted-foreground">
              Tu solicitud fue aprobada. Completa estos 3 pasos para activar tu crédito.
            </p>
          </div>
        </div>

        {/* === Indicador de pasos === */}
        <div className="flex items-center gap-1">
          {pasos.map((p, i) => {
            const completado = paso > p.n
            const activo = paso === p.n
            const Icon = p.icon
            return (
              <div key={p.n} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-0.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                    completado
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : activo
                        ? 'bg-violet-500 text-white border-violet-400 shadow-md shadow-violet-500/40'
                        : 'bg-white/5 text-muted-foreground border-white/10'
                  }`}>
                    {completado ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </div>
                  <span className={`text-[8px] truncate ${completado || activo ? 'text-violet-300' : 'text-muted-foreground'}`}>{p.label}</span>
                </div>
                {i < pasos.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-0.5 ${completado ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* === Paso 1: Cargue de fotos === */}
        {paso === 1 && (
          <div className="space-y-2 fade-scale">
            <p className="text-[11px] text-muted-foreground">
              Toma o sube una foto nítida de tu cédula (frente) y un selfie sosteniéndola. Puedes usar la cámara o subir un archivo. Si necesitas cambiar de cámara, usa el botón "Girar cámara".
            </p>
            <FotoCaptureFirma
              label="Foto cédula (frente)"
              descripcion="Asegúrate de que se lean todos los datos."
              valor={fotoDocumento}
              onChange={(v) => setFotoDocumento(v)}
              initialFacing="environment"
              mirror={false}
            />
            <FotoCaptureFirma
              label="Selfie con cédula"
              descripcion="Tu rostro completo y la cédula deben verse nítidos."
              valor={fotoSelfie}
              onChange={(v) => setFotoSelfie(v)}
              initialFacing="user"
              mirror
            />
            <Button onClick={guardarFotos} disabled={!fotoDocumento || !fotoSelfie || guardandoFotos} className="w-full h-8 text-[11px]" size="sm">
              {guardandoFotos ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Guardando…</> : 'Continuar a firma →'}
            </Button>
          </div>
        )}

        {/* === Paso 2: Firma manuscrita === */}
        {paso === 2 && (
          <div className="space-y-2 fade-scale">
            <Label className="text-[10px] font-semibold">Dibuja tu firma manuscrita</Label>
            <p className="text-[9px] text-muted-foreground">
              Usa el dedo (en móvil) o el mouse para dibujar tu firma en el recuadro blanco.
            </p>
            <canvas
              ref={canvasRef}
              width={400}
              height={140}
              onMouseDown={empezarDibujo}
              onMouseMove={moverDibujo}
              onMouseUp={terminarDibujo}
              onMouseLeave={terminarDibujo}
              onTouchStart={empezarDibujo}
              onTouchMove={moverDibujo}
              onTouchEnd={terminarDibujo}
              className="w-full h-28 bg-white rounded-md border-2 border-violet-500/30 touch-none cursor-crosshair"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-muted-foreground">
                {firmaDibujada ? '✓ Firma capturada' : 'Dibuja tu firma arriba'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={limpiarFirma} className="h-8 text-[11px]" size="sm">
                  Limpiar
                </Button>
                <Button onClick={guardarFirma} disabled={!firmaDibujada || guardandoFirma} className="h-8 text-[11px]" size="sm">
                  {guardandoFirma ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Guardando…</> : 'Continuar a OTP →'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* === Paso 3: OTP === */}
        {paso === 3 && (
          <div className="space-y-2 fade-scale">
            <Label className="text-[10px] font-semibold">Verifica tu identidad con OTP</Label>
            <p className="text-[10px] text-muted-foreground">
              Te enviaremos un código de 6 dígitos para confirmar la activación del crédito.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOtpCanal('EMAIL')}
                className={`flex-1 p-2 rounded-md border text-[10px] flex items-center justify-center gap-1 ${otpCanal === 'EMAIL' ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-white/15 text-muted-foreground'}`}
              >
                <Mail className="w-3 h-3" /> Correo
              </button>
              <button
                type="button"
                onClick={() => setOtpCanal('WHATSAPP')}
                className={`flex-1 p-2 rounded-md border text-[10px] flex items-center justify-center gap-1 ${otpCanal === 'WHATSAPP' ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-white/15 text-muted-foreground'}`}
              >
                <Smartphone className="w-3 h-3" /> WhatsApp
              </button>
            </div>
            {!otpEnviado ? (
              <Button onClick={enviarOTP} disabled={enviandoOtp} className="w-full h-8 text-[11px]" size="sm">
                {enviandoOtp ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enviando…</> : 'Enviar código OTP'}
              </Button>
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="______"
                  value={otpValor}
                  onChange={(e) => setOtpValor(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest h-10 font-mono"
                />
                <Button onClick={validarOTP} disabled={otpValor.length !== 6 || validandoOtp} className="w-full h-8 text-[11px]" size="sm">
                  {validandoOtp ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Validando…</> : 'Validar y activar crédito'}
                </Button>
                <button type="button" onClick={enviarOTP} disabled={enviandoOtp} className="w-full text-[10px] text-muted-foreground hover:text-foreground">
                  ¿No recibiste el código? Reenviar
                </button>
              </>
            )}
          </div>
        )}

        {/* === Paso 4: Completado === */}
        {paso === 4 && (
          <div className="text-center py-4 fade-scale">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-emerald-300">¡Crédito activado!</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Tu préstamo fue activado correctamente. Ya puedes verlo en la sección "Mis Préstamos".
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Componente: Timeline visual de una solicitud — PRESERVADO
// =====================================================
function SolicitudTimeline({ estado }: { estado: string }) {
  const pasos = [
    { key: 'ENVIADA', label: 'Enviada' },
    { key: 'EN_REVISION', label: 'Revisión' },
    { key: 'EN_ESTUDIO', label: 'Estudio' },
    { key: 'APROBADA', label: 'Aprobada' },
    { key: 'CONVERTIDA', label: 'Activada' },
  ]

  const orden: Record<string, number> = {
    PENDIENTE: 0,
    EN_REVISION: 1,
    APROBADA: 3,
    CONVERTIDA: 4,
    RECHAZADA: 1,
  }
  const actualIdx = orden[estado] ?? 0
  const rechazada = estado === 'RECHAZADA'

  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      {pasos.map((p, i) => {
        const completado = i <= actualIdx && !rechazada
        const activo = i === actualIdx && !rechazada
        return (
          <div key={p.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-0.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all duration-300 ${
                  completado
                    ? activo
                      ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/40'
                      : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40'
                    : 'bg-white/5 text-muted-foreground border-white/10'
                }`}
              >
                {completado && !activo ? '✓' : i + 1}
              </div>
              <span
                className={`text-[8px] truncate ${
                  completado ? 'text-emerald-300' : 'text-muted-foreground'
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-0.5 transition-colors ${
                  i < actualIdx && !rechazada ? 'bg-emerald-500/40' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
      {rechazada && (
        <Badge variant="destructive" className="ml-1 text-[9px] h-4">
          Rechazada
        </Badge>
      )}
    </div>
  )
}

// =====================================================
// Componente: Badge de estado de solicitud web — PRESERVADO
// =====================================================
function EstadoSolicitudBadge({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDIENTE: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    EN_REVISION: { label: 'Revisión', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
    APROBADA: { label: 'Aprobada', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    RECHAZADA: { label: 'Rechazada', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
    CONVERTIDA: { label: 'Activada', className: 'bg-violet-500/15 text-violet-300 border-violet-400/30' },
  }
  const cfg = config[estado] || { label: estado, className: 'bg-white/10 text-foreground border-white/20' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
