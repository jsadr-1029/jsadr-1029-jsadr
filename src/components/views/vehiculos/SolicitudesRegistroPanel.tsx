'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, UserPlus, Eye, Car } from 'lucide-react'
import { apiFetch, formatDate } from './helpers'

const COLORES_ESTADO: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  DOCUMENTOS: 'bg-blue-100 text-blue-800 border-blue-300',
  FIRMA: 'bg-purple-100 text-purple-800 border-purple-300',
  OTP: 'bg-purple-100 text-purple-800 border-purple-300',
  COMPLETADA: 'bg-green-100 text-green-800 border-green-300',
  APROBADA: 'bg-green-200 text-green-900 border-green-400',
  RECHAZADA: 'bg-red-100 text-red-800 border-red-300',
}

export function SolicitudesRegistroPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<any | null>(null)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [aprobarModal, setAprobarModal] = useState<any | null>(null)
  const [aprobarForm, setAprobarForm] = useState<any>({
    vehiculoId: '', modalidadPago: 'DIARIO', tarifa: 80000,
    diasGracia: 1, multaDiaria: 20000, cantidadCuotas: 24, deposito: 0,
  })

  const cargar = async () => {
    setLoading(true)
    const [rs, rv] = await Promise.all([
      apiFetch('/api/vehiculos/registro-conductor/admin/lista'),
      apiFetch('/api/vehiculos/vehiculos'),
    ])
    if (rs.success) setSolicitudes(rs.data || [])
    if (rv.success) setVehiculos(rv.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const verDetalle = (s: any) => {
    setDetalle(s)
    setDetalleOpen(true)
  }

  const abrirAprobar = (s: any) => {
    setAprobarModal(s)
    setDetalleOpen(false)
  }

  const aprobar = async () => {
    if (!aprobarModal) return
    if (!aprobarForm.vehiculoId) {
      toast({ title: 'Selecciona un vehículo', variant: 'destructive' })
      return
    }
    const r = await apiFetch(`/api/vehiculos/registro-conductor/admin/${aprobarModal.id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify(aprobarForm),
    })
    if (r.success) {
      toast({ title: 'Solicitud aprobada', description: r.message })
      setAprobarModal(null)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const rechazar = async (s: any) => {
    const motivo = prompt('Motivo de rechazo:')
    if (!motivo) return
    const r = await apiFetch(`/api/vehiculos/registro-conductor/admin/${s.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivoRechazo: motivo }),
    })
    if (r.success) {
      toast({ title: 'Solicitud rechazada' })
      setDetalleOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const FotoPreview = ({ url, label }: { url?: string | null; label: string }) => (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {url ? (
        <img src={url} alt={label} className="w-full max-h-32 object-contain border rounded" />
      ) : (
        <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center text-xs text-muted-foreground">
          Sin foto
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-600" /> Solicitudes de registro
        </h2>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : solicitudes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay solicitudes de registro pendientes.
          <div className="text-xs mt-1">Cuando un conductor se registre desde el login, aparecerá aquí.</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {solicitudes.map((s: any) => (
            <Card key={s.id} className="border shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => verDetalle(s)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Foto del conductor */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-200 flex-shrink-0">
                      {s.fotoSelfie ? (
                        <img src={s.fotoSelfie} alt={s.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold">{s.nombre}</div>
                      <div className="text-xs text-muted-foreground">CC {s.cedula} · {s.telefono}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${COLORES_ESTADO[s.estado] || COLORES_ESTADO.PENDIENTE}`}>
                      {s.estado}
                    </span>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>Solicitud de {detalle.nombre}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Foto principal */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-200">
                    {detalle.fotoSelfie ? (
                      <img src={detalle.fotoSelfie} alt={detalle.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <UserPlus className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-bold">{detalle.nombre}</div>
                    <div className="text-sm text-muted-foreground">CC {detalle.cedula}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${COLORES_ESTADO[detalle.estado]}`}>
                      {detalle.estado}
                    </span>
                  </div>
                </div>

                {/* Datos de contacto */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Teléfono:</span> <strong>{detalle.telefono}</strong></div>
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Email:</span> {detalle.email || '—'}</div>
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Dirección:</span> {detalle.direccion || '—'}</div>
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Ciudad:</span> {detalle.ciudad || '—'}</div>
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Licencia:</span> {detalle.licenciaCategoria || '—'} {detalle.licenciaNumero || ''}</div>
                  <div className="p-2 rounded border"><span className="text-muted-foreground">Vence:</span> {detalle.licenciaVence ? formatDate(detalle.licenciaVence) : '—'}</div>
                </div>

                {/* Contacto de emergencia */}
                {detalle.contactoEmergenciaNombre && (
                  <div className="p-2 rounded border text-sm">
                    <span className="text-muted-foreground">Contacto emergencia:</span> {detalle.contactoEmergenciaNombre} ({detalle.contactoEmergenciaParentesco}) · {detalle.contactoEmergenciaTelefono}
                  </div>
                )}

                {/* Fotos */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">Documentos cargados</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FotoPreview url={detalle.fotoCedulaFrente} label="Cédula frente" />
                    <FotoPreview url={detalle.fotoCedulaReverso} label="Cédula reverso" />
                    <FotoPreview url={detalle.fotoLicenciaFrente} label="Licencia frente" />
                    <FotoPreview url={detalle.fotoLicenciaReverso} label="Licencia reverso" />
                    <FotoPreview url={detalle.fotoSelfie} label="Selfie" />
                    <FotoPreview url={detalle.fotoReciboServicios} label="Recibo servicios" />
                  </div>
                </div>

                {detalle.motivoRechazo && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Motivo de rechazo:</strong> {detalle.motivoRechazo}
                  </div>
                )}

                {/* Acciones */}
                {detalle.estado === 'COMPLETADA' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => rechazar(detalle)} className="text-red-600">
                      <XCircle className="w-4 h-4 mr-1" /> Rechazar
                    </Button>
                    <Button onClick={() => abrirAprobar(detalle)} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" /> Aprobar y crear conductor
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal aprobar (asignar vehículo + contrato) */}
      <Dialog open={!!aprobarModal} onOpenChange={() => setAprobarModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Aprobar solicitud</DialogTitle></DialogHeader>
          {aprobarModal && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Al aprobar, se creará el conductor <strong>{aprobarModal.nombre}</strong> (CC {aprobarModal.cedula})
                y se le asignará un vehículo con contrato activo.
              </p>
              <div>
                <Label>Vehículo a asignar *</Label>
                <Select value={aprobarForm.vehiculoId} onValueChange={v => setAprobarForm({ ...aprobarForm, vehiculoId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar vehículo disponible" /></SelectTrigger>
                  <SelectContent>
                    {vehiculos.filter(v => v.estado === 'DISPONIBLE').map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} - {v.marca} {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Modalidad de pago</Label>
                  <Select value={aprobarForm.modalidadPago} onValueChange={v => setAprobarForm({ ...aprobarForm, modalidadPago: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIARIO">Diario</SelectItem>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                      <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                      <SelectItem value="MENSUAL">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tarifa</Label>
                  <Input type="number" value={aprobarForm.tarifa} onChange={e => setAprobarForm({ ...aprobarForm, tarifa: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>Cantidad cuotas</Label>
                  <Input type="number" value={aprobarForm.cantidadCuotas} onChange={e => setAprobarForm({ ...aprobarForm, cantidadCuotas: parseInt(e.target.value) })} />
                </div>
                <div>
                  <Label>Días de gracia</Label>
                  <Input type="number" value={aprobarForm.diasGracia} onChange={e => setAprobarForm({ ...aprobarForm, diasGracia: parseInt(e.target.value) })} />
                </div>
                <div>
                  <Label>Multa diaria</Label>
                  <Input type="number" value={aprobarForm.multaDiaria} onChange={e => setAprobarForm({ ...aprobarForm, multaDiaria: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>Depósito</Label>
                  <Input type="number" value={aprobarForm.deposito} onChange={e => setAprobarForm({ ...aprobarForm, deposito: parseFloat(e.target.value) })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAprobarModal(null)}>Cancelar</Button>
                <Button onClick={aprobar} className="bg-green-600 hover:bg-green-700">Aprobar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Import necesarios al final
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
