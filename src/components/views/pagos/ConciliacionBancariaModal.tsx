'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, CheckCircle2, AlertCircle, FileSpreadsheet,
  Search, ArrowRight, ArrowLeft, User, Hash, CreditCard, Calendar,
} from 'lucide-react'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { useToast } from '@/hooks/use-toast'

interface PagoPendiente {
  id: string
  codigo: string | null
  numeroCuota: number
  montoTotal: number
  fechaVencimiento: string
  estado: string
}

interface PrestamoResumen {
  id: string
  codigo: string
  estado: string
  montoPrincipal: number
  saldoTotal: number
  numeroCuotas: number
  cuotasPagadas: number
  frecuencia: string
  cliente: { nombre: string; cedula: string; telefono?: string | null }
  cuotasPendientes: number
  proximaCuota: {
    numeroCuota: number
    montoTotal: number
    fechaVencimiento: string
  } | null
  pagosPendientes: PagoPendiente[]
}

type Paso = 'buscar' | 'seleccionar' | 'confirmar' | 'resultado'
type Criterio = 'codigo' | 'cedula'

interface Props {
  abierto: boolean
  onCerrar: () => void
  onAplicado: () => void
}

export function ConciliacionBancariaModal({ abierto, onCerrar, onAplicado }: Props) {
  const [paso, setPaso] = useState<Paso>('buscar')
  const [criterio, setCriterio] = useState<Criterio>('codigo')
  const [valorBusqueda, setValorBusqueda] = useState('')
  const [prestamos, setPrestamos] = useState<PrestamoResumen[]>([])
  const [prestamoSel, setPrestamoSel] = useState<PrestamoResumen | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const { toast } = useToast()

  // ---------- Acción: buscar solicitudes ----------
  const buscarPrestamos = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'buscar-prestamos',
          [criterio]: valorBusqueda.trim(),
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data.error || 'Error al buscar')
        return
      }
      const lista: PrestamoResumen[] = data.data.prestamos || []
      if (lista.length === 0) {
        setError(
          data.data.mensaje ||
          `No se encontraron solicitudes activos con cuotas pendientes para ese ${criterio === 'codigo' ? 'código' : 'cédula'}`
        )
        return
      }
      setPrestamos(lista)
      // Si solo hay uno, lo seleccionamos automáticamente.
      if (lista.length === 1) {
        seleccionarPrestamo(lista[0])
      } else {
        setPaso('seleccionar')
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Helper: seleccionar solicitud y pre-seleccionar todos sus pagos ----------
  const seleccionarPrestamo = (p: PrestamoResumen) => {
    setError('')
    setPrestamoSel(p)
    // Pre-seleccionar todas las cuotas pendientes para que el usuario
    // solo tenga que dar clic en "Aplicar" si está de acuerdo.
    const preSel = new Set<string>(p.pagosPendientes.map((pg) => pg.id))
    setSeleccionados(preSel)
    setResultado(null)
    setPaso('confirmar')
  }

  // ---------- Acción: aplicar pagos ----------
  const aplicarPagos = async () => {
    if (!prestamoSel) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aplicar-pagos',
          prestamoId: prestamoSel.id,
          pagoIds: Array.from(seleccionados),
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data.error || 'Error al aplicar conciliación')
        return
      }
      setResultado(data.data)
      setPaso('resultado')
      toast({
        title: 'Conciliación aplicada',
        description: `${data.data.aplicados} pago(s) aplicado(s) correctamente.`,
      })
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Reset completo ----------
  const cerrar = () => {
    setPaso('buscar')
    setCriterio('codigo')
    setValorBusqueda('')
    setPrestamos([])
    setPrestamoSel(null)
    setSeleccionados(new Set())
    setResultado(null)
    setError('')
    onCerrar()
  }

  const toggleSeleccion = (id: string) => {
    const ns = new Set(seleccionados)
    if (ns.has(id)) ns.delete(id)
    else ns.add(id)
    setSeleccionados(ns)
  }

  const toggleTodos = () => {
    if (!prestamoSel) return
    // Si todos están seleccionados, deseleccionar todos; si no, seleccionar todos
    const todosSeleccionados = prestamoSel.pagosPendientes.every((pg) => seleccionados.has(pg.id))
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(prestamoSel.pagosPendientes.map((pg) => pg.id)))
    }
  }

  const totalSeleccionado = prestamoSel
    ? prestamoSel.pagosPendientes
        .filter((pg) => seleccionados.has(pg.id))
        .reduce((s, pg) => s + pg.montoTotal, 0)
    : 0

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            Conciliación bancaria
          </DialogTitle>
        </DialogHeader>

        {/* ===== Indicador de pasos ===== */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2 flex-wrap">
          <span className={paso === 'buscar' ? 'font-bold text-sky-700' : ''}>1. Buscar solicitud</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'seleccionar' ? 'font-bold text-sky-700' : ''}>2. Seleccionar</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'confirmar' ? 'font-bold text-sky-700' : ''}>3. Confirmar pagos</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'resultado' ? 'font-bold text-sky-700' : ''}>4. Resultado</span>
        </div>

        {/* ===== PASO 1: BUSCAR SOLICITUD ===== */}
        {paso === 'buscar' && (
          <div className="space-y-4">
            <Alert className="bg-sky-50 border-sky-200">
              <AlertDescription className="text-sky-800 text-xs">
                Para conciliar, primero identifica el <strong>solicitud</strong>. Puedes buscar por
                <strong> código del solicitud</strong> o por <strong>cédula del cliente</strong>.
                Si el cliente tiene varios créditos activos, te mostraremos la lista para que elijas cuál aplicar.
                El sistema <strong>cargará automáticamente</strong> las cuotas pendientes y solo tendrás
                que confirmar cuáles aplicar.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-700">Buscar por</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCriterio('codigo')}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                    criterio === 'codigo'
                      ? 'bg-sky-50 border-sky-400 text-sky-800 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  Código del solicitud
                </button>
                <button
                  type="button"
                  onClick={() => setCriterio('cedula')}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                    criterio === 'cedula'
                      ? 'bg-sky-50 border-sky-400 text-sky-800 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Cédula del cliente
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                {criterio === 'codigo' ? 'Código del solicitud' : 'Cédula del cliente'}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={valorBusqueda}
                  onChange={(e) => setValorBusqueda(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && valorBusqueda.trim()) buscarPrestamos() }}
                  placeholder={criterio === 'codigo' ? 'Ej: PREST-JA-001' : 'Ej: 1234567890'}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={buscarPrestamos}
                  disabled={loading || !valorBusqueda.trim()}
                  className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Buscar</span>
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end">
              <Button variant="outline" onClick={cerrar}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* ===== PASO 2: SELECCIONAR SOLICITUD ===== */}
        {paso === 'seleccionar' && (
          <div className="space-y-3">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800 text-xs">
                Se encontraron <strong>{prestamos.length} solicitudes activos</strong> con cuotas pendientes
                para {criterio === 'codigo' ? 'ese código' : 'esa cédula'}. Selecciona cuál quieres conciliar.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {prestamos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => seleccionarPrestamo(p)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50/40 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                        <span className="font-mono text-xs font-bold text-slate-800">{p.codigo}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{p.estado}</Badge>
                      </div>
                      <div className="text-xs text-slate-700 mb-1">
                        <strong>{p.cliente.nombre}</strong> · C.C. {p.cliente.cedula}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                        <span>Capital: <strong className="text-slate-700">{formatearMoneda(p.montoPrincipal)}</strong></span>
                        <span>Saldo: <strong className="text-slate-700">{formatearMoneda(p.saldoTotal)}</strong></span>
                        <span>Cuotas: <strong className="text-slate-700">{p.cuotasPagadas}/{p.numeroCuotas}</strong></span>
                        <span>Pendientes: <strong className="text-amber-700">{p.cuotasPendientes}</strong></span>
                      </div>
                      {p.proximaCuota && (
                        <div className="text-[11px] text-sky-700 mt-1">
                          Próxima cuota #{p.proximaCuota.numeroCuota} · {formatearMoneda(p.proximaCuota.montoTotal)} · vence {formatearFecha(p.proximaCuota.fechaVencimiento)}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 mt-1" />
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setPaso('buscar'); setError('') }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver
              </Button>
            </div>
          </div>
        )}

        {/* ===== PASO 3: CONFIRMAR PAGOS ===== */}
        {paso === 'confirmar' && prestamoSel && (
          <div className="space-y-3">
            {/* Resumen del solicitud seleccionado */}
            <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/40">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span className="font-mono text-xs font-bold text-slate-800">{prestamoSel.codigo}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{prestamoSel.estado}</Badge>
              </div>
              <div className="text-xs text-slate-700">
                <strong>{prestamoSel.cliente.nombre}</strong> · C.C. {prestamoSel.cliente.cedula}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                <span>Saldo: <strong className="text-slate-700">{formatearMoneda(prestamoSel.saldoTotal)}</strong></span>
                <span>Cuotas pendientes: <strong className="text-amber-700">{prestamoSel.cuotasPendientes}</strong></span>
                {prestamoSel.proximaCuota && (
                  <span>Próxima cuota #{prestamoSel.proximaCuota.numeroCuota}: <strong className="text-slate-700">{formatearMoneda(prestamoSel.proximaCuota.montoTotal)}</strong></span>
                )}
              </div>
            </div>

            <Alert className="bg-emerald-50 border-emerald-200">
              <AlertDescription className="text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  El sistema <strong>cargó automáticamente</strong> las cuotas pendientes de este solicitud.
                  Todas están pre-seleccionadas. Si quieres excluir alguna, desmárcala; si no, solo da clic en
                  <strong> Aplicar ({seleccionados.size})</strong> para confirmar la conciliación.
                </div>
              </AlertDescription>
            </Alert>

            {/* Tabla de cuotas pendientes con checkboxes */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      prestamoSel.pagosPendientes.length > 0 &&
                      prestamoSel.pagosPendientes.every((pg) => seleccionados.has(pg.id))
                    }
                    onChange={toggleTodos}
                    className="w-3.5 h-3.5"
                  />
                  Cuotas pendientes ({prestamoSel.pagosPendientes.length})
                </Label>
                <span className="text-[11px] text-slate-500">
                  Seleccionadas: <strong className="text-slate-700">{seleccionados.size}</strong>
                </span>
              </div>

              {prestamoSel.pagosPendientes.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Este solicitud no tiene cuotas pendientes para conciliar.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0">
                      <tr className="border-b border-slate-200">
                        <th className="p-2 text-left text-slate-600 w-8"></th>
                        <th className="p-2 text-left text-slate-600">Cuota</th>
                        <th className="p-2 text-left text-slate-600">Código</th>
                        <th className="p-2 text-right text-slate-600">Monto</th>
                        <th className="p-2 text-left text-slate-600">Vencimiento</th>
                        <th className="p-2 text-left text-slate-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestamoSel.pagosPendientes.map((pg) => (
                        <tr
                          key={pg.id}
                          className={`border-b border-slate-100 cursor-pointer ${
                            seleccionados.has(pg.id) ? 'bg-emerald-50/40' : 'bg-white'
                          }`}
                          onClick={() => toggleSeleccion(pg.id)}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={seleccionados.has(pg.id)}
                              onChange={() => toggleSeleccion(pg.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5"
                            />
                          </td>
                          <td className="p-2 text-slate-700 font-semibold">#{pg.numeroCuota}</td>
                          <td className="p-2 text-slate-600 font-mono text-[11px]">{pg.codigo}</td>
                          <td className="p-2 text-right text-slate-700 font-semibold">
                            {formatearMoneda(pg.montoTotal)}
                          </td>
                          <td className="p-2 text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatearFecha(pg.fechaVencimiento)}
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1.5 ${
                                pg.estado === 'VENCIDO'
                                  ? 'border-red-300 text-red-700 bg-red-50'
                                  : 'border-amber-300 text-amber-700 bg-amber-50'
                              }`}
                            >
                              {pg.estado}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Total a aplicar */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-sky-50 border border-sky-200">
              <div>
                <div className="text-[11px] text-slate-500">Total a conciliar</div>
                <div className="text-lg font-bold text-sky-700">{formatearMoneda(totalSeleccionado)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500">Pagos seleccionados</div>
                <div className="text-lg font-bold text-slate-700">{seleccionados.size}</div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setPaso(prestamos.length > 1 ? 'seleccionar' : 'buscar')
                  setPrestamoSel(null)
                  setSeleccionados(new Set())
                  setError('')
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver
              </Button>
              <Button
                onClick={aplicarPagos}
                disabled={loading || seleccionados.size === 0}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Aplicar ({seleccionados.size})
              </Button>
            </div>
          </div>
        )}

        {/* ===== PASO 4: RESULTADO ===== */}
        {paso === 'resultado' && resultado && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Conciliación completada</h3>
              {resultado.prestamo && (
                <p className="text-xs text-slate-500 mt-1">
                  Solicitud <strong className="font-mono">{resultado.prestamo.codigo}</strong> · {resultado.prestamo.cliente}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-2xl font-bold text-emerald-700">{resultado.aplicados}</div>
                <div className="text-xs text-emerald-600">Aplicados</div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="text-2xl font-bold text-amber-700">{resultado.errores}</div>
                <div className="text-xs text-amber-600">Errores</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div className="text-2xl font-bold text-slate-700">{resultado.totalProcesados}</div>
                <div className="text-xs text-slate-600">Procesados</div>
              </div>
            </div>
            {resultado.erroresDetalle?.length > 0 && (
              <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-amber-700 mb-1">Detalles de errores:</p>
                {resultado.erroresDetalle.slice(0, 5).map((e: any, i: number) => (
                  <p key={i} className="text-[11px] text-amber-800">
                    Cuota #{e.numeroCuota} · {e.codigo}: {e.error}
                  </p>
                ))}
              </div>
            )}
            {resultado.aplicadosDetalle?.length > 0 && (
              <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/50 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Pagos aplicados:</p>
                {resultado.aplicadosDetalle.map((a: any, i: number) => (
                  <p key={i} className="text-[11px] text-emerald-800">
                    Cuota #{a.numeroCuota} · {formatearMoneda(a.monto)} · {a.fecha}
                  </p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { cerrar(); onAplicado() }} className="w-full">Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
