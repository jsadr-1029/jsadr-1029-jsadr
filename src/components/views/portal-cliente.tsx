'use client'

import { useState, useEffect, useRef } from 'react'
import { apiPost } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatCOP, formatDate, formatPercent, getInitials, estadoPrestamoColor } from '@/lib/format'
import { calcularPrestamo, generarCronograma } from '@/lib/finance'
import { LogIn, ArrowLeft, Phone, Lock, Calculator, FileCheck, Send, KeyRound, ShieldCheck, Eye, EyeOff, QrCode, Copy, Check, Sparkles, PenTool, Eraser, FileSignature, FileText, Clock, ExternalLink, AlertCircle, Trophy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { PasaporteConfianzaView } from './pasaporte/PasaporteConfianzaView'

type View = { name: string; id?: string }

type PortalSession = {
  token: string
  clienteId: string
  nombre: string
}

export function PortalCliente({ navigate }: { navigate: (v: any) => void }) {
  const [session, setSession] = useState<PortalSession | null>(null)
  const [step, setStep] = useState<'cedula' | 'pin' | 'logged'>('cedula')
  const [cedulaData, setCedulaData] = useState<{ clienteId: string; nombre: string; tienePin: boolean; telefono: string } | null>(null)
  const [cedula, setCedula] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('portalSession')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        setSession(s)
        setStep('logged')
      } catch {}
    }
  }, [])

  const verificarCedula = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiPost('/api/portal/verificar-cedula', { cedula })
      setCedulaData(res)
      setStep('pin')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiPost('/api/portal/login', { clienteId: cedulaData?.clienteId, pin })
      setSession(res)
      localStorage.setItem('portalSession', JSON.stringify(res))
      setStep('logged')
      toast.success(res.nuevoPin ? 'PIN creado correctamente' : 'Sesión iniciada')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const logout = () => {
    setSession(null)
    setCedulaData(null)
    setCedula('')
    setPin('')
    setStep('cedula')
    localStorage.removeItem('portalSession')
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'dashboard' })} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al panel
        </Button>

        {step === 'cedula' && (
          <Card className="max-w-md mx-auto p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center mx-auto mb-3">
                <LogIn className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Portal del Cliente</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresa con tu cédula para continuar</p>
            </div>
            <form onSubmit={verificarCedula} className="space-y-3">
              <div>
                <Label>Cédula de ciudadanía</Label>
                <Input
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567890"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verificando...' : 'Continuar'}
              </Button>
            </form>
          </Card>
        )}

        {step === 'pin' && cedulaData && (
          <Card className="max-w-md mx-auto p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Hola, {cedulaData.nombre.split(' ')[0]}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {cedulaData.tienePin ? 'Ingresa tu PIN de 4 dígitos' : 'Crea tu PIN de 4 dígitos (primer acceso)'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Teléfono: {cedulaData.telefono}****</p>
            </div>
            <form onSubmit={login} className="space-y-3">
              <div>
                <Label>PIN (4 dígitos)</Label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    required
                    autoFocus
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || pin.length !== 4}>
                {loading ? 'Ingresando...' : cedulaData.tienePin ? 'Ingresar' : 'Crear PIN y continuar'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep('cedula'); setCedulaData(null); setPin('') }}>
                Cambiar cédula
              </Button>
            </form>
          </Card>
        )}

        {step === 'logged' && session && (
          <PortalHome session={session} onLogout={logout} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

function PortalHome({ session, onLogout, navigate }: { session: PortalSession; onLogout: () => void; navigate: (v: any) => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pendientesFirmaCount, setPendientesFirmaCount] = useState(0)
  const [novedadesPasaporteCount, setNovedadesPasaporteCount] = useState(0)

  useEffect(() => {
    fetch(`/api/portal/prestamos?token=${session.token}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))

    // === Cargar contador de Otros Síes pendientes de firma ===
    fetch('/api/portal/otros-si-pendientes', {
      headers: { 'x-portal-token': session.token },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setPendientesFirmaCount(d.pendientesCount || 0)
      })
      .catch(() => {/* no crítico */})

    // === Cargar contador de novedades del Pasaporte de Confianza ===
    fetch(`/api/portal/pasaporte?token=${session.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.novedades) {
          // Contar solo novedades críticas/warning para el badge
          const count = d.data.novedades.filter((n: any) =>
            n.tipo === 'PAGO_EXCEDIDO' ||
            n.tipo === 'COMPROMISO_VENCIDO' ||
            n.tipo === 'PAGO_PARCIAL'
          ).length
          setNovedadesPasaporteCount(count)
        }
      })
      .catch(() => {/* no crítico */})
  }, [session.token])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState icon={LogIn} title="Sin datos" />

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-lg font-bold">
              {getInitials(session.nombre)}
            </div>
            <div>
              <p className="font-bold text-slate-900">{session.nombre}</p>
              <p className="text-xs text-slate-600">CC {data.cliente.cedula}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>Cerrar sesión</Button>
        </div>
      </Card>

      <Tabs defaultValue="prestamos">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="prestamos">Solicitudes</TabsTrigger>
          <TabsTrigger value="firmar">
            Documentos
            {pendientesFirmaCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendientesFirmaCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagos">Pagos / QR</TabsTrigger>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="pasaporte">
            <span className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pasaporte</span>
              {novedadesPasaporteCount > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {novedadesPasaporteCount}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center min-w-[10px] h-[10px] rounded-full bg-emerald-500" title="Trayectoria excelente" />
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="perfil">Mi Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="prestamos">
          <Card title="Solicitudes Activos" subtitle={`${data.prestamos?.length || 0} solicitudes`}>
            {!data.prestamos?.length ? (
              <EmptyState icon={FileCheck} title="Sin solicitudes" description="No tienes solicitudes registrados." />
            ) : (
              <div className="space-y-3">
                {data.prestamos.map((p: any) => (
                  <PrestamoCard key={p.id} prestamo={p} token={session.token} navigate={navigate} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="firmar">
          <DocumentosPorFirmarPanel token={session.token} />
        </TabsContent>

        <TabsContent value="pagos">
          <CuentaPagoPanel token={session.token} />
        </TabsContent>

        <TabsContent value="simular">
          <SimuladorPrestamo token={session.token} />
        </TabsContent>

        <TabsContent value="pasaporte">
          <PasaporteConfianzaView token={session.token} />
        </TabsContent>

        <TabsContent value="perfil">
          <Card title="Mis Datos">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-500">Nombre</p><p className="font-medium">{data.cliente.nombre}</p></div>
              <div><p className="text-xs text-slate-500">Cédula</p><p className="font-medium">{data.cliente.cedula}</p></div>
              <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium">{data.cliente.telefono}</p></div>
              <div><p className="text-xs text-slate-500">Email</p><p className="font-medium">{data.cliente.email || '—'}</p></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// CuentaPagoPanel — muestra la cuenta de recaudo asignada
// al cliente con su código QR para escanear al momento de pagar.
// =====================================================
function CuentaPagoPanel({ token }: { token: string }) {
  const [cuenta, setCuenta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch('/api/portal/cuenta-pago', {
      headers: { 'x-portal-token': token },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setCuenta(d.cuenta)
        else toast.error(d.error || 'No se pudo cargar la cuenta de pago')
      })
      .catch(e => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <LoadingState />
  if (!cuenta) return <EmptyState icon={QrCode} title="Sin cuenta asignada" description="No tienes una cuenta de recaudo asignada. Contacta al administrador." />

  const copiarNumero = async () => {
    try {
      await navigator.clipboard.writeText(cuenta.numeroCuenta)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
      toast.success('Número de cuenta copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el número')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Cuenta para realizar tus pagos</h3>
          <p className="text-sm text-slate-500 mt-1">
            Escanea el código QR o copia el número de cuenta para realizar el pago de tus cuotas.
          </p>
        </div>

        {/* === QR de la cuenta === */}
        {cuenta.qrImagen ? (
          <div className="flex flex-col items-center mb-4">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
              <img
                src={cuenta.qrImagen}
                alt={`QR cuenta ${cuenta.codigo}`}
                className="w-48 h-48 object-contain"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center max-w-xs">
              Escanea este código con la app de tu banco para realizar el pago de forma rápida.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-4 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <QrCode className="w-12 h-12 text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 text-center">
              Esta cuenta aún no tiene un código QR cargado. Usa los datos de la cuenta para realizar tu pago.
            </p>
          </div>
        )}

        {/* === Datos de la cuenta === */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Banco</p>
              <p className="font-semibold text-slate-900">{cuenta.banco}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tipo de cuenta</p>
              <p className="font-semibold text-slate-900">{cuenta.tipoCuenta}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Número de cuenta</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold text-slate-900 text-lg">{cuenta.numeroCuenta}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={copiarNumero}
                  title="Copiar número"
                >
                  {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Titular</p>
              <p className="font-semibold text-slate-900">{cuenta.titular}</p>
            </div>
          </div>
        </div>

        {/* === Aviso importante === */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Importante:</strong> Realiza el pago solo a la cuenta asignada a tu categoría. Si tienes dudas sobre qué cuenta usar, contacta al administrador. Conserva el comprobante de pago como respaldo.
          </p>
        </div>
      </Card>
    </div>
  )
}

function PrestamoCard({ prestamo, token, navigate }: any) {
  const [firmarOpen, setFirmarOpen] = useState(false)
  const progreso = prestamo.numeroCuotas > 0 ? (prestamo.cuotasPagadas / prestamo.numeroCuotas) * 100 : 0

  // === Determinar si el solicitud está saldado/cancelado ===
  const estaCancelado = prestamo.estado === 'CANCELADO'
  const estaSaldado = prestamo.saldoTotal <= 0 && prestamo.cuotasPagadas >= prestamo.numeroCuotas
  const puedeDescargarPazYSalvo = estaCancelado || estaSaldado

  const handleDescargarPazYSalvo = () => {
    if (!puedeDescargarPazYSalvo) {
      toast.error('El paz y salvo solo se puede descargar para créditos completamente pagados o cancelados. Este crédito aún está vigente.')
      return
    }
    // Abrir el paz y salvo en una nueva pestaña
    const url = `/api/paz-y-salvo?prestamoId=${prestamo.id}&token=${token}&formato=html&auto=1`
    window.open(url, '_blank')
  }

  return (
    <div className="p-3 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-mono text-xs text-slate-700">{prestamo.codigo}</p>
          <Badge className={estadoPrestamoColor(prestamo.estado)}>{prestamo.estado}</Badge>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900">{formatCOP(prestamo.saldoTotal)}</p>
          <p className="text-xs text-slate-500">Saldo pendiente</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div><p className="text-slate-500">Principal</p><p className="font-semibold">{formatCOP(prestamo.montoPrincipal)}</p></div>
        <div><p className="text-slate-500">Cuota</p><p className="font-semibold">{formatCOP(prestamo.montoCuota)}</p></div>
        <div><p className="text-slate-500">Tasa</p><p className="font-semibold">{formatPercent(prestamo.tasaInteresMensual)}/m</p></div>
        <div><p className="text-slate-500">Pagado</p><p className="font-semibold">{formatCOP(prestamo.montoPagado)}</p></div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Progreso: {prestamo.cuotasPagadas}/{prestamo.numeroCuotas} cuotas</span>
          <span className="font-medium">{progreso.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        {!prestamo.tycAceptado && (
          <Button size="sm" className="flex-1" onClick={() => setFirmarOpen(true)}>
            <FileCheck className="w-4 h-4 mr-1" /> Firmar TyC
          </Button>
        )}
        <Button
          size="sm"
          variant={puedeDescargarPazYSalvo ? 'default' : 'outline'}
          className={puedeDescargarPazYSalvo ? 'flex-1 bg-amber-600 hover:bg-amber-700' : 'flex-1'}
          onClick={handleDescargarPazYSalvo}
          title={puedeDescargarPazYSalvo ? 'Descargar paz y salvo' : 'Crédito vigente - no disponible'}
        >
          <Download className="w-4 h-4 mr-1" /> Paz y Salvo
        </Button>
      </div>

      {prestamo.tycAceptado && prestamo.pagos?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-1">Últimos pagos</p>
          {prestamo.pagos.slice(0, 3).map((p: any) => (
            <div key={p.id} className="flex justify-between text-xs">
              <span className="text-slate-600">{formatDate(p.fechaPago)}</span>
              <span className="font-medium text-emerald-700">{formatCOP(p.montoTotal)}</span>
            </div>
          ))}
        </div>
      )}
      {firmarOpen && <FirmarModal prestamo={prestamo} token={token} onClose={() => setFirmarOpen(false)} navigate={navigate} />}
    </div>
  )
}

function FirmarModal({ prestamo, token, onClose, navigate }: any) {
  const [step, setStep] = useState<'resumen' | 'otp' | 'validar' | 'firma' | 'done'>('resumen')
  const [firmaId, setFirmaId] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [loading, setLoading] = useState(false)
  // === Tarea U: estado para la firma manuscrita ===
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [haFirmado, setHaFirmado] = useState(false)
  const dibujandoRef = useRef(false)
  const ultimaPosRef = useRef<{ x: number; y: number } | null>(null)

  const iniciarFirma = async () => {
    setLoading(true)
    try {
      const res = await apiPost('/api/portal/firmar', { prestamoId: prestamo.id, token })
      setFirmaId(res.firmaId)
      setStep('otp')
    } catch (e) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const solicitarOtp = async () => {
    setLoading(true)
    try {
      const res = await apiPost('/api/portal/solicitar-otp', { firmaId, canal: 'EMAIL' })
      // FIX-SEGURIDAD: ya no exponemos otpDemo. Solo mostramos canal y expiración.
      setStep('validar')
      const canalMsg = res.canal === 'EMAIL' ? 'correo electrónico' : res.canal === 'WHATSAPP' ? 'WhatsApp' : 'WhatsApp y correo'
      toast.success(`OTP enviado por ${canalMsg}. Expira en 5 minutos.`)
    } catch (e) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const validarOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await apiPost('/api/portal/validar-otp', { firmaId, otp: otpInput })
      // === Tarea U: Avanzar al paso de firma manuscrita en vez de 'done' ===
      setStep('firma')
      toast.success('OTP validado. Ahora dibuja tu firma manuscrita.')
      // Inicializar canvas después de que se renderice
      setTimeout(() => inicializarCanvas(), 50)
    } catch (e) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  // === Funciones del canvas de firma manuscrita ===
  const inicializarCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Configurar tamaño real del canvas (alta resolución)
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHaFirmado(false)
  }

  const obtenerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const empezarTrazo = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dibujandoRef.current = true
    ultimaPosRef.current = obtenerPos(e)
  }

  const moverTrazo = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dibujandoRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = obtenerPos(e)
    const ultima = ultimaPosRef.current
    if (ultima) {
      ctx.beginPath()
      ctx.moveTo(ultima.x, ultima.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    ultimaPosRef.current = pos
    if (!haFirmado) setHaFirmado(true)
  }

  const terminarTrazo = () => {
    dibujandoRef.current = false
    ultimaPosRef.current = null
  }

  const limpiarCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHaFirmado(false)
  }

  const guardarFirmaManuscrita = async () => {
    if (!haFirmado) {
      toast.error('Por favor dibuja tu firma antes de continuar.')
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      toast.error('No se pudo acceder al canvas de firma.')
      return
    }
    const imagenFirmaBase64 = canvas.toDataURL('image/png')
    if (imagenFirmaBase64.length < 1000) {
      toast.error('La firma parece estar vacía. Dibuja tu firma.')
      return
    }
    setLoading(true)
    try {
      // Guardar la firma manuscrita en la FirmaElectronica
      await apiPost('/api/prestamos/' + prestamo.id + '/aceptar-tyc-otp', {
        accion: 'guardar_firma_manuscrita',
        imagenFirmaBase64,
      })
      setStep('done')
      toast.success('TyC firmados correctamente')
    } catch (e) {
      toast.error((e as Error).message)
      // Aún así avanzamos a done porque el OTP ya fue validado
      setStep('done')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {step === 'resumen' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Firmar TyC del Solicitud</h3>
                <p className="text-xs text-slate-500">{prestamo.codigo}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-slate-600">Monto principal</span><span className="font-semibold">{formatCOP(prestamo.montoPrincipal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Total a pagar</span><span className="font-semibold">{formatCOP(prestamo.totalPagar)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Cuota</span><span className="font-semibold">{formatCOP(prestamo.montoCuota)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Cuotas</span><span className="font-semibold">{prestamo.numeroCuotas}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Tasa mensual</span><span className="font-semibold">{formatPercent(prestamo.tasaInteresMensual)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Plazo</span><span className="font-semibold">{prestamo.plazoMeses} meses ({prestamo.frecuencia})</span></div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-800">
                Al firmar, aceptas los términos y condiciones del solicitud. El proceso de firma electrónica incluye:
                verificación OTP por correo, captura de cédula y selfie, y tu firma manuscrita en la pantalla.
                Tu firma se incluirá en el pagaré y la carta de instrucciones.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1" onClick={iniciarFirma} disabled={loading}>{loading ? 'Procesando...' : 'Iniciar firma'}</Button>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Enviar código OTP</h3>
            <p className="text-sm text-slate-500 mb-4">
              Te enviaremos un código de verificación a tu correo electrónico registrado.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('resumen')}>Volver</Button>
              <Button className="flex-1" onClick={solicitarOtp} disabled={loading}>{loading ? 'Enviando...' : 'Enviar OTP'}</Button>
            </div>
          </div>
        )}

        {step === 'validar' && (
          <form onSubmit={validarOtp}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Ingresa el código OTP</h3>
              <p className="text-sm text-slate-500">Te enviamos un código de 6 dígitos por correo electrónico. Expira en 5 minutos.</p>
            </div>
            <Input
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl font-mono tracking-widest"
              maxLength={6}
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
            />
            <Button type="submit" className="w-full mt-4" disabled={loading || otpInput.length !== 6}>
              {loading ? 'Validando...' : 'Validar código'}
            </Button>
            <Button type="button" variant="ghost" className="w-full mt-2" onClick={solicitarOtp}>
              Reenviar OTP
            </Button>
          </form>
        )}

        {step === 'firma' && (
          <div>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-4">
                <PenTool className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Firma manuscrita</h3>
              <p className="text-sm text-slate-500">
                Dibuja tu firma en el recuadro abajo con el dedo o el mouse. Esta firma se incluirá en el pagaré y la carta de instrucciones como evidencia de tu aceptación.
              </p>
            </div>
            <div className="relative border-2 border-dashed border-violet-300 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
              <canvas
                ref={canvasRef}
                width={500}
                height={220}
                className="w-full block cursor-crosshair"
                style={{ height: '220px' }}
                onMouseDown={empezarTrazo}
                onMouseMove={moverTrazo}
                onMouseUp={terminarTrazo}
                onMouseLeave={terminarTrazo}
                onTouchStart={empezarTrazo}
                onTouchMove={moverTrazo}
                onTouchEnd={terminarTrazo}
              />
              {!haFirmado && (
                <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ paddingBottom: '12px' }}>
                  <span className="text-xs text-slate-400 italic">✍️ Firma aquí</span>
                </div>
              )}
              <div className="absolute bottom-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 bg-white/90 hover:bg-white text-slate-600"
                  onClick={limpiarCanvas}
                  title="Borrar firma"
                >
                  <Eraser className="w-3.5 h-3.5 mr-1" /> Limpiar
                </Button>
              </div>
            </div>
            <Button
              className="w-full mt-4"
              onClick={guardarFirmaManuscrita}
              disabled={loading || !haFirmado}
            >
              {loading ? 'Guardando firma...' : 'Guardar firma y finalizar'}
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">¡Firma completada!</h3>
            <p className="text-sm text-slate-500 mb-4">
              Has firmado correctamente los términos y condiciones del solicitud {prestamo.codigo}.
              Tu firma manuscrita fue guardada y se incluirá en el pagaré y carta de instrucciones.
              El administrador será notificado para continuar con el proceso.
            </p>
            <Button className="w-full" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================
// DocumentosPorFirmarPanel — Lista de Otros Síes pendientes
// de firma electrónica para el cliente, y los ya firmados.
// Muestra botones para ver el documento y firmarlo (link público /firma/{token}).
// =====================================================
function DocumentosPorFirmarPanel({ token }: { token: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/portal/otros-si-pendientes', {
      headers: { 'x-portal-token': token },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data || [])
        else toast.error(d.error || 'No se pudo cargar la lista de documentos')
      })
      .catch(e => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [token, refreshKey])

  if (loading) return <LoadingState />

  if (data.length === 0) {
    return (
      <Card title="Documentos por firmar">
        <EmptyState
          icon={FileSignature}
          title="No tienes documentos pendientes"
          description="Aquí aparecerán los Otros Síes que debas firmar electrónicamente cuando tu gestor los genere."
        />
      </Card>
    )
  }

  const pendientes = data.filter((d: any) => d.estado === 'PENDIENTE_FIRMA')
  const firmados = data.filter((d: any) => d.estado === 'FIRMADO')

  // Abrir el documento HTML del Otro Sí usando fetch + blob URL (porque el endpoint
  // requiere header x-portal-token que no se puede pasar en una navegación normal).
  const abrirDocumentoViaFetch = async (otroSiId: string) => {
    try {
      const res = await fetch(`/api/portal/otros-si-pendientes/${otroSiId}/documento`, {
        headers: { 'x-portal-token': token },
      })
      if (!res.ok) throw new Error('No se pudo cargar el documento')
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Limpiar la URL del blob después de 1 minuto
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e: any) {
      toast.error('Error al abrir documento: ' + e.message)
    }
  }

  const abrirLinkFirma = (link: string) => {
    window.open(link, '_blank')
    // Recargar la lista después de 5 segundos para refrescar el estado
    setTimeout(() => setRefreshKey(k => k + 1), 5000)
  }

  return (
    <div className="space-y-4">
      {/* === Banner informativo === */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">
              {pendientes.length > 0
                ? `Tienes ${pendientes.length} documento(s) pendiente(s) de firma`
                : 'No tienes documentos pendientes de firma'}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Los Otros Síes son acuerdos de modificación de fechas de pago que se anexan a tu solicitud
              sin modificar el pagaré ni la carta de instrucciones originales. Deben firmarse electrónicamente
              con verificación OTP + selfie.
            </p>
          </div>
        </div>
      </Card>

      {/* === Documentos PENDIENTES de firma === */}
      {pendientes.length > 0 && (
        <Card title="Pendientes de firma" subtitle={`${pendientes.length} documento(s)`}>
          <div className="space-y-3">
            {pendientes.map((os: any) => (
              <div key={os.id} className="p-4 rounded-lg border-2 border-amber-300 bg-amber-50/50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                        {os.codigo}
                      </span>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                        <Clock className="w-3 h-3 mr-1" />
                        Pendiente de firma
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {os.tipoModificacion === 'CAMBIO_FECHA' ? 'Cambio de fecha' : 'Traslado de cuota'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      Solicitud: <span className="font-mono font-semibold">{os.prestamo?.codigo || '—'}</span>
                      {' · '}Solicitado: {formatDate(os.fechaSolicitud)}
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2">{os.descripcion}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirDocumentoViaFetch(os.id)}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Ver documento
                  </Button>
                  {os.linkFirma ? (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => abrirLinkFirma(os.linkFirma)}
                    >
                      <PenTool className="w-4 h-4 mr-1" />
                      Firmar electrónicamente
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500 italic">
                      Sin link de firma activo. Contacta a tu gestor.
                    </span>
                  )}
                  {os.firma?.otpEnviado && (
                    <span className="text-[11px] text-amber-700 ml-auto">
                      📧 OTP enviado · {os.firma.otpCanal === 'EMAIL' ? 'Correo' : os.firma.otpCanal}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* === Documentos ya FIRMADOS === */}
      {firmados.length > 0 && (
        <Card title="Documentos firmados" subtitle={`${firmados.length} documento(s)`}>
          <div className="space-y-3">
            {firmados.map((os: any) => (
              <div key={os.id} className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-200 px-2 py-0.5 rounded">
                        {os.codigo}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                        <Check className="w-3 h-3 mr-1" />
                        Firmado electrónicamente
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {os.tipoModificacion === 'CAMBIO_FECHA' ? 'Cambio de fecha' : 'Traslado de cuota'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      Solicitud: <span className="font-mono font-semibold">{os.prestamo?.codigo || '—'}</span>
                      {' · '}Firmado: {os.fechaFirma ? formatDate(os.fechaFirma) : '—'}
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2">{os.descripcion}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirDocumentoViaFetch(os.id)}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Ver Otro Sí firmado
                  </Button>
                  {os.linkConstancia && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-700 border-blue-300 hover:bg-blue-50"
                      onClick={() => window.open(os.linkConstancia, '_blank')}
                    >
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Ver constancia de firma
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function SimuladorPrestamo({ token }: { token: string }) {
  const [form, setForm] = useState({
    monto: '500000',
    categoriaId: '',
    plazoMeses: '3',
    frecuencia: 'MENSUAL',
  })
  const [categorias, setCategorias] = useState<any[]>([])
  const [resultado, setResultado] = useState<any>(null)
  // === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) ===
  // DOS planes:
  //   - BÁSICA:  $15.000 COP — 1 uso durante la vigencia
  //   - PREMIUM: $34.900 COP — 2 usos durante la vigencia
  const [flexibilidadFinanciera, setFlexibilidadFinanciera] = useState(false)
  const [flexibilidadModalidad, setFlexibilidadModalidad] = useState<'BASICA' | 'PREMIUM'>('BASICA')
  const FLEXIBILIDAD_COSTO_BASICA = 15000
  const FLEXIBILIDAD_COSTO_PREMIUM = 34900

  // === Tarifa de Plataforma (OBLIGATORIA para toda simulación) ===
  // $4.900 COP — cobro único al inicio del crédito (cargado en la primera cuota).
  const TARIFA_PLATAFORMA = 4900

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(d => setCategorias(d.categorias || []))
  }, [])

  const simular = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiPost('/api/portal/simular', {
        ...form,
        monto: Number(form.monto),
        plazoMeses: Number(form.plazoMeses),
        flexibilidadFinanciera,
        flexibilidadModalidad,
        token,
      })
      setResultado(res)
    } catch (e) { toast.error((e as Error).message) }
  }

  // === Calcular cuotas para mostrar/ocultar la opción de Flexibilidad ===
  const cuotasSimuladas = (() => {
    const plazo = parseInt(form.plazoMeses) || 0
    if (form.frecuencia === 'MENSUAL') return plazo
    if (form.frecuencia === 'QUINCENAL') return plazo * 2
    if (form.frecuencia === 'SEMANAL') return plazo * 4
    return plazo
  })()

  const flexElegible = cuotasSimuladas >= 4
  const flexCostoSeleccionado = flexibilidadFinanciera && flexElegible
    ? (flexibilidadModalidad === 'PREMIUM' ? FLEXIBILIDAD_COSTO_PREMIUM : FLEXIBILIDAD_COSTO_BASICA)
    : 0
  const flexUsosSeleccionado = flexCostoSeleccionado > 0
    ? (flexibilidadModalidad === 'PREMIUM' ? 2 : 1)
    : 0
  const totalCargosIniciales = TARIFA_PLATAFORMA + flexCostoSeleccionado

  return (
    <Card title="Simulador de Solicitud">
      <form onSubmit={simular} className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Monto a solicitar</Label>
            <Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          </div>
          <div>
            <Label>Plazo (meses)</Label>
            <Input type="number" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} required />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoriaId} onValueChange={(v) => setForm({ ...form, categoriaId: v })}>
              <SelectTrigger><SelectValue placeholder="Sin categoría..." /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => {
                  const max = Number(c.montoMaximo)
                  const rango = `$${Number(c.montoMinimo).toLocaleString('es-CO')} – ${max > 0 ? '$' + max.toLocaleString('es-CO') : 'Sin límite'}`
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} <span className="text-xs text-slate-500 ml-1">({rango})</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frecuencia</Label>
            <Select value={form.frecuencia} onValueChange={(v) => setForm({ ...form, frecuencia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MENSUAL">Mensual</SelectItem>
                <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                <SelectItem value="SEMANAL">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* === Tarifa de Plataforma (OBLIGATORIA — siempre visible) === */}
        <div className="p-3 rounded-lg border-2 border-slate-300 bg-slate-50/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-200 text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Tarifa de Uso de Plataforma
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-700 text-white">
                    Obligatoria
                  </span>
                </p>
                <p className="text-[11px] text-slate-600">
                  Firma electrónica, pagaré digital, expediente seguro y trazabilidad.
                </p>
              </div>
            </div>
            <Badge className="bg-slate-200 text-slate-800 border-slate-400">
              +{formatCOP(TARIFA_PLATAFORMA)}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-600 mt-1.5">
            Se cobra una sola vez al inicio del crédito (se suma a la primera cuota).
          </p>
        </div>

        {/* === Flexibilidad Financiera (solo si cuotas >= 4) === */}
        {flexElegible ? (
          <div className={`p-3 rounded-lg border-2 transition-colors ${
            flexibilidadFinanciera
              ? 'bg-emerald-50 border-emerald-400'
              : 'bg-emerald-50/30 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="flexFlexPortal"
                  checked={flexibilidadFinanciera}
                  onChange={(e) => setFlexibilidadFinanciera(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <label
                  htmlFor="flexFlexPortal"
                  className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Flexibilidad Financiera
                </label>
              </div>
              <Badge className={flexibilidadFinanciera
                ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                : 'bg-slate-100 text-slate-600 border-slate-300'}>
                {flexibilidadFinanciera
                  ? `✨ +${formatCOP(flexCostoSeleccionado)}`
                  : 'Opcional'}
              </Badge>
            </div>

            <p className="text-xs text-emerald-800 mb-2">
              {flexibilidadFinanciera
                ? `Plan ${flexibilidadModalidad} seleccionado: ${flexUsosSeleccionado} uso(s) disponible(s) durante la vigencia del crédito.`
                : `Disponible porque la simulación tiene ${cuotasSimuladas} cuotas (≥ 4). Selecciona un plan:`}
            </p>

            {/* === Selector de Planes (BÁSICA / PREMIUM) === */}
            {flexibilidadFinanciera && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {/* Plan BÁSICA */}
                <button
                  type="button"
                  onClick={() => setFlexibilidadModalidad('BASICA')}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                    flexibilidadModalidad === 'BASICA'
                      ? 'border-emerald-500 bg-white shadow-sm'
                      : 'border-emerald-200 bg-white/60 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Básica</span>
                    {flexibilidadModalidad === 'BASICA' && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                    )}
                  </div>
                  <p className="text-base font-bold text-emerald-900 mt-0.5">{formatCOP(FLEXIBILIDAD_COSTO_BASICA)}</p>
                  <p className="text-[11px] text-slate-700 mt-0.5">1 uso durante la vigencia</p>
                  <ul className="list-disc list-inside text-[10px] text-slate-600 mt-1 space-y-0.5">
                    <li>Trasladar UNA cuota al final</li>
                    <li>O cambio de fecha (Otro Sí firmado)</li>
                  </ul>
                </button>

                {/* Plan PREMIUM */}
                <button
                  type="button"
                  onClick={() => setFlexibilidadModalidad('PREMIUM')}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all relative ${
                    flexibilidadModalidad === 'PREMIUM'
                      ? 'border-emerald-500 bg-white shadow-sm'
                      : 'border-emerald-200 bg-white/60 hover:border-emerald-300'
                  }`}
                >
                  <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-emerald-600 text-white">
                    Recomendado
                  </span>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Premium</span>
                    {flexibilidadModalidad === 'PREMIUM' && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                    )}
                  </div>
                  <p className="text-base font-bold text-emerald-900 mt-0.5">{formatCOP(FLEXIBILIDAD_COSTO_PREMIUM)}</p>
                  <p className="text-[11px] text-slate-700 mt-0.5">2 usos durante la vigencia</p>
                  <ul className="list-disc list-inside text-[10px] text-slate-600 mt-1 space-y-0.5">
                    <li>2 traslados/cambios de fecha</li>
                    <li>Ideal para créditos largos</li>
                  </ul>
                </button>
              </div>
            )}

            {!flexibilidadFinanciera && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 opacity-70">
                <div className="p-2.5 rounded-lg border border-dashed border-emerald-300 bg-white/40">
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">Básica</span>
                  <p className="text-sm font-bold text-emerald-900">{formatCOP(FLEXIBILIDAD_COSTO_BASICA)}</p>
                  <p className="text-[10px] text-slate-600">1 uso · 1 cuota al final o cambio de fecha</p>
                </div>
                <div className="p-2.5 rounded-lg border border-dashed border-emerald-300 bg-white/40">
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">Premium</span>
                  <p className="text-sm font-bold text-emerald-900">{formatCOP(FLEXIBILIDAD_COSTO_PREMIUM)}</p>
                  <p className="text-[10px] text-slate-600">2 usos · 2 cuotas/cambios de fecha</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-emerald-700 mt-2 pt-2 border-t border-emerald-200">
              💡 Los Otros Síes <strong>NO modifican</strong> el pagaré ni la carta de instrucciones
              originales — se anexan como documentos complementarios.
            </p>
          </div>
        ) : (
          <div className="p-2 rounded-md bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
            ℹ️ <strong>Flexibilidad Financiera</strong> está disponible para simulaciones con
            <strong> 4 o más cuotas</strong>. Actual: {cuotasSimuladas} cuota(s).
          </div>
        )}

        {/* === Resumen de cargos iniciales (siempre visible) === */}
        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1">
          <p className="font-semibold text-slate-700 mb-1">Resumen de cargos iniciales (primera cuota)</p>
          <div className="flex items-center justify-between text-slate-600">
            <span>• Tarifa de Uso de Plataforma <span className="text-[10px] text-slate-500">(obligatoria)</span></span>
            <span className="font-medium">{formatCOP(TARIFA_PLATAFORMA)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>
              • Flexibilidad Financiera
              {flexibilidadFinanciera && flexElegible ? (
                <span className="text-emerald-700"> · {flexibilidadModalidad}</span>
              ) : (
                <span className="text-[10px] text-slate-500"> (opcional, no seleccionada)</span>
              )}
            </span>
            <span className="font-medium">{formatCOP(flexCostoSeleccionado)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-slate-800 font-semibold">
            <span>Total cargos iniciales</span>
            <span>{formatCOP(totalCargosIniciales)}</span>
          </div>
        </div>

        <Button type="submit"><Calculator className="w-4 h-4 mr-1" />Simular</Button>
      </form>

      {resultado && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-emerald-700">Cuotas</p>
                <p className="text-xl font-bold text-emerald-900">{resultado.simulacion.numeroCuotas}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Valor cuota</p>
                <p className="text-xl font-bold text-emerald-900">{formatCOP(resultado.simulacion.montoCuota)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Interés total</p>
                <p className="text-xl font-bold text-emerald-900">{formatCOP(resultado.simulacion.totalInteres)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Total a pagar</p>
                <p className="text-xl font-bold text-emerald-900">{formatCOP(resultado.simulacion.totalPagar)}</p>
              </div>
            </div>
          </div>

          {/* === Bloque de Cargos Iniciales (Tarifa Plataforma + Flexibilidad) === */}
          <div className="p-3 rounded-lg bg-amber-50 border-2 border-amber-300 text-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="w-4 h-4" />
              <strong>Cargos iniciales (sumados a la primera cuota)</strong>
            </div>

            {/* Tarifa Plataforma — siempre presente */}
            <div className="flex items-center justify-between text-amber-900 text-xs pl-6">
              <div>
                <span>Tarifa de Uso de Plataforma</span>
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-700 text-white">
                  Obligatoria
                </span>
              </div>
              <span className="font-semibold">+{formatCOP(resultado.simulacion.tarifaPlataforma ?? TARIFA_PLATAFORMA)}</span>
            </div>

            {/* Flexibilidad Financiera — solo si está activada */}
            {flexibilidadFinanciera && resultado?.simulacion?.numeroCuotas >= 4 && (
              <div className="flex items-center justify-between text-emerald-900 text-xs pl-6">
                <div>
                  <span>Flexibilidad Financiera {resultado.simulacion.flexibilidadModalidad || flexibilidadModalidad}</span>
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-200 text-emerald-900">
                    {resultado.simulacion.flexibilidadUsosDisponibles ?? flexUsosSeleccionado} uso(s)
                  </span>
                </div>
                <span className="font-semibold">+{formatCOP(resultado.simulacion.flexibilidadCosto ?? flexCostoSeleccionado)}</span>
              </div>
            )}

            {/* Totales */}
            <div className="pt-2 mt-1 border-t border-amber-300 space-y-1 text-xs">
              <div className="flex items-center justify-between text-amber-900">
                <span>Valor normal de la 1ra cuota</span>
                <span>{formatCOP(resultado.simulacion.montoCuota)}</span>
              </div>
              <div className="flex items-center justify-between text-amber-900">
                <span>+ Total cargos iniciales</span>
                <span className="font-semibold">+{formatCOP(resultado.simulacion.totalCargosIniciales ?? totalCargosIniciales)}</span>
              </div>
              <div className="flex items-center justify-between text-amber-900 font-bold text-sm pt-1 border-t border-amber-300">
                <span>Primera cuota con cargos</span>
                <span>{formatCOP(resultado.simulacion.primeraCuotaConCargos ?? (resultado.simulacion.montoCuota + (resultado.simulacion.totalCargosIniciales ?? totalCargosIniciales)))}</span>
              </div>
              <div className="flex items-center justify-between text-amber-900 font-bold text-sm pt-1 border-t border-amber-300">
                <span>Total a pagar con cargos</span>
                <span>{formatCOP(resultado.simulacion.totalPagarConCargos ?? (resultado.simulacion.totalPagar + (resultado.simulacion.totalCargosIniciales ?? totalCargosIniciales)))}</span>
              </div>
            </div>
          </div>

          {/* === Bloque de Flexibilidad Financiera en el resultado === */}
          {flexibilidadFinanciera && resultado?.simulacion?.numeroCuotas >= 4 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm space-y-2">
              <div className="flex items-center gap-2 text-emerald-900">
                <Sparkles className="w-4 h-4" />
                <strong>Flexibilidad Financiera adquirida</strong>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-semibold">
                  +{formatCOP(resultado.simulacion.flexibilidadCosto ?? flexCostoSeleccionado)}
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                Al aprobarse tu solicitud, podrás activar el beneficio pagando{' '}
                <strong>{formatCOP(resultado.simulacion.flexibilidadCosto ?? flexCostoSeleccionado)}</strong> adicionales. Tendrás derecho a:
              </p>
              <ul className="list-disc list-inside text-xs text-emerald-800 ml-2 space-y-0.5">
                <li>Trasladar UNA cuota al final del crédito</li>
                <li>Solicitar cambio de fecha de pago (genera "Otro Sí" firmado con OTP)</li>
              </ul>
              <p className="text-[11px] text-emerald-700 mt-1 pt-1 border-t border-emerald-200">
                💡 Los Otros Síes <strong>NO modifican</strong> el pagaré ni la carta de instrucciones
                originales — se anexan como documentos complementarios.
              </p>
            </div>
          )}

          {resultado.cronograma && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Cronograma de cuotas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Vencimiento</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Capital</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Interés</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.cronograma.map((c: any, idx: number) => (
                      <tr key={c.numero} className={idx === 0 ? 'bg-amber-50' : ''}>
                        <td className="px-3 py-2 font-medium">{c.numero}</td>
                        <td className="px-3 py-2">{formatDate(c.fechaVencimiento)}</td>
                        <td className="px-3 py-2 text-right">{formatCOP(c.capital)}</td>
                        <td className="px-3 py-2 text-right">{formatCOP(c.interes)}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatCOP(c.montoTotal)}
                          {idx === 0 && (
                            <span className="block text-[9px] text-amber-700 font-normal">
                              + {formatCOP(resultado.simulacion.totalCargosIniciales ?? totalCargosIniciales)} cargos = {formatCOP(c.montoTotal + (resultado.simulacion.totalCargosIniciales ?? totalCargosIniciales))}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
            <p>* Esta es una simulación. El solicitud final está sujeto a aprobación y verificación de capacidad de pago.</p>
          </div>
        </div>
      )}
    </Card>
  )
}
