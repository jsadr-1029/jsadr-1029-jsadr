'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Download, WifiOff } from 'lucide-react'

/**
 * PWARegister (v3.3.0)
 * - Registra el Service Worker en producción
 * - Maneja actualizaciones: muestra toast con botón "Actualizar"
 * - Detecta offline y muestra indicador
 * - Hook para instalar la PWA (beforeinstallprompt)
 */
export function PWARegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [offline, setOffline] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Solo registrar SW en producción (evitar problemas con HMR en dev)
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      // En desarrollo, intentamos registrar igual para probar PWA, pero con manejo de errores
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing
              if (!newWorker) return
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  setUpdateAvailable(true)
                }
              })
            })
          })
          .catch((err) => {
            console.warn('[PWA] SW registration failed:', err)
          })
      }
      return
    }

    // Registro del Service Worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Detectar actualizaciones
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
            }
          })
        })

        // Verificar actualizaciones cada 60 minutos
        setInterval(() => {
          reg.update().catch(() => {})
        }, 60 * 60 * 1000)
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err)
      })

    // Listener para mensajes del SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC') {
        // Aquí se podría disparar un refetch de datos
        console.log('[PWA] Background sync triggered')
      }
    })
  }, [])

  // Detectar online/offline
  useEffect(() => {
    const updateOnlineStatus = () => setOffline(!navigator.onLine)
    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  // Capturar evento de instalación PWA
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const installedHandler = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Aplicar actualización del SW
  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }
    window.location.reload()
  }

  // Instalar PWA
  const installPWA = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setInstallPrompt(null)
  }

  return (
    <>
      {/* Indicador offline */}
      {offline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4">
          <Badge
            variant="destructive"
            className="gap-1.5 px-3 py-1.5 shadow-lg backdrop-blur-md bg-red-500/90 border border-red-400"
          >
            <WifiOff className="w-3.5 h-3.5" />
            Sin conexión — Modo offline
          </Badge>
        </div>
      )}

      {/* Banner de actualización disponible */}
      {updateAvailable && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 w-[calc(100%-2rem)] max-w-md">
          <div className="glass-card-strong border border-violet-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-violet-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Actualización disponible</p>
                <p className="text-xs text-muted-foreground">
                  Hay una nueva versión de Jsadr
                </p>
              </div>
              <Button
                size="sm"
                onClick={applyUpdate}
                className="gradient-primary text-white shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Banner de instalación PWA (desktop/mobile Chrome/Edge) */}
      {installPrompt && !installed && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 w-[calc(100%-2rem)] max-w-md">
          <div className="glass-card-strong border border-indigo-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Instalar aplicación</p>
                <p className="text-xs text-muted-foreground">
                  Acceso rápido desde tu escritorio
                </p>
              </div>
              <Button
                size="sm"
                onClick={installPWA}
                className="gradient-primary text-white shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Instalar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
