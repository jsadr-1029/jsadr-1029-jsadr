'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Car, Upload, FileText, PenTool, ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'

type Step = 'datos' | 'documentos' | 'firma' | 'otp' | 'completado'

interface FormData {
  cedula: string
  nombre: string
  telefono: string
  email: string
  direccion: string
  ciudad: string
  barrio: string
  fechaNacimiento: string
  licenciaNumero: string
  licenciaCategoria: string
  licenciaVence: string
  contactoEmergenciaNombre: string
  contactoEmergenciaTelefono: string
  contactoEmergenciaParentesco: string
  fotoCedulaFrente: string
  fotoCedulaReverso: string
  fotoLicenciaFrente: string
  fotoLicenciaReverso: string
  fotoSelfie: string
  fotoReciboServicios: string
  firmaElectronica: string
}

export default function RegistroConductorPage() {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('datos')
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [otpDemo, setOtpDemo] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    cedula: '', nombre: '', telefono: '', email: '',
    direccion: '', ciudad: '', barrio: '', fechaNacimiento: '',
    licenciaNumero: '', licenciaCategoria: '', licenciaVence: '',
    contactoEmergenciaNombre: '', contactoEmergenciaTelefono: '', contactoEmergenciaParentesco: '',
    fotoCedulaFrente: '', fotoCedulaReverso: '', fotoLicenciaFrente: '', fotoLicenciaReverso: '',
    fotoSelfie: '', fotoReciboServicios: '',
    firmaElectronica: '',
  })

  // Cargar token si viene de URL (para retomar)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const tokenUrl = urlParams.get('token')
    if (tokenUrl) {
      // Recuperar solicitud
      fetch(`/api/vehiculos/registro-conductor/documentos?token=${tokenUrl}`)
        .then(r => r.json())
        .then(r => {
          if (r.success) {
            const s = r.data
            setToken(tokenUrl)
            setForm({
              cedula: s.cedula, nombre: s.nombre, telefono: s.telefono, email: s.email || '',
              direccion: s.direccion || '', ciudad: s.ciudad || '', barrio: s.barrio || '',
              fechaNacimiento: s.fechaNacimiento ? s.fechaNacimiento.slice(0, 10) : '',
              licenciaNumero: s.licenciaNumero || '', licenciaCategoria: s.licenciaCategoria || '',
              licenciaVence: s.licenciaVence ? s.licenciaVence.slice(0, 10) : '',
              contactoEmergenciaNombre: s.contactoEmergenciaNombre || '',
              contactoEmergenciaTelefono: s.contactoEmergenciaTelefono || '',
              contactoEmergenciaParentesco: s.contactoEmergenciaParentesco || '',
              fotoCedulaFrente: s.fotoCedulaFrente || '', fotoCedulaReverso: s.fotoCedulaReverso || '',
              fotoLicenciaFrente: s.fotoLicenciaFrente || '', fotoLicenciaReverso: s.fotoLicenciaReverso || '',
              fotoSelfie: s.fotoSelfie || '', fotoReciboServicios: s.fotoReciboServicios || '',
              firmaElectronica: s.firmaElectronica || '',
            })
            // Ir al paso correspondiente
            if (s.estado === 'FIRMA') setStep('firma')
            else if (s.estado === 'OTP') setStep('otp')
            else if (s.estado === 'COMPLETADA') setStep('completado')
            else setStep('documentos')
          }
        })
    }
  }, [])

  // === Helpers para imágenes ===
  const comprimirImagen = (file: File, maxWidth: number = 1280, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          if (w > maxWidth) {
            h = (h * maxWidth) / w
            w = maxWidth
          }
          canvas.width = w
          canvas.height = h
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, campo: keyof FormData) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirImagen(file)
      setForm(prev => ({ ...prev, [campo]: base64 }))
      toast({ title: 'Foto cargada', description: `${campo} lista` })
    } catch (err: any) {
      toast({ title: 'Error al cargar imagen', description: err.message, variant: 'destructive' })
    }
  }

  // === STEP 1: DATOS ===
  const submitDatos = async () => {
    if (!form.cedula || !form.nombre || !form.telefono) {
      toast({ title: 'Faltan campos', description: 'Cédula, nombre y teléfono son obligatorios', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/vehiculos/registro-conductor/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: form.cedula, nombre: form.nombre,
          telefono: form.telefono, email: form.email,
        }),
      })
      const r = await res.json()
      if (r.success) {
        setToken(r.token)
        setStep('documentos')
        toast({ title: 'Datos guardados', description: 'Continúa con la carga de documentos' })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // === STEP 2: DOCUMENTOS ===
  const submitDocumentos = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/vehiculos/registro-conductor/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const r = await res.json()
      if (r.success) {
        if (r.fotosCompletas) {
          setStep('firma')
        }
        toast({ title: 'Documentos guardados', description: r.message })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // === STEP 3: FIRMA ELECTRÓNICA ===
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

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
        ctx.lineJoin = 'round'
      }
    }
  }, [step])

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setHasSigned(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDraw = () => { setIsDrawing(false) }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  const submitFirma = async () => {
    if (!hasSigned) {
      toast({ title: 'Firma requerida', description: 'Dibuja tu firma en el área', variant: 'destructive' })
      return
    }
    if (!token) return
    setLoading(true)
    try {
      const canvas = canvasRef.current
      const firmaBase64 = canvas?.toDataURL('image/png') || ''
      const res = await fetch('/api/vehiculos/registro-conductor/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firmaElectronica: firmaBase64 }),
      })
      const r = await res.json()
      if (r.success) {
        setStep('otp')
        toast({ title: 'Firma guardada', description: 'Continúa con la verificación OTP' })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // === STEP 4: OTP ===
  const solicitarOtp = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/vehiculos/registro-conductor/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const r = await res.json()
      if (r.success) {
        setOtpDemo(r.otpDemo || null)
        toast({ title: 'OTP enviado', description: r.message })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  const verificarOtp = async () => {
    if (!token || !otpInput) {
      toast({ title: 'Ingresa el código OTP', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/vehiculos/registro-conductor/verificar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp: otpInput }),
      })
      const r = await res.json()
      if (r.success) {
        setStep('completado')
        toast({ title: '¡Registro completado!', description: r.message })
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // === RENDER ===
  const FotoUpload = ({ campo, label, descripcion }: { campo: keyof FormData; label: string; descripcion: string }) => (
    <div>
      <Label>{label} *</Label>
      <p className="text-xs text-muted-foreground mb-1">{descripcion}</p>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileUpload(e, campo)}
          className="hidden"
          id={`file-${campo}`}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`file-${campo}`)?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Tomar/Subir foto
        </Button>
        {form[campo] && <CheckCircle className="w-4 h-4 text-green-600" />}
      </div>
      {form[campo] && (
        <img src={form[campo] as string} alt={label} className="mt-2 max-h-32 object-contain border rounded" />
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Registro de Conductor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completa todos los pasos para solicitar tu cuenta de conductor
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          {[
            { key: 'datos', label: 'Datos', icon: FileText },
            { key: 'documentos', label: 'Documentos', icon: Upload },
            { key: 'firma', label: 'Firma', icon: PenTool },
            { key: 'otp', label: 'OTP', icon: ShieldCheck },
          ].map((s, i) => {
            const Icon = s.icon
            const active = step === s.key
            const completed = ['datos', 'documentos', 'firma', 'otp', 'completado'].indexOf(step) > i
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex flex-col items-center ${i > 0 ? 'ml-3' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    active ? 'bg-blue-600 text-white' : completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-[10px] mt-1 text-muted-foreground">{s.label}</div>
                </div>
                {i < 3 && <div className="w-6 h-0.5 bg-gray-300 mx-1" />}
              </div>
            )
          })}
        </div>

        {/* STEP 1: DATOS */}
        {step === 'datos' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Cédula *</Label>
                <Input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="Sin puntos ni guiones" />
              </div>
              <div>
                <Label>Nombre completo *</Label>
                <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono *</Label>
                <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="3001234567" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <Button onClick={submitDatos} className="w-full" disabled={loading}>
                {loading ? 'Guardando...' : 'Continuar'} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: DOCUMENTOS */}
        {step === 'documentos' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Documentos y fotos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
                Toma fotos claras con buena iluminación. Todos los documentos deben ser legibles.
              </div>

              <FotoUpload campo="fotoCedulaFrente" label="Cédula - Frente" descripcion="Foto del frente de la cédula" />
              <FotoUpload campo="fotoCedulaReverso" label="Cédula - Reverso" descripcion="Foto del reverso de la cédula" />
              <FotoUpload campo="fotoLicenciaFrente" label="Licencia - Frente" descripcion="Foto del frente de la licencia" />
              <FotoUpload campo="fotoLicenciaReverso" label="Licencia - Reverso" descripcion="Foto del reverso de la licencia" />
              <FotoUpload campo="fotoSelfie" label="Selfie con documentos" descripcion="Foto tuya sosteniendo la cédula y la licencia" />
              <FotoUpload campo="fotoReciboServicios" label="Recibo de servicios públicos" descripcion="Donde se evidencie tu dirección de residencia" />

              <div className="border-t pt-3 mt-3">
                <h3 className="font-medium text-sm mb-2">Datos adicionales</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Dirección</Label><Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} /></div>
                  <div><Label>Ciudad</Label><Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} /></div>
                  <div><Label>Barrio</Label><Input value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value })} /></div>
                  <div><Label>Fecha nacimiento</Label><Input type="date" value={form.fechaNacimiento} onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })} /></div>
                  <div><Label>Licencia N°</Label><Input value={form.licenciaNumero} onChange={e => setForm({ ...form, licenciaNumero: e.target.value })} /></div>
                  <div><Label>Categoría</Label>
                    <Select value={form.licenciaCategoria} onValueChange={v => setForm({ ...form, licenciaCategoria: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Licencia vence</Label><Input type="date" value={form.licenciaVence} onChange={e => setForm({ ...form, licenciaVence: e.target.value })} /></div>
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <h3 className="font-medium text-sm mb-2">Contacto de emergencia</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Nombre</Label><Input value={form.contactoEmergenciaNombre} onChange={e => setForm({ ...form, contactoEmergenciaNombre: e.target.value })} /></div>
                  <div><Label>Teléfono</Label><Input value={form.contactoEmergenciaTelefono} onChange={e => setForm({ ...form, contactoEmergenciaTelefono: e.target.value })} /></div>
                  <div><Label>Parentesco</Label><Input value={form.contactoEmergenciaParentesco} onChange={e => setForm({ ...form, contactoEmergenciaParentesco: e.target.value })} placeholder="Hijo/a, esposa, etc." /></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('datos')}><ArrowLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <Button onClick={submitDocumentos} disabled={loading} className="flex-1">
                  {loading ? 'Guardando...' : 'Guardar y continuar'} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: FIRMA */}
        {step === 'firma' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Firma electrónica</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Firma en el área siguiente para confirmar que la información proporcionada es veraz.
                Esta firma se incluirá en tu contrato digital.
              </p>
              <div className="border-2 border-blue-300 rounded">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearSignature} size="sm">Limpiar</Button>
                <Button variant="outline" onClick={() => setStep('documentos')} size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                <Button onClick={submitFirma} disabled={loading} className="flex-1">
                  {loading ? 'Guardando...' : 'Confirmar firma'} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: OTP */}
        {step === 'otp' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Verificación OTP</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Te enviaremos un código OTP a tu teléfono {form.telefono.slice(0, -3)}XXX.
                Ingresa el código de 6 dígitos para finalizar tu registro.
              </p>

              {!otpDemo && (
                <Button onClick={solicitarOtp} disabled={loading} className="w-full">
                  {loading ? 'Enviando...' : 'Solicitar código OTP'}
                </Button>
              )}

              {otpDemo && (
                <>
                  <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium">Modo demo:</span>
                    </div>
                    <div className="mt-1">Tu código OTP es: <strong className="font-mono text-lg">{otpDemo}</strong></div>
                    <div className="text-xs text-muted-foreground mt-1">
                      En producción este código se enviaría por WhatsApp/SMS sin mostrarse en pantalla.
                    </div>
                  </div>
                  <div>
                    <Label>Ingresa el código OTP *</Label>
                    <Input
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="text-center text-lg font-mono tracking-widest"
                    />
                  </div>
                  <Button onClick={verificarOtp} disabled={loading} className="w-full">
                    {loading ? 'Verificando...' : 'Verificar y completar registro'} <CheckCircle className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="outline" onClick={solicitarOtp} size="sm" className="w-full">Reenviar código</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: COMPLETADO */}
        {step === 'completado' && (
          <Card className="border-green-300">
            <CardContent className="py-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-green-700">¡Registro completado!</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Tu solicitud de registro ha sido enviada y firmada electrónicamente.
                Un administrador revisará tu solicitud y te asignará un vehículo.
                Una vez aprobado, podrás iniciar sesión en el portal del conductor con tu cédula.
              </p>
              <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                <strong>Resumen:</strong>
                <ul className="text-left mt-2 space-y-1 text-xs">
                  <li>• Cédula: {form.cedula}</li>
                  <li>• Nombre: {form.nombre}</li>
                  <li>• Teléfono: {form.telefono}</li>
                  <li>• Licencia: {form.licenciaCategoria} - {form.licenciaNumero}</li>
                  <li>• Documentos: 6 fotos cargadas</li>
                  <li>• Firma electrónica: ✓</li>
                  <li>• OTP verificado: ✓</li>
                </ul>
              </div>
              <Button className="mt-4" onClick={() => window.location.href = '/'}>
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
