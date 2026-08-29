'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, Briefcase, DollarSign,
  CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Send, Shield, Camera,
  FileText, Lock, Eye, EyeOff, Home, UserPlus, Clock, BadgeCheck, RefreshCw,
  Landmark, Wallet, Undo2, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import FotoCapture from './FotoCapture'

type FormData = {
  // Paso 1: personales
  nombre: string
  apellido: string
  tipoDocumento: 'CC' | 'CE' | 'TI'
  cedula: string
  fechaNacimiento: string
  telefono: string
  email: string
  // Paso 2: ubicación + ocupación
  ciudad: string
  municipio: string
  direccion: string
  ocupacion: string
  ingresoMensual: string
  // Paso 3: datos bancarios (NUEVO — obligatorio)
  banco: string
  tipoCuenta: 'AHORROS' | 'CORRIENTE' | ''
  numeroCuenta: string
  // Paso 4: referido (opcional)
  referidoPorNombre: string
  referidoPorApellido: string
  referidoPorTelefono: string
  referidoPorParentesco: string
  // Paso 5: fotos
  fotoCedulaFrente: string | null
  fotoCedulaReverso: string | null
  fotoSelfie: string | null
  fotoCedulaFrenteNombre: string | null
  fotoCedulaReversoNombre: string | null
  fotoSelfieNombre: string | null
  // Paso 6: TyC
  aceptaTyC: boolean
  aceptaTratamientoDatos: boolean
  aceptaConsultaCentrales: boolean
  aceptaReportarCentral: boolean
}

const INITIAL: FormData = {
  nombre: '', apellido: '', tipoDocumento: 'CC', cedula: '',
  fechaNacimiento: '', telefono: '', email: '',
  ciudad: '', municipio: '', direccion: '', ocupacion: '', ingresoMensual: '',
  banco: '', tipoCuenta: '', numeroCuenta: '',
  referidoPorNombre: '', referidoPorApellido: '', referidoPorTelefono: '', referidoPorParentesco: '',
  fotoCedulaFrente: null, fotoCedulaReverso: null, fotoSelfie: null,
  fotoCedulaFrenteNombre: null, fotoCedulaReversoNombre: null, fotoSelfieNombre: null,
  aceptaTyC: false, aceptaTratamientoDatos: false, aceptaConsultaCentrales: false, aceptaReportarCentral: false,
}

const PASOS = [
  { n: 1, label: 'Datos personales', icon: User },
  { n: 2, label: 'Ubicación y ocupación', icon: MapPin },
  { n: 3, label: 'Datos bancarios', icon: Landmark },
  { n: 4, label: 'Referido (opcional)', icon: UserPlus },
  { n: 5, label: 'Verificación', icon: Camera },
  { n: 6, label: 'Confirmación', icon: Shield },
]

const BANCOS_COLOMBIA = [
  'Banco de Bogotá',
  'Banco de Occidente',
  'Banco Davivienda',
  'Banco de Colombia (Bancolombia)',
  'BBVA Colombia',
  'Banco Scotiabank Colpatria',
  'Banco GNB Sudameris',
  'Banco AV Villas',
  'Banco BBVA',
  'Banco Popular',
  'Banco Agrario',
  'Banco Caja Social',
  'Banco Itaú',
  'Banco Pichincha',
  'Nequi',
  'Daviplata',
  'Movii',
  'Banco Cooperativo Coopcentral',
  'Lulo Bank',
  'Banco Serfinanza',
  'Otros',
]

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando formulario…</span>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  )
}

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState<{ codigo: string; nombre: string; corregida?: boolean } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Estado para manejar la devolución de solicitud
  const [solicitudDevuelta, setSolicitudDevuelta] = useState<{
    codigo: string
    motivoDevolucion: string
    fechaDevolucion: string
    vecesDevuelta: number
  } | null>(null)
  const [cargandoDevolucion, setCargandoDevolucion] = useState(false)

  const set = (k: keyof FormData, v: any) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((e) => {
      if (!e[k]) return e
      const n = { ...e }
      delete n[k]
      return n
    })
  }

  // === Detección de solicitud DEVUELTA al cargar la página ===
  // Si la URL trae ?cedula=...&corregir=1, busca la solicitud devuelta y precarga el form
  useEffect(() => {
    const cedulaParam = searchParams.get('cedula')
    const corregir = searchParams.get('corregir')
    if (cedulaParam && corregir === '1') {
      setCargandoDevolucion(true)
      fetch(`/api/solicitudes-nuevos-clientes/consulta-publica?cedula=${encodeURIComponent(cedulaParam)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) {
            const s = json.data
            setSolicitudDevuelta({
              codigo: s.codigo,
              motivoDevolucion: s.motivoDevolucion || '',
              fechaDevolucion: s.fechaDevolucion,
              vecesDevuelta: s.vecesDevuelta || 1,
            })
            // Pre-cargar el formulario con los datos existentes
            setForm({
              nombre: s.nombre || '',
              apellido: s.apellido || '',
              tipoDocumento: s.tipoDocumento || 'CC',
              cedula: s.cedula || cedulaParam,
              fechaNacimiento: s.fechaNacimiento ? new Date(s.fechaNacimiento).toISOString().split('T')[0] : '',
              telefono: s.telefono || '',
              email: s.email || '',
              ciudad: s.ciudad || '',
              municipio: s.municipio || '',
              direccion: s.direccion || '',
              ocupacion: s.ocupacion || '',
              ingresoMensual: s.ingresoMensual ? String(s.ingresoMensual) : '',
              banco: s.banco || '',
              tipoCuenta: s.tipoCuenta || '',
              numeroCuenta: s.numeroCuenta || '',
              referidoPorNombre: s.referidoPorNombre || '',
              referidoPorApellido: s.referidoPorApellido || '',
              referidoPorTelefono: s.referidoPorTelefono || '',
              referidoPorParentesco: s.referidoPorParentesco || '',
              // Las fotos NO se pre-cargan — el cliente debe volver a capturarlas
              fotoCedulaFrente: null,
              fotoCedulaReverso: null,
              fotoSelfie: null,
              fotoCedulaFrenteNombre: null,
              fotoCedulaReversoNombre: null,
              fotoSelfieNombre: null,
              aceptaTyC: false, // Re-aceptar TyC
              aceptaTratamientoDatos: false,
              aceptaConsultaCentrales: false,
              aceptaReportarCentral: false,
            })
          }
        })
        .catch((e) => {
          console.error('Error consultando solicitud devuelta:', e)
        })
        .finally(() => setCargandoDevolucion(false))
    }
  }, [searchParams])

  function validarPaso(p: number): boolean {
    const errs: Record<string, string> = {}
    if (p === 1) {
      // === Paso 1: Datos personales — TODOS OBLIGATORIOS ===
      if (form.nombre.trim().length < 2) errs.nombre = 'El nombre es obligatorio'
      if (form.apellido.trim().length < 2) errs.apellido = 'El apellido es obligatorio'
      // Cédula: entre 6 y 12 dígitos numéricos (cédula colombiana típica)
      if (!form.cedula.trim()) errs.cedula = 'El número de documento es obligatorio'
      else if (form.cedula.trim().length < 6) errs.cedula = 'Mínimo 6 dígitos'
      else if (form.cedula.trim().length > 12) errs.cedula = 'Máximo 12 dígitos'
      else if (!/^\d+$/.test(form.cedula.trim())) errs.cedula = 'Solo se permiten números'
      // Fecha de nacimiento — obligatoria y debe ser mayor de 18 años
      if (!form.fechaNacimiento) errs.fechaNacimiento = 'La fecha de nacimiento es obligatoria'
      else {
        const fechaNac = new Date(form.fechaNacimiento + 'T12:00:00')
        const hoy = new Date()
        let edad = hoy.getFullYear() - fechaNac.getFullYear()
        const mes = hoy.getMonth() - fechaNac.getMonth()
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--
        if (edad < 18) errs.fechaNacimiento = 'Debes ser mayor de 18 años'
        else if (edad > 100) errs.fechaNacimiento = 'Fecha inválida'
      }
      // Teléfono — obligatorio, formato celular colombiano (10 dígitos) o fijo (7-8)
      if (!form.telefono.trim()) errs.telefono = 'El teléfono es obligatorio'
      else if (form.telefono.trim().length < 7) errs.telefono = 'Mínimo 7 dígitos'
      else if (form.telefono.trim().length > 13) errs.telefono = 'Máximo 13 caracteres'
      else if (!/^\+?\d+$/.test(form.telefono.trim())) errs.telefono = 'Solo se permiten números y el signo +'
      // Email — OBLIGATORIO (antes era opcional)
      if (!form.email.trim()) errs.email = 'El correo electrónico es obligatorio'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Correo electrónico inválido'
    }
    if (p === 2) {
      // === Paso 2: Ubicación y ocupación — TODOS OBLIGATORIOS ===
      if (form.ciudad.trim().length < 3) errs.ciudad = 'La ciudad es obligatoria'
      if (form.municipio.trim().length < 2) errs.municipio = 'El municipio o localidad es obligatorio'
      if (form.direccion.trim().length < 5) errs.direccion = 'La dirección es obligatoria (mínimo 5 caracteres)'
      if (form.ocupacion.trim().length < 3) errs.ocupacion = 'La ocupación es obligatoria'
      // Ingreso mensual — obligatorio y debe ser un valor numérico positivo
      if (!form.ingresoMensual.trim()) errs.ingresoMensual = 'El ingreso mensual es obligatorio'
      else {
        const ingreso = parseInt(form.ingresoMensual.replace(/[^\d]/g, ''))
        if (isNaN(ingreso) || ingreso <= 0) errs.ingresoMensual = 'Ingresa un valor válido'
        else if (ingreso < 100000) errs.ingresoMensual = 'El ingreso mensual mínimo es $100.000 COP'
      }
    }
    if (p === 3) {
      // === Paso 3: Datos bancarios — TODOS OBLIGATORIOS ===
      if (form.banco.trim().length < 2) errs.banco = 'Selecciona tu banco'
      if (!form.tipoCuenta) errs.tipoCuenta = 'Selecciona el tipo de cuenta'
      if (!form.numeroCuenta.trim()) errs.numeroCuenta = 'El número de cuenta es obligatorio'
      else if (form.numeroCuenta.trim().length < 5) errs.numeroCuenta = 'Mínimo 5 dígitos'
      else if (form.numeroCuenta.trim().length > 20) errs.numeroCuenta = 'Máximo 20 dígitos'
      else if (!/^\d+$/.test(form.numeroCuenta.trim())) errs.numeroCuenta = 'Solo se permiten números'
    }
    if (p === 5) {
      // === Paso 5: Fotos — TODAS OBLIGATORIAS ===
      if (!form.fotoCedulaFrente) errs.fotoCedulaFrente = 'Toma la foto frontal de tu cédula'
      if (!form.fotoCedulaReverso) errs.fotoCedulaReverso = 'Toma la foto del reverso de tu cédula'
      if (!form.fotoSelfie) errs.fotoSelfie = 'Toma la selfie sosteniendo tu cédula'
    }
    if (p === 6) {
      // === Paso 6: TyC — TODOS OBLIGATORIOS ===
      if (!form.aceptaTyC) errs.aceptaTyC = 'Debes aceptar los Términos y Condiciones'
      if (!form.aceptaTratamientoDatos) errs.aceptaTratamientoDatos = 'Debes aceptar la Política de Tratamiento de Datos'
      if (!form.aceptaConsultaCentrales) errs.aceptaConsultaCentrales = 'Debes autorizar la consulta en centrales'
      if (!form.aceptaReportarCentral) errs.aceptaReportarCentral = 'Debes autorizar el reporte a centrales'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function siguiente() {
    setError('')
    if (validarPaso(paso)) {
      setPaso((p) => Math.min(6, p + 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setError('Revisa los campos marcados en rojo')
    }
  }

  function atras() {
    setError('')
    setPaso((p) => Math.max(1, p - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function enviar() {
    setError('')
    if (!validarPaso(6)) {
      setError('Debes aceptar todas las autorizaciones para enviar tu solicitud.')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/solicitudes-nuevos-clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo enviar la solicitud.')
        return
      }
      setOk({
        codigo: data.data.codigo,
        nombre: `${form.nombre} ${form.apellido}`,
        corregida: !!solicitudDevuelta,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setError(e?.message || 'Error de red. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const progreso = (paso / 6) * 100

  // === Pantalla de éxito ===
  if (ok) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
        <div className="relative max-w-lg w-full bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <BadgeCheck className="h-12 w-12 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {ok.corregida ? '¡Solicitud corregida!' : '¡Solicitud enviada!'}
          </h1>
          <p className="text-slate-300 mb-1">Gracias, <span className="font-semibold text-white">{ok.nombre}</span>.</p>
          <p className="text-sm text-slate-400 mb-6">
            {ok.corregida
              ? 'Hemos recibido tu solicitud corregida. Nuestro equipo la revisará nuevamente y se pondrá en contacto contigo en menos de 24 horas hábiles.'
              : 'Hemos recibido tu solicitud de registro. Nuestro equipo revisará tu información y se pondrá en contacto contigo en menos de 24 horas hábiles al teléfono y correo que registraste.'}
          </p>
          <div className="bg-slate-950/60 rounded-2xl p-4 mb-6 border border-slate-700/60">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Código de seguimiento</p>
            <p className="text-xl font-mono text-emerald-400 font-bold">{ok.codigo}</p>
            <p className="text-[11px] text-slate-500 mt-2">Guárdalo para consultas futuras.</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-amber-200 flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Una vez aprobado tu registro, recibirás por WhatsApp o llamada tus credenciales para ingresar al portal del cliente, donde podrás simular créditos y radicar solicitudes.</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/login')} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500">
              Ir al inicio de sesión
            </Button>
            <Button variant="outline" onClick={() => { setOk(null); setForm(INITIAL); setPaso(1); setSolicitudDevuelta(null) }} className="border-slate-600 text-slate-200">
              Registrar a otra persona
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {/* Fondo aurora */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <Link href="/login" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Volver al login</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400" />
            Conexión cifrada
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 sm:p-8 border-b border-slate-700/60">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
              Registro de nuevo cliente
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Completa todos los campos. Al finalizar, nuestro equipo validará tu información y te contactará.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Paso {paso} de 6</span>
                <span>{Math.round(progreso)}% completado</span>
              </div>
              <Progress value={progreso} className="h-2 bg-slate-800" />
            </div>
          </div>

          {/* Steps indicator */}
          <div className="px-6 sm:px-8 pt-4 pb-2 flex flex-wrap gap-1.5">
            {PASOS.map((p) => {
              const Icon = p.icon
              const activo = p.n === paso
              const completado = p.n < paso
              return (
                <button
                  key={p.n}
                  type="button"
                  onClick={() => p.n < paso && setPaso(p.n)}
                  disabled={p.n > paso}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                    activo
                      ? 'bg-indigo-500 text-white'
                      : completado
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-slate-800/50 text-slate-500'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Contenido del paso */}
          <div className="p-6 sm:p-8 space-y-5 min-h-[420px]">
            {error && (
              <Alert className="bg-red-500/10 border-red-500/30 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Banner de solicitud devuelta */}
            {solicitudDevuelta && paso === 1 && (
              <Alert className="bg-orange-500/10 border-orange-500/40 text-orange-100">
                <Undo2 className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <AlertDescription>
                  <div className="text-sm">
                    <p className="font-bold text-orange-300 mb-1">
                      Tu solicitud fue devuelta para corrección{solicitudDevuelta.vecesDevuelta > 1 ? ` (vez #${solicitudDevuelta.vecesDevuelta})` : ''}
                    </p>
                    <p className="text-xs text-orange-200 mb-2">
                      Solicitud <span className="font-mono">{solicitudDevuelta.codigo}</span> · Devuelta el {new Date(solicitudDevuelta.fechaDevolucion).toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-orange-100 mb-2 font-semibold">Motivo:</p>
                    <p className="text-xs text-orange-50 whitespace-pre-wrap bg-orange-500/10 border border-orange-500/20 rounded p-2 mb-2">
                      {solicitudDevuelta.motivoDevolucion}
                    </p>
                    <p className="text-[11px] text-orange-200">
                      Hemos precargado tus datos. Por favor revisa la información, corrige lo solicitado y vuelve a tomar las fotos. Al finalizar, tu solicitud quedará nuevamente en estado pendiente.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {cargandoDevolucion && (
              <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-100">
                <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                <AlertDescription className="text-sm">
                  Cargando los datos de tu solicitud previa…
                </AlertDescription>
              </Alert>
            )}

            {/* PASO 1 — Datos personales */}
            {paso === 1 && (
              <div className="space-y-4">
                <SectionTitle icon={User} title="Cuéntanos sobre ti" subtitle="Todos los campos son obligatorios. Serán verificados contra tu cédula." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre" error={fieldErrors.nombre} icon={User} obligatorio>
                    <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Juan" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Apellido" error={fieldErrors.apellido} icon={User} obligatorio>
                    <Input value={form.apellido} onChange={(e) => set('apellido', e.target.value)} placeholder="Pérez" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Tipo documento" error={fieldErrors.tipoDocumento} obligatorio>
                    <select
                      value={form.tipoDocumento}
                      onChange={(e) => set('tipoDocumento', e.target.value as any)}
                      required
                      className="w-full h-10 rounded-md bg-slate-950/50 border border-slate-700 px-3 text-sm"
                    >
                      <option value="CC">C.C. — Cédula ciudadanía</option>
                      <option value="CE">C.E. — Cédula extranjería</option>
                      <option value="TI">T.I. — Tarjeta identidad</option>
                    </select>
                  </Field>
                  <Field label="Número de documento" error={fieldErrors.cedula} icon={CreditCard} obligatorio>
                    <Input value={form.cedula} onChange={(e) => set('cedula', e.target.value.replace(/[^\d]/g, ''))} placeholder="1234567890" inputMode="numeric" required maxLength={12} className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Fecha de nacimiento" error={fieldErrors.fechaNacimiento} icon={Calendar} obligatorio>
                    <Input type="date" value={form.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Teléfono / WhatsApp" error={fieldErrors.telefono} icon={Phone} obligatorio>
                    <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^\d+]/g, ''))} placeholder="3001234567" inputMode="tel" required maxLength={13} className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Correo electrónico" error={fieldErrors.email} icon={Mail} obligatorio>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@correo.com" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span className="text-red-400 font-bold">*</span>
                  <span>Estos campos son obligatorios para procesar tu solicitud.</span>
                </p>
              </div>
            )}

            {/* PASO 2 — Ubicación y ocupación */}
            {paso === 2 && (
              <div className="space-y-4">
                <SectionTitle icon={MapPin} title="¿Dónde vives y a qué te dedicas?" subtitle="Todos los campos son obligatorios. Esta información nos ayuda a evaluar tu solicitud." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Ciudad" error={fieldErrors.ciudad} icon={Home} obligatorio>
                    <Input value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} placeholder="Bogotá" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Municipio / Localidad" error={fieldErrors.municipio} icon={MapPin} obligatorio>
                    <Input value={form.municipio} onChange={(e) => set('municipio', e.target.value)} placeholder="Chapinero" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <Field label="Dirección de residencia" error={fieldErrors.direccion} icon={MapPin} obligatorio>
                  <Input value={form.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Calle 123 # 45-67, Apto 501" required className="bg-slate-950/50 border-slate-700" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Ocupación" error={fieldErrors.ocupacion} icon={Briefcase} obligatorio>
                    <Input value={form.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} placeholder="Empleado, comerciante, independiente…" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Ingreso mensual (COP)" error={fieldErrors.ingresoMensual} icon={DollarSign} obligatorio>
                    <Input value={form.ingresoMensual} onChange={(e) => set('ingresoMensual', e.target.value.replace(/[^\d]/g, ''))} placeholder="2500000" inputMode="numeric" required className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span className="text-red-400 font-bold">*</span>
                  <span>Estos campos son obligatorios para procesar tu solicitud.</span>
                </p>
              </div>
            )}

            {/* PASO 3 — Datos bancarios (NUEVO) */}
            {paso === 3 && (
              <div className="space-y-4">
                <SectionTitle
                  icon={Landmark}
                  title="Datos de tu cuenta bancaria"
                  subtitle="Todos los campos son obligatorios. Esta cuenta se usará para disbursar tus solicitudes."
                />
                <Alert className="bg-indigo-500/10 border-indigo-500/30 text-indigo-200">
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Los datos bancarios son <strong>obligatorios</strong>. La cuenta debe estar a tu nombre y coincidir con el documento de identidad registrado.
                  </AlertDescription>
                </Alert>
                <Field label="Banco" error={fieldErrors.banco} icon={Landmark} obligatorio>
                  <select
                    value={form.banco}
                    onChange={(e) => set('banco', e.target.value)}
                    required
                    className="w-full h-10 rounded-md bg-slate-950/50 border border-slate-700 px-3 text-sm"
                  >
                    <option value="">Selecciona tu banco…</option>
                    {BANCOS_COLOMBIA.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Tipo de cuenta" error={fieldErrors.tipoCuenta} icon={CreditCard} obligatorio>
                    <select
                      value={form.tipoCuenta}
                      onChange={(e) => set('tipoCuenta', e.target.value as any)}
                      required
                      className="w-full h-10 rounded-md bg-slate-950/50 border border-slate-700 px-3 text-sm"
                    >
                      <option value="">Selecciona…</option>
                      <option value="AHORROS">Cuenta de Ahorros</option>
                      <option value="CORRIENTE">Cuenta Corriente</option>
                    </select>
                  </Field>
                  <Field label="Número de cuenta" error={fieldErrors.numeroCuenta} icon={CreditCard} obligatorio>
                    <Input
                      value={form.numeroCuenta}
                      onChange={(e) => set('numeroCuenta', e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="000123456789"
                      inputMode="numeric"
                      required
                      maxLength={20}
                      className="bg-slate-950/50 border-slate-700 font-mono"
                    />
                  </Field>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <p className="text-xs text-amber-200 flex items-start gap-2">
                    <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Verifica muy bien el número de cuenta. Si el solicitud se disbursa a una cuenta incorrecta por error de digitación, el proceso de reversión puede demorar varios días hábiles.</span>
                  </p>
                </div>
              </div>
            )}

            {/* PASO 4 — Referido */}
            {paso === 4 && (
              <div className="space-y-4">
                <SectionTitle icon={UserPlus} title="¿Te recomendó un cliente actual?" subtitle="Opcional — nos ayuda a validar tu solicitud más rápido." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre del referido" icon={User}>
                    <Input value={form.referidoPorNombre} onChange={(e) => set('referidoPorNombre', e.target.value)} placeholder="María" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Apellido del referido">
                    <Input value={form.referidoPorApellido} onChange={(e) => set('referidoPorApellido', e.target.value)} placeholder="Gómez" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Teléfono del referido" icon={Phone}>
                    <Input value={form.referidoPorTelefono} onChange={(e) => set('referidoPorTelefono', e.target.value.replace(/[^\d+]/g, ''))} placeholder="3009876543" inputMode="tel" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Parentesco / Relación">
                    <Input value={form.referidoPorParentesco} onChange={(e) => set('referidoPorParentesco', e.target.value)} placeholder="Amigo, familiar, compañero…" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <p className="text-xs text-slate-500 italic">Puedes dejar estos campos en blanco si nadie te recomendó.</p>
              </div>
            )}

            {/* PASO 5 — Fotos */}
            {paso === 5 && (
              <div className="space-y-4">
                <SectionTitle icon={Camera} title="Verificación de identidad" subtitle="Necesitamos verificar que eres tú. Puedes usar la cámara o subir un archivo." />
                {solicitudDevuelta && (
                  <Alert className="bg-orange-500/10 border-orange-500/40 text-orange-100">
                    <Info className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs">
                      Por seguridad y porque tu solicitud fue devuelta para corrección, debes volver a tomar las 3 fotos.
                      Asegúrate de que las imágenes sean nítidas y legibles.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-3">
                  <FotoCapture
                    label="Foto de la cédula (frente)"
                    descripcion="Asegúrate de que se lean todos los datos. Usa el botón 🔄 para cambiar entre cámara frontal y trasera."
                    valor={form.fotoCedulaFrente}
                    nombreArchivo={form.fotoCedulaFrenteNombre}
                    onChange={(v, n) => { set('fotoCedulaFrente', v); set('fotoCedulaFrenteNombre', n) }}
                    defaultFacing="environment"
                  />
                  <FotoCapture
                    label="Foto de la cédula (reverso)"
                    descripcion="La cara donde aparece la firma y la huella. Usa el botón 🔄 para cambiar entre cámara frontal y trasera."
                    valor={form.fotoCedulaReverso}
                    nombreArchivo={form.fotoCedulaReversoNombre}
                    onChange={(v, n) => { set('fotoCedulaReverso', v); set('fotoCedulaReversoNombre', n) }}
                    defaultFacing="environment"
                  />
                  <FotoCapture
                    label="Selfie sosteniendo tu cédula"
                    descripcion="Tu rostro completo y la cédula deben verse nítidos. Usa el botón 🔄 para cambiar entre cámara frontal y trasera."
                    valor={form.fotoSelfie}
                    nombreArchivo={form.fotoSelfieNombre}
                    onChange={(v, n) => { set('fotoSelfie', v); set('fotoSelfieNombre', n) }}
                    defaultFacing="user"
                    mirror
                  />
                </div>
                {(fieldErrors.fotoCedulaFrente || fieldErrors.fotoCedulaReverso || fieldErrors.fotoSelfie) && (
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Las tres fotos son obligatorias.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* PASO 6 — TyC */}
            {paso === 6 && (
              <div className="space-y-4">
                <SectionTitle icon={Shield} title="Autorizaciones finales" subtitle="Para procesar tu solicitud necesitamos tu consentimiento." />
                <div className="space-y-3">
                  <CheckRow
                    checked={form.aceptaTyC}
                    onChange={(v) => set('aceptaTyC', v)}
                    error={fieldErrors.aceptaTyC}
                    label="Acepto los Términos y Condiciones del servicio"
                  />
                  <CheckRow
                    checked={form.aceptaTratamientoDatos}
                    onChange={(v) => set('aceptaTratamientoDatos', v)}
                    error={fieldErrors.aceptaTratamientoDatos}
                    label="Autorizo el tratamiento de mis datos personales conforme a la Política de Privacidad (Ley 1581 de 2012)"
                  />
                  <CheckRow
                    checked={form.aceptaConsultaCentrales}
                    onChange={(v) => set('aceptaConsultaCentrales', v)}
                    error={fieldErrors.aceptaConsultaCentrales}
                    label="Autorizo la consulta de mi historial en centrales de riesgo (Datacrédito, Cifin, TransUnion)"
                  />
                  <CheckRow
                    checked={form.aceptaReportarCentral}
                    onChange={(v) => set('aceptaReportarCentral', v)}
                    error={fieldErrors.aceptaReportarCentral}
                    label="Autorizo el reporte de mi comportamiento de pago a centrales de riesgo"
                  />
                </div>

                {/* Resumen */}
                <div className="mt-6 p-4 rounded-2xl bg-slate-950/40 border border-slate-700/60">
                  <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" /> Resumen de tu solicitud
                  </h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <ResumenItem label="Nombre" value={`${form.nombre} ${form.apellido}`} />
                    <ResumenItem label="Documento" value={`${form.tipoDocumento} ${form.cedula}`} />
                    <ResumenItem label="Teléfono" value={form.telefono} />
                    <ResumenItem label="Email" value={form.email || '—'} />
                    <ResumenItem label="Ciudad" value={form.ciudad || '—'} />
                    <ResumenItem label="Ocupación" value={form.ocupacion || '—'} />
                    <ResumenItem label="Banco" value={form.banco || '—'} />
                    <ResumenItem label="Cuenta" value={form.tipoCuenta ? `${form.tipoCuenta} ${form.numeroCuenta}` : '—'} />
                    <ResumenItem label="Fotos" value={`${[form.fotoCedulaFrente, form.fotoCedulaReverso, form.fotoSelfie].filter(Boolean).length}/3 cargadas`} />
                  </dl>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <p className="text-xs text-amber-200 flex items-start gap-2">
                    <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Tus datos se envían por conexión cifrada y se almacenan de forma segura. Solo el equipo autorizado de Jsadr tendrá acceso para validar tu solicitud.</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer con botones */}
          <div className="px-6 sm:px-8 py-5 border-t border-slate-700/60 flex justify-between bg-slate-950/40">
            <Button variant="ghost" onClick={atras} disabled={paso === 1 || enviando} className="text-slate-300">
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
            {paso < 6 ? (
              <Button onClick={siguiente} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500">
                Continuar <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={enviar} disabled={enviando} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500">
                {enviando ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Enviar solicitud</>
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          ¿Ya eres cliente?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

// === Sub-componentes ===

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-indigo-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, error, icon: Icon, children, obligatorio = false }: { label: string; error?: string; icon?: any; children: React.ReactNode; obligatorio?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-300 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-500" />}
        {label}
        {obligatorio && <span className="text-red-400 font-bold" title="Campo obligatorio">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-400 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>}
    </div>
  )
}

function CheckRow({ checked, onChange, error, label }: { checked: boolean; onChange: (v: boolean) => void; error?: string; label: string }) {
  return (
    <div>
      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/40 border-slate-700/60 hover:border-slate-600'}`}>
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
        <span className="text-sm text-slate-200">{label}</span>
      </label>
      {error && <p className="text-[11px] text-red-400 mt-1 ml-1">{error}</p>}
    </div>
  )
}

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 font-medium truncate">{value}</dd>
    </>
  )
}
