'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Car, LogOut, CreditCard, Calendar, Wrench, AlertTriangle, CheckCircle, Clock,
  QrCode, Download, Star, Phone, Mail, User, MapPin, FileText, Wallet,
  ChevronRight, Sparkles, Bell, TrendingUp, Settings, Plus, Upload,
} from 'lucide-react'
import { formatCOP, formatDate, EstadoBadge } from '@/components/views/vehiculos/helpers'

type Tab = 'inicio' | 'perfil' | 'pagos' | 'reservas' | 'cuentas' | 'qr' | 'recibos'

export default function PortalConductorVehiculosPage() {
  const [token, setToken] = useState<string | null>(null)
  const [cedula, setCedula] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [data, setData] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [tab, setTab] = useState<Tab>('inicio')

  // Pago
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState<any>({
    monto: '', fechaPago: new Date().toISOString().slice(0, 10),
    metodo: 'CONSIGNACION', banco: '', referencia: '', destinatario: '',
    comprobanteUrl: '',
  })
  const [pagoResult, setPagoResult] = useState<any>(null)

  // Datos
  const [cuentasPago, setCuentasPago] = useState<any[]>([])
  const [codigosQR, setCodigosQR] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [semanas, setSemanas] = useState<any[]>([])
  const [recordatorio, setRecordatorio] = useState<string>('')
  const [reservas, setReservas] = useState<any[]>([])

  // Reserva form
  const [reservaModal, setReservaModal] = useState(false)
  const [reservaForm, setReservaForm] = useState<any>({
    origen: '', destino: '',
    fechaInicio: new Date().toISOString().slice(0, 16),
    fechaFin: '',
    descripcion: '',
    valorTotal: '',
    cantidadPeajes: 0,
    valorTotalPeajes: 0,
    clienteNombre: '', clienteTelefono: '', clienteDocumento: '',
  })

  // Selección de pago
  const [tipoPago, setTipoPago] = useState<'DIA' | 'SEMANA' | 'PERSONALIZADO'>('DIA')
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('')
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number | null>(null)
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([])

  useEffect(() => {
    const t = localStorage.getItem('portalConductorToken')
    if (t) setToken(t)
  }, [])

  useEffect(() => { if (token) cargarEstado() }, [token])

  const login = async () => {
    if (!cedula) { setLoginError('Ingresa tu cédula'); return }
    setLoginLoading(true); setLoginError('')
    try {
      const res = await fetch('/api/vehiculos/portal-conductor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula }),
      })
      const r = await res.json()
      if (r.success) {
        localStorage.setItem('portalConductorToken', r.token)
        setToken(r.token); setData(r.data)
      } else {
        setLoginError(r.error || 'Error al iniciar sesión')
      }
    } catch (e: any) { setLoginError(e.message) }
    setLoginLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('portalConductorToken')
    setToken(null); setData(null); setCedula('')
  }

  const cargarEstado = async () => {
    setLoadingData(true)
    try {
      const headers = { 'x-portal-token': token! }
      const [resEstado, resCuentas, resQR, resRecibos, resSemanas, resReservas] = await Promise.all([
        fetch('/api/vehiculos/portal-conductor/estado', { headers }),
        fetch('/api/vehiculos/portal-conductor/cuentas-pago', { headers }),
        fetch('/api/vehiculos/portal-conductor/codigos-qr', { headers }),
        fetch('/api/vehiculos/portal-conductor/recibos', { headers }),
        fetch('/api/vehiculos/portal-conductor/semanas', { headers }),
        fetch('/api/vehiculos/portal-conductor/reservas', { headers }),
      ])
      const r = await resEstado.json()
      if (r.success) setData(r.data)
      else if (r.error && r.error.includes('expirado')) { logout(); return }
      const rc = await resCuentas.json()
      if (rc.success) setCuentasPago(rc.data?.cuentas || [])
      const rq = await resQR.json()
      if (rq.success) setCodigosQR(rq.data || [])
      const rr = await resRecibos.json()
      if (rr.success) setRecibos(rr.data || [])
      const rs = await resSemanas.json()
      if (rs.success) {
        setSemanas(rs.data?.semanas || [])
        setRecordatorio(rs.data?.recordatorio || '')
      }
      const rres = await resReservas.json()
      if (rres.success) setReservas(rres.data || [])
    } catch (e) {}
    setLoadingData(false)
  }

  const descargarRecibo = async (reciboId: string) => {
    try {
      const res = await fetch(`/api/vehiculos/portal-conductor/recibos/${reciboId}/pdf`, {
        headers: { 'x-portal-token': token! },
      })
      if (!res.ok) { alert('Error al descargar recibo'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'Recibo.pdf'
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e: any) { alert(e.message) }
  }

  // ====== SELECCIÓN DE PAGO ======
  const seleccionarDia = (obligId: string, monto: number) => {
    setTipoPago('DIA')
    setDiaSeleccionado(obligId)
    setSemanaSeleccionada(null)
    setDiasSeleccionados([])
    setPagoForm({ ...pagoForm, monto: monto.toString() })
  }

  const seleccionarSemana = (semanaNum: number, total: number) => {
    setTipoPago('SEMANA')
    setSemanaSeleccionada(semanaNum)
    setDiaSeleccionado('')
    setDiasSeleccionados([])
    setPagoForm({ ...pagoForm, monto: total.toString() })
  }

  // Selección múltiple personalizada dentro de una semana
  const toggleDiaPersonalizado = (obligId: string, monto: number) => {
    setTipoPago('PERSONALIZADO')
    setDiaSeleccionado('')
    setSemanaSeleccionada(null)
    setDiasSeleccionados(prev => {
      const nuevo = prev.includes(obligId)
        ? prev.filter(x => x !== obligId)
        : [...prev, obligId]
      // Calcular monto total de los seleccionados
      const todos = semanas.flatMap(s => s.dias)
      const total = nuevo.reduce((s, id) => {
        const d = todos.find((x: any) => x.id === id)
        return s + (d?.montoPendiente || 0)
      }, 0)
      setPagoForm(f => ({ ...f, monto: total.toString() }))
      return nuevo
    })
  }

  const seleccionarTodosDiasSemana = (semana: any) => {
    const diasNoPagados = semana.dias.filter((d: any) => d.estado !== 'PAGADA').map((d: any) => d.id)
    setTipoPago('PERSONALIZADO')
    setDiaSeleccionado('')
    setSemanaSeleccionada(null)
    // Si todos ya están seleccionados, los quita; si no, los agrega
    const todosSeleccionados = diasNoPagados.every((id: string) => diasSeleccionados.includes(id))
    if (todosSeleccionados) {
      setDiasSeleccionados(prev => prev.filter(id => !diasNoPagados.includes(id)))
      setPagoForm(f => ({ ...f, monto: '0' }))
    } else {
      const nuevo = [...new Set([...diasSeleccionados, ...diasNoPagados])]
      setDiasSeleccionados(nuevo)
      const todos = semanas.flatMap(s => s.dias)
      const total = nuevo.reduce((s, id) => {
        const d = todos.find((x: any) => x.id === id)
        return s + (d?.montoPendiente || 0)
      }, 0)
      setPagoForm(f => ({ ...f, monto: total.toString() }))
    }
  }

  const reportarPago = async () => {
    if (!pagoForm.monto || !pagoForm.fechaPago) { alert('Monto y fecha son obligatorios'); return }
    if (tipoPago === 'DIA' && !diaSeleccionado) { alert('Selecciona el día a pagar'); return }
    if (tipoPago === 'PERSONALIZADO' && diasSeleccionados.length === 0) { alert('Selecciona al menos un día'); return }

    // Cargar automáticamente la cuenta principal si no se ha cargado
    const cuentaPrincipal = cuentasPago.find(c => c.esPrincipal) || cuentasPago[0]
    let diasIncluidos: string[] = []
    let semanaNumero: number | null = null
    if (tipoPago === 'SEMANA') {
      const sem = semanas.find(s => s.semana === semanaSeleccionada)
      if (sem) {
        diasIncluidos = sem.dias.map((d: any) => d.id)
        semanaNumero = semanaSeleccionada
      }
    } else if (tipoPago === 'PERSONALIZADO') {
      diasIncluidos = diasSeleccionados
    }

    try {
      const body = {
        ...pagoForm,
        // Auto-cargar datos de la cuenta principal
        banco: cuentaPrincipal?.banco || pagoForm.banco,
        destinatario: cuentaPrincipal?.titularCuenta || pagoForm.destinatario,
        cuentaPagoId: cuentaPrincipal?.id || null,
        // Sin referencia (no es necesaria)
        referencia: pagoForm.referencia || undefined,
        tipoReporte: tipoPago === 'PERSONALIZADO' ? 'SEMANA' : tipoPago,
        obligacionId: tipoPago === 'DIA' ? diaSeleccionado : null,
        diasIncluidos: (tipoPago === 'SEMANA' || tipoPago === 'PERSONALIZADO') ? diasIncluidos : null,
        semanaNumero,
      }
      const res = await fetch('/api/vehiculos/portal-conductor/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-token': token! },
        body: JSON.stringify(body),
      })
      const r = await res.json()
      if (r.success) {
        setPagoResult(r)
        setPagoModal(false)
        setDiaSeleccionado('')
        setSemanaSeleccionada(null)
        setDiasSeleccionados([])
        setTipoPago('DIA')
        // Resetear pagoForm pero mantener comprobante vacío
        setPagoForm({
          monto: '', fechaPago: new Date().toISOString().slice(0, 10),
          metodo: 'CONSIGNACION', banco: '', referencia: '', destinatario: '',
          comprobanteUrl: '',
        })
        cargarEstado()
      } else { alert(r.error || 'Error') }
    } catch (e: any) { alert(e.message) }
  }

  // Solicitar nueva reserva de viaje
  const solicitarReserva = async () => {
    if (!reservaForm.origen || !reservaForm.destino || !reservaForm.fechaInicio || !reservaForm.valorTotal) {
      alert('Origen, destino, fecha y valor son obligatorios')
      return
    }
    try {
      const res = await fetch('/api/vehiculos/portal-conductor/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-token': token! },
        body: JSON.stringify(reservaForm),
      })
      const r = await res.json()
      if (r.success) {
        alert('Reserva solicitada: ' + r.data.numeroReserva + '. Pendiente de aprobación.')
        setReservaModal(false)
        setReservaForm({
          origen: '', destino: '',
          fechaInicio: new Date().toISOString().slice(0, 16),
          fechaFin: '',
          descripcion: '',
          valorTotal: '',
          cantidadPeajes: 0,
          valorTotalPeajes: 0,
          clienteNombre: '', clienteTelefono: '', clienteDocumento: '',
        })
        cargarEstado()
      } else { alert(r.error || 'Error') }
    } catch (e: any) { alert(e.message) }
  }

  // Subir comprobante de pago con cámara o archivo
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

  const handleComprobanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirImagen(file)
      setPagoForm(prev => ({ ...prev, comprobanteUrl: base64 }))
    } catch (err: any) {
      alert('Error al cargar imagen: ' + err.message)
    }
  }

  // ====== LOGIN SCREEN ======
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        </div>
        <Card className="w-full max-w-md shadow-2xl border-0 relative z-10">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Car className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Portal del Conductor
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema de Gestión de Vehículos
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cedula" className="text-sm font-medium">Cédula</Label>
              <Input
                id="cedula"
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="Ingresa tu número de cédula"
                className="mt-1 h-12 text-lg"
                autoFocus
              />
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <Button onClick={login} disabled={loginLoading} className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              {loginLoading ? 'Verificando...' : 'Ingresar'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Si tienes un contrato activo, podrás ver tu vehículo, obligaciones, pagos y mantenimientos.
            </p>
            <div className="pt-3 border-t text-center">
              <a href="/registro-conductor" className="text-xs text-blue-600 hover:underline">
                ¿No tienes cuenta? Regístrate aquí →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loadingData && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando tu información...</p>
        </div>
      </div>
    )
  }

  if (data && !data.contrato) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md shadow-xl">
          <CardContent className="py-8 text-center">
            <Car className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Hola, {data.conductor?.nombre}</h2>
            <p className="text-sm text-muted-foreground mt-1">{data.mensaje || 'No tienes contrato activo.'}</p>
            <Button onClick={logout} variant="outline" className="mt-4">Salir</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const c = data?.contrato
  const v = data?.vehiculo
  const cond = data?.conductor
  const saldos = data?.saldos || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-24">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800 text-white p-5 shadow-xl">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center overflow-hidden">
                {cond?.fotoUrl ? (
                  <img src={cond.fotoUrl} alt={cond?.nombre} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="text-xs opacity-80">Bienvenido,</div>
                <div className="text-xl font-bold">{cond?.nombre}</div>
                <div className="text-xs opacity-80">CC {cond?.cedula}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:bg-white/20">
              <LogOut className="w-4 h-4" /> Salir
            </Button>
          </div>
          {/* Vehículo destacado */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Car className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="text-xs opacity-80">Tu vehículo asignado</div>
                <div className="font-bold text-lg">{v?.marca} {v?.modelo}</div>
                <div className="text-xs opacity-80">Placa: {v?.placa} · {v?.anio || ''}</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">Km actual</div>
                <div className="font-bold text-lg">{(v?.kilometraje || 0).toLocaleString('es-CO')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Tabs navegación */}
        <div className="grid grid-cols-7 gap-1 p-1 bg-white rounded-2xl shadow-sm border">
          {[
            { key: 'inicio', label: 'Inicio', icon: Sparkles },
            { key: 'perfil', label: 'Perfil', icon: User },
            { key: 'pagos', label: 'Pagos', icon: CreditCard },
            { key: 'reservas', label: 'Reservas', icon: Calendar },
            { key: 'cuentas', label: 'Cuentas', icon: Wallet },
            { key: 'qr', label: 'QR', icon: QrCode },
            { key: 'recibos', label: 'Recibos', icon: Download },
          ].map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as Tab)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  active ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* ====== TAB: INICIO ====== */}
        {tab === 'inicio' && (
          <div className="space-y-4">
            {/* Recordatorio */}
            {recordatorio && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl text-sm text-amber-900 flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-semibold">Recordatorio de pago semanal</div>
                  <div className="text-xs mt-0.5">{recordatorio}</div>
                </div>
              </div>
            )}

            {/* Saldos en cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-orange-700">
                    <Clock className="w-3 h-3" /> Pendiente
                  </div>
                  <div className="text-lg font-bold text-orange-900 mt-1">{formatCOP(saldos.totalPendiente)}</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-red-700">
                    <AlertTriangle className="w-3 h-3" /> Multas
                  </div>
                  <div className="text-lg font-bold text-red-900 mt-1">{formatCOP(saldos.totalMultas)}</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle className="w-3 h-3" /> Pagado
                  </div>
                  <div className="text-lg font-bold text-emerald-900 mt-1">{formatCOP(saldos.totalPagado)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Datos del contrato */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Mi contrato
              </CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Número</div>
                    <div className="font-bold">{c?.numero}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tarifa</div>
                    <div className="font-bold text-blue-700">{formatCOP(c?.tarifa)} / {c?.modalidadPago}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fecha de inicio</div>
                    <div className="font-medium">{formatDate(c?.fechaInicio)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fecha de terminación</div>
                    <div className="font-medium">{c?.tieneFechaFin ? formatDate(c?.fechaFin) : 'Indefinida'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Días de gracia</div>
                    <div className="font-medium">{c?.diasGracia}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Multa diaria</div>
                    <div className="font-medium text-red-700">{formatCOP(c?.multaDiaria)}</div>
                  </div>
                </div>

                {/* Contador de días del contrato */}
                <div className="mt-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="text-xs font-semibold text-blue-900 mb-2">📅 Contador del contrato</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-700">{c?.diasTranscurridos ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">Días transcurridos</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{c?.tieneFechaFin ? (c?.diasRestantes ?? 0) : '∞'}</div>
                      <div className="text-[10px] text-muted-foreground">Días restantes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-700">{c?.tieneFechaFin ? (c?.diasTranscurridos ?? 0) + (c?.diasRestantes ?? 0) : '∞'}</div>
                      <div className="text-[10px] text-muted-foreground">Duración total</div>
                    </div>
                  </div>
                  {/* Barra de progreso */}
                  {c?.tieneFechaFin && (c?.diasTranscurridos ?? 0) + (c?.diasRestantes ?? 0) > 0 && (
                    <div className="mt-2">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((c?.diasTranscurridos ?? 0) / ((c?.diasTranscurridos ?? 0) + (c?.diasRestantes ?? 0))) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 text-center">
                        {Math.round(((c?.diasTranscurridos ?? 0) / ((c?.diasTranscurridos ?? 0) + (c?.diasRestantes ?? 0))) * 100)}% completado
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Próximas revisiones */}
            {(data?.proximasRevisiones || []).length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" /> Próximas revisiones
                </CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data?.proximasRevisiones.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-gray-50">
                      <div>
                        <div className="font-medium text-sm">{r.tipo}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(r.fecha)}</div>
                      </div>
                      <div className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                        r.diasParaVencer < 0 ? 'bg-red-100 text-red-700' :
                        r.diasParaVencer < 15 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {r.diasParaVencer < 0
                          ? `Vencido ${Math.abs(r.diasParaVencer)} días`
                          : `${r.diasParaVencer} días`}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Mantenimientos */}
            {(data?.mantenimientoHistorial || []).length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" /> Mantenimientos
                </CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data?.mantenimientoHistorial.slice(0, 5).map((m: any) => (
                      <div key={m.id} className="p-2 rounded-lg border text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{formatDate(m.fecha)} · {m.tipo}</span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 rounded">{m.kilometraje} km</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{m.trabajoRealizado}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CTA Pagar */}
            <Button
              onClick={() => { setTab('pagos') }}
              className="w-full h-14 text-base bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg"
            >
              <CreditCard className="w-5 h-5 mr-2" /> Ir a pagar
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {/* ====== TAB: PERFIL ====== */}
        {tab === 'perfil' && (
          <div className="space-y-4">
            {/* Card principal con foto */}
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800 p-6 text-white text-center">
                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-white/30 shadow-lg">
                  {cond?.fotoUrl ? (
                    <img src={cond.fotoUrl} alt={cond?.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/20 flex items-center justify-center">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold mt-3">{cond?.nombre}</h2>
                <p className="text-sm opacity-80">CC {cond?.cedula}</p>
              </div>
              <CardContent className="p-4 space-y-3">
                {/* Datos de contacto */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <span className="text-muted-foreground">Teléfono:</span>
                    <strong>{cond?.telefono || '—'}</strong>
                  </div>
                  {cond?.email && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-muted-foreground">Email:</span>
                      <strong className="truncate">{cond.email}</strong>
                    </div>
                  )}
                  {(cond?.direccion || cond?.ciudad) && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="text-muted-foreground">Dirección:</span>
                      <strong>{cond.direccion}{cond.direccion && cond.ciudad ? ', ' : ''}{cond.ciudad}</strong>
                    </div>
                  )}
                </div>

                {/* Licencia */}
                <div className="border-t pt-3">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" /> Licencia de conducción
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-gray-50">
                      <div className="text-xs text-muted-foreground">Número</div>
                      <div className="font-medium">{cond?.licenciaNumero || '—'}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50">
                      <div className="text-xs text-muted-foreground">Categoría</div>
                      <div className="font-medium">{cond?.licenciaCategoria || '—'}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50">
                      <div className="text-xs text-muted-foreground">Vence</div>
                      <div className="font-medium">{cond?.licenciaVence ? formatDate(cond.licenciaVence) : '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Vehículo asignado */}
                {v && (
                  <div className="border-t pt-3">
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-600" /> Vehículo asignado
                    </h3>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                          <Car className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="font-bold">{v.marca} {v.modelo} {v.anio || ''}</div>
                          <div className="text-xs text-muted-foreground">Placa: {v.placa} · {v.color || '—'}</div>
                          <div className="text-xs text-muted-foreground">Km: {(v.kilometraje || 0).toLocaleString('es-CO')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contrato */}
                {c && (
                  <div className="border-t pt-3">
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" /> Contrato vigente
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-xs text-muted-foreground">Número</div>
                        <div className="font-medium">{c.numero}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-xs text-muted-foreground">Duración</div>
                        <div className="font-medium">{c.duracionDias} días</div>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-xs text-muted-foreground">Tarifa</div>
                        <div className="font-medium text-blue-700">{formatCOP(c.tarifa)} / {c.modalidadPago}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50">
                        <div className="text-xs text-muted-foreground">Inicio</div>
                        <div className="font-medium">{formatDate(c.fechaInicio)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ====== TAB: PAGOS ====== */}
        {tab === 'pagos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Mis semanas de pago</h2>
              <Button
                size="sm"
                onClick={() => setPagoModal(true)}
                disabled={tipoPago === 'DIA' && !diaSeleccionado && diasSeleccionados.length === 0}
                className="bg-gradient-to-r from-emerald-500 to-green-600"
              >
                <CreditCard className="w-4 h-4 mr-1" /> Pagar
                {tipoPago === 'DIA' && diaSeleccionado && ' (día)'}
                {tipoPago === 'SEMANA' && semanaSeleccionada && ` (sem ${semanaSeleccionada})`}
                {tipoPago === 'PERSONALIZADO' && diasSeleccionados.length > 0 && ` (${diasSeleccionados.length} días)`}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Toca un día para pagarlo individualmente, o usa <strong>"Pagar semana completa"</strong> o
              <strong> "Seleccionar todos"</strong> para pagar varios días a la vez.
            </p>

            {semanas.map((sem: any) => {
              const isSelected = semanaSeleccionada === sem.semana
              const diasSemanaSel = sem.dias.filter((d: any) => diasSeleccionados.includes(d.id)).length
              return (
                <Card
                  key={sem.semana}
                  className={`border-2 shadow-sm transition-all ${
                    sem.estado === 'PAGADA' ? 'border-green-300 bg-green-50/50' :
                    sem.estado === 'ATRASADA' ? 'border-red-400 bg-red-50' :
                    sem.estado === 'PARCIAL' ? 'border-yellow-300 bg-yellow-50/50' :
                    isSelected ? 'border-blue-500 bg-blue-50' :
                    diasSemanaSel > 0 ? 'border-purple-400 bg-purple-50' :
                    'border-gray-200'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          Semana {sem.semana}
                          {sem.estado === 'PAGADA' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sem.dias?.[0] && new Date(sem.dias[0].fechaVencimiento).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {sem.dias?.[5] && ` - ${new Date(sem.dias[5].fechaVencimiento).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          sem.estado === 'PAGADA' ? 'bg-green-200 text-green-800' :
                          sem.estado === 'ATRASADA' ? 'bg-red-200 text-red-800' :
                          sem.estado === 'PARCIAL' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>{sem.estado}</span>
                        <div className="text-lg font-bold mt-1">{formatCOP(sem.totalPendiente)}</div>
                      </div>
                    </div>

                    {/* Mensaje */}
                    <div className={`text-xs mb-2 p-2 rounded ${
                      sem.estado === 'ATRASADA' ? 'bg-red-100 text-red-800' :
                      sem.estado === 'PARCIAL' ? 'bg-yellow-100 text-yellow-800' :
                      sem.estado === 'PAGADA' ? 'bg-green-100 text-green-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>{sem.mensaje}</div>

                    {/* Días */}
                    <div className="grid grid-cols-6 gap-1.5 mb-2">
                      {sem.dias.map((d: any) => {
                        const isDiaSel = diaSeleccionado === d.id
                        const isPersonalizadoSel = diasSeleccionados.includes(d.id)
                        return (
                          <button
                            key={d.id}
                            onClick={() => d.estado === 'PAGADA' ? null : seleccionarDia(d.id, d.montoPendiente)}
                            disabled={d.estado === 'PAGADA'}
                            className={`p-2 rounded-lg border-2 text-center transition-all ${
                              d.estado === 'PAGADA' ? 'bg-green-100 text-green-700 border-green-300 cursor-not-allowed' :
                              isDiaSel ? 'bg-blue-600 text-white border-blue-700 shadow-md' :
                              isPersonalizadoSel ? 'bg-purple-600 text-white border-purple-700 shadow-md' :
                              d.esHoy ? 'bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300' :
                              'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            <div className="font-bold text-[10px] uppercase">{d.diaSemana.slice(0, 3)}</div>
                            <div className="text-sm">{new Date(d.fechaVencimiento).getDate()}</div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Acciones de la semana */}
                    {sem.estado !== 'PAGADA' && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          className={isSelected ? 'bg-blue-600' : ''}
                          onClick={() => seleccionarSemana(sem.semana, sem.totalPendiente)}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          {isSelected ? '✓ Semana seleccionada' : `Pagar semana completa`}
                        </Button>
                        <Button
                          size="sm"
                          variant={diasSemanaSel === sem.dias.filter((d: any) => d.estado !== 'PAGADA').length && diasSemanaSel > 0 ? 'default' : 'outline'}
                          className={diasSemanaSel > 0 ? 'bg-purple-600' : ''}
                          onClick={() => seleccionarTodosDiasSemana(sem)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {diasSemanaSel === sem.dias.filter((d: any) => d.estado !== 'PAGADA').length && diasSemanaSel > 0
                            ? `✓ ${diasSemanaSel} días seleccionados`
                            : 'Seleccionar todos los días'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* Historial de pagos */}
            {(data?.pagosRealizados || []).length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" /> Pagos realizados
                </CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {data?.pagosRealizados.map((p: any) => (
                      <div key={p.id} className="p-2 rounded border text-sm flex justify-between items-center">
                        <div>
                          <div className="font-medium">{formatCOP(p.monto)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(p.fechaPago)} · {p.metodo}</div>
                        </div>
                        <EstadoBadge estado={p.estado} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ====== TAB: RESERVAS ====== */}
        {tab === 'reservas' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" /> Mis reservas
              </h2>
              <Button size="sm" onClick={() => setReservaModal(true)} className="bg-gradient-to-r from-purple-500 to-indigo-600">
                <Plus className="w-4 h-4 mr-1" /> Solicitar viaje
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Reporta los viajes que contrates para que el administrador los apruebe.
              El sistema distribuye automáticamente el cobro entre conductor, administrador,
              mantenimiento y peajes.
            </p>
            {reservas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                No tienes reservas registradas.
                <div className="text-xs mt-1">Solicita tu primer viaje con el botón superior.</div>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {reservas.map((r: any) => (
                  <Card key={r.id} className="border-0 shadow-md">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{r.numeroReserva}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              r.estado === 'COMPLETADA' ? 'bg-green-100 text-green-800' :
                              r.estado === 'APROBADA' ? 'bg-blue-100 text-blue-800' :
                              r.estado === 'RECHAZADA' ? 'bg-red-100 text-red-800' :
                              r.estado === 'EN_CURSO' ? 'bg-purple-100 text-purple-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>{r.estado.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="text-sm mt-1">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {r.origen} → {r.destino}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(r.fechaInicio)} {r.fechaFin && `- ${formatDate(r.fechaFin)}`}
                          </div>
                          <div className="text-xs mt-1 grid grid-cols-2 gap-1">
                            <span className="text-blue-700">Cond: {formatCOP(r.montoConductor)}</span>
                            <span className="text-purple-700">Admin: {formatCOP(r.montoAdministrador)}</span>
                            <span className="text-orange-700">Mant: {formatCOP(r.montoMantenimiento)}</span>
                            <span className="text-red-700">Peajes: {formatCOP(r.montoPeajes)} ({r.cantidadPeajes})</span>
                          </div>
                          {r.motivoRechazo && (
                            <div className="text-xs text-red-700 mt-1">⚠️ {r.motivoRechazo}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCOP(r.valorTotal)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: CUENTAS ====== */}
        {tab === 'cuentas' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" /> ¿Dónde pago?
            </h2>
            {cuentasPago.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                No hay cuentas configuradas. Contacta al administrador.
              </CardContent></Card>
            ) : (
              cuentasPago.map((cuenta: any) => (
                <Card
                  key={cuenta.id}
                  className={`border-2 shadow-sm ${cuenta.esPrincipal ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold">{cuenta.banco}</div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{cuenta.tipoCuenta}</span>
                        </div>
                      </div>
                      {cuenta.esPrincipal && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Principal
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Titular:</span>
                        <strong>{cuenta.titularCuenta}</strong>
                      </div>
                      {cuenta.numeroIdTitular && (
                        <div className="text-xs text-muted-foreground ml-5">
                          {cuenta.tipoIdTitular} {cuenta.numeroIdTitular}
                        </div>
                      )}
                      <div className="font-mono text-base bg-white p-2 rounded border font-bold">
                        {cuenta.numeroCuenta}
                      </div>
                      {cuenta.telefonoPago && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3 h-3" /> {cuenta.telefonoPago}
                        </div>
                      )}
                      {cuenta.emailPago && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mail className="w-3 h-3" /> {cuenta.emailPago}
                        </div>
                      )}
                      {cuenta.referenciaSugerida && (
                        <div className="text-xs text-blue-700 font-medium">Referencia: {cuenta.referenciaSugerida}</div>
                      )}
                      {cuenta.instrucciones && (
                        <div className="text-xs p-2 bg-yellow-50 rounded">💡 {cuenta.instrucciones}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ====== TAB: QR ====== */}
        {tab === 'qr' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <QrCode className="w-5 h-5 text-purple-600" /> Códigos QR para pago
            </h2>
            <p className="text-xs text-muted-foreground">
              Escanea estos QR con la app de tu banco o Nequi/Daviplata para pagar rápidamente.
            </p>
            {codigosQR.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                No hay códigos QR disponibles.
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {codigosQR.map((qr: any) => (
                  <Card key={qr.id} className="border-0 shadow-md">
                    <CardContent className="p-3 text-center">
                      <div className="font-medium text-sm mb-2">{qr.titulo}</div>
                      <div className="bg-white p-3 rounded-xl border-2 inline-block shadow-inner">
                        <img src={qr.imagenUrl} alt={qr.titulo} className="w-32 h-32 object-contain" />
                      </div>
                      {qr.montoFijo && (
                        <div className="mt-2 text-sm font-bold text-blue-700">{formatCOP(qr.montoFijo)}</div>
                      )}
                      {qr.descripcion && (
                        <div className="mt-1 text-xs text-muted-foreground">{qr.descripcion}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: RECIBOS ====== */}
        {tab === 'recibos' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Download className="w-5 h-5 text-green-600" /> Mis recibos de pago
            </h2>
            <p className="text-xs text-muted-foreground">
              Descarga el recibo PDF de tus pagos aprobados.
            </p>
            {recibos.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <Download className="w-12 h-12 mx-auto mb-2 opacity-50" />
                No tienes recibos disponibles todavía.
                <div className="text-xs mt-1">Aparecerán aquí cuando se apruebe un pago.</div>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {recibos.map((r: any) => (
                  <Card key={r.id} className="border-0 shadow-md">
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold">{r.numeroRecibo}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCOP(r.monto)} · {formatDate(r.fechaAprobacion)} · {r.metodoPago}
                          {r.numeroCuota && ` · Cuota #${r.numeroCuota}`}
                        </div>
                        <div className="text-xs text-blue-700 font-mono mt-0.5">
                          {r.codigoVerificacion.slice(0, 20)}...
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => descargarRecibo(r.id)} className="border-green-600 text-green-700 hover:bg-green-50">
                        <Download className="w-3 h-3 mr-1" /> PDF
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {pagoResult && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <div className="font-medium">{pagoResult.message}</div>
            {pagoResult.warning && <div className="text-yellow-800 mt-1">⚠️ {pagoResult.warning}</div>}
            <button onClick={() => setPagoResult(null)} className="text-xs text-blue-600 mt-1">Cerrar</button>
          </div>
        )}
      </div>

      {/* ====== MODAL PAGO ====== */}
      <Dialog open={pagoModal} onOpenChange={setPagoModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reportar pago</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {/* Resumen */}
            <div className="col-span-2 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 text-sm">
              {tipoPago === 'DIA' && diaSeleccionado ? (
                <div>
                  <strong className="text-blue-700">📅 Pago por día</strong>
                  {(() => {
                    const oblig = semanas.flatMap(s => s.dias).find((d: any) => d.id === diaSeleccionado)
                    if (oblig) return (
                      <div className="text-xs mt-1">
                        {oblig.diaSemana} {new Date(oblig.fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - {formatCOP(oblig.montoPendiente)}
                      </div>
                    )
                    return null
                  })()}
                </div>
              ) : tipoPago === 'SEMANA' && semanaSeleccionada ? (
                <div>
                  <strong className="text-blue-700">🗓️ Pago por semana completa</strong>
                  {(() => {
                    const sem = semanas.find((s: any) => s.semana === semanaSeleccionada)
                    if (sem) return (
                      <div className="text-xs mt-1">
                        Semana {sem.semana} - 6 días (L-S) - {formatCOP(sem.totalPendiente)}
                        {sem.multaAtrasoSemana > 0 && (
                          <span className="text-red-700 font-medium block">⚠️ Incluye $50.000 multa por atraso</span>
                        )}
                      </div>
                    )
                    return null
                  })()}
                </div>
              ) : tipoPago === 'PERSONALIZADO' && diasSeleccionados.length > 0 ? (
                <div>
                  <strong className="text-purple-700">✓ Pago personalizado ({diasSeleccionados.length} días)</strong>
                  {(() => {
                    const todos = semanas.flatMap(s => s.dias)
                    const diasSel = diasSeleccionados.map(id => todos.find((d: any) => d.id === id)).filter(Boolean)
                    return (
                      <div className="text-xs mt-1">
                        Días: {diasSel.map((d: any) => `${d.diaSemana.slice(0, 3)} ${new Date(d.fechaVencimiento).getDate()}`).join(', ')}
                        <div>Total: {formatCOP(parseFloat(pagoForm.monto || '0'))}</div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-yellow-800">⚠️ Primero selecciona un día, una semana completa, o varios días.</div>
              )}
            </div>

            <div>
              <Label>Monto *</Label>
              <Input type="number" value={pagoForm.monto} onChange={e => setPagoForm({ ...pagoForm, monto: e.target.value })} />
            </div>
            <div>
              <Label>Fecha pago *</Label>
              <Input type="date" value={pagoForm.fechaPago} onChange={e => setPagoForm({ ...pagoForm, fechaPago: e.target.value })} />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={pagoForm.metodo} onValueChange={v => setPagoForm({ ...pagoForm, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSIGNACION">Consignación</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cuenta de pago precargada automáticamente */}
            <div className="col-span-2">
              <Label>Cuenta de pago (auto-cargada)</Label>
              {(() => {
                const cuentaPrincipal = cuentasPago.find(c => c.esPrincipal) || cuentasPago[0]
                if (!cuentaPrincipal) {
                  return <div className="p-2 bg-yellow-50 rounded text-xs text-yellow-800">No hay cuenta asignada. Contacta al administrador.</div>
                }
                return (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <strong>{cuentaPrincipal.banco}</strong>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 rounded">{cuentaPrincipal.tipoCuenta}</span>
                      {cuentaPrincipal.esPrincipal && <span className="text-xs text-blue-700">★ Principal</span>}
                    </div>
                    <div className="font-mono text-xs mt-1">{cuentaPrincipal.numeroCuenta}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Titular: <strong>{cuentaPrincipal.titularCuenta}</strong>
                      {cuentaPrincipal.numeroIdTitular && ` (${cuentaPrincipal.tipoIdTitular} ${cuentaPrincipal.numeroIdTitular})`}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Comprobante - captura o sube foto */}
            <div className="col-span-2">
              <Label>Comprobante de pago (foto o captura)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Toma una foto del recibo o sube una captura de pantalla del pago.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleComprobanteUpload}
                  className="hidden"
                  id="file-comprobante"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-comprobante')?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Tomar foto / Subir imagen
                </Button>
                {pagoForm.comprobanteUrl && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              {pagoForm.comprobanteUrl && (
                <img src={pagoForm.comprobanteUrl} alt="Comprobante" className="mt-2 max-h-48 object-contain border rounded" />
              )}
            </div>
            <div className="col-span-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
              ℹ️ Tu pago quedará en estado <strong>PENDIENTE</strong>. Un administrador debe verificarlo antes de aplicarlo al saldo.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoModal(false)}>Cancelar</Button>
            <Button onClick={reportarPago} className="bg-gradient-to-r from-emerald-500 to-green-600">Enviar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL RESERVA ====== */}
      <Dialog open={reservaModal} onOpenChange={setReservaModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Solicitar reserva de viaje</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Origen *</Label>
              <Input value={reservaForm.origen} onChange={e => setReservaForm({ ...reservaForm, origen: e.target.value })} placeholder="Medellín" />
            </div>
            <div>
              <Label>Destino *</Label>
              <Input value={reservaForm.destino} onChange={e => setReservaForm({ ...reservaForm, destino: e.target.value })} placeholder="Bogotá" />
            </div>
            <div>
              <Label>Fecha y hora de inicio *</Label>
              <Input type="datetime-local" value={reservaForm.fechaInicio} onChange={e => setReservaForm({ ...reservaForm, fechaInicio: e.target.value })} />
            </div>
            <div>
              <Label>Fecha y hora fin</Label>
              <Input type="datetime-local" value={reservaForm.fechaFin} onChange={e => setReservaForm({ ...reservaForm, fechaFin: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Descripción del viaje</Label>
              <Input value={reservaForm.descripcion} onChange={e => setReservaForm({ ...reservaForm, descripcion: e.target.value })} placeholder="Detalle del servicio contratado" />
            </div>
            <div>
              <Label>Valor total contratado *</Label>
              <Input type="number" value={reservaForm.valorTotal} onChange={e => setReservaForm({ ...reservaForm, valorTotal: e.target.value })} placeholder="ej: 500000" />
            </div>
            <div>
              <Label>Cantidad de peajes</Label>
              <Input type="number" value={reservaForm.cantidadPeajes} onChange={e => setReservaForm({ ...reservaForm, cantidadPeajes: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Valor total de peajes</Label>
              <Input type="number" value={reservaForm.valorTotalPeajes} onChange={e => setReservaForm({ ...reservaForm, valorTotalPeajes: e.target.value })} placeholder="Suma de los peajes" />
            </div>
            <div className="col-span-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
              <strong>💡 Distribución automática:</strong> Conductor 60%, Administrador 25%, Mantenimiento 15%.
              Los peajes se descuentan del total antes de calcular los porcentajes.
            </div>
            {(() => {
              const vTotal = parseFloat(reservaForm.valorTotal) || 0
              const vPeajes = parseFloat(reservaForm.valorTotalPeajes) || 0
              const base = Math.max(0, vTotal - vPeajes)
              return (
                <div className="col-span-2 grid grid-cols-4 gap-2 p-2 bg-purple-50 rounded text-xs">
                  <div><div className="text-muted-foreground">Conductor (60%)</div><div className="font-bold text-blue-700">{formatCOP(base * 0.6)}</div></div>
                  <div><div className="text-muted-foreground">Admin (25%)</div><div className="font-bold text-purple-700">{formatCOP(base * 0.25)}</div></div>
                  <div><div className="text-muted-foreground">Mant (15%)</div><div className="font-bold text-orange-700">{formatCOP(base * 0.15)}</div></div>
                  <div><div className="text-muted-foreground">Peajes</div><div className="font-bold text-red-700">{formatCOP(vPeajes)}</div></div>
                </div>
              )
            })()}
            <div className="col-span-2 border-t pt-3">
              <h3 className="font-semibold text-sm mb-2">Datos del cliente (opcional)</h3>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Nombre" value={reservaForm.clienteNombre} onChange={e => setReservaForm({ ...reservaForm, clienteNombre: e.target.value })} />
                <Input placeholder="Teléfono" value={reservaForm.clienteTelefono} onChange={e => setReservaForm({ ...reservaForm, clienteTelefono: e.target.value })} />
                <Input placeholder="Documento" value={reservaForm.clienteDocumento} onChange={e => setReservaForm({ ...reservaForm, clienteDocumento: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReservaModal(false)}>Cancelar</Button>
            <Button onClick={solicitarReserva} className="bg-gradient-to-r from-purple-500 to-indigo-600">Solicitar reserva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
