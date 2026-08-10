'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda } from '@/lib/finanzas'
import {
  Settings,
  Building2,
  Tag,
  Gauge,
  Plus,
  Edit,
  Save,
  BarChart3,
  Calculator,
  Download,
  QrCode,
  Upload,
  Trash2,
  FileText,
} from 'lucide-react'
import { BotIcons } from '@/components/views/BotIcons'
import { ReportesUnificadoView } from '@/components/views/ReportesUnificadoView'
import { ExportarView } from '@/components/views/ExportarView'
import { ContabilidadUnificadaView } from '@/components/views/ContabilidadUnificadaView'
import { PlantillasPanel } from '@/components/views/PlantillasPanel'

export function AdminView({ onChanged }: { onChanged: () => void }) {
  const [tab, setTab] = useState('reportes')
  const { toast } = useToast()

  // Función que abre un préstamo despachando un CustomEvent global.
  // El componente page.tsx (o cualquier listener) puede capturar este evento
  // para mostrar el modal de detalle.
  const abrirPrestamo = (id: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('abrir-prestamo', { detail: { id } })
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración"
        subtitle="Reportes, configuración y gestión general del sistema"
        icon={<Settings className="w-5 h-5" />}
      />

      {/* === BOTS DISPONIBLES === */}
      <BotIcons modulo="admin" />

      <Tabs value={tab} onValueChange={setTab}>
        {/* FIX MOBILE (2026-08-05): TabsList horizontal con scroll en móvil, grid en desktop */}
        <TabsList className="flex overflow-x-auto whitespace-nowrap md:grid md:grid-cols-7 w-full no-scrollbar">
          <TabsTrigger value="reportes">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Reportes</span>
          </TabsTrigger>
          <TabsTrigger value="cuentas">
            <Building2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Cuentas</span>
          </TabsTrigger>
          <TabsTrigger value="categorias">
            <Tag className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Categorías</span>
          </TabsTrigger>
          <TabsTrigger value="control">
            <Gauge className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Control</span>
          </TabsTrigger>
          <TabsTrigger value="contabilidad">
            <Calculator className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Contabilidad y Plan</span>
          </TabsTrigger>
          <TabsTrigger value="plantillas">
            <FileText className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Plantillas</span>
          </TabsTrigger>
          <TabsTrigger value="exportar">
            <Download className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Exportar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reportes">
          <ReportesUnificadoView onAbrirPrestamo={abrirPrestamo} />
        </TabsContent>
        <TabsContent value="cuentas">
          <CuentasPanel onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriasPanel onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="control">
          <ControlPanel />
        </TabsContent>
        <TabsContent value="contabilidad">
          <ContabilidadUnificadaView />
        </TabsContent>
        <TabsContent value="plantillas">
          <PlantillasPanel />
        </TabsContent>
        <TabsContent value="exportar">
          <ExportarView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============== CUENTAS DE RECAUDO ==============
function CuentasPanel({ onChanged }: { onChanged: () => void }) {
  const [cuentas, setCuentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  // === Vista previa de cuenta (ORDEN OBLIGATORIA 3) ===
  // Tras crear/editar una cuenta, se abre este modal para mostrar el resultado
  // (incluyendo el QR cargado) y permitir verificar visualmente.
  const [cuentaPreview, setCuentaPreview] = useState<any | null>(null)
  const { toast } = useToast()

  // === Estado del formulario ===
  // qrImagen: data URL (base64) de la imagen QR cargada, o null si no hay
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    banco: '',
    tipoCuenta: 'AHORROS',
    numeroCuenta: '',
    titular: '',
    qrImagen: '' as string,
  })
  // Subiendo QR (mientras se lee el archivo)
  const [subiendoQr, setSubiendoQr] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    const res = await fetch('/api/cuentas')
    const json = await res.json()
    if (json.success) setCuentas(json.data)
    setLoading(false)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      codigo: '',
      nombre: '',
      banco: '',
      tipoCuenta: 'AHORROS',
      numeroCuenta: '',
      titular: '',
      qrImagen: '',
    })
    setModal(true)
  }

  const abrirEditar = (c: any) => {
    setEditando(c)
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      banco: c.banco,
      tipoCuenta: c.tipoCuenta,
      numeroCuenta: c.numeroCuenta,
      titular: c.titular,
      qrImagen: c.qrImagen || '',
    })
    setModal(true)
  }

  // === Cargar imagen QR desde el input file ===
  // Convierte el archivo a data URL (base64) y lo guarda en form.qrImagen
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'El archivo debe ser una imagen (PNG, JPG, etc.)', variant: 'destructive' })
      return
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen es demasiado grande (máximo 10MB)', variant: 'destructive' })
      return
    }

    setSubiendoQr(true)
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        setForm((prev) => ({ ...prev, qrImagen: result }))
        setSubiendoQr(false)
        toast({ title: 'QR cargado', description: 'La imagen se ha cargado correctamente. Guarda los cambios para confirmar.' })
      }
      reader.onerror = () => {
        setSubiendoQr(false)
        toast({ title: 'Error', description: 'No se pudo leer el archivo', variant: 'destructive' })
      }
      reader.readAsDataURL(file)
    } catch (e: any) {
      setSubiendoQr(false)
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const limpiarQr = () => {
    setForm((prev) => ({ ...prev, qrImagen: '' }))
    toast({ title: 'QR eliminado', description: 'Guarda los cambios para confirmar.' })
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = '/api/cuentas'
      const method = editando ? 'PATCH' : 'POST'
      const body = editando ? { id: editando.id, ...form } : form
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: editando ? 'Cuenta actualizada' : 'Cuenta creada' })
        setModal(false)
        cargar()
        onChanged()
        // === ORDEN OBLIGATORIA 3: Abrir vista previa siempre que se termina un proceso ===
        // Tras crear/actualizar la cuenta, abrir el modal de vista previa para que el
        // administrador verifique los datos y el QR cargado (igual que lo verá el cliente).
        if (json.data) {
          setTimeout(() => {
            setCuentaPreview(json.data)
          }, 300)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Cuentas de Recaudo (4 categorías)</CardTitle>
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>N° Cuenta</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead className="text-center">QR</TableHead>
              <TableHead className="text-center">Pagos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : cuentas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                  No hay cuentas registradas
                </TableCell>
              </TableRow>
            ) : (
              cuentas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="text-sm">{c.nombre}</TableCell>
                  <TableCell className="text-sm">{c.banco}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.tipoCuenta}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.numeroCuenta}</TableCell>
                  <TableCell className="text-sm">{c.titular}</TableCell>
                  <TableCell className="text-center">
                    {c.qrImagen ? (
                      <div className="flex items-center justify-center">
                        <img
                          src={c.qrImagen}
                          alt={`QR ${c.codigo}`}
                          className="w-10 h-10 object-contain rounded border border-border"
                          title="QR cargado"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin QR</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{c._count.pagos}</TableCell>
                  <TableCell>
                    <Badge variant={c.activa ? 'default' : 'secondary'}>
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Cuenta' : 'Nueva Cuenta de Recaudo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  required
                  disabled={!!editando}
                  placeholder="CTA-5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipoCuenta}
                  onValueChange={(v) => setForm({ ...form, tipoCuenta: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AHORROS">Ahorros</SelectItem>
                    <SelectItem value="CORRIENTE">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Número de cuenta</Label>
                <Input
                  value={form.numeroCuenta}
                  onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Titular</Label>
                <Input
                  value={form.titular}
                  onChange={(e) => setForm({ ...form, titular: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* === SECCIÓN QR DE LA CUENTA === */}
            <div className="space-y-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                Código QR de la cuenta
              </Label>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Carga una imagen QR que los clientes podrán escanear desde el portal del cliente al momento de realizar pagos.
              </p>

              {form.qrImagen ? (
                <div className="flex items-center gap-3">
                  <img
                    src={form.qrImagen}
                    alt="QR preview"
                    className="w-24 h-24 object-contain rounded border border-blue-300 dark:border-blue-700 bg-white p-1"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                      ✓ QR cargado correctamente
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('qr-upload-input')?.click()}
                        disabled={subiendoQr}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Cambiar QR
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={limpiarQr}
                        disabled={subiendoQr}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-md">
                  <QrCode className="w-8 h-8 text-blue-400" />
                  <p className="text-xs text-muted-foreground text-center">
                    {subiendoQr ? 'Cargando...' : 'Arrastra una imagen o haz clic para subir un QR'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById('qr-upload-input')?.click()}
                    disabled={subiendoQr}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Subir QR
                  </Button>
                </div>
              )}

              {/* Input file oculto — se activa con los botones de arriba */}
              <input
                id="qr-upload-input"
                type="file"
                accept="image/*"
                onChange={handleQrUpload}
                className="hidden"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === VISTA PREVIA DE CUENTA (ORDEN OBLIGATORIA 3) ===
          Tras guardar, mostrar la cuenta tal como la verá el cliente en el portal:
          QR grande, datos bancarios, código y estado. Permite verificar visualmente
          antes de cerrar. */}
      <Dialog open={!!cuentaPreview} onOpenChange={(open) => !open && setCuentaPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Vista previa de la cuenta
            </DialogTitle>
          </DialogHeader>
          {cuentaPreview && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="outline" className="font-mono mb-2">
                  {cuentaPreview.codigo}
                </Badge>
                <h3 className="font-bold text-lg">{cuentaPreview.nombre}</h3>
                <p className="text-sm text-muted-foreground">
                  {cuentaPreview.banco} · {cuentaPreview.tipoCuenta}
                </p>
              </div>

              {cuentaPreview.qrImagen ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
                    <img
                      src={cuentaPreview.qrImagen}
                      alt={`QR ${cuentaPreview.codigo}`}
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
                    Este QR será visible para los clientes en el portal al realizar pagos.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center p-6 bg-muted/30 rounded-lg border border-border">
                  <QrCode className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Esta cuenta aún no tiene QR cargado.
                  </p>
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Número de cuenta:</span>
                  <span className="font-mono font-semibold">{cuentaPreview.numeroCuenta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Titular:</span>
                  <span className="font-semibold">{cuentaPreview.titular}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge variant={cuentaPreview.activa ? 'default' : 'secondary'}>
                    {cuentaPreview.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" onClick={() => setCuentaPreview(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============== CATEGORÍAS DE CLIENTE ==============
function CategoriasPanel({ onChanged }: { onChanged: () => void }) {
  const [categorias, setCategorias] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    montoMinimo: '',
    montoMaximo: '',
    tasaInteresAnual: '',
    tasaMoraAnual: '',
    descripcion: '',
    cuentaRecaudoId: '',
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    const [res1, res2] = await Promise.all([
      fetch('/api/categorias'),
      fetch('/api/cuentas'),
    ])
    const [j1, j2] = await Promise.all([res1.json(), res2.json()])
    if (j1.success) setCategorias(j1.data)
    if (j2.success) setCuentas(j2.data)
    setLoading(false)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      codigo: '',
      nombre: '',
      montoMinimo: '',
      montoMaximo: '',
      tasaInteresAnual: '',
      tasaMoraAnual: '',
      descripcion: '',
      cuentaRecaudoId: '',
    })
    setModal(true)
  }

  const abrirEditar = (c: any) => {
    setEditando(c)
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      montoMinimo: c.montoMinimo.toString(),
      montoMaximo: c.montoMaximo.toString(),
      tasaInteresAnual: c.tasaInteresAnual.toString(),
      tasaMoraAnual: c.tasaMoraAnual.toString(),
      descripcion: c.descripcion || '',
      cuentaRecaudoId: c.cuentaRecaudoId || '',
    })
    setModal(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editando ? 'PATCH' : 'POST'
      const body = editando ? { id: editando.id, ...form } : form
      const res = await fetch('/api/categorias', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: editando ? 'Categoría actualizada' : 'Categoría creada' })
        setModal(false)
        cargar()
        onChanged()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Categorías de Cliente</CardTitle>
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Categoría
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Monto Min</TableHead>
              <TableHead>Monto Max</TableHead>
              <TableHead>Tasa Anual</TableHead>
              <TableHead>Tasa Mora</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : (
              categorias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="text-sm font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-xs">{formatearMoneda(c.montoMinimo)}</TableCell>
                  <TableCell className="text-xs">{formatearMoneda(c.montoMaximo)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-blue-700">{c.tasaInteresAnual}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-amber-700">{c.tasaMoraAnual}%</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.cuentaRecaudo?.nombre || '—'}</TableCell>
                  <TableCell className="text-center">{c._count.clientes}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Categoría' : 'Nueva Categoría de Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  required
                  disabled={!!editando}
                  placeholder="CAT-5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monto mínimo (COP)</Label>
                <Input
                  type="number"
                  value={form.montoMinimo}
                  onChange={(e) => setForm({ ...form, montoMinimo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monto máximo (COP)</Label>
                <Input
                  type="number"
                  value={form.montoMaximo}
                  onChange={(e) => setForm({ ...form, montoMaximo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tasa interés anual (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tasaInteresAnual}
                  onChange={(e) => setForm({ ...form, tasaInteresAnual: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tasa mora anual (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tasaMoraAnual}
                  onChange={(e) => setForm({ ...form, tasaMoraAnual: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Cuenta de recaudo asignada</Label>
                <Select
                  value={form.cuentaRecaudoId}
                  onValueChange={(v) => setForm({ ...form, cuentaRecaudoId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nombre} ({c.banco})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============== CONTROL GENERAL ==============
function ControlPanel() {
  const [config, setConfig] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    // Usamos la API de configuración (a través de prisma directamente)
    const res = await fetch('/api/admin')
    const json = await res.json()
    if (json.success) setConfig(json.data.configuraciones)
    setLoading(false)
  }

  const guardar = async (clave: string, valor: string) => {
    try {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor }),
      })
      toast({ title: 'Configuración actualizada' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración General del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.map((c: any) => (
            <ConfigItem
              key={c.id}
              clave={c.clave}
              valor={c.valor}
              descripcion={c.descripcion}
              onSave={guardar}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-5">
          <h4 className="font-semibold text-primary mb-2">ℹ️ Parámetros del Sistema</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>
              <strong>DIAS_JURIDICO:</strong> Días de mora para iniciar automáticamente el cobro jurídico (default: 60).
            </li>
            <li>
              <strong>TASA_MORA_DEFAULT:</strong> Tasa moratoria anual por defecto para nuevos préstamos.
            </li>
            <li>
              <strong>FONDO_GARANTIA_PCT:</strong> Porcentaje del primer préstamo que se carga al Fondo de Garantía (default: 5%).
            </li>
            <li>
              <strong>MORA_COMPUESTA:</strong> Activa el cálculo de mora compuesta diaria (recomendado: true).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function ConfigItem({
  clave,
  valor,
  descripcion,
  onSave,
}: {
  clave: string
  valor: string
  descripcion: string | null
  onSave: (clave: string, valor: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [nuevoValor, setNuevoValor] = useState(valor)

  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <div className="flex-1">
        <p className="font-medium text-sm">{clave}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <div className="flex items-center gap-2">
        {editando ? (
          <>
            <Input
              value={nuevoValor}
              onChange={(e) => setNuevoValor(e.target.value)}
              className="w-40"
            />
            <Button
              size="sm"
              onClick={() => {
                onSave(clave, nuevoValor)
                setEditando(false)
              }}
            >
              <Save className="w-3 h-3" />
            </Button>
          </>
        ) : (
          <>
            <Badge variant="outline" className="font-mono">{valor}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
              <Edit className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
