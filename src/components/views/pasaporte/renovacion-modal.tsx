'use client'

// =====================================================
// Modal de Renovación
// =====================================================

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sparkles, Info, Calculator, AlertCircle } from 'lucide-react'
import { formatCOP } from '@/lib/format'
import { toast } from 'sonner'

export function RenovacionModal({
  token,
  valorActual,
  onClose,
}: {
  token: string
  valorActual: number
  onClose: () => void
}) {
  const [opcion, setOpcion] = useState<string>('')
  const [nuevoValor, setNuevoValor] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSimular = async () => {
    if (opcion === 'VALOR_DIFERENTE' || opcion === 'NUEVA_SOLICITUD') {
      if (!nuevoValor || parseFloat(nuevoValor) <= 0) {
        toast.error('Ingresa un valor válido')
        return
      }
    }

    setLoading(true)
    try {
      // Llamar a la API de simulación existente
      const valor = opcion === 'MISMO_VALOR' ? valorActual : parseFloat(nuevoValor)
      const res = await fetch('/api/portal/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-token': token },
        body: JSON.stringify({
          monto: valor,
          plazoMeses: 3,
          frecuencia: 'MENSUAL',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResultado({ ...data, valorSolicitado: valor })
      } else {
        toast.error(data.error || 'No se pudo simular')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al simular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-2">Explorar renovación</h3>
          <p className="text-sm text-slate-500">
            ¿Quieres continuar tu trayectoria? Elige una opción para simular.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Valor actual:</span>
            <span className="font-bold text-slate-900">{formatCOP(valorActual)}</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <Label>Opciones disponibles</Label>
          <RadioGroup value={opcion} onValueChange={setOpcion}>
            <div className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-all ${opcion === 'MISMO_VALOR' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <RadioGroupItem value="MISMO_VALOR" id="op-mismo" className="mt-0.5" />
              <Label htmlFor="op-mismo" className="text-sm font-normal cursor-pointer flex-1">
                <span className="font-medium">🔄 Mantener un valor similar</span>
                <p className="text-xs text-slate-500 mt-0.5">Solicitar {formatCOP(valorActual)}</p>
              </Label>
            </div>
            <div className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-all ${opcion === 'VALOR_DIFERENTE' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <RadioGroupItem value="VALOR_DIFERENTE" id="op-diferente" className="mt-0.5" />
              <Label htmlFor="op-diferente" className="text-sm font-normal cursor-pointer flex-1">
                <span className="font-medium">📈 Solicitar un valor diferente</span>
                <p className="text-xs text-slate-500 mt-0.5">Mayor o menor que el actual</p>
              </Label>
            </div>
            <div className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-all ${opcion === 'NUEVA_SOLICITUD' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <RadioGroupItem value="NUEVA_SOLICITUD" id="op-nueva" className="mt-0.5" />
              <Label htmlFor="op-nueva" className="text-sm font-normal cursor-pointer flex-1">
                <span className="font-medium">💰 Nueva solicitud independiente</span>
                <p className="text-xs text-slate-500 mt-0.5">Inicia un crédito nuevo</p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {(opcion === 'VALOR_DIFERENTE' || opcion === 'NUEVA_SOLICITUD') && (
          <div className="mb-4">
            <Label>Nuevo valor solicitado</Label>
            <Input
              type="number"
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
              placeholder="Ingresa el monto en COP"
              min={1}
              step="any"
            />
          </div>
        )}

        {opcion && !resultado && (
          <Button className="w-full" onClick={handleSimular} disabled={loading}>
            <Calculator className="w-4 h-4 mr-1" />
            {loading ? 'Simulando...' : 'Simular'}
          </Button>
        )}

        {resultado && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-900 mb-2">Resultado de simulación</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-emerald-700">Valor solicitado</p>
                  <p className="font-bold text-emerald-900">{formatCOP(resultado.valorSolicitado)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Cuota estimada</p>
                  <p className="font-bold text-emerald-900">{formatCOP(resultado.simulacion?.montoCuota || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Número de cuotas</p>
                  <p className="font-bold text-emerald-900">{resultado.simulacion?.numeroCuotas || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Total a pagar</p>
                  <p className="font-bold text-emerald-900">{formatCOP(resultado.simulacion?.totalPagar || 0)}</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-800 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Esta información es estimativa. La nueva solicitud está sujeta a evaluación, aprobación y condiciones vigentes.
                </span>
              </p>
            </div>

            <Button className="w-full" variant="outline" onClick={() => setResultado(null)}>
              Volver a simular
            </Button>
          </div>
        )}

        <div className="mt-4 p-2 rounded-lg bg-slate-50">
          <p className="text-[11px] text-slate-600 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              Una simulación no modifica el crédito real. Toda nueva operación está sujeta a evaluación, aprobación y condiciones vigentes.
            </span>
          </p>
        </div>

        <Button type="button" variant="ghost" className="w-full mt-2" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
