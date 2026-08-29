'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFechaHora } from '@/lib/finanzas'
import { Wallet, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Caja {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  saldoActual: number
  totalIngresos: number
  totalEgresos: number
  movimientos: any[]
  _count: { movimientos: number }
}

export function CajasView({ onChanged }: { onChanged: () => void }) {
  const [cajas, setCajas] = useState<Caja[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [cajaSeleccionada, setCajaSeleccionada] = useState<string>('')
  const { toast } = useToast()

  // Form movimiento
  const [tipo, setTipo] = useState('INGRESO')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [referencia, setReferencia] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/cajas')
      const json = await res.json()
      if (json.success) setCajas(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const abrirModalMovimiento = (cajaId: string) => {
    setCajaSeleccionada(cajaId)
    setTipo('INGRESO')
    setMonto('')
    setConcepto('')
    setReferencia('')
    setModalMovimiento(true)
  }

  const registrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/cajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cajaId: cajaSeleccionada,
          tipo,
          monto,
          concepto,
          referencia,
          creadoPor: 'Administrador',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Movimiento registrado' })
        setModalMovimiento(false)
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
    <div className="space-y-6">
      <PageHeader
        title="Cajas Menores"
        subtitle="Contabilidad de Caja de Mora, Fondo de Garantía, Flexibilidad Financiera, Ingresos Causados, Pagaré + Carta y Uso Plataforma"
        icon={<Wallet className="w-5 h-5" />}
      />

      {/* Tarjetas resumen de cajas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <>
            <div className="h-40 bg-muted animate-pulse rounded-lg" />
            <div className="h-40 bg-muted animate-pulse rounded-lg" />
          </>
        ) : (
          cajas.map((caja) => (
            <Card key={caja.id} className="overflow-hidden">
              <CardHeader className="bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      {caja.nombre}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{caja.descripcion}</p>
                  </div>
                  <Badge variant="outline">{caja.codigo}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Saldo Actual</p>
                    <p className="text-lg font-bold text-primary">
                      {formatearMoneda(caja.saldoActual)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Ingresos</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {formatearMoneda(caja.totalIngresos)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Egresos</p>
                    <p className="text-sm font-bold text-red-700">
                      {formatearMoneda(caja.totalEgresos)}
                    </p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => abrirModalMovimiento(caja.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Movimiento
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detalle de movimientos por caja */}
      <Tabs defaultValue={cajas[0]?.id || ''}>
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${cajas.length}, 1fr)` }}>
          {cajas.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.nombre.split(' ')[1] || c.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {cajas.map((caja) => (
          <TabsContent key={caja.id} value={caja.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Movimientos - {caja.nombre}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({caja._count.movimientos} total)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {caja.movimientos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Sin movimientos recientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      caja.movimientos.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">
                            {formatearFechaHora(m.fechaMovimiento)}
                          </TableCell>
                          <TableCell>
                            {m.tipo === 'INGRESO' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                                <ArrowUpRight className="w-3 h-3" />
                                Ingreso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium">
                                <ArrowDownRight className="w-3 h-3" />
                                Egreso
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{m.concepto}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.referencia || '—'}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              m.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {m.tipo === 'INGRESO' ? '+' : '-'}
                            {formatearMoneda(m.monto)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal movimiento */}
      <Dialog open={modalMovimiento} onOpenChange={setModalMovimiento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={registrarMovimiento} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Ingreso
                    </span>
                  </SelectItem>
                  <SelectItem value="EGRESO">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      Egreso
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto (COP)</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto</Label>
              <Textarea
                id="concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                required
                rows={2}
                placeholder="Descripción del movimiento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referencia">Referencia (opcional)</Label>
              <Input
                id="referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Código de solicitud, factura, etc."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalMovimiento(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
