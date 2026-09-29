'use client'

// =====================================================
// Página pública /corregir-solicitud/[token]
// Cliente sin login puede corregir fotos de su solicitud devuelta.
// El token se le envía por email y expira en 72h.
// =====================================================

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FileText,
  User,
} from 'lucide-react'

type SolicitudInfo = {
  id: string
  codigo: string
  nombre: string
  apellido: string
  cedula: string
  email: string | null
  telefono: string
  estado: string
  motivoDevolucion: string | null
  detalleDevolucion: string | null
  fotosARecargar: string[]
  vecesDevuelta: number
  fechaDevolucion: string | null
  tokenCorreccionExpira: string | null
}

type FotoKey = 'CEDULA_FRENTE' | 'CEDULA_REVERSO' | 'SELFIE'

const FOTO_LABELS: Record<FotoKey, { titulo: string; descripcion: string; icon: React.ReactNode }> = {
  CEDULA_FRENTE: {
    titulo: 'Cédula — foto frontal',
    descripcion: 'Toma una foto nítida de la parte frontal de tu cédula. Asegúrate de que se vean todos los datos.',
    icon: <FileText size={18} />,
  },
  CEDULA_REVERSO: {
    titulo: 'Cédula — foto reverso',
    descripcion: 'Toma una foto nítida de la parte posterior de tu cédula. Verifica que la firma y la huella se vean claras.',
    icon: <FileText size={18} />,
  },
  SELFIE: {
    titulo: 'Selfie con cédula',
    descripcion: 'Tómate una foto sosteniendo tu cédula junto a tu rostro. Tu cara y la cédula deben verse nítidas.',
    icon: <User size={18} />,
  },
}

export default function CorregirSolicitudPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()

  const [solicitud, setSolicitud] = React.useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [codigoError, setCodigoError] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [enviado, setEnviado] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  const [fotos, setFotos] = React.useState<Record<FotoKey, { data: string | null; nombre: string | null }>>({
    CEDULA_FRENTE: { data: null, nombre: null },
    CEDULA_REVERSO: { data: null, nombre: null },
    SELFIE: { data: null, nombre: null },
  })

  // Marcar mounted (solo en cliente) para evitar errores de hidratación
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Cargar info de la solicitud
  React.useEffect(() => {
    if (!mounted) return
    const token = (params as any)?.token
    if (!token || typeof token !== 'string') {
      setCargando(false)
      setError('Enlace inválido. Verifica que el enlace esté completo.')
      setCodigoError('TOKEN_INVALIDO')
      return
    }
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`/api/solicitudes-nuevos-clientes/corregir/${token}`)
        const data = await res.json()
        if (!active) return
        if (!res.ok || !data.success) {
          setError(data.error || 'No se pudo cargar la solicitud')
          setCodigoError(data.codigo || 'ERROR_DESCONOCIDO')
          return
        }
        setSolicitud(data.data as SolicitudInfo)
      } catch (e: any) {
        if (active) setError(e?.message || 'Error de conexión')
      } finally {
        if (active) setCargando(false)
      }
    })()
    return () => {
      active = false
    }
  }, [params, mounted])

  const handleFotoChange = (key: FotoKey, file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('El archivo debe ser una imagen (JPEG, PNG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede pesar más de 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setFotos((prev) => ({
        ...prev,
        [key]: { data: dataUrl, nombre: file.name },
      }))
    }
    reader.onerror = () => alert('Error leyendo la imagen')
    reader.readAsDataURL(file)
  }

  const fotosAEnviar = (solicitud?.fotosARecargar || []) as FotoKey[]
  const todasCargadas = fotosAEnviar.length > 0 ? fotosAEnviar.every((k) => fotos[k]?.data) : false

  const submit = async () => {
    const token = (params as any)?.token
    if (!token) return
    const algunaFoto = Object.values(fotos).some((f) => f.data)
    if (!algunaFoto) {
      alert('Debes cargar al menos una foto')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/corregir/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fotoCedulaFrente: fotos.CEDULA_FRENTE.data,
          fotoCedulaReverso: fotos.CEDULA_REVERSO.data,
          fotoSelfie: fotos.SELFIE.data,
          fotoCedulaFrenteNombre: fotos.CEDULA_FRENTE.nombre,
          fotoCedulaReversoNombre: fotos.CEDULA_REVERSO.nombre,
          fotoSelfieNombre: fotos.SELFIE.nombre,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron enviar las correcciones')
      }
      setEnviado(true)
    } catch (e: any) {
      alert(e.message || 'Error enviando correcciones')
    } finally {
      setEnviando(false)
    }
  }

  // === Render ===
  return (
    <div style={{ background: 'linear-gradient(180deg, #060812, #0a0d1d, #0e1224)', minHeight: '100vh', color: '#f5f7fb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => router.push('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Inicio"
          >
            <div style={{ width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}>
              <RefreshCw size={16} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
              JSADR
            </span>
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
            Solicitud devuelta
          </span>
        </header>

        <main style={{ padding: '16px 16px 32px' }}>
          {/* Estado cargando */}
          {cargando && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#7c7cff' }} />
                <p style={{ fontSize: 14, color: '#9aa3b8' }}>Cargando solicitud...</p>
              </div>
            </div>
          )}

          {/* Estado error */}
          {!cargando && (error || !solicitud) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, background: 'rgba(251,113,133,0.14)', color: '#fb7185' }}>
                  <AlertTriangle size={24} />
                </div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f5f7fb', margin: 0 }}>No se pudo cargar</h1>
                <p style={{ fontSize: 13, marginTop: 4, marginBottom: 16, color: '#9aa3b8' }}>{error || 'Solicitud no encontrada'}</p>
                {codigoError === 'TOKEN_EXPIRADO' && (
                  <p style={{ fontSize: 12, marginBottom: 16, color: '#6b7388' }}>
                    El enlace tenía validez de 72 horas. Contacta al asesor para solicitar uno nuevo.
                  </p>
                )}
                {codigoError === 'ESTADO_NO_VALIDO' && (
                  <p style={{ fontSize: 12, marginBottom: 16, color: '#6b7388' }}>
                    Esta solicitud ya fue corregida y está en revisión.
                  </p>
                )}
                <button
                  onClick={() => router.push('/')}
                  style={{ padding: '10px 20px', borderRadius: 12, color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}
                >
                  Volver al inicio
                </button>
              </div>
            </div>
          )}

          {/* Estado éxito */}
          {!cargando && enviado && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f5f7fb', margin: 0 }}>¡Correcciones enviadas!</h1>
                <p style={{ fontSize: 13, marginTop: 8, marginBottom: 16, lineHeight: 1.6, color: '#9aa3b8' }}>
                  Hemos recibido las fotos corregidas de tu solicitud <strong style={{ color: '#f5f7fb' }}>{solicitud?.codigo}</strong>.
                  Nuestro equipo las revisará y te contactará en menos de 24 horas.
                </p>
                <p style={{ fontSize: 12, marginBottom: 16, color: '#6b7388' }}>
                  Te enviamos una confirmación a <strong style={{ color: '#9aa3b8' }}>{solicitud?.email}</strong>.
                </p>
                <button
                  onClick={() => router.push('/')}
                  style={{ padding: '10px 20px', borderRadius: 12, color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}
                >
                  Volver al inicio
                </button>
              </div>
            </div>
          )}

          {/* Estado normal */}
          {!cargando && !error && solicitud && !enviado && (
            <>
              {/* Banner motivacional */}
              <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: 20 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#f5f7fb', margin: 0 }}>
                    Corrige tu solicitud
                  </h1>
                  <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6, color: '#9aa3b8' }}>
                    Hola <strong style={{ color: '#f5f7fb' }}>{solicitud.nombre}</strong>, necesitamos que vuelvas a cargar
                    algunos documentos para continuar con el estudio de tu crédito.
                  </p>
                </div>
              </div>

              {/* Motivo de devolución */}
              <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fbbf24', margin: 0 }}>
                        Motivo de la devolución
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.5, color: '#f5f7fb', margin: '4px 0 0' }}>
                        {solicitud.motivoDevolucion || 'Las fotos cargadas están borrosas o no se ven claras.'}
                      </p>
                      {solicitud.detalleDevolucion && (
                        <p style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6, color: '#9aa3b8', margin: '8px 0 0' }}>
                          {solicitud.detalleDevolucion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen datos */}
              <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#6b7388', margin: 0 }}>Solicitud</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f5f7fb', margin: '4px 0 0' }}>{solicitud.codigo}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#6b7388', margin: 0 }}>Cédula</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f5f7fb', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>{solicitud.cedula}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#6b7388', margin: 0 }}>Veces devuelta</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#9aa3b8', margin: '4px 0 0' }}>{solicitud.vecesDevuelta}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: '#6b7388', margin: 0 }}>Expira</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#9aa3b8', margin: '4px 0 0' }}>
                      {solicitud.tokenCorreccionExpira
                        ? new Date(solicitud.tokenCorreccionExpira).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Carga de fotos */}
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, paddingLeft: 4, color: '#9aa3b8', margin: '0 0 12px' }}>
                  {fotosAEnviar.length > 0 ? 'Documentos a recargar' : 'Documentos que puedes corregir'}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(fotosAEnviar.length > 0 ? fotosAEnviar : (['CEDULA_FRENTE', 'CEDULA_REVERSO', 'SELFIE'] as FotoKey[])).map((key) => {
                    const info = FOTO_LABELS[key]
                    const foto = fotos[key]
                    return (
                      <div key={key} style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ padding: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(124,124,255,0.16)', color: '#7c7cff' }}>
                              {info.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#f5f7fb', margin: 0 }}>{info.titulo}</p>
                              <p style={{ fontSize: 12, marginTop: 2, lineHeight: 1.6, color: '#9aa3b8', margin: '2px 0 0' }}>
                                {info.descripcion}
                              </p>
                            </div>
                          </div>

                          {foto.data && (
                            <div style={{ position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <img src={foto.data} alt={info.titulo} style={{ width: '100%', maxHeight: 240, objectFit: 'contain', background: 'rgba(0,0,0,0.4)', display: 'block' }} />
                              <button
                                onClick={() => setFotos((p) => ({ ...p, [key]: { data: null, nombre: null } }))}
                                style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: '#fb7185', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                aria-label="Quitar foto"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                  <line x1="6" y1="18" x2="18" y2="6" />
                                </svg>
                              </button>
                              <div style={{ position: 'absolute', bottom: 8, left: 8, padding: '4px 8px', borderRadius: 8, color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, background: '#34d399' }}>
                                <CheckCircle2 size={11} /> Lista
                              </div>
                            </div>
                          )}

                          {!foto.data && (
                            <label style={{ display: 'block' }}>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleFotoChange(key, f)
                                }}
                                style={{ display: 'none' }}
                              />
                              <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', borderRadius: 16, border: '2px dashed rgba(255,255,255,0.16)' }}>
                                <Camera size={24} style={{ color: '#7c7cff' }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f7fb' }}>
                                  Tomar foto / Subir imagen
                                </span>
                                <span style={{ fontSize: 10, color: '#6b7388' }}>
                                  JPEG, PNG o WebP · Máx 5MB
                                </span>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Botón enviar */}
              <button
                onClick={submit}
                disabled={enviando || (!todasCargadas && !Object.values(fotos).some((f) => f.data))}
                style={{ width: '100%', height: 56, borderRadius: 16, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: enviando ? 'wait' : 'pointer', background: 'linear-gradient(135deg, #7c7cff, #a78bff)', opacity: (enviando || (!todasCargadas && !Object.values(fotos).some((f) => f.data))) ? 0.5 : 1 }}
              >
                {enviando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enviando correcciones...
                  </>
                ) : (
                  <>
                    Enviar correcciones
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <p style={{ fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 1.6, color: '#6b7388' }}>
                Al enviar, tu solicitud vuelve a la cola de revisión.
                Nuestro equipo la revisará en menos de 24 horas.
              </p>

              {/* Tips fotografía */}
              <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, color: '#9aa3b8', margin: '0 0 8px' }}>
                    💡 Tips para fotos nítidas
                  </p>
                  <ul style={{ fontSize: 11, listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.7, color: '#9aa3b8' }}>
                    <li>• Usa buena iluminación (luz natural preferiblemente)</li>
                    <li>• Coloca la cédula sobre una superficie plana y oscura</li>
                    <li>• Mantén el celular recto, sin ángulo</li>
                    <li>• Verifica que todos los datos se lean claramente antes de subir</li>
                    <li>• En la selfie, sostén la cédula al lado de tu cara sin taparla</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
