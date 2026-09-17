'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { formatearMoneda } from '@/lib/finanzas'
import { useToast } from '@/hooks/use-toast'

interface Movimiento {
  fecha: string
  monto: number
  referencia: string
  descripcion?: string
  matched?: boolean
  pagoId?: string
  codigoPago?: string
  prestamo?: string
  cliente?: string
  montoEsperado?: number
  montoDiferencia?: number
  montoMatch?: boolean
  motivo?: string
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onAplicado: () => void
}

export function ConciliacionBancariaModal({ abierto, onCerrar, onAplicado }: Props) {
  const [paso, setPaso] = useState<'input' | 'preview' | 'resultado'>('input')
  const [csvText, setCsvText] = useState('')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<any>(null)
  const { toast } = useToast()

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
      return {
        fecha: get('fecha', 'date'),
        monto: parseFloat(get('monto', 'amount', 'valor')) || 0,
        referencia: get('referencia', 'reference', 'ref'),
        descripcion: get('descripcion', 'description', 'concepto', 'detalle'),
      }
    }).filter((m) => m.referencia && m.monto > 0)
  }

  const previsualizar = async () => {
    setLoading(true)
    setError('')
    try {
      const movs = parseCSV(csvText)
      if (movs.length === 0) {
        setError('No se encontraron movimientos válidos con referencia y monto')
        return
      }
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'previsualizar', movimientos: movs }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data.error || 'Error al previsualizar')
        return
      }
      setMovimientos(data.data.movimientos)
      // Pre-seleccionar los que tienen montoMatch
      const preSel = new Set<string>()
      data.data.movimientos.forEach((m: Movimiento) => {
        if (m.matched && m.montoMatch) preSel.add(m.referencia)
      })
      setSeleccionados(preSel)
      setPaso('preview')
    } catch (e: any) {
      setError(e.message || 'Error al procesar el CSV')
    } finally {
      setLoading(false)
    }
  }

  const aplicar = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/pagos/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aplicar',
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

  const cerrar = () => {
    setPaso('input')
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
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            Conciliación bancaria
          </DialogTitle>
        </DialogHeader>

        {paso === 'input' && (
          <div className="space-y-3">
            <Alert className="bg-sky-50 border-sky-200">
              <AlertDescription className="text-sky-800 text-xs">
                Pega aquí el CSV exportado por tu banco. Formato esperado: <strong>fecha, monto, referencia, descripcion</strong>
                (separador <code>,</code> o <code>;</code>, primera fila = encabezados).
                El sistema buscará pagos PENDIENTE con esa referencia y los aplicará automáticamente.
              </AlertDescription>
            </Alert>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`fecha,monto,referencia,descripcion\n2026-01-15,150000,PREST-JA-001-C3,Pago cuota\n2026-01-15,280000,PREST-CA-002-C1,Pago cuota`}
              className="font-mono text-xs h-56"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cerrar}>Cancelar</Button>
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

        {paso === 'preview' && (
          <div className="space-y-3">
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
                      <th className="p-2 text-left text-slate-600">Referencia</th>
                      <th className="p-2 text-right text-slate-600">Monto</th>
                      <th className="p-2 text-left text-slate-600">Cliente / Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${m.matched ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(m.referencia)}
                            onChange={() => toggleSeleccion(m.referencia)}
                            disabled={!m.matched || !m.montoMatch}
                          />
                        </td>
                        <td className="p-2 text-slate-700">{m.fecha}</td>
                        <td className="p-2 font-mono text-slate-700">{m.referencia}</td>
                        <td className="p-2 text-right text-slate-700">{formatearMoneda(m.monto)}</td>
                        <td className="p-2">
                          {m.matched ? (
                            <div>
                              <div className="text-slate-700">{m.cliente}</div>
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
                  movimientos.filter((m) => seleccionados.has(m.referencia)).reduce((s, m) => s + m.monto, 0)
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPaso('input')}>Volver</Button>
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

        {paso === 'resultado' && resultado && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Conciliación completada</h3>
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
                    {e.movimiento?.referencia}: {e.error}
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
