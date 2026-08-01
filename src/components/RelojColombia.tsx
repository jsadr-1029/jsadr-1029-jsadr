'use client'

// =====================================================
// RelojColombia — Reloj digital visible en todos los módulos
// -----------------------------------------------------
// Muestra la hora actual de Colombia (America/Bogota, que
// cubre Medellín y Bogotá — misma zona horaria UTC-5 todo
// el año, sin DST).
//
// Se renderiza del lado del cliente usando toLocaleString
// con timeZone: 'America/Bogota', por lo que respeta
// siempre la hora oficial colombiana sin importar la zona
// horaria del navegador del usuario.
//
// Se actualiza cada segundo. Pequeño y autocontenido para
// no impactar el rendimiento.
// =====================================================

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

const OPCIONES_HORA: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'America/Bogota',
}

const OPCIONES_FECHA: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
}

interface RelojColombiaProps {
  /** Variante compacta (solo hora) o completa (fecha + hora) */
  compacto?: boolean
  /** Clases extra para el contenedor */
  className?: string
}

export function RelojColombia({ compacto = false, className = '' }: RelojColombiaProps) {
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    // Inicializar al montar (evita hidration mismatch)
    setAhora(new Date())
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!ahora) {
    // Placeholder con mismo ancho para evitar saltos de layout
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 bg-white/5 border border-white/10 ${className}`}
        suppressHydrationWarning
      >
        <Clock className="w-3.5 h-3.5" />
        <span>--:--:--</span>
      </div>
    )
  }

  const horaStr = ahora.toLocaleTimeString('es-CO', OPCIONES_HORA)
  const fechaStr = ahora.toLocaleDateString('es-CO', OPCIONES_FECHA)

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-white bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 backdrop-blur-sm ${className}`}
      suppressHydrationWarning
      title={`Hora oficial de Colombia (America/Bogota)\n${fechaStr} · ${horaStr}`}
    >
      <Clock className="w-3.5 h-3.5 text-indigo-300" />
      {!compacto && (
        <span className="text-white/60 text-[11px] hidden sm:inline">
          {fechaStr}
        </span>
      )}
      <span className="text-white tabular-nums">{horaStr}</span>
      {!compacto && (
        <span className="text-white/50 text-[10px] hidden md:inline">
          🇨🇴 CO
        </span>
      )}
    </div>
  )
}

export default RelojColombia
