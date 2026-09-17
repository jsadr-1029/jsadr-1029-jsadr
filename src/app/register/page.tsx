'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, Briefcase, DollarSign,
  CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Send, Shield, Camera,
  FileText, Lock, Eye, EyeOff, Home, UserPlus, Clock, BadgeCheck, RefreshCw
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
  // Paso 3: crédito solicitado
  valorSolicitado: string
  plazoDeseado: string
  destinoCredito: string
  // Paso 4: referido
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
  valorSolicitado: '', plazoDeseado: '', destinoCredito: '',
  referidoPorNombre: '', referidoPorApellido: '', referidoPorTelefono: '', referidoPorParentesco: '',
  fotoCedulaFrente: null, fotoCedulaReverso: null, fotoSelfie: null,
  fotoCedulaFrenteNombre: null, fotoCedulaReversoNombre: null, fotoSelfieNombre: null,
  aceptaTyC: false, aceptaTratamientoDatos: false, aceptaConsultaCentrales: false, aceptaReportarCentral: false,
}

const PASOS = [
  { n: 1, label: 'Datos personales', icon: User },
  { n: 2, label: 'Ubicación y ocupación', icon: MapPin },
  { n: 3, label: 'Crédito solicitado', icon: DollarSign },
  { n: 4, label: 'Referido (opcional)', icon: UserPlus },
  { n: 5, label: 'Verificación', icon: Camera },
  { n: 6, label: 'Confirmación', icon: Shield },
]

export default function RegisterPage() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState<{ codigo: string; nombre: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = (k: keyof FormData, v: any) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((e) => {
      if (!e[k]) return e
      const n = { ...e }
      delete n[k]
      return n
    })
  }

  function validarPaso(p: number): boolean {
    const errs: Record<string, string> = {}
    if (p === 1) {
      if (form.nombre.trim().length < 2) errs.nombre = 'Nombre requerido'
      if (form.apellido.trim().length < 2) errs.apellido = 'Apellido requerido'
      if (form.cedula.trim().length < 5) errs.cedula = 'Documento requerido'
      if (form.telefono.trim().length < 7) errs.telefono = 'Teléfono requerido'
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Email inválido'
    }
    if (p === 2) {
      if (form.ciudad.trim().length < 2) errs.ciudad = 'Ciudad requerida'
      if (form.direccion.trim().length < 5) errs.direccion = 'Dirección requerida'
    }
    if (p === 3) {
      const v = Number(form.valorSolicitado)
      if (!form.valorSolicitado || isNaN(v) || v < 10000) errs.valorSolicitado = 'Valor mínimo $10.000'
    }
    if (p === 5) {
      if (!form.fotoCedulaFrente) errs.fotoCedulaFrente = 'Toma la foto frontal de tu cédula'
      if (!form.fotoCedulaReverso) errs.fotoCedulaReverso = 'Toma la foto del reverso de tu cédula'
      if (!form.fotoSelfie) errs.fotoSelfie = 'Toma la selfie sosteniendo tu cédula'
    }
    if (p === 6) {
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
      setOk({ codigo: data.data.codigo, nombre: `${form.nombre} ${form.apellido}` })
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
          <h1 className="text-2xl font-bold mb-2">¡Solicitud enviada!</h1>
          <p className="text-slate-300 mb-1">Gracias, <span className="font-semibold text-white">{ok.nombre}</span>.</p>
          <p className="text-sm text-slate-400 mb-6">
            Hemos recibido tu solicitud de registro. Nuestro equipo revisará tu información y se pondrá en contacto contigo en menos de 24 horas hábiles al teléfono y correo que registraste.
          </p>
          <div className="bg-slate-950/60 rounded-2xl p-4 mb-6 border border-slate-700/60">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Código de seguimiento</p>
            <p className="text-xl font-mono text-emerald-400 font-bold">{ok.codigo}</p>
            <p className="text-[11px] text-slate-500 mt-2">Guárdalo para consultas futuras.</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-amber-200 flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Una vez aprobado tu registro, recibirás por WhatsApp o llamada tus credenciales para ingresar al portal del cliente.</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/login')} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500">
              Ir al inicio de sesión
            </Button>
            <Button variant="outline" onClick={() => { setOk(null); setForm(INITIAL); setPaso(1) }} className="border-slate-600 text-slate-200">
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

            {/* PASO 1 — Datos personales */}
            {paso === 1 && (
              <div className="space-y-4">
                <SectionTitle icon={User} title="Cuéntanos sobre ti" subtitle="Estos datos serán verificados contra tu cédula." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre" error={fieldErrors.nombre} icon={User}>
                    <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Juan" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Apellido" error={fieldErrors.apellido} icon={User}>
                    <Input value={form.apellido} onChange={(e) => set('apellido', e.target.value)} placeholder="Pérez" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Tipo documento" error={fieldErrors.tipoDocumento}>
                    <select
                      value={form.tipoDocumento}
                      onChange={(e) => set('tipoDocumento', e.target.value as any)}
                      className="w-full h-10 rounded-md bg-slate-950/50 border border-slate-700 px-3 text-sm"
                    >
                      <option value="CC">C.C. — Cédula ciudadanía</option>
                      <option value="CE">C.E. — Cédula extranjería</option>
                      <option value="TI">T.I. — Tarjeta identidad</option>
                    </select>
                  </Field>
                  <Field label="Número de documento" error={fieldErrors.cedula} icon={CreditCard}>
                    <Input value={form.cedula} onChange={(e) => set('cedula', e.target.value.replace(/[^\d]/g, ''))} placeholder="1234567890" inputMode="numeric" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Fecha de nacimiento" error={fieldErrors.fechaNacimiento} icon={Calendar}>
                    <Input type="date" value={form.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Teléfono / WhatsApp" error={fieldErrors.telefono} icon={Phone}>
                    <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^\d+]/g, ''))} placeholder="3001234567" inputMode="tel" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Correo electrónico (opcional)" error={fieldErrors.email} icon={Mail}>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@correo.com" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
              </div>
            )}

            {/* PASO 2 — Ubicación y ocupación */}
            {paso === 2 && (
              <div className="space-y-4">
                <SectionTitle icon={MapPin} title="¿Dónde vives y a qué te dedicas?" subtitle="Esta información nos ayuda a evaluar tu solicitud." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Ciudad" error={fieldErrors.ciudad} icon={Home}>
                    <Input value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} placeholder="Bogotá" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Municipio / Localidad" error={fieldErrors.municipio}>
                    <Input value={form.municipio} onChange={(e) => set('municipio', e.target.value)} placeholder="Chapinero" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
                <Field label="Dirección de residencia" error={fieldErrors.direccion} icon={MapPin}>
                  <Input value={form.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Calle 123 # 45-67, Apto 501" className="bg-slate-950/50 border-slate-700" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Ocupación" error={fieldErrors.ocupacion} icon={Briefcase}>
                    <Input value={form.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} placeholder="Empleado, comerciante, independiente…" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                  <Field label="Ingreso mensual (COP)" error={fieldErrors.ingresoMensual} icon={DollarSign}>
                    <Input value={form.ingresoMensual} onChange={(e) => set('ingresoMensual', e.target.value.replace(/[^\d]/g, ''))} placeholder="2500000" inputMode="numeric" className="bg-slate-950/50 border-slate-700" />
                  </Field>
                </div>
              </div>
            )}

            {/* PASO 3 — Crédito solicitado */}
            {paso === 3 && (
              <div className="space-y-4">
                <SectionTitle icon={DollarSign} title="¿Cuánto necesitas y para qué?" subtitle="Esta es tu solicitud de crédito inicial. Podrás modificarla después." />
                <Field label="Valor solicitado (COP)" error={fieldErrors.valorSolicitado} icon={DollarSign}>
                  <Input
                    value={form.valorSolicitado ? Number(form.valorSolicitado).toLocaleString('es-CO') : ''}
                    onChange={(e) => set('valorSolicitado', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="1.000.000"
                    inputMode="numeric"
                    className="bg-slate-950/50 border-slate-700"
                  />
                </Field>
                <Field label="Plazo deseado (meses)" error={fieldErrors.plazoDeseado} icon={Calendar}>
                  <Input value={form.plazoDeseado} onChange={(e) => set('plazoDeseado', e.target.value.replace(/[^\d]/g, ''))} placeholder="12" inputMode="numeric" className="bg-slate-950/50 border-slate-700" />
                </Field>
                <Field label="¿Para qué necesitas el crédito?" error={fieldErrors.destinoCredito} icon={FileText}>
                  <Textarea value={form.destinoCredito} onChange={(e) => set('destinoCredito', e.target.value)} placeholder="Ej: capital para mi negocio, compra de equipo, pago de deudas…" className="bg-slate-950/50 border-slate-700 min-h-[80px]" />
                </Field>
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
                <div className="space-y-3">
                  <FotoCapture
                    label="Foto de la cédula (frente)"
                    descripcion="Asegúrate de que se lean todos los datos."
                    valor={form.fotoCedulaFrente}
                    nombreArchivo={form.fotoCedulaFrenteNombre}
                    onChange={(v, n) => { set('fotoCedulaFrente', v); set('fotoCedulaFrenteNombre', n) }}
                  />
                  <FotoCapture
                    label="Foto de la cédula (reverso)"
                    descripcion="La cara donde aparece la firma y la huella."
                    valor={form.fotoCedulaReverso}
                    nombreArchivo={form.fotoCedulaReversoNombre}
                    onChange={(v, n) => { set('fotoCedulaReverso', v); set('fotoCedulaReversoNombre', n) }}
                  />
                  <FotoCapture
                    label="Selfie sosteniendo tu cédula"
                    descripcion="Tu rostro completo y la cédula deben verse nítidos."
                    valor={form.fotoSelfie}
                    nombreArchivo={form.fotoSelfieNombre}
                    onChange={(v, n) => { set('fotoSelfie', v); set('fotoSelfieNombre', n) }}
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
                    <ResumenItem label="Valor solicitado" value={form.valorSolicitado ? `$${Number(form.valorSolicitado).toLocaleString('es-CO')}` : '—'} />
                    <ResumenItem label="Plazo" value={form.plazoDeseado ? `${form.plazoDeseado} meses` : '—'} />
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

function Field({ label, error, icon: Icon, children }: { label: string; error?: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-300 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-500" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
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

