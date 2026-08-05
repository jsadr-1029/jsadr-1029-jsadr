'use client'

import { useState, useMemo, useEffect } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  formatearMoneda,
  formatearFecha,
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  Frecuencia,
} from '@/lib/finanzas'
import { Calculator, Printer, TrendingDown, TrendingUp, Sparkles, User, Info, Shield } from 'lucide-react'

type MetodoCalculo = 'FRANCES' | 'TASA_FIJA'

interface ClienteSimulador {
  id: string
  nombre: string
  cedula: string
  tieneTasaPersonalizada: boolean
  tasaPersonalizada: number | null
}

export function SimuladorView() {
  const [metodo, setMetodo] = useState<MetodoCalculo>('FRANCES')

  // Estado compartido
  const [montoPrincipal, setMontoPrincipal] = useState('5000000')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('MENSUAL')

  // Forma 1 — Sistema Francés
  const [tasaInteresAnual, setTasaInteresAnual] = useState('24')
  const [plazoMeses, setPlazoMeses] = useState('12')

  // Forma 2 — Tasa Fija Mensual
  const [tasaMensualFija, setTasaMensualFija] = useState('3')
  const [numeroCuotas, setNumeroCuotas] = useState('12')

  // Selector de cliente + tasa heredada
  const [clientes, setClientes] = useState<ClienteSimulador[]>([])
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string>('')
  const [cargandoClientes, setCargandoClientes] = useState(true)
  const [tasaHeredadaDe, setTasaHeredadaDe] = useState<string>('') // nombre del cliente del cual se heredó

  // === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) ===
  const [flexibilidadFinanciera, setFlexibilidadFinanciera] = useState(false)
  const FLEXIBILIDAD_COSTO = 10000

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/clientes')
        const json = await res.json()
        if (cancelado) return
        const lista: ClienteSimulador[] = (json.data || [])
          .filter((c: any) => c.activo !== false)
          .map((c: any) => ({
            id: c.id,
            nombre: c.nombre,
            cedula: c.cedula,
            tieneTasaPersonalizada: !!c.tieneTasaPersonalizada,
            tasaPersonalizada: c.tasaPersonalizada ?? null,
          }))
          .sort((a: ClienteSimulador, b: ClienteSimulador) => a.nombre.localeCompare(b.nombre))
        setClientes(lista)
      } catch (e) {
        console.error('Error cargando clientes:', e)
      } finally {
        if (!cancelado) setCargandoClientes(false)
      }
    })()
    return () => { cancelado = true }
  }, [])

  // Cuando se selecciona un cliente: si tiene tasa personalizada, arrastrarla
  // al campo de Tasa Fija Mensual y forzar esa modalidad.
  // Siempre deja editar la tasa después.
  const onSeleccionarCliente = (clienteId: string) => {
    setClienteSeleccionadoId(clienteId)
    if (!clienteId) {
      setTasaHeredadaDe('')
      return
    }
    const c = clientes.find((x) => x.id === clienteId)
    if (!c) {
      setTasaHeredadaDe('')
      return
    }
    if (c.tieneTasaPersonalizada && c.tasaPersonalizada != null) {
      setTasaMensualFija(String(c.tasaPersonalizada))
      setMetodo('TASA_FIJA')
      setTasaHeredadaDe(c.nombre)
    } else {
      // Cliente sin tasa personalizada — no sobrescribe lo que el usuario tenga,
      // solo limpia el flag de heredada.
      setTasaHeredadaDe('')
    }
  }

  const calculo = useMemo(() => {
    const monto = parseFloat(montoPrincipal)
    if (!monto) return null

    if (metodo === 'FRANCES') {
      const tasa = parseFloat(tasaInteresAnual)
      const plazo = parseInt(plazoMeses)
      if (!tasa || !plazo) return null
      return calcularPrestamo({
        montoPrincipal: monto,
        tasaInteresAnual: tasa,
        tasaMoraAnual: tasa,
        plazoMeses: plazo,
        frecuencia,
      })
    } else {
      const tasaMen = parseFloat(tasaMensualFija)
      const nCuotas = parseInt(numeroCuotas)
      if (!tasaMen || !nCuotas) return null
      return calcularPrestamoTasaFijaMensual({
        montoPrincipal: monto,
        tasaMensualFija: tasaMen,
        numeroCuotas: nCuotas,
        frecuencia,
      })
    }
  }, [
    metodo,
    montoPrincipal,
    tasaInteresAnual,
    plazoMeses,
    tasaMensualFija,
    numeroCuotas,
    frecuencia,
  ])

  const imprimir = () => window.print()

  // Equivalencias de tasa (info contextual)
  const tasaMensualEquiv = (() => {
    if (metodo === 'FRANCES') {
      const t = parseFloat(tasaInteresAnual)
      return t ? (t / 12).toFixed(4) : '0.0000'
    } else {
      return (parseFloat(tasaMensualFija) || 0).toFixed(4)
    }
  })()
  const tasaAnualEquiv = (() => {
    if (metodo === 'FRANCES') {
      return (parseFloat(tasaInteresAnual) || 0).toFixed(2)
    } else {
      return ((parseFloat(tasaMensualFija) || 0) * 12).toFixed(2)
    }
  })()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador de Crédito"
        subtitle="Calcula cuotas y amortización — elige entre las dos formas de crédito disponibles"
        icon={<Calculator className="w-5 h-5" />}
        actions={
          calculo && (
            <Button variant="outline" onClick={imprimir}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          )
        }
      />

      {/* Selector de modalidad — dos formas de crédito */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setMetodo('FRANCES')}
          className={`text-left rounded-xl border-2 p-4 transition-all ${
            metodo === 'FRANCES'
              ? 'border-primary bg-primary/10 shadow-md'
              : 'border-border bg-card hover:border-primary/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${metodo === 'FRANCES' ? 'bg-primary/20' : 'bg-muted'}`}>
              <TrendingDown className={`w-5 h-5 ${metodo === 'FRANCES' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Forma 1 · Sistema Francés</h3>
                {metodo === 'FRANCES' && (
                  <span className="text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Interés sobre <strong>saldo decreciente</strong>. Cuota total constante, pero la
                proporción capital/interés varía en cada cuota.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMetodo('TASA_FIJA')}
          className={`text-left rounded-xl border-2 p-4 transition-all ${
            metodo === 'TASA_FIJA'
              ? 'border-accent bg-accent/10 shadow-md'
              : 'border-border bg-card hover:border-accent/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${metodo === 'TASA_FIJA' ? 'bg-accent/20' : 'bg-muted'}`}>
              <TrendingUp className={`w-5 h-5 ${metodo === 'TASA_FIJA' ? 'text-accent' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Forma 2 · Tasa Fija Mensual</h3>
                {metodo === 'TASA_FIJA' && (
                  <span className="text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Interés sobre <strong>capital inicial</strong>. Cuota totalmente constante (capital +
                interés iguales en todas las cuotas).
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario dinámico según modalidad */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {metodo === 'FRANCES' ? (
                <>
                  <TrendingDown className="w-4 h-4 text-primary" />
                  Parámetros — Sistema Francés
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-accent" />
                  Parámetros — Tasa Fija Mensual
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selector de cliente — arrastra la tasa personalizada si existe */}
            <div className="space-y-2">
              <Label htmlFor="cliente" className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Cliente (opcional — arrastra la tasa asignada)
              </Label>
              <Select
                value={clienteSeleccionadoId}
                onValueChange={onSeleccionarCliente}
              >
                <SelectTrigger id="cliente">
                  <SelectValue
                    placeholder={
                      cargandoClientes
                        ? 'Cargando clientes...'
                        : 'Selecciona un cliente (opcional)'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} · {c.cedula}
                      {c.tieneTasaPersonalizada && c.tasaPersonalizada != null
                        ? ` · tasa ${c.tasaPersonalizada}% mensual`
                        : ' · sin tasa asignada'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Banner informativo según el cliente seleccionado */}
              {clienteSeleccionadoId && tasaHeredadaDe && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>
                      ✓ Tasa <strong>{tasaMensualFija}%</strong> mensual heredada del cliente{' '}
                      <strong>{tasaHeredadaDe}</strong>. Aplicada a la Forma 2 (Tasa Fija Mensual).
                    </p>
                    <p className="mt-0.5 text-emerald-700">
                      Puedes editar el valor manualmente si necesitas ajustarlo para esta simulación.
                    </p>
                  </div>
                </div>
              )}
              {clienteSeleccionadoId && !tasaHeredadaDe && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>
                      ⚠ Este cliente <strong>no tiene tasa personalizada</strong> asignada en el
                      módulo Préstamos → Clientes.
                    </p>
                    <p className="mt-0.5 text-amber-700">
                      Ingresa la tasa manualmente o asigna una tasa al cliente en su ficha para
                      arrastrarla automáticamente en futuras simulaciones.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto">Monto a prestar (COP)</Label>
              <Input
                id="monto"
                type="number"
                value={montoPrincipal}
                onChange={(e) => setMontoPrincipal(e.target.value)}
              />
            </div>

            {metodo === 'FRANCES' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tasa">Tasa de interés anual (%)</Label>
                  <Input
                    id="tasa"
                    type="number"
                    step="0.01"
                    value={tasaInteresAnual}
                    onChange={(e) => setTasaInteresAnual(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Interés sobre saldo deudor. Cuota constante, interés decrece mes a mes.
                  </p>
                  <div className="flex gap-2 text-[11px] text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded">
                      ≡ Mensual: <strong>{tasaMensualEquiv}%</strong>
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plazo">Plazo (meses)</Label>
                  <Input
                    id="plazo"
                    type="number"
                    value={plazoMeses}
                    onChange={(e) => setPlazoMeses(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tasaMensual">Tasa mensual fija (%)</Label>
                  <Input
                    id="tasaMensual"
                    type="number"
                    step="0.01"
                    value={tasaMensualFija}
                    onChange={(e) => setTasaMensualFija(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Interés fijo sobre capital inicial. Cuota idéntica todas las cuotas.
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded">
                      ≡ Anual: <strong>{tasaAnualEquiv}%</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-muted rounded">
                      ≡ Diaria: <strong>{((parseFloat(tasaMensualFija) || 0) / 30).toFixed(5)}%</strong>
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nCuotas">Número de cuotas</Label>
                  <Input
                    id="nCuotas"
                    type="number"
                    value={numeroCuotas}
                    onChange={(e) => setNumeroCuotas(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total de cuotas según la frecuencia elegida abajo.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="frecuencia">Frecuencia de pagos</Label>
              <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as Frecuencia)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSUAL">Mensual</SelectItem>
                  <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                  <SelectItem value="DIARIO">Diario</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* === Flexibilidad Financiera (beneficio opcional, cuotas >= 4) === */}
            {calculo && calculo.numeroCuotas >= 4 ? (
              <div className={`space-y-2 p-3 rounded-lg border-2 transition-colors ${
                flexibilidadFinanciera
                  ? 'bg-emerald-50 border-emerald-400'
                  : 'bg-emerald-50/30 border-emerald-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flexibilidadFinanciera}
                      onCheckedChange={setFlexibilidadFinanciera}
                      id="flexFlex"
                    />
                    <Label
                      htmlFor="flexFlex"
                      className="text-sm cursor-pointer font-semibold text-emerald-900 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Flexibilidad Financiera
                    </Label>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      flexibilidadFinanciera
                        ? 'text-emerald-700 border-emerald-400 bg-emerald-100'
                        : 'text-muted-foreground'
                    }
                  >
                    {flexibilidadFinanciera
                      ? `✨ +${formatearMoneda(FLEXIBILIDAD_COSTO)}`
                      : `Opcional · ${formatearMoneda(FLEXIBILIDAD_COSTO)}`}
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800">
                  {flexibilidadFinanciera
                    ? '✅ Activo: el cliente podrá (previo pago) trasladar una cuota al final del crédito o solicitar cambio de fecha de pago.'
                    : `Disponible porque la simulación tiene ${calculo.numeroCuotas} cuotas (≥ 4). El cliente podrá:`}
                </p>
                {!flexibilidadFinanciera && (
                  <ul className="list-disc list-inside text-[11px] text-emerald-800 ml-2 space-y-0.5">
                    <li>Trasladar UNA cuota al final del crédito</li>
                    <li>Solicitar cambio de fecha de pago (genera "Otro Sí")</li>
                  </ul>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
                ℹ️ <strong>Flexibilidad Financiera</strong> está disponible solo para simulaciones con
                <strong> 4 o más cuotas</strong>.{calculo ? ` Actual: ${calculo.numeroCuotas} cuota(s).` : ''}
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>
                  Método:{' '}
                  <strong className="text-foreground">
                    {metodo === 'FRANCES' ? 'Sistema Francés' : 'Tasa Fija Mensual'}
                  </strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              📊 Resumen del Crédito
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {metodo === 'FRANCES' ? 'Sistema Francés' : 'Tasa Fija'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calculo ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">N° Cuotas</p>
                    <p className="text-xl font-bold text-primary">{calculo.numeroCuotas}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Cuota Fija</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {formatearMoneda(calculo.montoCuota)}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Interés</p>
                    <p className="text-lg font-bold text-amber-700">
                      {formatearMoneda(calculo.totalInteres)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total a Pagar</p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatearMoneda(calculo.totalPagar)}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-md text-sm space-y-1">
                  <p>
                    <strong>Fondo de Garantía (5%):</strong>{' '}
                    {formatearMoneda(calculo.fondoGarantia)}
                    <span className="text-xs text-muted-foreground"> (solo primer préstamo)</span>
                  </p>
                  {metodo === 'FRANCES' ? (
                    <p className="text-xs text-muted-foreground">
                      ✓ Cuota total constante · interés decrece sobre saldo
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      ✓ Cuota totalmente constante (capital + interés iguales en todas las cuotas)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ✓ Tasa efectiva por período: {(calculo.tasaAplicada * 100).toFixed(4)}%
                  </p>
                </div>

                {/* === Bloque de Flexibilidad Financiera (solo si está activa) === */}
                {flexibilidadFinanciera && calculo.numeroCuotas >= 4 && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Sparkles className="w-4 h-4" />
                      <strong className="text-emerald-900">Flexibilidad Financiera adquirida</strong>
                      <Badge variant="outline" className="text-emerald-700 border-emerald-400 bg-emerald-100 ml-auto">
                        +{formatearMoneda(FLEXIBILIDAD_COSTO)}
                      </Badge>
                    </div>
                    <p className="text-xs text-emerald-800">
                      El cliente podrá activar el beneficio pagando{' '}
                      <strong>{formatearMoneda(FLEXIBILIDAD_COSTO)}</strong> adicionales.
                      Al activarse, tendrá derecho a:
                    </p>
                    <ul className="list-disc list-inside text-xs text-emerald-800 ml-2 space-y-0.5">
                      <li>Trasladar UNA cuota al final del crédito</li>
                      <li>Solicitar cambio de fecha de pago (genera "Otro Sí" firmado con OTP)</li>
                    </ul>
                    <p className="text-[11px] text-emerald-700 mt-1 pt-1 border-t border-emerald-200">
                      💡 Los Otros Síes <strong>NO modifican</strong> el pagare ni la carta de instrucciones
                      originales — se anexan como documentos complementarios.
                    </p>
                  </div>
                )}

                {/* Tabla de amortización */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">📋 Tabla de Amortización Completa</h4>
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead>Capital</TableHead>
                          <TableHead>Interés</TableHead>
                          <TableHead>Cuota</TableHead>
                          <TableHead>Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculo.tablaAmortizacion.map((c) => (
                          <TableRow key={c.numero}>
                            <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                            <TableCell className="text-xs">{formatearFecha(c.fechaVencimiento)}</TableCell>
                            <TableCell className="text-xs">{formatearMoneda(c.capital)}</TableCell>
                            <TableCell className="text-xs text-amber-700">{formatearMoneda(c.interes)}</TableCell>
                            <TableCell className="text-xs font-semibold">{formatearMoneda(c.montoCuota)}</TableCell>
                            <TableCell className="text-xs">{formatearMoneda(c.saldoCapital)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>Ingresa los parámetros para ver la simulación</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
