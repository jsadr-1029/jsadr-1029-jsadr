'use client'

/**
 * FotoCaptureFirma
 * =================
 * Componente de captura de fotos para el flujo de firma electrónica.
 * Basado en el patrón exitoso de src/app/register/FotoCapture.tsx (que sí funciona).
 *
 * Diferencias vs el FotoCapture del registro:
 *   - Añade botón "Girar cámara" para alternar entre cámara frontal (user) y
 *     trasera (environment) en cualquier momento.
 *   - Estilos adaptados al tema del portal de firma (light theme).
 *   - Sin dependencia de useCamera.ts del registro (trae su propia lógica
 *     inline para poder modificarla sin tocar el registro).
 *
 * Modos:
 *   - preview: muestra la foto capturada y botones para volver a tomar / subir / borrar.
 *   - camera:  muestra el video en vivo con botón "Capturar foto" + "Girar cámara".
 *   - upload:  drag-and-drop o click para subir archivo.
 *
 * Uso:
 *   <FotoCaptureFirma
 *     label="Foto de la cédula (frente)"
 *     descripcion="Asegúrate de que se lean todos los datos."
 *     valor={fotoFrente}
 *     onChange={setFotoFrente}
 *     initialFacing="environment"  // 'user' para selfie, 'environment' para documento
 *     mirror={false}                // true para selfie (espejo horizontal)
 *   />
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, Upload, RefreshCw, Check, X, AlertCircle, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CameraStatus = 'idle' | 'requesting' | 'active' | 'error' | 'denied'

interface Props {
  label: string
  descripcion: string
  valor: string | null
  nombreArchivo?: string | null
  onChange: (dataUrl: string | null, nombre: string | null) => void
  initialFacing?: 'user' | 'environment'
  mirror?: boolean // selfie = true
}

export default function FotoCaptureFirma({
  label,
  descripcion,
  valor,
  nombreArchivo,
  onChange,
  initialFacing = 'environment',
  mirror = false,
}: Props) {
  const [mode, setMode] = useState<'preview' | 'camera' | 'upload'>(valor ? 'preview' : 'camera')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [camError, setCamError] = useState('')
  const [facing, setFacing] = useState<'user' | 'environment'>(initialFacing)
  const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Cuando se monta y ya hay valor, mostrar preview
  useEffect(() => {
    if (valor && mode === 'camera') setMode('preview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop())
      } catch {}
      streamRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null
      } catch {}
    }
    setStatus('idle')
  }, [])

  /**
   * Inicia la cámara. Intenta primero con el facingMode preferido; si hay
   * OverconstrainedError (algunos desktops), reintenta con constraints mínimas.
   */
  const startCamera = useCallback(async (preferredFacing: 'user' | 'environment') => {
    setStatus('requesting')
    setCamError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setCamError('Tu navegador no soporta acceso a cámara.')
        return
      }
      // Verificar contexto seguro
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setStatus('error')
        setCamError('La cámara solo funciona en conexiones HTTPS seguras.')
        return
      }

      // Detener stream previo si existe
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop())
        } catch {}
        streamRef.current = null
      }

      let stream: MediaStream
      try {
        // Ideal: pedir facingMode específico + resolución razonable
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch (e1: any) {
        if (e1?.name === 'OverconstrainedError' || e1?.name === 'ConstraintNotSatisfiedError') {
          // Reintento 1: sin facingMode (algunos desktops no soportan 'environment')
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            })
          } catch (e2: any) {
            // Reintento 2: constraints mínimas (cualquier cámara)
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          }
        } else if (e1?.name === 'NotAllowedError' || e1?.name === 'PermissionDeniedError') {
          setStatus('denied')
          setCamError('Permiso de cámara denegado. Habilítalo en el ícono de candado junto a la URL o sube un archivo.')
          return
        } else {
          throw e1
        }
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      // Listar cámaras disponibles (para info del botón "Girar cámara")
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter((d) => d.kind === 'videoinput')
        setCameraList(cams)
        const currentTrack = stream.getVideoTracks()[0]
        const currentLabel = currentTrack?.label || ''
        const idx = cams.findIndex((c) => c.label === currentLabel)
        setCameraIndex(idx >= 0 ? idx : 0)
      } catch {}

      setStatus('active')
    } catch (e: any) {
      const name = e?.name || ''
      const isDenied = name === 'NotAllowedError' || name === 'PermissionDeniedError'
      const isInUse = name === 'NotReadableError' || name === 'TrackStartError'
      const isNotFound = name === 'NotFoundError' || name === 'DevicesNotFoundError'
      setStatus(isDenied ? 'denied' : 'error')
      if (isDenied) {
        setCamError('Permiso de cámara denegado. Habilítalo en el ícono de candado junto a la URL o sube un archivo.')
      } else if (isInUse) {
        setCamError('La cámara está siendo usada por otra app (Zoom, Teams, Meet). Ciérrala e intenta de nuevo.')
      } else if (isNotFound) {
        setCamError('No se detectó ninguna cámara conectada. Usa la opción de subir archivo.')
      } else {
        setCamError('No se pudo acceder a la cámara: ' + (e?.message || 'desconocido'))
      }
    }
  }, [])

  /**
   * Girar la cámara: alterna el facingMode entre 'user' y 'environment'.
   * Si la nueva configuración falla, reintenta con constraints mínimas.
   */
  const flipCamera = useCallback(async () => {
    const nextFacing = facing === 'user' ? 'environment' : 'user'
    setFacing(nextFacing)
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop())
      } catch {}
      streamRef.current = null
    }
    setStatus('requesting')
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setStatus('active')
    } catch (e: any) {
      // Si falla el facingMode, intentar con constraints mínimas
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('active')
      } catch (e2: any) {
        setStatus('error')
        setCamError('No se pudo girar la cámara: ' + (e2?.message || 'desconocido'))
      }
    }
  }, [facing])

  /**
   * Captura la foto desde el video stream actual.
   * Redimensiona a máximo 1600px y calidad 0.82 JPEG.
   */
  const tomarFoto = async () => {
    setProcessing(true)
    setError('')
    try {
      if (!videoRef.current || !streamRef.current) {
        setError('La cámara no está activa.')
        return
      }
      const v = videoRef.current
      if (!v.videoWidth) {
        setError('El video todavía no está listo. Espera un segundo e intenta de nuevo.')
        return
      }
      const canvas = document.createElement('canvas')
      const maxWidth = 1280
      const ratio = v.videoHeight / v.videoWidth
      const w = Math.min(maxWidth, v.videoWidth)
      const h = Math.round(w * ratio)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('No se pudo procesar la imagen.')
        return
      }
      // Si mirror=true (selfie), espejar horizontalmente
      if (mirror) {
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(v, 0, 0, w, h)
      let dataUrl = canvas.toDataURL('image/jpeg', 0.82)

      // Redimensionar si es muy grande
      dataUrl = await resizeDataUrl(dataUrl, 1600, 0.82)

      onChange(dataUrl, `foto-${Date.now()}.jpg`)
      stopStream()
      setMode('preview')
    } catch (e: any) {
      setError(e?.message || 'Error al procesar la foto')
    } finally {
      setProcessing(false)
    }
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setProcessing(true)
    setError('')
    try {
      if (!f.type.match(/^image\/(jpeg|png|webp)$/)) {
        setError('Formato no válido. Usa JPG, PNG o WEBP.')
        return
      }
      if (f.size > 10 * 1024 * 1024) {
        setError('Archivo demasiado grande (máx 10MB).')
        return
      }
      const dataUrl = await fileToDataUrl(f)
      const resized = await resizeDataUrl(dataUrl, 1600, 0.82)
      onChange(resized, f.name)
      setMode('preview')
    } catch (e: any) {
      setError(e?.message || 'Error al leer el archivo')
    } finally {
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function borrar() {
    onChange(null, null)
    setError('')
    setMode('camera')
  }

  // === Detener stream cuando se cambia a modo upload o preview ===
  useEffect(() => {
    if (mode !== 'camera') {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Camera className="h-4 w-4 text-indigo-600" />
            {label}
          </h4>
          <p className="text-xs text-slate-500 mt-1">{descripcion}</p>
        </div>
        {valor && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Capturada
          </span>
        )}
      </div>

      {/* Preview */}
      {valor && mode === 'preview' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={valor}
              alt={label}
              className={`w-full max-h-72 object-contain ${mirror ? 'scale-x-[-1]' : ''}`}
            />
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-[10px] text-white">
              {nombreArchivo || 'captura.jpg'}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('camera')}>
              <Camera className="h-4 w-4 mr-1" /> Volver a tomar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')}>
              <Upload className="h-4 w-4 mr-1" /> Subir archivo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={borrar} className="text-red-600 hover:text-red-700">
              <X className="h-4 w-4 mr-1" /> Borrar
            </Button>
          </div>
        </div>
      )}

      {/* Cámara activa */}
      {mode === 'camera' && !valor && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-300 aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
            />
            {(status === 'idle' || status === 'requesting') && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <Button type="button" onClick={() => startCamera(facing)} disabled={status === 'requesting'}>
                  <Camera className="h-4 w-4 mr-2" />
                  {status === 'requesting' ? 'Solicitando permiso…' : 'Activar cámara'}
                </Button>
              </div>
            )}
            {status === 'active' && (
              <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" /> EN VIVO · {facing === 'user' ? 'Frontal' : 'Trasera'}
              </div>
            )}
            {(status === 'error' || status === 'denied') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center px-4">
                <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-200 mb-3">{camError || 'Cámara no disponible'}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')}>
                  <Upload className="h-4 w-4 mr-1" /> Subir archivo
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={tomarFoto}
              disabled={status !== 'active' || processing}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white"
            >
              {processing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
              Capturar foto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={flipCamera}
              disabled={status !== 'active' || processing}
              title="Cambiar entre cámara frontal y trasera"
            >
              <SwitchCamera className="h-4 w-4 mr-1" /> Girar cámara
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')}>
              <Upload className="h-4 w-4 mr-1" /> Mejor subir un archivo
            </Button>
            {status === 'active' && (
              <Button type="button" size="sm" variant="ghost" onClick={stopStream} className="text-slate-500">
                Apagar cámara
              </Button>
            )}
          </div>
          {cameraList.length > 1 && (
            <p className="text-[10px] text-slate-400">
              {cameraList.length} cámaras detectadas · Actual: {cameraList[cameraIndex]?.label || 'desconocida'}
            </p>
          )}
        </div>
      )}

      {/* Upload */}
      {mode === 'upload' && !valor && (
        <div className="space-y-3">
          <label
            className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500/60 transition-colors p-6 text-center cursor-pointer bg-slate-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f && fileInputRef.current) {
                const dt = new DataTransfer()
                dt.items.add(f)
                fileInputRef.current.files = dt.files
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
              }
            }}
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-700">Haz clic o arrastra una imagen aquí</p>
            <p className="text-[10px] text-slate-400 mt-1">JPG · PNG · WEBP — Máx 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileSelected}
              className="hidden"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('camera')}>
              <Camera className="h-4 w-4 mr-1" /> Usar cámara
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  )
}

// === Helpers (equivalentes a los de register/useCamera.ts) ===

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'))
    fr.readAsDataURL(file)
  })
}

async function resizeDataUrl(dataUrl: string, maxDim = 1600, quality = 0.82): Promise<string> {
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
