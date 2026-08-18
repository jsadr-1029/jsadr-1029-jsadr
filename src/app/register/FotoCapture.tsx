'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, RefreshCw, Check, X, AlertCircle, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCamera, fileToDataUrl, resizeDataUrl, type FacingMode } from './useCamera'

interface Props {
  label: string
  descripcion: string
  valor: string | null
  nombreArchivo: string | null
  onChange: (dataUrl: string | null, nombre: string | null) => void
  mirror?: boolean // selfie = true
  /** Cámara preferida al iniciar: 'user' (frontal) o 'environment' (trasera) */
  defaultFacing?: FacingMode
}

export default function FotoCapture({
  label,
  descripcion,
  valor,
  nombreArchivo,
  onChange,
  mirror = false,
  defaultFacing = 'user',
}: Props) {
  const [mode, setMode] = useState<'preview' | 'camera' | 'upload'>(valor ? 'preview' : 'camera')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cam = useCamera({ defaultFacing })

  // Cuando se monta el componente y ya hay valor, mostrar preview
  useEffect(() => {
    if (valor && mode === 'camera') setMode('preview')
  }, [valor, mode])

  async function tomarFoto() {
    setProcessing(true)
    setError('')
    try {
      const dataUrl = cam.capture(1280, 0.82)
      if (!dataUrl) {
        setError('No se pudo capturar la foto. Intenta de nuevo.')
        return
      }
      const resized = await resizeDataUrl(dataUrl, 1600, 0.82)
      onChange(resized, `foto-${Date.now()}.jpg`)
      cam.stop()
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

  // Determinar si debemos mostrar el preview espejado
  // Solo se espeja cuando mirror=true (selfie) Y la cámara activa es la frontal
  const shouldMirror = mirror && cam.facingMode === 'user'

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Camera className="h-4 w-4 text-indigo-400" />
            {label}
          </h4>
          <p className="text-xs text-slate-400 mt-1">{descripcion}</p>
        </div>
        {valor && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Capturada
          </span>
        )}
      </div>

      {/* Preview */}
      {valor && mode === 'preview' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={valor}
              alt={label}
              className={`w-full max-h-72 object-contain ${shouldMirror ? 'scale-x-[-1]' : ''}`}
            />
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-200">
              {nombreArchivo || 'captura.jpg'}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('camera')} className="border-slate-600 text-slate-200">
              <Camera className="h-4 w-4 mr-1" /> Volver a tomar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')} className="border-slate-600 text-slate-200">
              <Upload className="h-4 w-4 mr-1" /> Subir archivo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={borrar} className="text-red-400 hover:text-red-300">
              <X className="h-4 w-4 mr-1" /> Borrar
            </Button>
          </div>
        </div>
      )}

      {/* Cámara activa */}
      {mode === 'camera' && !valor && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-700 aspect-video">
            <video
              ref={cam.videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${shouldMirror ? 'scale-x-[-1]' : ''}`}
            />
            {(cam.status === 'idle' || cam.status === 'requesting') && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <Button type="button" onClick={cam.start} disabled={cam.status === 'requesting'}>
                  <Camera className="h-4 w-4 mr-2" />
                  {cam.status === 'requesting' ? 'Solicitando permiso…' : 'Activar cámara'}
                </Button>
              </div>
            )}
            {cam.status === 'active' && (
              <>
                <div className="absolute top-2 left-2 bg-emerald-500/80 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" /> EN VIVO
                </div>
                {/* Badge indicando cámara activa */}
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-200 flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {cam.facingMode === 'user' ? 'Frontal' : 'Trasera'}
                </div>
                {/* Botón para girar/cambiar cámara — visible siempre que esté activa,
                    incluso si la detección inicial no encontró múltiples cámaras
                    (en móviles iOS a veces no reporta los labels hasta tener permiso) */}
                <button
                  type="button"
                  onClick={cam.switchCamera}
                  disabled={cam.switching}
                  aria-label={cam.switching ? 'Cambiando cámara…' : 'Cambiar de cámara'}
                  title={cam.switching ? 'Cambiando cámara…' : 'Cambiar de cámara'}
                  className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center text-white shadow-lg shadow-indigo-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cam.switching ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <SwitchCamera className="h-5 w-5" />
                  )}
                </button>
              </>
            )}
            {(cam.status === 'error' || cam.status === 'denied') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center px-4">
                <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 mb-3">{cam.error || 'Cámara no disponible'}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')} className="border-slate-600 text-slate-200">
                  <Upload className="h-4 w-4 mr-1" /> Subir archivo
                </Button>
              </div>
            )}
          </div>
          {/* Hint para móvil */}
          {cam.status === 'active' && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <SwitchCamera className="h-3 w-3 text-indigo-400" />
              ¿Cámara equivocada? Usa el botón circular abajo a la derecha para cambiar entre cámara frontal y trasera.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={tomarFoto}
              disabled={cam.status !== 'active' || processing}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500"
            >
              {processing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
              Capturar foto
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('upload')} className="border-slate-600 text-slate-200">
              <Upload className="h-4 w-4 mr-1" /> Mejor subir un archivo
            </Button>
            {cam.status === 'active' && (
              <Button type="button" size="sm" variant="ghost" onClick={cam.stop} className="text-slate-400">
                Apagar cámara
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload */}
      {mode === 'upload' && !valor && (
        <div className="space-y-3">
          <label
            className="block rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500/60 transition-colors p-6 text-center cursor-pointer bg-slate-950/40"
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
            <p className="text-xs text-slate-300">Haz clic o arrastra una imagen aquí</p>
            <p className="text-[10px] text-slate-500 mt-1">JPG · PNG · WEBP — Máx 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileSelected}
              className="hidden"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setMode('camera')} className="border-slate-600 text-slate-200">
              <Camera className="h-4 w-4 mr-1" /> Usar cámara
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  )
}
