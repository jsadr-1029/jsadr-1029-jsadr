'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'
import { CentroComunicacionesPortal } from '@/components/views/CentroComunicacionesPortal'

// =====================================================
// Tipos
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

  // === Flujo de aceptación TyC con OTP + Selfie ===
  // Flujo v5.0:
  //   Paso 1: enviar OTP (canal a elegir: WhatsApp/Email/Ambos — modalidad de préstamo)
  //   Paso 2: validar OTP
  //   Paso 3: subir foto de la cédula
  //   Paso 4: tomar selfie sosteniendo la cédula
  //   Paso 5: confirmar y activar préstamo (envía ambas fotos al backend)
  const [tycPrestamoId, setTycPrestamoId] = useState<string | null>(null)
  const [tycPrestamoCodigo, setTycPrestamoCodigo] = useState<string>('')
  const [tycPaso, setTycPaso] = useState<1 | 2 | 3 | 4>(1) // 1: OTP, 2: validar, 3: cédula, 4: selfie
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

  // === Abrir flujo TyC completo (OTP + foto cédula + selfie) ===
  const abrirFlujoTyC = async (prestamoId: string, codigo: string) => {
    setTycPrestamoId(prestamoId)
    setTycPrestamoCodigo(codigo)
    setTycPaso(1)
    setTycOtpIngresado('')
    setTycFotoDocumento(null)
    setTycFotoSelfie(null)
    setTycSegundosRestantes(0)
    // Verificar si ya hay OTP activo (no generar uno nuevo en ese caso)
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
          // Saltar a paso 3 (subir cédula) — el OTP ya está validado
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
        // Avanzar a paso 3: subir foto de la cédula primero
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
        'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;'
      video.style.cssText = 'max-width:90vw;max-height:70vh;border-radius:12px;'
      const btnContainer = document.createElement('div')
      btnContainer.style.cssText = 'margin-top:16px;display:flex;gap:12px;'
      const btnCapturar = document.createElement('button')
      btnCapturar.textContent = '📸 Capturar'
      btnCapturar.style.cssText =
        'padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;'
      const btnCancelar = document.createElement('button')
      btnCancelar.textContent = 'Cancelar'
      btnCancelar.style.cssText =
        'padding:10px 24px;background:#475569;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;'
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
    // Validar formato (no SVG por seguridad)
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
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;`
      overlay.appendChild(video)
      video.style.cssText = `max-width:90vw;max-height:60vh;border-radius:8px;`
      const captureBtn = document.createElement('button')
      captureBtn.textContent = 'Capturar foto de la cédula'
      captureBtn.style.cssText = `padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;`
      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancelar'
      cancelBtn.style.cssText = `padding:10px 24px;background:#6b7280;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;`
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

  // === Fin flujo TyC ===

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
        toast({
          title: 'Redirigiendo a Bancolombia',
          description: `Intención de pago creada. Checkout ID: ${json.data.checkoutId.slice(0, 8)}…`,
        })
        // En producción redirigiría a Bancolombia; aquí abrimos el redirect URL
        if (json.data.redirectUrl) {
          window.open(json.data.redirectUrl, '_blank')
        }
      } else {
        toast({ title: 'Error al crear pago', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (loading || !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="py-8 text-center text-muted-foreground">Cargando portal...</div>
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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* === HEADER FIJO (sin scroll) === */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-white/10 shrink-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-fuchsia-500/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-logo flex items-center justify-center shadow-lg shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <span className="truncate font-bold">{cliente.nombre}</span>
                </DialogTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <FileCheck className="w-3 h-3" />
                    C.C. {cliente.cedula}
                  </span>
                  <span className="opacity-50">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    {cliente.telefono}
                  </span>
                  {cliente.categoria && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                        {cliente.categoria.nombre}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="shrink-0 border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200 h-9"
              title="Cerrar sesión del portal"
            >
              <LogOut className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Salir del portal</span>
            </Button>
          </div>
        </div>

        {/* === BODY CON SCROLL INTERNO === */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-3">

        {/* ============ KPIs BÁSICOS (4 tarjetas) ============ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="glass-card">
            <CardContent className="p-2.5 text-center">
              <FileText className="w-5 h-5 mx-auto mb-0.5 text-primary" />
              <p className="text-[10px] text-muted-foreground">Total Créditos</p>
              <p className="text-base font-bold">{resumen.totalPrestamos}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-2.5 text-center">
              <Clock className="w-5 h-5 mx-auto mb-0.5 text-emerald-400" />
              <p className="text-[10px] text-muted-foreground">Activos</p>
              <p className="text-base font-bold text-emerald-300">{resumen.prestamosActivos}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-2.5 text-center">
              <CheckCircle className="w-5 h-5 mx-auto mb-0.5 text-cyan-400" />
              <p className="text-[10px] text-muted-foreground">Cancelados</p>
              <p className="text-base font-bold text-cyan-300">{resumen.prestamosCancelados}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-2.5 text-center">
              <DollarSign className="w-5 h-5 mx-auto mb-0.5 text-amber-400" />
              <p className="text-[10px] text-muted-foreground">Saldo Activos</p>
              <p className="text-sm font-bold text-amber-300">
                {formatearMoneda(resumen.saldoTotalActivos)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ============ KPIs AVANZADOS (3 tarjetas) ============ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Score de Pago (circular SVG) */}
          <Card className="glass-card">
            <CardContent className="p-2.5 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1 self-start">
                <Award className="w-3.5 h-3.5 text-violet-300" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Score de Pago
                </p>
              </div>
              <ScoreCircular score={kpis.scorePago} />
            </CardContent>
          </Card>

          {/* Próximo Pago */}
          <Card className="glass-card">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarClock className="w-3.5 h-3.5 text-cyan-300" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Próximo Pago
                </p>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-bold text-cyan-300">
                    {formatearMoneda(kpis.montoProximoPago)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {kpis.proximoVencimiento ? formatearFecha(kpis.proximoVencimiento) : 'Sin vencimientos'}
                  </p>
                </div>
                <DiasRestantesBadge dias={kpis.diasProximoPago} />
              </div>
              <div className="mt-2 pt-1.5 border-t border-white/10">
                <p className="text-[10px] text-muted-foreground">
                  Cuotas pendientes: <span className="font-bold text-foreground">{kpis.totalCuotasPendientes}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Estado de Salud */}
          <Card className="glass-card">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <HeartPulse className="w-3.5 h-3.5 text-emerald-300" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado de Salud
                </p>
              </div>
              <div className="flex items-end justify-between mb-1.5">
                <p className="text-sm font-bold text-emerald-300">{kpis.estadoSalud}</p>
                <span className="text-[10px] text-muted-foreground">
                  {kpis.porcentajeAvancePromedio.toFixed(1)}% pagado
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, kpis.porcentajeAvancePromedio)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Avance promedio en tus créditos activos
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="prestamos" className="flex flex-col gap-3">
          {/* === MENÚ HORIZONTAL ARRIBA — 2 LÍNEAS === */}
          <TabsList className="grid grid-cols-4 w-full h-auto p-1.5 gap-1 bg-white/5 rounded-xl border border-white/10">
              <TabsTrigger
                value="prestamos"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <FileText className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Créditos</span>
              </TabsTrigger>
              <TabsTrigger
                value="proximos"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <CalendarClock className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Próximos</span>
              </TabsTrigger>
              <TabsTrigger
                value="historial"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <DollarSign className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Historial</span>
              </TabsTrigger>
              <TabsTrigger
                value="simulador"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <Calculator className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Simulador</span>
              </TabsTrigger>
              <TabsTrigger
                value="solicitudes"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <ClipboardList className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Solicitudes</span>
              </TabsTrigger>
              <TabsTrigger
                value="comunicaciones"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <MessageSquare className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Chat</span>
              </TabsTrigger>
              <TabsTrigger
                value="campanas"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden"
              >
                <Megaphone className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Campañas</span>
              </TabsTrigger>
              <TabsTrigger
                value="avisos"
                className="rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-2 py-2 text-xs justify-center overflow-hidden relative"
              >
                <Bell className="w-4 h-4 mr-1.5 shrink-0" />
                <span className="truncate">Avisos</span>
                {notifStats.noLeidas > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0">
                    {notifStats.noLeidas}
                  </span>
                )}
              </TabsTrigger>
          </TabsList>

          {/* === CONTENIDO DE LAS PESTAÑAS (ancho completo) === */}
          <div className="flex-1 min-w-0 space-y-3">

          {/* ============ TAB: Mis Créditos ============ */}
          <TabsContent value="prestamos" className="space-y-3">
            {prestamos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tienes créditos registrados.
                </CardContent>
              </Card>
            ) : (
              <>
              {/* Banner de descarga de estado de cuenta global */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileDown className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        Estado de Cuenta Completo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Descarga un documento imprimible con todos tus créditos, pagos y saldos.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => descargarEstadoCuenta()}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Descargar / Imprimir
                  </Button>
                </CardContent>
              </Card>

              {prestamos.map((p) => {
                const avance = p.numeroCuotas > 0 ? (p.cuotasPagadas / p.numeroCuotas) * 100 : 0
                const cancelado = p.estado === 'CANCELADO'
                return (
                  <Card
                    key={p.id}
                    className={
                      p.estado === 'PENDIENTE_ACEPTACION'
                        ? 'border-amber-400/50 bg-amber-500/5'
                        : cancelado
                        ? 'border-emerald-400/30 bg-emerald-500/5'
                        : ''
                    }
                  >
                    <CardContent className="p-3">
                      {/* === Header compacto: código + estado + saldo === */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{p.codigo}</span>
                            <EstadoBadge estado={p.estado} />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Solicitado: {formatearFecha(p.fechaSolicitud)}
                            {p.fechaDesembolso && ` · Desembolsado: ${formatearFecha(p.fechaDesembolso)}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground">Saldo Pendiente</p>
                          <p className="font-bold text-amber-300 text-sm">{formatearMoneda(p.saldoTotal)}</p>
                        </div>
                      </div>

                      {/* === Grid denso de datos financieros === */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Principal</p>
                          <p className="font-medium">{formatearMoneda(p.montoPrincipal)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cuota</p>
                          <p className="font-medium">{formatearMoneda(p.montoCuota)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pagadas</p>
                          <p className="font-medium">{p.cuotasPagadas}/{p.numeroCuotas}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Frec.</p>
                          <p className="font-medium capitalize">{p.frecuencia.toLowerCase().slice(0, 5)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                          <p className="font-medium">{formatearMoneda(p.totalPagar)}</p>
                        </div>
                      </div>

                      {/* === Barra de progreso compacta === */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground shrink-0">Avance</span>
                        <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700"
                            style={{ width: `${Math.min(100, avance)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-300 shrink-0 w-10 text-right">
                          {avance.toFixed(0)}%
                        </span>
                      </div>

                      {p.estado === 'PENDIENTE_ACEPTACION' && (
                        <div className="mt-2 p-2 bg-amber-500/10 rounded-md border border-amber-400/30">
                          <p className="text-xs font-semibold text-amber-200 mb-0.5">
                            ⚠️ Requiere tu aceptación
                          </p>
                          <p className="text-[11px] text-amber-100/80 mb-2">
                            Para activar tu préstamo debes aceptar los Términos y Condiciones mediante
                            verificación OTP (WhatsApp/correo) y foto selfie con tu cédula en mano.
                          </p>
                          <Button size="sm" onClick={() => abrirFlujoTyC(p.id, p.codigo)}>
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Acepto Términos y Condiciones
                          </Button>
                        </div>
                      )}

                      {p.diasMora > 0 && p.estado === 'EN_MORA' && (
                        <div className="mt-2 p-1.5 bg-red-500/10 rounded-md border border-red-400/30 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <p className="text-[11px] text-red-200">
                            <strong>En mora:</strong> {p.diasMora} días · Mora acumulada:{' '}
                            {formatearMoneda(p.montoMora)}
                          </p>
                        </div>
                      )}

                      {/* Botón Paz y Salvo para préstamos cancelados */}
                      {cancelado && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generarPazYSalvo(p.id, p.codigo)}
                            className="border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Generar Paz y Salvo
                          </Button>
                        </div>
                      )}

                      {/* Cuenta de recaudo donde debe pagar */}
                      {p.cuentaRecaudoPago && (p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION') && (
                        <div className="mt-3 p-3 bg-cyan-500/5 rounded-md border border-cyan-400/20">
                          <p className="text-xs font-semibold text-cyan-200 mb-1.5 flex items-center gap-1">
                            🏦 Cuenta donde debes pagar
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-cyan-300/70">Banco:</span>{' '}
                              <strong>{p.cuentaRecaudoPago.banco}</strong>
                            </div>
                            <div>
                              <span className="text-cyan-300/70">Tipo:</span>{' '}
                              <strong>{p.cuentaRecaudoPago.tipoCuenta}</strong>
                            </div>
                            <div className="col-span-2">
                              <span className="text-cyan-300/70">N° Cuenta:</span>{' '}
                              <strong className="font-mono">{p.cuentaRecaudoPago.numeroCuenta}</strong>
                            </div>
                            <div className="col-span-2">
                              <span className="text-cyan-300/70">Titular:</span>{' '}
                              <strong>{p.cuentaRecaudoPago.titular}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Acciones por préstamo */}
                      <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => descargarEstadoCuenta(p.id)}
                          className="text-xs"
                        >
                          <FileDown className="w-3.5 h-3.5 mr-1.5" />
                          Estado de cuenta de este crédito
                        </Button>
                        {p.estado === 'CANCELADO' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generarPazYSalvo(p.id, p.codigo)}
                            className="text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            Paz y salvo
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              </>
            )}
          </TabsContent>

          {/* ============ TAB: Próximos Pagos ============ */}
          <TabsContent value="proximos" className="space-y-3">
            {(() => {
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
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <CalendarClock className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      No tienes pagos pendientes. ¡Estás al día!
                    </CardContent>
                  </Card>
                )
              }
              return proximos.map((pg: any) => {
                const venc = new Date(pg.fechaVencimiento)
                const hoy = new Date()
                const dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
                const vencido = dias < 0
                return (
                  <Card key={pg.id} className={vencido ? 'border-red-400/40 bg-red-500/5' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold">{pg.prestamo.codigo}</span>
                            <Badge variant="outline" className="text-xs">Cuota {pg.numeroCuota}</Badge>
                            {vencido && (
                              <Badge variant="destructive" className="text-xs">Vencido</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Vence: <strong>{formatearFecha(pg.fechaVencimiento)}</strong>
                            {vencido ? ` (${Math.abs(dias)} días atrás)` : ` (en ${dias} días)`}
                          </p>
                          <p className="text-lg font-bold text-amber-300 mt-1">
                            {formatearMoneda(pg.montoTotal)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Button
                            size="sm"
                            onClick={() => pagarBancolombia(pg.prestamo.id, pg.montoTotal, pg.numeroCuota)}
                          >
                            <CreditCard className="w-4 h-4 mr-1.5" />
                            Pagar con Bancolombia
                          </Button>
                          <span className="text-xs text-muted-foreground">Botón de pago seguro</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            })()}
          </TabsContent>

          {/* ============ TAB: Historial de Pagos ============ */}
          <TabsContent value="historial">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Préstamo</TableHead>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prestamos.flatMap((p) =>
                      (p.pagos || []).map((pg: any) => (
                        <TableRow key={pg.id}>
                          <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                          <TableCell>{pg.numeroCuota}</TableCell>
                          <TableCell className="text-xs">{formatearFecha(pg.fechaVencimiento)}</TableCell>
                          <TableCell className="text-xs">{formatearFecha(pg.fechaPago)}</TableCell>
                          <TableCell className="font-semibold text-right text-emerald-300">
                            {formatearMoneda(pg.montoTotal)}
                          </TableCell>
                          <TableCell className="text-xs">{pg.metodoPago}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pg.estado}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {prestamos.flatMap((p) => p.pagos || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          No hay pagos registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TAB: Simulador de Crédito ============ */}
          <TabsContent value="simulador" className="space-y-3">
            <SimuladorCredito
              clienteId={cliente.id}
              token={token}
              tasaPersonalizadaInicial={{
                tiene: !!cliente.tieneTasaPersonalizada,
                valor: cliente.tasaPersonalizada ?? null,
              }}
            />
          </TabsContent>

          {/* ============ TAB: Mis Solicitudes ============ */}
          <TabsContent value="solicitudes" className="space-y-3">
            <MisSolicitudesPanel cedula={cliente.cedula} token={token} />
          </TabsContent>

          {/* ============ TAB: Chat ============ */}
          <TabsContent value="comunicaciones" className="space-y-3">
            <CentroComunicacionesPortal
              clienteId={cliente.id}
              cedula={cliente.cedula}
              token={token}
            />
          </TabsContent>

          {/* ============ TAB: Campañas ============ */}
          <TabsContent value="campanas" className="space-y-3">
            {campanas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  No hay campañas activas en este momento.
                </CardContent>
              </Card>
            ) : (
              campanas.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="w-4 h-4 text-primary" />
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {c.tipo}
                      </span>
                    </div>
                    <h4 className="font-semibold">{c.titulo}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{c.descripcion}</p>
                    {c.contenido && (
                      <p className="text-xs mt-2 text-foreground/80 whitespace-pre-wrap">
                        {c.contenido}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ============ TAB: Avisos (Notificaciones) ============ */}
          <TabsContent value="avisos" className="space-y-3">
            {/* Stats de notificaciones */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Card className="glass-card">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-primary" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                  <p className="text-base sm:text-lg font-bold">{notifStats.total}</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-2 sm:p-3 text-center">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-amber-400" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">No leídas</p>
                  <p className="text-base sm:text-lg font-bold text-amber-300">{notifStats.noLeidas}</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-cyan-400" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Pendientes</p>
                  <p className="text-base sm:text-lg font-bold text-cyan-300">{notifStats.pendientes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de notificaciones */}
            {notificaciones.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  No tienes notificaciones registradas.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Mensaje</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificaciones.map((n) => (
                          <TableRow key={n.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {n.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-xs">{n.mensaje}</TableCell>
                            <TableCell className="text-xs">
                              {formatearFecha(n.fechaEnvio)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  n.estado === 'ENVIADO' ? 'default' :
                                  n.estado === 'FALLIDO' ? 'destructive' :
                                  'secondary'
                                }
                                className="text-xs"
                              >
                                {n.estado}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          </div>{/* === FIN CONTENIDO PESTAÑAS === */}
        </Tabs>

        {/* === MODAL DE ACEPTACIÓN TyC (OTP + Selfie) — 3 pasos === */}
        {tycPrestamoId && (
          <Dialog open={true} onOpenChange={(o) => { if (!o && !tycGuardando) cerrarFlujoTyC() }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Aceptación T&C · {tycPrestamoCodigo}
                </DialogTitle>
              </DialogHeader>

              {/* Stepper visual */}
              <div className="flex items-center justify-between mb-4 px-2">
                {[
                  { n: 1, label: 'Enviar OTP', icon: KeyRound },
                  { n: 2, label: 'Validar', icon: CheckCircle },
                  { n: 3, label: 'Foto Cédula', icon: CreditCard },
                  { n: 4, label: 'Selfie+Cédula', icon: Camera },
                ].map((s, idx) => (
                  <div key={s.n} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          tycPaso >= s.n
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {tycPaso > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
                      </div>
                      <span className="text-[10px] mt-1 text-muted-foreground">{s.label}</span>
                    </div>
                    {idx < 3 && (
                      <div
                        className={`h-0.5 flex-1 mx-2 transition-colors ${
                          tycPaso > s.n ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Paso 1: Enviar OTP */}
              {tycPaso === 1 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    <p className="font-semibold mb-1">🔐 Verificación de identidad</p>
                    <p className="text-xs">
                      Te enviaremos un código de un solo uso (OTP) para confirmar tu identidad antes
                      de aceptar los Términos y Condiciones.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Canal de envío</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTycCanal('WHATSAPP')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-md border-2 text-xs transition-all ${
                          tycCanal === 'WHATSAPP'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-border hover:border-emerald-300'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setTycCanal('EMAIL')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-md border-2 text-xs transition-all ${
                          tycCanal === 'EMAIL'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'border-border hover:border-blue-300'
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                        Correo
                      </button>
                      <button
                        type="button"
                        onClick={() => setTycCanal('AMBOS')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-md border-2 text-xs transition-all ${
                          tycCanal === 'AMBOS'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                            : 'border-border hover:border-purple-300'
                        }`}
                      >
                        <Send className="w-4 h-4" />
                        Ambos
                      </button>
                    </div>
                  </div>

                  <Button
                    className="w-full"
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
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Tiempo restante:{' '}
                      <span className="font-mono">
                        {Math.floor(tycSegundosRestantes / 60)}:
                        {(tycSegundosRestantes % 60).toString().padStart(2, '0')}
                      </span>
                    </p>
                    <p className="text-xs">
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
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      autoFocus
                    />
                  </div>

                  <Button
                    className="w-full"
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
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-md text-sm text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Identidad verificada
                    </p>
                    <p className="text-xs">
                      Ahora sube una foto clara de tu cédula de ciudadanía. Asegúrate
                      de que se vean todos los datos (frente completo).
                    </p>
                  </div>

                  {tycFotoDocumento ? (
                    <div className="space-y-2">
                      <div className="relative rounded-md overflow-hidden border-2 border-emerald-300">
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
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Foto de cédula lista
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={tomarFotoDocumento}
                        className="flex flex-col items-center gap-2 h-24"
                      >
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">Tomar foto</span>
                      </Button>
                      <label className="flex flex-col items-center gap-2 h-24 justify-center rounded-md border border-dashed border-border hover:border-primary cursor-pointer transition-colors">
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

                  <div className="p-2.5 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <p className="font-semibold mb-1">📋 Requisitos de la foto de cédula:</p>
                    <ul className="space-y-0.5 ml-3 list-disc">
                      <li>Cédula completa y legible (frente)</li>
                      <li>Sin reflejos ni sombras</li>
                      <li>Buena iluminación</li>
                      <li>Máximo 5MB · formato JPG/PNG/WebP</li>
                    </ul>
                  </div>

                  <Button
                    className="w-full"
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
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Último paso: selfie con cédula
                    </p>
                    <p className="text-xs">
                      Toma una foto sosteniendo tu cédula junto a tu rostro. Esta
                      imagen se usará como respaldo de tu firma electrónica en el pagaré.
                    </p>
                  </div>

                  {/* Resumen: foto cédula ya cargada */}
                  <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-md">
                    <img
                      src={tycFotoDocumento || ''}
                      alt="Cédula"
                      className="w-12 h-12 object-cover rounded border"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Foto de cédula cargada
                      </p>
                      <button
                        type="button"
                        onClick={() => setTycPaso(3)}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        Volver a editar cédula
                      </button>
                    </div>
                  </div>

                  {tycFotoSelfie ? (
                    <div className="space-y-2">
                      <div className="relative rounded-md overflow-hidden border-2 border-emerald-300">
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
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Selfie lista para enviar
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={tomarFotoSelfie}
                        className="flex flex-col items-center gap-2 h-24"
                      >
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">Tomar foto</span>
                      </Button>
                      <label className="flex flex-col items-center gap-2 h-24 justify-center rounded-md border border-dashed border-border hover:border-primary cursor-pointer transition-colors">
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

                  <div className="p-2.5 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <p className="font-semibold mb-1">📋 Requisitos del selfie:</p>
                    <ul className="space-y-0.5 ml-3 list-disc">
                      <li>Rostro completo sin lentes/gorra</li>
                      <li>Cédula visible junto al rostro</li>
                      <li>Buena iluminación</li>
                      <li>Máximo 5MB · formato JPG/PNG/WebP</li>
                    </ul>
                  </div>

                  <Button
                    className="w-full"
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
        </div>{/* === FIN BODY CON SCROLL INTERNO === */}

        {/* === FOOTER FIJO ABAJO (sin scroll) === */}
        <div className="px-5 py-2 border-t border-white/10 shrink-0 flex items-center justify-between gap-3 bg-black/20">
          <a
            href="https://wa.me/573103674546"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 hover:underline"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Soporte WhatsApp
          </a>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Componente: Score Circular (SVG)
// =====================================================
function ScoreCircular({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const radio = 36
  const circunferencia = 2 * Math.PI * radio
  const offset = circunferencia - (pct / 100) * circunferencia
  const color =
    pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444'
  const etiqueta =
    pct >= 80 ? 'Excelente' : pct >= 60 ? 'Bueno' : pct >= 40 ? 'Regular' : 'Bajo'

  return (
    <div className="relative">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Anillo de fondo */}
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        {/* Anillo de progreso */}
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {Math.round(pct)}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {etiqueta}
        </span>
      </div>
    </div>
  )
}

// =====================================================
// Componente: Badge de días restantes
// =====================================================
function DiasRestantesBadge({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Vencido {Math.abs(dias)}d
      </Badge>
    )
  }
  if (dias <= 3) {
    return (
      <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs">
        {dias === 0 ? 'Hoy' : `${dias}d`}
      </Badge>
    )
  }
  if (dias <= 7) {
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs">
        {dias}d
      </Badge>
    )
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
      {dias}d
    </Badge>
  )
}

// =====================================================
// Badge de estado
// =====================================================
function EstadoBadge({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    SOLICITUD: { label: 'Solicitud', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
    PENDIENTE_ACEPTACION: { label: 'Pendiente Aceptación', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    ACTIVO: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    EN_MORA: { label: 'En Mora', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
    JURIDICO: { label: 'Jurídico', className: 'bg-orange-500/15 text-orange-300 border-orange-400/30' },
    CANCELADO: { label: 'Cancelado', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    RECHAZADO: { label: 'Rechazado', className: 'bg-white/10 text-foreground border-white/20' },
  }
  const cfg = config[estado] || { label: estado, className: 'bg-white/10 text-foreground border-white/20' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// =====================================================
// Helper: plazo en meses desde cuotas y frecuencia
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
// Componente: Simulador de Crédito
// =====================================================
const TASA_GENERAL_DEFAULT_SIM = 24 // % anual si no hay configuración

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

  const enviarSolicitud = async () => {
    if (!token) {
      toast({
        title: 'Sesión requerida',
        description: 'Inicia sesión para enviar tu solicitud.',
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
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '✅ Solicitud enviada',
          description: `Código: ${json.data?.codigo}. Un asesor la revisará pronto.`,
        })
      } else {
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
    <div className="space-y-4">
      {/* Banner tasa aplicable */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-amber-300" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
      <Card className="glass-card">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sim-valor">Valor solicitado (COP)</Label>
              <Input
                id="sim-valor"
                type="number"
                value={valorSolicitado}
                onChange={(e) => setValorSolicitado(e.target.value)}
                min={0}
                step={10000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-cuotas">Número de cuotas</Label>
              <Input
                id="sim-cuotas"
                type="number"
                value={numeroCuotas}
                onChange={(e) => setNumeroCuotas(e.target.value)}
                min={1}
                step={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frecuencia</Label>
              <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as Frecuencia)}>
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label htmlFor="sim-fecha">Fecha primer pago</Label>
              <Input
                id="sim-fecha"
                type="date"
                value={fechaPrimerPago}
                onChange={(e) => setFechaPrimerPago(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={calcularSimulacion} className="w-full">
            <Calculator className="w-4 h-4 mr-2" />
            Simular crédito
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Cuota estimada</p>
                <p className="text-xl font-bold text-cyan-300">
                  {formatearMoneda(resultado.montoCuota)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total intereses</p>
                <p className="text-xl font-bold text-amber-300">
                  {formatearMoneda(resultado.totalInteres)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total a pagar</p>
                <p className="text-xl font-bold text-emerald-300">
                  {formatearMoneda(resultado.totalPagar)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla amortización */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Interés</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.tablaAmortizacion.map((c) => (
                      <TableRow key={c.numero}>
                        <TableCell>{c.numero}</TableCell>
                        <TableCell className="text-xs">{formatearFecha(c.fechaVencimiento)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatearMoneda(c.montoCuota)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatearMoneda(c.capital)}</TableCell>
                        <TableCell className="text-right text-xs text-amber-300">
                          {formatearMoneda(c.interes)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatearMoneda(c.saldoCapital)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Aviso */}
          <div className="p-3 bg-amber-500/10 rounded-md border border-amber-400/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-100/80">
              Esta simulación es una estimación referencial. La aprobación final está sujeta al estudio de crédito.
            </p>
          </div>

          {/* Botón enviar solicitud */}
          <Button onClick={enviarSolicitud} disabled={enviando} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {enviando ? 'Enviando...' : 'Enviar Solicitud'}
          </Button>
        </>
      )}
    </div>
  )
}

// =====================================================
// Componente: Mis Solicitudes (panel del cliente)
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40" />
          Inicia sesión en el portal para ver tus solicitudes.
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando solicitudes...
        </CardContent>
      </Card>
    )
  }

  // KPIs
  const total = solicitudes.length
  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length
  const enProceso = solicitudes.filter((s) => s.estado === 'EN_REVISION').length
  const finalizadas = solicitudes.filter(
    (s) => s.estado === 'CONVERTIDA' || s.estado === 'APROBADA' || s.estado === 'RECHAZADA'
  ).length

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <ClipboardList className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-amber-400" />
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-lg font-bold text-amber-300">{pendientes}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs text-muted-foreground">En proceso</p>
            <p className="text-lg font-bold text-cyan-300">{enProceso}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
            <p className="text-xs text-muted-foreground">Finalizadas</p>
            <p className="text-lg font-bold text-emerald-300">{finalizadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      {solicitudes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40" />
            No tienes solicitudes registradas.
          </CardContent>
        </Card>
      ) : (
        solicitudes.map((s) => {
          const expanded = expandida === s.id
          return (
            <Card key={s.id} className="glass-card">
              <CardContent className="p-4">
                <button
                  type="button"
                  onClick={() => setExpandida(expanded ? null : s.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold truncate">{s.codigo}</span>
                        <EstadoSolicitudBadge estado={s.estado} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatearFechaHora(s.fechaCreacion)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Valor solicitado</p>
                      <p className="font-bold text-amber-300">
                        {formatearMoneda(s.valorSolicitado)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cuotas</p>
                      <p className="font-medium">
                        {s.numeroCuotas} ({s.frecuencia.toLowerCase()})
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tasa</p>
                      <p className="font-medium">
                        {s.tasaOrigen === 'PERSONALIZADA'
                          ? `${s.tasaUtilizada}% mensual`
                          : `${s.tasaUtilizada}% anual`}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cuota est.</p>
                      <p className="font-medium text-cyan-300">
                        {formatearMoneda(s.cuotaEstimada)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-muted-foreground">Total intereses</p>
                      <p className="font-medium text-amber-300">
                        {formatearMoneda(s.totalIntereses)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-muted-foreground">Total a pagar</p>
                      <p className="font-medium text-emerald-300">
                        {formatearMoneda(s.totalPagar)}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Timeline visual */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <SolicitudTimeline estado={s.estado} />
                </div>

                {/* Detalle expandible */}
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Primer pago</p>
                        <p className="font-medium">
                          {s.primerPagoFecha ? formatearFecha(s.primerPagoFecha) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fecha revisión</p>
                        <p className="font-medium">
                          {s.fechaRevision ? formatearFechaHora(s.fechaRevision) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fecha conversión</p>
                        <p className="font-medium">
                          {s.fechaConversion ? formatearFechaHora(s.fechaConversion) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Préstamo creado</p>
                        <p className="font-medium font-mono text-xs">
                          {s.prestamoCreadoId || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Observaciones del asesor */}
                    {s.observaciones && (
                      <div className="p-3 bg-white/5 rounded-md border border-white/10">
                        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Observaciones del asesor
                        </p>
                        <p className="text-xs whitespace-pre-wrap text-foreground/90">
                          {s.observaciones}
                        </p>
                      </div>
                    )}

                    {/* Nota informativa */}
                    <p className="text-xs text-muted-foreground">
                      ℹ️ La tabla de amortización detallada y el historial completo de cambios
                      estarán disponibles cuando un asesor revise tu solicitud.
                    </p>
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
// Componente: Timeline visual de una solicitud
// =====================================================
function SolicitudTimeline({ estado }: { estado: string }) {
  const pasos = [
    { key: 'ENVIADA', label: 'Enviada' },
    { key: 'EN_REVISION', label: 'En Revisión' },
    { key: 'EN_ESTUDIO', label: 'En Estudio' },
    { key: 'APROBADA', label: 'Aprobada' },
    { key: 'CONVERTIDA', label: 'Convertida' },
  ]

  // Mapear estado actual a índice del paso alcanzado
  const orden: Record<string, number> = {
    PENDIENTE: 0,
    EN_REVISION: 1,
    APROBADA: 3,
    CONVERTIDA: 4,
    RECHAZADA: 1, // se rechaza después de la revisión
  }
  const actualIdx = orden[estado] ?? 0
  const rechazada = estado === 'RECHAZADA'

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {pasos.map((p, i) => {
        const completado = i <= actualIdx && !rechazada
        const activo = i === actualIdx && !rechazada
        return (
          <div key={p.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                  completado
                    ? activo
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40'
                    : 'bg-white/5 text-muted-foreground border-white/10'
                }`}
              >
                {completado && !activo ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] truncate ${
                  completado ? 'text-emerald-300' : 'text-muted-foreground'
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 ${
                  i < actualIdx && !rechazada ? 'bg-emerald-500/40' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
      {rechazada && (
        <Badge variant="destructive" className="ml-2 text-[10px]">
          Rechazada
        </Badge>
      )}
    </div>
  )
}

// =====================================================
// Componente: Badge de estado de solicitud web
// =====================================================
function EstadoSolicitudBadge({ estado }: { estado: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDIENTE: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    EN_REVISION: { label: 'En Revisión', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
    APROBADA: { label: 'Aprobada', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    RECHAZADA: { label: 'Rechazada', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
    CONVERTIDA: { label: 'Convertida', className: 'bg-violet-500/15 text-violet-300 border-violet-400/30' },
  }
  const cfg = config[estado] || { label: estado, className: 'bg-white/10 text-foreground border-white/20' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
