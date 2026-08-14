'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda } from '@/lib/finanzas'
import { Loader2, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react'

// =====================================================
// QueCambioModal
// =====================================================
// Modal que muestra los "Cambios detectados" en el comportamiento
// de pagos de un crédito, comparando el período ACTUAL (últimos 30 días)
// contra el período ANTERIOR (30 días previos).
//
// Se alimenta de /api/prestamos/[id]/que-cambio.

type CambioDetectado = {
  severidad: 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'azul' | 'neutro'
  emoji: string
  titulo: string
  descripcion: string
  valorActual?: string
  valorAnterior?: string
  diferencia?: string
}

interface Props {
  prestamoId: string | null
  prestamoCodigo?: string
  open: boolean
  onClose: () => void
}

export function QueCambioModal({ prestamoId, prestamoCodigo, open, onClose }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !prestamoId) return
    setLoading(true)
    setData(null)
    fetch(`/api/prestamos/${prestamoId}/que-cambio`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json.data)
        } else {
          toast({
            title: 'Error',
            description: json.error || 'No se pudo analizar los cambios.',
            variant: 'destructive',
          })
        }
      })
      .catch((e) => {
        toast({
          title: 'Error de red',
          description: e.message,
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [open, prestamoId, toast])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            ¿Qué Cambió?
            {prestamoCodigo && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                · Crédito {prestamoCodigo}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-muted-foreground">Analizando cambios en el comportamiento de pagos...</p>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-muted-foreground">
            No se pudo cargar el análisis de cambios.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen ejecutivo */}
            <Card className={data.resumen.hayAlertas ? 'border-red-300 bg-red-50' : data.resumen.hayMejoras ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {data.resumen.hayAlertas ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : data.resumen.hayMejoras ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <Activity className="w-5 h-5 text-blue-600" />
                  )}
                  <div className="font-semibold text-sm">{data.resumen.mensaje}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.cambios.length} cambio(s) detectado(s) comparando los últimos 30 días vs. los 30 días anteriores.
                </div>
              </CardContent>
            </Card>

            {/* Comparativa de períodos */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Período actual (últimos 30 días)</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pagos:</span><strong>{data.metricas.actual.numPagos}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Monto:</span><strong>{formatearMoneda(data.metricas.actual.montoTotal)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Promedio:</span><strong>{formatearMoneda(data.metricas.actual.promedioMonto)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Atraso prom:</span><strong>{data.metricas.actual.promedioDiasAtraso.toFixed(1)} días</strong></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Período anterior (30 días previos)</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pagos:</span><strong>{data.metricas.anterior.numPagos}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Monto:</span><strong>{formatearMoneda(data.metricas.anterior.montoTotal)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Promedio:</span><strong>{formatearMoneda(data.metricas.anterior.promedioMonto)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Atraso prom:</span><strong>{data.metricas.anterior.promedioDiasAtraso.toFixed(1)} días</strong></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de cambios detectados */}
            <div>
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Cambios detectados
              </div>
              <div className="space-y-2">
                {data.cambios.map((c: CambioDetectado, i: number) => {
                  const colorClass = colorSeveridad(c.severidad)
                  return (
                    <div
                      key={i}
                      className={`border-l-4 ${colorClass.border} p-3 rounded-r-md ${colorClass.bg}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{c.emoji}</span>
                        <div className="flex-1">
                          <div className={`text-sm font-semibold ${colorClass.text}`}>{c.titulo}</div>
                          <div className="text-xs text-muted-foreground mt-1">{c.descripcion}</div>
                          {(c.valorActual || c.valorAnterior || c.diferencia) && (
                            <div className="flex gap-3 mt-2 text-xs">
                              {c.valorActual && (
                                <span className="px-2 py-0.5 rounded bg-white/60">
                                  <span className="text-muted-foreground">Actual:</span> <strong>{c.valorActual}</strong>
                                </span>
                              )}
                              {c.valorAnterior && (
                                <span className="px-2 py-0.5 rounded bg-white/60">
                                  <span className="text-muted-foreground">Anterior:</span> <strong>{c.valorAnterior}</strong>
                                </span>
                              )}
                              {c.diferencia && (
                                <span className={`px-2 py-0.5 rounded font-semibold ${colorClass.text} bg-white/60`}>
                                  {c.diferencia}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Helper: clases Tailwind por severidad
function colorSeveridad(sev: string): { border: string; bg: string; text: string } {
  switch (sev) {
    case 'verde':
      return { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-800' }
    case 'amarillo':
      return { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-800' }
    case 'naranja':
      return { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-800' }
    case 'rojo':
      return { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-800' }
    case 'azul':
      return { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-800' }
    default:
      return { border: 'border-gray-400', bg: 'bg-gray-50', text: 'text-gray-700' }
  }
}
