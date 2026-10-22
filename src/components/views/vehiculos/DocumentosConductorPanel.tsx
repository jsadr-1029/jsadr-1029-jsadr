'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Users, Search, Eye } from 'lucide-react'
import { apiFetch, formatDate } from './helpers'

const COLORES_TIPO: Record<string, string> = {
  CEDULA_FRENTE: 'bg-blue-100 text-blue-800 border-blue-300',
  CEDULA_REVERSO: 'bg-blue-100 text-blue-800 border-blue-300',
  LICENCIA_FRENTE: 'bg-purple-100 text-purple-800 border-purple-300',
  LICENCIA_REVERSO: 'bg-purple-100 text-purple-800 border-purple-300',
  SELFIE: 'bg-green-100 text-green-800 border-green-300',
  RECIBO_SERVICIOS: 'bg-orange-100 text-orange-800 border-orange-300',
}

const LABELS_TIPO: Record<string, string> = {
  CEDULA_FRENTE: 'Cédula - Frente',
  CEDULA_REVERSO: 'Cédula - Reverso',
  LICENCIA_FRENTE: 'Licencia - Frente',
  LICENCIA_REVERSO: 'Licencia - Reverso',
  SELFIE: 'Selfie',
  RECIBO_SERVICIOS: 'Recibo de Servicios',
}

export function DocumentosConductorPanel() {
  const [documentos, setDocumentos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroConductor, setFiltroConductor] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [fotoLabel, setFotoLabel] = useState('')

  const cargar = async () => {
    setLoading(true)
    const [rd, rc] = await Promise.all([
      apiFetch('/api/vehiculos/documentos-conductor' + (filtroConductor ? `?conductorId=${filtroConductor}` : '')),
      apiFetch('/api/vehiculos/conductores'),
    ])
    if (rd.success) setDocumentos(rd.data || [])
    if (rc.success) setConductores(rc.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroConductor])

  const verFoto = (url: string, label: string) => {
    setFotoAmpliada(url)
    setFotoLabel(label)
  }

  // Agrupar por conductor
  const conductoresConDocs = conductores.map(c => {
    const docs = documentos.filter(d => d.conductorId === c.id)
    return { ...c, documentos: docs }
  }).filter(c => c.documentos.length > 0 || !filtroConductor)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroConductor || 'TODOS'} onValueChange={v => setFiltroConductor(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Filtrar por conductor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los conductores</SelectItem>
            {conductores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} (CC {c.cedula})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : documentos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay documentos de conductores registrados.
          <div className="text-xs mt-1">Cuando se apruebe una solicitud de registro, las fotos aparecerán aquí.</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {conductoresConDocs.map(c => (
            c.documentos.length > 0 && (
              <Card key={c.id} className="border shadow-sm">
                <CardContent className="p-4">
                  {/* Header del conductor */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-200 bg-gray-100 flex-shrink-0">
                      {c.fotoUrl ? (
                        <img src={c.fotoUrl} alt={c.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{c.nombre}</div>
                      <div className="text-xs text-muted-foreground">CC {c.cedula}</div>
                    </div>
                    <Badge>{c.documentos.length} documentos</Badge>
                  </div>

                  {/* Grid de documentos */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {c.documentos.map((doc: any) => (
                      <div key={doc.id} className="space-y-1">
                        <div
                          className="cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                          onClick={() => verFoto(doc.fotoUrl, `${LABELS_TIPO[doc.tipo] || doc.tipo} - ${c.nombre}`)}
                        >
                          <div className="aspect-square bg-gray-100">
                            <img src={doc.fotoUrl} alt={doc.descripcion || doc.tipo} className="w-full h-full object-cover" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${COLORES_TIPO[doc.tipo] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {LABELS_TIPO[doc.tipo] || doc.tipo}
                          </span>
                          <button onClick={() => verFoto(doc.fotoUrl, `${LABELS_TIPO[doc.tipo] || doc.tipo} - ${c.nombre}`)}>
                            <Eye className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="text-[9px] text-muted-foreground">{formatDate(doc.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}

      {/* Modal foto ampliada */}
      <Dialog open={!!fotoAmpliada} onOpenChange={() => setFotoAmpliada(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{fotoLabel}</DialogTitle></DialogHeader>
          {fotoAmpliada && (
            <img src={fotoAmpliada} alt={fotoLabel} className="w-full max-h-[70vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
