'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, AlertTriangle, TrendingUp, TrendingDown, MessageSquare } from 'lucide-react'
import { formatearMoneda } from '@/lib/finanzas'

interface Prediccion {
  prestamoId: string
  codigo: string
  cliente: string
  cedula: string
  telefono: string
  scoreMora: number
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  factores: string[]
  diasMoraActual: number
  probabilidadPagoPuntual: number
  recomendacion: string
}

interface Props {
  abierto: boolean
  onCerrar: () => void
}

const COLOR_RIESGO = {
  BAJO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  MEDIO: 'bg-amber-100 text-amber-700 border-amber-200',
  ALTO: 'bg-orange-100 text-orange-700 border-orange-200',
  CRITICO: 'bg-red-100 text-red-700 border-red-200',
}

const BAR_RIESGO = {
  BAJO: 'bg-emerald-500',
  MEDIO: 'bg-amber-500',
  ALTO: 'bg-orange-500',
  CRITICO: 'bg-red-500',
}

export function PrediccionMoraModal({ abierto, onCerrar }: Props) {
  const [data, setData] = useState<Prediccion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resumen, setResumen] = useState<any>(null)

  useEffect(() => {
    if (abierto && !data) {
      setLoading(true)
      fetch('/api/pagos/prediccion-mora')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setData(d.data)
            setResumen(d.resumen)
          }
        })
        .finally(() => setLoading(false))
    }
  }, [abierto, data])

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            IA predictiva de mora
            <Badge variant="outline" className="text-[10px]">Beta</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500 mr-2" />
            <span className="text-slate-500">Analizando cartera...</span>
          </div>
        ) : data && resumen ? (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-5 gap-2">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{resumen.total}</div>
                <div className="text-[10px] text-slate-500">Total</div>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-center">
                <div className="text-lg font-bold text-emerald-700">{resumen.conteoNiveles.BAJO}</div>
                <div className="text-[10px] text-emerald-600">Bajo</div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
                <div className="text-lg font-bold text-amber-700">{resumen.conteoNiveles.MEDIO}</div>
                <div className="text-[10px] text-amber-600">Medio</div>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 text-center">
                <div className="text-lg font-bold text-orange-700">{resumen.conteoNiveles.ALTO}</div>
                <div className="text-[10px] text-orange-600">Alto</div>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
                <div className="text-lg font-bold text-red-700">{resumen.conteoNiveles.CRITICO}</div>
                <div className="text-[10px] text-red-600">Crítico</div>
              </div>
            </div>

            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <p className="text-xs text-purple-800">
                <strong>Promedio de riesgo:</strong> {resumen.promedioRiesgo}/100 ·{' '}
                <strong>{resumen.altoRiesgo}</strong> solicitud(s) en riesgo alto o crítico que requieren
                acción inmediata.
              </p>
            </div>

            {/* Lista de predicciones */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.map((p) => (
                <div key={p.prestamoId} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{p.cliente}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.codigo}</div>
                    </div>
                    <Badge className={COLOR_RIESGO[p.nivelRiesgo]}>
                      {p.nivelRiesgo} · {p.scoreMora}/100
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${BAR_RIESGO[p.nivelRiesgo]} transition-all`}
                        style={{ width: `${p.scoreMora}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                    <div className="flex items-center gap-1">
                      {p.probabilidadPagoPuntual >= 60 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-slate-600">
                        Pago puntual: <strong>{p.probabilidadPagoPuntual}%</strong>
                      </span>
                    </div>
                    {p.diasMoraActual > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-red-600">
                          Mora actual: <strong>{p.diasMoraActual} días</strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">
                    <span className="font-medium">Factores:</span> {p.factores.join(' · ')}
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-indigo-500" />
                    <span className="text-[11px] text-slate-600">{p.recomendacion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">Sin datos</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
