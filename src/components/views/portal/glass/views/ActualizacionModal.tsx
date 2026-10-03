'use client'

// =====================================================
// ActualizacionModal — Modal obligatorio de actualización
// de datos (octubre 2026). Se muestra una sola vez por
// cliente al iniciar sesión si datosActualizadosOct2026=false.
// =====================================================

import * as React from 'react'

type ActualizacionModalProps = {
  open: boolean
  token: string | null
  onComplete: () => void
}

export function ActualizacionModal({ open, token, onComplete }: ActualizacionModalProps) {
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
  const [cameraTarget, setCameraTarget] = React.useState<'frente' | 'reverso' | 'selfie' | null>(null)
  const [cameraReady, setCameraReady] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (!token) return
    ;(async () => {
      try {
        const res = await fetch('/api/portal/mi-estado', {
          headers: { 'x-portal-token': token },
        })
        const data = await res.json()
        if (data.success) {
          const c = data.data.cliente
          setTelefono(c.telefono || '')
          setEmail(c.email || '')
        }
      } catch {}
    })()
  }, [open, token])

  React.useEffect(() => {
    return () => stopCamera()
  }, [])

  // Iniciar cámara cuando cameraTarget cambia
  React.useEffect(() => {
    if (!cameraTarget) {
      setCameraReady(false)
      return
    }
    let cancelled = false
    const startCam = async () => {
      try {
        // Detener stream anterior si existe
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        const useFront = cameraTarget === 'selfie' ? true : facingMode === 'user'
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: useFront ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        // Esperar a que el video element exista
        setTimeout(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setCameraReady(true)
              }).catch(() => {
                setCameraReady(true)
              })
            }
          }
        }, 100)
      } catch (e: any) {
        if (!cancelled) {
          setError('No se pudo acceder a la cámara. Verifica los permisos del navegador. Si estás en iOS, usa Safari.')
          setCameraTarget(null)
        }
      }
    }
    startCam()
    return () => {
      cancelled = true
    }
  }, [cameraTarget, facingMode])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
    setCameraTarget(null)
  }

  const takePhoto = () => {
    if (!videoRef.current || !videoRef.current.videoWidth) {
      setError('La cámara no está lista. Espera un momento.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (cameraTarget === 'selfie') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    if (cameraTarget === 'frente') setFotoFrente(dataUrl)
    else if (cameraTarget === 'reverso') setFotoReverso(dataUrl)
    else if (cameraTarget === 'selfie') setFotoSelfie(dataUrl)

    stopCamera()
  }

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    // El useEffect se disparará automáticamente por el cambio de facingMode
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

  const s = styles

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>
            <span style={{ fontSize: '18px' }}>🔄</span>
          </div>
          <div>
            <h1 style={s.title}>
              {step === 'ok' ? '¡Datos actualizados!' : 'Actualización de datos'}
            </h1>
            <p style={s.subtitle}>
              {step === 'ok'
                ? 'Gracias. Tu información quedó registrada.'
                : 'Hemos mejorado nuestra plataforma. Actualiza tus datos y fotos para mantener tu cuenta al día.'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={s.content}>
          {step === 'datos' && (
            <div style={s.column}>
              <Field label="Teléfono *">
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" style={s.input} />
              </Field>
              <Field label="Correo electrónico *">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" style={s.input} />
              </Field>
              <Field label="Ciudad">
                <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Medellín" style={s.input} />
              </Field>
              <Field label="Municipio / Barrio">
                <input type="text" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Belén" style={s.input} />
              </Field>
              <Field label="Dirección">
                <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 100 #50-25" style={s.input} />
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
                style={s.btnPrimary}
              >
                Continuar →
              </button>
              {error && <p style={s.error}>{error}</p>}
            </div>
          )}

          {step === 'fotos' && (
            <div style={s.column}>
              {/* Camera preview */}
              {cameraTarget && (
                <div style={s.cameraContainer}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      transform: cameraTarget === 'selfie' ? 'scaleX(-1)' : 'none',
                      display: cameraReady ? 'block' : 'none',
                    }}
                  />
                  {!cameraReady && (
                    <div style={s.cameraLoading}>
                      <div style={s.spinner} />
                      <p style={{ color: '#9aa3b8', fontSize: '13px', marginTop: '8px' }}>Iniciando cámara...</p>
                    </div>
                  )}
                  <div style={s.cameraControls}>
                    <button onClick={takePhoto} style={{ ...s.btnPrimary, padding: '8px 20px', fontSize: '13px' }} disabled={!cameraReady}>
                      📸 Tomar foto
                    </button>
                    <button onClick={toggleCamera} style={{ ...s.btnGhost, padding: '8px 12px' }} title="Cambiar cámara">
                      🔄
                    </button>
                    <button onClick={stopCamera} style={{ ...s.btnGhost, padding: '8px 12px' }} title="Cancelar">
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Photo slots */}
              {!cameraTarget && (
                <>
                  <PhotoSlot label="Cédula — foto frontal *" photo={fotoFrente} onTake={() => setCameraTarget('frente')} onClear={() => setFotoFrente(null)} />
                  <PhotoSlot label="Cédula — foto reverso *" photo={fotoReverso} onTake={() => setCameraTarget('reverso')} onClear={() => setFotoReverso(null)} />
                  <PhotoSlot label="Selfie sosteniendo la cédula *" photo={fotoSelfie} onTake={() => setCameraTarget('selfie')} onClear={() => setFotoSelfie(null)} />

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setStep('datos')} style={{ ...s.btnGhost, flex: 1 }}>
                      ← Atrás
                    </button>
                    <button onClick={submit} style={{ ...s.btnPrimary, flex: 2 }} disabled={!fotoFrente || !fotoReverso || !fotoSelfie}>
                      Enviar actualización
                    </button>
                  </div>
                </>
              )}

              {error && <p style={s.error}>{error}</p>}

              <p style={s.hint}>💡 Usa el botón 🔄 para cambiar entre cámara frontal y trasera</p>
            </div>
          )}

          {step === 'enviando' && (
            <div style={s.centerContent}>
              <div style={s.spinner} />
              <p style={{ color: '#9aa3b8', fontSize: '14px', marginTop: '12px' }}>Guardando tus datos...</p>
            </div>
          )}

          {step === 'ok' && (
            <div style={s.centerContent}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px' }}>✅</span>
              </div>
              <p style={{ color: '#9aa3b8', fontSize: '14px', textAlign: 'center' as const, marginTop: '12px', lineHeight: 1.6 }}>
                Tus datos y fotos quedaron registrados.<br />Ya puedes usar el portal normalmente.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'rgba(0,0,0,0.8)',
  },
  modal: {
    background: 'linear-gradient(180deg, #0a0d1d, #0e1224)',
    borderRadius: '24px',
    maxWidth: '440px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f5f7fb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '24px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  headerIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #5b5bf7, #8b5bf7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: '18px',
    fontWeight: 800,
    margin: 0,
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#9aa3b8',
    margin: 0,
    lineHeight: 1.5,
  },
  content: {
    padding: '20px 24px',
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f5f7fb',
    fontSize: '14px',
    outline: 'none',
  },
  btnPrimary: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #5b5bf7, #8b5bf7)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#9aa3b8',
    fontSize: '13px',
    cursor: 'pointer',
  },
  error: {
    color: '#fb7185',
    fontSize: '12px',
  },
  hint: {
    color: '#6b7388',
    fontSize: '11px',
    textAlign: 'center' as const,
  },
  cameraContainer: {
    position: 'relative' as const,
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cameraLoading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    background: 'rgba(0,0,0,0.3)',
  },
  cameraControls: {
    position: 'absolute' as const,
    bottom: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid rgba(91,91,247,0.2)',
    borderTopColor: '#5b5bf7',
    animation: 'spin 1s linear infinite',
  },
  centerContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '40px 0',
  },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: '#9aa3b8',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function PhotoSlot({ label, photo, onTake, onClear }: { label: string; photo: string | null; onTake: () => void; onClear: () => void }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: '#9aa3b8',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </label>
      {photo ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(52,211,153,0.3)' }}>
          <img src={photo} alt={label} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '4px' }}>
            <span style={{ background: '#34d399', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
              ✓ Lista
            </span>
            <button onClick={onClear} style={{ background: '#fb7185', color: 'white', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
              ✕
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
          fontSize: '13px',
          fontWeight: 600,
        }}>
          <span style={{ fontSize: '24px' }}>📷</span>
          Tomar foto
        </button>
      )}
    </div>
  )
}
