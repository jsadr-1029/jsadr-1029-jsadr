'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatearMoneda, formatearFecha, type Frecuencia, type ResultadoCalculo } from '@/lib/finanzas'
import { Calendar, ChevronDown, ChevronUp, Table2, Printer, Info } from 'lucide-react'

interface PlanAmortizacionPreviewProps {
  calculo: ResultadoCalculo
  frecuencia: Frecuencia
  cargosIniciales: {
    items: Array<{ etiqueta: string; monto: number; color: string }>
    total: number
  }
  fechaPrimerCuota: string | null
  fechaPrimerCorte: Date | null
  periodoCorte: string | null
}

/**
 * PlanAmortizacionPreview
 *
 * Tabla de amortización que se muestra en el formulario de creación de solicitud,
 * justo después del campo "Fecha de la primera cuota". Se actualiza dinámicamente
 * al cambiar cualquier condición del solicitud (monto, tasa, plazo, frecuencia,
 * modalidad, fecha primera cuota, periodo de corte, cargos iniciales).
 *
 * Muestra:
 * - N° cuota, fecha de vencimiento, cuota total, capital, interés, saldo capital
 * - Cargos iniciales cargados a la cuota #1 (pagaré, tarifa, flexibilidad, fondo, días)
 * - Totales (capital, interés, total a pagar)
 * - Botón para imprimir/exportar el plan
 */
export function PlanAmortizacionPreview({
  calculo,
  frecuencia,
  cargosIniciales,
  fechaPrimerCuota,
  fechaPrimerCorte,
  periodoCorte,
}: PlanAmortizacionPreviewProps) {
  const [expandido, setExpandido] = useState(true)
  const [mostrarTodas, setMostrarTodas] = useState(false)

  // Determinar la fecha de la primera cuota (la que se muestra al cliente)
  const fechaPrimeraCuotaReal = useMemo(() => {
    if (calculo.tablaAmortizacion.length > 0) {
      return calculo.tablaAmortizacion[0].fechaVencimiento
    }
    return null
  }, [calculo.tablaAmortizacion])

  // Determinar cuántas cuotas mostrar (por defecto 12, o todas si hay menos)
  const cuotasVisibles = useMemo(() => {
    const todas = calculo.tablaAmortizacion
    if (mostrarTodas || todas.length <= 12) return todas
    return todas.slice(0, 12)
  }, [calculo.tablaAmortizacion, mostrarTodas])

  const cuota1ConCargos = cargosIniciales.total + calculo.montoCuota
  const totalPagarConCargos = calculo.totalPagar + cargosIniciales.total

  // Imprimir el plan (abre ventana de impresión)
  const handleImprimir = () => {
    const filas = calculo.tablaAmortizacion.map((c) => `
      <tr>
        <td style="text-align:center">${c.numero}</td>
        <td style="text-align:center">${formatearFecha(c.fechaVencimiento)}</td>
        <td style="text-align:right">${formatearMoneda(c.numero === 1 ? cuota1ConCargos : c.montoCuota)}</td>
        <td style="text-align:right">${formatearMoneda(c.capital)}</td>
        <td style="text-align:right">${formatearMoneda(c.interes)}</td>
        <td style="text-align:right">${formatearMoneda(c.saldoCapital)}</td>
      </tr>
    `).join('')

    const cargosHtml = cargosIniciales.items.length > 0
      ? cargosIniciales.items.map((c) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #ddd">
          <span>${c.etiqueta}</span>
          <strong>${formatearMoneda(c.monto)}</strong>
        </div>
      `).join('')
      : '<p style="color:#666;font-style:italic">Sin cargos iniciales</p>'

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Plan de Amortización - Vista Previa</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 18px; margin-bottom: 8px; }
          h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; color: #475569; }
          .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .resumen div { font-size: 12px; }
          .resumen .valor { font-size: 16px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th { background: #1e293b; color: white; padding: 8px; font-weight: 600; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .cargos { padding: 12px; background: #fef3c7; border-radius: 6px; border: 1px solid #fde68a; margin-top: 12px; }
          .total { font-size: 16px; font-weight: bold; color: #0f172a; text-align: right; padding: 12px; background: #ddd6fe; border-radius: 6px; margin-top: 12px; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <h1>📋 Plan de Amortización — Vista Previa</h1>
        <p style="color:#64748b;font-size:12px">
          Frecuencia: <strong>${frecuencia}</strong>
          ${fechaPrimerCuota ? `• Primera cuota: <strong>${formatearFecha(new Date(fechaPrimerCuota + 'T12:00:00'))}</strong>` : ''}
          ${periodoCorte && fechaPrimerCorte ? `• Periodo corte: <strong>${periodoCorte}</strong> (inicio: ${formatearFecha(fechaPrimerCorte)})` : ''}
        </p>

        <div class="resumen">
          <div>
            <div style="color:#64748b">N° Cuotas</div>
            <div class="valor">${calculo.numeroCuotas}</div>
          </div>
          <div>
            <div style="color:#64748b">Cuota Fija</div>
            <div class="valor">${formatearMoneda(calculo.montoCuota)}</div>
          </div>
          <div>
            <div style="color:#64748b">Total Interés</div>
            <div class="valor" style="color:#b45309">${formatearMoneda(calculo.totalInteres)}</div>
          </div>
          <div>
            <div style="color:#64748b">Total a Pagar</div>
            <div class="valor" style="color:#7c3aed">${formatearMoneda(totalPagarConCargos)}</div>
          </div>
        </div>

        ${cargosIniciales.items.length > 0 ? `
          <h2>💰 Cargos Iniciales (cargados a la Cuota #1)</h2>
          <div class="cargos">
            ${cargosHtml}
            <div style="display:flex;justify-content:space-between;padding:8px 0 0 0;margin-top:8px;border-top:2px solid #f59e0b;font-weight:bold">
              <span>TOTAL CARGOS INICIALES</span>
              <span>${formatearMoneda(cargosIniciales.total)}</span>
            </div>
          </div>
        ` : ''}

        <h2>📅 Tabla de Cuotas</h2>
        <table>
          <thead>
            <tr>
              <th style="text-align:center">N°</th>
              <th style="text-align:center">Fecha Vencimiento</th>
              <th style="text-align:right">Cuota Total</th>
              <th style="text-align:right">Capital</th>
              <th style="text-align:right">Interés</th>
              <th style="text-align:right">Saldo Capital</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
          <tfoot>
            <tr style="background:#ddd6fe;font-weight:bold">
              <td colspan="2" style="text-align:right">TOTALES →</td>
              <td style="text-align:right">${formatearMoneda(calculo.totalPagar + cargosIniciales.total)}</td>
              <td style="text-align:right">${formatearMoneda(calculo.tablaAmortizacion.reduce((s, c) => s + c.capital, 0))}</td>
              <td style="text-align:right">${formatearMoneda(calculo.totalInteres)}</td>
              <td style="text-align:right">—</td>
            </tr>
          </tfoot>
        </table>

        <div class="total">
          TOTAL A PAGAR (capital + interés + cargos iniciales): ${formatearMoneda(totalPagarConCargos)}
        </div>

        <p style="font-size:10px;color:#94a3b8;margin-top:24px;text-align:center">
          Este plan es una vista previa basada en las condiciones actuales del formulario.
          Los valores finales pueden variar al confirmar el solicitud.
        </p>

        <script>
          window.onload = () => setTimeout(() => window.print(), 300)
        </script>
      </body>
      </html>
    `
    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 shadow-sm overflow-hidden">
      {/* === Header === */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-100 dark:bg-violet-900/50 cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900 transition"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-violet-700 dark:text-violet-300" />
          <span className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            📊 Plan de Amortización (vista previa)
          </span>
          <Badge variant="secondary" className="text-[10px] bg-violet-200 text-violet-900 dark:bg-violet-700 dark:text-violet-100">
            {calculo.numeroCuotas} cuotas
          </Badge>
          {fechaPrimeraCuotaReal && (
            <Badge variant="outline" className="text-[10px] border-violet-400 text-violet-900 dark:border-violet-500 dark:text-violet-100">
              <Calendar className="w-3 h-3 mr-1" />
              1ª cuota: {formatearFecha(fechaPrimeraCuotaReal)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-900 dark:text-violet-100 hover:bg-violet-200 dark:hover:bg-violet-800"
            onClick={(e) => {
              e.stopPropagation()
              handleImprimir()
            }}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Imprimir</span>
          </Button>
          {expandido ? (
            <ChevronUp className="w-4 h-4 text-violet-700 dark:text-violet-300" />
          ) : (
            <ChevronDown className="w-4 h-4 text-violet-700 dark:text-violet-300" />
          )}
        </div>
      </div>

      {/* === Body === */}
      {expandido && (
        <div className="px-4 pb-4 space-y-3">
          {/* === Resumen superior === */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md bg-white dark:bg-slate-900/80 border border-violet-200 dark:border-violet-700 text-sm">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Cuota Base</div>
              <div className="font-bold text-violet-900 dark:text-violet-100">{formatearMoneda(calculo.montoCuota)}</div>
              {cargosIniciales.total > 0 && (
                <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                  + cargos: {formatearMoneda(cargosIniciales.total)}
                </div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">1ª Cuota con Cargos</div>
              <div className="font-bold text-amber-700 dark:text-amber-300">{formatearMoneda(cuota1ConCargos)}</div>
              <div className="text-[10px] text-muted-foreground">incluye cargos iniciales</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Interés</div>
              <div className="font-bold text-rose-700 dark:text-rose-300">{formatearMoneda(calculo.totalInteres)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Total a Pagar</div>
              <div className="font-bold text-emerald-700 dark:text-emerald-300">{formatearMoneda(totalPagarConCargos)}</div>
              {cargosIniciales.total > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  sin cargos: {formatearMoneda(calculo.totalPagar)}
                </div>
              )}
            </div>
          </div>

          {/* === Tabla de cuotas === */}
          <div className="rounded-md border border-violet-200 dark:border-violet-700 overflow-hidden bg-white dark:bg-slate-900/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-violet-100 dark:bg-violet-900/60 hover:bg-violet-100 dark:hover:bg-violet-900/60">
                  <TableHead className="text-center text-violet-900 dark:text-violet-100 font-semibold w-12">#</TableHead>
                  <TableHead className="text-center text-violet-900 dark:text-violet-100 font-semibold">Fecha Vencimiento</TableHead>
                  <TableHead className="text-right text-violet-900 dark:text-violet-100 font-semibold">Cuota Total</TableHead>
                  <TableHead className="text-right text-violet-900 dark:text-violet-100 font-semibold">Capital</TableHead>
                  <TableHead className="text-right text-violet-900 dark:text-violet-100 font-semibold">Interés</TableHead>
                  <TableHead className="text-right text-violet-900 dark:text-violet-100 font-semibold">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuotasVisibles.map((cuota) => {
                  const esCuota1 = cuota.numero === 1
                  const cuotaTotal = esCuota1 ? cuota1ConCargos : cuota.montoCuota
                  return (
                    <TableRow
                      key={cuota.numero}
                      className={esCuota1
                        ? 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                        : 'hover:bg-violet-50 dark:hover:bg-violet-900/30'
                      }
                    >
                      <TableCell className="text-center font-medium">
                        {cuota.numero}
                        {esCuota1 && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-300 text-amber-900 dark:bg-amber-600 dark:text-amber-50 font-bold">
                            +cargos
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-700 dark:text-slate-200">
                        {formatearFecha(cuota.fechaVencimiento)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <span className={esCuota1 ? 'text-amber-700 dark:text-amber-300' : 'text-violet-900 dark:text-violet-100'}>
                          {formatearMoneda(cuotaTotal)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 dark:text-emerald-300">
                        {formatearMoneda(cuota.capital)}
                      </TableCell>
                      <TableCell className="text-right text-rose-700 dark:text-rose-300">
                        {formatearMoneda(cuota.interes)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600 dark:text-slate-300">
                        {formatearMoneda(cuota.saldoCapital)}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {/* === Fila de totales === */}
                <TableRow className="bg-violet-100 dark:bg-violet-900/60 font-bold hover:bg-violet-100 dark:hover:bg-violet-900/60">
                  <TableCell colSpan={2} className="text-right text-violet-900 dark:text-violet-100">
                    TOTALES →
                  </TableCell>
                  <TableCell className="text-right text-violet-900 dark:text-violet-100">
                    {formatearMoneda(calculo.totalPagar + cargosIniciales.total)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700 dark:text-emerald-300">
                    {formatearMoneda(calculo.tablaAmortizacion.reduce((s, c) => s + c.capital, 0))}
                  </TableCell>
                  <TableCell className="text-right text-rose-700 dark:text-rose-300">
                    {formatearMoneda(calculo.totalInteres)}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* === Mostrar más cuotas si hay más de 12 === */}
          {calculo.tablaAmortizacion.length > 12 && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarTodas(!mostrarTodas)}
                className="border-violet-300 text-violet-900 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-100 dark:hover:bg-violet-900/50"
              >
                {mostrarTodas ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Ver solo las primeras 12 cuotas</>
                ) : (
                  <><ChevronDown className="w-4 h-4 mr-1" /> Ver las {calculo.tablaAmortizacion.length - 12} cuotas restantes</>
                )}
              </Button>
            </div>
          )}

          {/* === Detalle de cargos iniciales (si hay) === */}
          {cargosIniciales.items.length > 0 && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                💰 Cargos Iniciales cargados a la Cuota #1
              </div>
              <div className="space-y-1">
                {cargosIniciales.items.map((cargo, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs py-1 border-b border-amber-100 dark:border-amber-800 last:border-0"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{cargo.etiqueta}</span>
                    <strong className={cargo.color}>{formatearMoneda(cargo.monto)}</strong>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs pt-2 mt-1 border-t-2 border-amber-300 dark:border-amber-600 font-bold">
                  <span className="text-amber-900 dark:text-amber-100">TOTAL CARGOS INICIALES</span>
                  <span className="text-amber-900 dark:text-amber-100">{formatearMoneda(cargosIniciales.total)}</span>
                </div>
              </div>
              <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-2 leading-relaxed">
                Estos cargos se cobran una sola vez al inicio del crédito y se suman al valor de la primera cuota.
                Las cuotas siguientes son de <strong>{formatearMoneda(calculo.montoCuota)}</strong> (cuota base).
              </p>
            </div>
          )}

          {/* === Nota informativa === */}
          <div className="text-[11px] text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/50 p-2 rounded border border-violet-200 dark:border-violet-700 flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              Este plan se actualiza automáticamente al cambiar cualquier condición del solicitud
              (monto, tasa, plazo, frecuencia, fecha primera cuota, periodo de corte, cargos iniciales).
              {fechaPrimerCuota && (
                <> La primera cuota vence el <strong>{formatearFecha(new Date(fechaPrimerCuota + 'T12:00:00'))}</strong>.</>
              )}
              {periodoCorte && fechaPrimerCorte && (
                <> Las cuotas se programan desde el corte (<strong>{formatearFecha(fechaPrimerCorte)}</strong>).</>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
