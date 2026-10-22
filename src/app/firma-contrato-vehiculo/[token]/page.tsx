'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Car, Upload, CheckCircle, PenTool, ShieldCheck, AlertTriangle, FileText, User, ArrowRight, ArrowLeft, Loader2, Download } from 'lucide-react'

type Step = 'cargando' | 'error' | 'fotos' | 'firma' | 'otp' | 'completado'

export default function PaginaFirmaContrato({ params }: { params: Promise<{ token: string }> }) {
  const { toast } = useToast()
  const [token, setToken] = useState('')
  const [step, setStep] = useState<Step>('cargando')
  const [errorMsg, setErrorMsg] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Fotos
  const [fotoCedulaFrente, setFotoCedulaFrente] = useState('')
  const [fotoCedulaReverso, setFotoCedulaReverso] = useState('')
  const [fotoSelfie, setFotoSelfie] = useState('')

  // Firma
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  // OTP
  const [otpIngresado, setOtpIngresado] = useState('')
  const [otpEnviado, setOtpEnviado] = useState(false)

  useEffect(() => { params.then(p => setToken(p.token)) }, [params])

  useEffect(() => {
    if (!token) return
    cargarEstado()
  }, [token])

  const cargarEstado = async () => {
    try {
      const res = await fetch(`/api/vehiculos/contrato-legal/estado?token=${token}`)
      const r = await res.json()
      if (r.success) {
        setData(r.data)
        // Determinar el paso actual
        const f = r.data.firmaActual
        if (f.fechaFirma) {
          setStep('completado')
        } else if (f.otpValidado) {
          setStep('completado') // puede completar
        } else if (f.firmaManuscrita) {
          setStep('otp')
        } else if (f.fotoCedulaFrente) {
          setStep('firma')
        } else {
          setStep('fotos')
        }
        // Cargar fotos si ya están guardadas
        if (f.fotoCedulaFrente) setFotoCedulaFrente(f.fotoCedulaFrente)
        if (f.fotoCedulaReverso) setFotoCedulaReverso(f.fotoCedulaReverso)
        if (f.fotoSelfie) setFotoSelfie(f.fotoSelfie)
      } else {
        setErrorMsg(r.error || 'Error al cargar')
        setStep('error')
      }
    } catch (e: any) {
      setErrorMsg(e.message)
      setStep('error')
    }
  }

  const comprimirImagen = (file: File, maxWidth = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth }
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas error'))
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'frente' | 'reverso' | 'selfie') => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirImagen(file)
      if (tipo === 'frente') setFotoCedulaFrente(base64)
      else if (tipo === 'reverso') setFotoCedulaReverso(base64)
      else setFotoSelfie(base64)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const guardarFotos = async () => {
    if (!fotoCedulaFrente || !fotoCedulaReverso || !fotoSelfie) {
      toast({ title: 'Faltan fotos', variant: 'destructive' })
      return
    }
    setLoading(true)
    const endpoint = data.esConductor ? 'firma-conductor' : 'firma-propietario'
    try {
      const res = await fetch(`/api/vehiculos/contratos/dummy/documento-legal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion: 'fotos', fotoCedulaFrente, fotoCedulaReverso, fotoSelfie }),
      })
      const r = await res.json()
      if (r.success) {
        setStep('firma')
        toast({ title: 'Fotos guardadas' })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // Canvas firma
  useEffect(() => {
    if (step === 'firma' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#1e40af'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
      }
    }
  }, [step])

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true); setHasSigned(true)
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y); ctx.stroke()
  }
  const stopDraw = () => setIsDrawing(false)
  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  const guardarFirma = async () => {
    if (!hasSigned) { toast({ title: 'Dibuja tu firma', variant: 'destructive' }); return }
    setLoading(true)
    const endpoint = data.esConductor ? 'firma-conductor' : 'firma-propietario'
    const firmaBase64 = canvasRef.current?.toDataURL('image/png') || ''
    try {
      const res = await fetch(`/api/vehiculos/contratos/dummy/documento-legal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion: 'firma', firmaManuscrita: firmaBase64 }),
      })
      const r = await res.json()
      if (r.success) { setStep('otp') } else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    setLoading(false)
  }

  const enviarOtp = async () => {
    setLoading(true)
    const endpoint = data.esConductor ? 'firma-conductor' : 'firma-propietario'
    try {
      const res = await fetch(`/api/vehiculos/contratos/dummy/documento-legal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion: 'otp' }),
      })
      const r = await res.json()
      if (r.success) { setOtpEnviado(true); toast({ title: 'Código enviado', description: r.message }) }
      else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    setLoading(false)
  }

  const verificarOtp = async () => {
    if (!otpIngresado) { toast({ title: 'Ingresa el código', variant: 'destructive' }); return }
    setLoading(true)
    const endpoint = data.esConductor ? 'firma-conductor' : 'firma-propietario'
    try {
      const res = await fetch(`/api/vehiculos/contratos/dummy/documento-legal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion: 'verificar-otp', otpIngresado }),
      })
      const r = await res.json()
      if (r.success) { toast({ title: 'OTP verificado' }) }
      else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    setLoading(false)
  }

  const completarFirma = async () => {
    setLoading(true)
    const endpoint = data.esConductor ? 'firma-conductor' : 'firma-propietario'
    try {
      const res = await fetch(`/api/vehiculos/contratos/dummy/documento-legal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion: 'completar' }),
      })
      const r = await res.json()
      if (r.success) { setStep('completado'); toast({ title: '¡Firma completada!', description: r.message }) }
      else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    setLoading(false)
  }

  // === RENDER ===
  if (step === 'cargando') {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  }

  if (step === 'error') {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="w-5 h-5" /> Error</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{errorMsg}</p></CardContent>
      </Card>
    </div>
  }

  if (step === 'completado') {
    const nombreFirmante = data?.esConductor ? data.conductor.nombre : data?.propietario?.nombre
    const contratoCompleto = data?.estado === 'COMPLETADO'
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="py-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-green-700">¡Firma completada!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {data?.esConductor
              ? `Tu firma como conductor ha sido registrada. Se ha notificado al propietario para que firme el contrato.`
              : `¡Contrato firmado por ambas partes! El contrato ${data?.numeroContrato || ''} está completo.`}
          </p>
          <div className="mt-4 p-3 bg-green-50 rounded-lg text-left text-xs space-y-1">
            <div>✓ Fotos de cédula cargadas</div>
            <div>✓ Selfie con cédula cargada</div>
            <div>✓ Firma manuscrita registrada</div>
            <div>✓ Código OTP verificado</div>
            <div>✓ Firma registrada con IP y fecha</div>
          </div>
          {contratoCompleto && (
            <a href={`/api/vehiculos/contrato-legal/descargar?token=${token}`} target="_blank" rel="noopener noreferrer">
              <Button className="mt-4 w-full bg-gradient-to-r from-blue-500 to-indigo-500">
                <Download className="w-4 h-4 mr-2" /> Descargar contrato PDF
              </Button>
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  }

  const FotoUpload = ({ value, onChange, label, descripcion }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: string; descripcion: string }) => (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground mb-2">{descripcion}</p>
      <div className="flex items-center gap-2">
        <input type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden" id={`file-${label.replace(/\s/g, '')}`} />
        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`file-${label.replace(/\s/g, '')}`)?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Tomar foto
        </Button>
        {value && <CheckCircle className="w-4 h-4 text-green-600" />}
      </div>
      {value && <img src={value} alt={label} className="mt-2 max-h-32 object-contain border rounded" />}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Firma de Contrato de Arrendamiento</h1>
          <p className="text-sm text-muted-foreground mt-1">Contrato {data?.numeroContrato}</p>
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {data?.esConductor ? <><User className="w-3 h-3" /> Firmas como CONDUCTOR</> : <><ShieldCheck className="w-3 h-3" /> Firmas como PROPIETARIO</>}
          </div>
        </div>

        {/* Resumen del contrato */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Vehículo:</span> <strong>{data?.vehiculo?.marca} {data?.vehiculo?.modelo}</strong></div>
              <div><span className="text-muted-foreground">Placa:</span> <strong>{data?.vehiculo?.placa}</strong></div>
              <div><span className="text-muted-foreground">Conductor:</span> {data?.conductor?.nombre}</div>
              <div><span className="text-muted-foreground">Propietario:</span> {data?.propietario?.nombre}</div>
              <div><span className="text-muted-foreground">Tarifa:</span> ${data?.terminos?.tarifa?.toLocaleString('es-CO')} / {data?.terminos?.modalidadPago}</div>
              <div><span className="text-muted-foreground">Inicio:</span> {data?.terminos?.fechaInicio ? new Date(data.terminos.fechaInicio).toLocaleDateString('es-CO') : '—'}</div>
            </div>
          </CardContent>
        </Card>

        {/* Stepper */}
        <div className="flex items-center justify-between px-2">
          {[
            { key: 'fotos', label: 'Fotos', icon: Upload },
            { key: 'firma', label: 'Firma', icon: PenTool },
            { key: 'otp', label: 'OTP', icon: ShieldCheck },
          ].map((s, i) => {
            const Icon = s.icon
            const active = step === s.key
            const completed = ['fotos', 'firma', 'otp', 'completado'].indexOf(step) > i
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-blue-600 text-white' : completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-[10px] mt-1 text-muted-foreground">{s.label}</div>
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-300 mx-1" />}
              </div>
            )
          })}
        </div>

        {/* PASO 1: FOTOS */}
        {step === 'fotos' && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Documentos de identificación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Toma fotos claras con buena iluminación.</p>
              <FotoUpload value={fotoCedulaFrente} onChange={(e) => handlePhoto(e, 'frente')} label="Cédula frente" descripcion="Foto del frente de tu cédula" />
              <FotoUpload value={fotoCedulaReverso} onChange={(e) => handlePhoto(e, 'reverso')} label="Cédula reverso" descripcion="Foto del reverso de tu cédula" />
              <FotoUpload value={fotoSelfie} onChange={(e) => handlePhoto(e, 'selfie')} label="Selfie con cédula" descripcion="Tómate una foto sosteniendo tu cédula" />
              <Button onClick={guardarFotos} disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continuar a firma <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PASO 2: FIRMA MANUSCRITA */}
        {step === 'firma' && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Firma manuscrita</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Dibuja tu firma en el área siguiente. Esta firma tendrá validez legal.</p>
              <div className="border-2 border-blue-300 rounded overflow-hidden bg-white">
                <canvas
                  ref={canvasRef} width={600} height={200}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('fotos')} size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <Button variant="outline" onClick={clearSignature} size="sm">Limpiar</Button>
                <Button onClick={guardarFirma} disabled={loading} className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Guardar firma <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASO 3: OTP */}
        {step === 'otp' && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Verificación OTP</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Te enviaremos un código OTP a tu correo electrónico. Ingrésalo para completar la firma.
              </p>
              {!otpEnviado ? (
                <Button onClick={enviarOtp} disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Enviar código OTP
                </Button>
              ) : (
                <>
                  <div>
                    <Label>Código OTP</Label>
                    <Input value={otpIngresado} onChange={e => setOtpIngresado(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456" className="text-center text-lg font-mono tracking-widest" />
                  </div>
                  <Button onClick={verificarOtp} disabled={loading || !otpIngresado} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500">
                    Verificar código
                  </Button>
                  <Button variant="outline" onClick={enviarOtp} size="sm" className="w-full">Reenviar código</Button>
                </>
              )}
              <Button variant="outline" onClick={() => setStep('firma')} size="sm" className="w-full"><ArrowLeft className="w-4 h-4 mr-1" /> Atrás</Button>
            </CardContent>
          </Card>
        )}

        {/* Botón completar (visible cuando OTP está verificado) */}
        {step === 'otp' && (
          <Button onClick={completarFirma} disabled={loading} className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 text-base">
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
            Completar firma
          </Button>
        )}
      </div>
    </div>
  )
}
