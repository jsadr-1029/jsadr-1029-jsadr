'use client'

// Hook reutilizable para capturar foto desde webcam
// Soporta cambio de cámara (frontal/trasera) en dispositivos móviles
import { useState, useRef, useCallback, useEffect } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error' | 'denied'
export type FacingMode = 'user' | 'environment'

export interface UseCameraOptions {
  /** Cámara preferida al iniciar: 'user' (frontal, ideal para selfies) o 'environment' (trasera, ideal para cédula) */
  defaultFacing?: FacingMode
}

export function useCamera(opts: UseCameraOptions = {}) {
  const { defaultFacing = 'user' } = opts
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>(defaultFacing)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [switching, setSwitching] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Detectar si el dispositivo tiene múltiples cámaras (móvil / tablet)
  useEffect(() => {
    let mounted = true
    async function detectCameras() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return
        // Necesitamos permiso primero para ver labels, pero podemos contar videoinputs
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter((d) => d.kind === 'videoinput')
        if (mounted && videoInputs.length > 1) {
          setHasMultipleCameras(true)
        }
      } catch {
        // Silenciar errores de detección — no afecta el flujo principal
      }
    }
    detectCameras()
    return () => {
      mounted = false
    }
  }, [])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreaming(false)
    setStatus('idle')
  }, [])

  const startStream = useCallback(async (desired: FacingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Tu navegador no soporta acceso a cámara.')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setStatus('error')
      setError('La cámara solo funciona en conexiones HTTPS seguras.')
      return
    }

    let stream: MediaStream
    try {
      // Primer intento: facingMode ideal + resolución
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: desired },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
    } catch (e1: any) {
      // Si el dispositivo no soporta facingMode como constraint, reintentar con video: true
      if (e1?.name === 'OverconstrainedError' || e1?.name === 'ConstraintNotSatisfiedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch (e2: any) {
          throw e2
        }
      } else {
        throw e1
      }
    }

    // Detener stream anterior si existe
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
    }
    setStreaming(true)
    setStatus('active')

    // Detectar la cámara real del track actual (para saber si es user o environment)
    const track = stream.getVideoTracks()[0]
    if (track) {
      const settings = track.getSettings()
      if (settings.facingMode === 'user' || settings.facingMode === 'environment') {
        setFacingMode(settings.facingMode as FacingMode)
      }
    }
  }, [])

  const start = useCallback(async () => {
    setStatus('requesting')
    setError('')
    try {
      await startStream(facingMode)
    } catch (e: any) {
      const name = e?.name || ''
      const isDenied = name === 'NotAllowedError' || name === 'PermissionDeniedError'
      const isInUse = name === 'NotReadableError' || name === 'TrackStartError'
      const isNotFound = name === 'NotFoundError' || name === 'DevicesNotFoundError'
      setStatus(isDenied ? 'denied' : 'error')
      if (isDenied) {
        setError('Permiso de cámara denegado. Habilítalo en el ícono de candado junto a la URL o sube un archivo.')
      } else if (isInUse) {
        setError('La cámara está siendo usada por otra app (Zoom, Teams, Meet). Ciérrala e intenta de nuevo.')
      } else if (isNotFound) {
        setError('No se detectó ninguna cámara conectada. Usa la opción de subir archivo.')
      } else {
        setError('No se pudo acceder a la cámara: ' + (e?.message || 'desconocido'))
      }
    }
  }, [facingMode, startStream])

  // Cambiar entre cámara frontal y trasera
  const switchCamera = useCallback(async () => {
    if (switching || status !== 'active') return
    setSwitching(true)
    try {
      const next: FacingMode = facingMode === 'user' ? 'environment' : 'user'
      await startStream(next)
    } catch (e: any) {
      // Si falla el cambio, mantener el stream anterior (ya se cerró en startStream?)
      // En este punto el stream anterior ya se detuvo dentro de startStream,
      // así que intentamos reiniciar con la cámara original
      try {
        await startStream(facingMode)
      } catch {
        setStatus('error')
        setError('No se pudo cambiar de cámara. Intenta de nuevo.')
      }
    } finally {
      setSwitching(false)
    }
  }, [facingMode, status, switching, startStream])

  const capture = useCallback(
    (maxWidth = 1280, quality = 0.82): string | null => {
      if (!videoRef.current || !streamRef.current) return null
      const v = videoRef.current
      if (!v.videoWidth) return null
      const canvas = document.createElement('canvas')
      const ratio = v.videoHeight / v.videoWidth
      const w = Math.min(maxWidth, v.videoWidth)
      const h = Math.round(w * ratio)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      // Solo espejar cuando se está usando la cámara frontal (selfie)
      if (facingMode === 'user') {
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(v, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', quality)
    },
    [facingMode]
  )

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return {
    status,
    error,
    streaming,
    videoRef,
    start,
    stop,
    capture,
    facingMode,
    switchCamera,
    switching,
    hasMultipleCameras,
  }
}

// Helper para leer un File como data URL
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'))
    fr.readAsDataURL(file)
  })
}

// Redimensionar imagen si es muy grande
export async function resizeDataUrl(dataUrl: string, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl)
        return
      }
      const ratio = width > height ? maxDim / width : maxDim / height
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Imagen corrupta'))
    img.src = dataUrl
  })
}
