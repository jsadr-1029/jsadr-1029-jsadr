'use client'

// =====================================================
// Página pública /corregir-solicitud/[token]
// Cliente sin login puede corregir fotos de su solicitud devuelta.
// El token se le envía por email y expira en 72h.
//
// IMPORTANTE: Esta página es 'use client' y usa useParams() que puede ser null
// durante la hidratación. Todos los accesos a params deben ser defensivos.
// =====================================================

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GlassCard, GlassButton, Chip, useNbToast } from '@/components/views/portal/glass/ui'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Upload,
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

// Estado para evitar el flash de "cargando" en el servidor
const HYDRATION_GUARD = typeof window !== 'undefined'

export default function CorregirSolicitudPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const toast = useNbToast()

  const [solicitud, setSolicitud] = React.useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [codigoError, setCodigoError] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [enviado, setEnviado] = React.useState(false)

  const [fotos, setFotos] = React.useState<Record<FotoKey, { data: string | null; nombre: string | null }>>({
    CEDULA_FRENTE: { data: null, nombre: null },
    CEDULA_REVERSO: { data: null, nombre: null },
    SELFIE: { data: null, nombre: null },
  })

  // Cargar info de la solicitud
  React.useEffect(() => {
    if (!HYDRATION_GUARD) return
    const token = (params as any)?.token
    if (!token || typeof token !== 'string') return
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
  }, [params])

  const handleFotoChange = (key: FotoKey, file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.push('El archivo debe ser una imagen (JPEG, PNG)', 'danger')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.push('La imagen no puede pesar más de 5MB', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setFotos((prev) => ({
        ...prev,
        [key]: { data: dataUrl, nombre: file.name },
      }))
      toast.push(`${FOTO_LABELS[key].titulo} lista para enviar`, 'success')
    }
    reader.onerror = () => toast.push('Error leyendo la imagen', 'danger')
    reader.readAsDataURL(file)
  }

  const fotosAEnviar = (solicitud?.fotosARecargar || []) as FotoKey[]
  const todasCargadas =
    fotosAEnviar.length > 0 ? fotosAEnviar.every((k) => fotos[k]?.data) : false

  const submit = async () => {
    const token = (params as any)?.token
    if (!token) return
    const algunaFoto = Object.values(fotos).some((f) => f.data)
    if (!algunaFoto) {
      toast.push('Debes cargar al menos una foto', 'danger')
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
      toast.push('¡Correcciones enviadas!', 'success')
    } catch (e: any) {
      toast.push(e.message || 'Error enviando correcciones', 'danger')
    } finally {
      setEnviando(false)
    }
  }

  // === Render ===
  return (
    <div style={{ background: 'var(--nb-gradient-aurora, linear-gradient(180deg, #060812, #0e1224))', minHeight: '100vh' }} className="flex justify-center" data-neobanco-theme="dark">
      <div className="w-full" style={{ maxWidth: '440px' }}>
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between backdrop-blur-md bg-[var(--nb-surface, rgba(255,255,255,0.04))] border-b border-[var(--nb-border, rgba(255,255,255,0.08))]">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
            aria-label="Inicio"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}>
              <RefreshCw size={16} />
            </div>
            <span className="text-[15px] font-extrabold tracking-[-0.02em]" style={{ color: '#f5f7fb' }}>
              JSADR
            </span>
          </button>
          <Chip tone="warning" size="sm">
            Solicitud devuelta
          </Chip>
        </header>

        <main className="px-4 pt-4 pb-8">
          {/* Estado cargando */}
          {cargando && (
            <div className="flex items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin" style={{ color: '#7c7cff' }} />
                <p className="text-sm" style={{ color: '#9aa3b8' }}>Cargando solicitud...</p>
              </div>
            </div>
          )}

          {/* Estado error */}
          {!cargando && (error || !solicitud) && (
            <div className="flex items-center justify-center p-6">
              <div className="w-full nb-glass rounded-[24px] p-6 flex flex-col items-center text-center" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(251,113,133,0.14)', color: '#fb7185' }}>
                  <AlertTriangle size={24} />
                </div>
                <h1 className="text-lg font-bold" style={{ color: '#f5f7fb' }}>No se pudo cargar</h1>
                <p className="text-[13px] mt-1 mb-4" style={{ color: '#9aa3b8' }}>{error || 'Solicitud no encontrada'}</p>
                {codigoError === 'TOKEN_EXPIRADO' && (
                  <p className="text-[12px] mb-4" style={{ color: '#6b7388' }}>
                    El enlace tenía validez de 72 horas. Contacta al asesor para solicitar uno nuevo.
                  </p>
                )}
                {codigoError === 'ESTADO_NO_VALIDO' && (
                  <p className="text-[12px] mb-4" style={{ color: '#6b7388' }}>
                    Esta solicitud ya fue corregida y está en revisión.
                  </p>
                )}
                <button
                  onClick={() => router.push('/')}
                  className="px-5 py-2.5 rounded-xl text-white font-semibold"
                  style={{ background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}
                >
                  Volver al inicio
                </button>
              </div>
            </div>
          )}

          {/* Estado éxito */}
          {!cargando && enviado && (
            <div className="flex items-center justify-center p-6">
              <div className="w-full nb-glass rounded-[24px] p-6 flex flex-col items-center text-center" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h1 className="text-xl font-bold" style={{ color: '#f5f7fb' }}>¡Correcciones enviadas!</h1>
                <p className="text-[13px] mt-2 mb-4 leading-relaxed" style={{ color: '#9aa3b8' }}>
                  Hemos recibido las fotos corregidas de tu solicitud <strong style={{ color: '#f5f7fb' }}>{solicitud?.codigo}</strong>.
                  Nuestro equipo las revisará y te contactará en menos de 24 horas.
                </p>
                <p className="text-[12px] mb-4" style={{ color: '#6b7388' }}>
                  Te enviamos una confirmación a <strong style={{ color: '#9aa3b8' }}>{solicitud?.email}</strong>.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="px-5 py-2.5 rounded-xl text-white font-semibold"
                  style={{ background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}
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
              <div className="mb-4 nb-glass rounded-[24px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="p-5">
                  <h1 className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: '#f5f7fb' }}>
                    Corrige tu solicitud
                  </h1>
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#9aa3b8' }}>
                    Hola <strong style={{ color: '#f5f7fb' }}>{solicitud.nombre}</strong>, necesitamos que vuelvas a cargar
                    algunos documentos para continuar con el estudio de tu crédito.
                  </p>
                </div>
              </div>

              {/* Motivo de devolución */}
              <div className="mb-4 nb-glass rounded-[16px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#fbbf24' }}>
                        Motivo de la devolución
                      </p>
                      <p className="text-[14px] font-semibold mt-1 leading-relaxed" style={{ color: '#f5f7fb' }}>
                        {solicitud.motivoDevolucion || 'Las fotos cargadas están borrosas o no se ven claras.'}
                      </p>
                      {solicitud.detalleDevolucion && (
                        <p className="text-[12px] mt-2 leading-relaxed" style={{ color: '#9aa3b8' }}>
                          {solicitud.detalleDevolucion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen datos */}
              <div className="mb-4 nb-glass rounded-[16px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="p-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b7388' }}>Solicitud</p>
                    <p className="text-[12px] font-bold" style={{ color: '#f5f7fb' }}>{solicitud.codigo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b7388' }}>Cédula</p>
                    <p className="text-[12px] font-bold nb-tabular" style={{ color: '#f5f7fb' }}>{solicitud.cedula}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b7388' }}>Veces devuelta</p>
                    <p className="text-[12px] font-bold" style={{ color: '#9aa3b8' }}>{solicitud.vecesDevuelta}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#6b7388' }}>Expira</p>
                    <p className="text-[12px] font-bold" style={{ color: '#9aa3b8' }}>
                      {solicitud.tokenCorreccionExpira
                        ? new Date(solicitud.tokenCorreccionExpira).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Carga de fotos */}
              <div className="mb-4">
                <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3 px-1" style={{ color: '#9aa3b8' }}>
                  {fotosAEnviar.length > 0 ? 'Documentos a recargar' : 'Documentos que puedes corregir'}
                </h2>
                <div className="flex flex-col gap-3">
                  {(fotosAEnviar.length > 0
                    ? fotosAEnviar
                    : (['CEDULA_FRENTE', 'CEDULA_REVERSO', 'SELFIE'] as FotoKey[])
                  ).map((key) => {
                    const info = FOTO_LABELS[key]
                    const foto = fotos[key]
                    return (
                      <div key={key} className="nb-glass rounded-[16px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                        <div className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,124,255,0.16)', color: '#7c7cff' }}>
                              {info.icon}
                            </div>
                            <div className="flex-1">
                              <p className="text-[14px] font-bold" style={{ color: '#f5f7fb' }}>{info.titulo}</p>
                              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: '#9aa3b8' }}>
                                {info.descripcion}
                              </p>
                            </div>
                          </div>

                          {foto.data && (
                            <div className="relative mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                              <img src={foto.data} alt={info.titulo} className="w-full max-h-60 object-contain" style={{ background: 'rgba(0,0,0,0.4)' }} />
                              <button
                                onClick={() => setFotos((p) => ({ ...p, [key]: { data: null, nombre: null } }))}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full text-white flex items-center justify-center"
                                style={{ background: '#fb7185' }}
                                aria-label="Quitar foto"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                  <line x1="6" y1="18" x2="18" y2="6" />
                                </svg>
                              </button>
                              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-white text-[10px] font-bold flex items-center gap-1" style={{ background: '#34d399' }}>
                                <CheckCircle2 size={11} /> Lista
                              </div>
                            </div>
                          )}

                          {!foto.data && (
                            <label className="block">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleFotoChange(key, f)
                                }}
                                className="hidden"
                              />
                              <div className="cursor-pointer flex flex-col items-center justify-center gap-2 py-6 rounded-2xl transition-colors" style={{ border: '2px dashed rgba(255,255,255,0.16)' }}>
                                <Camera size={24} style={{ color: '#7c7cff' }} />
                                <span className="text-[13px] font-semibold" style={{ color: '#f5f7fb' }}>
                                  Tomar foto / Subir imagen
                                </span>
                                <span className="text-[10px]" style={{ color: '#6b7388' }}>
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
                className="w-full h-14 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #7c7cff, #a78bff)' }}
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

              <p className="text-[11px] text-center mt-3 leading-relaxed" style={{ color: '#6b7388' }}>
                Al enviar, tu solicitud vuelve a la cola de revisión.
                Nuestro equipo la revisará en menos de 24 horas.
              </p>

              {/* Tips fotografía */}
              <div className="mt-4 nb-glass rounded-[16px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(22px)' }}>
                <div className="p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9aa3b8' }}>
                    💡 Tips para fotos nítidas
                  </p>
                  <ul className="text-[11px] space-y-1 leading-relaxed" style={{ color: '#9aa3b8' }}>
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
