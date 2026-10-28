'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  Upload,
  Camera,
  FileText,
  User,
  PenTool,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  Smartphone,
  Mail,
  Trash2,
  Loader2,
  XCircle,
  Eye,
  RefreshCw,
} from 'lucide-react'

interface DatosFirma {
  estado: 'VALIDO' | 'USADO' | 'EXPIRADO'
  firma: any
  cliente?: any
  prestamo?: any
  expiracion?: string
  mensaje?: string
}

export default function PaginaFirma({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [token, setToken] = useState<string>('')
  const [datos, setDatos] = useState<DatosFirma | null>(null)
  const [loading, setLoading] = useState(true)
  const [paso, setPaso] = useState(1) // 1: fotos, 2: firma, 3: OTP, 4: completado

  // Estados de cada paso
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null)
  const [fotoSelfie, setFotoSelfie] = useState<string | null>(null)
  const [subiendoFotos, setSubiendoFotos] = useState(false)
  const [firmaDibujada, setFirmaDibujada] = useState<string | null>(null)
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [otpIngresado, setOtpIngresado] = useState('')
  const [enviandoOtp, setEnviandoOtp] = useState(false)
  const [validandoOtp, setValidandoOtp] = useState(false)
  const [guardandoFirma, setGuardandoFirma] = useState(false)
  const [canalOtp, setCanalOtp] = useState<'WHATSAPP' | 'EMAIL' | 'AMBOS'>('AMBOS')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  const { toast } = useToast()

  // Cargar token
  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return
    cargarDatos()
  }, [token])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/firma?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (json.success) {
        setDatos(json.data)
        // Si la firma ya está completada, ir al paso final
        if (json.data.firma?.estadoFirma === 'COMPLETADA') {
          setPaso(4)
        } else if (json.data.firma?.estadoFirma === 'RECHAZADA') {
          setPaso(5)
        }
      } else {
        setDatos({ estado: 'EXPIRADO', firma: null, mensaje: json.error })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // === Manejo de archivos de fotos ===
  const manejarArchivo = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'documento' | 'selfie') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'El archivo debe ser una imagen', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no puede superar 10MB', variant: 'destructive' })
      return
    }

    // === COMPRIMIR IMAGEN antes de enviar ===
    // Vercel serverless tiene un límite de body de ~4.5MB.
    // Dos fotos en base64 pueden superar ese límite.
    // Por eso comprimimos: redimensionamos a max 1024px y calidad JPEG 0.7
    try {
      const compressed = await comprimirImagenFirma(file, 1024, 0.7)
      if (!compressed || !compressed.startsWith('data:image/')) {
        throw new Error('La imagen comprimida no es válida')
      }
      if (tipo === 'documento') setFotoDocumento(compressed)
      else setFotoSelfie(compressed)
      toast({ title: 'Foto cargada', description: 'Imagen lista para firmar' })
    } catch (e: any) {
      // Si la compresión falla, intentar usar la imagen original
      // pero leerla con FileReader (no canvas) para evitar errores de patrón
      console.error('Error comprimiendo imagen:', e)
      try {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          if (result && result.startsWith('data:image/')) {
            if (tipo === 'documento') setFotoDocumento(result)
            else setFotoSelfie(result)
            toast({ title: 'Foto cargada (sin comprimir)', description: 'Imagen lista para firmar' })
          } else {
            toast({ title: 'Error', description: 'No se pudo procesar la imagen. Intenta con otra foto.', variant: 'destructive' })
          }
        }
        reader.onerror = () => {
          toast({ title: 'Error', description: 'No se pudo leer el archivo. Intenta con otra foto.', variant: 'destructive' })
        }
        reader.readAsDataURL(file)
      } catch (fallbackErr) {
        toast({ title: 'Error', description: 'No se pudo procesar la imagen. Intenta con otra foto o usa la cámara.', variant: 'destructive' })
      }
    }
  }

  // === Función para comprimir imagen con canvas ===
  // Redimensiona a maxWidth x maxHeight y convierte a JPEG con quality
  // Esto reduce significativamente el tamaño del base64
  // Maneja errores de móviles (Safari iOS, Chrome Android) que pueden lanzar
  // DOMException "The string did not match the expected pattern"
  const comprimirImagenFirma = (file: File, maxDim: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          try {
            let width = img.width
            let height = img.height
            // Redimensionar manteniendo aspect ratio
            if (width > height && width > maxDim) {
              height = Math.round(height * maxDim / width)
              width = maxDim
            } else if (height > maxDim) {
              width = Math.round(width * maxDim / height)
              height = maxDim
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('No se pudo obtener el contexto del canvas'))
              return
            }
            ctx.drawImage(img, 0, 0, width, height)
            // Intentar JPEG primero, si falla usar PNG
            let compressed: string
            try {
              compressed = canvas.toDataURL('image/jpeg', quality)
            } catch (jpegErr) {
              // Algunos navegadores móviles fallan con 'image/jpeg'
              // Fallback a PNG sin calidad (siempre soportado)
              try {
                compressed = canvas.toDataURL('image/png')
              } catch (pngErr) {
                // Si ambos fallan, usar el data URL original del archivo
                compressed = e.target?.result as string
              }
            }
            // Verificar que el resultado sea válido
            if (!compressed || !compressed.startsWith('data:image/')) {
              compressed = e.target?.result as string
            }
            resolve(compressed)
          } catch (err) {
            // Cualquier error, usar el data URL original
            resolve(e.target?.result as string)
          }
        }
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  const tomarFoto = async (tipo: 'documento' | 'selfie') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: tipo === 'selfie' ? 'user' : 'environment' },
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()
      const dialogContent = document.createElement('div')
      dialogContent.style.position = 'fixed'
      dialogContent.style.top = '0'
      dialogContent.style.left = '0'
      dialogContent.style.width = '100%'
      dialogContent.style.height = '100%'
      dialogContent.style.backgroundColor = 'rgba(0,0,0,0.9)'
      dialogContent.style.zIndex = '9999'
      dialogContent.style.display = 'flex'
      dialogContent.style.flexDirection = 'column'
      dialogContent.style.alignItems = 'center'
      dialogContent.style.justifyContent = 'center'
      dialogContent.style.padding = '20px'

      video.style.maxWidth = '100%'
      video.style.maxHeight = '70vh'
      video.style.borderRadius = '8px'

      const btnCapturar = document.createElement('button')
      btnCapturar.textContent = '📸 Capturar'
      btnCapturar.style.marginTop = '16px'
      btnCapturar.style.padding = '12px 24px'
      btnCapturar.style.background = '#1e40af'
      btnCapturar.style.color = 'white'
      btnCapturar.style.border = 'none'
      btnCapturar.style.borderRadius = '8px'
      btnCapturar.style.cursor = 'pointer'
      btnCapturar.style.fontSize = '16px'

      const btnCerrar = document.createElement('button')
      btnCerrar.textContent = '✕ Cerrar'
      btnCerrar.style.marginTop = '8px'
      btnCerrar.style.padding = '8px 16px'
      btnCerrar.style.background = '#ef4444'
      btnCerrar.style.color = 'white'
      btnCerrar.style.border = 'none'
      btnCerrar.style.borderRadius = '8px'
      btnCerrar.style.cursor = 'pointer'

      dialogContent.appendChild(video)
      dialogContent.appendChild(btnCapturar)
      dialogContent.appendChild(btnCerrar)
      document.body.appendChild(dialogContent)

      btnCapturar.onclick = () => {
        const canvas = document.createElement('canvas')
        // Redimensionar para no exceder límite de Vercel (4.5MB)
        let w = video.videoWidth
        let h = video.videoHeight
        const maxDim = 1024
        if (w > h && w > maxDim) {
          h = Math.round(h * maxDim / w)
          w = maxDim
        } else if (h > maxDim) {
          w = Math.round(w * maxDim / h)
          h = maxDim
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, w, h)
        // Calidad 0.7 para reducir tamaño del base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        if (tipo === 'documento') setFotoDocumento(dataUrl)
        else setFotoSelfie(dataUrl)
        stream.getTracks().forEach((t) => t.stop())
        document.body.removeChild(dialogContent)
      }

      btnCerrar.onclick = () => {
        stream.getTracks().forEach((t) => t.stop())
        document.body.removeChild(dialogContent)
      }
    } catch (e: any) {
      toast({
        title: 'Error al acceder a la cámara',
        description: 'Tu navegador no permite acceder a la cámara. Usa la opción de subir archivo.',
        variant: 'destructive',
      })
    }
  }

  // === Guardar fotos ===
  const guardarFotos = async () => {
    if (!fotoDocumento || !fotoSelfie || !datos?.firma) return
    setSubiendoFotos(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_fotos',
          firmaId: datos.firma.id,
          fotoDocumento,
          fotoSelfie,
        }),
      })
      // Manejar respuestas no-JSON (ej: 413 Request Entity Too Large)
      const text = await res.text()
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        // Si no es JSON, es un error de tamaño o servidor
        if (res.status === 413) {
          toast({ title: 'Error', description: 'Las fotos son demasiado grandes. Intenta con imágenes de menor calidad.', variant: 'destructive' })
        } else {
          toast({ title: 'Error', description: `Error del servidor (${res.status}). Intenta nuevamente.`, variant: 'destructive' })
        }
        setSubiendoFotos(false)
        return
      }
      if (json.success) {
        toast({
          title: 'Fotos guardadas',
          description: 'Ahora puedes dibujar tu firma electrónica.',
        })
        setPaso(2)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubiendoFotos(false)
    }
  }

  // === Canvas firma ===
  useEffect(() => {
    if (paso !== 2) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [paso])

  const empezarDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    setDibujando(true)
    moverDibujo(e)
  }

  const moverDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!dibujando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    let x, y
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    // Escalar a las dimensiones reales del canvas
    x = (x * canvas.width) / rect.width
    y = (y * canvas.height) / rect.height
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const terminarDibujo = () => {
    if (!dibujando) return
    setDibujando(false)
    const canvas = canvasRef.current
    if (!canvas) return
    setFirmaDibujada(canvas.toDataURL('image/png'))
  }

  const limpiarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setFirmaDibujada(null)
  }

  // === Enviar OTP ===
  const enviarOTP = async () => {
    if (!datos?.firma) return
    setEnviandoOtp(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar_otp',
          firmaId: datos.firma.id,
          canal: canalOtp,
        }),
      })
      const text = await res.text()
      let json: any
      try { json = JSON.parse(text) } catch {
        toast({ title: 'Error del servidor', description: `Código ${res.status}. Intenta nuevamente.`, variant: 'destructive' })
        setEnviandoOtp(false)
        return
      }
      if (json.success) {
        setOtpEnviado(true)
        toast({
          title: 'Código enviado',
          description: json.data.canal === 'WHATSAPP'
            ? 'Recibirás el código por WhatsApp.'
            : json.data.canal === 'EMAIL'
            ? 'Recibirás el código por correo electrónico.'
            : 'Recibirás el código por WhatsApp y correo.',
        })
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoOtp(false)
    }
  }

  // === Validar OTP y guardar firma ===
  const validarYGuardar = async () => {
    if (!otpIngresado || !datos?.firma || !firmaDibujada) return
    setValidandoOtp(true)
    try {
      // Primero validar el OTP
      const resValidar = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'validar_otp',
          firmaId: datos.firma.id,
          otpIngresado,
        }),
      })
      const textValidar = await resValidar.text()
      let jsonValidar: any
      try { jsonValidar = JSON.parse(textValidar) } catch {
        toast({ title: 'Error del servidor', description: `Código ${resValidar.status}. Intenta nuevamente.`, variant: 'destructive' })
        setValidandoOtp(false)
        return
      }
      if (!jsonValidar.success) {
        toast({ title: 'Código incorrecto', description: jsonValidar.error, variant: 'destructive' })
        setValidandoOtp(false)
        return
      }

      // Si el OTP es correcto, guardar la firma
      setGuardandoFirma(true)
      const resGuardar = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_firma',
          firmaId: datos.firma.id,
          imagenFirma: firmaDibujada,
        }),
      })
      const textGuardar = await resGuardar.text()
      let jsonGuardar: any
      try { jsonGuardar = JSON.parse(textGuardar) } catch {
        toast({ title: 'Error del servidor', description: `Código ${resGuardar.status}. Intenta nuevamente.`, variant: 'destructive' })
        setGuardandoFirma(false)
        setValidandoOtp(false)
        return
      }
      if (jsonGuardar.success) {
        toast({
          title: '¡Firma completada!',
          description: 'Tu firma electrónica ha sido guardada con éxito.',
        })
        setPaso(4)
      } else {
        toast({ title: 'Error', description: jsonGuardar.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setValidandoOtp(false)
      setGuardandoFirma(false)
    }
  }

  // === Loading inicial ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Cargando información de firma...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Token inválido o expirado ===
  if (!datos || datos.estado === 'EXPIRADO' || datos.estado === 'USADO') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              {datos?.estado === 'USADO' ? 'Enlace ya utilizado' : 'Enlace inválido o expirado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {datos?.mensaje || 'Este enlace de firma electrónica no es válido o ha expirado.'}
            </p>
            {datos?.estado === 'USADO' && (
              <p className="text-sm">
                Si ya firmaste, no necesitas hacer nada más. Si crees que es un error, contacta a tu gestor.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Firma rechazada ===
  if (paso === 5 || datos.firma?.estadoFirma === 'RECHAZADA') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Firma rechazada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El proceso de firma fue rechazado. Contacta a tu gestor para iniciar un nuevo proceso.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Paso 4: Completado ===
  if (paso === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-700">¡Firma Completada!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tu firma electrónica se ha guardado correctamente.
              </p>
            </div>
            {datos.prestamo && (
              <div className="bg-muted/50 p-3 rounded-lg w-full text-left space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Préstamo:</span>
                  <span className="font-mono">{datos.prestamo.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">ACTIVO</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desembolsado:</span>
                  <span>{formatearFecha(new Date().toISOString())}</span>
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Firma electrónica con verificación de identidad
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const firma = datos.firma
  const cliente = datos.cliente || firma.cliente
  const prestamo = datos.prestamo || firma.prestamo

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Firma Electrónica con Verificación de Identidad
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {firma.tipo === 'TYC' ? 'Términos y Condiciones' : firma.tipo} - Documento para firmar
            </p>
          </CardHeader>
        </Card>

        {/* Info del cliente y préstamo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">Cliente</span>
              </div>
              <p className="font-bold">{cliente?.nombre}</p>
              <p className="text-xs text-muted-foreground">CC: {cliente?.cedula}</p>
            </CardContent>
          </Card>
          {prestamo && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold">Préstamo</span>
                </div>
                <p className="font-mono text-sm">{prestamo.codigo}</p>
                <p className="text-xs text-muted-foreground">
                  {formatearMoneda(prestamo.montoPrincipal)} · {prestamo.numeroCuotas} cuotas
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pasos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-6">
              {[
                { num: 1, label: 'Fotos', icon: Camera },
                { num: 2, label: 'Firma', icon: PenTool },
                { num: 3, label: 'Verificación', icon: Shield },
              ].map((p, idx) => {
                const Icon = p.icon
                const activo = paso === p.num
                const completado = paso > p.num
                return (
                  <div key={p.num} className="flex items-center flex-1">
                    <div className={`flex items-center gap-2 ${activo ? 'text-blue-700' : completado ? 'text-green-700' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        activo ? 'border-blue-600 bg-blue-50' : completado ? 'border-green-600 bg-green-50' : 'border-gray-300'
                      }`}>
                        {completado ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className="text-xs font-semibold hidden sm:block">{p.label}</span>
                    </div>
                    {idx < 2 && <div className={`flex-1 h-0.5 mx-2 ${completado ? 'bg-green-600' : 'bg-gray-300'}`} />}
                  </div>
                )
              })}
            </div>

            {/* Paso 1: Subir fotos */}
            {paso === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    📸 Para verificar tu identidad, necesitamos dos fotos. Puedes tomarlas con la cámara o subirlas desde tu dispositivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Foto del documento */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Foto del documento de identidad</Label>
                    <p className="text-xs text-muted-foreground">Cédula, pasaporte o licencia (frente)</p>
                    {fotoDocumento ? (
                      <div className="relative">
                        <img src={fotoDocumento} alt="Documento" className="w-full h-48 object-cover rounded-md border-2 border-green-300" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setFotoDocumento(null)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center space-y-2">
                        <FileText className="w-8 h-8 mx-auto text-gray-400" />
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => tomarFoto('documento')}>
                            <Camera className="w-3.5 h-3.5 mr-1.5" /> Tomar foto
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <label className="cursor-pointer">
                              <Upload className="w-3.5 h-3.5 mr-1.5" /> Subir archivo
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => manejarArchivo(e, 'documento')} />
                            </label>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selfie con cédula */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Selfie sosteniendo la cédula</Label>
                    <p className="text-xs text-muted-foreground">Tu cara y el documento deben verse claramente</p>
                    {fotoSelfie ? (
                      <div className="relative">
                        <img src={fotoSelfie} alt="Selfie" className="w-full h-48 object-cover rounded-md border-2 border-green-300" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setFotoSelfie(null)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center space-y-2">
                        <User className="w-8 h-8 mx-auto text-gray-400" />
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => tomarFoto('selfie')}>
                            <Camera className="w-3.5 h-3.5 mr-1.5" /> Tomar selfie
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <label className="cursor-pointer">
                              <Upload className="w-3.5 h-3.5 mr-1.5" /> Subir archivo
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => manejarArchivo(e, 'selfie')} />
                            </label>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50 p-2 rounded-md border border-amber-200 text-xs text-amber-900">
                  ⚠️ Las fotos serán almacenadas como evidencia de identidad con hash SHA-256 para verificar su integridad.
                </div>

                <Button
                  className="w-full"
                  disabled={!fotoDocumento || !fotoSelfie || subiendoFotos}
                  onClick={guardarFotos}
                >
                  {subiendoFotos ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando fotos...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Continuar a la firma
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Paso 2: Dibujar firma */}
            {paso === 2 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    ✍️ Dibuja tu firma en el recuadro siguiente usando el mouse o tu dedo (en móvil).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Tu firma electrónica</Label>
                  <div className="border-2 border-gray-300 rounded-md overflow-hidden bg-white">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={300}
                      className="w-full h-48 touch-none cursor-crosshair"
                      onMouseDown={empezarDibujo}
                      onMouseMove={moverDibujo}
                      onMouseUp={terminarDibujo}
                      onMouseLeave={terminarDibujo}
                      onTouchStart={empezarDibujo}
                      onTouchMove={moverDibujo}
                      onTouchEnd={terminarDibujo}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {firmaDibujada ? '✓ Firma capturada' : 'Dibuja tu firma arriba'}
                    </p>
                    <Button size="sm" variant="outline" onClick={limpiarFirma}>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Limpiar
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPaso(1)}>
                    Atrás
                  </Button>
                  <Button className="flex-1" disabled={!firmaDibujada} onClick={() => setPaso(3)}>
                    Continuar a verificación
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 3: Verificación OTP */}
            {paso === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    🔐 Para finalizar, necesitamos verificar tu identidad con un código de 6 dígitos.
                  </p>
                </div>

                {/* Selección de canal */}
                <div className="space-y-2">
                  <Label className="font-semibold">¿Por dónde prefieres recibir el código?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['WHATSAPP', 'EMAIL', 'AMBOS'] as const).map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant={canalOtp === c ? 'default' : 'outline'}
                        onClick={() => setCanalOtp(c)}
                        disabled={c === 'EMAIL' && !cliente?.email}
                      >
                        {c === 'WHATSAPP' && <Smartphone className="w-3.5 h-3.5 mr-1" />}
                        {c === 'EMAIL' && <Mail className="w-3.5 h-3.5 mr-1" />}
                        {c === 'AMBOS' && <Shield className="w-3.5 h-3.5 mr-1" />}
                        {c === 'WHATSAPP' ? 'WhatsApp' : c === 'EMAIL' ? 'Correo' : 'Ambos'}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {canalOtp === 'WHATSAPP' && `Se enviará al ${cliente?.telefono}`}
                    {canalOtp === 'EMAIL' && `Se enviará a ${cliente?.email}`}
                    {canalOtp === 'AMBOS' && `Se enviará a ${cliente?.telefono} y ${cliente?.email}`}
                  </p>
                </div>

                {!otpEnviado ? (
                  <Button onClick={enviarOTP} disabled={enviandoOtp} className="w-full">
                    {enviandoOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando código...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Enviar código de verificación
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="font-semibold">Ingresa el código de 6 dígitos</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={otpIngresado}
                        onChange={(e) => setOtpIngresado(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="ABC123"
                        className="text-center text-2xl font-mono tracking-widest"
                      />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        El código expira en 15 minutos
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={enviarOTP} disabled={enviandoOtp}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Reenviar
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={otpIngresado.length !== 6 || validandoOtp || guardandoFirma}
                        onClick={validarYGuardar}
                      >
                        {validandoOtp || guardandoFirma ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {validandoOtp ? 'Validando...' : 'Guardando firma...'}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Firmar y activar préstamo
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <Button variant="ghost" size="sm" onClick={() => setPaso(2)}>
                  Atrás
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Firma electrónica con verificación de identidad · Hash SHA-256
          </p>
          <p>Expira: {datos.expiracion ? formatearFecha(datos.expiracion) : '—'}</p>
        </div>
      </div>
    </div>
  )
}
