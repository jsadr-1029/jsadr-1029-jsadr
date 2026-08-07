'use client'

// Hook reutilizable para capturar foto desde webcam
import { useState, useRef, useCallback, useEffect } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error' | 'denied'

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

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

  const start = useCallback(async () => {
    setStatus('requesting')
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError('Tu navegador no soporta acceso a cámara.')
        return
      }
      // Verificar contexto seguro (HTTPS o localhost)
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setStatus('error')
        setError('La cámara solo funciona en conexiones HTTPS seguras.')
        return
      }
      // Intentar con facingMode 'user' (ideal para selfies).
      // Si falla con OverconstrainedError (algunos desktops), reintentar con video: true.
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (e1: any) {
        if (e1?.name === 'OverconstrainedError' || e1?.name === 'ConstraintNotSatisfiedError') {
          // Reintentar sin facingMode (algunos desktops no soportan 'user' como constraint estricto)
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } else {
          throw e1
        }
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setStreaming(true)
      setStatus('active')
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
  }, [])

  const capture = useCallback((maxWidth = 1280, quality = 0.82): string | null => {
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
    // Para selfies, espejar horizontalmente para que coincida con lo que ve el usuario
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(v, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return { status, error, streaming, videoRef, start, stop, capture }
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
