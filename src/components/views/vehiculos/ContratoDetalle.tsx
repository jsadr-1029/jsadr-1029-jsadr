'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, CheckCircle, XCircle, AlertTriangle, FileText, Zap, Download, PenTool, Smartphone, Mail, Send } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, formatDateTime, EstadoBadge, ESTADOS_PAGO } from './helpers'
import { useState } from 'react'

export function ContratoDetalle({ contrato, onChanged }: { contrato: any; onChanged?: () => void }) {
  const { toast } = useToast()
  const [pagoModal, setPagoModal] = useState<any | null>(null)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [notasAdmin, setNotasAdmin] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [recalcMoraLoading, setRecalcMoraLoading] = useState(false)
  const [fotoComprobante, setFotoComprobante] = useState<string | null>(null)
  const [generandoContrato, setGenerandoContrato] = useState(false)
  const [enviandoNotificacion, setEnviandoNotificacion] = useState(false)

  // === Obtener o crear documento legal (no falla si ya existe) ===
  const obtenerOcrearDocumentoLegal = async (): Promise<{ token: string; numeroContrato: string } | null> => {
    // Primero verificar si ya existe un documento legal (GET)
    const rGet = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
      method: 'GET',
    })
    if (rGet.success && rGet.data && Array.isArray(rGet.data) && rGet.data.length > 0) {
      const doc = rGet.data[0]
      const token = doc.conductorToken || doc.propietarioToken
      if (token) return { token, numeroContrato: doc.numeroContrato }
    }
    // Si no existe, generar uno nuevo (POST)
    const rPost = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (rPost.success) {
      const link = rPost.data?.linkFirmaConductor || ''
      const token = link.split('/').pop() || rPost.data?.conductorToken
      if (token) return { token, numeroContrato: rPost.data?.numeroContrato || '' }
    }
    return null
  }

  // === Generar contrato legal con firma electrónica ===
  const generarContratoLegal = async () => {
    setGenerandoContrato(true)
    try {
      const doc = await obtenerOcrearDocumentoLegal()
      if (doc) {
        toast({
          title: 'Contrato legal listo',
          description: `Contrato ${doc.numeroContrato}. Usa los botones de WhatsApp o Email para enviar el enlace al conductor.`,
        })
        onChanged?.()
      } else {
        toast({ title: 'Error', description: 'No se pudo generar el contrato legal', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setGenerandoContrato(false)
  }

  // === Enviar enlace de firma por WhatsApp al conductor ===
  const enviarFirmaWhatsApp = async () => {
    setEnviandoNotificacion(true)
    try {
      const doc = await obtenerOcrearDocumentoLegal()
      if (!doc) {
        toast({ title: 'Error', description: 'No se pudo obtener el enlace de firma', variant: 'destructive' })
        setEnviandoNotificacion(false)
        return
      }
      const linkFirma = `${window.location.origin}/firma-contrato-vehiculo/${doc.token}`
      const telefono = conductor?.telefono || ''
      const nombre = conductor?.nombre || ''
      if (!telefono) {
        toast({ title: 'Error', description: 'El conductor no tiene teléfono registrado', variant: 'destructive' })
        setEnviandoNotificacion(false)
        return
      }

      // Generar mensaje de WhatsApp
      const mensaje = `🔐 *CONTRATO DE ARRENDAMIENTO DE VEHÍCULO - FIRMA ELECTRÓNICA*

Hola *${nombre}*,

Se ha generado un contrato de arrendamiento de vehículo a su nombre.

📄 *Contrato:* ${doc.numeroContrato}
🚗 *Vehículo:* ${vehiculo?.marca} ${vehiculo?.modelo} - Placa ${vehiculo?.placa}
💰 *Tarifa:* ${formatCOP(contrato.tarifa)} / ${contrato.modalidadPago}
📅 *Inicio:* ${formatDate(contrato.fechaInicio)}
📅 *Fin:* ${formatDate(contrato.fechaFin) || 'Indefinido'}

Para completar la firma electrónica del contrato, ingresa al siguiente enlace:
${linkFirma}

⏰ El enlace expira en 7 días.
⚠️ No compartas este enlace con nadie.

Saludos,
Sistema de Gestión de Vehículos - Jsadr`

      // Abrir WhatsApp con el mensaje pre-llenado
      const telefonoLimpio = telefono.replace(/\D/g, '')
      const waUrl = `https://wa.me/57${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`
      window.open(waUrl, '_blank')

      toast({
        title: 'WhatsApp abierto',
        description: `Se abrió WhatsApp con el mensaje para ${nombre} (${telefono}). Presiona enviar para completar el envío.`,
        duration: 8000,
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setEnviandoNotificacion(false)
  }

  // === Enviar enlace de firma por Email al conductor ===
  const enviarFirmaEmail = async () => {
    setEnviandoNotificacion(true)
    try {
      const doc = await obtenerOcrearDocumentoLegal()
      if (!doc) {
        toast({ title: 'Error', description: 'No se pudo obtener el enlace de firma', variant: 'destructive' })
        setEnviandoNotificacion(false)
        return
      }
      const email = conductor?.email || ''
      const nombre = conductor?.nombre || ''
      if (!email) {
        toast({ title: 'Error', description: 'El conductor no tiene email registrado', variant: 'destructive' })
        setEnviandoNotificacion(false)
        return
      }

      // Llamar al endpoint para enviar email
      const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
        method: 'POST',
        body: JSON.stringify({
          reenviar: true,
          canal: 'EMAIL',
        }),
      })

      if (r.success || r.data) {
        toast({
          title: 'Email enviado',
          description: `Se envió el enlace de firma al correo ${email}`,
        })
      } else {
        // Si el endpoint no soporta reenvío, abrir mailto como fallback
        const linkFirma = `${window.location.origin}/firma-contrato-vehiculo/${doc.token}`
        const asunto = `Contrato de Arrendamiento ${doc.numeroContrato} - Firma Electrónica`
        const cuerpo = `Estimado/a ${nombre},\n\nSe ha generado un contrato de arrendamiento de vehículo a su nombre.\n\nContrato: ${doc.numeroContrato}\nVehículo: ${vehiculo?.marca} ${vehiculo?.modelo} - Placa ${vehiculo?.placa}\n\nPara firmar electrónicamente, ingresa al siguiente enlace:\n${linkFirma}\n\nEl enlace expira en 7 días.\n\nSaludos,\nSistema de Gestión de Vehículos - Jsadr`
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
        window.open(mailtoUrl, '_blank')
        toast({
          title: 'Email preparado',
          description: `Se abrió tu cliente de correo para ${email}. Presiona enviar.`,
          duration: 8000,
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setEnviandoNotificacion(false)
  }

  // === Descargar PDF de entrega del vehículo ===
  const descargarPDFEntrega = async (tipo: string) => {
    try {
      let token: string | null = null
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try { token = JSON.parse(userStr).token || JSON.parse(userStr).accessToken } catch {}
      }
      const res = await fetch(`/api/vehiculos/vehiculos/${contrato.vehiculoId}/pdf-entrega?tipo=${tipo}&contratoId=${contrato.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        toast({ title: 'Error al generar PDF', description: err.error, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo === 'completo' ? 'Ficha_Completa' : 'Inventario'}_${contrato.vehiculo?.placa || 'vehiculo'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'PDF descargado' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Descargar contrato legal (CAV-001) ===
  const [contratoToken, setContratoToken] = useState<string | null>(null)
  const [vistaPreviaOpen, setVistaPreviaOpen] = useState(false)

  const obtenerTokenContrato = async (): Promise<string | null> => {
    // Primero verificar si ya existe un documento legal
    const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
      method: 'GET',
    })
    if (r.success && r.data && r.data.length > 0) {
      const doc = r.data[0]
      const token = doc.conductorToken || doc.propietarioToken
      if (token) return token
    }
    // Si no existe, generar uno nuevo
    const rGen = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (rGen.success) {
      toast({ title: 'Contrato generado', description: 'Se ha creado el contrato legal.' })
      // Extraer token del linkFirmaConductor
      const link = rGen.data?.linkFirmaConductor || ''
      const token = link.split('/').pop() || null
      return token
    } else {
      toast({ title: 'Error', description: rGen.error, variant: 'destructive' })
      return null
    }
  }

  const descargarContratoLegal = async () => {
    const token = await obtenerTokenContrato()
    if (token) {
      // Descargar directamente
      const link = document.createElement('a')
      link.href = `/api/vehiculos/contrato-legal/descargar?token=${token}`
      link.download = `Contrato_${contrato.numeroContrato}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const verVistaPrevia = async () => {
    const token = await obtenerTokenContrato()
    if (token) {
      setContratoToken(token)
      setVistaPreviaOpen(true)
    }
  }

  if (!contrato) return null

  const totales = contrato.totales || {}
  const vehiculo = contrato.vehiculo
  const conductor = contrato.conductor

  const abrirPago = (p: any) => {
    setPagoModal(p)
    setMontoAprobado(p.monto.toString())
    setNotasAdmin('')
    setMotivoRechazo('')
    setFotoComprobante(null)
    // Cargar comprobante si existe
    if (p.comprobanteUrl) {
      setFotoComprobante(p.comprobanteUrl)
    } else if (p.comprobantes && p.comprobantes.length > 0) {
      setFotoComprobante(p.comprobantes[0].url)
    }
  }

  const aprobarPago = async () => {
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify({ montoAprobado: parseFloat(montoAprobado), notasAdmin }),
    })
    if (r.success) {
      toast({ title: 'Pago aprobado', description: 'Se actualizó el saldo de la obligación' })
      setPagoModal(null)
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const rechazarPago = async () => {
    if (!motivoRechazo) {
      toast({ title: 'Motivo requerido', variant: 'destructive' })
      return
    }
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivoRechazo }),
    })
    if (r.success) {
      toast({ title: 'Pago rechazado' })
      setPagoModal(null)
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const recalcularMora = async () => {
    setRecalcMoraLoading(true)
    const r = await apiFetch('/api/vehiculos/obligaciones/recalcular-mora', { method: 'POST' })
    setRecalcMoraLoading(false)
    if (r.success) {
      toast({
        title: 'Mora recalculada',
        description: `${r.data?.actualizadas || 0} obligaciones actualizadas, ${r.data?.alertasGeneradas || 0} alertas`,
      })
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <SheetHeader>
        <SheetTitle>Contrato {contrato.numeroContrato}</SheetTitle>
      </SheetHeader>
      <div className="text-xs text-muted-foreground">{formatDateTime(contrato.createdAt)}</div>

      {/* Resumen del contrato */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Conductor</div>
          <div className="font-medium">{conductor?.nombre}</div>
          <div className="text-xs">CC {conductor?.cedula} · {conductor?.telefono}</div>
        </div>
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Vehículo</div>
          <div className="font-medium">{vehiculo?.marca} {vehiculo?.modelo}</div>
          <div className="text-xs">Placa: {vehiculo?.placa}</div>
        </div>
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Tarifa / Modalidad</div>
          <div className="font-medium">{formatCOP(contrato.tarifa)} / {contrato.modalidadPago}</div>
          <div className="text-xs">Gracia: {contrato.diasGracia} días · Multa: {formatCOP(contrato.multaDiaria)}/día</div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Facturado</div>
          <div className="text-lg font-bold text-emerald-700">{formatCOP(totales.montoFacturado)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Recibido</div>
          <div className="text-lg font-bold text-green-700">{formatCOP(totales.montoPagado)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Pendiente</div>
          <div className="text-lg font-bold text-orange-700">{formatCOP(totales.montoPendiente)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Multas</div>
          <div className="text-lg font-bold text-red-700">{formatCOP(totales.multas)}</div>
        </CardContent></Card>
      </div>

      {/* Botón recalcular mora */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={recalcularMora} disabled={recalcMoraLoading} variant="outline" size="sm">
          <Zap className="w-4 h-4 mr-1" />
          {recalcMoraLoading ? 'Recalculando...' : 'Recalcular mora'}
        </Button>
        <Button onClick={() => descargarPDFEntrega('completo')} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> PDF ficha completa
        </Button>
        <Button onClick={() => descargarPDFEntrega('inventario')} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> PDF inventario
        </Button>
        <Button onClick={generarContratoLegal} disabled={generandoContrato} size="sm" className="bg-gradient-to-r from-purple-500 to-indigo-600">
          <PenTool className="w-4 h-4 mr-1" />
          {generandoContrato ? 'Generando...' : 'Generar contrato legal'}
        </Button>
        <Button onClick={enviarFirmaWhatsApp} disabled={enviandoNotificacion} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <Smartphone className="w-4 h-4 mr-1" />
          {enviandoNotificacion ? 'Preparando...' : 'Enviar firma por WhatsApp'}
        </Button>
        <Button onClick={enviarFirmaEmail} disabled={enviandoNotificacion} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Mail className="w-4 h-4 mr-1" />
          {enviandoNotificacion ? 'Enviando...' : 'Enviar firma por Email'}
        </Button>
        <Button onClick={descargarContratoLegal} variant="outline" size="sm" className="border-blue-500 text-blue-700">
          <Download className="w-4 h-4 mr-1" /> Descargar contrato
        </Button>
        <Button onClick={verVistaPrevia} variant="outline" size="sm" className="border-green-500 text-green-700">
          <FileText className="w-4 h-4 mr-1" /> Vista previa
        </Button>
      </div>

      {/* Obligaciones */}
      <div>
        <h3 className="font-semibold mb-2">Obligaciones ({contrato.obligaciones?.length || 0})</h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {contrato.obligaciones?.map(o => (
            <div key={o.id} className="grid grid-cols-6 gap-2 p-2 rounded border text-xs items-center">
              <div className="font-medium">#{o.numeroCuota}</div>
              <div>Vence: {formatDate(o.fechaVencimiento)}</div>
              <div>{formatCOP(o.monto)}{o.multa > 0 && <span className="text-red-600"> +{formatCOP(o.multa)}</span>}</div>
              <div className="text-green-700">{formatCOP(o.montoPagado)}</div>
              <div className="text-orange-700">{formatCOP(o.montoPendiente)}</div>
              <div><EstadoBadge estado={o.estado} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagos */}
      <div>
        <h3 className="font-semibold mb-2">Pagos reportados ({contrato.pagos?.length || 0})</h3>
        {contrato.pagos?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pagos reportados.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {contrato.pagos?.map(p => (
              <div key={p.id} className="p-2 rounded border text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{formatCOP(p.monto)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(p.fechaPago)} · {p.metodo}</span>
                    {p.banco && <span className="ml-2 text-xs">{p.banco} · ref: {p.referencia || '—'}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={p.estado} />
                    {(p.estado === 'PENDIENTE' || p.estado === 'EN_REVISION') && (
                      <Button size="sm" variant="outline" onClick={() => abrirPago(p)}>
                        <CreditCard className="w-3 h-3 mr-1" /> Revisar
                      </Button>
                    )}
                  </div>
                </div>
                {p.ocrCoincide === false && (
                  <div className="mt-1 p-1.5 bg-yellow-50 rounded text-xs text-yellow-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Inconsistencias: {p.ocrInconsistencias}
                  </div>
                )}
                {p.comprobantes && p.comprobantes.length > 0 && p.comprobantes.some((c: any) => c.esDuplicado) && (
                  <div className="mt-1 p-1.5 bg-red-50 rounded text-xs text-red-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Comprobante duplicado detectado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mantenimientos del vehículo (si tiene) */}
      {contrato.mantenimientos && contrato.mantenimientos.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Mantenimientos ({contrato.mantenimientos.length})</h3>
          <div className="space-y-1">
            {contrato.mantenimientos.slice(0, 5).map(m => (
              <div key={m.id} className="p-2 rounded border text-sm">
                <div className="flex justify-between">
                  <span>{formatDate(m.fecha)} · {m.tipo}</span>
                  <span className="text-red-700">{formatCOP(m.costo)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{m.trabajoRealizado} · {m.kilometraje} km</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de revisión de pago */}
      <Dialog open={!!pagoModal} onOpenChange={() => setPagoModal(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión de pago</DialogTitle>
            <DialogDescription>
              {pagoModal?.conductor?.nombre} reportó un pago de {pagoModal && formatCOP(pagoModal.monto)} el{' '}
              {pagoModal && formatDate(pagoModal.fechaPago)}
            </DialogDescription>
          </DialogHeader>

          {pagoModal && (
            <div className="space-y-3">
              {/* Comprobante */}
              {fotoComprobante && (
                <div>
                  <Label>Comprobante cargado</Label>
                  <div className="mt-1 border rounded overflow-hidden">
                    <img src={fotoComprobante} alt="Comprobante" className="w-full max-h-80 object-contain bg-gray-100" />
                  </div>
                </div>
              )}

              {/* Datos reportados */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Monto reportado</div>
                  <div className="font-bold">{formatCOP(pagoModal.monto)}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Banco / Ref</div>
                  <div>{pagoModal.banco || '—'} · {pagoModal.referencia || '—'}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Fecha pago</div>
                  <div>{formatDate(pagoModal.fechaPago)}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Método</div>
                  <div>{pagoModal.metodo}</div>
                </div>
              </div>

              {/* OCR resultado */}
              {(pagoModal.ocrValor !== null || pagoModal.ocrBanco) && (
                <Card className="border-blue-300">
                  <CardHeader><CardTitle className="text-sm">Datos extraídos por OCR</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>Valor detectado: <strong>{pagoModal.ocrValor ? formatCOP(pagoModal.ocrValor) : '—'}</strong></div>
                    <div>Banco detectado: <strong>{pagoModal.ocrBanco || '—'}</strong></div>
                    <div>Referencia: <strong>{pagoModal.ocrReferencia || '—'}</strong></div>
                    <div>Destinatario: <strong>{pagoModal.ocrDestinatario || '—'}</strong></div>
                    {pagoModal.ocrCoincide === false && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Inconsistencias: {pagoModal.ocrInconsistencias}</span>
                      </div>
                    )}
                    {pagoModal.ocrCoincide === true && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-green-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Datos OCR coinciden con la obligación</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Obligación aplicada */}
              {pagoModal.obligacion && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Obligación aplicada</CardTitle></CardHeader>
                  <CardContent className="text-sm">
                    <div>Cuota #{pagoModal.obligacion.numeroCuota}</div>
                    <div>Vencimiento: {formatDate(pagoModal.obligacion.fechaVencimiento)}</div>
                    <div>Monto: {formatCOP(pagoModal.obligacion.monto)}</div>
                    <div>Pendiente: {formatCOP(pagoModal.obligacion.montoPendiente)}</div>
                  </CardContent>
                </Card>
              )}

              {/* Acciones admin */}
              <div className="space-y-2">
                <Label>Monto a aprobar (editable)</Label>
                <Input type="number" value={montoAprobado} onChange={e => setMontoAprobado(e.target.value)} />
                <Label>Notas administrativas</Label>
                <Textarea value={notasAdmin} onChange={e => setNotasAdmin(e.target.value)} rows={2} placeholder="Notas internas..." />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800">
                ⚠️ <strong>Recuerda:</strong> Un comprobante cargado NO demuestra que el dinero llegó.
                Verifica en tu cuenta bancaria antes de aprobar.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPagoModal(null)}>Cerrar</Button>
                <Button variant="destructive" onClick={rechazarPago}>
                  <XCircle className="w-4 h-4 mr-1" /> Rechazar
                </Button>
                <Button onClick={aprobarPago} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-1" /> Aprobar pago
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal vista previa del contrato */}
      <Dialog open={vistaPreviaOpen} onOpenChange={setVistaPreviaOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>Vista previa del contrato {contrato.numeroContrato}</span>
              {contratoToken && (
                <a
                  href={`/api/vehiculos/contrato-legal/descargar?token=${contratoToken}`}
                  download={`Contrato_${contrato.numeroContrato}.pdf`}
                >
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Download className="w-4 h-4 mr-1" /> Descargar PDF
                  </Button>
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-0 h-[80vh]">
            {contratoToken && (
              <iframe
                src={`/api/vehiculos/contrato-legal/descargar?token=${contratoToken}`}
                className="w-full h-full border-0"
                title="Vista previa del contrato"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Importación diferida para evitar dependencia circular
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
