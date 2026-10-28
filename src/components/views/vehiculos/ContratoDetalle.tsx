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
import { CreditCard, CheckCircle, XCircle, AlertTriangle, FileText, Zap, Download, PenTool, Smartphone, Mail, Link2, Send, Loader2, Copy } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, formatDateTime, EstadoBadge, ESTADOS_PAGO } from './helpers'
import { useState, useEffect } from 'react'

export function ContratoDetalle({ contrato, onChanged }: { contrato: any; onChanged?: () => void }) {
  const { toast } = useToast()
  const [pagoModal, setPagoModal] = useState<any | null>(null)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [notasAdmin, setNotasAdmin] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [recalcMoraLoading, setRecalcMoraLoading] = useState(false)
  const [fotoComprobante, setFotoComprobante] = useState<string | null>(null)

  // === Estado de firma del contrato ===
  const [docLegal, setDocLegal] = useState<any>(null)
  const [cargandoDoc, setCargandoDoc] = useState(false)
  const [modalEnvioOpen, setModalEnvioOpen] = useState(false)
  const [canalEnvio, setCanalEnvio] = useState<'WHATSAPP' | 'EMAIL' | 'LINK' | ''>('')
  const [enviando, setEnviando] = useState(false)
  const [vistaPreviaOpen, setVistaPreviaOpen] = useState(false)
  const [contratoToken, setContratoToken] = useState<string | null>(null)

  // === Cargar documento legal existente ===
  const cargarDocLegal = async () => {
    setCargandoDoc(true)
    try {
      const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, { method: 'GET' })
      if (r.success && r.data && Array.isArray(r.data) && r.data.length > 0) {
        setDocLegal(r.data[0])
      } else {
        setDocLegal(null)
      }
    } catch { setDocLegal(null) }
    setCargandoDoc(false)
  }

  useEffect(() => {
    if (contrato?.id) cargarDocLegal()
  }, [contrato?.id])

  // === Generar contrato legal ===
  const generarContratoLegal = async () => {
    setCargandoDoc(true)
    try {
      const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (r.success) {
        toast({ title: 'Contrato legal generado', description: `Contrato ${r.data?.numeroContrato} creado.` })
        await cargarDocLegal()
        onChanged?.()
      } else {
        // Si ya existe, recargar
        if (r.error?.includes('Ya existe')) {
          await cargarDocLegal()
          toast({ title: 'Contrato ya existe', description: 'El documento legal ya fue generado.' })
        } else {
          toast({ title: 'Error', description: r.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setCargandoDoc(false)
  }

  // === Abrir modal de envío ===
  const abrirModalEnvio = async () => {
    if (!docLegal) {
      await generarContratoLegal()
    }
    setModalEnvioOpen(true)
  }

  // === Enviar por WhatsApp ===
  const enviarWhatsApp = async () => {
    if (!docLegal?.conductorToken) {
      toast({ title: 'Error', description: 'No hay documento legal generado', variant: 'destructive' })
      return
    }
    const telefono = conductor?.telefono || ''
    const nombre = conductor?.nombre || ''
    if (!telefono) {
      toast({ title: 'Error', description: 'El conductor no tiene teléfono', variant: 'destructive' })
      return
    }
    const link = `${window.location.origin}/firma-contrato-vehiculo/${docLegal.conductorToken}`
    const mensaje = `🔐 *CONTRATO DE ARRENDAMIENTO - FIRMA ELECTRÓNICA*\n\nHola *${nombre}*,\n\nSe ha generado un contrato de arrendamiento de vehículo a su nombre.\n\n📄 *Contrato:* ${docLegal.numeroContrato}\n🚗 *Vehículo:* ${vehiculo?.marca} ${vehiculo?.modelo} - Placa ${vehiculo?.placa}\n💰 *Tarifa:* ${formatCOP(contrato.tarifa)} / ${contrato.modalidadPago}\n\nPara firmar electrónicamente, ingresa al siguiente enlace:\n${link}\n\n⏰ Expira en 7 días.\n⚠️ No compartas este enlace.\n\nSaludos,\nJsadr`
    const telLimpio = telefono.replace(/\D/g, '')
    const waUrl = `https://wa.me/57${telLimpio}?text=${encodeURIComponent(mensaje)}`
    window.open(waUrl, '_blank')
    toast({ title: 'WhatsApp abierto', description: `Presiona enviar en WhatsApp para ${nombre} (${telefono}).`, duration: 8000 })
    setModalEnvioOpen(false)
  }

  // === Enviar por Email ===
  const enviarEmail = async () => {
    if (!docLegal?.conductorToken) {
      toast({ title: 'Error', description: 'No hay documento legal generado', variant: 'destructive' })
      return
    }
    const email = conductor?.email || ''
    const nombre = conductor?.nombre || ''
    if (!email) {
      toast({ title: 'Error', description: 'El conductor no tiene email', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      // Llamar al endpoint para que envíe el email desde el servidor
      const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
        method: 'POST',
        body: JSON.stringify({ reenviar: true, canal: 'EMAIL' }),
      })
      if (r.success || r.data) {
        toast({ title: 'Email enviado', description: `Se envió a ${email}` })
      } else {
        // Fallback: abrir mailto
        const link = `${window.location.origin}/firma-contrato-vehiculo/${docLegal.conductorToken}`
        const asunto = `Contrato de Arrendamiento ${docLegal.numeroContrato} - Firma Electrónica`
        const cuerpo = `Estimado/a ${nombre},\n\nSe ha generado un contrato de arrendamiento de vehículo a su nombre.\n\nContrato: ${docLegal.numeroContrato}\nVehículo: ${vehiculo?.marca} ${vehiculo?.modelo} - Placa ${vehiculo?.placa}\n\nPara firmar electrónicamente:\n${link}\n\nExpira en 7 días.\n\nSaludos,\nJsadr`
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
        window.open(mailtoUrl, '_blank')
        toast({ title: 'Email preparado', description: `Se abrió tu cliente de correo para ${email}.`, duration: 8000 })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setEnviando(false)
    setModalEnvioOpen(false)
  }

  // === Copiar enlace directo ===
  const copiarEnlace = async () => {
    if (!docLegal?.conductorToken) {
      toast({ title: 'Error', description: 'No hay documento legal generado', variant: 'destructive' })
      return
    }
    const link = `${window.location.origin}/firma-contrato-vehiculo/${docLegal.conductorToken}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Enlace copiado', description: 'Pégalo donde lo necesites.' })
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast({ title: 'Enlace copiado', description: 'Pégalo donde lo necesites.' })
    }
    setModalEnvioOpen(false)
  }

  // === Descargar PDF de entrega ===
  const descargarPDFEntrega = async (tipo: string) => {
    try {
      let token: string | null = null
      const userStr = localStorage.getItem('user')
      if (userStr) { try { token = JSON.parse(userStr).token || JSON.parse(userStr).accessToken } catch {} }
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
  const descargarContratoLegal = async () => {
    const token = docLegal?.conductorToken || docLegal?.propietarioToken
    if (!token) {
      toast({ title: 'Error', description: 'No hay documento legal generado', variant: 'destructive' })
      return
    }
    const link = document.createElement('a')
    link.href = `/api/vehiculos/contrato-legal/descargar?token=${token}`
    link.download = `Contrato_${contrato.numeroContrato}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // === Vista previa ===
  const verVistaPrevia = () => {
    const token = docLegal?.conductorToken || docLegal?.propietarioToken
    if (token) {
      setContratoToken(token)
      setVistaPreviaOpen(true)
    } else {
      toast({ title: 'Error', description: 'No hay documento legal generado', variant: 'destructive' })
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
    if (p.comprobanteUrl) setFotoComprobante(p.comprobanteUrl)
    else if (p.comprobantes && p.comprobantes.length > 0) setFotoComprobante(p.comprobantes[0].url)
  }

  const aprobarPago = async () => {
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify({ montoAprobado: parseFloat(montoAprobado), notasAdmin }),
    })
    if (r.success) { toast({ title: 'Pago aprobado', description: 'Se actualizó el saldo' }); setPagoModal(null); onChanged?.() }
    else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
  }

  const rechazarPago = async () => {
    if (!motivoRechazo) { toast({ title: 'Motivo requerido', variant: 'destructive' }); return }
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivoRechazo }),
    })
    if (r.success) { toast({ title: 'Pago rechazado' }); setPagoModal(null); onChanged?.() }
    else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
  }

  const recalcularMora = async () => {
    setRecalcMoraLoading(true)
    const r = await apiFetch('/api/vehiculos/obligaciones/recalcular-mora', { method: 'POST' })
    setRecalcMoraLoading(false)
    if (r.success) { toast({ title: 'Mora recalculada', description: `${r.data?.actualizadas || 0} obligaciones actualizadas` }); onChanged?.() }
    else { toast({ title: 'Error', description: r.error, variant: 'destructive' }) }
  }

  // === Estado del documento legal ===
  const estadoDoc = docLegal?.estado || null
  const tieneDoc = !!docLegal

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Contrato {contrato.numeroContrato}</h2>
        {estadoDoc && (
          <Badge className={
            estadoDoc === 'COMPLETADO' ? 'bg-green-100 text-green-800' :
            estadoDoc === 'FIRMADO_CONDUCTOR' ? 'bg-blue-100 text-blue-800' :
            estadoDoc === 'ENVIADO_CONDUCTOR' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }>
            {estadoDoc.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">{formatDateTime(contrato.createdAt)}</div>

      {/* Resumen */}
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
          <div className="font-medium">{formatCOP(contrato.tarifa)}</div>
          <div className="text-xs">{contrato.modalidadPago}</div>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-2 text-center">
          <div className="text-xs text-muted-foreground">Facturado</div>
          <div className="text-lg font-bold">{formatCOP(totales.facturado)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <div className="text-xs text-muted-foreground">Recibido</div>
          <div className="text-lg font-bold text-green-700">{formatCOP(totales.recibido)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <div className="text-xs text-muted-foreground">Pendiente</div>
          <div className="text-lg font-bold text-orange-700">{formatCOP(totales.pendiente)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <div className="text-xs text-muted-foreground">Multas</div>
          <div className="text-lg font-bold text-red-700">{formatCOP(totales.multas)}</div>
        </CardContent></Card>
      </div>

      {/* === SECCIÓN FIRMA ELECTRÓNICA === */}
      <div className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50/30">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <PenTool className="w-5 h-5" /> Firma Electrónica del Contrato
        </h3>

        {/* Estado actual */}
        {cargandoDoc ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando documento...
          </div>
        ) : tieneDoc ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Documento legal: <strong>{docLegal.numeroContrato}</strong></span>
              <Badge variant="outline">{estadoDoc}</Badge>
            </div>
            {estadoDoc === 'COMPLETADO' && (
              <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                ✓ Contrato firmado por ambas partes. Listo para descargar.
              </div>
            )}
            {estadoDoc === 'FIRMADO_CONDUCTOR' && (
              <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                ✓ Conductor ha firmado. Pendiente firma del propietario.
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay documento legal generado todavía.</p>
        )}

        {/* Botones de acción */}
        <div className="flex gap-2 flex-wrap mt-3">
          {!tieneDoc && (
            <Button onClick={generarContratoLegal} disabled={cargandoDoc} size="sm" className="bg-gradient-to-r from-purple-500 to-indigo-600">
              <PenTool className="w-4 h-4 mr-1" />
              {cargandoDoc ? 'Generando...' : 'Generar contrato legal'}
            </Button>
          )}
          {tieneDoc && (
            <>
              {/* BOTÓN PRINCIPAL: Enviar firma al conductor */}
              <Button onClick={abrirModalEnvio} size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <Send className="w-4 h-4 mr-1" />
                Enviar firma al conductor
              </Button>

              {/* Descargar contrato */}
              <Button onClick={descargarContratoLegal} variant="outline" size="sm" className="border-blue-500 text-blue-700">
                <Download className="w-4 h-4 mr-1" /> Descargar contrato PDF
              </Button>

              {/* Vista previa */}
              <Button onClick={verVistaPrevia} variant="outline" size="sm" className="border-green-500 text-green-700">
                <FileText className="w-4 h-4 mr-1" /> Vista previa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Otros botones */}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === MODAL: Seleccionar canal de envío === */}
      <Dialog open={modalEnvioOpen} onOpenChange={setModalEnvioOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar firma al conductor</DialogTitle>
            <DialogDescription>
              Selecciona por qué medio enviar el enlace de firma electrónica a {conductor?.nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Datos del conductor */}
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              <div><strong>Conductor:</strong> {conductor?.nombre}</div>
              <div><strong>Teléfono:</strong> {conductor?.telefono}</div>
              <div><strong>Email:</strong> {conductor?.email || '—'}</div>
              <div><strong>Contrato:</strong> {docLegal?.numeroContrato}</div>
            </div>

            {/* Opciones de envío */}
            <div className="space-y-2">
              <Button
                onClick={enviarWhatsApp}
                disabled={enviando || !conductor?.telefono}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Enviar por WhatsApp
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Abre WhatsApp con el mensaje pre-llenado para {conductor?.telefono}
              </p>

              <Button
                onClick={enviarEmail}
                disabled={enviando || !conductor?.email}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {enviando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Mail className="w-5 h-5 mr-2" />}
                Enviar por Email
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Envía el enlace a {conductor?.email || '—'}
              </p>

              <Button
                onClick={copiarEnlace}
                variant="outline"
                className="w-full"
              >
                <Link2 className="w-5 h-5 mr-2" />
                Copiar enlace directo
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Copia el enlace al portapapeles para pegarlo donde quieras
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEnvioOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal revisión de pago */}
      <Dialog open={!!pagoModal} onOpenChange={() => setPagoModal(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión de pago</DialogTitle>
            <DialogDescription>
              {pagoModal?.conductor?.nombre} reportó un pago de {pagoModal && formatCOP(pagoModal.monto)} el {pagoModal && formatDate(pagoModal.fechaPago)}
            </DialogDescription>
          </DialogHeader>
          {pagoModal && (
            <div className="space-y-3">
              {fotoComprobante && (
                <div>
                  <Label>Comprobante cargado</Label>
                  <div className="mt-1 border rounded overflow-hidden">
                    <img src={fotoComprobante} alt="Comprobante" className="w-full max-h-80 object-contain bg-gray-100" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded border"><div className="text-xs text-muted-foreground">Monto reportado</div><div className="font-bold">{formatCOP(pagoModal.monto)}</div></div>
                <div className="p-2 rounded border"><div className="text-xs text-muted-foreground">Banco / Ref</div><div>{pagoModal.banco || '—'} · {pagoModal.referencia || '—'}</div></div>
                <div className="p-2 rounded border"><div className="text-xs text-muted-foreground">Fecha pago</div><div>{formatDate(pagoModal.fechaPago)}</div></div>
                <div className="p-2 rounded border"><div className="text-xs text-muted-foreground">Método</div><div>{pagoModal.metodo}</div></div>
              </div>
              <div className="space-y-2">
                <Label>Monto a aprobar (editable)</Label>
                <Input type="number" value={montoAprobado} onChange={e => setMontoAprobado(e.target.value)} />
                <Label>Notas administrativas</Label>
                <Textarea value={notasAdmin} onChange={e => setNotasAdmin(e.target.value)} rows={2} placeholder="Notas internas..." />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800">
                ⚠️ <strong>Recuerda:</strong> Un comprobante cargado NO demuestra que el dinero llegó. Verifica en tu cuenta bancaria antes de aprobar.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPagoModal(null)}>Cerrar</Button>
                <Button variant="destructive" onClick={rechazarPago}><XCircle className="w-4 h-4 mr-1" /> Rechazar</Button>
                <Button onClick={aprobarPago} className="bg-green-600 hover:bg-green-700"><CheckCircle className="w-4 h-4 mr-1" /> Aprobar pago</Button>
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
                <a href={`/api/vehiculos/contrato-legal/descargar?token=${contratoToken}`} download={`Contrato_${contrato.numeroContrato}.pdf`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Download className="w-4 h-4 mr-1" /> Descargar PDF</Button>
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-0 h-[80vh]">
            {contratoToken && (
              <iframe src={`/api/vehiculos/contrato-legal/descargar?token=${contratoToken}`} className="w-full h-full border-0" title="Vista previa del contrato" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Importación diferida para evitar dependencia circular
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
