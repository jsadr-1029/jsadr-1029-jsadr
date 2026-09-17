'use client'

import * as React from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ResponsiveTableColumn<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  /** En móvil: si es true, este campo se muestra como título destacado de la tarjeta */
  mobileTitle?: boolean
  /** En móvil: si es true, este campo se muestra como badge/destacado */
  mobileBadge?: boolean
  /** En móvil: si es true, NO se muestra en la tarjeta (campos redundantes) */
  mobileHide?: boolean
  /** Clases adicionales para la celda */
  className?: string
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  loading?: boolean
  loadingMessage?: string
  onRowClick?: (row: T) => void
}

/**
 * Tabla responsiva para la plataforma Jsadr v3.0.
 *
 * - Desktop (≥768px): tabla tradicional con `<Table>` de shadcn/ui.
 * - Móvil (<768px): cada fila se convierte en una Card con título, badge
 *   y grid de 2 columnas con el resto de campos.
 *
 * El componente es genérico sobre `T` (sin `any`).
 */
export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No hay registros para mostrar',
  loading = false,
  loadingMessage = 'Cargando…',
  onRowClick,
}: ResponsiveTableProps<T>) {
  // Columna que actúa como título destacado en la tarjeta móvil
  const titleColumn = columns.find((c) => c.mobileTitle && !c.mobileHide)
  // Columna que actúa como badge/destacado en la tarjeta móvil
  const badgeColumn = columns.find((c) => c.mobileBadge && !c.mobileHide)
  // Columnas mostradas en el grid de detalle (sin título, badge ni ocultas)
  const detailColumns = columns.filter(
    (c) => !c.mobileHide && !c.mobileTitle && !c.mobileBadge
  )

  // ------------------------------------------------------------------
  // Estado: cargando
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground animate-pulse">{loadingMessage}</p>

        {/* Skeleton desktop */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Skeleton móvil */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card border border-white/10 rounded-xl p-3 mb-2"
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((__, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Estado: vacío
  // ------------------------------------------------------------------
  if (data.length === 0) {
    return (
      <Card className="glass-card border border-white/10 rounded-xl py-8">
        <CardContent className="text-center py-0">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  // ------------------------------------------------------------------
  // Render normal
  // ------------------------------------------------------------------
  return (
    <>
      {/* ============ Desktop: tabla tradicional ============ */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const key = rowKey(row)
              return (
                <TableRow
                  key={key}
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* ============ Móvil: tarjetas apiladas ============ */}
      <div className="md:hidden space-y-2">
        {data.map((row) => {
          const key = rowKey(row)
          const clickable = Boolean(onRowClick)

          return (
            <div
              key={key}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onRowClick?.(row) : undefined}
              onKeyDown={
                clickable
                  ? (e: React.KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick?.(row)
                      }
                    }
                  : undefined
              }
              className={cn(
                'glass-card border border-white/10 rounded-xl p-3 mb-2',
                clickable &&
                  'cursor-pointer active:scale-[0.99] transition-transform'
              )}
            >
              {/* Encabezado: título destacado + badge de estado */}
              {(titleColumn || badgeColumn) && (
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    {titleColumn ? (
                      <div className="font-semibold text-sm text-white truncate">
                        {titleColumn.render(row)}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        #{key}
                      </span>
                    )}
                  </div>
                  {badgeColumn && (
                    <div className="shrink-0">
                      {renderBadgeContent(badgeColumn.render(row))}
                    </div>
                  )}
                </div>
              )}

              {/* Detalle: grid de 2 columnas (label: valor) */}
              {detailColumns.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {detailColumns.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">
                        {col.header}
                      </div>
                      <div className="text-sm text-foreground break-words">
                        {col.render(row)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Indicador de acción cuando la tarjeta es clickeable */}
              {clickable && (
                <div className="mt-2 pt-2 border-t border-white/5 flex justify-end">
                  <span className="text-[11px] text-primary font-medium">
                    Ver detalle →
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * Si el contenido del badge ya es un elemento React (p. ej. `<Badge>…</Badge>`),
 * se renderiza tal cual. Si es texto/número, se envuelve automáticamente en un
 * `<Badge>` para cumplir con la semántica de `mobileBadge`.
 */
function renderBadgeContent(node: React.ReactNode): React.ReactNode {
  if (React.isValidElement(node)) {
    return node
  }
  if (node === null || node === undefined || node === '') {
    return null
  }
  return <Badge>{node}</Badge>
}
