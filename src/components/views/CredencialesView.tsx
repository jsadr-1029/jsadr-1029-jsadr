'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  Key,
  Lock,
  Unlock,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  UserX,
  UserCheck,
  Users,
  ShieldCheck,
  Smartphone,
  Mail,
  MessageCircle,
  History,
  Plus,
  Copy,
  Ban,
  LogOut,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'

// =====================================================
// CredencialesView
// Sub-módulo dentro de Seguridad que permite al gestor:
//  1. Ver las credenciales de inicio de sesión de los clientes (cédula + estado de la clave)
//  2. Crear o resetear la clave cuando el cliente la olvida
//  3. Desbloquear claves / PINs bloqueados por intentos fallidos
//  4. Revocar sesiones activas del portal
//  5. Generar OTPs manuales para un cliente
//  6. Consultar el historial consolidado de OTPs (firma, chat, portal, manual)
// =====================================================

interface ClienteCred {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string | null
  activo: boolean
  tieneClave: boolean
  claveCreatedAt: string | null
  claveIntentos: number
  claveBloqueada: boolean
  claveBloqueadoHasta: string | null
  tienePin: boolean
  pinCreatedAt: string | null
  pinIntentos: number
  pinBloqueado: boolean
  pinBloqueadoHasta: string | null
  ultimoAccesoPortal: string | null
  createdAt: string
}

interface OtpItem {
  id: string
  fuente: string
  tipo: string
  metodo: string
  destinatario: string
  descripcion: string | null
  verificado: boolean
  usado: boolean
  bloqueado: boolean
  intentos: number
  maxIntentos: number
  expiraEn: string | null
  ipSolicitud: string | null
  userAgent: string | null
  fechaVerificacion: string | null
  createdAt: string
  codigoPlano?: string | null
}

export function CredencialesView() {
  const [tab, setTab] = useState('lista')
  const [busqueda, setBusqueda] = useState('')
  const [soloBloqueados, setSoloBloqueados] = useState(false)
  const [soloConClave, setSoloConClave] = useState(false)
  const [clientes, setClientes] = useState<ClienteCred[]>([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<any>(null)

  // Modal crear/resetear clave
  const [modalClave, setModalClave] = useState(false)
  const [clienteSel, setClienteSel] = useState<ClienteCred | null>(null)
  const [nuevaClave, setNuevaClave] = useState('')
  const [confirmarClave, setConfirmarClave] = useState('')
  const [motivoClave, setMotivoClave] = useState('')
  const [showClave, setShowClave] = useState(false)
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [autoGenerar, setAutoGenerar] = useState(false)

  // Modal detalle cliente (con OTPs)
  const [modalDetalle, setModalDetalle] = useState(false)
  const [detalleCliente, setDetalleCliente] = useState<any>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [otpsDetalle, setOtpsDetalle] = useState<OtpItem[]>([])

  // Modal generar OTP manual
  const [modalOtp, setModalOtp] = useState(false)
  const [otpMetodo, setOtpMetodo] = useState('WHATSAPP')
  const [otpDestinatario, setOtpDestinatario] = useState('')
  const [otpDescripcion, setOtpDescripcion] = useState('')
  const [otpGenerado, setOtpGenerado] = useState<string | null>(null)
  const [generandoOtp, setGenerandoOtp] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    cargarClientes()
  }, [busqueda, soloBloqueados, soloConClave])

  const cargarClientes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (busqueda) params.set('q', busqueda)
      if (soloBloqueados) params.set('soloBloqueados', 'true')
      if (soloConClave) params.set('soloConClave', 'true')
      const res = await fetch(`/api/seguridad/credenciales?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setClientes(json.data)
        setResumen(json.resumen)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const abrirModalClave = (c: ClienteCred) => {
    setClienteSel(c)
    setNuevaClave('')
    setConfirmarClave('')
    setMotivoClave(c.tieneClave ? 'Cliente olvidó su clave' : '')
    setShowClave(false)
    setAutoGenerar(false)
    setModalClave(true)
  }

  const generarClaveAleatoria = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
    let clave = ''
    const arr = new Uint8Array(10)
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(arr)
    } else {
      for (let i = 0; i < 10; i++) arr[i] = Math.floor(Math.random() * 256)
    }
    for (let i = 0; i < 10; i++) {
      clave += chars[arr[i] % chars.length]
    }
    setNuevaClave(clave)
    setConfirmarClave(clave)
    setAutoGenerar(true)
  }

  const copiarAlPortapapeles = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast({ title: 'Copiado', description: 'Clave copiada al portapapeles' })
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  const guardarClave = async () => {
    if (!clienteSel) return
    if (nuevaClave.length < 6) {
      toast({
        title: 'Clave muy corta',
        description: 'Mínimo 6 caracteres',
        variant: 'destructive',
      })
      return
    }
    if (nuevaClave !== confirmarClave) {
      toast({
        title: 'Las claves no coinciden',
        variant: 'destructive',
      })
      return
    }
    if (motivoClave.trim().length < 5) {
      toast({
        title: 'Motivo requerido',
        description: 'Explica por qué cambias la clave (mínimo 5 caracteres)',
        variant: 'destructive',
      })
      return
    }
    setGuardandoClave(true)
    try {
      const res = await fetch('/api/seguridad/credenciales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteSel.id,
          nuevaClave,
          motivo: motivoClave.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: clienteSel.tieneClave ? 'Clave regenerada' : 'Clave creada',
          description: json.mensaje,
        })
        setModalClave(false)
        cargarClientes()
        // Si fue auto-generada, mostrar la clave para que se la comuniquen al cliente
        if (autoGenerar) {
          toast({
            title: '🔐 Clave generada',
            description: `Comunica al cliente esta clave: ${nuevaClave}`,
            duration: 10000,
          })
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoClave(false)
    }
  }

  const abrirDetalle = async (c: ClienteCred) => {
    setClienteSel(c)
    setModalDetalle(true)
    setLoadingDetalle(true)
    setOtpsDetalle([])
    setDetalleCliente(null)
    try {
      const res = await fetch(`/api/seguridad/credenciales/${c.id}`)
      const json = await res.json()
      if (json.success) {
        setDetalleCliente(json.data)
        setOtpsDetalle(json.data.otps || [])
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoadingDetalle(false)
    }
  }

  const accionCliente = async (
    c: ClienteCred,
    accion: string,
    extra?: any
  ) => {
    try {
      const res = await fetch(`/api/seguridad/credenciales/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Acción realizada', description: json.mensaje })
        cargarClientes()
        // Si el modal de detalle está abierto, refrescar
        if (modalDetalle && clienteSel?.id === c.id) {
          abrirDetalle(c)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const abrirModalOtp = (c: ClienteCred) => {
    setClienteSel(c)
    setOtpMetodo('WHATSAPP')
    setOtpDestinatario(c.telefono || '')
    setOtpDescripcion(`OTP manual generado por gestor para ${c.nombre}`)
    setOtpGenerado(null)
    setModalOtp(true)
  }

  const generarOtp = async () => {
    if (!clienteSel) return
    if (!otpDestinatario.trim()) {
      toast({ title: 'Destinatario requerido', variant: 'destructive' })
      return
    }
    setGenerandoOtp(true)
    try {
      const res = await fetch(`/api/seguridad/credenciales/${clienteSel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'generar_otp',
          metodo: otpMetodo,
          destinatario: otpDestinatario.trim(),
          descripcion: otpDescripcion.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'OTP generado', description: json.mensaje })
        // Extraer el código del mensaje (formato: "OTP generado para X. Código: NNNNNN...")
        const match = json.mensaje.match(/Código:\s*(\d+)/)
        if (match) setOtpGenerado(match[1])
        cargarClientes()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerandoOtp(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-blue-600 mb-1" />
              <p className="text-xs text-muted-foreground">Total clientes</p>
              <p className="text-xl font-bold text-blue-700">{resumen.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Key className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
              <p className="text-xs text-muted-foreground">Con clave</p>
              <p className="text-xl font-bold text-emerald-700">{resumen.conClave}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <UserX className="w-6 h-6 mx-auto text-amber-600 mb-1" />
              <p className="text-xs text-muted-foreground">Sin clave</p>
              <p className="text-xl font-bold text-amber-700">{resumen.sinClave}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Lock className="w-6 h-6 mx-auto text-red-600 mb-1" />
              <p className="text-xs text-muted-foreground">Bloqueados</p>
              <p className="text-xl font-bold text-red-700">{resumen.bloqueados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Smartphone className="w-6 h-6 mx-auto text-purple-600 mb-1" />
              <p className="text-xs text-muted-foreground">Con PIN</p>
              <p className="text-xl font-bold text-purple-700">{resumen.conPin}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cédula, teléfono o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={soloBloqueados}
                onCheckedChange={setSoloBloqueados}
                id="soloBloqueados"
              />
              <Label htmlFor="soloBloqueados" className="text-sm cursor-pointer">
                Solo bloqueados
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={soloConClave}
                onCheckedChange={setSoloConClave}
                id="soloConClave"
              />
              <Label htmlFor="soloConClave" className="text-sm cursor-pointer">
                Solo con clave
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={cargarClientes}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Recargar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            Credenciales de clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron clientes con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => (
                  <TableRow key={c.id} className={c.claveBloqueada ? 'bg-red-50/30' : ''}>
                    <TableCell>
                      <div className="font-semibold text-sm">{c.nombre}</div>
                      <div className="text-xs text-muted-foreground">{c.telefono}</div>
                      {c.email && (
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.cedula}</TableCell>
                    <TableCell>
                      {c.tieneClave ? (
                        c.claveBloqueada ? (
                          <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                            <Unlock className="w-3 h-3 mr-1" />
                            Activa
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                          <UserX className="w-3 h-3 mr-1" />
                          Sin clave
                        </Badge>
                      )}
                      {c.tieneClave && c.claveCreatedAt && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatearFecha(c.claveCreatedAt)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.tienePin ? (
                        c.pinBloqueado ? (
                          <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                            <Smartphone className="w-3 h-3 mr-1" />
                            Configurado
                          </Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.ultimoAccesoPortal ? (
                        formatearFechaHora(c.ultimoAccesoPortal)
                      ) : (
                        <span className="text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-blue-700 hover:bg-blue-50"
                          onClick={() => abrirDetalle(c)}
                          title="Ver detalle + OTPs"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => abrirModalClave(c)}
                          title={c.tieneClave ? 'Resetear clave' : 'Crear clave'}
                        >
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-purple-700 hover:bg-purple-50"
                          onClick={() => abrirModalOtp(c)}
                          title="Generar OTP manual"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                        {c.claveBloqueada && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-amber-700 hover:bg-amber-50"
                            onClick={() => accionCliente(c, 'desbloquear')}
                            title="Desbloquear clave"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {c.pinBloqueado && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-amber-700 hover:bg-amber-50"
                            onClick={() => accionCliente(c, 'desbloquear_pin')}
                            title="Desbloquear PIN"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ===== MODAL CREAR/RESETEAR CLAVE ===== */}
      <Dialog open={modalClave} onOpenChange={setModalClave}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" />
              {clienteSel?.tieneClave ? 'Resetear clave del cliente' : 'Crear clave al cliente'}
            </DialogTitle>
          </DialogHeader>
          {clienteSel && (
            <div className="space-y-4">
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <p><strong>Cliente:</strong> {clienteSel.nombre}</p>
                <p><strong>Cédula:</strong> {clienteSel.cedula}</p>
                <p><strong>Teléfono:</strong> {clienteSel.telefono}</p>
                <p><strong>Estado actual:</strong>{' '}
                  {clienteSel.tieneClave ? (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 ml-1">
                      Con clave activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 ml-1">
                      Sin clave
                    </Badge>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <Label htmlFor="autoGenerar" className="text-sm cursor-pointer">
                  Generar clave aleatoria automáticamente
                </Label>
                <Switch
                  id="autoGenerar"
                  checked={autoGenerar}
                  onCheckedChange={(checked) => {
                    setAutoGenerar(checked)
                    if (checked) generarClaveAleatoria()
                    else {
                      setNuevaClave('')
                      setConfirmarClave('')
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Nueva clave *</Label>
                <div className="relative">
                  <Input
                    type={showClave ? 'text' : 'password'}
                    value={nuevaClave}
                    onChange={(e) => {
                      setNuevaClave(e.target.value)
                      if (autoGenerar) setAutoGenerar(false)
                    }}
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {nuevaClave && (
                      <button
                        type="button"
                        onClick={() => copiarAlPortapapeles(nuevaClave)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copiar"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClave(!showClave)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {autoGenerar && (
                  <p className="text-xs text-violet-700 bg-violet-50 p-2 rounded">
                    🔐 Clave generada. Comunícala al cliente por un canal seguro (WhatsApp privado o llamada).
                  </p>
                )}
              </div>

              {!autoGenerar && (
                <div className="space-y-2">
                  <Label>Confirmar clave *</Label>
                  <Input
                    type={showClave ? 'text' : 'password'}
                    value={confirmarClave}
                    onChange={(e) => setConfirmarClave(e.target.value)}
                    minLength={6}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Motivo del cambio *</Label>
                <Textarea
                  value={motivoClave}
                  onChange={(e) => setMotivoClave(e.target.value)}
                  rows={2}
                  placeholder="Ej: Cliente olvidó su clave, cliente bloqueado por intentos fallidos, primera vez..."
                />
                <p className="text-xs text-muted-foreground">
                  Este motivo queda registrado en el audit log inmutable.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalClave(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={guardarClave}
                  disabled={guardandoClave || nuevaClave.length < 6}
                >
                  {guardandoClave ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      {clienteSel.tieneClave ? 'Resetear clave' : 'Crear clave'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== MODAL DETALLE CLIENTE + OTPs ===== */}
      <Dialog open={modalDetalle} onOpenChange={setModalDetalle}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Detalle de credenciales y OTPs
            </DialogTitle>
          </DialogHeader>
          {clienteSel && (
            <div className="space-y-4">
              {loadingDetalle ? (
                <div className="text-center py-12 text-muted-foreground">
                  Cargando detalle...
                </div>
              ) : detalleCliente ? (
                <>
                  {/* Info del cliente */}
                  <div className="p-3 rounded bg-muted/50 border space-y-1 text-sm">
                    <div className="font-semibold text-base">{detalleCliente.nombre}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Cédula:</span>{' '}
                        <strong>{detalleCliente.cedula}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Teléfono:</span>{' '}
                        <strong>{detalleCliente.telefono}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Email:</span>{' '}
                        <strong>{detalleCliente.email || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Activo:</span>{' '}
                        <strong>{detalleCliente.activo ? 'Sí' : 'No'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Estado de credenciales */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="border-emerald-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Key className="w-4 h-4 text-emerald-700" />
                          Clave alfanumérica
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        {detalleCliente.tieneClave ? (
                          <>
                            <div className="flex justify-between">
                              <span>Estado:</span>
                              {detalleCliente.claveBloqueada ? (
                                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                                  Bloqueada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                                  Activa
                                </Badge>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span>Creada:</span>
                              <strong>{formatearFechaHora(detalleCliente.claveCreatedAt)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Intentos fallidos:</span>
                              <strong>{detalleCliente.claveIntentos}</strong>
                            </div>
                            {detalleCliente.claveBloqueadoHasta && (
                              <div className="flex justify-between">
                                <span>Bloqueada hasta:</span>
                                <strong className="text-red-700">
                                  {formatearFechaHora(detalleCliente.claveBloqueadoHasta)}
                                </strong>
                              </div>
                            )}
                            <div className="flex gap-1 mt-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => abrirModalClave(clienteSel)}
                              >
                                <Key className="w-3 h-3 mr-1" /> Resetear
                              </Button>
                              {detalleCliente.claveBloqueada && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => accionCliente(clienteSel, 'desbloquear')}
                                >
                                  <Unlock className="w-3 h-3 mr-1" /> Desbloquear
                                </Button>
                              )}
                              {detalleCliente.tieneSesionActiva && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                  onClick={() => accionCliente(clienteSel, 'revocar_sesion')}
                                >
                                  <LogOut className="w-3 h-3 mr-1" /> Cerrar sesión
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('¿Eliminar la clave del cliente? Tendrá que crear una nueva.')) {
                                    accionCliente(clienteSel, 'eliminar_clave')
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              Sin clave
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => abrirModalClave(clienteSel)}
                            >
                              <Key className="w-3 h-3 mr-1" /> Crear clave
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-700" />
                          PIN del portal (4 dígitos)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        {detalleCliente.tienePin ? (
                          <>
                            <div className="flex justify-between">
                              <span>Estado:</span>
                              {detalleCliente.pinBloqueado ? (
                                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                                  Bloqueado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                                  Configurado
                                </Badge>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span>Creado:</span>
                              <strong>{formatearFechaHora(detalleCliente.pinCreatedAt)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Intentos fallidos:</span>
                              <strong>{detalleCliente.pinIntentos}</strong>
                            </div>
                            {detalleCliente.pinBloqueadoHasta && (
                              <div className="flex justify-between">
                                <span>Bloqueado hasta:</span>
                                <strong className="text-red-700">
                                  {formatearFechaHora(detalleCliente.pinBloqueadoHasta)}
                                </strong>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Último acceso:</span>
                              <strong>
                                {detalleCliente.ultimoAccesoPortal
                                  ? formatearFechaHora(detalleCliente.ultimoAccesoPortal)
                                  : 'Nunca'}
                              </strong>
                            </div>
                            {detalleCliente.pinBloqueado && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => accionCliente(clienteSel, 'desbloquear_pin')}
                              >
                                <Unlock className="w-3 h-3 mr-1" /> Desbloquear PIN
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              Sin PIN
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              El PIN se crea desde el portal del cliente
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Resumen OTPs */}
                  {detalleCliente.otpsResumen && (
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2 bg-muted/30 rounded text-center">
                        <div className="text-xs text-muted-foreground">Total OTPs</div>
                        <div className="text-lg font-bold">{detalleCliente.otpsResumen.total}</div>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">Verificados</div>
                        <div className="text-lg font-bold text-emerald-700">
                          {detalleCliente.otpsResumen.verificados}
                        </div>
                      </div>
                      <div className="p-2 bg-amber-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">Pendientes</div>
                        <div className="text-lg font-bold text-amber-700">
                          {detalleCliente.otpsResumen.pendientes}
                        </div>
                      </div>
                      <div className="p-2 bg-red-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">Bloqueados</div>
                        <div className="text-lg font-bold text-red-700">
                          {detalleCliente.otpsResumen.bloqueados}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabla de OTPs */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Historial de OTPs generados
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card">
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Fuente</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead>Destinatario</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Intentos</TableHead>
                              {otpsDetalle.some((o) => o.codigoPlano) && (
                                <TableHead>Código</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {otpsDetalle.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                                  No se han generado OTPs para este cliente
                                </TableCell>
                              </TableRow>
                            ) : (
                              otpsDetalle.map((o) => (
                                <TableRow key={`${o.fuente}-${o.id}`}>
                                  <TableCell className="text-xs">
                                    {formatearFechaHora(o.createdAt)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        o.fuente === 'FIRMA_ELECTRONICA'
                                          ? 'text-violet-700 border-violet-300 bg-violet-50 text-[10px]'
                                          : o.fuente === 'OTP_CHAT'
                                          ? 'text-blue-700 border-blue-300 bg-blue-50 text-[10px]'
                                          : 'text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]'
                                      }
                                    >
                                      {o.fuente === 'FIRMA_ELECTRONICA' && 'Firma'}
                                      {o.fuente === 'OTP_CHAT' && 'Chat'}
                                      {o.fuente === 'OTP_REGISTRO' && 'Registro'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-1">
                                      {o.metodo === 'WHATSAPP' && <MessageCircle className="w-3 h-3 text-emerald-600" />}
                                      {o.metodo === 'EMAIL' && <Mail className="w-3 h-3 text-blue-600" />}
                                      {o.metodo === 'AMBOS' && (
                                        <>
                                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                                          <Mail className="w-3 h-3 text-blue-600" />
                                        </>
                                      )}
                                      {o.metodo}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">
                                    {o.destinatario}
                                  </TableCell>
                                  <TableCell>
                                    {o.verificado ? (
                                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Verificado
                                      </Badge>
                                    ) : o.bloqueado ? (
                                      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">
                                        <Ban className="w-3 h-3 mr-1" /> Bloqueado
                                      </Badge>
                                    ) : o.expiraEn && new Date(o.expiraEn) > new Date() ? (
                                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                                        <Clock className="w-3 h-3 mr-1" /> Pendiente
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-gray-700 text-[10px]">
                                        <XCircle className="w-3 h-3 mr-1" /> Expirado
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {o.intentos}/{o.maxIntentos}
                                  </TableCell>
                                  {otpsDetalle.some((oo) => oo.codigoPlano) && (
                                    <TableCell className="text-xs font-mono">
                                      {o.codigoPlano || '—'}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No se pudo cargar el detalle
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== MODAL GENERAR OTP MANUAL ===== */}
      <Dialog open={modalOtp} onOpenChange={setModalOtp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              Generar OTP manual
            </DialogTitle>
          </DialogHeader>
          {clienteSel && (
            <div className="space-y-4">
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <p><strong>Cliente:</strong> {clienteSel.nombre}</p>
                <p><strong>Cédula:</strong> {clienteSel.cedula}</p>
                <p><strong>Teléfono:</strong> {clienteSel.telefono}</p>
              </div>

              {otpGenerado ? (
                <div className="space-y-3">
                  <div className="p-4 rounded bg-emerald-50 border-2 border-emerald-300 text-center">
                    <div className="text-xs text-emerald-700 mb-1">OTP generado (válido 5 minutos)</div>
                    <div className="text-4xl font-mono font-bold text-emerald-800 tracking-widest">
                      {otpGenerado}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => copiarAlPortapapeles(otpGenerado)}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comunica este código al cliente por un canal seguro. El código queda registrado en el historial de OTPs del cliente.
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      setModalOtp(false)
                      setOtpGenerado(null)
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Método de envío *</Label>
                    <Select value={otpMetodo} onValueChange={setOtpMetodo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="AMBOS">Ambos (WhatsApp + Email)</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Destinatario *</Label>
                    <Input
                      value={otpDestinatario}
                      onChange={(e) => setOtpDestinatario(e.target.value)}
                      placeholder="Número de teléfono o email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción (opcional)</Label>
                    <Textarea
                      value={otpDescripcion}
                      onChange={(e) => setOtpDescripcion(e.target.value)}
                      rows={2}
                      placeholder="Motivo del OTP (ej: verificación manual de identidad)"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setModalOtp(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={generarOtp}
                      disabled={generandoOtp || !otpDestinatario.trim()}
                    >
                      {generandoOtp ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Generar OTP
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
