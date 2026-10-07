'use client'

// =====================================================
// ActualizacionModal — Modal obligatorio de actualización
// de datos (octubre 2026).
//
// Usa <input type="file" accept="image/*" capture="environment">
// que es el estándar HTML5 para captura de fotos desde el navegador.
// Funciona en Android, iOS y desktop — sin necesidad de getUserMedia.
// =====================================================

import * as React from 'react'

type ActualizacionModalProps = {
  open: boolean
  token: string | null
  onComplete: () => void
}

type PhotoKey = 'frente' | 'reverso' | 'selfie'

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
  const [fotos, setFotos] = React.useState<Record<PhotoKey, string | null>>({
    frente: null,
    reverso: null,
    selfie: null,
  })

  // Hidden file inputs
  const inputFrenteRef = React.useRef<HTMLInputElement>(null)
  const inputReversoRef = React.useRef<HTMLInputElement>(null)
  const inputSelfieRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open || !token) return
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

  const compressImage = (file: File, maxSize: number = 1280, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width)
              width = maxSize
            } else {
              width = Math.round((width * maxSize) / height)
              height = maxSize
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('No se pudo crear el contexto del canvas'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = async (key: PhotoKey, file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPEG, PNG)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 10MB')
      return
    }
    try {
      const dataUrl = await compressImage(file, 1280, 0.7)
      setFotos((prev) => ({ ...prev, [key]: dataUrl }))
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Error al procesar la imagen')
    }
  }

  const triggerInput = (key: PhotoKey) => {
    const refs = { frente: inputFrenteRef, reverso: inputReversoRef, selfie: inputSelfieRef }
    refs[key].current?.click()
  }

  const submit = async () => {
    if (!token) return
    if (!fotos.frente || !fotos.reverso || !fotos.selfie) {
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
          fotoCedulaFrente: fotos.frente,
          fotoCedulaReverso: fotos.reverso,
          fotoSelfie: fotos.selfie,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo actualizar')
      }
      setStep('ok')
      setTimeout(() => onComplete(), 2000)
    } catch (e: any) {
      setError(e.message || 'Error al actualizar')
      setStep('fotos')
    }
  }

  if (!open) return null

  const allPhotosTaken = fotos.frente && fotos.reverso && fotos.selfie

  return (
    <div style={s.overlay}>
      {/* Hidden file inputs */}
      <input
        ref={inputFrenteRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect('frente', f); e.target.value = '' }}
      />
      <input
        ref={inputReversoRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect('reverso', f); e.target.value = '' }}
      />
      <input
        ref={inputSelfieRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect('selfie', f); e.target.value = '' }}
      />

      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>🔄</div>
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
              <PhotoSlot
                label="Cédula — foto frontal *"
                photo={fotos.frente}
                onTake={() => triggerInput('frente')}
                onClear={() => setFotos((p) => ({ ...p, frente: null }))}
              />
              <PhotoSlot
                label="Cédula — foto reverso *"
                photo={fotos.reverso}
                onTake={() => triggerInput('reverso')}
                onClear={() => setFotos((p) => ({ ...p, reverso: null }))}
              />
              <PhotoSlot
                label="Selfie sosteniendo la cédula *"
                photo={fotos.selfie}
                onTake={() => triggerInput('selfie')}
                onClear={() => setFotos((p) => ({ ...p, selfie: null }))}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setStep('datos')} style={{ ...s.btnGhost, flex: 1 }}>
                  ← Atrás
                </button>
                <button
                  onClick={submit}
                  style={{ ...s.btnPrimary, flex: 2, opacity: allPhotosTaken ? 1 : 0.5 }}
                  disabled={!allPhotosTaken}
                >
                  Enviar actualización
                </button>
              </div>

              {error && <p style={s.error}>{error}</p>}

              <p style={s.hint}>
                💡 Al hacer clic en "Tomar foto" se abrirá la cámara de tu dispositivo.
                Toma la foto y se guardará automáticamente.
              </p>
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
              <div style={s.okIcon}>✅</div>
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

// === Styles ===
const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'rgba(0,0,0,0.85)',
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
    fontSize: '18px',
  },
  title: { fontSize: '18px', fontWeight: 800, margin: 0, marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#9aa3b8', margin: 0, lineHeight: 1.5 },
  content: { padding: '20px 24px' },
  column: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
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
  error: { color: '#fb7185', fontSize: '12px' },
  hint: { color: '#6b7388', fontSize: '11px', textAlign: 'center' as const },
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
  okIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(52,211,153,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
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
        <button
          onClick={onTake}
          style={{
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
          }}
        >
          <span style={{ fontSize: '24px' }}>📷</span>
          Tomar foto
        </button>
      )}
    </div>
  )
}
