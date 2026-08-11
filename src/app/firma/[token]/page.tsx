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
import { capturarFoto } from '@/lib/camera'
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
  // === NUEVO ORDEN DEL FLUJO ===
  // 1: foto documento
  // 2: firma manuscrita
  // 3: OTP
  // 4: selfie con cédula
  // 5: completado
  // 6: rechazado
  const [paso, setPaso] = useState(1)

  // Paso 1: foto documento
  const [fotoDocumento, setFotoDocumento] = useState<string | null>(null)
  const [subiendoFotoDoc, setSubiendoFotoDoc] = useState(false)

  // Paso 2: firma manuscrita
  const [firmaDibujada, setFirmaDibujada] = useState<string | null>(null)
  const [guardandoFirmaDibujo, setGuardandoFirmaDibujo] = useState(false)

  // Paso 3: OTP
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [otpIngresado, setOtpIngresado] = useState('')
  const [enviandoOtp, setEnviandoOtp] = useState(false)
  const [validandoOtp, setValidandoOtp] = useState(false)
  const [canalOtp, setCanalOtp] = useState<'WHATSAPP' | 'EMAIL' | 'AMBOS'>('AMBOS')

  // Paso 4: selfie
  const [fotoSelfie, setFotoSelfie] = useState<string | null>(null)
  const [finalizando, setFinalizando] = useState(false)

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
          setPaso(5)
        } else if (json.data.firma?.estadoFirma === 'RECHAZADA') {
          setPaso(6)
        } else if (json.data.firma?.estadoFirma === 'OTP_ENVIADO' || json.data.firma?.otpValidado) {
          // Reanudar en paso 3 si el OTP ya fue enviado
          setPaso(3)
          if (json.data.firma?.otpValidado) {
            setOtpEnviado(true)
          }
        } else if (json.data.firma?.imagenFirma) {
          // Reanudar en paso 3 si la firma ya está dibujada
          setPaso(3)
        } else if (json.data.firma?.fotoDocumento) {
          // Reanudar en paso 2 si la foto del documento ya está subida
          setFotoDocumento(json.data.firma.fotoDocumento)
          setPaso(2)
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
  const manejarArchivo = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'documento' | 'selfie') => {
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
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (tipo === 'documento') setFotoDocumento(result)
      else setFotoSelfie(result)
    }
    reader.readAsDataURL(file)
  }

  const tomarFoto = async (tipo: 'documento' | 'selfie') => {
    try {
      const dataUrl = await capturarFoto(
        tipo === 'selfie' ? 'user' : 'environment',
        {
          titulo: tipo === 'selfie' ? 'Tomar selfie con cédula' : 'Tomar foto del documento',
          textoBoton: tipo === 'selfie' ? 'Capturar selfie' : 'Capturar foto',
          espejar: tipo === 'selfie',
        }
      )
      if (dataUrl) {
        if (tipo === 'documento') setFotoDocumento(dataUrl)
        else setFotoSelfie(dataUrl)
        toast({ title: 'Foto capturada', description: 'Revisa la imagen antes de continuar.' })
      }
    } catch (e: any) {
      toast({
        title: e?.userMessage || 'Error al acceder a la cámara',
        description: e?.hint || 'Usa la opción de subir archivo.',
        variant: 'destructive',
      })
    }
  }

  // === PASO 1: Guardar foto del documento ===
  const guardarFotoDocumento = async () => {
    if (!fotoDocumento || !datos?.firma) return
    setSubiendoFotoDoc(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_foto_documento',
          firmaId: datos.firma.id,
          fotoDocumento,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Foto del documento guardada',
          description: 'Ahora puedes dibujar tu firma electrónica.',
        })
        setPaso(2)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubiendoFotoDoc(false)
    }
  }

  // === Canvas firma (paso 2) ===
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
    if ('touches' in e) e.preventDefault()
    ctx.beginPath()
    setDibujando(true)
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = ((clientX - rect.left) * canvas.width) / rect.width
    const y = ((clientY - rect.top) * canvas.height) / rect.height
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
  }

  const moverDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!dibujando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if ('touches' in e) e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    let x, y
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }
    x = (x * canvas.width) / rect.width
    y = (y * canvas.height) / rect.height
    ctx.lineTo(x, y)
    ctx.stroke()
    setFirmaDibujada(canvas.toDataURL('image/png'))
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

  // === PASO 2: Guardar firma manuscrita ===
  const guardarFirmaDibujo = async () => {
    if (!firmaDibujada || !datos?.firma) return
    setGuardandoFirmaDibujo(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar_firma_dibujo',
          firmaId: datos.firma.id,
          imagenFirma: firmaDibujada,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Firma guardada',
          description: 'Ahora solicita el código de verificación OTP.',
        })
        setPaso(3)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoFirmaDibujo(false)
    }
  }

  // === PASO 3: Enviar OTP ===
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
      const json = await res.json()
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

  // === PASO 3: Validar OTP ===
  const validarOTP = async () => {
    if (!otpIngresado || !datos?.firma) return
    setValidandoOtp(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'validar_otp',
          firmaId: datos.firma.id,
          otpIngresado,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Código verificado',
          description: 'Ahora toma la selfie con tu cédula para finalizar.',
        })
        setPaso(4)
      } else {
        toast({ title: 'Código incorrecto', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setValidandoOtp(false)
    }
  }

  // === PASO 4: Finalizar con selfie ===
  const finalizarConSelfie = async () => {
    if (!fotoSelfie || !datos?.firma) return
    setFinalizando(true)
    try {
      const res = await fetch('/api/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'finalizar_con_selfie',
          firmaId: datos.firma.id,
          fotoSelfie,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '¡Firma completada!',
          description: 'Tu firma electrónica ha sido guardada con éxito.',
        })
        setPaso(5)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setFinalizando(false)
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
  if (paso === 6 || datos.firma?.estadoFirma === 'RECHAZADA') {
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

  // === Paso 5: Completado ===
  if (paso === 5) {
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

  // Stepper con 4 pasos
  const pasosStepper = [
    { num: 1, label: 'Documento', icon: FileText },
    { num: 2, label: 'Firma', icon: PenTool },
    { num: 3, label: 'Verificación', icon: Shield },
    { num: 4, label: 'Selfie', icon: User },
  ]

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
                  {formatearMoneda(prestamo.montoPrincipal)} · {prestamo.numeroCuotas || prestamo.plazoMeses} cuotas
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pasos */}
        <Card>
          <CardContent className="p-4">
            {/* Stepper 4 pasos */}
            <div className="flex items-center justify-between mb-6">
              {pasosStepper.map((p, idx) => {
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
                    {idx < pasosStepper.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${completado ? 'bg-green-600' : 'bg-gray-300'}`} />}
                  </div>
                )
              })}
            </div>

            {/* PASO 1: Foto del documento */}
            {paso === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    📷 <strong>Paso 1 de 4:</strong> Sube una foto clara de tu documento de identidad (cédula, pasaporte o licencia) por el lado frontal.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Foto del documento de identidad</Label>
                  <p className="text-xs text-muted-foreground">Cédula, pasaporte o licencia (frente)</p>
                  {fotoDocumento ? (
                    <div className="relative">
                      <img src={fotoDocumento} alt="Documento" className="w-full h-64 object-cover rounded-md border-2 border-green-300" />
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
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center space-y-3">
                      <FileText className="w-12 h-12 mx-auto text-gray-400" />
                      <Button variant="outline" asChild className="w-full sm:w-auto">
                        <label className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" /> Subir archivo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => manejarArchivo(e, 'documento')} />
                        </label>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 p-2 rounded-md border border-amber-200 text-xs text-amber-900">
                  ⚠️ La foto será almacenada como evidencia de identidad con hash SHA-256 para verificar su integridad.
                </div>

                <Button
                  className="w-full"
                  disabled={!fotoDocumento || subiendoFotoDoc}
                  onClick={guardarFotoDocumento}
                >
                  {subiendoFotoDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando foto...
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

            {/* PASO 2: Dibujar firma manuscrita */}
            {paso === 2 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    ✍️ <strong>Paso 2 de 4:</strong> Dibuja tu firma en el recuadro siguiente usando el mouse o tu dedo (en móvil).
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
                  <Button
                    className="flex-1"
                    disabled={!firmaDibujada || guardandoFirmaDibujo}
                    onClick={guardarFirmaDibujo}
                  >
                    {guardandoFirmaDibujo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Continuar a verificación
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* PASO 3: Verificación OTP */}
            {paso === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    🔐 <strong>Paso 3 de 4:</strong> Verifica tu identidad con un código de 6 dígitos.
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
                        El código expira en 5 minutos
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={enviarOTP} disabled={enviandoOtp}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Reenviar
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={otpIngresado.length !== 6 || validandoOtp}
                        onClick={validarOTP}
                      >
                        {validandoOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Validando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Verificar código
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

            {/* PASO 4: Selfie sosteniendo la cédula */}
            {paso === 4 && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900">
                    🤳 <strong>Paso 4 de 4:</strong> Toma una selfie sosteniendo tu cédula. Tu cara y el documento deben verse claramente en la foto.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Selfie sosteniendo la cédula</Label>
                  <p className="text-xs text-muted-foreground">Tu cara y el documento deben verse claramente</p>
                  {fotoSelfie ? (
                    <div className="relative">
                      <img src={fotoSelfie} alt="Selfie" className="w-full h-64 object-cover rounded-md border-2 border-green-300" />
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
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center space-y-3">
                      <User className="w-12 h-12 mx-auto text-gray-400" />
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button onClick={() => tomarFoto('selfie')}>
                          <Camera className="w-4 h-4 mr-2" /> Tomar selfie
                        </Button>
                        <Button variant="outline" asChild>
                          <label className="cursor-pointer">
                            <Upload className="w-4 h-4 mr-2" /> Subir archivo
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => manejarArchivo(e, 'selfie')} />
                          </label>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 p-2 rounded-md border border-amber-200 text-xs text-amber-900">
                  ⚠️ Esta foto es la verificación final de identidad. Se almacenará con hash SHA-256.
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPaso(3)}>
                    Atrás
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!fotoSelfie || finalizando}
                    onClick={finalizarConSelfie}
                  >
                    {finalizando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Finalizando firma...
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
