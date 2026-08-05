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
} from 'lucide-react'
import { CentroComunicacionesPortal } from '@/components/views/CentroComunicacionesPortal'

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
}

// =====================================================
// Configuración visual del Hub Circular
// =====================================================
type HubItemId = 'prestamos' | 'proximos' | 'simulador' | 'solicitudes' | 'comunicaciones' | 'historial'

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

  const tomarFotoSelfie = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.playsInline = true
      const modal = document.createElement('div')
      modal.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;'
      video.style.cssText = 'max-width:90vw;max-height:70vh;border-radius:16px;'
      const btnContainer = document.createElement('div')
      btnContainer.style.cssText = 'margin-top:16px;display:flex;gap:12px;'
      const btnCapturar = document.createElement('button')
      btnCapturar.textContent = 'Capturar'
      btnCapturar.style.cssText =
        'padding:12px 28px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px -6px rgba(99,102,241,0.5);'
      const btnCancelar = document.createElement('button')
      btnCancelar.textContent = 'Cancelar'
      btnCancelar.style.cssText =
        'padding:12px 28px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-size:16px;cursor:pointer;'
      btnContainer.appendChild(btnCancelar)
      btnContainer.appendChild(btnCapturar)
      modal.appendChild(video)
      modal.appendChild(btnContainer)
      document.body.appendChild(modal)
      btnCancelar.onclick = () => {
        stream.getTracks().forEach((t) => t.stop())
        document.body.removeChild(modal)
      }
      btnCapturar.onclick = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setTycFotoSelfie(dataUrl)
        stream.getTracks().forEach((t) => t.stop())
        document.body.removeChild(modal)
      }
    } catch (e: any) {
      toast({
        title: 'Cámara no disponible',
        description: 'Usa la opción de subir archivo.',
        variant: 'destructive',
      })
    }
  }

  const subirFotoSelfieArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Archivo inválido', description: 'Debe ser una imagen.', variant: 'destructive' })
      return
    }
    if (file.type === 'image/svg+xml') {
      toast({ title: 'Formato no permitido', description: 'Usa JPG, PNG o WebP.', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 5MB.', variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setTycFotoSelfie(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // === Tomar/subir foto de la cédula (paso 3) ===
  const tomarFotoDocumento = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.playsInline = true
      const overlay = document.createElement('div')
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;`
      overlay.appendChild(video)
      video.style.cssText = `max-width:90vw;max-height:60vh;border-radius:12px;`
      const captureBtn = document.createElement('button')
      captureBtn.textContent = 'Capturar foto de la cédula'
      captureBtn.style.cssText = `padding:12px 28px;background:linear-gradient(135deg,#6366f1,#a855f7);color:white;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px -6px rgba(99,102,241,0.5);`
      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancelar'
      cancelBtn.style.cssText = `padding:12px 28px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-size:14px;cursor:pointer;`
      const hint = document.createElement('p')
      hint.textContent = 'Coloca tu cédula en el cuadro y asegúrate de que se vea nítida.'
      hint.style.cssText = `color:#e5e7eb;font-size:12px;text-align:center;max-width:480px;`
      overlay.appendChild(hint)
      overlay.appendChild(captureBtn)
      overlay.appendChild(cancelBtn)
      document.body.appendChild(overlay)
      const cleanup = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      }
      cancelBtn.onclick = () => cleanup()
      captureBtn.onclick = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return cleanup()
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setTycFotoDocumento(dataUrl)
        cleanup()
      }
    } catch (e: any) {
      toast({
        title: 'Cámara no disponible',
        description: 'Usa la opción de subir archivo.',
        variant: 'destructive',
      })
    }
  }

  const subirFotoDocumentoArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Archivo inválido', description: 'Debe ser una imagen.', variant: 'destructive' })
      return
    }
    if (file.type === 'image/svg+xml') {
      toast({ title: 'Formato no permitido', description: 'Usa JPG, PNG o WebP.', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 5MB.', variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setTycFotoDocumento(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

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
  const generarPazYSalvo = (prestamoId: string, codigo: string) => {
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    window.open(`/api/paz-y-salvo?prestamoId=${prestamoId}&codigo=${codigo}${tokenParam}`, '_blank')
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

  // Configuración del Hub (6 items alrededor del logo) — Iconos premium
  const hubItems: HubItemConfig[] = [
    {
      id: 'prestamos',
      label: 'Créditos',
      icon: Landmark,
      color: 'text-indigo-300',
      gradient: 'from-indigo-500 via-indigo-600 to-violet-700',
      position: { x: 0, y: -110 },
      badge: prestamos.filter(p => p.estado === 'PENDIENTE_ACEPTACION').length || undefined,
    },
    {
      id: 'proximos',
      label: 'Próximos',
      icon: AlarmClockCheck,
      color: 'text-cyan-300',
      gradient: 'from-cyan-400 via-cyan-600 to-blue-700',
      position: { x: 95, y: -55 },
    },
    {
      id: 'simulador',
      label: 'Simulador',
      icon: SlidersHorizontal,
      color: 'text-violet-300',
      gradient: 'from-violet-400 via-violet-600 to-purple-700',
      position: { x: 95, y: 55 },
    },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      icon: FileSignature,
      color: 'text-amber-300',
      gradient: 'from-amber-400 via-amber-600 to-orange-700',
      position: { x: 0, y: 110 },
    },
    {
      id: 'comunicaciones',
      label: 'Chat',
      icon: MessagesSquare,
      color: 'text-emerald-300',
      gradient: 'from-emerald-400 via-emerald-600 to-teal-700',
      position: { x: -95, y: 55 },
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: Clock3,
      color: 'text-fuchsia-300',
      gradient: 'from-fuchsia-400 via-fuchsia-600 to-pink-700',
      position: { x: -95, y: -55 },
    },
  ]

  // Helper para obtener config por id (incluye secciones extras: avisos, campañas)
  const hubConfig = (id: 'hub' | HubItemId | 'avisos' | 'campanas') => {
    if (id === 'avisos') return { label: 'Avisos', icon: Bell, gradient: 'from-red-500 to-rose-600', color: 'text-red-300' }
    if (id === 'campanas') return { label: 'Campañas', icon: Megaphone, gradient: 'from-indigo-500 to-violet-600', color: 'text-indigo-300' }
    return hubItems.find(h => h.id === id)!
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md w-full h-[100vh] sm:h-[95vh] sm:max-h-[860px] flex flex-col p-0 gap-0 overflow-hidden portal-bg border-0 sm:rounded-3xl"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Portal del Cliente — {cliente.nombre}</DialogTitle>
        </VisuallyHidden>
        {/* === HEADER COMPACTO (App-like) === */}
        <div className="px-4 pt-4 pb-3 shrink-0 fade-scale">
          <div className="flex items-center justify-between gap-3">
            {vista !== 'hub' ? (
              <button
                onClick={() => setVista('hub')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors btn-press"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Hub</span>
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
                onClick={onClose}
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
              onSelect={(id) => setVista(id)}
            />
          )}

          {vista === 'prestamos' && (
            <PrestamosView
              prestamos={prestamos}
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
            <MisSolicitudesPanel cedula={cliente.cedula} token={token} />
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
        </div>

        {/* === BARRA INFERIOR FIJA === */}
        <div className="bottom-nav shrink-0 px-2 pt-1.5 pb-2 safe-bottom">
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => setVista('hub')}
              className={`bottom-nav-item ${vista === 'hub' ? 'active' : ''}`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium">Hub</span>
            </button>

            <button
              onClick={() => setVista('avisos')}
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
              onClick={() => setVista('campanas')}
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
                      Ahora sube una foto clara de tu cédula de ciudadanía. Asegúrate
                      de que se vean todos los datos (frente completo).
                    </p>
                  </div>

                  {tycFotoDocumento ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400/50">
                        <img
                          src={tycFotoDocumento}
                          alt="Foto de la cédula"
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute top-2 right-2"
                          onClick={() => setTycFotoDocumento(null)}
                        >
                          Cambiar
                        </Button>
                      </div>
                      <p className="text-xs text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Foto de cédula lista
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={tomarFotoDocumento}
                        className="flex flex-col items-center gap-2 h-24 rounded-xl border-dashed input-premium"
                      >
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">Tomar foto</span>
                      </Button>
                      <label className="flex flex-col items-center gap-2 h-24 justify-center rounded-xl border border-dashed border-white/15 hover:border-primary cursor-pointer transition-colors">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">Subir archivo</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={subirFotoDocumentoArchivo}
                        />
                      </label>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-white/5 text-xs text-muted-foreground">
                    <p className="font-semibold mb-1 text-foreground/80">Requisitos de la foto:</p>
                    <ul className="space-y-0.5 ml-3 list-disc">
                      <li>Cédula completa y legible (frente)</li>
                      <li>Sin reflejos ni sombras</li>
                      <li>Buena iluminación · Máximo 5MB</li>
                    </ul>
                  </div>

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

                  {tycFotoSelfie ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400/50">
                        <img
                          src={tycFotoSelfie}
                          alt="Selfie con cédula"
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute top-2 right-2"
                          onClick={() => setTycFotoSelfie(null)}
                        >
                          Cambiar
                        </Button>
                      </div>
                      <p className="text-xs text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Selfie lista para enviar
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={tomarFotoSelfie}
                        className="flex flex-col items-center gap-2 h-24 rounded-xl border-dashed input-premium"
                      >
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">Tomar foto</span>
                      </Button>
                      <label className="flex flex-col items-center gap-2 h-24 justify-center rounded-xl border border-dashed border-white/15 hover:border-primary cursor-pointer transition-colors">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">Subir archivo</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={subirFotoSelfieArchivo}
                        />
                      </label>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-white/5 text-xs text-muted-foreground">
                    <p className="font-semibold mb-1 text-foreground/80">Requisitos del selfie:</p>
                    <ul className="space-y-0.5 ml-3 list-disc">
                      <li>Rostro completo sin lentes/gorra</li>
                      <li>Cédula visible junto al rostro</li>
                      <li>Buena iluminación · Máximo 5MB</li>
                    </ul>
                  </div>

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
      </DialogContent>
    </Dialog>
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
}: {
  cliente: PortalClienteInfo
  kpis: PortalKPIS
  resumen: PortalData['resumen']
  hubItems: HubItemConfig[]
  onSelect: (id: HubItemId) => void
}) {
  return (
    <div className="space-y-5 fade-scale">
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
              onClick={() => {
                const tokenParam = typeof window !== 'undefined' ? '' : ''
                const url = `/api/estado-cuenta?cedula=${encodeURIComponent(cliente.cedula)}${tokenParam}`
                window.open(url, '_blank')
              }}
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
  onPazYSalvo: (prestamoId: string, codigo: string) => void
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
                {cancelado && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPazYSalvo(p.id, p.codigo)}
                    className="text-[10px] h-7 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <FileCheck className="w-3 h-3 mr-1" />
                    Paz y salvo
                  </Button>
                )}
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

  return (
    <div className="space-y-3 fade-scale">
      {proximos.map((pg: any) => {
        const venc = new Date(pg.fechaVencimiento)
        const hoy = new Date()
        const dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        const vencido = dias < 0
        return (
          <Card
            key={pg.id}
            className={`premium-card premium-card-hover rounded-2xl ${
              vencido ? 'border-red-400/40' : ''
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
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Vence: <strong>{formatearFecha(pg.fechaVencimiento)}</strong>
                    {vencido ? ` · ${Math.abs(dias)}d atrás` : ` · en ${dias}d`}
                  </p>
                </div>
                <DiasRestantesBadge dias={dias} />
              </div>

              <p className="text-xl font-black text-amber-300 mb-2.5">
                {formatearMoneda(pg.montoTotal)}
              </p>

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
      const res = await fetch('/api/solicitudes-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          token,
          valorSolicitado: parseFloat(valorSolicitado),
          numeroCuotas: parseInt(numeroCuotas, 10),
          frecuencia,
          primerPagoFecha: fechaPrimerPago,
          codigoConfirmacion,
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
}

function MisSolicitudesPanel({ cedula, token }: { cedula: string; token?: string }) {
  const { toast } = useToast()
  const [solicitudes, setSolicitudes] = useState<SolicitudWebItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<string | null>(null)

  const cargar = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch(
        `/api/solicitudes-web/cliente/${cedula}?token=${encodeURIComponent(token)}`
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

  const total = solicitudes.length
  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length
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

      {solicitudes.length === 0 ? (
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
