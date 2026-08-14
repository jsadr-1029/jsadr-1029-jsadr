'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  User, Phone, Mail, MapPin, Landmark, Percent, Calendar,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle,
  FileText, Activity, Clock, DollarSign, Image as ImageIcon, Loader2,
} from 'lucide-react'

// =====================================================
// HojaVidaClienteModal
// =====================================================
// Modal completo con la "Hoja de Vida" del cliente:
//   - Perfil: datos personales, bancarios, tasa, fechas
//   - Préstamos: tabla con todos los préstamos del cliente
//   - Comportamiento: métricas de puntualidad, pagos atrasados, promedios
//   - Pagos: historial cronológico de pagos aplicados
//   - Fotos: cédula frente/reverso + selfie del registro
//   - Bitácora: eventos registrados en sus préstamos + accesos al portal
//
// Se alimenta de la API /api/clientes/[id]/hoja-vida.

interface Foto {
  id: string
  tipo: string
  titulo?: string | null
  descripcion?: string | null
  archivoBase64: string
  archivoNombre?: string | null
  archivoTipo?: string | null
  subidoPor?: string | null
  fechaSubida: string
}

interface PrestamoHoja {
  id: string
  codigo: string
  montoPrincipal: number
  tasaInteresAnual: number
  plazoMeses: number
  frecuencia: string
  numeroCuotas: number
  montoCuota: number
  cuotasPagadas: number
  saldoTotal: number
  montoPagado: number
  montoMora: number
  diasMora: number
  estado: string
  fechaSolicitud: string
  fechaDesembolso?: string | null
  fechaVencimiento?: string | null
  updatedAt?: string
  tieneCodeudor?: boolean
  codeudorNombre?: string | null
}

interface PagoHoja {
  id: string
  prestamoId: string
  prestamoCodigo: string
  numeroCuota: number
  montoTotal: number
  montoCapital: number
  montoInteres: number
  montoMora: number
  fechaPago: string | null
  fechaVencimiento: string
  metodoPago: string
  estado: string
  referencia?: string | null
  notas?: string | null
  createdAt: string
}

interface EstadisticasHoja {
  totalPrestamos: number
  totalPrestado: number
  totalPagado: number
  totalPagosAplicados: number
  promedioMontoPago: number
  puntualidad: number
  pagosPuntuales: number
  pagosAtrasados: number
  promedioDiasAtraso: number
  maxDiasAtraso: number
  prestamosActivos: number
  prestamosEnMora: number
  prestamosJuridico: number
  saldoTotalActivos: number
  tieneMoraActiva: boolean
  distribucionEstados: Record<string, number>
}

interface ComportamientoHoja {
  puntualidad: number
  promedioDiasAtraso: number
  promedioMontoPago: string
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO'
  descripcion: string
}

interface BitacoraPrestamoEvento {
  id: string
  prestamoId: string
  prestamoCodigo: string
  usuarioNombre: string
  tipo: string
  titulo: string
  descripcion: string
  resultado?: string | null
  fechaEvento: string
}

interface AccesoPortalHoja {
  id: string
  createdAt: string
  ipOrigen?: string | null
  userAgent?: string | null
  exito: boolean
}

interface HojaVidaData {
  cliente: {
    id: string
    nombre: string
    cedula: string
    telefono: string
    email?: string | null
    departamento?: string | null
    municipio?: string | null
    ciudad?: string | null
    barrio?: string | null
    direccion?: string | null
    salario?: number | null
    fechaIngreso?: string | null
    notas?: string | null
    bancoCliente?: string | null
    tipoCuentaCliente?: string | null
    numeroCuentaCliente?: string | null
    activo: boolean
    tieneTasaPersonalizada: boolean
    tasaPersonalizada?: number | null
    preferenciaNotificacion?: string | null
    createdAt: string
    updatedAt: string
    ultimoAccesoPortal?: string | null
  }
  referidoPor?: any
  referidos?: any[]
  categoria?: any
  cuentaRecaudo?: any
  documentosGestor: Foto[]
  fotos: Foto[]
  prestamos: PrestamoHoja[]
  pagos: PagoHoja[]
  estadisticas: EstadisticasHoja
  comportamiento: ComportamientoHoja
  bitacora: {
    prestamosEventos: BitacoraPrestamoEvento[]
    accesosPortal: AccesoPortalHoja[]
  }
}

interface Props {
  clienteId: string | null
  open: boolean
  onClose: () => void
}

export function HojaVidaClienteModal({ clienteId, open, onClose }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<HojaVidaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<Foto | null>(null)

  useEffect(() => {
    if (!open || !clienteId) return
    setLoading(true)
    setData(null)
    fetch(`/api/clientes/${clienteId}/hoja-vida`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json.data)
        } else {
          toast({
            title: 'Error',
            description: json.error || 'No se pudo cargar la hoja de vida del cliente.',
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
  }, [open, clienteId, toast])

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Hoja de Vida del Cliente
              {data?.cliente && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · {data.cliente.nombre} · CC {data.cliente.cedula}
                </span>
              )}
              {data?.estadisticas.tieneMoraActiva && (
                <Badge variant="destructive" className="ml-2">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  En mora
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm text-muted-foreground">Cargando hoja de vida...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-muted-foreground">
              No se pudo cargar la información del cliente.
            </div>
          ) : (
            <Tabs defaultValue="perfil" className="w-full">
              <TabsList className="grid grid-cols-6 mb-4">
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="prestamos">
                  Préstamos
                  {data.estadisticas.totalPrestamos > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {data.estadisticas.totalPrestamos}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="comportamiento">Comportamiento</TabsTrigger>
                <TabsTrigger value="pagos">Pagos</TabsTrigger>
                <TabsTrigger value="fotos">Fotos</TabsTrigger>
                <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
              </TabsList>

              {/* === PESTAÑA PERFIL === */}
              <TabsContent value="perfil" className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field icon={<User className="w-4 h-4" />} label="Nombre completo" value={data.cliente.nombre} />
                  <Field icon={<User className="w-4 h-4" />} label="Cédula" value={data.cliente.cedula} mono />
                  <Field icon={<Phone className="w-4 h-4" />} label="Teléfono" value={data.cliente.telefono} mono />
                  <Field icon={<Mail className="w-4 h-4" />} label="Email" value={data.cliente.email || '—'} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="Departamento" value={data.cliente.departamento || '—'} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="Municipio" value={data.cliente.municipio || '—'} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="Ciudad" value={data.cliente.ciudad || '—'} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="Barrio" value={data.cliente.barrio || '—'} />
                  <Field icon={<MapPin className="w-4 h-4" />} label="Dirección" value={data.cliente.direccion || '—'} />
                  <Field icon={<DollarSign className="w-4 h-4" />} label="Salario" value={data.cliente.salario ? formatearMoneda(data.cliente.salario) : '—'} />
                  <Field icon={<Calendar className="w-4 h-4" />} label="Fecha de ingreso" value={data.cliente.fechaIngreso ? formatearFecha(data.cliente.fechaIngreso) : '—'} />
                  <Field icon={<Calendar className="w-4 h-4" />} label="Registro" value={formatearFecha(data.cliente.createdAt)} />
                </div>

                {/* Datos bancarios */}
                {(data.cliente.bancoCliente || data.cliente.tipoCuentaCliente || data.cliente.numeroCuentaCliente) && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Landmark className="w-4 h-4" /> Datos bancarios
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div><span className="text-xs text-muted-foreground">Banco: </span><strong>{data.cliente.bancoCliente || '—'}</strong></div>
                        <div><span className="text-xs text-muted-foreground">Tipo: </span><strong>{data.cliente.tipoCuentaCliente || '—'}</strong></div>
                        <div><span className="text-xs text-muted-foreground">Cuenta: </span><strong className="font-mono">{data.cliente.numeroCuentaCliente || '—'}</strong></div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tasa personalizada */}
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-3">
                    <div className="text-sm font-semibold text-purple-900 flex items-center gap-2 mb-2">
                      <Percent className="w-4 h-4" /> Tasa personalizada
                    </div>
                    {data.cliente.tieneTasaPersonalizada ? (
                      <div className="text-sm text-purple-900">
                        <strong className="text-base">{data.cliente.tasaPersonalizada ?? '—'}%</strong>
                        <span className="text-xs text-purple-700 ml-1">mensual fija</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-purple-700 border-purple-300">Sin tasa personalizada</Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Resumen rápido de actividad */}
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Préstamos" value={String(data.estadisticas.totalPrestamos)} icon={<FileText className="w-4 h-4" />} />
                  <StatCard label="Total prestado" value={formatearMoneda(data.estadisticas.totalPrestado)} icon={<DollarSign className="w-4 h-4" />} />
                  <StatCard label="Total pagado" value={formatearMoneda(data.estadisticas.totalPagado)} icon={<CheckCircle className="w-4 h-4" />} />
                  <StatCard
                    label="Puntualidad"
                    value={`${data.comportamiento.puntualidad}%`}
                    icon={<TrendingUp className="w-4 h-4" />}
                    color={data.comportamiento.puntualidad >= 80 ? 'green' : data.comportamiento.puntualidad >= 50 ? 'amber' : 'red'}
                  />
                </div>

                {data.cliente.notas && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <div className="text-sm p-2 rounded bg-muted/30 whitespace-pre-wrap mt-1">{data.cliente.notas}</div>
                  </div>
                )}
              </TabsContent>

              {/* === PESTAÑA PRÉSTAMOS === */}
              <TabsContent value="prestamos">
                <Card>
                  <CardContent className="p-0">
                    {data.prestamos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Este cliente no tiene préstamos registrados.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Principal</TableHead>
                            <TableHead>Plazo</TableHead>
                            <TableHead>Cuotas</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha desembolso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.prestamos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                              <TableCell className="text-sm">{formatearMoneda(p.montoPrincipal)}</TableCell>
                              <TableCell className="text-xs">{p.plazoMeses} meses · {p.frecuencia.toLowerCase()}</TableCell>
                              <TableCell className="text-xs">
                                {p.cuotasPagadas}/{p.numeroCuotas}
                                <div className="text-muted-foreground">{formatearMoneda(p.montoCuota)}</div>
                              </TableCell>
                              <TableCell className="text-sm font-semibold">
                                {formatearMoneda(p.saldoTotal)}
                                {p.montoMora > 0 && (
                                  <div className="text-xs text-red-600">Mora: {formatearMoneda(p.montoMora)} ({p.diasMora}d)</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <BadgeEstadoPrestamo estado={p.estado} />
                                {p.tieneCodeudor && (
                                  <Badge variant="outline" className="ml-1 text-[10px] bg-violet-500/15 text-violet-300 border-violet-400/40">
                                    Codeudor
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {p.fechaDesembolso ? formatearFecha(p.fechaDesembolso) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* === PESTAÑA COMPORTAMIENTO === */}
              <TabsContent value="comportamiento" className="space-y-4">
                <Card className={data.comportamiento.nivelRiesgo === 'ALTO' ? 'border-red-300 bg-red-50' : data.comportamiento.nivelRiesgo === 'MEDIO' ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Nivel de riesgo del cliente
                      </div>
                      <Badge className={data.comportamiento.nivelRiesgo === 'ALTO' ? 'bg-red-100 text-red-800' : data.comportamiento.nivelRiesgo === 'MEDIO' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                        {data.comportamiento.nivelRiesgo}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{data.comportamiento.descripcion}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CheckCircle className="w-3 h-3" /> Puntualidad
                      </div>
                      <div className={`text-2xl font-bold ${data.comportamiento.puntualidad >= 80 ? 'text-green-600' : data.comportamiento.puntualidad >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {data.comportamiento.puntualidad}%
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {data.estadisticas.pagosPuntuales} puntuales · {data.estadisticas.pagosAtrasados} atrasados
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" /> Atraso promedio
                      </div>
                      <div className="text-2xl font-bold">{data.estadisticas.promedioDiasAtraso}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">días · máx {data.estadisticas.maxDiasAtraso}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <DollarSign className="w-3 h-3" /> Pago promedio
                      </div>
                      <div className="text-2xl font-bold">{formatearMoneda(data.estadisticas.promedioMontoPago)}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{data.estadisticas.totalPagosAplicados} pagos aplicados</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <FileText className="w-3 h-3" /> Activos
                      </div>
                      <div className="text-2xl font-bold">{data.estadisticas.prestamosActivos}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {data.estadisticas.prestamosEnMora > 0 && (
                          <span className="text-red-600">{data.estadisticas.prestamosEnMora} en mora · </span>
                        )}
                        saldo {formatearMoneda(data.estadisticas.saldoTotalActivos)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Distribución por estado */}
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-semibold mb-3">Distribución de préstamos por estado</div>
                    {Object.keys(data.estadisticas.distribucionEstados).length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin préstamos.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.estadisticas.distribucionEstados).map(([estado, count]) => (
                          <BadgeEstadoPrestamo key={estado} estado={estado} count={count} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* === PESTAÑA PAGOS === */}
              <TabsContent value="pagos">
                <Card>
                  <CardContent className="p-0">
                    {data.pagos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Este cliente no tiene pagos registrados.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Préstamo</TableHead>
                            <TableHead>Cuota</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.pagos.slice(0, 100).map((p) => {
                            const atrasado = p.fechaPago && p.fechaVencimiento &&
                              new Date(p.fechaPago).getTime() > new Date(p.fechaVencimiento).getTime()
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs">
                                  {p.fechaPago ? formatearFecha(p.fechaPago) : '—'}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.prestamoCodigo}</TableCell>
                                <TableCell className="text-xs">#{p.numeroCuota}</TableCell>
                                <TableCell className="text-xs">
                                  {formatearFecha(p.fechaVencimiento)}
                                  {atrasado && <span className="text-red-600 ml-1">⚠️</span>}
                                </TableCell>
                                <TableCell className="text-sm font-semibold">{formatearMoneda(p.montoTotal)}</TableCell>
                                <TableCell className="text-xs">{p.metodoPago}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    p.estado === 'APLICADO' ? 'bg-green-100 text-green-800' :
                                    p.estado === 'ANULADO' ? 'bg-gray-100 text-gray-700 line-through' :
                                    p.estado === 'REVERSADO' ? 'bg-red-100 text-red-800' : ''
                                  }>
                                    {p.estado}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {data.pagos.length > 100 && (
                      <div className="text-center py-2 text-xs text-muted-foreground">
                        Mostrando 100 de {data.pagos.length} pagos.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* === PESTAÑA FOTOS === */}
              <TabsContent value="fotos">
                {data.fotos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    Este cliente no tiene fotos de registro.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {data.fotos.map((foto) => (
                      <div key={foto.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="aspect-[4/3] bg-muted cursor-pointer relative group"
                          onClick={() => setFotoAmpliada(foto)}
                        >
                          {foto.archivoBase64 && (
                            <img
                              src={`data:${foto.archivoTipo || 'image/jpeg'};base64,${foto.archivoBase64}`}
                              alt={foto.titulo || foto.tipo}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white text-xs">Ampliar</span>
                          </div>
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-semibold">{etiquetaTipo(foto.tipo)}</div>
                          {foto.titulo && <div className="text-[10px] text-muted-foreground">{foto.titulo}</div>}
                          <div className="text-[10px] text-muted-foreground">{formatearFecha(foto.fechaSubida)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* === PESTAÑA BITÁCORA === */}
              <TabsContent value="bitacora" className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Eventos de préstamos ({data.bitacora.prestamosEventos.length})
                    </div>
                    {data.bitacora.prestamosEventos.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin eventos registrados.</div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {data.bitacora.prestamosEventos.map((e) => (
                          <div key={e.id} className="text-xs border-l-2 border-blue-400 pl-3 py-1">
                            <div className="font-semibold">{e.titulo}</div>
                            <div className="text-muted-foreground">{e.descripcion}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {e.prestamoCodigo} · {e.usuarioNombre} · {formatearFecha(e.fechaEvento)} · tipo: {e.tipo}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Accesos al portal ({data.bitacora.accesosPortal.length})
                    </div>
                    {data.bitacora.accesosPortal.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin accesos registrados al portal.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>Éxito</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.bitacora.accesosPortal.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="text-xs">{formatearFecha(a.createdAt)}</TableCell>
                              <TableCell className="text-xs font-mono">{a.ipOrigen || '—'}</TableCell>
                              <TableCell>
                                {a.exito ? (
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-600" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de foto ampliada */}
      {fotoAmpliada && (
        <Dialog open={true} onOpenChange={() => setFotoAmpliada(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{etiquetaTipo(fotoAmpliada.tipo)}</DialogTitle>
            </DialogHeader>
            {fotoAmpliada.archivoBase64 && (
              <img
                src={`data:${fotoAmpliada.archivoTipo || 'image/jpeg'};base64,${fotoAmpliada.archivoBase64}`}
                alt={fotoAmpliada.titulo || fotoAmpliada.tipo}
                className="w-full h-auto rounded"
              />
            )}
            <div className="text-xs text-muted-foreground">
              {fotoAmpliada.titulo && <div>{fotoAmpliada.titulo}</div>}
              {fotoAmpliada.descripcion && <div>{fotoAmpliada.descripcion}</div>}
              <div>Subido el {formatearFecha(fotoAmpliada.fechaSubida)} por {fotoAmpliada.subidoPor || '—'}</div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// =====================================================
// Componentes auxiliares
// =====================================================
function Field({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </Label>
      <div className={mono ? 'font-mono' : ''}>{value}</div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: 'green' | 'amber' | 'red' }) {
  const colorClass = color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : color === 'red' ? 'text-red-600' : ''
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon} {label}</div>
        <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function BadgeEstadoPrestamo({ estado, count }: { estado: string; count?: number }) {
  const cfg: Record<string, { label: string; className: string }> = {
    SOLICITUD: { label: 'Solicitud', className: 'bg-sky-100 text-sky-800' },
    PENDIENTE_ACEPTACION: { label: 'Pend. Aceptación', className: 'bg-cyan-100 text-cyan-800' },
    ACTIVO: { label: 'Activo', className: 'bg-emerald-100 text-emerald-800' },
    EN_MORA: { label: 'En Mora', className: 'bg-amber-100 text-amber-800' },
    JURIDICO: { label: 'Jurídico', className: 'bg-orange-100 text-orange-800' },
    CANCELADO: { label: 'Cancelado', className: 'bg-green-100 text-green-800' },
    RECHAZADO: { label: 'Rechazado', className: 'bg-red-100 text-red-800' },
  }
  const c = cfg[estado] || { label: estado, className: 'bg-gray-100 text-gray-800' }
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}{count !== undefined ? `: ${count}` : ''}
    </Badge>
  )
}

function etiquetaTipo(tipo: string): string {
  const map: Record<string, string> = {
    FOTO_DOCUMENTO: 'Documento',
    FOTO_CEDULA: 'Cédula (frente)',
    FOTO_SELFI: 'Selfie',
    FOTO_DOCUMENTO_REVERSO: 'Cédula (reverso)',
  }
  return map[tipo] || tipo
}
