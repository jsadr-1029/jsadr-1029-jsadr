'use client'

// =====================================================
// ActualizacionModal — Modal obligatorio de actualización
// de datos (octubre 2026). Se muestra una sola vez por
// cliente al iniciar sesión si datosActualizadosOct2026=false.
// =====================================================

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react'

type ActualizacionModalProps = {
  open: boolean
  token: string | null
  onComplete: () => void
  onSkip?: () => void
}

export function ActualizacionModal({ open, token, onComplete, onSkip }: ActualizacionModalProps) {
  const router = useRouter()
  const [step, setStep] = React.useState<'datos' | 'fotos' | 'enviando' | 'ok'>('datos')
  const [error, setError] = React.useState<string | null>(null)

  // Datos de contacto
  const [telefono, setTelefono] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [ciudad, setCiudad] = React.useState('')
  const [municipio, setMunicipio] = React.useState('')
  const [direccion, setDireccion] = React.useState('')

  // Fotos
  const [fotoFrente, setFotoFrente] = React.useState<string | null>(null)
  const [fotoReverso, setFotoReverso] = React.useState<string | null>(null)
  const [fotoSelfie, setFotoSelfie] = React.useState<string | null>(null)
  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('environment')
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = React.useState<'frente' | 'reverso' | 'selfie' | null>(null)

  React.useEffect(() => {
    if (!open) return
    // Cargar datos actuales del cliente
    ;(async () => {
      if (!token) return
      try {
        const res = await fetch('/api/portal/mi-estado', {
          headers: { 'x-portal-token': token },
        })
        const data = await res.json()
        if (data.success) {
          const c = data.data.cliente
          setTelefono(c.telefono || '')
          setEmail(c.email || '')
          setCiudad(data.data.prestamos?.[0]?.cliente ? '' : '')
        }
      } catch {}
    })()
  }, [open, token])

  // Cerrar cámara al desmontar
  React.useEffect(() => {
    return () => stopCamera()
  }, [])

  const startCamera = async (which: 'frente' | 'reverso' | 'selfie') => {
    setCameraActive(which)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: which === 'selfie' ? 'user' : facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e: any) {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
      setCameraActive(null)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(null)
  }

  const takePhoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 1280
    canvas.height = videoRef.current.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Si es selfie (front camera), espejar horizontalmente
    if (cameraActive === 'selfie') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    if (cameraActive === 'frente') setFotoFrente(dataUrl)
    else if (cameraActive === 'reverso') setFotoReverso(dataUrl)
    else if (cameraActive === 'selfie') setFotoSelfie(dataUrl)

    stopCamera()
  }

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    if (cameraActive) {
      stopCamera()
      setTimeout(() => startCamera(cameraActive), 200)
    }
  }

  const submit = async () => {
    if (!token) return
    if (!fotoFrente || !fotoReverso || !fotoSelfie) {
      setError('Debes tomar las 3 fotos')
      return
    }
    setStep('enviando')
    setError(null)
    try {
      const res = await fetch('/api/portal/actualizar-datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          telefono,
          email,
          ciudad,
          municipio,
          direccion,
          fotoCedulaFrente: fotoFrente,
          fotoCedulaReverso: fotoReverso,
          fotoSelfie: fotoSelfie,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo actualizar')
      }
      setStep('ok')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (e: any) {
      setError(e.message || 'Error al actualizar')
      setStep('fotos')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div style={{
        background: 'linear-gradient(180deg, #0a0d1d, #0e1224)',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#f5f7fb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #5b5bf7, #8b5bf7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
            }}>
              <RefreshCw size={18} />
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              {step === 'ok' ? '¡Datos actualizados!' : 'Actualización de datos'}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#9aa3b8', margin: 0, lineHeight: 1.5 }}>
            {step === 'ok'
              ? 'Gracias. Tu información quedó registrada.'
              : 'Hemos mejorado nuestra plataforma. Por favor actualiza tus datos de contacto y fotos para mantener tu cuenta al día.'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          {step === 'datos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Campos de contacto */}
              <Field icon={<Phone size={14} />} label="Teléfono *">
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="3001234567"
                  style={inputStyle}
                />
              </Field>
              <Field icon={<Mail size={14} />} label="Correo electrónico *">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={inputStyle}
                />
              </Field>
              <Field icon={<MapPin size={14} />} label="Ciudad">
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Medellín"
                  style={inputStyle}
                />
              </Field>
              <Field icon={<MapPin size={14} />} label="Municipio / Barrio">
                <input
                  type="text"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Belén"
                  style={inputStyle}
                />
              </Field>
              <Field icon={<MapPin size={14} />} label="Dirección">
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle 100 #50-25"
                  style={inputStyle}
                />
              </Field>

              <button
                onClick={() => {
                  if (!telefono.trim() || !email.trim()) {
                    setError('Teléfono y correo son obligatorios')
                    return
                  }
                  setError(null)
                  setStep('fotos')
                }}
                style={primaryBtn}
              >
                Continuar →
              </button>
              {error && <p style={{ color: '#fb7185', fontSize: '12px' }}>{error}</p>}
            </div>
          )}

          {step === 'fotos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Camera preview */}
              {cameraActive && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', transform: cameraActive === 'selfie' ? 'scaleX(-1)' : 'none' }}
                  />
                  <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
                    <button onClick={takePhoto} style={{ ...primaryBtn, padding: '8px 20px', fontSize: '13px' }}>
                      📸 Tomar foto
                    </button>
                    <button onClick={toggleCamera} style={{ ...ghostBtn, padding: '8px 12px' }}>
                      <RefreshCw size={14} />
                    </button>
                    <button onClick={stopCamera} style={{ ...ghostBtn, padding: '8px 12px' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Foto previews */}
              {!cameraActive && (
                <>
                  <PhotoSlot
                    label="Cédula — foto frontal *"
                    photo={fotoFrente}
                    onTake={() => startCamera('frente')}
                    onClear={() => setFotoFrente(null)}
                  />
                  <PhotoSlot
                    label="Cédula — foto reverso *"
                    photo={fotoReverso}
                    onTake={() => startCamera('reverso')}
                    onClear={() => setFotoReverso(null)}
                  />
                  <PhotoSlot
                    label="Selfie sosteniendo la cédula *"
                    photo={fotoSelfie}
                    onTake={() => startCamera('selfie')}
                    onClear={() => setFotoSelfie(null)}
                  />

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setStep('datos')} style={{ ...ghostBtn, flex: 1 }}>
                      ← Atrás
                    </button>
                    <button onClick={submit} style={{ ...primaryBtn, flex: 2 }} disabled={!fotoFrente || !fotoReverso || !fotoSelfie}>
                      Enviar actualización
                    </button>
                  </div>
                </>
              )}

              {error && <p style={{ color: '#fb7185', fontSize: '12px' }}>{error}</p>}

              <p style={{ color: '#6b7388', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
                💡 Usa el botón 🔄 para cambiar entre cámara frontal y trasera
              </p>
            </div>
          )}

          {step === 'enviando' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(91,91,247,0.2)', borderTopColor: '#5b5bf7', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#9aa3b8', fontSize: '14px' }}>Guardando tus datos...</p>
            </div>
          )}

          {step === 'ok' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={28} style={{ color: '#34d399' }} />
              </div>
              <p style={{ color: '#9aa3b8', fontSize: '14px', textAlign: 'center' }}>
                Tus datos y fotos quedaron registrados.<br />Ya puedes usar el portal normalmente.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f5f7fb',
  fontSize: '14px',
  outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: 'none',
  background: 'linear-gradient(135deg, #5b5bf7, #8b5bf7)',
  color: 'white',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#9aa3b8',
  fontSize: '13px',
  cursor: 'pointer',
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#9aa3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon} {label}
      </label>
      {children}
    </div>
  )
}

function PhotoSlot({ label, photo, onTake, onClear }: { label: string; photo: string | null; onTake: () => void; onClear: () => void }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#9aa3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <Camera size={14} /> {label}
      </label>
      {photo ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(52,211,153,0.3)' }}>
          <img src={photo} alt={label} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px' }}>
            <span style={{ background: '#34d399', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
              ✓ Lista
            </span>
            <button onClick={onClear} style={{ background: '#fb7185', color: 'white', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onTake} style={{
          width: '100%',
          padding: '24px 0',
          borderRadius: '12px',
          border: '2px dashed rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.02)',
          color: '#5b5bf7',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
        }}>
          <Camera size={24} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Tomar foto</span>
        </button>
      )}
    </div>
  )
}
