'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { formatearMoneda } from '@/lib/finanzas'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProximoPago {
  prestamoId: string
  codigo: string
  cliente: { nombre: string; cedula: string; telefono: string }
  proximaCuota: number
  totalCuotas: number
  fechaVencimiento: string
  diasMora: number
  cuotaBase: number
  montoPendiente: number
  estado: string
  esAplazada?: boolean
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function PagosCalendario() {
  const [pagos, setPagos] = useState<ProximoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())

  useEffect(() => {
    setLoading(true)
    fetch('/api/pagos/proximos?dias=90')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPagos(d.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Agrupar pagos por día
  const pagosPorDia = useMemo(() => {
    const map = new Map<string, ProximoPago[]>()
    for (const p of pagos) {
      const fecha = new Date(p.fechaVencimiento)
      const key = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [pagos])

  // Generar matriz de días del mes
  const diasMatriz = useMemo(() => {
    const year = mesActual.getFullYear()
    const month = mesActual.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    // Lunes = 0, Domingo = 6
    let primerDiaSemana = primerDia.getDay() - 1
    if (primerDiaSemana < 0) primerDiaSemana = 6
    const dias: (Date | null)[] = []
    for (let i = 0; i < primerDiaSemana; i++) dias.push(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d))
    while (dias.length % 7 !== 0) dias.push(null)
    return dias
  }, [mesActual])

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const navegarMes = (delta: number) => {
    const nueva = new Date(mesActual)
    nueva.setMonth(nueva.getMonth() + delta)
    setMesActual(nueva)
  }

  const irAHoy = () => setMesActual(new Date())

  const getPagosDia = (fecha: Date): ProximoPago[] => {
    const key = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`
    return pagosPorDia.get(key) || []
  }

  const totalMes = useMemo(() => {
    const year = mesActual.getFullYear()
    const month = mesActual.getMonth()
    return pagos
      .filter((p) => {
        const f = new Date(p.fechaVencimiento)
        return f.getFullYear() === year && f.getMonth() === month
      })
      .reduce((s, p) => s + p.montoPendiente, 0)
  }, [pagos, mesActual])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
        <span className="text-slate-500">Cargando calendario...</span>
      </div>
    )
  }

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-slate-700 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            {MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
            <span className="text-xs font-normal text-slate-400 ml-2">
              · Total: {formatearMoneda(totalMes)}
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navegarMes(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irAHoy}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => navegarMes(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-500 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasMatriz.map((fecha, i) => {
            if (!fecha) return <div key={i} className="aspect-square min-h-[70px]" />
            const pagosDia = getPagosDia(fecha)
            const esHoy = fecha.getTime() === hoy.getTime()
            const esPasado = fecha.getTime() < hoy.getTime()
            const tieneVencidos = pagosDia.some((p) => p.estado === 'VENCIDO')
            const tieneAplazados = pagosDia.some((p) => p.esAplazada)
            return (
              <div
                key={i}
                className={`aspect-square min-h-[70px] rounded-md border p-1 text-[11px] relative transition-all hover:shadow-sm ${
                  esHoy
                    ? 'border-indigo-500 bg-indigo-50'
                    : esPasado && pagosDia.length > 0
                    ? 'border-red-200 bg-red-50/50'
                    : tieneVencidos
                    ? 'border-red-300 bg-red-50'
                    : tieneAplazados
                    ? 'border-amber-300 bg-amber-50'
                    : pagosDia.length > 0
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-100'
                }`}
              >
                <div className={`font-semibold ${esHoy ? 'text-indigo-700' : esPasado ? 'text-slate-400' : 'text-slate-600'}`}>
                  {fecha.getDate()}
                </div>
                {pagosDia.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1 space-y-0.5 cursor-help">
                          {pagosDia.slice(0, 2).map((p, idx) => (
                            <div
                              key={idx}
                              className={`truncate text-[9px] px-1 py-0.5 rounded ${
                                p.estado === 'VENCIDO'
                                  ? 'bg-red-200 text-red-800'
                                  : p.esAplazada
                                  ? 'bg-amber-200 text-amber-800'
                                  : 'bg-emerald-200 text-emerald-800'
                              }`}
                            >
                              {p.cliente.nombre.split(' ')[0]} · {formatearMoneda(p.montoPendiente).replace('COP', '').trim()}
                            </div>
                          ))}
                          {pagosDia.length > 2 && (
                            <div className="text-[9px] text-slate-500 text-center">
                              +{pagosDia.length - 2} más
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          {pagosDia.map((p, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-semibold">{p.cliente.nombre}</span> —{' '}
                              {p.codigo} · Cuota {p.proximaCuota}
                              <br />
                              <span className="text-slate-500">
                                {formatearMoneda(p.montoPendiente)} · {p.estado}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300" /> Hoy
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Próximos
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Vencidos
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Aplazados (solo intereses)
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
