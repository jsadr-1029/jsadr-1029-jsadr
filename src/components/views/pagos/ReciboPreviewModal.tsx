'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Loader2, FileText, Download, Copy, Check, ShieldCheck, QrCode,
  Sparkles, Heart, TrendingUp, Star, Users, Send, MessageCircle,
  Award, CheckCircle2, Clock, Banknote, Phone, User, Hash, Calendar,
} from 'lucide-react'
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import { useToast } from '@/hooks/use-toast'

interface Props {
  abierto: boolean
  pagoId: string | null
  onCerrar: () => void
}

interface DatosRecibo {
  pago: {
    fecha: string
    estado: string
    cliente: any
    prestamo: any
    cuota: number
    montoCapital: number
    montoInteres: number
    montoMora: number
    montoTotal: number
    metodoPago: string
    referencia: string | null
    cuentaRecaudo: any
    esSoloIntereses: boolean
    notas: string | null
  }
  reciboHash: string
  reciboFechaEmision: string
  urlVerificacion: string
  cuotasPendientes: number
  totalCuotas: number
  cuotaActual: number
  esUltimaCuota: boolean
  saldoRestante: number
  porcentajeAvance: number
}

interface PlantillaFidelizacion {
  id: string
  titulo: string
  emoji: string
  asunto: string
  mensaje: string
}

const METODO_PAGO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia bancaria',
  CONSIGNACION: 'Consignación',
  PSE: 'PSE',
  DATÁFONO: 'Datáfono (tarjeta)',
  OTRO: 'Otro',
}

export function ReciboPreviewModal({ abierto, pagoId, onCerrar }: Props) {
  const [data, setData] = useState<DatosRecibo | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // === Estado para fidelización ===
  const [modalFidelizacion, setModalFidelizacion] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaFidelizacion[]>([])
  const [plantillaSel, setPlantillaSel] = useState<string>('')
  const [mensajeFidel, setMensajeFidel] = useState('')
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false)
  const [enviandoFidel, setEnviandoFidel] = useState(false)

  const reciboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (abierto && pagoId) {
      setLoading(true)
      setData(null)
      fetch('/api/pagos/recibo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setData(d.data)
        })
        .finally(() => setLoading(false))
    }
  }, [abierto, pagoId])

  // Resetear estado de fidelización al cerrar
  useEffect(() => {
    if (!abierto) {
      setModalFidelizacion(false)
      setPlantillas([])
      setPlantillaSel('')
      setMensajeFidel('')
    }
  }, [abierto])

  const copiarUrl = () => {
    if (!data) return
    navigator.clipboard.writeText(data.urlVerificacion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // === Imprimir recibo en ventana limpia ===
  // Abre una nueva ventana con SOLO el recibo (sin sidebar, sin header).
  // Esto soluciona el "texto corrido" que ocurría con window.print() del modal.
  const imprimir = () => {
    if (!data) return
    const html = generarHtmlImprimible(data)
    const ventana = window.open('', '_blank', 'width=820,height=1000')
    if (!ventana) {
      toast({
        title: 'Bloqueado',
        description: 'El navegador bloqueó la ventana emergente. Permite popups e intenta de nuevo.',
        variant: 'destructive',
      })
      return
    }
    ventana.document.open()
    ventana.document.write(html)
    ventana.document.close()
    // Esperar a que cargue el contenido antes de imprimir
    ventana.onload = () => {
      setTimeout(() => {
        ventana.focus()
        ventana.print()
      }, 350)
    }
    // Fallback por si onload no dispara
    setTimeout(() => {
      try {
        ventana.focus()
        ventana.print()
      } catch {}
    }, 800)
  }

  // === Abrir modal de fidelización ===
  const abrirFidelizacion = async () => {
    if (!pagoId) return
    setModalFidelizacion(true)
    setCargandoPlantillas(true)
    setPlantillas([])
    setPlantillaSel('')
    setMensajeFidel('')
    try {
      const res = await fetch('/api/pagos/recibo/fidelizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'generar_plantillas', pagoId }),
      })
      const json = await res.json()
      if (json.success) {
        setPlantillas(json.data.plantillas)
        // Seleccionar primera plantilla por defecto
        if (json.data.plantillas.length > 0) {
          setPlantillaSel(json.data.plantillas[0].id)
          setMensajeFidel(json.data.plantillas[0].mensaje)
        }
      } else {
        toast({
          title: 'No disponible',
          description: json.error || 'No se pueden generar plantillas',
          variant: 'destructive',
        })
        setModalFidelizacion(false)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
      setModalFidelizacion(false)
    } finally {
      setCargandoPlantillas(false)
    }
  }

  const seleccionarPlantilla = (id: string) => {
    setPlantillaSel(id)
    const p = plantillas.find((p) => p.id === id)
    if (p) setMensajeFidel(p.mensaje)
  }

  const enviarFidelizacion = async () => {
    if (!pagoId || !mensajeFidel.trim()) return
    if (mensajeFidel.trim().length < 5) {
      toast({
        title: 'Mensaje muy corto',
        description: 'Escribe al menos 5 caracteres',
        variant: 'destructive',
      })
      return
    }
    setEnviandoFidel(true)
    try {
      const res = await fetch('/api/pagos/recibo/fidelizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar',
          pagoId,
          mensaje: mensajeFidel,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: '✅ Mensaje enviado',
          description: `Se envió el mensaje a ${data?.pago.cliente?.nombre || 'el cliente'}`,
        })
        setModalFidelizacion(false)
      } else {
        toast({
          title: 'Error al enviar',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoFidel(false)
    }
  }

  // =====================================================
  // VISTA: LOADING
  // =====================================================
  if (loading) {
    return (
      <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="sm:max-w-[640px]">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
            <span className="text-slate-600">Generando recibo firmado...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!data) {
    return (
      <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="sm:max-w-[480px]">
          <div className="text-center text-slate-500 py-8">Sin datos del recibo</div>
        </DialogContent>
      </Dialog>
    )
  }

  const { pago } = data
  const nombreCliente = pago.cliente?.nombre || '—'
  const cedula = pago.cliente?.cedula || '—'
  const telefono = pago.cliente?.telefono || '—'
  const codigoPrestamo = pago.prestamo?.codigo || '—'
  const cuenta = pago.cuentaRecaudo

  // =====================================================
  // VISTA: RECIBO RE-DISEÑADO
  // =====================================================
  return (
    <>
      <Dialog open={abierto && !modalFidelizacion} onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-slate-800 text-lg">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div>Recibo de pago</div>
                <div className="text-xs font-normal text-slate-500">
                  {pago.estado === 'APLICADO' ? 'Pago aplicado · Comprobante oficial' : 'Pago parcial registrado'}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* === RECIBO VISUAL === */}
          <div ref={reciboRef} className="recibo-document">
            {/* Encabezado con marca de agua y branding */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-slate-100 shadow-sm bg-white">
              {/* Banda superior con gradiente */}
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 relative z-10" />

              {/* Marca de agua sutil — DEBAJO del contenido (z-0) */}
              <div className="absolute -right-12 top-8 text-[120px] font-black text-slate-50 select-none pointer-events-none rotate-[-15deg] leading-none z-0">
                JSADR
              </div>

              {/* Header institucional — DEBE ir encima (z-10) */}
              <div className="relative z-10 px-6 py-5 flex items-start justify-between border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md">
                    <span className="text-white font-black text-2xl tracking-tight">J</span>
                  </div>
                  <div>
                    <div className="text-xl font-black bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent leading-tight">
                      Jsadr · Jo*** Se*** Al*** D** R**
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Comprobante oficial de pago · Recibo firmado criptográficamente
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      NIT 901.234.567-8 · Calle 100 #50-25, Bogotá · www.jsadr.com.co
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span className="text-[10px] font-semibold text-emerald-700">VERIFICADO SHA-256</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Recibo N°</div>
                  <div className="text-xs font-mono font-semibold text-slate-700">
                    {data.reciboHash.slice(0, 12).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Cuerpo: Info del cliente + cuota */}
              <div className="px-6 py-5 grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Cliente
                  </div>
                  <div className="text-base font-bold text-slate-800">{nombreCliente}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span>CC: {cedula}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{telefono}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Detalles del solicitud
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Código:</span>
                      <span className="font-mono font-semibold text-slate-700">{codigoPrestamo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cuota:</span>
                      <span className="font-semibold text-slate-700">
                        #{pago.cuota} de {data.totalCuotas}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha pago:</span>
                      <span className="font-semibold text-slate-700">
                        {formatearFechaHora(pago.fecha)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Método:</span>
                      <span className="font-semibold text-slate-700">
                        {METODO_PAGO_LABEL[pago.metodoPago] || pago.metodoPago}
                      </span>
                    </div>
                    {pago.referencia && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Referencia:</span>
                        <span className="font-mono text-slate-700 text-[11px]">{pago.referencia}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Estado de avance del solicitud */}
              <div className="mx-6 mb-4 p-3 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
                    <Award className="w-3 h-3 text-amber-500" />
                    Avance del solicitud
                  </div>
                  <div className="text-xs font-bold text-slate-700">{data.porcentajeAvance}%</div>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                    style={{ width: `${data.porcentajeAvance}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="font-semibold">{data.cuotaActual} cuota(s) pagada(s)</span>
                  </div>
                  {data.cuotasPendientes > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-700">
                      <Clock className="w-3 h-3" />
                      <span className="font-semibold">
                        {data.cuotasPendientes} cuota(s) pendiente(s)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="font-bold">Solicitud cancelado ✓</span>
                    </div>
                  )}
                </div>
              </div>

              {/* === Banner SOLO INTERESES si aplica === */}
              {pago.esSoloIntereses && (
                <div className="mx-6 mb-3 p-2.5 rounded-lg bg-amber-50 border-2 border-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold text-amber-800">Pago de solo intereses</div>
                    <div className="text-amber-700">El capital de esta cuota fue aplazado a una próxima fecha</div>
                  </div>
                </div>
              )}

              {/* === Desglose financiero === */}
              <div className="px-6 pb-4">
                <div className="rounded-xl border-2 border-slate-100 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    Desglose del pago
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pago.montoCapital > 0 && (
                      <FilaMonto label="Capital abonado" valor={pago.montoCapital} icon={<Banknote className="w-3.5 h-3.5 text-emerald-600" />} />
                    )}
                    <FilaMonto label="Interés" valor={pago.montoInteres} icon={<TrendingUp className="w-3.5 h-3.5 text-blue-600" />} />
                    {pago.montoMora > 0 && (
                      <FilaMonto label="Mora cobrada" valor={pago.montoMora} icon={<Clock className="w-3.5 h-3.5 text-red-500" />} />
                    )}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 flex items-center justify-between border-t-2 border-emerald-200">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold text-slate-800">TOTAL PAGADO</span>
                      </div>
                      <span className="text-2xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        {formatearMoneda(pago.montoTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* === Cuenta de recaudo (si aplica) === */}
              {cuenta && (
                <div className="mx-6 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">
                    Cuenta de recaudo
                  </div>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <div><strong>{cuenta.banco}</strong> · {cuenta.tipoCuenta}</div>
                    <div className="font-mono">N° {cuenta.numeroCuenta}</div>
                    <div className="text-slate-500">Titular: {cuenta.titular}</div>
                  </div>
                </div>
              )}

              {/* === Footer con QR + hash + verificación === */}
              <div className="px-6 pb-5 pt-3 border-t-2 border-dashed border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  {/* QR visual (placeholder con icon) */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        Verificación criptográfica
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2">
                      <p className="text-[9px] text-slate-500 mb-1">
                        Escanea o visita la URL pública para validar:
                      </p>
                      <code className="text-[8px] text-slate-700 break-all leading-tight font-mono">
                        {data.reciboHash}
                      </code>
                    </div>
                  </div>
                  {/* Datos de emisión */}
                  <div className="text-[10px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha emisión:</span>
                      <span className="font-semibold text-slate-700">
                        {formatearFechaHora(data.reciboFechaEmision)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estado:</span>
                      <span className="font-semibold text-emerald-700">VÁLIDO</span>
                    </div>
                    <div className="pt-1 mt-1 border-t border-slate-200">
                      <div className="text-slate-400 italic mb-1">URL pública:</div>
                      <div className="flex items-center gap-1">
                        <code className="flex-1 text-[9px] text-indigo-600 bg-indigo-50 p-1 rounded truncate">
                          {data.urlVerificacion}
                        </code>
                        <Button size="sm" variant="outline" onClick={copiarUrl} className="h-7 px-2 flex-shrink-0">
                          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firma institucional */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                  <div>Este recibo es un documento electrónico firmado. Cualquier alteración invalida su autenticidad.</div>
                  <div className="font-mono">v4.1 · Jsadr · Jo*** Se*** Al*** D** R**</div>
                </div>
              </div>

              {/* Banda inferior */}
              <div className="h-1.5 bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500" />
            </div>
          </div>

          {/* === Acciones del recibo === */}
          <div className="space-y-2">
            {/* Banner de última cuota + botón de fidelización */}
            {data.esUltimaCuota && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-violet-50 via-pink-50 to-rose-50 border-2 border-violet-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-violet-800">¡Es la última cuota! 🎉</div>
                    <div className="text-[11px] text-violet-700">
                      Fideliza al cliente con un mensaje de agradecimiento o renovación
                    </div>
                  </div>
                </div>
                <Button
                  onClick={abrirFidelizacion}
                  className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" />
                  Enviar mensaje
                </Button>
              </div>
            )}

            <DialogFooter className="sm:justify-between gap-2">
              <Button variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
              <Button
                onClick={imprimir}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Imprimir / Guardar PDF
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          MODAL SECUNDARIO: MENSAJE DE FIDELIZACIÓN
          ===================================================== */}
      <Dialog open={modalFidelizacion} onOpenChange={(v) => !v && setModalFidelizacion(false)}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              Mensaje de fidelización
            </DialogTitle>
          </DialogHeader>

          {cargandoPlantillas ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500 mr-2" />
              <span className="text-slate-500">Cargando plantillas...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
                <div className="font-bold mb-0.5">Cliente: {nombreCliente}</div>
                <div>Teléfono: {telefono}</div>
              </div>

              {/* Selector de plantillas */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500">
                  Elige una plantilla
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {plantillas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => seleccionarPlantilla(p.id)}
                      className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                        plantillaSel === p.id
                          ? 'border-violet-500 bg-violet-50 shadow-sm'
                          : 'border-slate-200 hover:border-violet-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base">{p.emoji}</span>
                        <span className="text-xs font-bold text-slate-700">{p.titulo}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{p.asunto}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje editable */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500">
                  Mensaje (editable)
                </Label>
                <Textarea
                  value={mensajeFidel}
                  onChange={(e) => setMensajeFidel(e.target.value)}
                  rows={8}
                  className="text-sm"
                  placeholder="Escribe el mensaje para el cliente..."
                />
                <div className="text-[10px] text-slate-500 text-right">
                  {mensajeFidel.length} caracteres
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setModalFidelizacion(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={enviarFidelizacion}
                  disabled={!mensajeFidel.trim() || enviandoFidel}
                  className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white"
                >
                  {enviandoFidel ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar por WhatsApp
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// =====================================================
// Componente auxiliar: Fila de monto con icono
// =====================================================
function FilaMonto({ label, valor, icon }: { label: string; valor: number; icon: React.ReactNode }) {
  return (
    <div className="px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-800">{formatearMoneda(valor)}</span>
    </div>
  )
}

// =====================================================
// HTML imprimible — abre en ventana limpia sin sidebar
// Esto soluciona el "texto corrido" que generaba window.print()
// del modal (que arrastraba sidebar y header).
// =====================================================
function generarHtmlImprimible(data: DatosRecibo): string {
  const { pago, reciboHash, reciboFechaEmision, urlVerificacion } = data
  const cliente = pago.cliente || {}
  const prestamo = pago.prestamo || {}
  const cuenta = pago.cuentaRecaudo

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de pago · ${prestamo.codigo || ''} · Cuota ${pago.cuota}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .recibo {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.08);
      border: 2px solid #f1f5f9;
      position: relative;
    }
    .banda-sup { height: 8px; background: linear-gradient(90deg, #10b981, #14b8a6, #0891b2); }
    .banda-inf { height: 6px; background: linear-gradient(90deg, #0891b2, #14b8a6, #10b981); }
    .marca {
      position: absolute; right: -30px; top: 30px;
      font-size: 130px; font-weight: 900; color: #f8fafc;
      transform: rotate(-15deg); pointer-events: none; line-height: 1;
      letter-spacing: -8px;
      z-index: 0; /* Marca de agua DEBAJO del contenido */
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 24px; border-bottom: 1px solid #f1f5f9;
      position: relative; z-index: 1; /* Contenido por ENCIMA de la marca */
    }
    .brand { display: flex; align-items: flex-start; gap: 12px; }
    .logo {
      width: 56px; height: 56px; border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #9333ea, #ec4899);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 900; font-size: 28px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .brand-text .nombre {
      font-size: 20px; font-weight: 900;
      background: linear-gradient(90deg, #4338ca, #7e22ce);
      -webkit-background-clip: text; background-clip: text;
      color: transparent; line-height: 1.2;
    }
    .brand-text .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .brand-text .sub2 { font-size: 10px; color: #94a3b8; margin-top: 1px; }
    .header-right { text-align: right; }
    .verif-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 8px; background: #ecfdf5; border: 1px solid #a7f3d0;
      border-radius: 6px; font-size: 10px; font-weight: 700; color: #047857;
    }
    .recibo-num-label { font-size: 10px; color: #64748b; margin-top: 6px; }
    .recibo-num { font-size: 12px; font-family: monospace; font-weight: 700; color: #334155; }

    .body { padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; position: relative; z-index: 1; }
    .col-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
    .cliente-nombre { font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
    .detalle { display: flex; gap: 8px; font-size: 12px; color: #475569; margin-top: 4px; align-items: center; }
    .detalle strong { color: #334155; font-weight: 600; }

    .avance {
      margin: 0 24px 16px; padding: 12px; border-radius: 10px;
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      border: 1px solid #e2e8f0;
      position: relative; z-index: 1;
    }
    .avance-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .avance-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; }
    .avance-pct { font-size: 12px; font-weight: 700; color: #334155; }
    .avance-bar { height: 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; overflow: hidden; }
    .avance-fill { height: 100%; background: linear-gradient(90deg, #34d399, #14b8a6); }
    .avance-foot { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; }
    .avance-pag { color: #047857; font-weight: 600; }
    .avance-pend { color: #b45309; font-weight: 600; }

    .solo-int {
      margin: 0 24px 12px; padding: 10px; border-radius: 8px;
      background: #fffbeb; border: 2px solid #fcd34d;
      position: relative; z-index: 1;
    }
    .solo-int strong { color: #92400e; font-size: 12px; }
    .solo-int div { color: #b45309; font-size: 11px; margin-top: 2px; }

    .desglose {
      margin: 0 24px 16px; border: 2px solid #f1f5f9; border-radius: 12px; overflow: hidden;
      position: relative; z-index: 1;
    }
    .desglose-head {
      padding: 8px 16px; background: #f8fafc;
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0;
    }
    .desglose-row {
      padding: 10px 16px; display: flex; justify-content: space-between;
      border-bottom: 1px solid #f1f5f9; font-size: 13px;
    }
    .desglose-row .lbl { color: #475569; }
    .desglose-row .val { font-weight: 600; color: #1e293b; }
    .desglose-total {
      padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;
      background: linear-gradient(90deg, #ecfdf5, #f0fdfa);
      border-top: 2px solid #a7f3d0;
    }
    .desglose-total .lbl { font-weight: 700; color: #1e293b; font-size: 14px; }
    .desglose-total .val {
      font-size: 26px; font-weight: 900;
      background: linear-gradient(90deg, #059669, #0d9488);
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
    }

    .cuenta {
      margin: 0 24px 16px; padding: 12px; border-radius: 8px;
      background: #eff6ff; border: 1px solid #bfdbfe;
      position: relative; z-index: 1;
    }
    .cuenta-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; font-weight: 700; margin-bottom: 4px; }
    .cuenta-row { font-size: 12px; color: #334155; }
    .cuenta-row strong { color: #1e293b; }
    .cuenta-row.mono { font-family: monospace; }

    .footer {
      padding: 16px 24px 20px; border-top: 2px dashed #cbd5e1;
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
      position: relative; z-index: 1;
    }
    .foot-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .foot-hash {
      font-family: monospace; font-size: 9px; color: #475569;
      background: #f8fafc; padding: 6px; border-radius: 4px;
      border: 1px solid #e2e8f0; word-break: break-all; line-height: 1.4;
    }
    .foot-row { display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px; }
    .foot-row .lbl { color: #64748b; }
    .foot-row .val { color: #334155; font-weight: 600; }

    .firma {
      padding: 12px 24px; border-top: 1px solid #f1f5f9;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9px; color: #94a3b8;
      position: relative; z-index: 1;
    }
  </style>
</head>
<body>
  <div class="recibo">
    <div class="banda-sup"></div>
    <div class="marca">JSADR</div>

    <div class="header">
      <div class="brand">
        <div class="logo">J</div>
        <div class="brand-text">
          <div class="nombre">Jsadr · Jo*** Se*** Al*** D** R**</div>
          <div class="sub">Comprobante oficial de pago · Recibo firmado criptográficamente</div>
          <div class="sub2">NIT 901.234.567-8 · Calle 100 #50-25, Bogotá · www.jsadr.com.co</div>
        </div>
      </div>
      <div class="header-right">
        <div class="verif-badge">✓ VERIFICADO SHA-256</div>
        <div class="recibo-num-label">Recibo N°</div>
        <div class="recibo-num">${(reciboHash || '').slice(0, 12).toUpperCase()}</div>
      </div>
    </div>

    <div class="body">
      <div>
        <div class="col-title">Cliente</div>
        <div class="cliente-nombre">${cliente.nombre || '—'}</div>
        <div class="detalle"><strong>CC:</strong> ${cliente.cedula || '—'}</div>
        <div class="detalle"><strong>Tel:</strong> ${cliente.telefono || '—'}</div>
      </div>
      <div>
        <div class="col-title">Detalles del solicitud</div>
        <div class="detalle"><strong>Código:</strong> <span style="font-family:monospace">${prestamo.codigo || '—'}</span></div>
        <div class="detalle"><strong>Cuota:</strong> #${pago.cuota} de ${data.totalCuotas}</div>
        <div class="detalle"><strong>Fecha pago:</strong> ${formatearFechaHora(pago.fecha)}</div>
        <div class="detalle"><strong>Método:</strong> ${METODO_PAGO_LABEL[pago.metodoPago] || pago.metodoPago}</div>
        ${pago.referencia ? `<div class="detalle"><strong>Ref:</strong> <span style="font-family:monospace;font-size:11px">${pago.referencia}</span></div>` : ''}
      </div>
    </div>

    <div class="avance">
      <div class="avance-head">
        <div class="avance-title">★ Avance del solicitud</div>
        <div class="avance-pct">${data.porcentajeAvance}%</div>
      </div>
      <div class="avance-bar"><div class="avance-fill" style="width: ${data.porcentajeAvance}%"></div></div>
      <div class="avance-foot">
        <div class="avance-pag">✓ ${data.cuotaActual} cuota(s) pagada(s)</div>
        ${data.cuotasPendientes > 0
          ? `<div class="avance-pend">⏰ ${data.cuotasPendientes} cuota(s) pendiente(s)</div>`
          : `<div class="avance-pag">✓ Solicitud cancelado</div>`}
      </div>
    </div>

    ${pago.esSoloIntereses ? `
    <div class="solo-int">
      <strong>✦ Pago de solo intereses</strong>
      <div>El capital de esta cuota fue aplazado a una próxima fecha</div>
    </div>` : ''}

    <div class="desglose">
      <div class="desglose-head">Desglose del pago</div>
      ${pago.montoCapital > 0 ? `<div class="desglose-row"><span class="lbl">Capital abonado</span><span class="val">${formatearMoneda(pago.montoCapital)}</span></div>` : ''}
      <div class="desglose-row"><span class="lbl">Interés</span><span class="val">${formatearMoneda(pago.montoInteres)}</span></div>
      ${pago.montoMora > 0 ? `<div class="desglose-row"><span class="lbl">Mora cobrada</span><span class="val">${formatearMoneda(pago.montoMora)}</span></div>` : ''}
      <div class="desglose-total">
        <span class="lbl">★ TOTAL PAGADO</span>
        <span class="val">${formatearMoneda(pago.montoTotal)}</span>
      </div>
    </div>

    ${cuenta ? `
    <div class="cuenta">
      <div class="cuenta-title">Cuenta de recaudo</div>
      <div class="cuenta-row"><strong>${cuenta.banco}</strong> · ${cuenta.tipoCuenta}</div>
      <div class="cuenta-row mono">N° ${cuenta.numeroCuenta}</div>
      <div class="cuenta-row" style="color:#64748b">Titular: ${cuenta.titular}</div>
    </div>` : ''}

    <div class="footer">
      <div>
        <div class="foot-title">▣ Verificación criptográfica</div>
        <div class="foot-hash">${reciboHash}</div>
      </div>
      <div>
        <div class="foot-title">Datos de emisión</div>
        <div class="foot-row"><span class="lbl">Fecha emisión:</span><span class="val">${formatearFechaHora(reciboFechaEmision)}</span></div>
        <div class="foot-row"><span class="lbl">Estado:</span><span class="val" style="color:#047857">VÁLIDO</span></div>
        <div class="foot-row"><span class="lbl">URL pública:</span><span class="val" style="font-size:9px;font-family:monospace;color:#4f46e5">${urlVerificacion}</span></div>
      </div>
    </div>

    <div class="firma">
      <div>Este recibo es un documento electrónico firmado. Cualquier alteración invalida su autenticidad.</div>
      <div style="font-family:monospace">v4.1 · Jsadr · Jo*** Se*** Al*** D** R**</div>
    </div>

    <div class="banda-inf"></div>
  </div>
</body>
</html>`
}
