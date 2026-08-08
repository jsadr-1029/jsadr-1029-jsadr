'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Upload, CheckCircle2, AlertCircle, FileSpreadsheet,
  Search, ArrowRight, ArrowLeft, User, Hash, CreditCard,
} from 'lucide-react'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { useToast } from '@/hooks/use-toast'

interface Movimiento {
  fecha: string
  monto: number
  referencia?: string
  descripcion?: string
  matched?: boolean
  pagoId?: string
  codigoPago?: string
  numeroCuota?: number
  prestamo?: string
  cliente?: string
  montoEsperado?: number
  montoDiferencia?: number
  montoMatch?: boolean
  fechaVencimiento?: string
  motivo?: string
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
}

type Paso = 'buscar' | 'seleccionar' | 'csv' | 'preview' | 'resultado'
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
  const [csvText, setCsvText] = useState('')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<any>(null)
  const { toast } = useToast()

  // ---------- Acción: buscar préstamos ----------
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
          `No se encontraron préstamos activos con cuotas pendientes para ese ${criterio === 'codigo' ? 'código' : 'cédula'}`
        )
        return
      }
      setPrestamos(lista)
      // Si solo hay uno, lo seleccionamos automáticamente
      if (lista.length === 1) {
        setPrestamoSel(lista[0])
        setPaso('csv')
      } else {
        setPaso('seleccionar')
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Acción: previsualizar ----------
  const parseCSV = (text: string): Movimiento[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) throw new Error('El CSV necesita al menos una fila de encabezado y una de datos')
    // Detectar separador (, o ;)
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ''))
    return lines.slice(1).map((line) => {
      const cols = line.split(sep).map((c) => c.trim().replace(/"/g, ''))
      const get = (...names: string[]): string => {
        for (const n of names) {
          const idx = headers.indexOf(n)
          if (idx >= 0 && cols[idx]) return cols[idx]
        }
        return ''
      }
      const fecha = get('fecha', 'date')
      const montoStr = get('monto', 'amount', 'valor')
      const monto = parseFloat(montoStr.replace(/[^0-9.-]/g, '')) || 0
      return {
        fecha,
        monto,
        descripcion: get('descripcion', 'description', 'concepto', 'detalle'),
      }
    }).filter((m) => m.fecha && m.monto > 0)
  }

  const previsualizar = async () => {
    if (!prestamoSel) return
    setLoading(true)
    setError('')
    try {
      const movs = parseCSV(csvText)
      if (movs.length === 0) {
        setError('No se encontraron movimientos válidos con fecha y monto')
        return
      }
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'previsualizar',
          prestamoId: prestamoSel.id,
          movimientos: movs,
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data.error || 'Error al previsualizar')
        return
      }
      const movsResult: Movimiento[] = data.data.movimientos.map((m: Movimiento) => ({
        ...m,
        // Generar referencia interna si el CSV no la trae, para poder
        // seleccionar/deseleccionar filas en el preview
        referencia: m.referencia || `${m.fecha}|${m.monto}|${m.descripcion || ''}`,
      }))
      setMovimientos(movsResult)
      // Pre-seleccionar los matched con monto correcto
      const preSel = new Set<string>()
      movsResult.forEach((m) => {
        if (m.matched && m.montoMatch) preSel.add(m.referencia!)
      })
      setSeleccionados(preSel)
      setPaso('preview')
    } catch (e: any) {
      setError(e.message || 'Error al procesar el CSV')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Acción: aplicar ----------
  const aplicar = async () => {
    if (!prestamoSel) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aplicar',
          prestamoId: prestamoSel.id,
          movimientos,
          seleccionados: Array.from(seleccionados),
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
    setCsvText('')
    setMovimientos([])
    setSeleccionados(new Set())
    setResultado(null)
    setError('')
    onCerrar()
  }

  const toggleSeleccion = (ref: string) => {
    const ns = new Set(seleccionados)
    if (ns.has(ref)) ns.delete(ref)
    else ns.add(ref)
    setSeleccionados(ns)
  }

  const matched = movimientos.filter((m) => m.matched)
  const noMatched = movimientos.filter((m) => !m.matched)

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
          <span className={paso === 'buscar' ? 'font-bold text-sky-700' : ''}>1. Buscar préstamo</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'seleccionar' ? 'font-bold text-sky-700' : ''}>2. Seleccionar</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'csv' ? 'font-bold text-sky-700' : ''}>3. Pegar CSV</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'preview' ? 'font-bold text-sky-700' : ''}>4. Confirmar</span>
          <ArrowRight className="w-3 h-3" />
          <span className={paso === 'resultado' ? 'font-bold text-sky-700' : ''}>5. Resultado</span>
        </div>

        {/* ===== PASO 1: BUSCAR PRÉSTAMO ===== */}
        {paso === 'buscar' && (
          <div className="space-y-4">
            <Alert className="bg-sky-50 border-sky-200">
              <AlertDescription className="text-sky-800 text-xs">
                Para conciliar, primero identifica el <strong>préstamo</strong>. Puedes buscar por
                <strong> código del préstamo</strong> o por <strong>cédula del cliente</strong>.
                Si el cliente tiene varios créditos activos, te mostraremos la lista para que elijas cuál aplicar.
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
                  Código del préstamo
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
                {criterio === 'codigo' ? 'Código del préstamo' : 'Cédula del cliente'}
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

        {/* ===== PASO 2: SELECCIONAR PRÉSTAMO ===== */}
        {paso === 'seleccionar' && (
          <div className="space-y-3">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800 text-xs">
                Se encontraron <strong>{prestamos.length} préstamos activos</strong> con cuotas pendientes
                para {criterio === 'codigo' ? 'ese código' : 'esa cédula'}. Selecciona cuál quieres conciliar.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {prestamos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPrestamoSel(p)
                    setError('')
                    setPaso('csv')
                  }}
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

        {/* ===== PASO 3: PEGAR CSV ===== */}
        {paso === 'csv' && prestamoSel && (
          <div className="space-y-3">
            {/* Resumen del préstamo seleccionado */}
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

            <Alert className="bg-sky-50 border-sky-200">
              <AlertDescription className="text-sky-800 text-xs">
                Pega aquí el CSV exportado por tu banco. Formato esperado:
                <strong> fecha, monto, descripcion</strong> (separador <code>,</code> o <code>;</code>,
                primera fila = encabezados). El sistema buscará cuotas <strong>PENDIENTE</strong> de este
                préstamo cuyo monto coincida con cada movimiento del banco y las aplicará automáticamente.
              </AlertDescription>
            </Alert>

            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`fecha,monto,descripcion\n2026-08-05,150000,Pago cuota\n2026-08-10,150000,Transferencia`}
              className="font-mono text-xs h-44"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setPaso(prestamos.length > 1 ? 'seleccionar' : 'buscar')
                  setPrestamoSel(null)
                  setError('')
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver
              </Button>
              <Button
                onClick={previsualizar}
                disabled={loading || !csvText.trim()}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Previsualizar
              </Button>
            </div>
          </div>
        )}

        {/* ===== PASO 4: PREVIEW ===== */}
        {paso === 'preview' && prestamoSel && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              Préstamo <strong className="font-mono">{prestamoSel.codigo}</strong> · {prestamoSel.cliente.nombre}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
                <div className="text-xl font-bold text-emerald-700">{matched.length}</div>
                <div className="text-[11px] text-emerald-600">Matched</div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                <div className="text-xl font-bold text-amber-700">
                  {matched.filter((m) => !m.montoMatch).length}
                </div>
                <div className="text-[11px] text-amber-600">Monto difiere</div>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-2">
                <div className="text-xl font-bold text-red-700">{noMatched.length}</div>
                <div className="text-[11px] text-red-600">Sin match</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left text-slate-600">Sel.</th>
                      <th className="p-2 text-left text-slate-600">Fecha</th>
                      <th className="p-2 text-right text-slate-600">Monto</th>
                      <th className="p-2 text-left text-slate-600">Cuota / Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${m.matched ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(m.referencia!)}
                            onChange={() => toggleSeleccion(m.referencia!)}
                            disabled={!m.matched || !m.montoMatch}
                          />
                        </td>
                        <td className="p-2 text-slate-700">{m.fecha}</td>
                        <td className="p-2 text-right text-slate-700">{formatearMoneda(m.monto)}</td>
                        <td className="p-2">
                          {m.matched ? (
                            <div>
                              <div className="text-slate-700">
                                Cuota #{m.numeroCuota}
                                <span className="text-slate-500 ml-1">· {m.codigoPago}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Esperado: {formatearMoneda(m.montoEsperado || 0)} ·{' '}
                                {m.montoMatch ? (
                                  <span className="text-emerald-600">✓ coincide</span>
                                ) : (
                                  <span className="text-red-600">diferencia {formatearMoneda(m.montoDiferencia || 0)}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-red-600 text-[10px]">{m.motivo}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {seleccionados.size} seleccionado(s) · Total: {formatearMoneda(
                  movimientos.filter((m) => seleccionados.has(m.referencia!)).reduce((s, m) => s + m.monto, 0)
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaso('csv')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                </Button>
                <Button
                  onClick={aplicar}
                  disabled={loading || seleccionados.size === 0}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Aplicar ({seleccionados.size})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== PASO 5: RESULTADO ===== */}
        {paso === 'resultado' && resultado && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Conciliación completada</h3>
              {resultado.prestamo && (
                <p className="text-xs text-slate-500 mt-1">
                  Préstamo <strong className="font-mono">{resultado.prestamo.codigo}</strong> · {resultado.prestamo.cliente}
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
                    {e.movimiento?.fecha} · {formatearMoneda(e.movimiento?.monto || 0)}: {e.error}
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
