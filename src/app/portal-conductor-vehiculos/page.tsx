'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Car, LogOut, CreditCard, Calendar, Wrench, AlertTriangle, CheckCircle, Clock, QrCode, Download, Star, Phone, Mail, User } from 'lucide-react'
import { formatCOP, formatDate, EstadoBadge } from '@/components/views/vehiculos/helpers'

export default function PortalConductorVehiculosPage() {
  const [token, setToken] = useState<string | null>(null)
  const [cedula, setCedula] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [data, setData] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoForm, setPagoForm] = useState<any>({
    obligacionId: '', monto: '', fechaPago: new Date().toISOString().slice(0, 10),
    metodo: 'CONSIGNACION', banco: '', referencia: '', destinatario: '',
    comprobanteUrl: '', ocrTexto: '',
  })
  const [pagoResult, setPagoResult] = useState<any>(null)
  const [cuentasPago, setCuentasPago] = useState<any[]>([])
  const [codigosQR, setCodigosQR] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [semanas, setSemanas] = useState<any[]>([])
  const [recordatorio, setRecordatorio] = useState<string>('')
  // Extensión 4: tipo de pago (DIA o SEMANA)
  const [tipoPago, setTipoPago] = useState<'DIA' | 'SEMANA'>('DIA')
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('') // obligacionId
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number | null>(null)

  // Cargar token del localStorage
  useEffect(() => {
    const t = localStorage.getItem('portalConductorToken')
    if (t) setToken(t)
  }, [])

  // Cargar datos cuando hay token
  useEffect(() => {
    if (token) cargarEstado()
  }, [token])

  const login = async () => {
    if (!cedula) {
      setLoginError('Ingresa tu cédula')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/vehiculos/portal-conductor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula }),
      })
      const r = await res.json()
      if (r.success) {
        localStorage.setItem('portalConductorToken', r.data.token)
        setToken(r.data.token)
        setData(r.data)
      } else {
        setLoginError(r.error || 'Error al iniciar sesión')
      }
    } catch (e: any) {
      setLoginError(e.message)
    }
    setLoginLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('portalConductorToken')
    setToken(null)
    setData(null)
    setCedula('')
  }

  const cargarEstado = async () => {
    setLoadingData(true)
    try {
      const headers = { 'x-portal-token': token! }
      const [resEstado, resCuentas, resQR, resRecibos, resSemanas] = await Promise.all([
        fetch('/api/vehiculos/portal-conductor/estado', { headers }),
        fetch('/api/vehiculos/portal-conductor/cuentas-pago', { headers }),
        fetch('/api/vehiculos/portal-conductor/codigos-qr', { headers }),
        fetch('/api/vehiculos/portal-conductor/recibos', { headers }),
        fetch('/api/vehiculos/portal-conductor/semanas', { headers }),
      ])
      const r = await resEstado.json()
      if (r.success) {
        setData(r.data)
      } else {
        if (r.error && r.error.includes('expirado')) {
          logout()
          return
        }
      }
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
    } catch (e) {}
    setLoadingData(false)
  }

  const descargarRecibo = async (reciboId: string) => {
    try {
      const res = await fetch(`/api/vehiculos/portal-conductor/recibos/${reciboId}/pdf`, {
        headers: { 'x-portal-token': token! },
      })
      if (!res.ok) {
        alert('Error al descargar recibo')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Recibo.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const reportarPago = async () => {
    if (!pagoForm.monto || !pagoForm.fechaPago) {
      alert('Monto y fecha son obligatorios')
      return
    }
    // Validar que haya un día seleccionado
    if (tipoPago === 'DIA' && !diaSeleccionado) {
      alert('Selecciona el día que vas a pagar')
      return
    }
    if (tipoPago === 'SEMANA' && !semanaSeleccionada) {
      alert('Selecciona la semana a pagar')
      return
    }
    // Recoger los IDs de los días de la semana
    let diasIncluidos: string[] = []
    if (tipoPago === 'SEMANA') {
      const sem = semanas.find(s => s.semana === semanaSeleccionada)
      if (sem) {
        diasIncluidos = sem.dias.map((d: any) => d.id)
      }
    }
    try {
      const body = {
        ...pagoForm,
        tipoReporte: tipoPago,
        obligacionId: tipoPago === 'DIA' ? diaSeleccionado : null,
        diasIncluidos: tipoPago === 'SEMANA' ? diasIncluidos : null,
        semanaNumero: tipoPago === 'SEMANA' ? semanaSeleccionada : null,
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
        setTipoPago('DIA')
        cargarEstado()
      } else {
        alert(r.error || 'Error')
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Seleccionar día individual
  const seleccionarDia = (obligId: string, monto: number) => {
    setTipoPago('DIA')
    setDiaSeleccionado(obligId)
    setSemanaSeleccionada(null)
    setPagoForm({ ...pagoForm, monto: monto.toString() })
  }

  // Seleccionar semana completa
  const seleccionarSemana = (semanaNum: number, total: number) => {
    setTipoPago('SEMANA')
    setSemanaSeleccionada(semanaNum)
    setDiaSeleccionado('')
    setPagoForm({ ...pagoForm, monto: total.toString() })
  }

  // === LOGIN SCREEN ===
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl">Portal del Conductor</CardTitle>
            <p className="text-sm text-muted-foreground">Sistema de Gestión de Vehículos</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="cedula">Cédula</Label>
              <Input
                id="cedula"
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="Ingresa tu número de cédula"
                autoFocus
              />
            </div>
            {loginError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {loginError}
              </div>
            )}
            <Button onClick={login} disabled={loginLoading} className="w-full">
              {loginLoading ? 'Verificando...' : 'Ingresar'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Si tienes un contrato activo, podrás ver tu vehículo, obligaciones, pagos y mantenimientos.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === LOADING ===
  if (loadingData && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando tu información...</p>
        </div>
      </div>
    )
  }

  // === NO HAY CONTRATO ACTIVO ===
  if (data && !data.contrato) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
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

  // === PORTAL PRINCIPAL ===
  const c = data?.contrato
  const v = data?.vehiculo
  const cond = data?.conductor
  const saldos = data?.saldos || {}

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs opacity-80">Hola,</div>
              <div className="text-xl font-bold">{cond?.nombre}</div>
              <div className="text-xs opacity-80">CC {cond?.cedula}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Vehículo asignado */}
        <Card className="border-blue-300">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-600" /> Mi vehículo
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Placa:</span> <strong>{v?.placa}</strong></div>
              <div><span className="text-muted-foreground">Marca/Modelo:</span> {v?.marca} {v?.modelo}</div>
              <div><span className="text-muted-foreground">Año:</span> {v?.anio || '—'}</div>
              <div><span className="text-muted-foreground">Color:</span> {v?.color || '—'}</div>
              <div><span className="text-muted-foreground">Kilometraje:</span> {(v?.kilometraje || 0).toLocaleString('es-CO')} km</div>
              <div><span className="text-muted-foreground">SOAT vence:</span> {formatDate(v?.soatVence)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Datos del contrato */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Mi contrato
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Número:</span> <strong>{c?.numero}</strong></div>
              <div><span className="text-muted-foreground">Desde:</span> {formatDate(c?.fechaInicio)}</div>
              <div><span className="text-muted-foreground">Duración:</span> {c?.duracionDias} días</div>
              <div><span className="text-muted-foreground">Tarifa:</span> {formatCOP(c?.tarifa)} / {c?.modalidadPago}</div>
              <div><span className="text-muted-foreground">Días de gracia:</span> {c?.diasGracia}</div>
              <div><span className="text-muted-foreground">Multa diaria:</span> {formatCOP(c?.multaDiaria)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Saldos */}
        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Pendiente</div>
            <div className="text-base font-bold text-orange-700">{formatCOP(saldos.totalPendiente)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Multas</div>
            <div className="text-base font-bold text-red-700">{formatCOP(saldos.totalMultas)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Pagado</div>
            <div className="text-base font-bold text-green-700">{formatCOP(saldos.totalPagado)}</div>
          </CardContent></Card>
        </div>

        {/* RECORDATORIO PAGO SÁBADO + MULTA $50.000 */}
        {recordatorio && (
          <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="font-semibold">Recordatorio de pago semanal</div>
              <div className="text-xs mt-0.5">{recordatorio}</div>
            </div>
          </div>
        )}

        {/* SEMANAS Y PAGO POR DÍA O SEMANA */}
        {semanas.length > 0 && (
          <Card className="border-blue-300">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" /> Mis semanas de pago
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Puedes pagar <strong>un día específico</strong> o <strong>toda la semana</strong> (L-S).
                Recuerda que los pagos deben reportarse <strong>todos los sábados</strong>. Si no pagas
                antes del sábado, se cobrarán <strong>$50.000 de multa</strong>.
              </p>
              {semanas.map((sem: any) => {
                const isSelected = semanaSeleccionada === sem.semana
                return (
                  <div
                    key={sem.semana}
                    className={`p-3 rounded border-2 transition-colors ${
                      sem.estado === 'PAGADA' ? 'border-green-300 bg-green-50' :
                      sem.estado === 'ATRASADA' ? 'border-red-400 bg-red-50' :
                      sem.estado === 'PARCIAL' ? 'border-yellow-300 bg-yellow-50' :
                      isSelected ? 'border-blue-500 bg-blue-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">Semana {sem.semana}</div>
                        <div className="text-xs text-muted-foreground">
                          {sem.dias?.[0] && `Desde ${new Date(sem.dias[0].fechaVencimiento).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                          {sem.dias?.[5] && ` hasta ${new Date(sem.dias[5].fechaVencimiento).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          sem.estado === 'PAGADA' ? 'bg-green-200 text-green-800' :
                          sem.estado === 'ATRASADA' ? 'bg-red-200 text-red-800' :
                          sem.estado === 'PARCIAL' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>{sem.estado}</span>
                        <div className="text-lg font-bold">{formatCOP(sem.totalPendiente)}</div>
                      </div>
                    </div>

                    {/* Mensaje de alerta de la semana */}
                    <div className={`text-xs mt-1 p-2 rounded ${
                      sem.estado === 'ATRASADA' ? 'bg-red-100 text-red-800' :
                      sem.estado === 'PARCIAL' ? 'bg-yellow-100 text-yellow-800' :
                      sem.estado === 'PAGADA' ? 'bg-green-100 text-green-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>{sem.mensaje}</div>

                    {/* Días de la semana */}
                    <div className="grid grid-cols-6 gap-1 mt-2">
                      {sem.dias.map((d: any) => {
                        const isDiaSel = diaSeleccionado === d.id
                        return (
                          <button
                            key={d.id}
                            onClick={() => d.estado === 'PAGADA' ? null : seleccionarDia(d.id, d.montoPendiente)}
                            disabled={d.estado === 'PAGADA'}
                            className={`text-xs p-2 rounded border transition-all ${
                              d.estado === 'PAGADA' ? 'bg-green-100 text-green-700 border-green-300 cursor-not-allowed' :
                              isDiaSel ? 'bg-blue-600 text-white border-blue-700' :
                              d.esHoy ? 'bg-blue-100 text-blue-800 border-blue-400 ring-1 ring-blue-300' :
                              'bg-white border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            <div className="font-medium">{d.diaSemana.slice(0, 3)}</div>
                            <div>{new Date(d.fechaVencimiento).getDate()}</div>
                            <div className="text-[10px]">{formatCOP(d.montoPendiente).replace('$', '').replace(/\s/g, '')}</div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Botón pagar semana */}
                    {sem.estado !== 'PAGADA' && (
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className="w-full mt-2"
                        onClick={() => seleccionarSemana(sem.semana, sem.totalPendiente)}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        {isSelected ? '✓ Semana seleccionada' : `Pagar semana completa (${formatCOP(sem.totalPendiente)})`}
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Botón reportar pago */}
        <Button onClick={() => setPagoModal(true)} className="w-full" size="lg">
          <CreditCard className="w-5 h-5 mr-2" /> Reportar pago
          {tipoPago === 'DIA' && diaSeleccionado && ' (día seleccionado)'}
          {tipoPago === 'SEMANA' && semanaSeleccionada && ` (semana ${semanaSeleccionada})`}
        </Button>

        {/* CUENTAS DE PAGO */}
        {cuentasPago.length > 0 && (
          <Card className="border-blue-300">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> ¿Dónde pago?
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Realiza tu pago a cualquiera de estas cuentas. Usa la referencia sugerida si la hay.
              </p>
              {cuentasPago.map((c: any) => (
                <div key={c.id} className={`p-3 rounded border ${c.esPrincipal ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{c.banco}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{c.tipoCuenta}</span>
                      {c.esPrincipal && (
                        <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Principal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Titular:</span>
                      <strong>{c.titularCuenta}</strong>
                      {c.numeroIdTitular && <span className="text-xs text-muted-foreground">({c.tipoIdTitular} {c.numeroIdTitular})</span>}
                    </div>
                    <div className="font-mono text-base bg-white p-2 rounded border">
                      {c.numeroCuenta}
                    </div>
                    {c.telefonoPago && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Phone className="w-3 h-3" /> {c.telefonoPago}
                      </div>
                    )}
                    {c.emailPago && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="w-3 h-3" /> {c.emailPago}
                      </div>
                    )}
                    {c.referenciaSugerida && (
                      <div className="text-xs text-blue-700 font-medium">Referencia: {c.referenciaSugerida}</div>
                    )}
                    {c.instrucciones && (
                      <div className="text-xs p-2 bg-yellow-50 rounded mt-1">💡 {c.instrucciones}</div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* CÓDIGOS QR DE PAGO */}
        {codigosQR.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-600" /> Códigos QR para pago
            </CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Escanea estos QR con la app de tu banco o Nequi/Daviplata para pagar rápidamente.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {codigosQR.map((qr: any) => (
                  <div key={qr.id} className="p-3 rounded border text-center">
                    <div className="font-medium text-sm mb-2">{qr.titulo}</div>
                    <div className="bg-white p-2 rounded border inline-block">
                      <img src={qr.imagenUrl} alt={qr.titulo} className="w-32 h-32 object-contain" />
                    </div>
                    {qr.montoFijo && (
                      <div className="mt-2 text-sm font-medium text-blue-700">{formatCOP(qr.montoFijo)}</div>
                    )}
                    {qr.descripcion && (
                      <div className="mt-1 text-xs text-muted-foreground">{qr.descripcion}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RECIBOS DESCARGABLES */}
        {recibos.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-green-600" /> Mis recibos de pago
            </CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Descarga el recibo de tus pagos aprobados.
              </p>
              <div className="space-y-1">
                {recibos.map((r: any) => (
                  <div key={r.id} className="p-2 rounded border text-sm flex justify-between items-center">
                    <div>
                      <div className="font-medium">{r.numeroRecibo}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCOP(r.monto)} · {formatDate(r.fechaAprobacion)} · {r.metodoPago}
                        {r.numeroCuota && ` · Cuota #${r.numeroCuota}`}
                      </div>
                      <div className="text-xs text-blue-700 font-mono mt-0.5">{r.codigoVerificacion.slice(0, 16)}...</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => descargarRecibo(r.id)}>
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pagoResult && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <div className="font-medium">{pagoResult.message}</div>
            {pagoResult.warning && <div className="text-yellow-800 mt-1">⚠️ {pagoResult.warning}</div>}
            <button onClick={() => setPagoResult(null)} className="text-xs text-blue-600 mt-1">Cerrar</button>
          </div>
        )}

        {/* Próximos vencimientos */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Próximos vencimientos
          </CardTitle></CardHeader>
          <CardContent>
            {(data?.proximosVencimientos || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes obligaciones pendientes. ¡Estás al día!</p>
            ) : (
              <div className="space-y-1">
                {data?.proximosVencimientos.map((o: any) => (
                  <div key={o.id} className="p-2 rounded border text-sm flex justify-between items-center">
                    <div>
                      <div className="font-medium">Cuota #{o.numeroCuota}</div>
                      <div className="text-xs text-muted-foreground">
                        Vence: {formatDate(o.fechaVencimiento)}
                        {o.diasParaVencer < 0
                          ? <span className="text-red-600 ml-1">({o.diasParaVencer} días de retraso)</span>
                          : <span className="text-blue-600 ml-1">(en {o.diasParaVencer} días)</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCOP(o.montoPendiente)}</div>
                      <EstadoBadge estado={o.estado} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas revisiones */}
        {(data?.proximasRevisiones || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Próximas revisiones
            </CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data?.proximasRevisiones.map((r: any, i: number) => (
                  <div key={i} className="p-2 rounded border text-sm flex justify-between items-center">
                    <div>
                      <div className="font-medium">{r.tipo}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(r.fecha)}</div>
                    </div>
                    <div className="text-right">
                      <div className={r.diasParaVencer < 0 ? 'text-red-600 font-bold' : r.diasParaVencer < 15 ? 'text-yellow-700' : 'text-green-700'}>
                        {r.diasParaVencer < 0
                          ? `${Math.abs(r.diasParaVencer)} días vencida`
                          : `${r.diasParaVencer} días`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historial de pagos */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Pagos realizados
          </CardTitle></CardHeader>
          <CardContent>
            {(data?.pagosRealizados || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No has reportado pagos todavía.</p>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* Historial de mantenimiento */}
        {(data?.mantenimientoHistorial || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Mantenimientos del vehículo
            </CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data?.mantenimientoHistorial.map((m: any) => (
                  <div key={m.id} className="p-2 rounded border text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{formatDate(m.fecha)} · {m.tipo}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 rounded">{m.kilometraje} km</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{m.trabajoRealizado}</div>
                    {(m.proximaRevisionFecha || m.proximaRevisionKm) && (
                      <div className="text-xs text-orange-700 mt-1">
                        Próxima revisión: {m.proximaRevisionFecha ? formatDate(m.proximaRevisionFecha) : ''} {m.proximaRevisionKm ? `· ${m.proximaRevisionKm} km` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal reportar pago */}
      <Dialog open={pagoModal} onOpenChange={setPagoModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reportar pago</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {/* Resumen de lo seleccionado */}
            <div className="col-span-2 p-3 bg-blue-50 rounded border border-blue-200 text-sm">
              {tipoPago === 'DIA' && diaSeleccionado ? (
                <div>
                  <strong>📅 Pago por día:</strong> Has seleccionado un día específico.
                  {(() => {
                    const oblig = semanas.flatMap(s => s.dias).find((d: any) => d.id === diaSeleccionado)
                    if (oblig) return <div className="text-xs mt-1">Día: {oblig.diaSemana} {new Date(oblig.fechaVencimiento).toLocaleDateString('es-CO')} - Monto: {formatCOP(oblig.montoPendiente)}</div>
                    return null
                  })()}
                </div>
              ) : tipoPago === 'SEMANA' && semanaSeleccionada ? (
                <div>
                  <strong>🗓️ Pago por semana:</strong> Has seleccionado la semana completa (L-S).
                  {(() => {
                    const sem = semanas.find((s: any) => s.semana === semanaSeleccionada)
                    if (sem) return <div className="text-xs mt-1">Semana {sem.semana} - Total: {formatCOP(sem.totalPendiente)} {sem.multaAtrasoSemana > 0 && <span className="text-red-700 font-medium"> (incluye $50.000 de multa por atraso)</span>}</div>
                    return null
                  })()}
                </div>
              ) : (
                <div className="text-yellow-800">⚠️ Primero selecciona un día o una semana arriba.</div>
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
            <div><Label>Banco</Label><Input value={pagoForm.banco} onChange={e => setPagoForm({ ...pagoForm, banco: e.target.value })} placeholder="Bancolombia, Davivienda..." /></div>
            <div><Label>Referencia</Label><Input value={pagoForm.referencia} onChange={e => setPagoForm({ ...pagoForm, referencia: e.target.value })} /></div>
            <div><Label>Destinatario</Label><Input value={pagoForm.destinatario} onChange={e => setPagoForm({ ...pagoForm, destinatario: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>URL comprobante</Label>
              <Input value={pagoForm.comprobanteUrl} onChange={e => setPagoForm({ ...pagoForm, comprobanteUrl: e.target.value })} placeholder="Sube la imagen y pega la URL aquí" />
            </div>
            <div className="col-span-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
              ℹ️ Tu pago quedará en estado <strong>PENDIENTE</strong>. Un administrador debe
              verificarlo antes de aplicarlo al saldo. No se confirma automáticamente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoModal(false)}>Cancelar</Button>
            <Button onClick={reportarPago}>Enviar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
