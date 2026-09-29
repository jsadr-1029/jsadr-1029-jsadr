'use client'

// =====================================================
// Página pública /corregir-solicitud/[token]
// Cliente sin login puede corregir fotos de su solicitud devuelta.
// El token se le envía por email y expira en 72h.
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
  Mail,
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
  const toast = useNbToast()

  const [solicitud, setSolicitud] = React.useState<SolicitudInfo | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [codigoError, setCodigoError] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [enviado, setEnviado] = React.useState(false)

  // Fotos a subir
  const [fotos, setFotos] = React.useState<Record<FotoKey, { data: string | null; nombre: string | null }>>({
    CEDULA_FRENTE: { data: null, nombre: null },
    CEDULA_REVERSO: { data: null, nombre: null },
    SELFIE: { data: null, nombre: null },
  })

  // Cargar info de la solicitud
  React.useEffect(() => {
    if (!params.token) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`/api/solicitudes-nuevos-clientes/corregir/${params.token}`)
        const data = await res.json()
        if (!active) return
        if (!res.ok || !data.success) {
          setError(data.error || 'No se pudo cargar la solicitud')
          setCodigoError(data.codigo || 'ERROR_DESCONOCIDO')
          return
        }
        setSolicitud(data.data as SolicitudInfo)
      } catch (e: any) {
        if (active) setError(e.message || 'Error de conexión')
      } finally {
        if (active) setCargando(false)
      }
    })()
    return () => {
      active = false
    }
  }, [params.token])

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
  const todasCargadas = fotosAEnviar.length > 0
    ? fotosAEnviar.every((k) => fotos[k]?.data)
    : false

  const submit = async () => {
    if (!params.token) return
    const algunaFoto = Object.values(fotos).some((f) => f.data)
    if (!algunaFoto) {
      toast.push('Debes cargar al menos una foto', 'danger')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`/api/solicitudes-nuevos-clientes/corregir/${params.token}`, {
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

  // === Estado cargando ===
  if (cargando) {
    return (
      <div style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }} className="flex justify-center" data-neobanco-theme="dark">
        <div className="w-full max-w-[440px] flex items-center justify-center p-6">
          <div className="nb-glass rounded-[24px] p-8 flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--nb-primary)]" />
            <p className="text-sm text-[var(--nb-fg-muted)]">Cargando solicitud...</p>
          </div>
        </div>
      </div>
    )
  }

  // === Estado error ===
  if (error || !solicitud) {
    return (
      <div style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }} className="flex justify-center" data-neobanco-theme="dark">
        <div className="w-full max-w-[440px] flex items-center justify-center p-6">
          <GlassCard radius="lg" variant="elevated" className="w-full">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--nb-danger-soft)] text-[var(--nb-danger)] flex items-center justify-center mb-3">
                <AlertTriangle size={24} />
              </div>
              <h1 className="text-lg font-bold text-[var(--nb-fg)]">No se pudo cargar</h1>
              <p className="text-[13px] text-[var(--nb-fg-muted)] mt-1 mb-4">{error || 'Solicitud no encontrada'}</p>
              {codigoError === 'TOKEN_EXPIRADO' && (
                <p className="text-[12px] text-[var(--nb-fg-subtle)] mb-4">
                  El enlace tenía validez de 72 horas. Contacta al asesor para solicitar uno nuevo.
                </p>
              )}
              {codigoError === 'ESTADO_NO_VALIDO' && (
                <p className="text-[12px] text-[var(--nb-fg-subtle)] mb-4">
                  Esta solicitud ya fue corregida y está en revisión.
                </p>
              )}
              <GlassButton variant="primary" onClick={() => router.push('/')}>
                Volver al inicio
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  // === Estado éxito ===
  if (enviado) {
    return (
      <div style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }} className="flex justify-center" data-neobanco-theme="dark">
        <div className="w-full max-w-[440px] flex items-center justify-center p-6">
          <GlassCard radius="lg" variant="elevated" className="w-full">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--nb-success-soft)] text-[var(--nb-success)] flex items-center justify-center mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-xl font-bold text-[var(--nb-fg)]">¡Correcciones enviadas!</h1>
              <p className="text-[13px] text-[var(--nb-fg-muted)] mt-2 mb-4 leading-relaxed">
                Hemos recibido las fotos corregidas de tu solicitud <strong>{solicitud.codigo}</strong>.
                Nuestro equipo las revisará y te contactará en menos de 24 horas.
              </p>
              <p className="text-[12px] text-[var(--nb-fg-subtle)] mb-4">
                Te enviamos una confirmación a <strong>{solicitud.email}</strong>.
              </p>
              <GlassButton variant="primary" onClick={() => router.push('/')}>
                Volver al inicio
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  // === Estado normal ===
  return (
    <div style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }} className="flex justify-center" data-neobanco-theme="dark">
      <div className="w-full max-w-[440px]">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between backdrop-blur-md bg-[var(--nb-surface)] border-b border-[var(--nb-border)]">
          <button
            onClick={() => router.push('/')}
            className="nb-press flex items-center gap-2"
            aria-label="Inicio"
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--nb-gradient-brand)] flex items-center justify-center text-white shadow-[0_4px_12px_-2px_rgba(91,91,247,0.45)]">
              <RefreshCw size={16} />
            </div>
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--nb-fg)]">
              JSADR
            </span>
          </button>
          <Chip tone="warning" size="sm">
            Solicitud devuelta
          </Chip>
        </header>

        <main className="px-4 pt-4 pb-8">
          {/* Banner motivacional */}
          <GlassCard radius="lg" variant="elevated" className="mb-4">
            <div className="p-5">
              <h1 className="text-[20px] font-extrabold text-[var(--nb-fg)] tracking-[-0.02em]">
                Corrige tu solicitud
              </h1>
              <p className="text-[13px] text-[var(--nb-fg-muted)] mt-1 leading-relaxed">
                Hola <strong className="text-[var(--nb-fg)]">{solicitud.nombre}</strong>, necesitamos que vuelvas a cargar
                algunos documentos para continuar con el estudio de tu crédito.
              </p>
            </div>
          </GlassCard>

          {/* Motivo de devolución */}
          <GlassCard radius="lg" className="mb-4">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--nb-warning-soft)] text-[var(--nb-warning)] flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-warning)]">
                    Motivo de la devolución
                  </p>
                  <p className="text-[14px] font-semibold text-[var(--nb-fg)] mt-1 leading-relaxed">
                    {solicitud.motivoDevolucion || 'Las fotos cargadas están borrosas o no se ven claras.'}
                  </p>
                  {solicitud.detalleDevolucion && (
                    <p className="text-[12px] text-[var(--nb-fg-muted)] mt-2 leading-relaxed">
                      {solicitud.detalleDevolucion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Resumen datos */}
          <GlassCard radius="md" className="mb-4">
            <div className="p-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                  Solicitud
                </p>
                <p className="text-[12px] font-bold text-[var(--nb-fg)]">{solicitud.codigo}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                  Cédula
                </p>
                <p className="text-[12px] font-bold text-[var(--nb-fg)] nb-tabular">{solicitud.cedula}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                  Veces devuelta
                </p>
                <p className="text-[12px] font-bold text-[var(--nb-fg-muted)]">{solicitud.vecesDevuelta}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                  Expira
                </p>
                <p className="text-[12px] font-bold text-[var(--nb-fg-muted)]">
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
          </GlassCard>

          {/* Carga de fotos */}
          <div className="mb-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-3 px-1">
              {fotosAEnviar.length > 0
                ? 'Documentos a recargar'
                : 'Documentos que puedes corregir'}
            </h2>
            <div className="flex flex-col gap-3">
              {(fotosAEnviar.length > 0
                ? fotosAEnviar
                : ['CEDULA_FRENTE', 'CEDULA_REVERSO', 'SELFIE'] as FotoKey[]
              ).map((key) => {
                const info = FOTO_LABELS[key]
                const foto = fotos[key]
                return (
                  <GlassCard key={key} radius="lg">
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center shrink-0">
                          {info.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-[14px] font-bold text-[var(--nb-fg)]">{info.titulo}</p>
                          <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5 leading-relaxed">
                            {info.descripcion}
                          </p>
                        </div>
                      </div>

                      {/* Preview */}
                      {foto.data && (
                        <div className="relative mb-3 rounded-xl overflow-hidden border border-[var(--nb-border)]">
                          <img src={foto.data} alt={info.titulo} className="w-full max-h-60 object-contain bg-black/40" />
                          <button
                            onClick={() => setFotos((p) => ({ ...p, [key]: { data: null, nombre: null } }))}
                            className="absolute top-2 right-2 nb-press w-8 h-8 rounded-full bg-[var(--nb-danger)] text-white flex items-center justify-center"
                            aria-label="Quitar foto"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="6" y1="6" x2="18" y2="18" />
                              <line x1="6" y1="18" x2="18" y2="6" />
                            </svg>
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-[var(--nb-success)] text-white text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Lista
                          </div>
                        </div>
                      )}

                      {/* Input */}
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
                          <div className="nb-press cursor-pointer flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-[var(--nb-border-strong)] hover:border-[var(--nb-primary)] hover:bg-[var(--nb-primary-soft)] transition-colors">
                            <Camera size={24} className="text-[var(--nb-primary)]" />
                            <span className="text-[13px] font-semibold text-[var(--nb-fg)]">
                              Tomar foto / Subir imagen
                            </span>
                            <span className="text-[10px] text-[var(--nb-fg-subtle)]">
                              JPEG, PNG o WebP · Máx 5MB
                            </span>
                          </div>
                        </label>
                      )}
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          </div>

          {/* Botón enviar */}
          <GlassButton
            fullWidth
            variant="primary"
            size="lg"
            loading={enviando}
            disabled={!todasCargadas && !Object.values(fotos).some((f) => f.data)}
            iconRight={!enviando ? <ArrowRight size={16} /> : undefined}
            onClick={submit}
          >
            {enviando ? 'Enviando correcciones...' : 'Enviar correcciones'}
          </GlassButton>

          <p className="text-[11px] text-[var(--nb-fg-subtle)] text-center mt-3 leading-relaxed">
            Al enviar, tu solicitud vuelve a la cola de revisión.
            Nuestro equipo la revisará en menos de 24 horas.
          </p>

          {/* Tip fotografía */}
          <GlassCard radius="md" variant="soft" className="mt-4">
            <div className="p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2">
                💡 Tips para fotos nítidas
              </p>
              <ul className="text-[11px] text-[var(--nb-fg-muted)] space-y-1 leading-relaxed">
                <li>• Usa buena iluminación (luz natural preferiblemente)</li>
                <li>• Coloca la cédula sobre una superficie plana y oscura</li>
                <li>• Mantén el celular recto, sin ángulo</li>
                <li>• Verifica que todos los datos se lean claramente antes de subir</li>
                <li>• En la selfie, sostén la cédula al lado de tu cara sin taparla</li>
              </ul>
            </div>
          </GlassCard>
        </main>
      </div>
    </div>
  )
}
