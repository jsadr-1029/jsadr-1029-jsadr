'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// =====================================================
// useInactivityAutoLogout
// -----------------------------------------------------
// Hook que detecta inactividad del usuario y dispara un
// callback de cierre de sesión tras un tiempo configurado.
//
// ¿Por qué existe?
//   El portal del cliente maneja datos sensibles (pagarés,
//   estados de cuenta, datos personales). Por seguridad,
//   si el cliente deja el navegador abierto sin interactuar
//   durante 10 minutos, la sesión debe cerrarse automáticamente.
//
// ¿Cómo funciona?
//   - Escucha eventos de actividad: mousemove, mousedown,
//     keydown, scroll, touchstart, click.
//   - Reinicia el contador en cada evento.
//   - Cuando el contador llega al límite, dispara `onTimeout`.
//   - Opcionalmente muestra una advertencia previa (warningAtMs)
//     para que el usuario pueda extender la sesión.
//
// Uso:
//   const { warning, extend } = useInactivityAutoLogout({
//     timeoutMs: 10 * 60 * 1000,    // 10 minutos
//     warningAtMs: 9 * 60 * 1000,   // advertir a los 9 min
//     onTimeout: () => cerrarSesion(),
//     enabled: true,
//   })
// =====================================================

interface Options {
  /** Tiempo total de inactividad antes del logout automático (ms). */
  timeoutMs: number
  /** Tiempo antes del logout para mostrar una advertencia (ms). Si es 0 o > timeoutMs, se desactiva. */
  warningAtMs?: number
  /** Callback que se ejecuta cuando se agota el tiempo. */
  onTimeout: () => void
  /** Si es false, el hook no hace nada. Útil para desactivar en pantallas no sensibles. */
  enabled?: boolean
}

interface Result {
  /** true cuando se cruzó warningAtMs y aún no se ha agotado el tiempo total. */
  warning: boolean
  /** Segundos restantes hasta el logout (solo significativo si warning=true). */
  secondsLeft: number
  /** Reinicia el contador (llamar cuando el usuario hace clic en "seguir conectado"). */
  extend: () => void
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
]

export function useInactivityAutoLogout({
  timeoutMs,
  warningAtMs,
  onTimeout,
  enabled = true,
}: Options): Result {
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Refs para evitar re-renders innecesarios y mantener valores frescos
  // dentro de los listeners sin tener que re-suscribirlos.
  const lastActivityRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firedRef = useRef<boolean>(false) // evitar que onTimeout se llame 2 veces
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now()
    setWarning(false)
    setSecondsLeft(0)
    firedRef.current = false
  }, [])

  // Registrar listeners de actividad
  useEffect(() => {
    if (!enabled) return

    // Reiniciar al montar / al habilitar
    reset()

    const handler = () => {
      // Pequeño throttle para no saturar el state con mousemove continuo
      const now = Date.now()
      if (now - lastActivityRef.current > 1000) {
        lastActivityRef.current = now
        if (warning) {
          setWarning(false)
          setSecondsLeft(0)
          firedRef.current = false
        }
      } else {
        lastActivityRef.current = now
      }
    }

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handler, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, handler)
      })
    }
  }, [enabled, reset, warning])

  // Timer principal: revisa cada segundo si se agotó el tiempo
  useEffect(() => {
    if (!enabled) return

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const warningThreshold = warningAtMs && warningAtMs > 0 && warningAtMs < timeoutMs ? warningAtMs : null

      if (warningThreshold && elapsed >= warningThreshold && elapsed < timeoutMs) {
        if (!warning) setWarning(true)
        const restante = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000))
        setSecondsLeft(restante)
      }

      if (elapsed >= timeoutMs && !firedRef.current) {
        firedRef.current = true
        setWarning(false)
        setSecondsLeft(0)
        // Limpiar el intervalo antes de disparar para evitar dobles llamadas
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        // Llamar al callback más reciente
        try {
          onTimeoutRef.current()
        } catch (e) {
          console.error('[useInactivityAutoLogout] error en onTimeout:', e)
        }
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, timeoutMs, warningAtMs, warning])

  // Cuando el documento vuelve a estar visible (tab activo), reseteamos
  // para no disparar un logout injusto si la inactividad fue solo en background.
  useEffect(() => {
    if (!enabled) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Si el tiempo transcurrido es mayor al timeout, igual disparar logout
        const elapsed = Date.now() - lastActivityRef.current
        if (elapsed >= timeoutMs && !firedRef.current) {
          firedRef.current = true
          try {
            onTimeoutRef.current()
          } catch (e) {
            console.error('[useInactivityAutoLogout] error en onTimeout (visibility):', e)
          }
        } else {
          reset()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled, timeoutMs, reset])

  return { warning, secondsLeft, extend: reset }
}
