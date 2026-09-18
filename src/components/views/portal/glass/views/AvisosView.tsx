'use client'

// =====================================================
// Vista: Avisos — Neobanco Glass
// Lista de notificaciones del cliente: vencimientos, pagos
// aplicados, mensajes del asesor, otros síes pendientes.
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  Chip,
  EmptyState,
  Skeleton,
  ListRow,
  GlassButton,
} from '../ui'
import {
  formatFechaRelativa,
  type NbOtroSi,
  type NbEstado,
} from '../useNeobancoPortal'
import { Bell, CalendarClock, CheckCircle2, FileSignature, AlertTriangle, MessageSquare } from 'lucide-react'

type AvisosViewProps = {
  estado: NbEstado | null
  cargando: boolean
  otrosSi: NbOtroSi[]
  onAbrirOtroSi: (otroSi: NbOtroSi) => void
}

type Aviso = {
  id: string
  tipo: 'pago' | 'mora' | 'otro_si' | 'mensaje' | 'sistema'
  titulo: string
  descripcion: string
  fecha: string
  leido: boolean
  accion?: { label: string; onClick: () => void }
}

export function AvisosView({ estado, cargando, otrosSi, onAbrirOtroSi }: AvisosViewProps) {
  const avisos = React.useMemo<Aviso[]>(() => {
    const lista: Aviso[] = []

    // Vencimientos próximos / mora
    for (const v of estado?.proximosVencimientos ?? []) {
      const dias = Math.floor(
        (new Date(v.fechaVencimiento).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )
      if (dias < 0) {
        lista.push({
          id: `mora-${v.prestamoId}-${v.numeroCuota}`,
          tipo: 'mora',
          titulo: `Pago en mora · ${v.prestamoCodigo}`,
          descripcion: `Cuota ${v.numeroCuota} por ${v.montoCuota.toLocaleString('es-CO')} venció hace ${Math.abs(dias)} día(s).`,
          fecha: v.fechaVencimiento,
          leido: false,
        })
      } else if (dias <= 3) {
        lista.push({
          id: `pago-${v.prestamoId}-${v.numeroCuota}`,
          tipo: 'pago',
          titulo: `Vence pronto · ${v.prestamoCodigo}`,
          descripcion: `Cuota ${v.numeroCuota} por ${v.montoCuota.toLocaleString('es-CO')} vence ${formatFechaRelativa(v.fechaVencimiento).toLowerCase()}.`,
          fecha: v.fechaVencimiento,
          leido: false,
        })
      }
    }

    // Otros Síes pendientes de firma
    for (const os of otrosSi) {
      if (os.estado === 'PENDIENTE_FIRMA') {
        lista.push({
          id: `otro-si-${os.id}`,
          tipo: 'otro_si',
          titulo: `Firma pendiente · ${os.codigo}`,
          descripcion: `Tienes un Otro Sí listo para firma electrónica. Revísalo y fírmalo cuando puedas.`,
          fecha: os.createdAt,
          leido: false,
          accion: {
            label: 'Firmar ahora',
            onClick: () => onAbrirOtroSi(os),
          },
        })
      }
    }

    // Mensaje de bienvenida (si no hay avisos)
    if (lista.length === 0) {
      lista.push({
        id: 'welcome',
        tipo: 'sistema',
        titulo: 'Bienvenido a tu portal',
        descripcion: 'Aquí verás avisos sobre tus pagos, documentos y novedades importantes.',
        fecha: new Date().toISOString(),
        leido: true,
      })
    }

    return lista.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [estado, otrosSi, onAbrirOtroSi])

  const noLeidos = avisos.filter((a) => !a.leido).length

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[24px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Avisos
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          {avisos.length} aviso(s) · {noLeidos} sin leer
        </p>
      </header>

      {avisos.length === 0 ? (
        <GlassCard radius="lg">
          <EmptyState
            icon={<Bell size={24} />}
            title="No tienes avisos"
            description="Te notificaremos sobre vencimientos, pagos aplicados y mensajes de tu asesor."
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {avisos.map((a) => (
            <GlassCard
              key={a.id}
              radius="lg"
              className={a.leido ? '' : 'border-l-4 border-l-[var(--nb-primary)]'}
            >
              <div className="p-3.5 flex items-start gap-3">
                <AvisoIcon tipo={a.tipo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-[var(--nb-fg)] leading-tight">
                      {a.titulo}
                    </p>
                    {!a.leido && <span className="w-2 h-2 rounded-full bg-[var(--nb-primary)] shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5 leading-relaxed">
                    {a.descripcion}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                      {formatFechaRelativa(a.fecha)}
                    </span>
                    {a.accion && (
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={a.accion.onClick}
                      >
                        {a.accion.label}
                      </GlassButton>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

function AvisoIcon({ tipo }: { tipo: Aviso['tipo'] }) {
  const config = {
    pago: { bg: 'var(--nb-primary-soft)', fg: 'var(--nb-primary)', icon: <CalendarClock size={16} /> },
    mora: { bg: 'var(--nb-danger-soft)', fg: 'var(--nb-danger)', icon: <AlertTriangle size={16} /> },
    otro_si: { bg: 'var(--nb-warning-soft)', fg: 'var(--nb-warning)', icon: <FileSignature size={16} /> },
    mensaje: { bg: 'var(--nb-info-soft)', fg: 'var(--nb-info)', icon: <MessageSquare size={16} /> },
    sistema: { bg: 'var(--nb-surface-2)', fg: 'var(--nb-fg-muted)', icon: <Bell size={16} /> },
  }[tipo]
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
      style={{ background: config.bg, color: config.fg }}
    >
      {config.icon}
    </div>
  )
}
