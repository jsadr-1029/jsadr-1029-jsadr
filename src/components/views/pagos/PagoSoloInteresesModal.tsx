'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Sparkles, Info, CalendarClock, DollarSign, TrendingUp,
} from 'lucide-react'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import { useToast } from '@/hooks/use-toast'

interface ProximoPago {
  prestamoId: string
  codigo: string
  cliente: { nombre: string; cedula: string; telefono: string }
  proximaCuota: number
  totalCuotas: number
  frecuencia: string
  fechaVencimiento: string
  diasMora: number
  cuotaBase: number
  capitalCuota: number
  interesCuota: number
  montoPendiente: number
  estado: string
  esAplazada?: boolean
}

interface Props {
  abierto: boolean
  pago: ProximoPago | null
  onCerrar: () => void
  onAplicado: () => void
}

export function PagoSoloInteresesModal({ abierto, pago, onCerrar, onAplicado }: Props) {
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ nuevaFecha?: string; fechaOriginal?: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (pago) {
      // Pre-llenar el monto con los intereses de la cuota
      setMonto(pago.interesCuota.toString())
      setMetodo('EFECTIVO')
      setReferencia('')
      setObservacion('')
      setError('')
      setInfo(null)
    }
  }, [pago])

  if (!pago) return null

  const interesPendiente = pago.interesCuota
  const montoNum = parseFloat(monto) || 0
  const montoSuficiente = montoNum >= interesPendiente

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!montoSuficiente) {
      setError(`El monto debe cubrir al menos los intereses: ${formatearMoneda(interesPendiente)}`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'solo_intereses',
          prestamoId: pago.prestamoId,
          montoTotal: montoNum,
          metodoPago: metodo,
          referencia,
          observacion,
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data.error || 'Error al aplicar pago de solo intereses')
        return
      }
      setInfo({
        nuevaFecha: data.nuevaFechaVencimiento,
        fechaOriginal: data.fechaOriginalVencimiento,
      })
      toast({
        title: 'Pago de solo intereses aplicado',
        description: `Cuota ${pago.proximaCuota} aplazada al ${formatearFecha(data.nuevaFechaVencimiento)}.`,
      })
      setTimeout(() => {
        onCerrar()
        onAplicado()
      }, 2500)
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // Calcular fecha nueva estimada para preview
  const fechaOriginal = new Date(pago.fechaVencimiento)
  const fechaNuevaEstimada = new Date(fechaOriginal)
  if (pago.frecuencia === 'MENSUAL') fechaNuevaEstimada.setMonth(fechaNuevaEstimada.getMonth() + 1)
  else if (pago.frecuencia === 'QUINCENAL') fechaNuevaEstimada.setDate(fechaNuevaEstimada.getDate() + 15)
  else if (pago.frecuencia === 'SEMANAL') fechaNuevaEstimada.setDate(fechaNuevaEstimada.getDate() + 7)

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Pago de Solo Intereses
          </DialogTitle>
        </DialogHeader>

        {info ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <TrendingUp className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">¡Pago aplicado!</h3>
            <p className="text-sm text-slate-500">
              Los intereses de la cuota {pago.proximaCuota} fueron pagados.
              El capital fue aplazado y la cuota se corrió al{' '}
              <span className="font-semibold text-slate-700">
                {formatearFecha(info.nuevaFecha || fechaNuevaEstimada)}
              </span>.
            </p>
            <p className="text-xs text-slate-400">
              El cliente no entrará en mora mientras tanto.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* Info del pago */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-semibold text-slate-800">{pago.cliente.nombre}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Solicitud:</span>
                <span className="font-mono text-xs text-slate-700">{pago.codigo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cuota:</span>
                <Badge variant="outline" className="font-mono">
                  {pago.proximaCuota} / {pago.totalCuotas}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vencimiento:</span>
                <span className="text-slate-700">{formatearFecha(pago.fechaVencimiento)}</span>
              </div>
            </div>

            {/* Desglose */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-[11px] text-amber-700 font-medium uppercase tracking-wider">Interés a pagar</div>
                <div className="text-lg font-bold text-amber-800">{formatearMoneda(interesPendiente)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] text-slate-600 font-medium uppercase tracking-wider">Capital (se difiere)</div>
                <div className="text-lg font-bold text-slate-700">{formatearMoneda(pago.capitalCuota)}</div>
              </div>
            </div>

            {/* Preview de aplazamiento */}
            <Alert className="bg-indigo-50 border-indigo-200">
              <CalendarClock className="w-4 h-4 text-indigo-600" />
              <AlertDescription className="text-indigo-800 text-xs">
                <strong>Cómo funciona:</strong> Al pagar solo los intereses, esta cuota se
                <strong> corre al {formatearFecha(fechaNuevaEstimada)}</strong> ({pago.frecuencia.toLowerCase()} siguiente).
                El capital quedará pendiente para esa nueva fecha. Mientras tanto,
                <strong> no se generará mora</strong> sobre esta cuota.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="monto" className="text-slate-700 text-sm">
                  Monto recibido
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="monto"
                    type="number"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
                {!montoSuficiente && monto && (
                  <p className="text-[11px] text-red-600 mt-1">
                    Faltan {formatearMoneda(interesPendiente - montoNum)} para cubrir los intereses.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="metodo" className="text-slate-700 text-sm">Método</Label>
                  <select
                    id="metodo"
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm"
                    disabled={loading}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="BANCOLOMBIA_BOTON">Bancolombia</option>
                    <option value="PSE">PSE</option>
                    <option value="NEQUI">Nequi</option>
                    <option value="DAVIPLATA">Daviplata</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="referencia" className="text-slate-700 text-sm">Referencia</Label>
                  <Input
                    id="referencia"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Opcional"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacion" className="text-slate-700 text-sm">
                  Observación (opcional)
                </Label>
                <Textarea
                  id="observacion"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Ej: Cliente solicita aplazar capital por gastos imprevistos."
                  className="text-sm"
                  rows={2}
                  disabled={loading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar} disabled={loading}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !montoSuficiente}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Aplicar y aplazar cuota
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
