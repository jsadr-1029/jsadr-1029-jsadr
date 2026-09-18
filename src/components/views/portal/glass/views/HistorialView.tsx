'use client'

// =====================================================
// Vista: Historial — Neobanco Glass
// Historial de pagos aplicados. Filtros por año, mini chart
// de pagos mensuales, lista cronológica con monto y método.
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  Chip,
  EmptyState,
  Skeleton,
  SegmentedControl,
  SectionHeader,
  MiniBarChart,
  ListRow,
} from '../ui'
import {
  formatCOP,
  formatFechaCorta,
  formatFechaHora,
  type NbEstado,
} from '../useNeobancoPortal'
import { History, TrendingUp, CheckCircle2, Building2, Wallet } from 'lucide-react'

type HistorialViewProps = {
  estado: NbEstado | null
  cargando: boolean
}

type PagoHistorial = {
  id: string
  prestamoCodigo: string
  numeroCuota: number
  fecha: string
  monto: number
  metodo?: string
  estado: string
}

export function HistorialView({ estado, cargando }: HistorialViewProps) {
  const [filtro, setFiltro] = React.useState<'todos' | '2026' | '2025'>('todos')

  const historial: PagoHistorial[] = React.useMemo(() => {
    if (!estado?.prestamos) return []
    const pagos: PagoHistorial[] = []
    for (const p of estado.prestamos) {
      for (const pg of p.pagos ?? []) {
        if (pg.estado !== 'PAGADO') continue
        pagos.push({
          id: pg.id,
          prestamoCodigo: p.codigo,
          numeroCuota: pg.numeroCuota,
          fecha: pg.fechaPago || pg.fechaVencimiento || '',
          monto: Number(pg.montoTotal),
          metodo: pg.cuentaRecaudoId ? 'Transferencia' : 'PSE',
          estado: pg.estado,
        })
      }
    }
    return pagos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [estado])

  const filtrados = React.useMemo(() => {
    if (filtro === 'todos') return historial
    const year = Number(filtro)
    return historial.filter((p) => new Date(p.fecha).getFullYear() === year)
  }, [historial, filtro])

  // Mini chart: total pagado por mes (últimos 6)
  const chartData = React.useMemo(() => {
    const meses: Array<{ label: string; value: number; highlight?: boolean }> = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const total = filtrados
        .filter((p) => {
          const pd = new Date(p.fecha)
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
        })
        .reduce((s, p) => s + p.monto, 0)
      meses.push({
        label: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
        value: total,
        highlight: i === 0,
      })
    }
    return meses
  }, [filtrados])

  const totalPagado = filtrados.reduce((s, p) => s + p.monto, 0)
  const promedio = filtrados.length > 0 ? totalPagado / filtrados.length : 0

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full rounded-[24px]" />
        <Skeleton className="h-24 w-full rounded-[24px]" />
        <Skeleton className="h-16 w-full rounded-[24px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Historial
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          {historial.length} pagos aplicados · {formatCOP(totalPagado)} en total
        </p>
      </header>

      <SegmentedControl
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: '2026', label: '2026' },
          { value: '2025', label: '2025' },
        ]}
        size="sm"
        className="w-full"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <GlassCard radius="md">
          <div className="p-3.5 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--nb-success-soft)] text-[var(--nb-success)] flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold mt-1">
              Total pagado
            </p>
            <p className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
              {formatCOP(totalPagado)}
            </p>
          </div>
        </GlassCard>
        <GlassCard radius="md">
          <div className="p-3.5 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--nb-info-soft)] text-[var(--nb-info)] flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold mt-1">
              Pago promedio
            </p>
            <p className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
              {formatCOP(promedio)}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Chart */}
      <GlassCard radius="lg">
        <div className="p-4 flex flex-col gap-3">
          <SectionHeader title="Pagos por mes (últimos 6)" />
          <MiniBarChart data={chartData} tone="brand" height={88} />
        </div>
      </GlassCard>

      {/* Lista */}
      <section>
        <SectionHeader title="Pagos aplicados" />
        {filtrados.length === 0 ? (
          <GlassCard radius="lg">
            <EmptyState
              icon={<History size={24} />}
              title="Sin pagos en este período"
              description="Cuando realices pagos a tus créditos, aparecerán aquí con su fecha y método."
            />
          </GlassCard>
        ) : (
          <GlassCard radius="lg">
            <div className="flex flex-col">
              {filtrados.slice(0, 50).map((p, i) => (
                <ListRow
                  key={p.id}
                  leading={
                    p.metodo === 'Transferencia' ? <Building2 size={16} /> : <Wallet size={16} />
                  }
                  title={`${formatCOP(p.monto)} · ${p.prestamoCodigo}`}
                  subtitle={`Cuota ${p.numeroCuota} · ${formatFechaHora(p.fecha)} · ${p.metodo || 'Pago'}`}
                  trailing={
                    <Chip tone="success" size="sm">
                      <CheckCircle2 size={10} />
                      Aplicado
                    </Chip>
                  }
                  className={i === 0 ? 'bg-[var(--nb-primary-soft)]/30' : ''}
                />
              ))}
            </div>
          </GlassCard>
        )}
        {filtrados.length > 50 && (
          <p className="text-[11px] text-[var(--nb-fg-subtle)] text-center mt-2">
            Mostrando los 50 pagos más recientes
          </p>
        )}
      </section>
    </div>
  )
}
