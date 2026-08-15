'use client'

// =====================================================
// Trayectoria Timeline + Historial de Pagos
// =====================================================

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Award, Zap, Clock, X } from 'lucide-react'
import { formatCOP, formatDate } from '@/lib/format'
import { toast } from 'sonner'

// =====================================================
// Timeline visual de la trayectoria
// =====================================================

export function TrayectoriaTimeline({ creditos, onVerPagos }: { creditos: any[]; onVerPagos: (credito: any) => void }) {
  if (!creditos || creditos.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-slate-50 text-center">
        <p className="text-sm text-slate-500">Aún no tienes créditos registrados.</p>
      </div>
    )
  }

  // Agrupar por año
  const porAnio: Record<number, any[]> = {}
  for (const c of creditos) {
    if (!porAnio[c.anio]) porAnio[c.anio] = []
    porAnio[c.anio].push(c)
  }
  const anios = Object.keys(porAnio).map(Number).sort((a, b) => a - b)

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 mb-2">
        Toca un crédito para ver su historial de pagos
      </p>
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-violet-300 via-blue-300 to-emerald-300" />

        {anios.map((anio, idxAnio) => (
          <div key={anio} className="relative pl-10 mb-4">
            {/* Punto del año */}
            <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
              {anio}
            </div>

            <div className="space-y-2">
              {porAnio[anio].map((credito) => (
                <CreditoHistoricoItem
                  key={credito.prestamoId}
                  credito={credito}
                  onVerPagos={() => onVerPagos(credito)}
                />
              ))}
            </div>

            {idxAnio < anios.length - 1 && (
              <div className="absolute left-3 -bottom-2 text-violet-300">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CreditoHistoricoItem({ credito, onVerPagos }: { credito: any; onVerPagos: () => void }) {
  const emoji = credito.completado ? '🏆' : credito.estado === 'EN_MORA' ? '🔴' : '💳'
  const colorBorde = credito.completado
    ? 'border-emerald-200 bg-emerald-50/50'
    : credito.estado === 'EN_MORA'
    ? 'border-red-200 bg-red-50/50'
    : 'border-blue-200 bg-blue-50/50'

  return (
    <button
      onClick={onVerPagos}
      className={`w-full text-left p-3 rounded-lg border-2 ${colorBorde} hover:shadow-md transition-all`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <div>
            <p className="text-xs font-mono text-slate-600">{credito.codigo}</p>
            <p className="text-xs text-slate-500">
              {formatDate(credito.fechaDesembolso)} · {formatCOP(credito.montoPrincipal)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{credito.progresoPorcentaje.toFixed(0)}%</p>
          <p className="text-[10px] text-slate-500">{credito.cuotasPagadas}/{credito.numeroCuotas} cuotas</p>
        </div>
      </div>

      {/* Mini barra de progreso */}
      <div className="h-1.5 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            credito.completado ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${credito.progresoPorcentaje}%` }}
        />
      </div>

      {/* Badges de comportamiento */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {credito.pagosAnticipados > 0 && (
          <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
            <Zap className="w-2.5 h-2.5 mr-0.5" />
            {credito.pagosAnticipados} anticipados
          </Badge>
        )}
        {credito.pagosPuntuales > 0 && (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            {credito.pagosPuntuales} puntuales
          </Badge>
        )}
        {credito.pagosPosteriores > 0 && (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
            {credito.pagosPosteriores} posteriores
          </Badge>
        )}
        {credito.completado && (
          <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
            <Award className="w-2.5 h-2.5 mr-0.5" />
            Completado
          </Badge>
        )}
      </div>
    </button>
  )
}

// =====================================================
// Modal de Historial de Pagos de un crédito específico
// =====================================================

export function HistorialPagosModal({
  token,
  credito,
  onClose,
}: {
  token: string
  credito: any
  onClose: () => void
}) {
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar los pagos del préstamo desde la API del portal
    fetch(`/api/portal/prestamos?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.prestamos) {
          const prestamo = d.prestamos.find((p: any) => p.id === credito.prestamoId)
          if (prestamo?.pagos) {
            setPagos(prestamo.pagos)
          }
        }
      })
      .catch(e => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [token, credito.prestamoId])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Historial de pagos</h3>
            <p className="text-xs text-slate-500 font-mono">{credito.codigo}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : pagos.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No hay pagos registrados para este crédito.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pagos
                .filter((p: any) => !p.esFlexibilidadFinanciera)
                .map((pago: any) => {
                  const esPuntual = pago.fechaPago && pago.fechaVencimiento &&
                    new Date(pago.fechaPago).getTime() <= new Date(pago.fechaVencimiento).getTime()
                  const esAnticipado = pago.fechaPago && pago.fechaVencimiento &&
                    new Date(pago.fechaPago).getTime() < new Date(pago.fechaVencimiento).getTime()
                  const esPosterior = pago.fechaPago && pago.fechaVencimiento &&
                    new Date(pago.fechaPago).getTime() > new Date(pago.fechaVencimiento).getTime()

                  const emoji = esAnticipado ? '⚡' : esPuntual ? '🟢' : esPosterior ? '🟠' : '⏳'
                  const label = esAnticipado ? 'Pago anticipado' : esPuntual ? 'Pago puntual' : esPosterior ? 'Pago posterior' : 'Pendiente'
                  const color = esAnticipado ? 'text-violet-700 bg-violet-50' : esPuntual ? 'text-emerald-700 bg-emerald-50' : esPosterior ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-50'

                  return (
                    <div key={pago.id} className="p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{emoji}</span>
                          <div>
                            <p className={`text-sm font-semibold ${color.split(' ')[0]} px-2 py-0.5 rounded inline-block`}>
                              {label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">Cuota #{pago.numeroCuota}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{formatCOP(pago.montoTotal)}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {pago.estado}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        <div>
                          <p>Fecha pactada:</p>
                          <p className="font-medium text-slate-700">{formatDate(pago.fechaVencimiento)}</p>
                        </div>
                        <div>
                          <p>Fecha de pago:</p>
                          <p className="font-medium text-slate-700">{pago.fechaPago ? formatDate(pago.fechaPago) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
