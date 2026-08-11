'use client'

// =====================================================
// InactivityAutoLogout — Wrapper para la app principal
// -----------------------------------------------------
// FIX-LOGOUT-INESPERADO: el usuario reportó que la sesión se cerraba
// aleatoriamente mientras usaba la plataforma. Una vez arreglado el
// race condition del refresh token, este componente implementa la
// política esperada por el usuario:
//
//   • 10 minutos de inactividad → aviso previo a los 9 min
//   • Si el usuario no extiende, se cierra la sesión (con revocación
//     server-side vía /api/auth/logout)
//   • Si el usuario extiende, el contador se reinicia
//
// Solo se monta para usuarios internos autenticados (no para el
// portal cliente, que ya tiene su propio manejo en PortalClienteModal).
//
// También escucha el evento `visibilitychange` para no disparar un
// logout injusto cuando el usuario simplemente cambió de pestaña y
// volvió dentro de los 10 min.
// =====================================================

import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useInactivityAutoLogout } from '@/hooks/use-inactivity-auto-logout'
import { logout, logoutLocal } from '@/lib/api-client'

interface Props {
  /** Tiempo total de inactividad antes del logout (ms). Default 10 min. */
  timeoutMs?: number
  /** Mostrar aviso cuando falte este tiempo (ms). Default 1 min antes. */
  warningAtMs?: number
  /** Si es false, el hook no hace nada. */
  enabled?: boolean
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutos
const DEFAULT_WARNING_AT_MS = 9 * 60 * 1000 // avisar a los 9 min

export function InactivityAutoLogout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningAtMs = DEFAULT_WARNING_AT_MS,
  enabled = true,
}: Props) {
  const [showDialog, setShowDialog] = useState(false)

  const { warning, secondsLeft, extend } = useInactivityAutoLogout({
    timeoutMs,
    warningAtMs,
    enabled,
    onTimeout: () => {
      // Cerrar sesión: usamos logoutLocal para que la redirección sea
      // inmediata (el usuario ya está inactivo, no queremos esperar a
      // la llamada al servidor). La revocación server-side se puede
      // disparar en background, pero como el usuario está inactivo,
      // no tiene caso esperarla.
      try {
        // Disparar revocación server-side en background (best-effort).
        // No usamos await porque queremos redirigir inmediatamente.
        logout().catch(() => {})
      } catch {
        // Si logout() falla (ej: localStorage ya limpio), usar logoutLocal.
        logoutLocal()
      }
    },
  })

  // Mostrar el diálogo cuando warning sea true
  useEffect(() => {
    if (warning && !showDialog) {
      setShowDialog(true)
    }
    if (!warning && showDialog) {
      setShowDialog(false)
    }
  }, [warning, showDialog])

  const handleExtend = () => {
    extend()
    setShowDialog(false)
  }

  const handleLogoutNow = () => {
    setShowDialog(false)
    logoutLocal()
  }

  if (!enabled) return null

  return (
    <AlertDialog open={showDialog} onOpenChange={(open) => {
      if (!open) {
        // Si el usuario cierra el diálogo sin elegir, contar como "extender"
        // (no queremos cerrarle la sesión por cerrar el diálogo). Si realmente
        // quería cerrar sesión, puede usar el botón "Cerrar sesión ahora".
        handleExtend()
      }
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Sigues ahí?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              Por seguridad, tu sesión se cerrará automáticamente en{' '}
              <strong className="text-foreground">{secondsLeft} segundos</strong>{' '}
              por inactividad.
              <br />
              <br />
              Si quieres seguir utilizando la plataforma, haz clic en{' '}
              <strong className="text-foreground">&quot;Seguir conectado&quot;</strong>.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <div className="flex w-full justify-between gap-2">
            <Button variant="ghost" onClick={handleLogoutNow}>
              Cerrar sesión ahora
            </Button>
            <AlertDialogAction onClick={handleExtend}>
              Seguir conectado
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
